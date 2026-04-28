import { useState, useEffect } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '../supabase';

/* ══════════════════════════════════════════════════
   ClaimProfile.jsx
   Username claim screen shown to brand-new users.

   • Real-time uniqueness check via Supabase
   • Stores: username, email, wallet_address, inr_balance=0
   • Logs an `account_created` event in transactions table
   • Email is masked in ledger (privacy)
══════════════════════════════════════════════════ */

const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

function CheckIcon({ status }) {
  if (status === 'checking') {
    return (
      <div style={{
        width: 14, height: 14, borderRadius: '50%',
        border: '2px solid var(--clr-border)',
        borderTopColor: 'var(--clr-accent)',
        animation: 'dc-spin 0.7s linear infinite',
        display: 'inline-block',
      }} />
    );
  }
  if (status === 'available') {
    return <span style={{ color: 'var(--clr-text-emerald)', fontSize: 16 }}>✓</span>;
  }
  if (status === 'taken' || status === 'invalid') {
    return <span style={{ color: 'var(--clr-text-red)', fontSize: 16 }}>✗</span>;
  }
  return null;
}

function statusMsg(status, username) {
  switch (status) {
    case 'checking':   return { text: 'Checking availability…',  color: 'var(--clr-text-muted)'    };
    case 'available':  return { text: `@${username} is available ✓`, color: 'var(--clr-text-emerald)' };
    case 'taken':      return { text: 'Username already taken',   color: 'var(--clr-text-red)'      };
    case 'invalid':    return { text: 'Only letters, numbers, underscores (3–20 chars)', color: 'var(--clr-text-amber)' };
    default:           return null;
  }
}

export default function ClaimProfile({ walletAddress, onSuccess }) {
  const { user } = usePrivy();
  const email = user?.email?.address || user?.google?.email || '';

  const [username,    setUsername]    = useState('');
  const [checkStatus, setCheckStatus] = useState('idle');
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');
  // After claim: show MFA nudge before entering dashboard
  const [claimed,     setClaimed]     = useState(false);
  const [claimedUser, setClaimedUser] = useState('');

  /* ── Real-time uniqueness check ── */
  useEffect(() => {
    const clean = username.toLowerCase().trim();
    if (!clean) { setCheckStatus('idle'); return; }
    if (!USERNAME_REGEX.test(clean)) { setCheckStatus('invalid'); return; }

    setCheckStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('users')
          .select('username')
          .eq('username', clean)
          .maybeSingle();
        setCheckStatus(data ? 'taken' : 'available');
      } catch { setCheckStatus('idle'); }
    }, 600);
    return () => clearTimeout(timer);
  }, [username]);

  /* ── Claim username ── */
  const handleClaim = async () => {
    const clean = username.toLowerCase().trim();
    if (checkStatus !== 'available' || submitting) return;
    setSubmitting(true);
    setSubmitError('');

    try {
      // 1. Insert user row
      const { error: uErr } = await supabase.from('users').insert({
        wallet_address: walletAddress,
        username:       clean,
        email:          email || null,
        inr_balance:    0,
      });
      if (uErr) throw new Error(uErr.message);

      // 2. Log account_created event in ledger
      await supabase.from('transactions').insert({
        txn_type:       'account_created',
        username:       clean,
        wallet_address: walletAddress,
        amount_inr:     0,
        status:         'completed',
      });

      // Show MFA nudge instead of going straight to dashboard
      setClaimedUser(clean);
      setClaimed(true);
      setSubmitting(false);
    } catch (err) {
      setSubmitError(err.message || 'Failed to claim username.');
      setSubmitting(false);
    }
  };

  const canClaim = checkStatus === 'available' && !submitting;
  const msg      = statusMsg(checkStatus, username.toLowerCase().trim());

  /* ── MFA Nudge Screen (shown after successful username claim) ── */
  if (claimed) {
    return (
      <div className="animate-scale-in" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 20,
      }}>
        <div style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ height: 2, background: 'linear-gradient(90deg,transparent,var(--clr-accent),transparent)' }} />
            <div style={{ padding: '36px 32px 32px' }}>
              {/* Shield icon */}
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <div style={{
                  width: 60, height: 60, borderRadius: '50%',
                  background: 'var(--clr-accent-dim)', border: '1px solid var(--clr-border-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 16px', fontSize: 26,
                }}>🛡️</div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--clr-text-white)', marginBottom: 6 }}>
                  Vault Created, @{claimedUser}!
                </h2>
                <p style={{ fontSize: 13, color: 'var(--clr-text-secondary)', lineHeight: 1.6 }}>
                  Your wallet is ready. We strongly recommend setting up
                  <strong style={{ color: 'var(--clr-text-white)' }}> Two-Factor Authentication</strong> before
                  your first transaction.
                </p>
              </div>

              {/* Benefits list */}
              <div style={{
                background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)',
                borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: 22,
              }}>
                {[
                  { icon: '🔑', text: 'Passkey — login with Touch ID, Face ID or device PIN' },
                  { icon: '📱', text: 'Authenticator App — Google Authenticator or Authy' },
                  { icon: '🔒', text: 'Required to export your private key (extra safety)' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: i < 2 ? 10 : 0 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                    <p style={{ fontSize: 12, color: 'var(--clr-text-secondary)', lineHeight: 1.5 }}>{item.text}</p>
                  </div>
                ))}
              </div>

              {/* CTA buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  onClick={() => onSuccess(claimedUser, email)}
                  style={{
                    width: '100%', padding: 14,
                    background: 'var(--clr-accent)', border: 'none',
                    color: '#030812', fontWeight: 700, fontSize: 14,
                    borderRadius: 'var(--radius-md)', cursor: 'pointer',
                    boxShadow: '0 6px 24px rgba(0,229,255,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  🛡️ Enter Dashboard — Set Up 2FA Now
                </button>
                <button
                  onClick={() => onSuccess(claimedUser, email)}
                  style={{
                    width: '100%', padding: 12, background: 'transparent',
                    border: '1px solid var(--clr-border)', color: 'var(--clr-text-muted)',
                    fontWeight: 500, fontSize: 13, borderRadius: 'var(--radius-md)',
                    cursor: 'pointer',
                  }}
                >
                  Skip for now — I'll set it up later from Account
                </button>
              </div>

              <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
                You can always configure 2FA later from the <strong style={{ color: 'var(--clr-accent)' }}>Account → Security</strong> section.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-scale-in" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: 20,
    }}>
      {/* Glow */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)',
        width: 600, height: 600,
        background: 'radial-gradient(circle,rgba(0,229,255,0.06) 0%,transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <div style={{
        width: '100%', maxWidth: 460, position: 'relative', zIndex: 1,
      }}>
        {/* Card */}
        <div className="card" style={{ overflow: 'hidden' }}>

          {/* Top accent line */}
          <div style={{
            height: 2,
            background: 'linear-gradient(90deg,transparent,var(--clr-accent),transparent)',
          }} />

          <div style={{ padding: '36px 32px 32px' }}>
            {/* Logo */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <div style={{
                width: 54, height: 54, borderRadius: 'var(--radius-md)',
                background: 'var(--clr-accent-dim)',
                border: '1px solid var(--clr-border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                  stroke="var(--clr-accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </div>
              <h2 style={{
                fontSize: 22, fontWeight: 700, color: 'var(--clr-text-white)',
                marginBottom: 6, letterSpacing: -0.3,
              }}>
                Claim Your @username
              </h2>
              <p style={{ fontSize: 13, color: 'var(--clr-text-secondary)', lineHeight: 1.6 }}>
                This becomes your permanent payment address on D-CRYPT.
                Others can send you crypto using just this handle.
              </p>
            </div>

            {/* Email badge */}
            {email && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--clr-bg-card)',
                border: '1px solid var(--clr-border)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px', marginBottom: 22,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="var(--clr-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                  <polyline points="22,6 12,13 2,6"/>
                </svg>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--clr-text-secondary)' }}>
                  {email}
                </span>
                <span style={{
                  marginLeft: 'auto', fontSize: 10, color: 'var(--clr-text-emerald)',
                  background: 'var(--clr-emerald-dim)',
                  border: '1px solid var(--clr-emerald-border)',
                  borderRadius: 4, padding: '2px 7px', fontWeight: 700,
                }}>VERIFIED</span>
              </div>
            )}

            {/* Username input */}
            <div style={{ marginBottom: 20 }}>
              <label className="input-label">Choose Username</label>
              <div style={{ position: 'relative' }}>
                <span style={{
                  position: 'absolute', left: 14, top: '50%',
                  transform: 'translateY(-50%)',
                  fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
                  color: 'var(--clr-accent)', pointerEvents: 'none',
                }}>@</span>
                <input
                  type="text"
                  placeholder="your_handle"
                  value={username}
                  onChange={e => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20))}
                  className="input input-mono"
                  style={{
                    paddingLeft: 30,
                    borderColor:
                      checkStatus === 'available' ? 'var(--clr-emerald-border)' :
                      (checkStatus === 'taken' || checkStatus === 'invalid') ? 'var(--clr-border-danger)' : undefined,
                  }}
                  onKeyDown={e => e.key === 'Enter' && handleClaim()}
                  autoFocus
                />
                {checkStatus !== 'idle' && (
                  <div style={{
                    position: 'absolute', right: 14, top: '50%',
                    transform: 'translateY(-50%)',
                  }}>
                    <CheckIcon status={checkStatus} />
                  </div>
                )}
              </div>

              {msg && (
                <p className="animate-fade-in" style={{
                  fontSize: 11, fontWeight: 500, color: msg.color,
                  marginTop: 7, lineHeight: 1.4,
                }}>
                  {msg.text}
                </p>
              )}
              {!msg && (
                <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 7 }}>
                  3–20 chars · letters, numbers, underscores only
                </p>
              )}
            </div>

            {/* Wallet info */}
            <div style={{
              background: 'var(--clr-bg-card)',
              border: '1px solid var(--clr-border)',
              borderRadius: 'var(--radius-md)',
              padding: '10px 14px', marginBottom: 22,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="var(--clr-text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--clr-text-secondary)' }}>
                {walletAddress
                  ? `${walletAddress.slice(0,10)}...${walletAddress.slice(-8)}`
                  : 'Wallet connecting…'}
              </span>
              <span style={{
                marginLeft: 'auto', fontSize: 10, color: 'var(--clr-accent)',
                background: 'var(--clr-accent-dim)',
                border: '1px solid var(--clr-border-accent)',
                borderRadius: 4, padding: '2px 7px', fontWeight: 700,
              }}>PRIVY</span>
            </div>

            {/* Error */}
            {submitError && (
              <div className="animate-fade-in" style={{
                background: 'var(--clr-red-dim)',
                border: '1px solid var(--clr-border-danger)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px', marginBottom: 16,
                fontSize: 12, color: 'var(--clr-text-red)',
              }}>
                ✗ {submitError}
              </div>
            )}

            {/* Claim button */}
            <button
              onClick={handleClaim}
              disabled={!canClaim}
              style={{
                width: '100%', padding: 15,
                background:   canClaim ? 'var(--clr-accent)' : 'var(--clr-bg-card)',
                border:       canClaim ? 'none'              : '1px solid var(--clr-border)',
                color:        canClaim ? '#030812'           : 'var(--clr-text-muted)',
                fontFamily: 'var(--font-main)', fontWeight: 700, fontSize: 14,
                borderRadius: 'var(--radius-md)',
                cursor:       canClaim ? 'pointer' : 'not-allowed',
                transition:   'var(--transition-med)',
                boxShadow:    canClaim ? '0 6px 24px rgba(0,229,255,0.25)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              }}
            >
              {submitting ? (
                <>
                  <div style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: '2px solid rgba(3,8,18,0.3)', borderTopColor: '#030812',
                    animation: 'dc-spin 0.7s linear infinite',
                  }}/>
                  Claiming…
                </>
              ) : canClaim ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Claim @{username.toLowerCase().trim()}
                </>
              ) : 'Enter a valid username above'}
            </button>

            <p style={{
              fontSize: 11, color: 'var(--clr-text-muted)',
              textAlign: 'center', marginTop: 14, lineHeight: 1.5,
            }}>
              Your username is permanent and public. Your email is always hidden.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}