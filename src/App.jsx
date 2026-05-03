import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { usePrivy } from '@privy-io/react-auth';
import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import { SecurityProvider } from './context/SecurityContext';
import { ThemeProvider } from './context/ThemeContext';
import { HelpProvider } from './context/HelpContext';
import PasskeyModal from './components/PasskeyModal';

// Pages
import Landing from './pages/Landing';
import DashboardLayout from './pages/DashboardLayout';
import Overview from './pages/Overview';
import Send from './pages/Send';
import Swap from './pages/Swap';
import History from './pages/History';
import Account from './pages/Account';
import PublicLedger from './pages/PublicLedger';
import AdminSupport from './pages/AdminSupport';

// ─────────────────────────────────────────────────────────────
// Utility: generate a random session token & device ID
// ─────────────────────────────────────────────────────────────
function generateSessionToken() {
  const arr = new Uint8Array(24);
  window.crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function getOrCreateDeviceId() {
  let id = localStorage.getItem('dcrypt_device_id');
  if (!id) {
    id = generateSessionToken(); // Fallback UUID
    localStorage.setItem('dcrypt_device_id', id);
  }
  return id;
}

const SESSION_KEY = 'dcrypt_session_token';

// Simple OS/Browser parser for user-friendly display
function parseUserAgent(ua) {
  if (/android/i.test(ua)) return 'Android Device';
  if (/iphone/i.test(ua)) return 'iPhone - Safari';
  if (/ipad/i.test(ua)) return 'iPad - Safari';
  if (/mac os x/i.test(ua)) return /chrome/i.test(ua) ? 'Mac - Chrome' : 'Mac - Safari';
  if (/windows/i.test(ua)) return /chrome/i.test(ua) ? 'Windows - Chrome' : 'Windows PC';
  if (/linux/i.test(ua)) return 'Linux PC';
  return 'Unknown Device';
}

function App() {
  const { ready, authenticated, user, logout } = usePrivy();
  const pollRef = useRef(null);

  const walletAddress = user?.wallet?.address || '';

  const [deviceChecked, setDeviceChecked] = useState(false);
  const [showCheckpoint, setShowCheckpoint] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVaultLockedOut, setIsVaultLockedOut] = useState(false);

  // ── Device Checkpoint & Registration ──
  useEffect(() => {
    if (!authenticated || !walletAddress) {
      setDeviceChecked(false);
      setShowCheckpoint(false);
      setIsVaultLockedOut(false);
      return;
    }

    const checkDevice = async () => {
      const deviceId = getOrCreateDeviceId();
      let sessionToken = localStorage.getItem(SESSION_KEY);
      
      if (!sessionToken) {
        sessionToken = generateSessionToken();
        localStorage.setItem(SESSION_KEY, sessionToken);
      }

      // Check if this specific device is already recognized in users table
      // Also fetch Vault Lockdown state
      const { data } = await supabase
        .from('users')
        .select('session_token, device_lock, locked_device_id')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      // ── Vault Lockdown Check ──
      if (data?.device_lock && data.locked_device_id !== deviceId) {
        setIsVaultLockedOut(true);
        await logout();
        return; // Halt all further execution
      }

      let sessions = [];
      try {
        if (data && data.session_token) {
          const parsed = JSON.parse(data.session_token);
          if (Array.isArray(parsed)) sessions = parsed;
        }
      } catch (e) { sessions = []; }

      const existingDeviceIndex = sessions.findIndex(s => s.deviceId === deviceId);

      if (existingDeviceIndex !== -1) {
        // Known device. Update last_active and ensure token matches
        sessions[existingDeviceIndex].lastActive = new Date().toISOString();
        sessions[existingDeviceIndex].token = sessionToken;
        sessions[existingDeviceIndex].deviceName = parseUserAgent(navigator.userAgent);
        
        await supabase
          .from('users')
          .update({ 
            session_token: JSON.stringify(sessions),
            last_login_at: new Date().toISOString(),
            last_login_device: sessions[existingDeviceIndex].deviceName
          })
          .eq('wallet_address', walletAddress);
        
        setDeviceChecked(true); // Grant access
      } else {
        // NEW device! Trigger Passkey Checkpoint
        setShowCheckpoint(true);
      }
    };

    checkDevice();
  }, [authenticated, walletAddress]);

  const handleCheckpointVerify = async () => {
    setIsVerifying(true);
    try {
      const deviceId = getOrCreateDeviceId();
      const sessionToken = localStorage.getItem(SESSION_KEY) || generateSessionToken();
      localStorage.setItem(SESSION_KEY, sessionToken);

      // Fetch IP Location
      let locationStr = 'Unknown Location';
      let countryCode = '';
      try {
        const ipRes = await fetch('https://ipapi.co/json/');
        if (ipRes.ok) {
          const ipData = await ipRes.json();
          locationStr = `${ipData.city || 'Unknown'}, ${ipData.country_name || 'Unknown'}`;
          countryCode = ipData.country_code || '';
        }
      } catch (e) {}

      // Fetch existing sessions
      const { data } = await supabase
        .from('users')
        .select('session_token')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      let sessions = [];
      try {
        if (data && data.session_token) {
          const parsed = JSON.parse(data.session_token);
          if (Array.isArray(parsed)) sessions = parsed;
        }
      } catch (e) { sessions = []; }

      const isFirstDevice = sessions.length === 0;
      let isHighRisk = false;

      if (!isFirstDevice && sessions[0].countryCode) {
        if (countryCode && countryCode !== sessions[0].countryCode) {
          isHighRisk = true;
        }
      }

      // Remove any duplicate just in case
      sessions = sessions.filter(s => s.deviceId !== deviceId);
      if (sessions.length >= 5) sessions.shift();

      // Insert new authorized device
      sessions.push({
        deviceId,
        token: sessionToken,
        deviceName: parseUserAgent(navigator.userAgent),
        location: locationStr,
        countryCode,
        trusted: true, // Verified via Passkey, so trusted automatically
        highRisk: isHighRisk,
        lastActive: new Date().toISOString()
      });

      await supabase
        .from('users')
        .update({
          session_token: JSON.stringify(sessions),
          last_login_at: new Date().toISOString(),
          last_login_device: parseUserAgent(navigator.userAgent),
        })
        .eq('wallet_address', walletAddress);

      setShowCheckpoint(false);
      setDeviceChecked(true); // Grant access

    } catch (e) {
      console.error("Failed to register device", e);
      // Optional: don't log out, just leave them stuck at checkpoint
    }
    setIsVerifying(false);
  };

  // ── Poll every 30s: Check if THIS device was revoked ──
  useEffect(() => {
    if (!authenticated || !walletAddress || !deviceChecked) {
      clearInterval(pollRef.current);
      return;
    }

    const pollSession = async () => {
      const localToken = localStorage.getItem(SESSION_KEY);
      const deviceId = getOrCreateDeviceId();

      const { data } = await supabase
        .from('users')
        .select('session_token')
        .eq('wallet_address', walletAddress)
        .maybeSingle();

      if (data && data.session_token) {
        let sessions = [];
        try {
          sessions = JSON.parse(data.session_token);
        } catch { return; } 

        if (Array.isArray(sessions)) {
          const mySession = sessions.find(s => s.deviceId === deviceId);
          // If my device is missing from the list, or the token doesn't match, I was revoked!
          if (!mySession || mySession.token !== localToken) {
            localStorage.removeItem(SESSION_KEY);
            await logout();
          }
        }
      } else {
        // No session token at all
        localStorage.removeItem(SESSION_KEY);
        await logout();
      }
    };

    pollRef.current = setInterval(pollSession, 30_000);
    return () => clearInterval(pollRef.current);
  }, [authenticated, walletAddress, deviceChecked, logout]);

  if (!ready) {
    return (
      <div className="min-h-screen web3-bg flex items-center justify-center text-white font-bold">
        Loading Vault Engine...
      </div>
    );
  }

  // Fatal Vault Lockdown Overlay
  if (isVaultLockedOut) {
    return (
      <div className="min-h-screen web3-bg text-white font-sans flex items-center justify-center">
        <div className="card p-8 max-w-md text-center animate-scale-in" style={{ border: '1px solid var(--clr-border-danger)' }}>
          <div style={{
            width: 64, height: 64, background: 'rgba(239,68,68,0.1)', 
            borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px', color: 'var(--clr-text-red)'
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              <line x1="12" y1="14" x2="12" y2="17"></line>
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-3 text-red-500">Vault Lockdown Active</h2>
          <p className="text-sm text-gray-400 mb-6 leading-relaxed">
            The owner of this account has strictly locked access to a specific physical device. <br/><br/>
            Logins from any other device are permanently blocked until the owner disables Lockdown Mode. Access Denied.
          </p>
        </div>
      </div>
    );
  }

  // Blocking Checkpoint for New Devices
  if (authenticated && !deviceChecked) {
    return (
      <div className="min-h-screen web3-bg text-white font-sans flex items-center justify-center">
        <PasskeyModal 
          show={showCheckpoint}
          onClose={logout}
          onVerify={handleCheckpointVerify}
          state={isVerifying ? 'processing' : 'idle'}
          title="New Device Login"
          subtitle="You must verify your Passkey to authorize this device"
          accentColor="var(--clr-emerald)"
        />
        <div className="animate-pulse text-gray-400">Verifying Security Checkpoint...</div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen web3-bg text-white font-sans">
        <SecurityProvider>
          <HelpProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={!authenticated ? <Landing /> : <Navigate to="/dashboard" />} />
                <Route path="/ledger" element={<PublicLedger />} />
                <Route path="/admin/support" element={<AdminSupport />} />
                <Route path="/dashboard" element={authenticated ? <DashboardLayout /> : <Navigate to="/" />}>
                  <Route index element={<Overview />} />
                  <Route path="send" element={<Send />} />
                  <Route path="swap" element={<Swap />} />
                  <Route path="history" element={<History />} />
                  <Route path="account" element={<Account />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </HelpProvider>
        </SecurityProvider>
      </div>
    </ThemeProvider>
  );
}

export default App;