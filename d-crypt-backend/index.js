import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { JsonRpcProvider, Wallet, parseEther, parseUnits, formatEther, formatUnits, Contract } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import nodemailer from 'nodemailer';

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

    // Total completed transactions (all types)
    const { count: txCount } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'completed');

    // ── Traded Volume: swaps + crypto sends + INR sends (activity volume)
    const { data: tradedData } = await supabase
      .from('transactions')
      .select('amount_inr')
      .eq('status', 'completed')
      .in('txn_type', ['swap', 'crypto_send', 'inr_send'])
      .not('amount_inr', 'is', null);

    const volumeTraded = (tradedData || []).reduce(
      (acc, tx) => acc + (parseFloat(tx.amount_inr) || 0), 0
    );

    // ── Deposited Amount: only successful UPI deposits
    const { data: depositData } = await supabase
      .from('transactions')
      .select('amount_inr')
      .eq('status', 'completed')
      .eq('txn_type', 'deposit')
      .not('amount_inr', 'is', null);

    const depositsInr = (depositData || []).reduce(
      (acc, tx) => acc + (parseFloat(tx.amount_inr) || 0), 0
    );

    res.json({
      success:      true,
      users:        userCount   || 0,
      transactions: txCount     || 0,
      volumeTraded: volumeTraded,   // swaps + sends
      depositsInr:  depositsInr,    // UPI deposits only
      // keep old field for backward-compat
      volumeInr:    volumeTraded + depositsInr,
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

// ════════════════════════════════════════════════
// POST /api/support/notify — Email alert to admin
// ════════════════════════════════════════════════
app.post('/api/support/notify', async (req, res) => {
  try {
    const { type, ticketId, username, subject, preview, userEmail } = req.body;

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      // Silently skip if email not configured — don't crash the app
      return res.json({ success: true, skipped: true });
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });

    const isNew = type === 'new_ticket';
    const subject_line = isNew
      ? `[D-CRYPT Support] New ticket from @${username || 'user'}`
      : `[D-CRYPT Support] New message in ticket #${ticketId}`;

    const appUrl = process.env.APP_URL || 'https://d-crypt.vercel.app';

    await transporter.sendMail({
      from: `"D-CRYPT Support" <${process.env.GMAIL_USER}>`,
      to: 'humandyt@gmail.com',
      subject: subject_line,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto">
          <div style="background:#0c0f1a;padding:24px;border-radius:12px 12px 0 0">
            <h2 style="color:#818cf8;margin:0;font-family:monospace;letter-spacing:2px">D‑CRYPT</h2>
            <p style="color:#94a3b8;margin:4px 0 0;font-size:12px">Support System</p>
          </div>
          <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none">
            <h3 style="margin:0 0 16px;color:#1e293b">${isNew ? '🍌 New Support Ticket' : '💬 New Reply'}</h3>
            <table style="width:100%;border-collapse:collapse;font-size:14px">
              <tr><td style="padding:6px 0;color:#64748b;width:120px">Ticket #</td><td style="color:#1e293b;font-weight:600">${ticketId}</td></tr>
              <tr><td style="padding:6px 0;color:#64748b">User</td><td style="color:#4f46e5;font-family:monospace">@${username || '—'}</td></tr>
              ${userEmail ? `<tr><td style="padding:6px 0;color:#64748b">Email</td><td style="color:#1e293b">${userEmail}</td></tr>` : ''}
              <tr><td style="padding:6px 0;color:#64748b">Subject</td><td style="color:#1e293b">${subject || '—'}</td></tr>
            </table>
            ${preview ? `<div style="margin-top:16px;padding:12px;background:#fff;border:1px solid #e2e8f0;border-radius:8px;color:#334155;font-size:14px;line-height:1.6">${preview}</div>` : ''}
            <div style="margin-top:20px">
              <a href="${appUrl}/admin/support?ticket=${ticketId}" style="background:#4f46e5;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600">View &amp; Reply →</a>
            </div>
          </div>
          <div style="background:#f1f5f9;padding:12px 24px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none">
            <p style="margin:0;font-size:11px;color:#94a3b8">D-CRYPT Support System — humandyt@gmail.com</p>
          </div>
        </div>
      `,
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Support notify error:', err);
    // Don’t fail the user’s action if email fails
    res.json({ success: true, emailError: err.message });
  }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 D-CRYPT Treasury Engine running on port ${PORT}`);
  });
}

// Export for Vercel Serverless Functions
export default app;
