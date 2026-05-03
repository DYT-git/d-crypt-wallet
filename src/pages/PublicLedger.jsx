import { usePrivy } from '@privy-io/react-auth';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';
import History from './History';

/* ─────────────────────────────────────────────
   PUBLIC LEDGER PAGE
   Accessible without authentication.
   Fully responsive: mobile, tablet, desktop.
───────────────────────────────────────────── */
export default function PublicLedger() {
  const { login, authenticated } = usePrivy();
  const navigate = useNavigate();
  const { isDark } = useTheme();

  const handleLogin = async () => { try { await login(); } catch (e) { console.error(e); } };

  return (
    <div className="web3-bg" style={{ minHeight: '100vh', overflowX: 'hidden' }}>
      <div className="bg-glow-purple" />

      {/* ── Sticky Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px',
        background: isDark ? 'rgba(3,8,18,0.92)' : 'rgba(240,244,255,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--clr-border)',
        gap: 8,
        flexWrap: 'nowrap',
        minWidth: 0,
      }}>
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0,
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            border: '1.5px solid var(--clr-border-strong)',
            background: 'var(--clr-accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="var(--clr-accent)" strokeWidth="1.2"/>
              <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="var(--clr-accent)" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="8" cy="10.5" r="1" fill="var(--clr-accent)"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, letterSpacing: 2, color: 'var(--clr-text-white)', whiteSpace: 'nowrap' }}>
            D-<span style={{ color: 'var(--clr-accent)' }}>CRYPT</span>
          </span>
        </button>

        {/* Live badge — centre */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: isDark ? 'rgba(0,229,255,0.06)' : 'rgba(67,56,202,0.07)',
          border: '1px solid var(--clr-border-accent)',
          borderRadius: 20, padding: '4px 10px', flexShrink: 0,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--clr-emerald)', display: 'inline-block', animation: 'dc-pulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: 'var(--clr-emerald)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>Live</span>
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <ThemeToggle compact />
          {authenticated ? (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}
              style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}>
              Dashboard →
            </button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={handleLogin}
                style={{ fontSize: 12, padding: '6px 10px' }}>
                Log In
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleLogin}
                style={{ fontSize: 12, padding: '6px 12px', whiteSpace: 'nowrap' }}>
                Sign Up
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── Page header ── */}
      <div style={{
        padding: '24px 20px 0',
        maxWidth: 1280, margin: '0 auto',
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--clr-text-muted)', fontSize: 12, marginBottom: 14,
            transition: 'var(--transition-fast)', padding: 0,
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--clr-text-secondary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--clr-text-muted)'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back to Home
        </button>

        <h1 style={{
          fontSize: 'clamp(18px, 4vw, 28px)', fontWeight: 700,
          color: 'var(--clr-text-white)', letterSpacing: -0.5, marginBottom: 6,
        }}>
          🔍 D-CRYPT Public Ledger
        </h1>
        <p style={{ fontSize: 13, color: 'var(--clr-text-secondary)', lineHeight: 1.6, marginBottom: 24, maxWidth: 560 }}>
          Every transaction on D-CRYPT is transparent and verifiable on-chain — no account required.{' '}
          {!authenticated && (
            <span onClick={handleLogin} style={{ color: 'var(--clr-accent)', cursor: 'pointer', textDecoration: 'underline' }}>
              Sign up to start transacting.
            </span>
          )}
        </p>
      </div>

      {/* ── Main content ── */}
      <div style={{ padding: '0 20px 40px', maxWidth: 1280, margin: '0 auto' }}>
        <History />
      </div>

      {/* ── Footer ── */}
      <div style={{
        borderTop: '1px solid var(--clr-border)',
        padding: '16px 20px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 10,
      }}>
        <p style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
          © 2026 <span style={{ color: 'var(--clr-accent)' }}>D-CRYPT</span> Protocol — Sepolia Testnet
        </p>
        <a href="mailto:humandyt@gmail.com" style={{ fontSize: 11, color: 'var(--clr-text-muted)', textDecoration: 'none' }}
          onMouseEnter={e => e.target.style.color = 'var(--clr-accent)'}
          onMouseLeave={e => e.target.style.color = 'var(--clr-text-muted)'}
        >
          humandyt@gmail.com
        </a>
      </div>
    </div>
  );
}
