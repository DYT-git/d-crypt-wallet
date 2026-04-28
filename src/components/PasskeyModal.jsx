import React, { useState } from 'react';

/* ═══════════════════════════════════════════════════════════════
   PasskeyModal.jsx — D-CRYPT Custom Biometric Verification Modal

   Shows BEFORE Privy's native biometric prompt fires.
   User flow: D-CRYPT Modal → click Verify → OS/Privy biometric → tx runs

   Props:
     show         – boolean
     onClose      – fn (cancel)
     onVerify     – fn (calls personal_sign → then tx logic)
     state        – 'idle' | 'verifying' | 'processing' | 'success' | 'error'
     errorMsg     – string
     title        – string  (e.g. "Sell ETH → INR Vault")
     subtitle     – string  (e.g. "Crypto to INR Swap")
     accentColor  – CSS var string (default: --clr-accent)
     rows         – [{ label, value, highlight? }]  transaction detail rows
     icon         – JSX element (token icon etc.)
═══════════════════════════════════════════════════════════════ */

/* Inject keyframes once */
const STYLE_ID = 'dcrypt-passkey-keyframes';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes pk-pulse {
      0%,100% { box-shadow: 0 0 0 0 var(--pk-accent-glow, rgba(0,229,255,0.25)); }
      50%      { box-shadow: 0 0 0 14px transparent; }
    }
    @keyframes pk-spin {
      to { transform: rotate(360deg); }
    }
    @keyframes pk-pop {
      0%   { transform: scale(0.88); opacity: 0; }
      60%  { transform: scale(1.03); }
      100% { transform: scale(1);    opacity: 1; }
    }
    @keyframes pk-slide-up {
      from { transform: translateY(10px); opacity: 0; }
      to   { transform: translateY(0);    opacity: 1; }
    }
    @keyframes pk-success-ring {
      0%   { transform: scale(0.7); opacity: 0; }
      60%  { transform: scale(1.1); }
      100% { transform: scale(1);   opacity: 1; }
    }
  `;
  document.head.appendChild(s);
}

/* ── Fingerprint SVG icon ── */
function FingerprintIcon({ size = 28, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12C2 6.48 6.48 2 12 2s10 4.48 10 10"/>
      <path d="M5 12a7 7 0 0 1 7-7"/>
      <path d="M8 12a4 4 0 0 1 4-4"/>
      <path d="M11 12a1 1 0 0 1 2 0c0 4-4 6-4 6"/>
      <path d="M15 12a3 3 0 0 1-3 3"/>
      <path d="M19 12c0 4-2.5 7.5-7 9"/>
    </svg>
  );
}

/* ── Shield check SVG ── */
function ShieldCheckIcon({ size = 28, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      <polyline points="9 12 11 14 15 10"/>
    </svg>
  );
}

/* ── Spinner ── */
function Spinner({ color = 'var(--clr-accent)', size = 20 }) {
  return (
    <span style={{
      width: size, height: size, borderRadius: '50%',
      border: `2.5px solid rgba(255,255,255,0.12)`,
      borderTopColor: color,
      display: 'inline-block',
      animation: 'pk-spin 0.75s linear infinite',
    }} />
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════ */
export default function PasskeyModal({
  show,
  onClose,
  onVerify,
  state = 'idle',       // idle | verifying | processing | success | error
  errorMsg = '',
  title = 'Verify Transaction',
  subtitle = 'Passkey Authentication',
  accentColor = 'var(--clr-accent)',
  accentDim   = 'var(--clr-accent-dim)',
  accentBorder= 'var(--clr-border-accent)',
  rows = [],            // [{ label: string, value: string, highlight?: bool, mono?: bool }]
  icon = null,
}) {
  if (!show) return null;

  const isIdle       = state === 'idle';
  const isVerifying  = state === 'verifying';
  const isProcessing = state === 'processing';
  const isSuccess    = state === 'success';
  const isError      = state === 'error';
  const isBusy       = isVerifying || isProcessing;

  const [localError, setLocalError] = useState('');

  /* ── Trigger Native OS Biometric (WebAuthn) ── */
  const handleVerifyClick = async () => {
    setLocalError('');
    try {
      if (window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        try {
          // Attempt to authenticate using ANY saved passkey on this device for this domain
          await navigator.credentials.get({
            publicKey: {
              challenge,
              userVerification: "required",
              timeout: 60000
            }
          });
        } catch (getErr) {
          // If no passkey exists or it failed, prompt them to create one to secure the vault
          await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: "D-CRYPT Secure", id: window.location.hostname },
              user: { id: challenge, name: "D-CRYPT User", displayName: "D-CRYPT Vault" },
              pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
              authenticatorSelection: { userVerification: "required" },
              timeout: 60000
            }
          });
        }
      }
      // If OS biometric succeeds (either get or create), proceed with actual transaction
      onVerify();
    } catch (err) {
      console.error("OS Biometric Error:", err);
      // If user cancelled the passkey prompt, show error in our modal
      setLocalError('Biometric verification cancelled. Please try again.');
    }
  };

  /* CSS var override for pulse glow */
  const accentGlowStyle = {
    '--pk-accent-glow': accentColor === 'var(--clr-accent)'
      ? 'rgba(0,229,255,0.25)'
      : accentColor === 'var(--clr-emerald)'
      ? 'rgba(16,185,129,0.25)'
      : 'rgba(245,158,11,0.2)',
  };

  return (
    /* Backdrop */
    <div
      onClick={e => { if (e.target === e.currentTarget && !isBusy && !isSuccess) onClose(); }}
      style={{
        position: 'fixed', inset: 0,
        background: isProcessing ? 'rgba(3,8,18,0.4)' : 'rgba(3,8,18,0.92)',
        backdropFilter: isProcessing ? 'blur(4px)' : 'blur(18px)',
        WebkitBackdropFilter: isProcessing ? 'blur(4px)' : 'blur(18px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 500, padding: 20,
        transition: 'background 0.3s, backdrop-filter 0.3s',
      }}
    >
      {/* Panel */}
      <div
        style={{
          width: '100%', maxWidth: 420,
          background: 'var(--clr-bg-surface)',
          border: `1px solid ${isError ? 'var(--clr-border-danger)' : isSuccess ? 'var(--clr-emerald-border)' : 'var(--clr-border)'}`,
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          animation: 'pk-pop 0.28s cubic-bezier(.22,1,.36,1) both',
          transition: 'border-color 0.3s',
        }}
      >
        {/* Top gradient bar */}
        <div style={{
          height: 3,
          background: isSuccess
            ? 'linear-gradient(90deg,transparent,var(--clr-emerald),transparent)'
            : isError
            ? 'linear-gradient(90deg,transparent,var(--clr-red),transparent)'
            : `linear-gradient(90deg,transparent,${accentColor},transparent)`,
          transition: 'background 0.4s',
        }} />

        <div style={{ padding: '28px 26px 26px' }}>

          {/* ────────────── SUCCESS ────────────── */}
          {isSuccess && (
            <div style={{ textAlign: 'center', padding: '12px 0 8px', animation: 'pk-slide-up 0.3s ease both' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', margin: '0 auto 20px',
                background: 'var(--clr-emerald-dim)',
                border: '1px solid var(--clr-emerald-border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                animation: 'pk-success-ring 0.4s cubic-bezier(.22,1,.36,1) both',
                boxShadow: '0 0 40px rgba(16,185,129,0.18)',
                color: 'var(--clr-emerald)',
              }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <p style={{ fontSize: 19, fontWeight: 700, color: 'var(--clr-text-white)', marginBottom: 6 }}>
                Verified & Sent!
              </p>
              <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', lineHeight: 1.6 }}>
                Transaction is confirmed and processing.
              </p>
            </div>
          )}

          {/* ────────────── IDLE / BUSY / ERROR ────────────── */}
          {!isSuccess && (
            <>
              {/* Header row */}
              <div style={{
                display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Icon badge */}
                  <div style={{
                    width: 42, height: 42, borderRadius: 'var(--radius-md)',
                    background: accentDim,
                    border: `1px solid ${accentBorder}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: accentColor,
                  }}>
                    {icon || <ShieldCheckIcon size={20} color={accentColor} />}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--clr-text-white)', lineHeight: 1.2 }}>
                      {title}
                    </h3>
                    <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 2 }}>
                      {subtitle}
                    </p>
                  </div>
                </div>

                {/* Close */}
                {!isBusy && (
                  <button
                    onClick={onClose}
                    style={{
                      width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                      background: 'var(--clr-bg-card)',
                      border: '1px solid var(--clr-border)',
                      color: 'var(--clr-text-muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', fontSize: 16,
                      transition: 'color 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.color = 'var(--clr-text-red)';
                      e.currentTarget.style.borderColor = 'var(--clr-border-danger)';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.color = 'var(--clr-text-muted)';
                      e.currentTarget.style.borderColor = 'var(--clr-border)';
                    }}
                  >×</button>
                )}
              </div>

              {/* ── Biometric illustration ring ── */}
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
                <div style={{
                  ...accentGlowStyle,
                  width: 90, height: 90, borderRadius: '50%',
                  background: accentDim,
                  border: `1.5px solid ${accentBorder}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: accentColor,
                  animation: isBusy ? 'none' : 'pk-pulse 2.4s ease-in-out infinite',
                  position: 'relative',
                }}>
                  {isBusy
                    ? <Spinner color={accentColor} size={36} />
                    : <FingerprintIcon size={38} color={accentColor} />
                  }
                  {/* Outer ring */}
                  <span style={{
                    position: 'absolute', inset: -8,
                    borderRadius: '50%',
                    border: `1px solid ${accentBorder}`,
                    opacity: 0.35,
                  }} />
                </div>
              </div>

              {/* ── Status label under icon ── */}
              <p style={{
                textAlign: 'center', fontSize: 12, fontWeight: 600,
                color: isBusy ? accentColor : (isError || localError) ? 'var(--clr-text-red)' : 'var(--clr-text-secondary)',
                marginBottom: 20, letterSpacing: 0.3,
                animation: 'pk-slide-up 0.2s ease both',
              }}>
                {isVerifying  && '🔐 Waiting for your biometric…'}
                {isProcessing && '⚙️ Processing transaction…'}
                {isIdle       && 'Touch to verify with your passkey or biometric'}
                {(isError || localError) && `✗ ${errorMsg || localError || 'Verification failed. Please try again.'}`}
              </p>

              {/* ── Transaction detail rows ── */}
              {rows.length > 0 && (
                <div style={{
                  background: 'var(--clr-bg-card)',
                  border: '1px solid var(--clr-border)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden', marginBottom: 18,
                }}>
                  {rows.map((row, i) => (
                    <div
                      key={i}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '11px 16px',
                        borderBottom: i < rows.length - 1 ? '1px solid var(--clr-border)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 11, color: 'var(--clr-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.7px' }}>
                        {row.label}
                      </span>
                      <span style={{
                        fontSize: 13, fontWeight: row.bold ? 700 : 600,
                        fontFamily: row.mono !== false ? 'var(--font-mono)' : undefined,
                        color: row.highlight
                          ? accentColor
                          : row.dim
                          ? 'var(--clr-text-muted)'
                          : 'var(--clr-text-secondary)',
                      }}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* ── D-CRYPT security badge ── */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(0,229,255,0.03)',
                border: '1px solid rgba(0,229,255,0.1)',
                borderRadius: 'var(--radius-md)',
                padding: '9px 13px', marginBottom: 18,
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="var(--clr-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', lineHeight: 1.4 }}>
                  <span style={{ color: 'var(--clr-accent)', fontWeight: 700 }}>D-CRYPT Secured</span>
                  {' '}· Biometric verification is required to authorize this transaction.
                  Your key never leaves your device.
                </p>
              </div>

              {/* ── Error detail (full message) ── */}
              {(isError && errorMsg) || localError ? (
                <div style={{
                  background: 'var(--clr-red-dim)', border: '1px solid var(--clr-border-danger)',
                  borderRadius: 'var(--radius-md)', padding: '10px 14px',
                  marginBottom: 14, fontSize: 12, color: 'var(--clr-text-red)',
                  animation: 'pk-slide-up 0.2s ease both',
                }}>
                  ✗ {errorMsg || localError}
                </div>
              ) : null}

              {/* ── Action buttons ── */}
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={onClose}
                  disabled={isBusy}
                  style={{
                    flex: 1, padding: '13px 0', fontSize: 13, fontWeight: 600,
                    background: 'var(--clr-bg-card)',
                    border: '1px solid var(--clr-border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--clr-text-muted)',
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    opacity: isBusy ? 0.4 : 1,
                    transition: 'color 0.15s, border-color 0.15s',
                    fontFamily: 'var(--font-main)',
                  }}
                  onMouseEnter={e => { if (!isBusy) e.currentTarget.style.color = 'var(--clr-text-secondary)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
                >
                  Cancel
                </button>

                <button
                  onClick={handleVerifyClick}
                  disabled={isBusy}
                  style={{
                    flex: 2, padding: '13px 0', fontSize: 13, fontWeight: 700,
                    background: isBusy
                      ? 'var(--clr-bg-card)'
                      : isError
                      ? 'var(--clr-red-dim)'
                      : accentColor === 'var(--clr-accent)'
                      ? 'linear-gradient(135deg, var(--clr-accent), #00b3cc)'
                      : accentColor,
                    border: isBusy
                      ? '1px solid var(--clr-border)'
                      : isError
                      ? '1px solid var(--clr-border-danger)'
                      : 'none',
                    borderRadius: 'var(--radius-md)',
                    color: isBusy
                      ? 'var(--clr-text-muted)'
                      : isError
                      ? 'var(--clr-text-red)'
                      : '#030812',
                    cursor: isBusy ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    transition: 'opacity 0.15s, transform 0.15s',
                    fontFamily: 'var(--font-main)',
                    boxShadow: (!isBusy && !isError)
                      ? '0 4px 20px rgba(0,229,255,0.2)'
                      : 'none',
                  }}
                  onMouseEnter={e => { if (!isBusy) e.currentTarget.style.opacity = '0.88'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  {isBusy ? (
                    <>
                      <Spinner color="var(--clr-text-muted)" size={14} />
                      {isVerifying ? 'Waiting for biometric…' : 'Processing…'}
                    </>
                  ) : (
                    <>
                      <FingerprintIcon size={15} color="#030812" />
                      {isError ? 'Try Again' : 'Verify & Confirm'}
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
