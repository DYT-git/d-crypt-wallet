import QRCode from 'react-qr-code';
import { useState } from 'react';
import DepositQR from './DepositQR';

const QRCodeComponent = QRCode?.default || QRCode;

/* ── DepositModal
   Unified Deposit Modal handling both Fiat (INR via UPI) and Crypto (Web3)
─────────────────────────────────────────────────── */
export default function DepositModal({
  show, onClose,
  upiStatus, depositAmount, setDepositAmount,
  handleUpiPayment, savedUsername, pendingDepositId,
  walletAddress
}) {
  const [activeTab, setActiveTab] = useState('fiat'); // 'fiat' | 'crypto'
  const [copied, setCopied] = useState(false);

  if (!show) return null;

  const handleCopy = () => {
    if (!walletAddress) return;
    navigator.clipboard.writeText(walletAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(3, 8, 18, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 300, padding: 24,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && upiStatus === 'idle') onClose();
      }}
    >
      <div className="animate-scale-in" style={{
        background: 'var(--clr-bg-surface)',
        border: '1px solid var(--clr-border)',
        borderRadius: 'var(--radius-xl)',
        width: '100%', maxWidth: 420,
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Top glow strip */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, var(--clr-accent-glow), transparent)',
        }}/>

        {/* Close button (only in idle) */}
        {upiStatus === 'idle' && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: 16, right: 16,
              width: 28, height: 28, borderRadius: 'var(--radius-sm)',
              background: 'var(--clr-bg-card)',
              border: '1px solid var(--clr-border)',
              color: 'var(--clr-text-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', fontSize: 16, zIndex: 10,
            }}
            onMouseEnter={e => e.currentTarget.style.color = 'var(--clr-text-red)'}
            onMouseLeave={e => e.currentTarget.style.color = 'var(--clr-text-muted)'}
          >×</button>
        )}

        {/* ── Tabs (only visible when idle) ── */}
        {upiStatus === 'idle' && (
          <div style={{
            display: 'flex', borderBottom: '1px solid var(--clr-border)',
            background: 'rgba(0,0,0,0.2)', padding: '24px 28px 0',
          }}>
            <button
              onClick={() => setActiveTab('fiat')}
              style={{
                flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 600,
                color: activeTab === 'fiat' ? 'var(--clr-text-white)' : 'var(--clr-text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${activeTab === 'fiat' ? 'var(--clr-blue)' : 'transparent'}`,
                transition: 'var(--transition-fast)',
              }}
            >
              Deposit Fiat (INR)
            </button>
            <button
              onClick={() => setActiveTab('crypto')}
              style={{
                flex: 1, padding: '12px 0', fontSize: 14, fontWeight: 600,
                color: activeTab === 'crypto' ? 'var(--clr-text-white)' : 'var(--clr-text-muted)',
                background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: `2px solid ${activeTab === 'crypto' ? 'var(--clr-accent)' : 'transparent'}`,
                transition: 'var(--transition-fast)',
              }}
            >
              Receive Crypto
            </button>
          </div>
        )}

        <div style={{ padding: '24px 28px 32px' }}>
          
          {/* ── CRYPTO TAB ── */}
          {activeTab === 'crypto' && upiStatus === 'idle' && (
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                background: 'var(--clr-accent-dim)',
                border: '1px solid var(--clr-border-accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', color: 'var(--clr-accent)',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                  <line x1="12" y1="22.08" x2="12" y2="12"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--clr-text-white)', marginBottom: 4 }}>Receive Crypto</h3>
              <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', marginBottom: 24 }}>Send ETH or USDC on Sepolia Testnet</p>

              <div style={{
                background: '#ffffff',
                borderRadius: 'var(--radius-lg)',
                padding: 18, display: 'inline-block',
                marginBottom: 24,
                boxShadow: '0 0 24px rgba(0,229,255,0.1)',
              }}>
                <QRCodeComponent value={walletAddress || 'no-address-found'} size={180} bgColor="#fff" fgColor="#030812"/>
              </div>

              <div style={{
                background: 'var(--clr-bg-card)',
                border: '1px solid var(--clr-border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12,
              }}>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: 'var(--clr-text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {walletAddress}
                </span>
                <button
                  onClick={handleCopy}
                  className="btn btn-secondary btn-sm"
                  style={{ flexShrink: 0 }}
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          )}

          {/* ── FIAT TAB / IDLE ── */}
          {activeTab === 'fiat' && upiStatus === 'idle' && (
            <div className="animate-fade-in">
              <div style={{ textAlign: 'center', marginBottom: 28 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                  background: 'var(--clr-blue-dim)',
                  border: '1px solid var(--clr-blue-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 14px', color: 'var(--clr-blue)',
                }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--clr-text-white)', marginBottom: 4 }}>Deposit INR</h3>
                <p style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>Add funds to your fiat vault</p>
              </div>

              <div className="input-group">
                <label className="input-label">Amount</label>
                <div style={{ position: 'relative' }}>
                  <span style={{
                    position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                    fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700,
                    color: 'var(--clr-text-secondary)', pointerEvents: 'none',
                  }}>₹</span>
                  <input
                    type="number" autoFocus placeholder="0" className="input input-mono"
                    style={{ paddingLeft: 36, fontSize: 22, fontWeight: 700, height: 56 }}
                    onChange={(e) => setDepositAmount(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[100, 500, 1000, 5000].map((amt) => (
                  <button
                    key={amt} onClick={() => setDepositAmount(String(amt))}
                    style={{
                      flex: 1, padding: '7px 0', background: 'var(--clr-bg-card)',
                      border: '1px solid var(--clr-border)', borderRadius: 'var(--radius-sm)',
                      fontSize: 12, fontWeight: 600, color: 'var(--clr-text-secondary)',
                      cursor: 'pointer', transition: 'var(--transition-fast)', fontFamily: 'var(--font-mono)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--clr-blue-border)'; e.currentTarget.style.color = 'var(--clr-blue)'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--clr-border)'; e.currentTarget.style.color = 'var(--clr-text-secondary)'; }}
                  >₹{amt}</button>
                ))}
              </div>

              <button
                onClick={handleUpiPayment}
                disabled={!depositAmount || depositAmount <= 0}
                className="btn btn-full"
                style={{
                  background: 'var(--clr-blue-dim)', border: '1px solid var(--clr-blue-border)',
                  color: 'var(--clr-blue)', fontSize: 14, fontWeight: 700,
                  padding: '14px', borderRadius: 'var(--radius-md)',
                }}
              >
                Generate QR Code →
              </button>
            </div>
          )}

          {/* ── FIAT TAB / WAITING FOR SCAN ── */}
          {upiStatus === 'waiting_for_scan' && (
            <div className="animate-fade-in" style={{ textAlign: 'center' }}>

              {/* Back + Close row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <button
                  onClick={() => { if(typeof setUpiStatus === 'function') {} }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--clr-text-secondary)', fontSize: 13, fontWeight: 600,
                    padding: '4px 0',
                  }}
                  onClick={onClose}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                  </svg>
                  Cancel
                </button>
                <p style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: 2, color: 'var(--clr-text-muted)',
                  textTransform: 'uppercase',
                }}>
                  Scan to Pay
                </p>
                <button
                  onClick={onClose}
                  style={{
                    width: 28, height: 28, borderRadius: 'var(--radius-sm)',
                    background: 'var(--clr-bg-card)',
                    border: '1px solid var(--clr-border)',
                    color: 'var(--clr-text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: 16,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--clr-text-red)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--clr-text-muted)'}
                >×</button>
              </div>

              <DepositQR 
                currentUsername={savedUsername} 
                amount={depositAmount} 
                transactionId={pendingDepositId} 
              />

              <div style={{
                background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)',
                borderRadius: 'var(--radius-md)', padding: '14px 18px',
                marginTop: 20, marginBottom: 20,
              }}>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 28, fontWeight: 700, color: 'var(--clr-text-white)', marginBottom: 6 }}>
                  ₹{depositAmount}
                </p>
                <p style={{ fontSize: 13, color: 'var(--clr-text-secondary)' }}>
                  UPI ID:{' '}
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--clr-accent)', fontWeight: 600 }}>
                    {savedUsername}@d-crypt
                  </span>
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--clr-amber)', display: 'inline-block', animation: 'dc-pulse 1.5s ease-in-out infinite' }}/>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-text-amber)', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                  Awaiting Payment...
                </p>
              </div>
            </div>
          )}

          {/* ── FIAT TAB / SUCCESS ── */}
          {upiStatus === 'success' && (
            <div className="animate-scale-in" style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%', background: 'var(--clr-emerald-dim)',
                border: '1px solid var(--clr-emerald-border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 20px', boxShadow: '0 0 32px rgba(16,185,129,0.2)', color: 'var(--clr-emerald)',
              }}>
                <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 24, fontWeight: 700, color: 'var(--clr-text-white)', marginBottom: 8 }}>Verified!</h3>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 700, color: 'var(--clr-text-emerald)', marginBottom: 6 }}>
                +₹{depositAmount}
              </p>
              <p style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>Added to your INR vault</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
