import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

// Pages
import Landing from './pages/Landing';
import DashboardLayout from './pages/DashboardLayout';
import Overview from './pages/Overview';
import Send from './pages/Send';
import Swap from './pages/Swap';
import History from './pages/History';
import Account from './pages/Account';
import PublicLedger from './pages/PublicLedger';

// ─────────────────────────────────────────────────────────────
// Utility: generate a random session token
// ─────────────────────────────────────────────────────────────
function generateSessionToken() {
  const arr = new Uint8Array(24);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

const SESSION_KEY = 'dcrypt_session_token';

function App() {
  const { ready, authenticated, user, logout } = usePrivy();
  const pollRef = useRef(null);

  const walletAddress = user?.wallet?.address || '';

  // ── On login: generate + persist session token ──────────────
  useEffect(() => {
    if (!authenticated || !walletAddress) return;

    const registerSession = async () => {
      const token = generateSessionToken();
      localStorage.setItem(SESSION_KEY, token);

      // Write token + metadata to users table
      await supabase
        .from('users')
        .update({
          session_token:    token,
          last_login_at:    new Date().toISOString(),
          last_login_device: navigator.userAgent.slice(0, 200),
        })
        .eq('wallet_address', walletAddress);
    };

    registerSession();
  }, [authenticated, walletAddress]);

  // ── Poll every 30 s: if DB token != local token → logout ────
  useEffect(() => {
    if (!authenticated || !walletAddress) {
      clearInterval(pollRef.current);
      return;
    }

    const checkSession = async () => {
      const localToken = localStorage.getItem(SESSION_KEY);
      if (!localToken) return;

      const { data } = await supabase
        .from('users')
        .select('session_token')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (data && data.session_token && data.session_token !== localToken) {
        // Another device has taken over — invalidate this session
        localStorage.removeItem(SESSION_KEY);
        await logout();
      }
    };

    // Check every 30 seconds (skip immediate check to allow registerSession update to finish)
    pollRef.current = setInterval(checkSession, 30_000);

    return () => clearInterval(pollRef.current);
  }, [authenticated, walletAddress, logout]);

  if (!ready) {
    return (
      <div className="min-h-screen web3-bg flex items-center justify-center text-white font-bold">
        Loading Vault Engine...
      </div>
    );
  }

  return (
    <div className="min-h-screen web3-bg text-white font-sans">
      <BrowserRouter>
        <Routes>
          {/* Public Route: If logged in, force them to the dashboard */}
          <Route
            path="/"
            element={!authenticated ? <Landing /> : <Navigate to="/dashboard" />}
          />

          {/* Public Ledger — accessible without login */}
          <Route path="/ledger" element={<PublicLedger />} />

          {/* Protected Routes: Must be logged in to see these */}
          <Route
            path="/dashboard"
            element={authenticated ? <DashboardLayout /> : <Navigate to="/" />}
          >
            <Route index element={<Overview />} />
            <Route path="send" element={<Send />} />
            <Route path="swap" element={<Swap />} />
            <Route path="history" element={<History />} />
            <Route path="account" element={<Account />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;