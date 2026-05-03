import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';
import { useTheme } from '../context/ThemeContext';

/* ─────────────────────────────────────────────
   LANDING PAGE — D-CRYPT WEB3 VAULT
   Uses CSS variables from index.css
   No inline hex colors — everything from tokens
───────────────────────────────────────────── */

const FEATURES = [
  {
    icon: '⚡',
    color: 'var(--clr-accent)',
    colorDim: 'var(--clr-accent-dim)',
    colorBorder: 'var(--clr-border-accent)',
    title: 'Instant UPI Bridge',
    desc: 'Deposit INR in seconds. Our real-time gateway verifies and credits your vault automatically — no manual steps.',
  },
  {
    icon: '🔗',
    color: 'var(--clr-emerald)',
    colorDim: 'var(--clr-emerald-dim)',
    colorBorder: 'var(--clr-emerald-border)',
    title: 'Fiat-as-Fuel',
    desc: 'Send ETH or USDC without holding gas tokens. Your INR balance covers every on-chain transaction automatically.',
  },
  {
    icon: '🛡️',
    color: 'var(--clr-purple)',
    colorDim: 'var(--clr-purple-dim)',
    colorBorder: 'var(--clr-purple-border)',
    title: 'Non-Custodial',
    desc: 'Your wallet, your keys, your assets. Export your private key any time — true self-custody with embedded wallet technology.',
  },
  {
    icon: '👤',
    color: 'var(--clr-amber)',
    colorDim: 'var(--clr-amber-dim)',
    colorBorder: 'rgba(245,158,11,0.25)',
    title: 'Username Transfers',
    desc: 'Send crypto or INR to anyone on D-CRYPT using just their @username — no wallet address needed.',
  },
  {
    icon: '📡',
    color: 'var(--clr-blue)',
    colorDim: 'var(--clr-blue-dim)',
    colorBorder: 'var(--clr-blue-border)',
    title: 'Public Ledger',
    desc: 'Every transaction recorded on-chain and visible to anyone. A real-time explorer built right into the platform.',
  },
  {
    icon: '🔄',
    color: 'var(--clr-emerald)',
    colorDim: 'var(--clr-emerald-dim)',
    colorBorder: 'var(--clr-emerald-border)',
    title: 'Instant Swaps',
    desc: 'Convert received crypto back to INR with one tap, using live market prices. No CEX account needed.',
  },
];

const STEPS = [
  { n: '01', title: 'Create Your Account', desc: 'Sign up with Google, email, or an existing wallet. A non-custodial vault is automatically generated for you — no setup required.' },
  { n: '02', title: 'Claim Your @username', desc: 'Pick your unique @d-crypt handle. This becomes your payment address for INR and crypto transfers.' },
  { n: '03', title: 'Deposit & Transact', desc: 'Add INR via UPI. Send crypto globally using your INR balance as fuel — no gas tokens required.' },
];

// Stats are now fetched live from /api/stats

/* ── Animated Vault SVG ── */
function VaultGraphic() {
  return (
    <div style={{ position: 'relative', width: 340, height: 340, flexShrink: 0 }}>
      {/* Rotating rings */}
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{
          position: 'absolute',
          inset: i * 34,
          borderRadius: '50%',
          border: '1px solid',
          borderColor: i % 2 === 0
            ? 'rgba(0,229,255,0.1)'
            : 'rgba(124,58,237,0.1)',
          animation: `dc-spin ${12 + i * 6}s linear infinite`,
          animationDirection: i % 2 === 0 ? 'normal' : 'reverse',
        }} />
      ))}

      {/* Orbit dots */}
      {[0, 90, 180, 270].map((deg, i) => {
        const r = 148, rad = (deg * Math.PI) / 180;
        const x = 170 + r * Math.cos(rad) - 4;
        const y = 170 + r * Math.sin(rad) - 4;
        return (
          <div key={i} style={{
            position: 'absolute',
            left: x, top: y,
            width: 8, height: 8,
            borderRadius: '50%',
            background: 'var(--clr-accent)',
            boxShadow: '0 0 8px var(--clr-accent), 0 0 16px var(--clr-accent-glow)',
            animation: `dc-glow ${2 + i * 0.4}s ease-in-out infinite`,
            animationDelay: `${i * 0.4}s`,
          }} />
        );
      })}

      {/* Core vault icon */}
      <div style={{
        position: 'absolute',
        inset: 120,
        borderRadius: '50%',
        background: 'var(--clr-accent-dim)',
        border: '1px solid var(--clr-border-accent)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: 'dc-float 5s ease-in-out infinite',
        boxShadow: 'var(--shadow-accent)',
      }}>
        <svg width="52" height="52" viewBox="0 0 52 52" fill="none">
          <rect x="10" y="22" width="32" height="22" rx="5"
            stroke="var(--clr-accent)" strokeWidth="1.5"/>
          <path d="M18 22V16a8 8 0 0 1 16 0v6"
            stroke="var(--clr-accent)" strokeWidth="1.5" strokeLinecap="round"/>
          <circle cx="26" cy="32" r="3" fill="var(--clr-accent)" opacity="0.9"/>
          <line x1="26" y1="35" x2="26" y2="39"
            stroke="var(--clr-accent)" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </div>
    </div>
  );
}

/* ── Animated counter hook ── */
function useCountUp(target, duration = 1800) {
  const [count, setCount] = useState(0);
  const frameRef = useRef(null);
  useEffect(() => {
    if (!target) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setCount(Math.floor(progress * target));
      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };
    frameRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameRef.current);
  }, [target, duration]);
  return count;
}

/* ── Smart number formatter ── */
function fmtStat(n) {
  if (n >= 10000000) return { val: (n / 10000000).toFixed(1), unit: 'Cr' };
  if (n >= 100000)   return { val: (n / 100000).toFixed(1),   unit: 'L'  };
  if (n >= 1000)     return { val: (n / 1000).toFixed(1),     unit: 'K'  };
  return { val: n.toFixed(0), unit: '' };
}

/* ── Live Stats Bar Component ── */
function StatCell({ rawValue, label, prefix = '', color = 'var(--clr-accent)', loaded, sublabel = '' }) {
  const { val, unit } = fmtStat(loaded ? rawValue : 0);
  const numericVal = parseFloat(val) || 0;
  const animated = useCountUp(loaded ? numericVal * 10 : 0, 2000);
  const display = loaded ? (animated / 10).toFixed(unit ? 1 : 0) : '0';

  return (
    <div style={{ padding: '36px 20px', textAlign: 'center', flex: 1, minWidth: 120 }}>
      <div style={{
        fontFamily: 'var(--font-mono)', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700,
        color: 'var(--clr-text-white)', letterSpacing: -1, lineHeight: 1,
        marginBottom: 4, display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3,
      }}>
        {prefix && <span style={{ color, fontSize: '0.7em' }}>{prefix}</span>}
        <span>{display}</span>
        {unit && <span style={{ color, fontSize: '0.55em', fontWeight: 700, letterSpacing: 1 }}>{unit}</span>}
      </div>
      <div style={{
        fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.8px',
        color: 'var(--clr-text-muted)', marginTop: 8, fontWeight: 600,
      }}>{label}</div>
      {sublabel && (
        <div style={{ fontSize: 9, color, marginTop: 4, opacity: 0.7 }}>{sublabel}</div>
      )}
      {loaded && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          marginTop: 6, fontSize: 9, color: 'var(--clr-emerald)',
          textTransform: 'uppercase', letterSpacing: '1px',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--clr-emerald)', display: 'inline-block', animation: 'dc-pulse 1.5s ease-in-out infinite' }} />
          Live
        </div>
      )}
    </div>
  );
}

function LiveStatsBar({ liveStats, statsLoaded }) {
  return (
    <div className="web3-content landing-stats-grid" style={{
      borderTop: '1px solid var(--clr-border)',
      borderBottom: '1px solid var(--clr-border)',
      display: 'flex',
      alignItems: 'stretch',
      flexWrap: 'wrap',
    }}>
      <StatCell rawValue={liveStats.users} label="Registered Users" suffix="+" color="var(--clr-accent)" loaded={statsLoaded} sublabel="wallets" />
      <div style={{ width: 1, background: 'var(--clr-border)', flexShrink: 0 }} />
      <StatCell rawValue={liveStats.transactions} label="Total Transactions" color="var(--clr-purple)" loaded={statsLoaded} sublabel="on-chain" />
      <div style={{ width: 1, background: 'var(--clr-border)', flexShrink: 0 }} />
      <StatCell rawValue={liveStats.volumeTraded} label="Traded Volume" prefix="₹" color="var(--clr-emerald)" loaded={statsLoaded} sublabel="swaps & sends" />
      <div style={{ width: 1, background: 'var(--clr-border)', flexShrink: 0 }} />
      <StatCell rawValue={liveStats.depositsInr} label="UPI Deposited" prefix="₹" color="var(--clr-blue)" loaded={statsLoaded} sublabel="completed deposits" />
      <div style={{ width: 1, background: 'var(--clr-border)', flexShrink: 0 }} />
      <div style={{ padding: '36px 20px', textAlign: 'center', flex: 1, minWidth: 120 }}>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 700,
          color: 'var(--clr-text-white)', letterSpacing: -1, lineHeight: 1, marginBottom: 4,
        }}>
          99.9<span style={{ color: 'var(--clr-amber)', fontSize: '0.6em', fontWeight: 700 }}>%</span>
        </div>
        <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '1.8px', color: 'var(--clr-text-muted)', marginTop: 8, fontWeight: 600 }}>Uptime SLA</div>
        <div style={{ fontSize: 9, color: 'var(--clr-amber)', marginTop: 4, opacity: 0.7 }}>guaranteed</div>
      </div>
    </div>
  );
}



export default function Landing() {
  const { login } = usePrivy();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [liveStats, setLiveStats] = useState({ users: 0, transactions: 0, volumeTraded: 0, depositsInr: 0 });
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/stats`);
        const data = await res.json();
        if (data.success) {
          setLiveStats({ 
            users: data.users, 
            transactions: data.transactions, 
            volumeTraded: data.volumeTraded || 0,
            depositsInr: data.depositsInr || 0,
          });
          setStatsLoaded(true);
        }
      } catch (e) {
        console.warn('Stats fetch failed', e);
        setStatsLoaded(true);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async () => {
    try { await login(); } catch (err) { console.error('Login error:', err); }
  };
  const handleSignUp = async () => {
    try { await login(); } catch (err) { console.error('SignUp error:', err); }
  };
  const goToLedger = () => navigate('/ledger');

  return (
    <div className="web3-bg" style={{ minHeight: '100vh', overflowX: 'hidden' }}>

      {/* Purple ambient glow */}
      <div className="bg-glow-purple" />

      {/* ════════════════════════════════
          NAV
      ════════════════════════════════ */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: scrolled ? '14px 40px' : '24px 40px',
        background: scrolled 
          ? (isDark ? 'rgba(3,8,18,0.90)' : 'rgba(240,244,255,0.90)')
          : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--clr-border)' : '1px solid transparent',
        transition: 'var(--transition-slow)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8,
            border: '1.5px solid var(--clr-border-strong)',
            background: 'var(--clr-accent-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="7" rx="1.5"
                stroke="var(--clr-accent)" strokeWidth="1.2"/>
              <path d="M5 7V5a3 3 0 0 1 6 0v2"
                stroke="var(--clr-accent)" strokeWidth="1.2" strokeLinecap="round"/>
              <circle cx="8" cy="10.5" r="1" fill="var(--clr-accent)"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 17, fontWeight: 700, letterSpacing: 4, color: 'var(--clr-text-white)', whiteSpace: 'nowrap' }}>
            D-<span style={{ color: 'var(--clr-accent)' }}>CRYPT</span>
          </span>
        </div>

        {/* Desktop nav links */}
        <div className="nav-desktop" style={{ display: 'flex', gap: 36 }}>
          {['Features', 'How It Works', 'Ledger', 'Docs'].map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, '-')}`} style={{
              color: 'var(--clr-text-secondary)', fontSize: 13, fontWeight: 500,
              textDecoration: 'none', letterSpacing: 0.5,
              transition: 'var(--transition-fast)',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--clr-text-primary)'}
            onMouseLeave={e => e.target.style.color = 'var(--clr-text-secondary)'}
            >{l}</a>
          ))}
        </div>

        {/* CTA + Hamburger */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ThemeToggle />
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogin}
            style={{ fontSize: 13, padding: '7px 16px' }}
          >
            Log In
          </button>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleSignUp}
            style={{ fontSize: 13, padding: '7px 18px' }}
          >
            Sign Up →
          </button>
        </div>
      </nav>

      {/* ════════════════════════════════
          HERO
      ════════════════════════════════ */}
      <section className="web3-content landing-hero" style={{
        minHeight: '100vh',
        display: 'flex', alignItems: 'center',
        padding: '120px 60px 80px',
        gap: 60,
      }}>
        {/* Left copy */}
        <div className="animate-fade-in" style={{ flex: 1, maxWidth: 560 }}>

          {/* Badge */}
          <div className="badge badge-accent" style={{ marginBottom: 28 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--clr-accent)',
              display: 'inline-block',
              animation: 'dc-pulse 2s ease-in-out infinite',
            }}/>
            Web3 × Fiat Protocol
          </div>

          {/* Headline */}
          <h1 style={{
            fontSize: 'clamp(38px, 5vw, 64px)',
            fontWeight: 700,
            lineHeight: 1.07,
            letterSpacing: '-2px',
            color: 'var(--clr-text-white)',
            marginBottom: 24,
          }}>
            Pay Crypto.<br />
            <span style={{ color: 'var(--clr-accent)' }}>Spend INR.</span><br />
            <span style={{ color: 'var(--clr-text-muted)' }}>Own Everything.</span>
          </h1>

          {/* Subtext */}
          <p style={{
            fontSize: 16, fontWeight: 300,
            color: 'var(--clr-text-secondary)',
            lineHeight: 1.8, marginBottom: 44,
            maxWidth: 440,
          }}>
            D-CRYPT lets you send crypto globally using your INR balance as fuel —
            no gas tokens, no complexity. Deposit via UPI, transfer via @username,
            track everything on a public ledger.
          </p>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 48 }}>
            <button className="btn btn-primary btn-lg" onClick={handleLogin}>
              Enter the Vault
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>
            <button className="btn btn-secondary btn-lg">
              Watch Demo
            </button>
          </div>

          {/* Trust row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ display: 'flex' }}>
              {['0x', 'A3', 'E7', '9F'].map((t, i) => (
                <div key={i} style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'var(--clr-bg-surface)',
                  border: '2px solid var(--clr-bg-base)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                  color: 'var(--clr-text-secondary)',
                  marginLeft: i === 0 ? 0 : -8,
                }}>{t}</div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>
              <span style={{ color: 'var(--clr-text-secondary)', fontWeight: 600 }}>
                {statsLoaded && liveStats.users > 0 ? `${liveStats.users.toLocaleString()}+ users` : '4,200+ wallets'}
              </span>{' '}already secured
            </p>
            <div className="badge-live" style={{ marginLeft: 8 }}>
              Live on Sepolia
            </div>
          </div>
        </div>

        {/* Right: animated vault */}
        <div style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <VaultGraphic />
        </div>
      </section>

      {/* ════════════════════════════════
          LIVE STATS BAR
      ════════════════════════════════ */}
      <LiveStatsBar liveStats={liveStats} statsLoaded={statsLoaded} />

      {/* ════════════════════════════════
          FEATURES
      ════════════════════════════════ */}
      <section id="features" className="web3-content" style={{ padding: '100px 60px' }}>

        {/* Section header */}
        <div style={{ marginBottom: 60, maxWidth: 480 }}>
          <div className="section-tag"><span>What We Offer</span></div>
          <h2 style={{
            fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 700,
            color: 'var(--clr-text-white)', letterSpacing: -0.5,
            lineHeight: 1.15, marginBottom: 14,
          }}>
            The Full Stack<br />of Web3 Finance
          </h2>
          <p style={{ fontSize: 15, color: 'var(--clr-text-secondary)', lineHeight: 1.75 }}>
            Every feature is designed to remove friction between your INR and the decentralized world.
          </p>
        </div>

        {/* Feature grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 20,
        }}>
          {FEATURES.map((f, i) => (
            <div key={i} className="card card-hover" style={{ padding: 28 }}>
              {/* Icon box */}
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-md)',
                background: f.colorDim,
                border: `1px solid ${f.colorBorder}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, marginBottom: 18,
                transition: 'var(--transition-med)',
              }}>
                {f.icon}
              </div>
              <h3 style={{
                fontSize: 16, fontWeight: 600,
                color: 'var(--clr-text-white)', marginBottom: 10,
              }}>{f.title}</h3>
              <p style={{
                fontSize: 13.5, color: 'var(--clr-text-secondary)', lineHeight: 1.7,
              }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ════════════════════════════════
          HOW IT WORKS
      ════════════════════════════════ */}
      <section id="how-it-works" className="web3-content" style={{ padding: '0 60px 100px' }}>

        <div style={{ marginBottom: 60 }}>
          <div className="section-tag"><span>Process</span></div>
          <h2 style={{
            fontSize: 'clamp(28px, 3.5vw, 42px)', fontWeight: 700,
            color: 'var(--clr-text-white)', letterSpacing: -0.5, lineHeight: 1.15,
          }}>
            Up and Running<br />in 3 Steps
          </h2>
        </div>

        <div className="landing-steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, position: 'relative' }}>
          {/* Connector line between steps */}
          <div className="landing-steps-connector" style={{
            position: 'absolute', top: 34,
            left: 'calc(16.67%)', right: 'calc(16.67%)',
            height: 1,
            background: 'linear-gradient(90deg, var(--clr-accent-glow), var(--clr-purple-border), var(--clr-accent-glow))',
          }} />

          {STEPS.map((s, i) => (
            <div key={i} style={{ textAlign: 'center', padding: '0 32px 40px', position: 'relative', zIndex: 1 }}>
              {/* Step number circle */}
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                background: 'var(--clr-bg-base)',
                border: '1px solid var(--clr-border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 24px',
                fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
                color: 'var(--clr-accent)',
                transition: 'var(--transition-med)',
                cursor: 'default',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--clr-accent-dim)';
                e.currentTarget.style.boxShadow = 'var(--shadow-accent)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--clr-bg-base)';
                e.currentTarget.style.boxShadow = 'none';
              }}
              >{s.n}</div>
              <h3 style={{
                fontSize: 17, fontWeight: 600,
                color: 'var(--clr-text-white)', marginBottom: 10,
              }}>{s.title}</h3>
              <p style={{
                fontSize: 13.5, color: 'var(--clr-text-secondary)', lineHeight: 1.7,
              }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="web3-content" style={{ padding: '0 60px 100px' }}>
        <div className="card-accent" style={{ padding: '52px 56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 40, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: 22, fontWeight: 700, color: 'var(--clr-text-white)', marginBottom: 10 }}>
              Trustless by Design. Secure by Default.
            </h3>
            <p style={{ fontSize: 14, color: 'var(--clr-text-secondary)', maxWidth: 480, lineHeight: 1.75 }}>
              D-CRYPT's non-custodial architecture means <strong style={{ color: 'var(--clr-text-primary)' }}>only you</strong> hold your keys.
              Your wallet, your assets — we use embedded wallet technology with zero-knowledge principles
              so no third party, including us, can access your vault.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', flexShrink: 0 }}>
            {['Non-Custodial', 'Zero-Knowledge', 'Sepolia Testnet', 'Open Source'].map((b) => (
              <span key={b} className="badge badge-accent">{b}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ════════════════════════════════
          FINAL CTA
      ════════════════════════════════ */}
      <div className="web3-content" style={{ padding: '0 60px 100px', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          background: 'var(--clr-bg-card)',
          border: '1px solid var(--clr-border)',
          borderRadius: 'var(--radius-xl)',
          padding: '80px 60px',
          textAlign: 'center',
          maxWidth: 720, width: '100%',
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Background glow */}
          <div style={{
            position: 'absolute', top: -150, left: '50%',
            transform: 'translateX(-50%)',
            width: 400, height: 400,
            background: 'radial-gradient(circle, var(--clr-accent-dim) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <h2 style={{
            fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 700,
            color: 'var(--clr-text-white)', marginBottom: 16,
            letterSpacing: -0.5, position: 'relative',
          }}>
            Ready to Enter<br />the Vault?
          </h2>
          <p style={{
            fontSize: 16, color: 'var(--clr-text-secondary)',
            marginBottom: 44, lineHeight: 1.7, position: 'relative',
          }}>
            Join the future of decentralized finance. Your first transaction takes under 2 minutes.
          </p>
          <div style={{
            display: 'flex', gap: 14,
            justifyContent: 'center', flexWrap: 'wrap',
            position: 'relative',
          }}>
            <button className="btn btn-primary btn-lg" onClick={handleSignUp}>
              Create Account →
            </button>
            <button className="btn btn-secondary btn-lg" onClick={goToLedger}>
              🔍 Explore Ledger
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--clr-text-muted)', marginTop: 20, position: 'relative' }}>
            Already have an account?{' '}
            <span
              onClick={handleLogin}
              style={{ color: 'var(--clr-accent)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Log in here
            </span>
          </p>
        </div>
      </div>

      {/* ════════════════════════════════
          FOOTER
      ════════════════════════════════ */}
      <footer className="web3-content landing-footer-grid" style={{
        borderTop: '1px solid var(--clr-border)',
        padding: '60px 60px 40px',
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr',
        gap: 40,
      }}>
        {/* Brand col */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 7,
              border: '1px solid var(--clr-border-accent)',
              background: 'var(--clr-accent-dim)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="var(--clr-accent)" strokeWidth="1.2"/>
                <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="var(--clr-accent)" strokeWidth="1.2" strokeLinecap="round"/>
                <circle cx="8" cy="10.5" r="1" fill="var(--clr-accent)"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, letterSpacing: 3, color: 'var(--clr-text-white)' }}>
              D-<span style={{ color: 'var(--clr-accent)' }}>CRYPT</span>
            </span>
          </div>
          <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', lineHeight: 1.75, maxWidth: 230, marginBottom: 20 }}>
            A decentralized fiat-to-crypto bridge built for the next billion Web3 users. Send globally, pay locally.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clr-emerald)', display: 'inline-block', animation: 'dc-pulse 2s ease-in-out infinite' }} />
            <span style={{ fontSize: 11, color: 'var(--clr-emerald)', fontFamily: 'var(--font-mono)' }}>Live on Sepolia Testnet</span>
          </div>
        </div>

        {/* Product */}
        <div>
          <h4 style={{ fontSize: 11, color: 'var(--clr-accent)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 18 }}>Product</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              { label: 'Dashboard', href: '/dashboard' },
              { label: 'Public Ledger', href: '/ledger' },
              { label: 'Send Crypto', href: '/dashboard/send' },
              { label: 'Swap', href: '/dashboard/swap' },
            ].map((item) => (
              <li key={item.label}>
                <a href={item.href} style={{ fontSize: 13, color: 'var(--clr-text-muted)', textDecoration: 'none', transition: 'var(--transition-fast)' }}
                  onMouseEnter={e => e.target.style.color = 'var(--clr-accent)'}
                  onMouseLeave={e => e.target.style.color = 'var(--clr-text-muted)'}
                >{item.label}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Legal */}
        <div>
          <h4 style={{ fontSize: 11, color: 'var(--clr-accent)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 18 }}>Legal & Docs</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
            {[
              { label: 'Documentation', href: '#docs' },
              { label: 'Privacy Policy', href: '#privacy' },
              { label: 'Terms of Service', href: '#terms' },
              { label: 'Security Audit', href: '#audit' },
            ].map((item) => (
              <li key={item.label}>
                <a href={item.href} style={{ fontSize: 13, color: 'var(--clr-text-muted)', textDecoration: 'none', transition: 'var(--transition-fast)' }}
                  onMouseEnter={e => e.target.style.color = 'var(--clr-accent)'}
                  onMouseLeave={e => e.target.style.color = 'var(--clr-text-muted)'}
                >{item.label}</a>
              </li>
            ))}
          </ul>
        </div>

        {/* Company */}
        <div>
          <h4 style={{ fontSize: 11, color: 'var(--clr-accent)', textTransform: 'uppercase', letterSpacing: 2, fontWeight: 600, marginBottom: 18 }}>Company</h4>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 11 }}>
            <li>
              <a href="#about" style={{ fontSize: 13, color: 'var(--clr-text-muted)', textDecoration: 'none', transition: 'var(--transition-fast)' }}
                onMouseEnter={e => e.target.style.color = 'var(--clr-accent)'}
                onMouseLeave={e => e.target.style.color = 'var(--clr-text-muted)'}
              >About D-CRYPT</a>
            </li>
            <li>
              <a href="mailto:humandyt@gmail.com" style={{ fontSize: 13, color: 'var(--clr-text-muted)', textDecoration: 'none', transition: 'var(--transition-fast)', display: 'flex', alignItems: 'center', gap: 5 }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--clr-accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 7L2 7"/></svg>
                humandyt@gmail.com
              </a>
            </li>
            <li>
              <a href="#" style={{ fontSize: 13, color: 'var(--clr-text-muted)', textDecoration: 'none', transition: 'var(--transition-fast)' }}
                onMouseEnter={e => e.target.style.color = 'var(--clr-accent)'}
                onMouseLeave={e => e.target.style.color = 'var(--clr-text-muted)'}
              >GitHub</a>
            </li>
          </ul>
        </div>
      </footer>

      {/* Footer bottom bar */}
      <div className="web3-content" style={{
        borderTop: '1px solid var(--clr-border)',
        padding: '18px 60px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 12,
      }}>
        <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>
          © 2026 <span style={{ color: 'var(--clr-accent)' }}>D-CRYPT</span> Protocol — Built with ❤️ by DYT
        </p>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          {['Privacy Policy', 'Terms', 'Docs'].map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g,'-')}`} style={{
              fontSize: 12, color: 'var(--clr-text-muted)',
              textDecoration: 'none', transition: 'var(--transition-fast)',
            }}
            onMouseEnter={e => e.target.style.color = 'var(--clr-text-secondary)'}
            onMouseLeave={e => e.target.style.color = 'var(--clr-text-muted)'}
            >{l}</a>
          ))}
          <a href="mailto:humandyt@gmail.com" style={{
            fontSize: 12, color: 'var(--clr-accent)',
            textDecoration: 'none',
          }}>Contact</a>
        </div>
      </div>

    </div>
  );
}