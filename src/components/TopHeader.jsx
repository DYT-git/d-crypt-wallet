import { usePrivy }        from '@privy-io/react-auth';
import { useLocation, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase }          from '../supabase';

/* Map each route path to a readable page title + subtitle */
const PAGE_META = {
  '/dashboard':         { title: 'Overview',  sub: 'Your balances, transfers, and activity'   },
  '/dashboard/send':    { title: 'Send Crypto', sub: 'Route assets globally with INR as gas'   },
  '/dashboard/swap':    { title: 'Swap',       sub: 'Convert tokens and cash out to INR'       },
  '/dashboard/history': { title: 'Ledger',     sub: 'Full transaction history on-chain'        },
  '/dashboard/account': { title: 'Account',    sub: 'Profile, security, and wallet settings'   },
};

/* Shorten wallet address */
function shortAddr(addr) {
  if (!addr) return '—';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function TopHeader({ onMenuToggle }) {
  const { user }          = usePrivy();
  const { pathname }      = useLocation();
  const [copied,    setCopied]    = useState(false);
  const [username,  setUsername]  = useState('');

  const meta    = PAGE_META[pathname] || { title: 'Dashboard', sub: '' };
  const address = user?.wallet?.address;

  /* Fetch username once */
  useEffect(() => {
    if (!address) return;
    supabase
      .from('users')
      .select('username')
      .eq('wallet_address', address)
      .maybeSingle()
      .then(({ data }) => { if (data?.username) setUsername(data.username); });
  }, [address]);

  const handleCopy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header style={{
      height: 68,
      borderBottom: '1px solid var(--clr-border)',
      background: 'rgba(8, 15, 30, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 28px',
      flexShrink: 0,
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>

      {/* ── Left: hamburger (mobile) + Page title ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <button
          className="hamburger-btn"
          onClick={onMenuToggle}
          style={{
            background: 'none', border: '1px solid var(--clr-border)',
            color: 'var(--clr-text-primary)', borderRadius: 8,
            padding: '6px 10px', cursor: 'pointer', fontSize: 18, lineHeight: 1,
            flexShrink: 0,
          }}
        >☰</button>

        <div style={{ minWidth: 0 }}>
          <h1 style={{ 
            fontSize: 17, fontWeight: 700, color: 'var(--clr-text-white)', 
            lineHeight: 1.2, letterSpacing: -0.3,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}>
            {meta.title}
          </h1>
          <p className="header-subtitle" style={{ 
            fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 1, fontWeight: 400,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' 
          }}>
            {meta.sub}
          </p>
        </div>
      </div>

      {/* ── Right ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>

        {/* Network badge — hidden on mobile via CSS */}
        <div className="header-network-badge" style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: 'var(--clr-bg-card)',
          border: '1px solid var(--clr-border)',
          borderRadius: 'var(--radius-pill)',
          padding: '5px 12px',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: 'var(--clr-emerald)', display: 'inline-block',
            animation: 'dc-pulse 2s ease-in-out infinite', flexShrink: 0,
          }}/>
          <span style={{
            fontSize: 11, fontWeight: 600,
            color: 'var(--clr-text-emerald)',
            textTransform: 'uppercase', letterSpacing: '1.5px',
          }}>
            Sepolia
          </span>
        </div>

        {/* Username + address chip */}
        <button
          onClick={handleCopy}
          title={copied ? 'Copied!' : 'Click to copy full address'}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: copied ? 'var(--clr-accent-dim)' : 'var(--clr-bg-card)',
            border: `1px solid ${copied ? 'var(--clr-border-accent)' : 'var(--clr-border)'}`,
            borderRadius: 'var(--radius-pill)',
            padding: '5px 12px',
            cursor: 'pointer',
            transition: 'var(--transition-med)',
          }}
        >
          {/* Avatar */}
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--clr-accent-dim), var(--clr-purple-dim))',
            border: '1px solid var(--clr-border-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            color: 'var(--clr-accent)',
          }}>
            {username ? username.slice(0, 2).toUpperCase() : '??'}
          </div>

          {/* Username or address — hide text on very small screens */}
          <div className="header-addr-text" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 0 }}>
            {username && (
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700,
                color: copied ? 'var(--clr-accent)' : 'var(--clr-text-primary)',
                lineHeight: 1.2, maxWidth: 100, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                @{username}
              </span>
            )}
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: copied ? 'var(--clr-accent)' : 'var(--clr-text-muted)',
              fontWeight: 400, lineHeight: 1.2,
            }}>
              {copied ? '✓ Copied!' : shortAddr(address)}
            </span>
          </div>

          {!copied && (
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="var(--clr-text-muted)" strokeWidth="2"
              strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          )}
        </button>

        {/* Account link */}
        <Link
          to="/dashboard/account"
          style={{
            width: 34, height: 34,
            borderRadius: 'var(--radius-md)',
            background: 'var(--clr-bg-card)',
            border: '1px solid var(--clr-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--clr-text-secondary)',
            textDecoration: 'none',
            transition: 'var(--transition-fast)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--clr-border-accent)';
            e.currentTarget.style.color = 'var(--clr-accent)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--clr-border)';
            e.currentTarget.style.color = 'var(--clr-text-secondary)';
          }}
          title="Account settings"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
          </svg>
        </Link>

      </div>
    </header>
  );
}