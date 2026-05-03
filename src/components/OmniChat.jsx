import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useHelp } from '../context/HelpContext';

// Create a mapping of pathnames to friendly names
const PAGE_MAP = {
  '/dashboard': 'Overview Dashboard',
  '/dashboard/send': 'Send Crypto (INR Funded)',
  '/dashboard/swap': 'Swap Crypto ↔ INR',
  '/dashboard/history': 'Ledger & Transaction History',
  '/dashboard/account': 'Account Settings & MFA',
  '/': 'Landing Page'
};

export default function OmniChat() {
  const { isAiOpen, closeAi } = useHelp();
  const [messages, setMessages] = useState([
    { role: 'ai', text: "Hello! I'm your D-CRYPT AI Tutor. I see you're exploring the vault. How can I help you with Web3, crypto, or transactions today?" }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const location = useLocation();
  const currentPage = PAGE_MAP[location.pathname] || 'Dashboard';

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsLoading(true);

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/ask-tutor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, currentPage })
      });
      
      const data = await response.json();
      if (data.success) {
        setMessages(prev => [...prev, { role: 'ai', text: data.text }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: `❌ ${data.error}` }]);
      }
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { role: 'ai', text: `❌ Request Failed: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* ── Slide-out Drawer ── */}
      <div style={{
        position: 'fixed', top: 0, right: isAiOpen ? 0 : '-400px',
        width: '100%', maxWidth: '380px', height: '100vh',
        background: 'var(--clr-bg-surface)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        borderLeft: '1px solid rgba(0, 229, 255, 0.15)',
        boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
        zIndex: 10000, transition: 'right 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'linear-gradient(90deg, rgba(0, 229, 255, 0.05) 0%, transparent 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: '50%',
              background: 'var(--clr-accent-dim)', border: '1px solid var(--clr-border-accent)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--clr-accent)'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2a10 10 0 1 0 10 10H12V2z"/>
                <path d="M12 12 2.1 7.1"/><path d="M12 12l9.9 4.9"/>
              </svg>
            </div>
            <div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--clr-text-primary)', letterSpacing: '0.5px' }}>D-CRYPT AI</h3>
              <p style={{ fontSize: 11, color: 'var(--clr-accent)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>Web3 Tutor</p>
            </div>
          </div>
          <button onClick={closeAi} style={{
            background: 'transparent', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer',
            padding: 4, display: 'flex'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Context Badge */}
        <div style={{
          background: 'var(--clr-bg-surface)', padding: '6px 20px',
          borderBottom: '1px solid var(--clr-border)',
          display: 'flex', alignItems: 'center', gap: 6
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--clr-emerald)', boxShadow: '0 0 6px var(--clr-emerald)' }} />
          <span style={{ fontSize: 10, color: 'var(--clr-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
            Context: {currentPage}
          </span>
        </div>

        {/* Chat History */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              <div style={{
                maxWidth: '85%', padding: '12px 16px',
                borderRadius: m.role === 'user' ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                background: m.role === 'user' ? 'var(--clr-accent)' : 'var(--clr-bg-input)',
                border: m.role === 'user' ? 'none' : '1px solid var(--clr-border)',
                color: m.role === 'user' ? '#030812' : 'var(--clr-text-primary)',
                fontSize: 14, lineHeight: 1.5,
                boxShadow: m.role === 'user' ? '0 4px 14px rgba(0,229,255,0.2)' : 'none'
              }}>
                {m.role === 'ai' ? (
                  <div className="prose prose-invert prose-sm" style={{ margin: 0, padding: 0 }}>
                    <ReactMarkdown>{m.text}</ReactMarkdown>
                  </div>
                ) : (
                  <span style={{ fontWeight: 500 }}>{m.text}</span>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                background: 'var(--clr-bg-input)', border: '1px solid var(--clr-border)',
                borderRadius: '20px 20px 20px 4px', padding: '12px 16px', display: 'flex', gap: 4
              }}>
                <span className="dot-bounce" style={{ animationDelay: '0s' }}>.</span>
                <span className="dot-bounce" style={{ animationDelay: '0.2s' }}>.</span>
                <span className="dot-bounce" style={{ animationDelay: '0.4s' }}>.</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ padding: '20px', borderTop: '1px solid var(--clr-border)', background: 'var(--clr-bg-surface)' }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Ask me anything about Web3..."
              style={{
                flex: 1, background: 'var(--clr-bg-input)', border: '1px solid var(--clr-border)',
                borderRadius: 'var(--radius-md)', padding: '12px 16px', color: 'var(--clr-text-primary)', outline: 'none',
                fontSize: 14, transition: 'var(--transition-fast)'
              }}
              onFocus={e => e.target.style.borderColor = 'var(--clr-accent)'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              style={{
                width: 44, height: 44, borderRadius: 'var(--radius-md)',
                background: 'var(--clr-accent)', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#030812', cursor: (!isLoading && input.trim()) ? 'pointer' : 'not-allowed',
                opacity: (!isLoading && input.trim()) ? 1 : 0.5, transition: 'var(--transition-fast)'
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <span style={{ fontSize: 10, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>
              Powered by Google Gemini 2.5
            </span>
          </div>
        </div>
      </div>
      
      {/* CSS for dot bounce animation */}
      <style>{`
        @keyframes dot-bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-3px); opacity: 1; }
        }
        .dot-bounce {
          display: inline-block;
          font-weight: bold;
          color: var(--clr-accent);
          animation: dot-bounce 1s infinite;
        }
        
        /* Markdown overrides for chat bubbles */
        .prose p { margin-bottom: 0.5em; }
        .prose p:last-child { margin-bottom: 0; }
        .prose a { color: var(--clr-accent); text-decoration: underline; }
        .prose code { background: rgba(255,255,255,0.1); padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        .prose pre { background: rgba(0,0,0,0.3); padding: 10px; border-radius: 8px; overflow-x: auto; margin: 0.5em 0; }
        .prose ul, .prose ol { margin-left: 20px; margin-bottom: 0.5em; }
        .prose strong { color: var(--clr-text-primary); }
      `}</style>
    </>
  );
}
