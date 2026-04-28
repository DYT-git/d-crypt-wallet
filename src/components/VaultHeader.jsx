import { useState } from 'react';

/* ── VaultHeader
   Shows username, wallet address, and a unified receive button.
   Props: savedUsername, walletAddress, inrBalance, setShowUpi
─────────────────────────────────────────────────── */
export default function VaultHeader({ savedUsername, walletAddress, inrBalance, setShowUpi }) {
  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 8)}...${walletAddress.slice(-6)}`
    : '—';

  return (
    <div>
      {/* ── Top identity row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20
      }}>
        {/* Avatar */}
        <div style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--clr-accent-dim), var(--clr-purple-dim))',
          border: '1.5px solid var(--clr-border-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
          color: 'var(--clr-accent)',
          flexShrink: 0,
        }}>
          {savedUsername ? savedUsername[0].toUpperCase() : '?'}
        </div>
        <div>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
            color: 'var(--clr-text-white)', letterSpacing: 0.5, marginBottom: 2,
          }}>
            @{savedUsername || 'username'}
          </p>
          <p style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--clr-text-muted)',
          }}>
            {shortAddr}
          </p>
        </div>
      </div>

      {/* ── Unified Receive button ── */}
      <button
        onClick={() => setShowUpi(true)}
        className="btn btn-full"
        style={{
          background: 'var(--clr-accent-dim)',
          border: '1px solid var(--clr-border-accent)',
          color: 'var(--clr-accent)',
          fontSize: 14, fontWeight: 600,
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          transition: 'var(--transition-med)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = 'rgba(0, 229, 255, 0.15)';
          e.currentTarget.style.borderColor = 'rgba(0, 229, 255, 0.4)';
          e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 229, 255, 0.2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = 'var(--clr-accent-dim)';
          e.currentTarget.style.borderColor = 'var(--clr-border-accent)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
          <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
        Receive Funds (QR)
      </button>
    </div>
  );
}