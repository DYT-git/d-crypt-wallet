import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import PasskeyModal from '../components/PasskeyModal';

const SecurityContext = createContext();

export function useSecurity() {
  return useContext(SecurityContext);
}

export function SecurityProvider({ children }) {
  const [isIdle, setIsIdle] = useState(false);
  const [showVerify, setShowVerify] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  
  // 15 minutes idle timeout
  const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
  const idleTimerRef = useRef(null);

  const resetIdleTimer = () => {
    if (isIdle) return; // Don't reset if already idle
    
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, IDLE_TIMEOUT_MS);
  };

  useEffect(() => {
    // Setup event listeners for user activity
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    
    const handleUserActivity = () => {
      resetIdleTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Initial start
    resetIdleTimer();

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleUserActivity);
      });
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isIdle]);

  // Intercept actions
  const requireActiveSession = (actionCallback) => {
    if (isIdle) {
      setPendingAction(() => actionCallback);
      setShowVerify(true);
    } else {
      actionCallback();
    }
  };

  const handleVerifySuccess = () => {
    setIsIdle(false);
    setShowVerify(false);
    resetIdleTimer();
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  return (
    <SecurityContext.Provider value={{ isIdle, requireActiveSession }}>
      {/* Invisible overlay to catch clicks if idle */}
      {isIdle && !showVerify && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setShowVerify(true);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999, // High z-index to catch all clicks
            cursor: 'pointer'
          }}
        />
      )}

      {children}

      {/* Verification Modal when idle */}
      <PasskeyModal
        show={showVerify}
        onClose={() => {
          // If they close without verifying, they stay idle
          setShowVerify(false);
          setPendingAction(null);
        }}
        onVerify={handleVerifySuccess}
        title="Session Paused"
        subtitle="Verify your passkey to resume"
        state="idle"
      />
    </SecurityContext.Provider>
  );
}
