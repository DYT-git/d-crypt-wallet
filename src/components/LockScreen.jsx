import React, { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';

export default function LockScreen({ onUnlock }) {
  const { logout, user } = usePrivy();
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const handleUnlock = async () => {
    setIsVerifying(true);
    setErrorMsg('');
    try {
      if (window.PublicKeyCredential) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);
        
        let credIdStr = localStorage.getItem('dcrypt_tx_passkey');
        
        if (!credIdStr) {
          const cred = await navigator.credentials.create({
            publicKey: {
              challenge,
              rp: { name: "D-CRYPT Secure", id: window.location.hostname },
              user: { id: challenge, name: "D-CRYPT User", displayName: "D-CRYPT Vault" },
              pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
              authenticatorSelection: { userVerification: "required" },
              timeout: 60000
            }
          });
          if (cred && cred.rawId) {
            const rawIdArray = Array.from(new Uint8Array(cred.rawId));
            localStorage.setItem('dcrypt_tx_passkey', JSON.stringify(rawIdArray));
          }
        } else {
          const rawIdArray = JSON.parse(credIdStr);
          const rawId = new Uint8Array(rawIdArray);
          await navigator.credentials.get({
            publicKey: {
              challenge,
              allowCredentials: [{ type: "public-key", id: rawId }],
              userVerification: "required",
              timeout: 60000
            }
          });
        }
      }
      // If biometric succeeds, unlock the vault
      onUnlock();
    } catch (err) {
      console.error("Unlock Error:", err);
      setErrorMsg('Biometric verification cancelled or failed.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
  };

  return (
    <div className="web3-bg" style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20
    }}>
      <div className="bg-glow-purple" />
      
      <div style={{
        background: 'var(--clr-bg-card)',
        border: '1px solid var(--clr-border)',
        borderRadius: 'var(--radius-xl)',
        padding: '50px 40px',
        width: '100%', maxWidth: 440,
        textAlign: 'center',
        position: 'relative',
        zIndex: 10,
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
        animation: 'pk-slide-up 0.3s ease-out both'
      }}>
        {/* Lock Icon */}
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'var(--clr-accent-dim)',
          border: '1px solid var(--clr-border-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          color: 'var(--clr-accent)'
        }}>
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="7" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M5 7V5a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <circle cx="8" cy="10.5" r="1" fill="currentColor"/>
          </svg>
        </div>

        <h2 style={{
          fontSize: 24, fontWeight: 700, color: 'var(--clr-text-white)',
          marginBottom: 10, letterSpacing: -0.5
        }}>Vault Locked</h2>
        
        <p style={{
          fontSize: 14, color: 'var(--clr-text-secondary)',
          lineHeight: 1.6, marginBottom: 30
        }}>
          Welcome back. Please verify your biometric passkey to unlock your secure session.
        </p>

        {errorMsg && (
          <div style={{
            background: 'var(--clr-red-dim)', border: '1px solid var(--clr-border-danger)',
            borderRadius: 'var(--radius-md)', padding: '12px',
            marginBottom: 20, fontSize: 13, color: 'var(--clr-text-red)',
            fontWeight: 500
          }}>
            ✗ {errorMsg}
          </div>
        )}

        <button
          onClick={handleUnlock}
          disabled={isVerifying}
          className="btn btn-primary btn-full btn-lg"
          style={{ marginBottom: 16 }}
        >
          {isVerifying ? 'Verifying...' : 'Unlock Vault'}
        </button>

        <button
          onClick={handleSignOut}
          className="btn btn-ghost btn-full"
          style={{ fontSize: 14, color: 'var(--clr-text-muted)' }}
        >
          Sign Out ({user?.wallet?.address?.slice(0,6)}...{user?.wallet?.address?.slice(-4)})
        </button>
      </div>
    </div>
  );
}
