import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets, useSendTransaction } from '@privy-io/react-auth';
import { supabase } from '../supabase';
import PasskeyModal from '../components/PasskeyModal';

/* ── Vite-safe hex encoder (no Buffer) ── */
function strToHex(str) {
  return '0x' + Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ═══════════════════════════════════════════════════════
   Swap.jsx — Two-Way Swap: Crypto ↔ INR

   Direction A (crypto_to_inr): User sells crypto → INR credited to vault
   Direction B (inr_to_crypto): User buys crypto with INR → backend sends tx

   Token list is intentionally in one array (TOKENS) so new tokens
   can be added simply by pushing a new object — UI handles the rest.
═══════════════════════════════════════════════════════ */

/* ── Backend URL (set VITE_API_URL in your .env, fallback for dev) ── */
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ── Treasury wallet — receives crypto when user sells (Crypto → INR) ── */
const TREASURY_ADDRESS = import.meta.env.VITE_TREASURY_ADDRESS || '0x8e5c67C2eAb377875429118EF05dc91CC4B10478';

/* ── Sepolia USDC contract address ── */
const USDC_CONTRACT = import.meta.env.VITE_USDC_CONTRACT || '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';

/* ── Encode ERC-20 transfer(address,uint256) calldata without ethers.js ── */
function encodeERC20Transfer(to, amountWei) {
  // Function selector for transfer(address,uint256) = 0xa9059cbb
  const selector = 'a9059cbb';
  // Pad address to 32 bytes
  const paddedAddr = to.replace('0x', '').toLowerCase().padStart(64, '0');
  // Pad uint256 amount to 32 bytes (handle BigInt)
  const hexAmount = BigInt(amountWei).toString(16).padStart(64, '0');
  return `0x${selector}${paddedAddr}${hexAmount}`;
}

/* ── Convert decimal token amount to smallest unit (like parseUnits) ── */
function toWei(amount, decimals) {
  const factor = 10n ** BigInt(decimals);
  const [intPart, fracPart = ''] = String(amount).split('.');
  const fracPadded = fracPart.slice(0, decimals).padEnd(decimals, '0');
  return BigInt(intPart) * factor + BigInt(fracPadded);
}

/* ── Convert ETH decimal to hex wei string (0x prefix) ── */
function ethToHexWei(ethAmount) {
  const wei = toWei(ethAmount.toFixed(18), 18);
  return '0x' + wei.toString(16);
}

/* ── Token config — add new tokens here only ── */
const TOKENS = [
  {
    symbol:    'ETH',
    name:      'Ethereum',
    coingecko: 'ethereum',
    color:     'var(--clr-accent)',
    colorDim:  'var(--clr-accent-dim)',
    colorBdr:  'var(--clr-border-accent)',
    decimals:  6,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
        <line x1="12" y1="2" x2="12" y2="22"/>
        <line x1="2" y1="8.5" x2="22" y2="8.5"/>
      </svg>
    ),
  },
  {
    symbol:    'USDC',
    name:      'USD Coin',
    coingecko: 'usd-coin',
    color:     'var(--clr-blue)',
    colorDim:  'var(--clr-blue-dim)',
    colorBdr:  'var(--clr-blue-border)',
    decimals:  6,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v2m0 8v2M8 12h8"/>
      </svg>
    ),
  },
  // ─── Add new tokens below this line ───
  // { symbol: 'MATIC', name: 'Polygon', coingecko: 'matic-network', color: '...', ... }
];

/* ── Fetch live price via backend (CoinGecko cascade) ── */
async function fetchPrice(symbol) {
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  try {
    const res  = await fetch(`${API_BASE}/api/price`);
    const json = await res.json();
    if (json.success) {
      const inr = json[symbol] || 0;
      /* Approximate USD from INR at ~84 rate for display */
      return { inr, usd: inr / 84 };
    }
  } catch { /* fall through to direct CoinGecko */ }
  /* Fallback: CoinGecko directly */
  try {
    const cgId = symbol === 'ETH' ? 'ethereum' : 'usd-coin';
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=inr,usd`);
    const d = await r.json();
    const row = d[cgId] || {};
    return { inr: row.inr || 0, usd: row.usd || 0 };
  } catch {
    return { inr: 0, usd: 0 };
  }
}

/* ── Fetch on-chain balance via backend (more reliable) ── */
async function fetchOnChainBalance(address, tokenSymbol) {
  if (!address) return 0;
  const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
  try {
    const res  = await fetch(`${API_BASE}/api/balance/${address}`);
    const json = await res.json();
    if (json.success) {
      return tokenSymbol === 'ETH'
        ? parseFloat(json.eth)  || 0
        : parseFloat(json.usdc) || 0;
    }
  } catch { /* fall through to direct RPC */ }
  /* Fallback: direct RPC */
  try {
    const RPC = 'https://rpc.sepolia.org';
    if (tokenSymbol === 'ETH') {
      const res  = await fetch(RPC, { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_getBalance', params:[address,'latest'] }) });
      const json = await res.json();
      return parseInt(json.result, 16) / 1e18;
    } else if (tokenSymbol === 'USDC') {
      const USDC_ADDR = '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
      const data = '0x70a08231' + address.replace('0x','').padStart(64,'0');
      const res  = await fetch(RPC, { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_call', params:[{to:USDC_ADDR, data},'latest'] }) });
      const json = await res.json();
      return parseInt(json.result, 16) / 1e6;
    }
  } catch (e) { console.error('Balance RPC fallback error:', e); }
  return 0;
}

/* ── Small helper components ── */
function RateRow({ label, value, mono = false, accent = false, highlight = false }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '9px 0',
      borderBottom: '1px solid var(--clr-border)',
    }}>
      <span style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>{label}</span>
      <span style={{
        fontSize: 13, fontWeight: 600,
        fontFamily: mono ? 'var(--font-mono)' : undefined,
        color: highlight
          ? 'var(--clr-text-emerald)'
          : accent
          ? 'var(--clr-accent)'
          : 'var(--clr-text-secondary)',
      }}>
        {value}
      </span>
    </div>
  );
}

function SwapHistoryRow({ tx }) {
  const isToInr = tx.txn_type === 'swap' && !tx.direction;           // old: crypto→INR
  const isBuy   = tx.txn_type === 'swap' && tx.direction === 'buy';  // INR→Crypto
  const label   = isBuy
    ? `INR → ${tx.token_symbol}`
    : `${tx.token_symbol || '?'} → INR`;

  return (
    <div className="tx-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: isBuy ? 'var(--clr-blue-dim)' : 'var(--clr-accent-dim)',
          border: `1px solid ${isBuy ? 'var(--clr-blue-border)' : 'var(--clr-border-accent)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: isBuy ? 'var(--clr-blue)' : 'var(--clr-accent)',
          fontSize: 13, fontWeight: 700,
        }}>⇄</div>
        <div>
          <p style={{
            fontSize: 13, fontWeight: 600,
            color: 'var(--clr-text-primary)', marginBottom: 2,
          }}>
            {label}
          </p>
          <p style={{
            fontSize: 11, color: 'var(--clr-text-muted)',
            fontFamily: 'var(--font-mono)',
          }}>
            {tx.created_at
              ? new Date(tx.created_at).toLocaleString('en-IN', {
                  day: '2-digit', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })
              : ''}
          </p>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{
          fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
          color: isBuy ? 'var(--clr-accent)' : 'var(--clr-text-emerald)',
        }}>
          {isBuy
            ? `${tx.token_amount} ${tx.token_symbol}`
            : `+₹${Number(tx.amount_inr || 0).toFixed(2)}`}
        </p>
        <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 2 }}>
          {isBuy
            ? `₹${Number(tx.amount_inr || 0).toFixed(2)} spent`
            : `${tx.token_amount} ${tx.token_symbol} in`}
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
export default function Swap() {
  const { user }         = usePrivy();
  const { wallets }      = useWallets();
  const { sendTransaction } = useSendTransaction();

  const walletAddress = wallets?.[0]?.address || user?.wallet?.address || '';

  /* ── State ── */
  const [selectedToken,  setSelectedToken]  = useState(TOKENS[0]);
  const [direction,      setDirection]      = useState('crypto_to_inr'); // or 'inr_to_crypto'
  const [inputAmount,    setInputAmount]    = useState('');
  const [price,          setPrice]          = useState({ inr: 0, usd: 0 });
  const [priceLoading,   setPriceLoading]   = useState(false);
  const [priceAge,       setPriceAge]       = useState(null);
  const [swapHistory,    setSwapHistory]    = useState([]);
  const [username,       setUsername]       = useState('');
  const [inrBalance,     setInrBalance]     = useState(0);
  const [cryptoBalance,  setCryptoBalance]  = useState(0);
  const [showOtherInfo,  setShowOtherInfo]  = useState(false);

  // Passkey Modal State
  const [showPasskeyModal, setShowPasskeyModal] = useState(false);
  const [passkeyModalState, setPasskeyModalState] = useState('idle'); // idle|verifying|processing|success|error
  const [passkeyModalError, setPasskeyModalError] = useState('');

  // Native UI State (for Crypto -> INR)
  const [swapStatus, setSwapStatus] = useState('idle');
  const [statusMsg, setStatusMsg] = useState('');

  const isCryptoToInr = direction === 'crypto_to_inr';

  /* ── Derived values ── */
  const parsedAmount = parseFloat(inputAmount) || 0;

  /* For Crypto → INR */
  const inrReceivable = parsedAmount * price.inr;
  const feeC2I        = inrReceivable * 0.005;
  const inrAfterFeeC2I = inrReceivable - feeC2I;

  /* For INR → Crypto */
  const cryptoReceivable = price.inr > 0 ? parsedAmount / price.inr : 0;
  const feeI2C           = parsedAmount * 0.005;
  const inrAfterFeeI2C   = parsedAmount - feeI2C;
  const cryptoAfterFee   = price.inr > 0 ? inrAfterFeeI2C / price.inr : 0;

  /* ── Load live price ── */
  const refreshPrice = useCallback(async () => {
    setPriceLoading(true);
    const p = await fetchPrice(selectedToken.symbol);
    setPrice(p);
    setPriceAge(new Date());
    setPriceLoading(false);
  }, [selectedToken]);

  /* ── Load crypto balance ── */
  const refreshCryptoBalance = useCallback(async () => {
    if (!walletAddress) return;
    const bal = await fetchOnChainBalance(walletAddress, selectedToken.symbol);
    setCryptoBalance(bal);
  }, [walletAddress, selectedToken]);

  useEffect(() => {
    refreshPrice();
    refreshCryptoBalance();
    const id = setInterval(() => {
      refreshPrice();
      refreshCryptoBalance();
    }, 30000);
    return () => clearInterval(id);
  }, [refreshPrice, refreshCryptoBalance]);

  /* ── Load user + history ── */
  useEffect(() => {
    if (!walletAddress) return;
    loadUser();
    loadHistory();
  }, [walletAddress]);

  const loadUser = async () => {
    const { data } = await supabase
      .from('users')
      .select('username, inr_balance')
      .eq('wallet_address', walletAddress)
      .maybeSingle();
    if (data) {
      setUsername(data.username || '');
      setInrBalance(data.inr_balance || 0);
    }
  };

  const loadHistory = async () => {
    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('txn_type', 'swap')
      .eq('username', username || '')
      .order('created_at', { ascending: false })
      .limit(5);
    if (data) setSwapHistory(data);
  };

  /* ── Reload balance after swap ── */
  const reloadBalance = async () => {
    const { data } = await supabase
      .from('users')
      .select('inr_balance')
      .eq('wallet_address', walletAddress)
      .maybeSingle();
    if (data) setInrBalance(data.inr_balance || 0);
  };

  /* ═══════════════════════════════
     HANDLER: Trigger Passkey Modal
  ═══════════════════════════════ */
  const handleSwapIntent = () => {
    if (!parsedAmount || parsedAmount <= 0) {
      setPasskeyModalState('error');
      setPasskeyModalError('Enter a valid amount.');
      setShowPasskeyModal(true);
      return;
    }
    if (isCryptoToInr && inrAfterFeeC2I <= 0) {
      setPasskeyModalState('error');
      setPasskeyModalError('Amount too small after fees.');
      setShowPasskeyModal(true);
      return;
    }
    if (!isCryptoToInr && parsedAmount > inrBalance) {
      setPasskeyModalState('error');
      setPasskeyModalError(`Insufficient INR. You have ₹${inrBalance.toFixed(2)}`);
      setShowPasskeyModal(true);
      return;
    }
    if (!walletAddress) {
      setPasskeyModalState('error');
      setPasskeyModalError('No wallet connected.');
      setShowPasskeyModal(true);
      return;
    }

    // Bypass PasskeyModal entirely for Crypto -> INR (use Privy's native passkey/wallet popup)
    if (isCryptoToInr) {
      executeSwap();
    } else {
      setPasskeyModalState('idle');
      setPasskeyModalError('');
      setShowPasskeyModal(true);
    }
  };

  /* ═══════════════════════════════
     HANDLER B: Execute Swap (Passkey Confirmed)
  ═══════════════════════════════ */
  const executeSwap = async () => {
    try {
      const wallet = wallets?.find(w => w.address === walletAddress) ?? wallets?.[0];
      if (!wallet) throw new Error('No wallet connected.');

      // ── Step 1: Passkey Verification is ALREADY done by PasskeyModal! ──
      // We removed personal_sign here to prevent double popups and blackscreens.

      // ── Step 2: Execute actual swap logic ──
      if (isCryptoToInr) {
        setSwapStatus('confirming');
        
        let txHash = null;
        if (selectedToken.symbol === 'ETH') {
          const txResult = await sendTransaction({
            to:    TREASURY_ADDRESS,
            value: ethToHexWei(parsedAmount),
            chainId: 11155111,
          });
          txHash = txResult?.hash;
        } else if (selectedToken.symbol === 'USDC') {
          const usdcAmountWei = toWei(parsedAmount.toFixed(6), 6);
          const calldata = encodeERC20Transfer(TREASURY_ADDRESS, usdcAmountWei);
          const txResult = await sendTransaction({
            to:   USDC_CONTRACT,
            data: calldata,
            chainId: 11155111,
          });
          txHash = txResult?.hash;
        } else {
          throw new Error(`Unsupported token: ${selectedToken.symbol}`);
        }

        const { error: txErr } = await supabase.from('transactions').insert({
          txn_type:       'swap',
          username:       username,
          wallet_address: walletAddress,
          token_symbol:   selectedToken.symbol,
          token_amount:   parsedAmount,
          amount_inr:     inrAfterFeeC2I,
          web3_hash:      txHash || null,
          status:         'completed',
          direction:      'sell',
        });
        if (txErr) throw txErr;

        const { data: u } = await supabase
          .from('users')
          .select('inr_balance')
          .eq('wallet_address', walletAddress)
          .maybeSingle();

        await supabase
          .from('users')
          .update({ inr_balance: (u?.inr_balance || 0) + inrAfterFeeC2I })
          .eq('wallet_address', walletAddress);

        setSwapStatus('success');
        reloadBalance();
        loadHistory();
        setInputAmount('');
        setTimeout(() => setSwapStatus('idle'), 4000);

      } else {
        // INR to Crypto (Off-chain backend verification)
        setPasskeyModalState('processing');

        const res = await fetch(`${API_BASE}/api/send-crypto`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username:       username,
            amountInr:      parsedAmount,
            receiverWallet: walletAddress,
            tokenSymbol:    selectedToken.symbol,
          }),
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Backend error');

        await supabase.from('transactions').insert({
          txn_type:       'swap',
          username:       username,
          wallet_address: walletAddress,
          token_symbol:   selectedToken.symbol,
          token_amount:   cryptoAfterFee,
          amount_inr:     parsedAmount,
          web3_hash:      data.hash || null,
          status:         'completed',
          direction:      'buy',
        });

        await supabase
          .from('users')
          .update({ inr_balance: inrBalance - parsedAmount })
          .eq('wallet_address', walletAddress);

        setPasskeyModalState('success');
        reloadBalance();
        loadHistory();
        setInputAmount('');
        setTimeout(() => { setShowPasskeyModal(false); setPasskeyModalState('idle'); }, 3000);
      }

    } catch (err) {
      if (isCryptoToInr) {
        setSwapStatus('error');
        setStatusMsg(err.message || 'Swap failed.');
      } else {
        setPasskeyModalState('error');
        setPasskeyModalError(err.message || 'Transaction failed. Check your balance and try again.');
      }
    }
  };



  const flipDirection = () => {
    setDirection(d => d === 'crypto_to_inr' ? 'inr_to_crypto' : 'crypto_to_inr');
    setInputAmount('');
    setPasskeyModalState('idle');
    setPasskeyModalError('');
    setSwapStatus('idle');
    setStatusMsg('');
  };

  /* ── Price age label ── */
  const ageString = priceAge
    ? `Updated ${Math.floor((Date.now() - priceAge) / 1000)}s ago`
    : 'Fetching price...';

  /* ── Button state ── */
  const canSubmit  = parsedAmount > 0 && price.inr > 0;

  /* ════════════════════════════════════════════
     RENDER
  ════════════════════════════════════════════ */
  return (
    <div className="animate-fade-in">

      {/* ── Page heading ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{
          fontSize: 22, fontWeight: 700, letterSpacing: -0.3,
          color: 'var(--clr-text-white)', marginBottom: 4,
        }}>
          Instant Swap
        </h2>
        <p style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>
          Convert between crypto and your INR vault at live market rates.
        </p>
      </div>

      {/* ── Responsive grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 300px',
        gap: 20, alignItems: 'start',
      }}>

        {/* ════════════════════════════
            LEFT — Main Swap Card
        ════════════════════════════ */}
        <div className="card" style={{ padding: 28 }}>

          {/* Card header */}
          <div style={{
            display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', marginBottom: 26,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--clr-accent-dim)',
                border: '1px solid var(--clr-border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--clr-accent)',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
                  <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
                </svg>
              </div>
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--clr-text-white)' }}>
                  {isCryptoToInr ? 'Sell Crypto → INR Vault' : 'Buy Crypto with INR'}
                </h3>
                <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>
                  {isCryptoToInr
                    ? 'Receive INR instantly in your vault'
                    : 'Crypto sent directly to your wallet'}
                </p>
              </div>
            </div>

            {/* Direction mode badge */}
            <span className={`badge ${isCryptoToInr ? 'badge-accent' : 'badge-blue'}`}>
              {isCryptoToInr ? 'SELL' : 'BUY'}
            </span>
          </div>

          {/* ── Token selector ── */}
          <div style={{ marginBottom: 20 }}>
            <label className="input-label" style={{ marginBottom: 10, display: 'block' }}>
              Token
            </label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {TOKENS.map((t) => {
                const active = selectedToken.symbol === t.symbol;
                return (
                  <button
                    key={t.symbol}
                    onClick={() => { setSelectedToken(t); setInputAmount(''); }}
                    style={{
                      flex: '1 1 120px',
                      padding: '12px 14px',
                      background: active ? t.colorDim : 'var(--clr-bg-card)',
                      border: `1px solid ${active ? t.colorBdr : 'var(--clr-border)'}`,
                      borderRadius: 'var(--radius-md)',
                      cursor: 'pointer',
                      transition: 'var(--transition-fast)',
                      display: 'flex', alignItems: 'center', gap: 10,
                    }}
                    onMouseEnter={e => {
                      if (!active) e.currentTarget.style.borderColor = t.colorBdr;
                    }}
                    onMouseLeave={e => {
                      if (!active) e.currentTarget.style.borderColor = 'var(--clr-border)';
                    }}
                  >
                    <span style={{ color: active ? t.color : 'var(--clr-text-muted)' }}>
                      {t.icon}
                    </span>
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <p style={{
                        fontSize: 14, fontWeight: 700, lineHeight: 1.2,
                        color: active ? t.color : 'var(--clr-text-secondary)',
                      }}>
                        {t.symbol}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>{t.name}</p>
                    </div>
                    {active && (
                      <span style={{ fontSize: 12, color: t.color, fontWeight: 700 }}>✓</span>
                    )}
                  </button>
                );
              })}

              {/* "More tokens" expandable placeholder */}
              <button
                onClick={() => setShowOtherInfo(!showOtherInfo)}
                style={{
                  flex: '0 0 auto',
                  padding: '12px 16px',
                  background: showOtherInfo ? 'var(--clr-purple-dim)' : 'var(--clr-bg-card)',
                  border: `1px solid ${showOtherInfo ? 'var(--clr-purple-border)' : 'var(--clr-border)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'var(--transition-fast)',
                  display: 'flex', alignItems: 'center', gap: 8,
                  color: showOtherInfo ? 'var(--clr-purple)' : 'var(--clr-text-muted)',
                  fontSize: 12, fontWeight: 600,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>
                </svg>
                More
              </button>
            </div>

            {/* "More tokens" info panel */}
            {showOtherInfo && (
              <div className="animate-fade-in" style={{
                marginTop: 10,
                background: 'var(--clr-purple-dim)',
                border: '1px solid var(--clr-purple-border)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ fontSize: 18 }}>🚀</span>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-purple)', marginBottom: 2 }}>
                    More tokens coming soon
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
                    MATIC, BNB, SOL and more — we're integrating additional chains as we scale to mainnet.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ══════════════════════════════════════════
              FROM box
          ══════════════════════════════════════════ */}
          <div style={{
            background: 'var(--clr-bg-card)',
            border: '1px solid var(--clr-border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px 18px',
            marginBottom: 4,
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: 10,
            }}>
              <label style={{
                fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '1px', color: 'var(--clr-text-muted)',
              }}>
                From
              </label>
              {!isCryptoToInr ? (
                <span style={{ fontSize: 11, color: 'var(--clr-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  Balance: ₹{inrBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </span>
              ) : (
                <span style={{ fontSize: 11, color: 'var(--clr-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                  Balance: {cryptoBalance > 0 ? cryptoBalance.toFixed(6) : '0.00'} {selectedToken.symbol}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: isCryptoToInr ? selectedToken.colorDim : 'var(--clr-blue-dim)',
                border: `1px solid ${isCryptoToInr ? selectedToken.colorBdr : 'var(--clr-blue-border)'}`,
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                flexShrink: 0,
                color: isCryptoToInr ? selectedToken.color : 'var(--clr-blue)',
                fontSize: 13, fontWeight: 700,
              }}>
                {isCryptoToInr ? (
                  <>{selectedToken.icon} {selectedToken.symbol}</>
                ) : (
                  <>₹ INR</>
                )}
              </div>
              <input
                type="number"
                min="0"
                step={isCryptoToInr ? '0.0001' : '1'}
                placeholder={isCryptoToInr ? '0.0000' : '0'}
                value={inputAmount}
                onChange={(e) => setInputAmount(e.target.value)}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700,
                  color: 'var(--clr-text-white)', textAlign: 'right',
                }}
              />
            </div>
            {/* Quick amount helpers */}
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {!isCryptoToInr ? (
                /* INR side — preset amounts + Max button */
                [...[100, 500, 1000], 'Max'].map(amt => {
                  const isMax = amt === 'Max';
                  const val   = isMax ? Math.floor(inrBalance) : amt;
                  const over  = !isMax && amt > inrBalance;
                  return (
                  <button
                    key={amt}
                    onClick={() => setInputAmount(String(val))}
                    disabled={inrBalance <= 0 || over}
                    style={{
                      flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 600,
                      fontFamily: 'var(--font-mono)',
                      background: isMax ? 'var(--clr-accent-dim)' : 'var(--clr-bg-surface)',
                      border: `1px solid ${isMax ? 'var(--clr-border-accent)' : 'var(--clr-border)'}`,
                      borderRadius: 'var(--radius-xs)',
                      color: over ? 'var(--clr-text-muted)' : isMax ? 'var(--clr-accent)' : 'var(--clr-text-secondary)',
                      cursor: (inrBalance <= 0 || over) ? 'not-allowed' : 'pointer',
                      opacity: (inrBalance <= 0 || over) ? 0.4 : 1,
                      transition: 'var(--transition-fast)',
                    }}
                    onMouseEnter={e => { if (!over && inrBalance > 0) e.currentTarget.style.borderColor = 'var(--clr-border-accent)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isMax ? 'var(--clr-border-accent)' : 'var(--clr-border)'; }}
                  >
                    {isMax ? 'Max' : `₹${amt}`}
                  </button>
                  );
                })
              ) : (
                [25, 50, 75, 100].map(pct => {
                  const amt = (cryptoBalance * (pct / 100)).toFixed(selectedToken.decimals);
                  return (
                    <button
                      key={pct}
                      onClick={() => setInputAmount(String(amt))}
                      disabled={cryptoBalance <= 0}
                      style={{
                        flex: 1, padding: '4px 0', fontSize: 11, fontWeight: 600,
                        fontFamily: 'var(--font-mono)',
                        background: 'var(--clr-bg-surface)',
                        border: '1px solid var(--clr-border)',
                        borderRadius: 'var(--radius-xs)',
                        color: cryptoBalance <= 0 ? 'var(--clr-text-muted)' : 'var(--clr-text-secondary)',
                        cursor: cryptoBalance <= 0 ? 'not-allowed' : 'pointer',
                        opacity: cryptoBalance <= 0 ? 0.4 : 1,
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseEnter={e => { if (cryptoBalance > 0) e.currentTarget.style.borderColor = selectedToken.colorBdr; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--clr-border)'; }}
                    >
                      {pct === 100 ? 'Max' : `${pct}%`}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── Direction toggle button ── */}
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
            <button
              onClick={flipDirection}
              title="Flip direction"
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'var(--clr-bg-surface)',
                border: '2px solid var(--clr-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                color: 'var(--clr-accent)',
                fontSize: 18, fontWeight: 700,
                transition: 'var(--transition-med)',
                zIndex: 2,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--clr-border-accent)';
                e.currentTarget.style.background = 'var(--clr-accent-dim)';
                e.currentTarget.style.transform = 'rotate(180deg) scale(1.1)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--clr-border)';
                e.currentTarget.style.background = 'var(--clr-bg-surface)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              ⇅
            </button>
          </div>

          {/* ══════════════════════════════════════════
              TO box
          ══════════════════════════════════════════ */}
          <div style={{
            background: parsedAmount > 0
              ? (isCryptoToInr ? 'rgba(16,185,129,0.04)' : `${selectedToken.colorDim}`)
              : 'var(--clr-bg-card)',
            border: `1px solid ${parsedAmount > 0
              ? (isCryptoToInr ? 'var(--clr-emerald-border)' : selectedToken.colorBdr)
              : 'var(--clr-border)'}`,
            borderRadius: 'var(--radius-md)',
            padding: '16px 18px',
            marginBottom: 20,
            transition: 'var(--transition-med)',
          }}>
            <label style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '1px', color: 'var(--clr-text-muted)',
              display: 'block', marginBottom: 10,
            }}>
              To (Estimated)
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: isCryptoToInr ? 'var(--clr-emerald-dim)' : selectedToken.colorDim,
                border: `1px solid ${isCryptoToInr ? 'var(--clr-emerald-border)' : selectedToken.colorBdr}`,
                borderRadius: 'var(--radius-sm)',
                padding: '6px 12px',
                flexShrink: 0,
                color: isCryptoToInr ? 'var(--clr-emerald)' : selectedToken.color,
                fontSize: 13, fontWeight: 700,
              }}>
                {isCryptoToInr ? '₹ INR' : <>{selectedToken.icon} {selectedToken.symbol}</>}
              </div>
              <span style={{
                flex: 1, textAlign: 'right',
                fontFamily: 'var(--font-mono)', fontSize: 24, fontWeight: 700,
                color: parsedAmount > 0
                  ? (isCryptoToInr ? 'var(--clr-text-emerald)' : selectedToken.color)
                  : 'var(--clr-text-muted)',
                transition: 'var(--transition-med)',
              }}>
                {priceLoading
                  ? '...'
                  : parsedAmount > 0
                  ? isCryptoToInr
                    ? inrAfterFeeC2I.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                    : cryptoAfterFee.toFixed(6)
                  : isCryptoToInr ? '0.00' : '0.000000'}
              </span>
            </div>
            {parsedAmount > 0 && (
              <p style={{
                fontSize: 11, color: 'var(--clr-text-muted)',
                marginTop: 8, fontFamily: 'var(--font-mono)',
              }}>
                {isCryptoToInr
                  ? `After 0.5% fee (−₹${feeC2I.toFixed(2)})`
                  : `After 0.5% fee (−₹${feeI2C.toFixed(2)})`}
              </p>
            )}
          </div>

          {/* ── Confirm button ── */}
          <button
            onClick={handleSwapIntent}
            disabled={!canSubmit}
            className="btn btn-full"
            style={{
              background: 'var(--clr-emerald)',
              border: 'none',
              color: '#030812',
              fontSize: 14, fontWeight: 700,
              padding: '15px',
              borderRadius: 'var(--radius-md)',
              letterSpacing: 0.5,
              transition: 'var(--transition-med)',
              cursor: !canSubmit ? 'not-allowed' : 'pointer',
              opacity: !canSubmit ? 0.55 : 1,
              display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 8,
            }}
          >
            {isCryptoToInr
              ? `Sell ${selectedToken.symbol} → Verify Passkey`
              : `Buy ${selectedToken.symbol} → Verify Passkey`
            }
          </button>


          {/* INR → Crypto: "We're working on it" info box */}
          {!isCryptoToInr && (
            <div className="animate-fade-in" style={{
              marginTop: 14,
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--clr-amber-dim)',
              border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex', alignItems: 'flex-start', gap: 10,
            }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>⚙️</span>
              <div>
                <p style={{
                  fontSize: 12, fontWeight: 700,
                  color: 'var(--clr-text-amber)', marginBottom: 2,
                }}>
                  Live on Sepolia Testnet
                </p>
                <p style={{ fontSize: 11, color: 'var(--clr-text-secondary)', lineHeight: 1.5 }}>
                  Your INR balance will be deducted and crypto sent from our treasury wallet.
                  Mainnet launch coming soon.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ════════════════════════════
            RIGHT — Rate info + history
        ════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Live rate card */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 18,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: selectedToken.color }}>{selectedToken.icon}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--clr-text-white)' }}>
                  {selectedToken.symbol} / INR
                </span>
              </div>
              <button
                onClick={refreshPrice}
                disabled={priceLoading}
                title="Refresh price"
                style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                  background: 'var(--clr-bg-card)',
                  border: '1px solid var(--clr-border)',
                  color: 'var(--clr-text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', transition: 'var(--transition-fast)',
                }}
                onMouseEnter={e => e.currentTarget.style.color = 'var(--clr-accent)'}
                onMouseLeave={e => e.currentTarget.style.color = 'var(--clr-text-muted)'}
              >
                <svg
                  width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  style={{ animation: priceLoading ? 'dc-spin 1s linear infinite' : 'none' }}
                >
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            </div>

            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700,
              color: priceLoading ? 'var(--clr-text-muted)' : 'var(--clr-text-white)',
              marginBottom: 4, letterSpacing: -0.5,
              transition: 'var(--transition-med)',
            }}>
              {priceLoading ? '—' : `₹${price.inr.toLocaleString('en-IN')}`}
            </div>
            <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginBottom: 18 }}>
              ≈ ${price.usd?.toLocaleString('en-US') || '—'} USD · {ageString}
            </p>

            <div>
              <RateRow
                label={`1 ${selectedToken.symbol} → INR`}
                value={price.inr ? `₹${price.inr.toLocaleString('en-IN')}` : '—'}
                mono accent
              />
              {!isCryptoToInr && (
                <RateRow
                  label="Your INR Balance"
                  value={`₹${inrBalance.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                  mono highlight
                />
              )}
              <RateRow label="Platform Fee" value="0.5%" mono />
              <RateRow label="Settlement"   value="Instant" />
              <RateRow label="Network"      value="Sepolia Testnet" />
            </div>
          </div>

          {/* Swap modes info card */}
          <div className="card" style={{ padding: 20 }}>
            <p style={{
              fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
              textTransform: 'uppercase', color: 'var(--clr-text-muted)',
              marginBottom: 14,
            }}>
              Available Directions
            </p>
            {[
              {
                from: selectedToken.symbol, to: 'INR',
                status: 'Live',
                statusColor: 'var(--clr-text-emerald)',
                desc: 'Sell crypto from your vault wallet — receive INR instantly.',
              },
              {
                from: 'INR', to: selectedToken.symbol,
                status: 'Beta',
                statusColor: 'var(--clr-text-amber)',
                desc: 'Buy crypto using your INR balance via treasury.',
              },
            ].map((row) => (
              <div key={row.from + row.to} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                marginBottom: 14,
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: 'var(--clr-accent-dim)',
                  border: '1px solid var(--clr-border-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 10, fontWeight: 700,
                  color: 'var(--clr-accent)', marginTop: 1,
                }}>⇄</div>
                <div>
                  <p style={{
                    fontSize: 12, fontWeight: 600,
                    color: 'var(--clr-text-secondary)', marginBottom: 2,
                  }}>
                    {row.from} → {row.to}{' '}
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: row.statusColor,
                      textTransform: 'uppercase', letterSpacing: 1,
                    }}>
                      [{row.status}]
                    </span>
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', lineHeight: 1.5 }}>
                    {row.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Recent swaps */}
          {swapHistory.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <p style={{
                fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
                textTransform: 'uppercase', color: 'var(--clr-text-muted)',
                marginBottom: 14,
              }}>
                Your Recent Swaps
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {swapHistory.map((tx) => (
                  <SwapHistoryRow key={tx.id} tx={tx} />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Responsive breakpoint override (injected via style tag) ── */}
      <style>{`
        @media (max-width: 768px) {
          .swap-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Passkey Modal ── */}
      <PasskeyModal
        show={showPasskeyModal}
        onClose={() => setShowPasskeyModal(false)}
        onVerify={executeSwap}
        state={passkeyModalState}
        errorMsg={passkeyModalError}
        title={isCryptoToInr ? `Sell ${selectedToken.symbol} → INR Vault` : `Buy ${selectedToken.symbol} with INR`}
        subtitle="Crypto to INR Swap"
        accentColor={isCryptoToInr ? 'var(--clr-amber)' : 'var(--clr-emerald)'}
        accentDim={isCryptoToInr ? 'var(--clr-amber-dim)' : 'var(--clr-emerald-dim)'}
        accentBorder={isCryptoToInr ? 'rgba(245,158,11,0.2)' : 'var(--clr-emerald-border)'}
        icon={<span style={{ color: selectedToken.color }}>{selectedToken.icon}</span>}
        rows={[
          isCryptoToInr
            ? { label: 'Sell Amount', value: `${parsedAmount} ${selectedToken.symbol}`, highlight: true }
            : { label: 'Spend Amount', value: `₹${parsedAmount.toFixed(2)}`, highlight: true },
          isCryptoToInr
            ? { label: 'Fee', value: `−₹${feeC2I.toFixed(2)}`, dim: true }
            : { label: 'Fee', value: `−₹${feeI2C.toFixed(2)}`, dim: true },
          isCryptoToInr
            ? { label: 'Net INR Received', value: `₹${inrAfterFeeC2I.toFixed(2)}`, bold: true }
            : { label: 'Crypto Received', value: `${cryptoAfterFee.toFixed(6)} ${selectedToken.symbol}`, bold: true }
        ]}
      />
    </div>
  );
}