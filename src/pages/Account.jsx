import { useState, useEffect } from 'react';
import { usePrivy, useMfaEnrollment } from '@privy-io/react-auth';
import { useNavigate }         from 'react-router-dom';
import { supabase }            from '../supabase';

/* ═══════════════════════════════════════════════════════
   Account.jsx — Profile, Security & Wallet Settings

   Sections:
   ┌─────────────────────┬──────────────────────────────┐
   │  LEFT               │  RIGHT                       │
   │  Profile card       │  Security settings           │
   │  Linked accounts    │  Reveal Private Key (gated)  │
   │  Wallet info        │  Danger Zone                 │
   └─────────────────────┴──────────────────────────────┘
═══════════════════════════════════════════════════════ */

/* ── Reusable section wrapper ── */
function Section({ title, subtitle, icon, children, style = {} }) {
  return (
    <div className="card" style={{ padding: 24, ...style }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 12, marginBottom: 20,
        paddingBottom: 16,
        borderBottom: '1px solid var(--clr-border)',
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 'var(--radius-md)',
          background: 'var(--clr-accent-dim)',
          border: '1px solid var(--clr-border-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--clr-accent)', flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <h3 style={{
            fontSize: 15, fontWeight: 600,
            color: 'var(--clr-text-white)', marginBottom: 2,
          }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Info row (label + value + optional copy) ── */
function InfoRow({ label, value, mono = false, copyable = false, badge }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between',
      alignItems: 'center', padding: '11px 0',
      borderBottom: '1px solid var(--clr-border)',
    }}>
      <span style={{
        fontSize: 12, color: 'var(--clr-text-muted)',
        fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.8px', flexShrink: 0, marginRight: 16,
      }}>
        {label}
      </span>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        minWidth: 0, flex: 1, justifyContent: 'flex-end',
      }}>
        {badge && (
          <span className={`badge ${badge}`} style={{ fontSize: 10 }}>
            {badge.includes('emerald') ? 'Verified' : 'Pending'}
          </span>
        )}
        <span style={{
          fontSize: 13, fontWeight: 500,
          fontFamily: mono ? 'var(--font-mono)' : undefined,
          color: 'var(--clr-text-secondary)',
          overflow: 'hidden', textOverflow: 'ellipsis',
          whiteSpace: 'nowrap', maxWidth: 260,
        }}>
          {value || '—'}
        </span>
        {copyable && value && (
          <button
            onClick={handleCopy}
            title={copied ? 'Copied!' : 'Copy to clipboard'}
            style={{
              flexShrink: 0, width: 26, height: 26,
              borderRadius: 'var(--radius-sm)',
              background: copied ? 'var(--clr-emerald-dim)' : 'var(--clr-bg-card)',
              border: `1px solid ${copied ? 'var(--clr-emerald-border)' : 'var(--clr-border)'}`,
              color: copied ? 'var(--clr-text-emerald)' : 'var(--clr-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', transition: 'var(--transition-fast)',
              fontSize: 12,
            }}
          >
            {copied ? '✓' : '⎘'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   REVEAL PRIVATE KEY
   Gated by MFA: if no 2FA enrolled, export is blocked.
   If 2FA enrolled, Privy auto-prompts MFA on exportWallet().
═══════════════════════════════════════════════════════ */
function RevealKeySection({ exportWallet, hasMfa }) {
  const [step,        setStep]        = useState('locked');
  const [inputPhrase, setInputPhrase] = useState('');
  const [error,       setError]       = useState('');
  const CONFIRM_PHRASE = 'I understand';

  // ─ If no MFA enrolled, block export entirely ─
  if (!hasMfa) {
    return (
      <div style={{
        background: 'rgba(245,158,11,0.05)',
        border: '1px solid rgba(245,158,11,0.3)',
        borderRadius: 'var(--radius-md)',
        padding: '18px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 14,
      }}>
        <span style={{ fontSize: 22, flexShrink: 0 }}>🔒</span>
        <div>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text-amber)', marginBottom: 4 }}>
            2FA Required to Export
          </p>
          <p style={{ fontSize: 12, color: 'var(--clr-text-muted)', lineHeight: 1.6 }}>
            You must set up at least one 2-Factor Authentication method (Passkey or
            Authenticator App) before you can export your private key.
            This protects your wallet from unauthorized access.
          </p>
          <p style={{ fontSize: 11, color: 'var(--clr-text-amber)', marginTop: 8, fontWeight: 500 }}>
            ↑ Configure 2FA in the section above to unlock this feature.
          </p>
        </div>
      </div>
    );
  }

  const handleConfirm = async () => {
    if (inputPhrase.trim().toLowerCase() !== CONFIRM_PHRASE.toLowerCase()) {
      setError(`Type exactly: "${CONFIRM_PHRASE}"`);
      return;
    }
    setError('');
    setStep('exporting');
    try {
      // Privy auto-prompts MFA (passkey or TOTP) before showing the key
      await exportWallet();
      setStep('locked');
      setInputPhrase('');
    } catch (e) {
      setStep('warning');
      setError('Export cancelled or failed. Try again.');
    }
  };

  if (step === 'locked') {
    return (
      <div style={{
        background: 'rgba(239,68,68,0.03)',
        border: '1px solid var(--clr-border-danger)',
        borderRadius: 'var(--radius-md)',
        padding: '18px 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'var(--clr-red-dim)', border: '1px solid var(--clr-border-danger)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--clr-text-red)', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text-white)', marginBottom: 2 }}>Private Key Export</p>
            <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', lineHeight: 1.5 }}>
              Your 2FA will be verified before the key is shown.
            </p>
          </div>
        </div>
        {['‼ Never share your private key with anyone',
          '‼ Anyone with this key has full control of your funds',
          '‼ D-CRYPT support will NEVER ask for your key',
        ].map((w, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, marginBottom: i < 2 ? 6 : 14 }}>
            <span style={{ color: 'var(--clr-text-red)', fontSize: 11, flexShrink: 0 }}>⚠</span>
            <p style={{ fontSize: 11, color: 'var(--clr-text-secondary)', lineHeight: 1.5 }}>{w}</p>
          </div>
        ))}
        <button onClick={() => setStep('warning')} className="btn btn-danger btn-full" style={{ fontSize: 13 }}>
          I Understand the Risks — Reveal Key
        </button>
      </div>
    );
  }

  if (step === 'warning') {
    return (
      <div className="animate-scale-in" style={{
        background: 'rgba(239,68,68,0.05)',
        border: '1px solid var(--clr-border-danger)',
        borderRadius: 'var(--radius-md)', padding: '20px',
      }}>
        <div style={{
          background: 'var(--clr-red-dim)', border: '1px solid var(--clr-border-danger)',
          borderRadius: 'var(--radius-sm)', padding: '10px 14px',
          marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--clr-text-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--clr-text-red)' }}>
            This action exposes your private key.
          </p>
        </div>
        <div className="input-group" style={{ marginBottom: 14 }}>
          <label className="input-label">
            Type <span style={{ color: 'var(--clr-text-white)', fontFamily: 'var(--font-mono)' }}>"I understand"</span> to continue
          </label>
          <input type="text" placeholder="I understand" value={inputPhrase}
            onChange={(e) => { setInputPhrase(e.target.value); setError(''); }}
            className="input" style={{ borderColor: error ? 'var(--clr-border-danger)' : undefined }}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()} autoFocus
          />
          {error && <p style={{ fontSize: 11, color: 'var(--clr-text-red)', marginTop: 6 }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => { setStep('locked'); setInputPhrase(''); setError(''); }}
            className="btn btn-secondary" style={{ flex: 1, fontSize: 13 }}>Cancel</button>
          <button onClick={handleConfirm} disabled={step === 'exporting'}
            className="btn btn-danger" style={{ flex: 1, fontSize: 13 }}>
            {step === 'exporting' ? 'Verifying MFA…' : 'Export Private Key'}
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/* ═══════════════════════════════════════════════════════
   MFA ENROLLMENT SECTION
   Unified UI using Privy's standard modal.
═══════════════════════════════════════════════════════ */
function MfaSection() {
  const { user } = usePrivy();
  const {
    showMfaEnrollmentModal,
    unenrollWithTotp,
    unenrollWithPasskey,
  } = useMfaEnrollment();

  const hasPasskey = user?.mfaMethods?.includes('passkey') || false;
  const hasTotp    = user?.mfaMethods?.includes('totp') || false;

  const [pkRemoving, setPkRemoving] = useState(false);
  const [totpRemoving, setTotpRemoving] = useState(false);

  const handlePasskeyRemove = async () => {
    setPkRemoving(true);
    try { await unenrollWithPasskey(); } catch {}
    setPkRemoving(false);
  };

  const handleTotpRemove = async () => {
    setTotpRemoving(true);
    try { await unenrollWithTotp(); } catch {}
    setTotpRemoving(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      
      {/* Status indicators */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        
        {/* Passkey Row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: hasPasskey ? 'rgba(0,229,255,0.04)' : 'var(--clr-bg-card)',
          padding: '14px 16px', borderRadius: 'var(--radius-md)',
          border: `1px solid ${hasPasskey ? 'var(--clr-border-accent)' : 'var(--clr-border)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>🔑</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text-white)', marginBottom: 2 }}>Passkey</p>
              <p style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
                {hasPasskey ? 'Active — Touch ID, Face ID, PIN' : 'Not set up'}
              </p>
            </div>
          </div>
          {hasPasskey && (
            <button onClick={handlePasskeyRemove} disabled={pkRemoving} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
              {pkRemoving ? '...' : 'Remove'}
            </button>
          )}
        </div>

        {/* Authenticator Row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: hasTotp ? 'rgba(16,185,129,0.04)' : 'var(--clr-bg-card)',
          padding: '14px 16px', borderRadius: 'var(--radius-md)',
          border: `1px solid ${hasTotp ? 'var(--clr-emerald-border)' : 'var(--clr-border)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>📱</span>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text-white)', marginBottom: 2 }}>Authenticator App</p>
              <p style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
                {hasTotp ? 'Active — Google Authenticator, Authy' : 'Not set up'}
              </p>
            </div>
          </div>
          {hasTotp && (
            <button onClick={handleTotpRemove} disabled={totpRemoving} className="btn btn-secondary btn-sm" style={{ fontSize: 11 }}>
              {totpRemoving ? '...' : 'Remove'}
            </button>
          )}
        </div>

      </div>

      {/* Unified Action Button */}
      <button onClick={() => showMfaEnrollmentModal()} className="btn btn-full" style={{
        background: 'var(--clr-accent-dim)',
        border: '1px solid var(--clr-border-accent)',
        color: 'var(--clr-accent)', fontSize: 14, fontWeight: 600, padding: '14px 0',
        marginTop: 4,
      }}>
        {hasPasskey || hasTotp ? 'Manage Verification Methods' : '＋ Set Up Two-Factor Authentication'}
      </button>

      {/* Info note */}
      <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', lineHeight: 1.6, padding: '0 4px', textAlign: 'center', marginTop: 4 }}>
        🔒 An enrolled MFA method is required to export your private key. Passkeys can also be used for passwordless login.
      </p>

    </div>
  );
}

export default function Account() {
  const { user, logout, exportWallet } = usePrivy();
  const navigate = useNavigate();

  const [profile,      setProfile]      = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [editUsername, setEditUsername] = useState(false);
  const [newUsername,  setNewUsername]  = useState('');
  const [saveStatus,   setSaveStatus]   = useState('idle'); // idle | saving | saved | error

  const walletAddress = user?.wallet?.address || '';
  const userEmail     = user?.email?.address  || user?.google?.email || '';

  /* ── Load profile ── */
  useEffect(() => {
    if (!walletAddress) return;
    loadProfile();
  }, [walletAddress]);

  const loadProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('wallet_address', walletAddress)
      .single();
    if (data) {
      setProfile(data);
      setNewUsername(data.username || '');
    }
    setLoading(false);
  };

  /* ── Save username ── */
  const saveUsername = async () => {
    if (!newUsername || newUsername === profile?.username) {
      setEditUsername(false);
      return;
    }
    setSaveStatus('saving');
    const { error } = await supabase
      .from('users')
      .update({ username: newUsername })
      .eq('wallet_address', walletAddress);

    if (error) {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } else {
      setProfile(p => ({ ...p, username: newUsername }));
      setSaveStatus('saved');
      setEditUsername(false);
      setTimeout(() => setSaveStatus('idle'), 2500);
    }
  };

  /* ── Logout handler ── */
  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  /* ── Avatar initials ── */
  const initials = profile?.username
    ? profile.username.slice(0, 2).toUpperCase()
    : walletAddress.slice(2, 4).toUpperCase();

  /* ── Loading skeleton ── */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {[120, 200, 160].map((h, i) => (
          <div key={i} className="shimmer"
            style={{ height: h, borderRadius: 'var(--radius-lg)' }}/>
        ))}
      </div>
    );
  }

  /* ════════════════════════════════
     RENDER
  ════════════════════════════════ */
  return (
    <div className="animate-fade-in">

      {/* ── Page heading ── */}
      <div style={{ marginBottom: 28 }}>
        <h2 style={{
          fontSize: 22, fontWeight: 700, letterSpacing: -0.3,
          color: 'var(--clr-text-white)', marginBottom: 4,
        }}>
          Account Settings
        </h2>
        <p style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>
          Manage your profile, linked accounts, and wallet security.
        </p>
      </div>

      {/* ── Two column layout: left wider, right fixed ── */}
      <div className="account-grid" style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 360px',
        gap: 20, alignItems: 'start',
      }}>

        {/* ════════════════════════
            LEFT COLUMN
        ════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Profile Card ── */}
          <Section
            title="Profile"
            subtitle="Your public identity on D-CRYPT"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            }
          >
            {/* Avatar + username row */}
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 16, marginBottom: 20,
            }}>
              {/* Avatar */}
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--clr-accent-dim), var(--clr-purple-dim))',
                border: '2px solid var(--clr-border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700,
                color: 'var(--clr-accent)', flexShrink: 0,
              }}>
                {initials}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Username display / edit */}
                {editUsername ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                      <span style={{
                        position: 'absolute', left: 12, top: '50%',
                        transform: 'translateY(-50%)',
                        fontFamily: 'var(--font-mono)', fontSize: 14,
                        fontWeight: 700, color: 'var(--clr-accent)',
                        pointerEvents: 'none',
                      }}>@</span>
                      <input
                        type="text"
                        value={newUsername}
                        onChange={(e) => setNewUsername(
                          e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')
                        )}
                        className="input input-mono"
                        style={{ paddingLeft: 28, height: 38, fontSize: 14 }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter')  saveUsername();
                          if (e.key === 'Escape') setEditUsername(false);
                        }}
                        autoFocus
                      />
                    </div>
                    <button
                      onClick={saveUsername}
                      className="btn btn-emerald btn-sm"
                      disabled={saveStatus === 'saving'}
                    >
                      {saveStatus === 'saving' ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditUsername(false)}
                      className="btn btn-secondary btn-sm"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <p style={{
                      fontFamily: 'var(--font-mono)', fontSize: 18,
                      fontWeight: 700, color: 'var(--clr-text-white)',
                    }}>
                      @{profile?.username || '—'}
                    </p>
                    <button
                      onClick={() => setEditUsername(true)}
                      style={{
                        background: 'none', border: 'none',
                        color: 'var(--clr-text-muted)',
                        cursor: 'pointer', padding: '2px 6px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 12, transition: 'var(--transition-fast)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--clr-accent)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--clr-text-muted)'}
                      title="Edit username"
                    >
                      ✎ Edit
                    </button>
                  </div>
                )}

                {/* Save status message */}
                {saveStatus === 'saved' && (
                  <p className="animate-fade-in" style={{
                    fontSize: 11, color: 'var(--clr-text-emerald)', marginTop: 4,
                  }}>
                    ✓ Username updated
                  </p>
                )}
                {saveStatus === 'error' && (
                  <p className="animate-fade-in" style={{
                    fontSize: 11, color: 'var(--clr-text-red)', marginTop: 4,
                  }}>
                    ✗ Username already taken
                  </p>
                )}

                <p style={{
                  fontSize: 12, color: 'var(--clr-text-muted)', marginTop: 4,
                }}>
                  UPI ID: <span style={{
                    fontFamily: 'var(--font-mono)', color: 'var(--clr-text-secondary)',
                  }}>
                    {profile?.username}@d-crypt
                  </span>
                </p>
              </div>
            </div>

            {/* Profile info rows */}
            <InfoRow label="Email"       value={userEmail || 'Not linked'}    badge={userEmail ? 'badge-emerald' : undefined} />
            <InfoRow label="Member Since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'} />
            <InfoRow label="INR Balance"  value={`₹${Number(profile?.inr_balance || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`} mono />
          </Section>

          {/* ── Linked Accounts ── */}
          <Section
            title="Linked Accounts"
            subtitle="Authentication methods connected to your vault"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
            }
          >
            {/* Wallet row */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
              borderBottom: '1px solid var(--clr-border)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 'var(--radius-sm)',
                  background: 'var(--clr-accent-dim)',
                  border: '1px solid var(--clr-border-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--clr-accent)', flexShrink: 0,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                    <circle cx="12" cy="12" r="2"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text-white)', marginBottom: 2 }}>
                    Non-Custodial Vault
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--clr-text-muted)',
                  }}>
                    {walletAddress ? `${walletAddress.slice(0, 10)}...${walletAddress.slice(-6)}` : '—'}
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-emerald" style={{ fontSize: 10 }}>Connected</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(walletAddress); }}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: 11 }}
                  title="Copy full address"
                >
                  Copy Address
                </button>
              </div>
            </div>

            {/* Email row */}
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 0',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 'var(--radius-sm)',
                  background: 'var(--clr-purple-dim)',
                  border: '1px solid var(--clr-purple-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--clr-purple)', flexShrink: 0,
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                    <polyline points="22,6 12,13 2,6"/>
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text-white)', marginBottom: 2 }}>
                    Email / Google
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
                    {userEmail || 'Not linked'}
                  </p>
                </div>
              </div>
              <span className={`badge ${userEmail ? 'badge-emerald' : 'badge-amber'}`} style={{ fontSize: 10 }}>
                {userEmail ? 'Linked' : 'Not linked'}
              </span>
            </div>
          </Section>

          {/* ── Wallet Address Full ── */}
          <Section
            title="Wallet Address"
            subtitle="Your full on-chain identity on Sepolia"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="5" width="20" height="14" rx="2"/>
                <line x1="2" y1="10" x2="22" y2="10"/>
              </svg>
            }
          >
            {/* Full address display */}
            <div style={{
              background: 'var(--clr-bg-card)',
              border: '1px solid var(--clr-border)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 16px',
              marginBottom: 14,
              wordBreak: 'break-all',
              fontFamily: 'var(--font-mono)', fontSize: 12,
              color: 'var(--clr-text-secondary)', lineHeight: 1.7,
            }}>
              {walletAddress || '—'}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => navigator.clipboard.writeText(walletAddress)}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                Copy Address
              </button>
              <a
                href={`https://sepolia.etherscan.io/address/${walletAddress}`}
                target="_blank" rel="noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ flex: 1, textDecoration: 'none' }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
                View on Etherscan
              </a>
            </div>
          </Section>

          {/* ── Reveal Private Key ── */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              gap: 12, marginBottom: 20,
              paddingBottom: 16,
              borderBottom: '1px solid var(--clr-border-danger)',
            }}>
              <div style={{
                width: 34, height: 34, borderRadius: 'var(--radius-md)',
                background: 'var(--clr-red-dim)',
                border: '1px solid var(--clr-border-danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--clr-text-red)', flexShrink: 0,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
              </div>
              <div>
                <h3 style={{
                  fontSize: 15, fontWeight: 600,
                  color: 'var(--clr-text-red)', marginBottom: 2,
                }}>
                  Private Key
                </h3>
                <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>
                  Export for external wallet import
                </p>
              </div>
            </div>

            <RevealKeySection exportWallet={exportWallet} hasMfa={user?.mfaMethods?.length > 0} />
          </div>

          {/* ── Danger Zone ── */}
          <div className="card" style={{
            padding: 24,
            borderColor: 'var(--clr-border-danger)',
            background: 'rgba(239,68,68,0.02)',
          }}>
            <p style={{
              fontSize: 11, fontWeight: 700,
              color: 'var(--clr-text-red)',
              textTransform: 'uppercase', letterSpacing: '1.5px',
              marginBottom: 16,
            }}>
              ⚠ Danger Zone
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Sign out */}
              <button
                onClick={handleLogout}
                className="btn btn-full"
                style={{
                  background: 'var(--clr-red-dim)',
                  border: '1px solid var(--clr-border-danger)',
                  color: 'var(--clr-text-red)',
                  fontSize: 13, fontWeight: 600,
                  padding: '11px',
                  justifyContent: 'flex-start', gap: 10,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                  <polyline points="16 17 21 12 16 7"/>
                  <line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Sign Out of D-CRYPT
              </button>
            </div>

            <p style={{
              fontSize: 11, color: 'var(--clr-text-muted)',
              marginTop: 12, lineHeight: 1.6,
            }}>
              Signing out does not delete your vault. Your wallet and balance are preserved.
              You can return any time by reconnecting.
            </p>
          </div>

        </div>

        {/* ════════════════════════
            RIGHT COLUMN
        ════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Security overview ── */}
          <Section
            title="Security"
            subtitle="Wallet and account protection status"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            }
          >
            {[
              { label: 'Wallet Secured',    status: true,              detail: 'Embedded, non-custodial'                         },
              { label: 'Email Linked',      status: !!userEmail,       detail: userEmail || 'Not set'                            },
              { label: 'Passkey MFA',       status: user?.mfaMethods?.includes('passkey'), detail: user?.mfaMethods?.includes('passkey') ? 'Enrolled ✓' : 'Not set — configure below' },
              { label: 'Authenticator MFA', status: user?.mfaMethods?.includes('totp'),   detail: user?.mfaMethods?.includes('totp')   ? 'Enrolled ✓' : 'Not set — configure below' },
              { label: 'Network',           status: true,              detail: 'Sepolia Testnet'                                 },
              { label: 'Non-Custodial',     status: true,              detail: 'You own your keys'                               },
            ].map((item) => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: '1px solid var(--clr-border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontSize: 13,
                    color: item.status ? 'var(--clr-text-emerald)' : 'var(--clr-text-amber)',
                  }}>
                    {item.status ? '✓' : '⚠'}
                  </span>
                  <div>
                    <p style={{ fontSize: 13, color: 'var(--clr-text-primary)', fontWeight: 500 }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
                      {item.detail}
                    </p>
                  </div>
                </div>
                <span className={`badge ${item.status ? 'badge-emerald' : 'badge-amber'}`}
                  style={{ fontSize: 10 }}>
                  {item.status ? 'Active' : 'Not Set'}
                </span>
              </div>
            ))}
          </Section>

          {/* ── Two-Factor Authentication ── */}
          <Section
            title="Two-Factor Authentication"
            subtitle="Add a second layer of security to your vault"
            icon={
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="5" y="11" width="14" height="10" rx="2"/>
                <path d="M8 11V7a4 4 0 0 1 8 0v4"/>
                <circle cx="12" cy="16" r="1" fill="currentColor"/>
              </svg>
            }
          >
            <MfaSection />
          </Section>

        </div>
      </div>
    </div>
  );
}