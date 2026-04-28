import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { PrivyProvider } from '@privy-io/react-auth';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <PrivyProvider
      appId="cmlrj63fn01hb0cl4ip3ncjob"
      config={{
        // ── Login methods: email OTP + Google OAuth + Passkey + wallet ──
        loginMethods: ['email', 'google', 'passkey', 'wallet'],

        appearance: {
          theme: 'dark',
          accentColor: '#00E5FF', // D-CRYPT cyan
          logo: 'https://i.imgur.com/placeholder.png',
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