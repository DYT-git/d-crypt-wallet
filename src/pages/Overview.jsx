import { useState, useEffect, useCallback } from 'react';
import { usePrivy, useWallets }             from '@privy-io/react-auth';
import { useNavigate }                       from 'react-router-dom';
import { supabase }                         from '../supabase';
import VaultHeader                          from '../components/VaultHeader';
import Ledger                               from '../components/Ledger';
import DepositModal                         from '../components/DepositModal';
import ClaimProfile                         from '../components/ClaimProfile';

const BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:5000';

/* ── Time-based greeting ── */
function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

/* ── Format INR compact ── */
function fmtInr(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
  if (n >= 1000)     return `₹${(n / 1000).toFixed(2)}K`;
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

/* ── Quick Action button ── */
function QuickAction({ icon, label, sub, onClick, color = 'var(--clr-accent)', gradient }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flex: 1, padding: '16px 12px',
        background: hov
          ? (gradient || `${color}18`)
          : 'var(--clr-bg-card)',
        border: `1px solid ${hov ? `${color}60` : 'var(--clr-border)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'var(--transition-fast)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        transform: hov ? 'translateY(-2px)' : 'translateY(0)',
        boxShadow: hov ? `0 8px 24px ${color}20` : 'none',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: hov ? `${color}20` : `${color}10`,
        border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
        transition: 'var(--transition-fast)',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: hov ? color : 'var(--clr-text-secondary)', transition: 'var(--transition-fast)' }}>
        {label}
      </span>
      {sub && <span style={{ fontSize: 10, color: 'var(--clr-text-muted)' }}>{sub}</span>}
    </button>
  );
}

/* ── Mini stat pill ── */
function MiniStat({ label, value, color }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 2,
      padding: '10px 14px',
      background: 'var(--clr-bg-card)',
      border: '1px solid var(--clr-border)',
      borderRadius: 'var(--radius-md)',
      flex: 1,
    }}>
      <span style={{ fontSize: 10, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '1.2px', fontWeight: 600 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: color || 'var(--clr-text-white)' }}>{value}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════
   MAIN OVERVIEW COMPONENT
═══════════════════════════════════════════ */
export default function Overview() {
  const { user, ready }  = usePrivy();
  const { wallets }      = useWallets();
  const navigate         = useNavigate();

  const walletAddress =
    wallets?.[0]?.address ||
    user?.wallet?.address ||
    '';

  /* ── State ── */
  const [savedUsername,  setSavedUsername]  = useState('');
  const [inrBalance,     setInrBalance]     = useState(0);
  const [ethBalance,     setEthBalance]     = useState(null);
  const [usdcBalance,    setUsdcBalance]    = useState(null);
  const [ethPrice,       setEthPrice]       = useState(null);
  const [usdcPrice,      setUsdcPrice]      = useState(null);
  const [transactions,   setTransactions]   = useState([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [dbError,        setDbError]        = useState('');

  /* UPI flow */
  const [showUpi,          setShowUpi]          = useState(false);
  const [upiStatus,        setUpiStatus]        = useState('idle');
  const [depositAmount,    setDepositAmount]    = useState('');
  const [pendingDepositId, setPendingDepositId] = useState(null);

  /* ── Fetch on-chain balances ── */
  const loadOnChainBalances = useCallback(async (addr) => {
    if (!addr) return;
    try {
      const res  = await fetch(`${BACKEND}/api/balance/${addr}`);
      const data = await res.json();
      if (data.success) {
        setEthBalance(data.eth);
        setUsdcBalance(data.usdc);
      }
    } catch (e) {
      setEthBalance('—');
      setUsdcBalance('—');
    }
  }, []);

  /* ── Fetch live prices ── */
  const loadPrices = useCallback(async () => {
    try {
      const res  = await fetch(`${BACKEND}/api/price`);
      const data = await res.json();
      if (data.success) {
        setEthPrice(data.ETH || null);
        setUsdcPrice(data.USDC || null);
      }
    } catch { /* silent */ }
  }, []);

  /* ── Load profile ── */
  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setDbError('');
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, inr_balance')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (error) { setDbError(error.message); return; }
      if (data) {
        setSavedUsername(data.username  || '');
        setInrBalance(data.inr_balance  || 0);
        if (data.username) loadTransactions(data.username);
      }
    } catch { setDbError('Could not connect to database.'); }
    finally   { setProfileLoading(false); }
  }, [walletAddress]);

  /* ── Load transactions ── */
  const loadTransactions = async (uname) => {
    if (!uname) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('username', uname)
        .order('created_at', { ascending: false })
        .limit(10);
      if (!error) setTransactions(Array.isArray(data) ? data : []);
    } catch { setTransactions([]); }
  };

  /* ── Bootstrap ── */
  useEffect(() => {
    if (!ready) return;
    if (!walletAddress) { setProfileLoading(false); return; }
    loadProfile();
    loadOnChainBalances(walletAddress);
    loadPrices();
  }, [ready, walletAddress]);

  useEffect(() => {
    const t = setTimeout(() => setProfileLoading(false), 8000);
    return () => clearTimeout(t);
  }, []);

  const handleProfileCreated = (username) => {
    setSavedUsername(username);
    setInrBalance(0);
    setTransactions([]);
    loadTransactions(username);
    loadOnChainBalances(walletAddress);
  };

  /* ── UPI deposit ── */
  const handleUpiPayment = async () => {
    if (!depositAmount || Number(depositAmount) <= 0) return;
    setUpiStatus('waiting_for_scan');
    try {
      const { data, error } = await supabase
        .from('transactions')
        .insert({ username: savedUsername, txn_type: 'deposit', amount_inr: parseFloat(depositAmount), status: 'pending' })
        .select().maybeSingle();
      if (error || !data) { console.warn('Deposit insert:', error?.message); return; }
      setPendingDepositId(data.id);
      const interval = setInterval(async () => {
        const { data: tx } = await supabase
          .from('transactions').select('status').eq('id', data.id).maybeSingle();
        if (tx?.status === 'completed') {
          clearInterval(interval);
          setUpiStatus('success');
          setInrBalance(prev => prev + parseFloat(depositAmount));
          setTimeout(() => { setShowUpi(false); setUpiStatus('idle'); setDepositAmount(''); loadTransactions(savedUsername); }, 2500);
        }
      }, 2000);
    } catch (err) { console.warn('UPI error:', err); }
  };

  /* ── Derived: total portfolio in INR ── */
  const ethInr  = ethPrice  && ethBalance  && ethBalance  !== '—' ? parseFloat(ethBalance)  * ethPrice  : 0;
  const usdcInr = usdcPrice && usdcBalance && usdcBalance !== '—' ? parseFloat(usdcBalance) * usdcPrice : 0;
  const totalInr = inrBalance + ethInr + usdcInr;

  /* ─────── RENDER STATES ─────── */
  if (!ready) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300, flexDirection: 'column', gap: 16 }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--clr-border)', borderTopColor: 'var(--clr-accent)', animation: 'dc-spin 0.8s linear infinite' }}/>
        <p style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>Initialising vault engine…</p>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="shimmer" style={{ height: 80,  borderRadius: 'var(--radius-lg)' }}/>
        <div className="shimmer" style={{ height: 200, borderRadius: 'var(--radius-lg)' }}/>
        <div className="shimmer" style={{ height: 300, borderRadius: 'var(--radius-lg)' }}/>
      </div>
    );
  }

  if (dbError) {
    return (
      <div style={{ background: 'var(--clr-red-dim)', border: '1px solid var(--clr-border-danger)', borderRadius: 'var(--radius-lg)', padding: 32, textAlign: 'center' }}>
        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--clr-text-red)', marginBottom: 10 }}>Database Error</p>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--clr-text-secondary)', marginBottom: 20, lineHeight: 1.7 }}>{dbError}</p>
        <button onClick={loadProfile} className="btn btn-ghost">Retry Connection</button>
      </div>
    );
  }

  if (!savedUsername) {
    return <ClaimProfile walletAddress={walletAddress} onSuccess={handleProfileCreated} />;
  }

  /* ─────── FULL DASHBOARD ─────── */
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="animate-fade-in">

      {/* ── Greeting header ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
        marginBottom: 28, flexWrap: 'wrap', gap: 12,
      }}>
        <div>
          <p style={{ fontSize: 12, color: 'var(--clr-text-muted)', marginBottom: 4, letterSpacing: '0.5px' }}>{today}</p>
          <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.5, color: 'var(--clr-text-white)', lineHeight: 1.2 }}>
            {getGreeting()},{' '}
            <span style={{ color: 'var(--clr-accent)' }}>@{savedUsername}</span> 👋
          </h2>
          <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', marginTop: 4 }}>
            Here's your vault overview for today.
          </p>
        </div>

        {/* Total portfolio chip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'var(--clr-accent-dim)',
          border: '1px solid var(--clr-border-accent)',
          borderRadius: 'var(--radius-lg)',
          padding: '10px 18px',
        }}>
          <div>
            <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: 2 }}>
              Total Portfolio
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--clr-accent)', letterSpacing: -0.5 }}>
              {ethPrice ? fmtInr(totalInr) : fmtInr(inrBalance)}
            </p>
          </div>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--clr-accent-dim)', border: '1px solid var(--clr-border-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--clr-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
            </svg>
          </div>
        </div>
      </div>

      {/* ── Balance Cards ── */}
      <div className="grid-3" style={{ marginBottom: 20 }}>

        {/* INR Vault */}
        <div className="card" style={{
          padding: 24, position: 'relative', overflow: 'hidden',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(99,102,241,0.03) 100%)',
          border: '1px solid rgba(129,140,248,0.35)',
        }}>
          <div style={{ position: 'absolute', top: -40, right: -40, width: 140, height: 140, borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)', pointerEvents: 'none' }}/>

          {/* Token chip */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(129,140,248,0.35)', borderRadius: 'var(--radius-pill)', padding: '4px 10px' }}>
              <span style={{ fontSize: 13 }}>🇮🇳</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-accent)', letterSpacing: 1 }}>INR</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clr-emerald)', display: 'inline-block', animation: 'dc-pulse 2s ease-in-out infinite' }}/>
              <span style={{ fontSize: 10, color: 'var(--clr-text-emerald)', fontWeight: 600 }}>Live</span>
            </div>
          </div>

          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--clr-text-muted)', marginBottom: 6 }}>INR Vault</p>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: 'var(--clr-text-white)', letterSpacing: -1.5, lineHeight: 1, marginBottom: 6 }}>
            ₹{inrBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <p style={{ fontSize: 11, color: 'var(--clr-text-secondary)', marginBottom: 20 }}>Fiat balance · depositable via UPI</p>

          <button onClick={() => setShowUpi(true)} className="btn btn-primary" style={{ width: '100%', fontSize: 13, padding: '10px 0' }}>
            + Deposit
          </button>
        </div>

        {/* USDC */}
        <div className="card" style={{
          padding: 24, position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(135deg, rgba(52,211,153,0.07) 0%, rgba(52,211,153,0.02) 100%)',
          border: '1px solid rgba(52,211,153,0.25)',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(52,211,153,0.10) 0%, transparent 70%)', pointerEvents: 'none' }}/>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.30)', borderRadius: 'var(--radius-pill)', padding: '4px 10px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="#34d399" strokeWidth="2"/><path d="M8 12h8M12 8v8" stroke="#34d399" strokeWidth="2" strokeLinecap="round"/></svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-emerald)', letterSpacing: 1 }}>USDC</span>
            </div>
          </div>

          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--clr-text-muted)', marginBottom: 6 }}>USDC Balance</p>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: 'var(--clr-text-white)', letterSpacing: -1, marginBottom: 4 }}>
            {usdcBalance === null
              ? <span style={{ fontSize: 16, color: 'var(--clr-text-muted)' }}>Loading…</span>
              : usdcBalance}
          </div>
          {usdcPrice && usdcBalance && usdcBalance !== '—' && (
            <p style={{ fontSize: 11, color: 'var(--clr-text-secondary)', marginBottom: 'auto' }}>
              ≈ {fmtInr(parseFloat(usdcBalance) * usdcPrice)}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 14 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--clr-emerald)', animation: 'dc-pulse 2s ease-in-out infinite' }}/>
            <p style={{ fontSize: 10, color: 'var(--clr-text-secondary)' }}>Live · Sepolia</p>
          </div>
        </div>

        {/* ETH */}
        <div className="card" style={{
          padding: 24, position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(135deg, rgba(34,211,238,0.07) 0%, rgba(34,211,238,0.02) 100%)',
          border: '1px solid rgba(34,211,238,0.22)',
        }}>
          <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'radial-gradient(circle, rgba(34,211,238,0.10) 0%, transparent 70%)', pointerEvents: 'none' }}/>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(34,211,238,0.10)', border: '1px solid rgba(34,211,238,0.28)', borderRadius: 'var(--radius-pill)', padding: '4px 10px' }}>
              <svg width="11" height="14" viewBox="0 0 11 18" fill="none"><path d="M5.5 0L0 9.18L5.5 12.27L11 9.18L5.5 0Z" fill="#22d3ee"/><path d="M5.5 13.34L0 10.25L5.5 18L11 10.25L5.5 13.34Z" fill="#22d3ee" opacity="0.7"/></svg>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--clr-text-cyan)', letterSpacing: 1 }}>ETH</span>
            </div>
          </div>

          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--clr-text-muted)', marginBottom: 6 }}>ETH Balance</p>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 32, fontWeight: 700, color: 'var(--clr-text-white)', letterSpacing: -1, marginBottom: 4 }}>
            {ethBalance === null
              ? <span style={{ fontSize: 16, color: 'var(--clr-text-muted)' }}>Loading…</span>
              : ethBalance}
          </div>
          {ethPrice && ethBalance && ethBalance !== '—' && (
            <p style={{ fontSize: 11, color: 'var(--clr-text-secondary)', marginBottom: 'auto' }}>
              ≈ {fmtInr(parseFloat(ethBalance) * ethPrice)}
            </p>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 14 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--clr-cyan)', animation: 'dc-pulse 2s ease-in-out infinite' }}/>
            <p style={{ fontSize: 10, color: 'var(--clr-text-secondary)' }}>Live · Sepolia</p>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14 }}>
          Quick Actions
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <QuickAction
            icon="⬇️" label="Deposit" sub="via UPI"
            color="var(--clr-emerald)"
            onClick={() => setShowUpi(true)}
          />
          <QuickAction
            icon="📤" label="Send" sub="Crypto"
            color="var(--clr-accent)"
            onClick={() => navigate('/dashboard/send')}
          />
          <QuickAction
            icon="🔄" label="Swap" sub="Convert"
            color="var(--clr-purple)"
            onClick={() => navigate('/dashboard/swap')}
          />
          <QuickAction
            icon="📜" label="Ledger" sub="History"
            color="var(--clr-amber)"
            onClick={() => navigate('/dashboard/history')}
          />
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="dashboard-page-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 290px', gap: 20, alignItems: 'start' }}>

        {/* LEFT — Ledger (limit 4 in overview; click View All → history) */}
        <Ledger transactions={transactions} limit={4} />

        {/* RIGHT — Side panels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Vault Header / User info */}
          <div className="card" style={{ padding: 20 }}>
            <VaultHeader
              savedUsername={savedUsername}
              walletAddress={walletAddress}
              inrBalance={inrBalance}
              setShowUpi={setShowUpi}
            />
          </div>

          {/* Mini stats */}
          <div style={{ display: 'flex', gap: 8 }}>
            <MiniStat label="Txns" value={transactions.length} color="var(--clr-accent)" />
            <MiniStat label="Network" value="Sepolia" color="var(--clr-emerald)" />
          </div>

          {/* Wallet Info */}
          <div className="card" style={{ padding: 18 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: 14 }}>
              Vault Details
            </p>
            {[
              { label: 'Network',  value: 'Sepolia Testnet' },
              { label: 'Address',  value: walletAddress ? `${walletAddress.slice(0,8)}…${walletAddress.slice(-6)}` : '—', mono: true },
              { label: 'Custody',  value: 'Non-Custodial' },
              { label: 'Standard', value: 'ERC-20 / ETH' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--clr-border)' }}>
                <span style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>{row.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, fontFamily: row.mono ? 'var(--font-mono)' : undefined, color: 'var(--clr-text-secondary)' }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Security badge */}
          <div className="card" style={{ padding: 14, background: 'var(--clr-accent-dim)', borderColor: 'var(--clr-border-accent)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--clr-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <p style={{ fontSize: 12, color: 'var(--clr-accent)', fontWeight: 600 }}>Trustless by Design</p>
            </div>
            <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', lineHeight: 1.6 }}>
              Your keys are never stored on our servers. Only you control this vault.
            </p>
          </div>

        </div>
      </div>

      {/* Unified Deposit Modal */}
      <DepositModal
        show={showUpi} onClose={() => setShowUpi(false)}
        upiStatus={upiStatus} depositAmount={depositAmount}
        setDepositAmount={setDepositAmount} handleUpiPayment={handleUpiPayment}
        savedUsername={savedUsername} pendingDepositId={pendingDepositId}
        walletAddress={walletAddress}
      />
    </div>
  );
}