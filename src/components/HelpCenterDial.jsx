import React, { useState, useEffect, useRef } from 'react';
import { useHelp } from '../context/HelpContext';

export default function HelpCenterDial() {
  const { openAi, openSupport, unreadSupportCount, isAiOpen, isSupportOpen } = useHelp();
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef(null);

  // ── Drag Logic for FAB ──
  const [pos, setPos] = useState({ 
    x: typeof window !== 'undefined' ? window.innerWidth - 86 : 0, 
    y: typeof window !== 'undefined' ? window.innerHeight - 86 : 0 
  });
  const isDragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleResize = () => {
      setPos(prev => ({
        x: Math.min(prev.x, window.innerWidth - 60),
        y: Math.min(prev.y, window.innerHeight - 60)
      }));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handlePointerDown = (e) => {
    isDragging.current = false;
    const rect = e.currentTarget.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e) => {
    if (e.buttons !== 1) return;
    isDragging.current = true;
    
    const newX = e.clientX - dragOffset.current.x;
    const newY = e.clientY - dragOffset.current.y;
    
    // Bounds
    const x = Math.max(10, Math.min(newX, window.innerWidth - 60));
    const y = Math.max(10, Math.min(newY, window.innerHeight - 60));
    
    setPos({ x, y });
  };

  const handlePointerUp = (e) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    // If we barely moved, treat it as a click
    if (!isDragging.current) {
      setMenuOpen(o => !o);
    }
    isDragging.current = false;
  };

  // Close menu if user clicks outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  // Hide the dial completely if either panel is actively open
  if (isAiOpen || isSupportOpen) return null;

  return (
    <div ref={containerRef} style={{ 
      position: 'fixed', 
      left: pos.x, 
      top: pos.y, 
      zIndex: 9999,
      touchAction: 'none' // prevent scrolling while dragging on mobile
    }}>
      
      {/* Expanding Menu */}
      <div style={{
        position: 'absolute', bottom: '110%', right: 0,
        display: 'flex', flexDirection: 'column', gap: 10,
        alignItems: 'flex-end',
        opacity: menuOpen ? 1 : 0,
        pointerEvents: menuOpen ? 'all' : 'none',
        transform: menuOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.9)',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        transformOrigin: 'bottom right'
      }}>
        
        <button
          onClick={() => { openAi(); setMenuOpen(false); }}
          style={{
            background: 'var(--clr-bg-surface)', border: '1px solid var(--clr-border)',
            padding: '10px 16px', borderRadius: 30, color: 'var(--clr-text-primary)',
            fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
            transition: 'var(--transition-fast)'
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--clr-accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--clr-border)'}
        >
          <span style={{ fontSize: 18 }}>🤖</span> Ask AI Tutor
        </button>

        <button
          onClick={() => { openSupport(); setMenuOpen(false); }}
          style={{
            background: 'var(--clr-bg-surface)', border: '1px solid var(--clr-border)',
            padding: '10px 16px', borderRadius: 30, color: 'var(--clr-text-primary)',
            fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.3)', whiteSpace: 'nowrap',
            transition: 'var(--transition-fast)'
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--clr-accent)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--clr-border)'}
        >
          <span style={{ fontSize: 18 }}>💬</span> Human Support
          {unreadSupportCount > 0 && (
            <span style={{
              background: 'var(--clr-red)', color: '#fff', fontSize: 11, fontWeight: 'bold',
              padding: '2px 6px', borderRadius: 10, marginLeft: 4
            }}>
              {unreadSupportCount}
            </span>
          )}
        </button>
      </div>

      {/* Main Floating Button */}
      <button
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          width: 56, height: 56, borderRadius: '50%',
          background: menuOpen 
            ? 'var(--clr-bg-surface)' 
            : 'linear-gradient(135deg, var(--clr-accent), var(--clr-purple))',
          border: `2px solid ${menuOpen ? 'var(--clr-border)' : 'transparent'}`,
          boxShadow: menuOpen ? 'none' : '0 8px 24px rgba(99,102,241,0.40)',
          cursor: isDragging.current ? 'grabbing' : 'grab',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: isDragging.current ? 'none' : 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
          transform: menuOpen ? 'rotate(45deg)' : 'rotate(0deg)'
        }}
        title="Help Center"
        onMouseEnter={(e) => { if(!isDragging.current) e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={(e) => { if(!isDragging.current) e.currentTarget.style.transform = menuOpen ? 'rotate(45deg) scale(1)' : 'rotate(0deg) scale(1)'; }}
      >
        {menuOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-muted)" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
            <line x1="12" y1="17" x2="12.01" y2="17"></line>
          </svg>
        )}

        {/* Global Unread Badge */}
        {!menuOpen && unreadSupportCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 18, height: 18, borderRadius: '50%',
            background: 'var(--clr-red)', border: '2px solid var(--clr-bg-base)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 700, color: '#fff',
          }}>
            {unreadSupportCount > 9 ? '9+' : unreadSupportCount}
          </span>
        )}
      </button>

    </div>
  );
}
