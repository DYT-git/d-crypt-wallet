import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { PrivyProvider } from '@privy-io/react-auth';
import { BRAND } from './config/brand.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider
      appId="cmlrj63fn01hb0cl4ip3ncjob"
      config={{
        // ── Login methods: email OTP + Google OAuth + Passkey + wallet ──
        loginMethods: ['email', 'google', 'passkey', 'wallet'],

        appearance: {
          // ─── D-CRYPT Brand Config for Privy Modal ─────────────
          // Change these to update how the Privy login popup looks.
          // logo      → must be a publicly accessible image URL
          // accentColor → buttons, links, highlights inside the modal
          // landingBackgroundColor → background of the modal itself
          // ──────────────────────────────────────────────────────
          theme: 'dark',
          accentColor: '#818cf8',                                    // Midnight Indigo — matches site accent
          logo: BRAND.logoUrl,                                       // ← change in src/config/brand.js
          landingBackgroundColor: '#060d1f',                         // matches --clr-bg-surface
          showWalletLoginFirst: false,                               // show email/Google first, wallet option below
        },

        // ── MFA configuration ──
        // Privy will automatically prompt for MFA when the user tries
        // to export/use their embedded wallet (no extra code needed).
        // Users enroll via the Account page using useMfaEnrollment hook.
        mfa: {
          noPromptOnMfaRequired: false, // auto-prompt MFA on wallet operations
        },

        // ── Embedded wallet: always create one for new users ──
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
          noPromptOnSignature: false,
        },
      }}
    >
      <App />
    </PrivyProvider>
  </React.StrictMode>,
)