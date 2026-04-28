import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { JsonRpcProvider, Wallet, parseEther, parseUnits, formatEther, formatUnits, Contract } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const provider = new JsonRpcProvider(process.env.RPC_URL);
const treasuryWallet = new Wallet(process.env.TREASURY_PRIVATE_KEY, provider);

const USDC_ADDRESS = "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238";
const USDC_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)"
];
const usdcContract    = new Contract(USDC_ADDRESS, USDC_ABI, treasuryWallet);
const usdcReadContract = new Contract(USDC_ADDRESS, USDC_ABI, provider);

let aiClient = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
}

console.log("🟢 D-CRYPT Treasury Engine Ready. Treasury:", treasuryWallet.address);

// ════════════════════════════════════════════════
// MULTI-PROVIDER PRICE CASCADE
// ════════════════════════════════════════════════
async function fetchWithTimeout(url, ms = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function fetchEthPriceInr() {
  const providers = [
    {
      name: 'CoinGecko',
      fn: async () => {
        const res  = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=inr');
        const data = await res.json();
        const p    = data?.ethereum?.inr;
        if (!p) throw new Error('No data');
        return p;
      },
    },
    {
      name: 'CryptoCompare',
      fn: async () => {
        const res  = await fetchWithTimeout('https://min-api.cryptocompare.com/data/price?fsym=ETH&tsyms=INR');
        const data = await res.json();
        if (!data.INR) throw new Error('No data');
        return data.INR;
      },
    },
    {
      name: 'Binance+ExchangeRate',
      fn: async () => {
        const [ethRes, fxRes] = await Promise.all([
          fetchWithTimeout('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT'),
          fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD'),
        ]);
        const [eth, fx] = await Promise.all([ethRes.json(), fxRes.json()]);
        const inrRate = fx?.rates?.INR || 84;
        return parseFloat(eth.price) * inrRate;
      },
    },
  ];
  for (const p of providers) {
    try {
      const price = await p.fn();
      console.log(`✅ ETH/INR from ${p.name}: ₹${price.toFixed(0)}`);
      return price;
    } catch (e) {
      console.warn(`⚠️  ${p.name} ETH price failed: ${e.message}`);
    }
  }
  console.warn('⚠️  All ETH providers failed. Fallback ₹270000');
  return 270000;
}

async function fetchUsdcPriceInr() {
  const providers = [
    {
      name: 'CoinGecko',
      fn: async () => {
        const res  = await fetchWithTimeout('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin&vs_currencies=inr');
        const data = await res.json();
        const p    = data?.['usd-coin']?.inr;
        if (!p) throw new Error('No data');
        return p;
      },
    },
    {
      name: 'ExchangeRate-API',
      fn: async () => {
        const res  = await fetchWithTimeout('https://api.exchangerate-api.com/v4/latest/USD');
        const data = await res.json();
        if (!data?.rates?.INR) throw new Error('No data');
        return data.rates.INR;
      },
    },
    {
      name: 'CryptoCompare (USDT proxy)',
      fn: async () => {
        const res  = await fetchWithTimeout('https://min-api.cryptocompare.com/data/price?fsym=USDT&tsyms=INR');
        const data = await res.json();
        if (!data.INR) throw new Error('No data');
        return data.INR;
      },
    },
  ];
  for (const p of providers) {
    try {
      const price = await p.fn();
      console.log(`✅ USDC/INR from ${p.name}: ₹${price.toFixed(2)}`);
      return price;
    } catch (e) {
      console.warn(`⚠️  ${p.name} USDC price failed: ${e.message}`);
    }
  }
  console.warn('⚠️  All USDC providers failed. Fallback ₹84');
  return 84;
}

// ════════════════════════════════════════════════
// GET /api/price — Live prices for the frontend
// ════════════════════════════════════════════════
app.get('/api/price', async (req, res) => {
  try {
    const [ethPrice, usdcPrice] = await Promise.all([fetchEthPriceInr(), fetchUsdcPriceInr()]);
    res.json({ success: true, ETH: ethPrice, USDC: usdcPrice });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════
// GET /api/balance/:address — On-chain balances
// ════════════════════════════════════════════════
app.get('/api/balance/:address', async (req, res) => {
  const { address } = req.params;
  if (!address || !address.startsWith('0x')) {
    return res.status(400).json({ success: false, error: 'Invalid address' });
  }
  try {
    const [ethBn, usdcBn] = await Promise.all([
      provider.getBalance(address),
      usdcReadContract.balanceOf(address),
    ]);
    res.json({
      success: true,
      eth:  parseFloat(formatEther(ethBn)).toFixed(6),
      usdc: parseFloat(formatUnits(usdcBn, 6)).toFixed(2),
    });
  } catch (error) {
    console.error('Balance error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════
// POST /api/send-crypto — Universal send router
// ════════════════════════════════════════════════
app.post('/api/send-crypto', async (req, res) => {
  // receiverUsername is optional — frontend may pass it if it already resolved @username
  const { username, amountInr, receiverWallet, receiverUsername: frontendReceiverUsername, tokenSymbol = 'USDC', type = 'swap' } = req.body;

  if (!username || !amountInr || !receiverWallet) {
    return res.status(400).json({ success: false, error: 'Missing required fields.' });
  }

  try {
    console.log(`\n⏳ ${username} → ₹${amountInr} via ${tokenSymbol} → ${receiverWallet}`);

    // 1. Fetch sender profile (need wallet_address for the transaction log)
    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('inr_balance, wallet_address')
      .eq('username', username)
      .single();

    if (profileError || !userProfile) {
      return res.status(404).json({ success: false, error: 'Sender not found.' });
    }
    if (userProfile.inr_balance < amountInr) {
      return res.status(400).json({ success: false, error: 'Insufficient INR balance.' });
    }

    // 2. Resolve receiver (username → wallet address)
    let finalReceiverAddress = receiverWallet.trim();
    // Use frontend-supplied receiverUsername if provided (avoids re-lookup for already-resolved 0x addresses)
    let receiverUsername     = frontendReceiverUsername || null;

    if (!finalReceiverAddress.startsWith('0x')) {
      const clean = finalReceiverAddress.replace(/^@/, '').toLowerCase().trim();
      const { data: receiverProfile, error: receiverError } = await supabase
        .from('users')
        .select('wallet_address, username')
        .eq('username', clean)
        .single();

      if (receiverError || !receiverProfile) {
        return res.status(404).json({ success: false, error: `Username @${clean} not found.` });
      }
      finalReceiverAddress = receiverProfile.wallet_address;
      receiverUsername     = receiverProfile.username;
    } else if (!receiverUsername) {
      // If a raw 0x address was passed without a username, try a reverse lookup
      const { data: receiverProfile } = await supabase
        .from('users')
        .select('username')
        .eq('wallet_address', finalReceiverAddress.toLowerCase())
        .maybeSingle();
      if (receiverProfile?.username) receiverUsername = receiverProfile.username;
    }
    console.log(`🎯 Resolved receiver: ${finalReceiverAddress}`);

    // 3. Fetch live price & calculate exact crypto amount
    let cryptoAmountFormatted;
    let tx;

    if (tokenSymbol === 'USDC') {
      const usdcPriceInr    = await fetchUsdcPriceInr();
      const usdcToSend      = amountInr / usdcPriceInr;
      cryptoAmountFormatted = usdcToSend.toFixed(2);
      console.log(`💸 ₹${amountInr} ÷ ₹${usdcPriceInr.toFixed(2)}/USDC = ${cryptoAmountFormatted} USDC`);
      tx = await usdcContract.transfer(finalReceiverAddress, parseUnits(cryptoAmountFormatted, 6));

    } else if (tokenSymbol === 'ETH') {
      const ethPriceInr     = await fetchEthPriceInr();
      const ethToSend       = amountInr / ethPriceInr;
      cryptoAmountFormatted = ethToSend.toFixed(8);
      console.log(`💸 ₹${amountInr} ÷ ₹${ethPriceInr.toFixed(0)}/ETH = ${cryptoAmountFormatted} ETH`);
      tx = await treasuryWallet.sendTransaction({
        to:    finalReceiverAddress,
        value: parseEther(cryptoAmountFormatted),
      });

    } else {
      return res.status(400).json({ success: false, error: 'Unsupported token.' });
    }

    console.log(`⛓️  TX Hash: ${tx.hash}`);

    // 4. Deduct INR from sender in users table
    const { error: updateError } = await supabase
      .from('users')
      .update({ inr_balance: userProfile.inr_balance - amountInr })
      .eq('username', username);
    if (updateError) console.warn('Balance update error:', updateError.message);

    // 5. Record transaction
    const { error: insertError } = await supabase.from('transactions').insert([{
      txn_type:          type === 'send' ? 'crypto_send' : 'swap',
      username:          username,
      wallet_address:    userProfile.wallet_address,
      receiver_username: receiverUsername,
      receiver_address:  finalReceiverAddress,
      amount_inr:        amountInr,
      token_amount:      parseFloat(cryptoAmountFormatted),
      token_symbol:      tokenSymbol,
      web3_hash:         tx.hash,
      direction:         type === 'send' ? null : 'buy',
      status:            'completed',
    }]);
    if (insertError) console.warn('TX insert error:', insertError.message);

    return res.status(200).json({
      success:     true,
      message:     'Crypto sent!',
      hash:        tx.hash,
      cryptoAmount: parseFloat(cryptoAmountFormatted),
      tokenSymbol,
    });

  } catch (error) {
    console.error('❌ Engine Error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════
// GET /api/stats — Live platform stats for landing page
// ════════════════════════════════════════════════
app.get('/api/stats', async (req, res) => {
  try {
    // Total registered users
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true });

    // Total completed transactions
    const { count: txCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // Total INR volume from completed transactions
    const { data: volumeData } = await supabase
      .from('transactions')
      .select('amount_inr')
      .eq('status', 'completed')
      .not('amount_inr', 'is', null);

    const totalVolume = (volumeData || []).reduce((acc, tx) => acc + (parseFloat(tx.amount_inr) || 0), 0);

    res.json({
      success: true,
      users: userCount || 0,
      transactions: txCount || 0,
      volumeInr: totalVolume,
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ════════════════════════════════════════════════
// POST /api/ask-tutor — Omni-Chat AI Tutor
// ════════════════════════════════════════════════
app.post('/api/ask-tutor', async (req, res) => {
  try {
    const { message, currentPage } = req.body;
    
    if (!message) {
      return res.status(400).json({ success: false, error: 'Message is required.' });
    }
    
    if (!aiClient) {
      return res.status(500).json({ success: false, error: 'AI Tutor is not configured (Missing GEMINI_API_KEY in .env).' });
    }

    const systemInstruction = "You are the official D-CRYPT AI Tutor. Your only job is to educate beginners about Web3, cryptocurrency, Sepolia testnets, P2P transfers, and wallet security. You must politely decline any non-crypto questions. You will be provided with the user's 'Current Page'. Use this context to give highly specific help if they are stuck on a transaction, but also be ready to answer general crypto questions seamlessly. Keep answers short, friendly, and formatted in clean Markdown.";

    const contextMessage = `User is currently on page: "${currentPage || 'Unknown'}".\n\nUser Question: ${message}`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: contextMessage,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ success: true, text: response.text });
  } catch (err) {
    console.error('AI Tutor Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 D-CRYPT Treasury Engine running on port ${PORT}`);
});
