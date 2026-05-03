import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets }             from '@privy-io/react-auth';
import { supabase }                         from '../supabase';
import SendCryptoCard                       from '../components/SendCryptoCard';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ═══════════════════════════════════════════════════════
   Send.jsx — Full send page
   Owns all logic; passes everything down to SendCryptoCard.

   Flow:
   1. User picks token (ETH / USDC)
   2. Types @username or 0x address
      → @username: DB lookup → resolves to wallet address
      → 0x address: validate hex format
   3. Enters INR amount
   4. Clicks "Review Transaction" → confirmation popup
   5. Passkey/wallet sign verification via Privy
   6. Confirms → Backend engine → INR deducted → done
═══════════════════════════════════════════════════════ */

/* ── Validate an Ethereum address ── */
function isValidEthAddress(addr) {
  return /^0x[0-9a-fA-F]{40}$/.test(addr);
}

/* ── Encode a string to hex WITHOUT Buffer (Vite-safe) ── */
function strToHex(str) {
  return '0x' + Array.from(new TextEncoder().encode(str))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function Send() {
  const { user }    = usePrivy();
  const { wallets } = useWallets();

  const walletAddress =
    wallets?.[0]?.address ||
    user?.wallet?.address  ||
    '';

  /* ── Component state ── */
  const [selectedToken,   setSelectedToken]   = useState('ETH');
  const [recipientInput,  setRecipientInput]  = useState('');
  const [resolvedAddress, setResolvedAddress] = useState(''); // final 0x after lookup
  const [resolvedUsername,setResolvedUsername]= useState(''); // @username if found
  const [lookupStatus,    setLookupStatus]    = useState('idle');
  // idle | loading | found | not_found | invalid_address

  const [amountInr,       setAmountInr]       = useState('');
  const [inrBalance,      setInrBalance]       = useState(0);
  const [senderUsername,  setSenderUsername]  = useState('');
  const [livePrice,       setLivePrice]       = useState({ ETH: 270000, USDC: 84 });
  const [priceLoading,    setPriceLoading]    = useState(false);

  // Confirmation popup
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [txState,         setTxState]         = useState('idle');
  // idle | sending | success | error
  const [txError,         setTxError]         = useState('');

  const [profile,         setProfile]         = useState(null);

  /* ── Load sender profile ── */
  useEffect(() => {
    if (!walletAddress) return;
    supabase
      .from('users')
      .select('username, inr_balance, session_token')
      .eq('wallet_address', walletAddress)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setProfile(data);
          setSenderUsername(data.username  || '');
          setInrBalance(data.inr_balance   || 0);
        }
      });
  }, [walletAddress]);

  /* ── Fetch live prices via backend (CoinGecko cascade) ── */
  const fetchLivePrice = useCallback(async () => {
    setPriceLoading(true);
    try {
      const res  = await fetch(`${BACKEND}/api/price`);
      const data = await res.json();
      if (data.success) {
        setLivePrice({
          ETH:  data.ETH  || 270000,
          USDC: data.USDC || 84,
        });
      }
    } catch (e) {
      // Fallback: try CoinGecko directly
      try {
        const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=inr');
        const d = await r.json();
        setLivePrice({
          ETH:  d?.ethereum?.inr  || 270000,
          USDC: d?.['usd-coin']?.inr || 84,
        });
      } catch {
        console.warn('Price fetch fallback also failed');
      }
    } finally {
      setPriceLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLivePrice();
    const interval = setInterval(fetchLivePrice, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, [fetchLivePrice]);

  /* ── Debounced recipient resolution ── */
  const resolveRecipient = useCallback(async (raw) => {
    const input = raw.trim();

    if (!input) {
      setLookupStatus('idle');
      setResolvedAddress('');
      setResolvedUsername('');
      return;
    }

    // ── Case A: looks like a 0x address ──
    if (input.startsWith('0x')) {
      if (isValidEthAddress(input)) {
        setLookupStatus('found');
        setResolvedAddress(input);
        setResolvedUsername('');
      } else {
        setLookupStatus('invalid_address');
        setResolvedAddress('');
        setResolvedUsername('');
      }
      return;
    }

    // ── Case B: @username lookup ──
    setLookupStatus('loading');
    const clean = input.replace(/^@/, '').toLowerCase().trim();

    try {
      const { data, error } = await supabase
        .from('users')
        .select('wallet_address, username')
        .eq('username', clean)
        .maybeSingle();

      if (error) {
        setLookupStatus('not_found');
        setResolvedAddress('');
        setResolvedUsername('');
        return;
      }

      if (data?.wallet_address) {
        setLookupStatus('found');
        setResolvedAddress(data.wallet_address);
        setResolvedUsername(data.username);
      } else {
        setLookupStatus('not_found');
        setResolvedAddress('');
        setResolvedUsername('');
      }
    } catch {
      setLookupStatus('not_found');
      setResolvedAddress('');
      setResolvedUsername('');
    }
  }, []);

  /* ── Debounce: wait 500ms after user stops typing ── */
  useEffect(() => {
    const timer = setTimeout(() => resolveRecipient(recipientInput), 500);
    return () => clearTimeout(timer);
  }, [recipientInput, resolveRecipient]);

  /* ── Derived values ── */
  const parsedAmount  = parseFloat(amountInr) || 0;
  const platformFee   = parsedAmount * 0.005;
  const netAmount     = parsedAmount - platformFee;
  const cryptoEquiv   = parsedAmount > 0
    ? (parsedAmount / (livePrice[selectedToken] || 1))
    : 0;

  /* ── Security Checks ── */
  const currentDeviceId = localStorage.getItem('dcrypt_device_id');
  let isHighRisk = false;
  if (profile?.session_token) {
    try {
      const sessions = JSON.parse(profile.session_token);
      const mySession = sessions.find(s => s.deviceId === currentDeviceId);
      if (mySession && mySession.highRisk && !mySession.trusted) {
        isHighRisk = true;
      }
    } catch(e) {}
  }

  /* ── Can the user proceed? ── */
  const canReview =
    lookupStatus === 'found' &&
    parsedAmount > 0 &&
    parsedAmount <= inrBalance &&
    txState === 'idle' &&
    !isHighRisk;

  /* ── Open confirmation popup ── */
  const handleReview = () => {
    if (!canReview) return;
    setTxState('idle');
    setTxError('');
    setShowConfirm(true);
  };

  /* ═══════════════════════════════════════════════════
     handleConfirm — Passkey verification + Treasury tx
     Steps:
       1. Ask wallet to sign a message → triggers Privy
          passkey / MFA flow if enrolled (noPromptOnSignature: false)
       2. POST to backend treasury engine
       3. Update local UI
  ══════════════════════════════════════════════════ */
  const handleConfirm = async () => {
    setTxState('sending');
    setTxError('');

    try {
      // ── Step 1: Passkey Verification is ALREADY done natively by PasskeyModal! ──
      // We removed personal_sign here to prevent double popups and blackscreens.

      /* ── Step 2: Send request to Treasury Engine ── */
      const response = await fetch(`${BACKEND}/api/send-crypto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:         senderUsername,
          amountInr:        parsedAmount,
          receiverWallet:   resolvedAddress,
          receiverUsername: resolvedUsername || null,
          tokenSymbol:      selectedToken,
          type:             'send',
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Transaction failed at Treasury.');
      }

      /* ── Step 3: Success — update local state ── */
      setInrBalance(prev => prev - parsedAmount);
      setTxState('success');

      setTimeout(() => {
        setShowConfirm(false);
        setRecipientInput('');
        setResolvedAddress('');
        setResolvedUsername('');
        setAmountInr('');
        setLookupStatus('idle');
        setTxState('idle');
      }, 3000);

    } catch (err) {
      console.error('Treasury Engine Error:', err);
      setTxState('error');

      // Friendly messages for user-cancelled passkey/MFA
      const msg = err.message || '';
      if (
        msg.toLowerCase().includes('cancel') ||
        msg.toLowerCase().includes('rejected') ||
        msg.toLowerCase().includes('denied') ||
        msg.toLowerCase().includes('user rejected')
      ) {
        setTxError('Passkey verification cancelled. Please try again.');
      } else {
        setTxError(msg || 'Transaction failed. Please try again.');
      }
    }
  };

  /* ── Render ── */
  return (
    <div className="animate-fade-in">

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{
          fontSize: 22, fontWeight: 700, letterSpacing: -0.3,
          color: 'var(--clr-text-white)', marginBottom: 4,
        }}>
          Send Crypto
        </h2>
        <p style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>
          Route Web3 assets globally using your INR vault as fuel.
        </p>
      </div>

      {/* Two-column layout */}
      <div className="dashboard-page-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 280px',
        gap: 20, alignItems: 'start',
      }}>

        {/* Main card */}
        <SendCryptoCard
          // token
          selectedToken={selectedToken}
          setSelectedToken={setSelectedToken}
          // recipient
          recipientInput={recipientInput}
          setRecipientInput={setRecipientInput}
          lookupStatus={lookupStatus}
          resolvedAddress={resolvedAddress}
          resolvedUsername={resolvedUsername}
          // amount
          amountInr={amountInr}
          setAmountInr={setAmountInr}
          inrBalance={inrBalance}
          parsedAmount={parsedAmount}
          platformFee={platformFee}
          netAmount={netAmount}
          cryptoEquiv={cryptoEquiv}
          livePrice={livePrice}
          priceLoading={priceLoading}
          // actions
          canReview={canReview}
          handleReview={handleReview}
          // confirmation popup
          showConfirm={showConfirm}
          setShowConfirm={setShowConfirm}
          txState={txState}
          txError={txError}
          handleConfirm={handleConfirm}
          // sender info
          senderUsername={senderUsername}
          senderAddress={walletAddress}
        />

        {/* Right info panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* INR Balance */}
          <div className="card" style={{ padding: 20 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, color: 'var(--clr-text-muted)',
              textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 12,
            }}>
              Available Balance
            </p>
            <p style={{
              fontFamily: 'var(--font-mono)', fontSize: 26, fontWeight: 700,
              color: 'var(--clr-text-white)', letterSpacing: -0.5,
            }}>
              ₹{inrBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
            </p>
            <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 4 }}>
              INR vault · usable as gas
            </p>
          </div>

          {/* Live Prices */}
          <div className="card" style={{ padding: 20 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, color: 'var(--clr-text-muted)',
              textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14,
            }}>
              Live Rates · Market Price
            </p>
            {[
              { sym: 'ETH',  label: 'Ethereum',  color: 'var(--clr-accent)' },
              { sym: 'USDC', label: 'USD Coin',   color: 'var(--clr-blue)' },
            ].map(({ sym, label, color }) => (
              <div key={sym} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderBottom: '1px solid var(--clr-border)',
              }}>
                <span style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>{label}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color }}>
                  {priceLoading ? '…' : `₹${livePrice[sym]?.toLocaleString('en-IN') || '—'}`}
                </span>
              </div>
            ))}
            <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', marginTop: 8 }}>
              ↻ Refreshes every 30s
            </p>
          </div>

          {/* How it works */}
          <div className="card" style={{ padding: 20 }}>
            <p style={{
              fontSize: 10, fontWeight: 700, color: 'var(--clr-text-muted)',
              textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14,
            }}>
              How It Works
            </p>
            {[
              { n: '1', t: 'Pick a token',      d: 'Choose ETH or USDC to send' },
              { n: '2', t: 'Enter recipient',    d: '@username or 0x address' },
              { n: '3', t: 'Set INR amount',     d: 'Your vault covers the gas' },
              { n: '4', t: 'Passkey verify',     d: 'Biometric / MFA confirmation' },
            ].map(s => (
              <div key={s.n} style={{
                display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--clr-accent-dim)',
                  border: '1px solid var(--clr-border-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700, color: 'var(--clr-accent)', marginTop: 1,
                }}>{s.n}</div>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-text-primary)', marginBottom: 1 }}>{s.t}</p>
                  <p style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>{s.d}</p>
                </div>
              </div>
            ))}
            {/* High Risk Overlay */}
            {isHighRisk && (
              <div style={{
                marginTop: 16, padding: 14, borderRadius: 'var(--radius-md)',
                background: 'rgba(239,68,68,0.05)', border: '1px solid var(--clr-border-danger)'
              }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text-red)', marginBottom: 4 }}>
                  ⚠ Security Lockdown
                </p>
                <p style={{ fontSize: 12, color: 'var(--clr-text-muted)', lineHeight: 1.5 }}>
                  Unfamiliar IP detected. Transfers are blocked until you mark this device as safe from your primary device.
                </p>
              </div>
            )}

          </div>

          {/* Security badge */}
          <div className="card" style={{
            padding: 16,
            background: 'var(--clr-accent-dim)',
            borderColor: 'var(--clr-border-accent)',
          }}>
            <p style={{ fontSize: 11, color: 'var(--clr-accent)', fontWeight: 600, marginBottom: 6 }}>
              🔐 Passkey Secured
            </p>
            <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', lineHeight: 1.5 }}>
              Every INR-funded transfer requires passkey or MFA verification. No transaction goes out without your biometric approval.
            </p>
          </div>

          {/* Fee info */}
          <div className="card" style={{
            padding: 16,
            background: 'var(--clr-emerald-dim)',
            borderColor: 'var(--clr-emerald-border)',
          }}>
            <p style={{ fontSize: 11, color: 'var(--clr-text-emerald)', fontWeight: 600, marginBottom: 6 }}>
              Platform Fee
            </p>
            <p style={{ fontSize: 24, fontWeight: 700, color: 'var(--clr-text-white)', fontFamily: 'var(--font-mono)' }}>
              0.5%
            </p>
            <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 4, lineHeight: 1.5 }}>
              Deducted from your INR amount. No hidden charges.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}