import { NavLink, useNavigate } from 'react-router-dom';
import { usePrivy }              from '@privy-io/react-auth';
import { useState, useEffect }   from 'react';
import { supabase }              from '../supabase';

/* ─── SVG Icons ─── */
const Icons = {
  Overview: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  ),
  Send: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"></line>
      <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
    </svg>
  ),
  Swap: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
    </svg>
  ),
  History: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
    </svg>
  ),
  Account: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
    </svg>
  ),
  Lock: (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="8" cy="10.5" r="1" fill="currentColor"/>
    </svg>
  ),
  Logout: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  ),
};

const NAV_ITEMS = [
  { name: 'Overview',    path: '/dashboard',         icon: Icons.Overview, color: 'var(--clr-accent)' },
  { name: 'Send Crypto', path: '/dashboard/send',    icon: Icons.Send,     color: 'var(--clr-accent)' },
  { name: 'Swap',        path: '/dashboard/swap',    icon: Icons.Swap,     color: 'var(--clr-purple)' },
  { name: 'Ledger',      path: '/dashboard/history', icon: Icons.History,  color: 'var(--clr-amber)'  },
  { name: 'Account',     path: '/dashboard/account', icon: Icons.Account,  color: 'var(--clr-emerald)'},
];

export default function Sidebar({ onNavigate }) {
  const { user, logout } = usePrivy();
  const navigate         = useNavigate();
  const [username, setUsername] = useState('');

  const walletAddress = user?.wallet?.address || '';

  /* Fetch username for sidebar identity */
  useEffect(() => {
    if (!walletAddress) return;
    supabase
      .from('users')
      .select('username')
      .eq('wallet_address', walletAddress)
      .maybeSingle()
      .then(({ data }) => { if (data?.username) setUsername(data.username); });
  }, [walletAddress]);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const initials = username
    ? username.slice(0, 2).toUpperCase()
    : walletAddress ? walletAddress.slice(2, 4).toUpperCase() : '??';

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      minWidth: 'var(--sidebar-width)',
      height: '100vh',
      background: 'var(--clr-bg-surface)',
      borderRight: '1px solid var(--clr-border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 14px',
      flexShrink: 0,
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', top: -60, left: -60,
        width: 200, height: 200,
        background: 'radial-gradient(circle, rgba(0,229,255,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }}/>

      {/* ── Logo ── */}
      <div style={{ marginBottom: 28, paddingLeft: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 3 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            border: '1.5px solid var(--clr-border-strong)',
            background: 'var(--clr-accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--clr-accent)', flexShrink: 0,
          }}>
            {Icons.Lock}
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, letterSpacing: 4, color: 'var(--clr-text-white)' }}>
            D-<span style={{ color: 'var(--clr-accent)' }}>CRYPT</span>
          </span>
        </div>
        <p style={{ fontSize: 9, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600, paddingLeft: 37 }}>
          Web3 Vault
        </p>
      </div>

      {/* ── Section Label ── */}
      <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '1.5px', fontWeight: 600, marginBottom: 6, paddingLeft: 6 }}>
        Navigation
      </p>

      {/* ── Nav Links ── */}
      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            end={item.path === '/dashboard'}
            onClick={onNavigate}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '9px 12px',
              borderRadius: 'var(--radius-md)',
              fontSize: 13,
              fontWeight: isActive ? 600 : 500,
              textDecoration: 'none',
              border: '1px solid',
              transition: 'all 0.15s ease',
              color:       isActive ? item.color              : 'var(--clr-text-secondary)',
              background:  isActive ? `${item.color}15`       : 'transparent',
              borderColor: isActive ? `${item.color}40`       : 'transparent',
              boxShadow:   isActive ? `0 0 12px ${item.color}10` : 'none',
            })}
          >
            <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
              {item.icon}
            </span>
            {item.name}
          </NavLink>
        ))}
      </nav>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: 'var(--clr-border)', margin: '16px 0' }}/>

      {/* ── Network Status ── */}
      <div style={{
        background: 'var(--clr-bg-card)',
        border: '1px solid var(--clr-border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 12px',
        marginBottom: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: 'var(--clr-text-muted)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Network</span>
          <span className="badge-live" style={{ fontSize: 9 }}>Live</span>
        </div>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--clr-text-secondary)', fontWeight: 500 }}>
          Sepolia Testnet
        </p>
      </div>

      {/* ── User identity card ── */}
      {(username || walletAddress) && (
        <div style={{
          background: 'var(--clr-bg-card)',
          border: '1px solid var(--clr-border)',
          borderRadius: 'var(--radius-md)',
          padding: '10px 12px',
          marginBottom: 10,
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          {/* Avatar */}
          <div style={{
            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg, var(--clr-accent-dim), var(--clr-purple-dim))',
            border: '1.5px solid var(--clr-border-accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
            color: 'var(--clr-accent)',
          }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: 'var(--clr-text-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {username ? `@${username}` : 'Vault User'}
            </p>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--clr-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {walletAddress ? `${walletAddress.slice(0, 8)}…${walletAddress.slice(-4)}` : '—'}
            </p>
          </div>
        </div>
      )}

      {/* ── Logout Button ── */}
      <button
        onClick={handleLogout}
        className="btn btn-danger btn-full"
        style={{ fontSize: 13, padding: '9px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {Icons.Logout}
        Sign Out
      </button>

      {/* ── Footer credit ── */}
      <p style={{ fontSize: 9, color: 'var(--clr-text-muted)', textAlign: 'center', marginTop: 12, textTransform: 'uppercase', letterSpacing: '2px', fontWeight: 600 }}>
        Secured by DYT
      </p>

    </aside>
  );
}