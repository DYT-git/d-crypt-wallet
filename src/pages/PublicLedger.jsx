import { usePrivy } from '@privy-io/react-auth';
import { useNavigate } from 'react-router-dom';
import History from './History';

/* ─────────────────────────────────────────────
   PUBLIC LEDGER PAGE
   Accessible without authentication.
   Wraps the existing History component with a
   minimal branded nav and sign-up CTA.
───────────────────────────────────────────── */
export default function PublicLedger() {
  const { login, authenticated } = usePrivy();
  const navigate = useNavigate();

  const handleLogin  = async () => { try { await login(); } catch (e) { console.error(e); } };

  return (
    <div className="web3-bg" style={{ minHeight: '100vh', overflowX: 'hidden' }}>

      {/* Ambient glow */}
      <div className="bg-glow-purple" />

      {/* ── Mini Nav ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 40px',
        background: 'rgba(3,8,18,0.92)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--clr-border)',
      }}>
        {/* Logo */}
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'none', border: 'none', cursor: 'pointer',
          }}
        >
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            border: '1.5px solid var(--clr-border-strong)',
            background: 'var(--clr-accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="var(--clr-accent)" strokeWidth="1.2"/>
              <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="var(--clr-accent)" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="8" cy="10.5" r="1" fill="var(--clr-accent)"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, letterSpacing: 3, color: 'var(--clr-text-white)' }}>
            D-<span style={{ color: 'var(--clr-accent)' }}>CRYPT</span>
          </span>
        </button>

        {/* Centre breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 11, color: 'var(--clr-text-muted)',
            fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '1.5px',
          }}>
            Public Ledger
          </span>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(0,229,255,0.08)', border: '1px solid var(--clr-border-accent)',
            borderRadius: 20, padding: '3px 10px',
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--clr-emerald)', display: 'inline-block', animation: 'dc-pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 10, color: 'var(--clr-emerald)', fontFamily: 'var(--font-mono)' }}>Live</span>
          </div>
        </div>

        {/* Auth buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          {authenticated ? (
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>
              Go to Dashboard →
            </button>
          ) : (
            <>
              <button className="btn btn-ghost btn-sm" onClick={handleLogin} style={{ fontSize: 13 }}>
                Log In
              </button>
              <button className="btn btn-primary btn-sm" onClick={handleLogin} style={{ fontSize: 13 }}>
                Sign Up →
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── Content area ── */}
      <div style={{ padding: '40px 48px', maxWidth: 1280, margin: '0 auto' }}>

        {/* Page title */}
        <div style={{ marginBottom: 32 }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--clr-text-muted)', fontSize: 12, marginBottom: 16,
              transition: 'var(--transition-fast)',
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--clr-text-secondary)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--clr-text-muted)'}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
            Back to Home
          </button>
          <h1 style={{
            fontSize: 'clamp(22px, 3vw, 32px)', fontWeight: 700,
            color: 'var(--clr-text-white)', letterSpacing: -0.5, marginBottom: 6,
          }}>
            🔍 D-CRYPT Public Ledger
          </h1>
          <p style={{ fontSize: 14, color: 'var(--clr-text-secondary)', lineHeight: 1.7 }}>
            Every transaction on D-CRYPT is transparent and verifiable. Browse, search, and explore
            all on-chain activity — no account required.{' '}
            {!authenticated && (
              <span
                onClick={handleLogin}
                style={{ color: 'var(--clr-accent)', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Sign up to start transacting.
              </span>
            )}
          </p>
        </div>

        {/* The existing ledger component */}
        <History />
      </div>

      {/* ── Minimal footer ── */}
      <div style={{
        borderTop: '1px solid var(--clr-border)',
        padding: '20px 48px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>
          © 2025 <span style={{ color: 'var(--clr-accent)' }}>D-CRYPT</span> Protocol — All transactions are publicly verifiable on Sepolia.
        </p>
        <a href="mailto:humandyt@gmail.com" style={{ fontSize: 12, color: 'var(--clr-text-muted)', textDecoration: 'none' }}
          onMouseEnter={e => e.target.style.color = 'var(--clr-accent)'}
          onMouseLeave={e => e.target.style.color = 'var(--clr-text-muted)'}
        >
          humandyt@gmail.com
        </a>
      </div>

    </div>
  );
}
