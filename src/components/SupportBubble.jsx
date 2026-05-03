/* ══════════════════════════════════════════════════════
   SupportBubble.jsx — Floating support button + slide panel
   Mounts in DashboardLayout. Persists across all pages.
══════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { supabase } from '../supabase';
import SupportChat from './SupportChat';
import { useHelp } from '../context/HelpContext';

const API = import.meta.env.VITE_API_URL;

function formatDate(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/* ════════════════════════════════════════════
   MAIN EXPORT
════════════════════════════════════════════ */
export default function SupportBubble() {
  const { user } = usePrivy();
  const { isSupportOpen, closeSupport, setUnreadSupportCount } = useHelp();

  const [view, setView]               = useState('home');  // 'home' | 'new' | 'chat' | 'history'
  const [activeTicket, setActiveTicket] = useState(null);

  /* Form state */
  const [subject, setSubject]         = useState('');
  const [firstMsg, setFirstMsg]       = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [submitErr, setSubmitErr]     = useState('');

  /* Tickets */
  const [openTicket,  setOpenTicket]  = useState(null);   // only 1 open at a time
  const [closedTickets, setClosedTickets] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading]         = useState(false);

  const walletAddress = user?.wallet?.address || '';
  const userEmail     = user?.email?.address || '';
  const channelRef    = useRef(null);

  /* ── Fetch user's tickets ── */
  const loadTickets = async () => {
    if (!walletAddress) return;
    setLoading(true);

    /* Fetch username */
    const { data: uRow } = await supabase
      .from('users').select('username').eq('wallet_address', walletAddress).maybeSingle();
    const username = uRow?.username || '';

    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .eq('user_id', walletAddress)
      .order('created_at', { ascending: false });

    const rows = Array.isArray(data) ? data : [];
    const open = rows.find(t => t.status === 'open') || null;
    const closed = rows.filter(t => t.status === 'closed');
    const unread = rows.reduce((s, t) => s + (t.unread_user || 0), 0);

    setOpenTicket(open ? { ...open, _username: username } : null);
    setClosedTickets(closed.map(t => ({ ...t, _username: username })));
    setUnreadCount(unread);
    setUnreadSupportCount(unread);
    setLoading(false);

    return { username };
  };

  useEffect(() => { loadTickets(); }, [walletAddress]);

  /* ── Listen for realtime unread changes ── */
  useEffect(() => {
    if (!walletAddress) return;
    channelRef.current = supabase
      .channel('support-unread')
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'support_tickets',
        filter: `user_id=eq.${walletAddress}`,
      }, (payload) => {
        setUnreadCount(prev => {
          const diff = (payload.new.unread_user || 0) - (payload.old?.unread_user || 0);
          const newCount = Math.max(0, prev + diff);
          setUnreadSupportCount(newCount);
          return newCount;
        });
        if (payload.new.status === 'closed') {
          loadTickets();
        }
      })
      .subscribe();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [walletAddress]);

  /* When panel opens, navigate to the right view automatically */
  useEffect(() => {
    if (isSupportOpen) {
      if (openTicket) { setActiveTicket(openTicket); setView('chat'); }
      else setView('home');
    }
  }, [isSupportOpen, openTicket]);

  /* ── Submit new ticket ── */
  const handleSubmitTicket = async () => {
    if (!subject.trim() || !firstMsg.trim()) {
      setSubmitErr('Please fill in both the subject and your message.'); return;
    }
    setSubmitting(true); setSubmitErr('');

    const { data: uRow } = await supabase
      .from('users').select('username').eq('wallet_address', walletAddress).maybeSingle();
    const username = uRow?.username || '';

    /* Create ticket */
    const { data: ticket, error } = await supabase
      .from('support_tickets')
      .insert({
        user_id:    walletAddress,
        username:   username,
        user_email: userEmail,
        subject:    subject.trim(),
        status:     'open',
        unread_admin: 1,
        unread_user: 0,
      })
      .select()
      .single();

    if (error || !ticket) {
      setSubmitErr('Failed to create ticket. Please try again.'); setSubmitting(false); return;
    }

    /* First message */
    await supabase.from('support_messages').insert({
      ticket_id:   ticket.id,
      sender_type: 'user',
      content:     firstMsg.trim(),
    });

    /* Email notify */
    try {
      await fetch(`${API}/api/support/notify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'new_ticket', ticketId: ticket.id, username,
          subject: subject.trim(), preview: firstMsg.slice(0, 200),
          userEmail,
        }),
      });
    } catch (_) {}

    setSubject(''); setFirstMsg('');
    const updated = { ...ticket, _username: username };
    setOpenTicket(updated);
    setActiveTicket(updated);
    setView('chat');
    setSubmitting(false);
  };

  return (
    <>
      {/* ── Slide-up panel ── */}
      <div style={{
        position: 'fixed', bottom: 88, right: 24, zIndex: 999,
        width: 360, height: 520,
        background: 'var(--clr-bg-surface)',
        backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
        border: '1px solid var(--clr-border)',
        borderRadius: 16,
        boxShadow: '0 24px 80px rgba(0,0,0,0.35), 0 4px 16px rgba(99,102,241,0.12)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transform: isSupportOpen ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.96)',
        opacity: isSupportOpen ? 1 : 0,
        pointerEvents: isSupportOpen ? 'all' : 'none',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        transformOrigin: 'bottom right',
      }}>

        {/* Panel header */}
        <div style={{
          padding: '14px 16px',
          background: 'linear-gradient(135deg,var(--clr-accent-dim),var(--clr-purple-dim))',
          borderBottom: '1px solid var(--clr-border)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg,var(--clr-accent),var(--clr-purple))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text-primary)', margin: 0 }}>D-CRYPT Support</p>
            <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', margin: 0 }}>
              {view === 'chat' ? 'Live chat with our team' : 'We typically reply within a few hours'}
            </p>
          </div>
          {/* Nav pills */}
          {view !== 'home' && view !== 'new' && (
            <button onClick={() => setView('home')} style={{
              background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)',
              borderRadius: 6, padding: '3px 8px', fontSize: 10,
              color: 'var(--clr-text-muted)', cursor: 'pointer',
            }}>Home</button>
          )}
          {view !== 'history' && closedTickets.length > 0 && view !== 'chat' && (
            <button onClick={() => setView('history')} style={{
              background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)',
              borderRadius: 6, padding: '3px 8px', fontSize: 10,
              color: 'var(--clr-text-muted)', cursor: 'pointer',
            }}>History</button>
          )}

          {/* Close button */}
          <button onClick={closeSupport} style={{
            background: 'transparent', border: 'none', color: 'var(--clr-text-muted)', cursor: 'pointer',
            padding: 4, display: 'flex', marginLeft: 4
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Panel body */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

          {/* HOME VIEW */}
          {view === 'home' && (
            <div style={{ padding: 20, overflowY: 'auto', height: '100%' }}>
              <p style={{ fontSize: 20 }}>👋</p>
              <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--clr-text-primary)', marginBottom: 4 }}>
                Hi{user ? '!' : ', there!'}
              </p>
              <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Need help with a transaction, deposit, or anything else? We're here.
              </p>

              {loading ? (
                <div className="shimmer" style={{ height: 52, borderRadius: 10 }} />
              ) : openTicket ? (
                <>
                  <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Active Ticket</p>
                  <div
                    onClick={() => { setActiveTicket(openTicket); setView('chat'); }}
                    style={{
                      background: 'var(--clr-accent-dim)', border: '1px solid var(--clr-accent-border)',
                      borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                      transition: 'var(--transition-fast)', marginBottom: 16,
                    }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--clr-accent)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--clr-accent-border)'}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text-primary)' }}>
                        #{openTicket.id} · {openTicket.subject}
                      </p>
                      <span className="badge badge-emerald" style={{ fontSize: 9 }}>OPEN</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 4 }}>
                      {formatDate(openTicket.created_at)} · Continue →
                    </p>
                  </div>
                </>
              ) : (
                <button
                  className="btn btn-primary"
                  onClick={() => setView('new')}
                  style={{ width: '100%', marginBottom: 16, fontSize: 13 }}
                >
                  + Open a New Ticket
                </button>
              )}

              {closedTickets.length > 0 && (
                <button
                  onClick={() => setView('history')}
                  style={{
                    width: '100%', background: 'transparent',
                    border: '1px solid var(--clr-border)', borderRadius: 8,
                    padding: '9px 0', fontSize: 12, color: 'var(--clr-text-muted)',
                    cursor: 'pointer', transition: 'var(--transition-fast)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = 'var(--clr-accent)'; e.currentTarget.style.borderColor = 'var(--clr-accent)'; }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--clr-text-muted)'; e.currentTarget.style.borderColor = 'var(--clr-border)'; }}
                >
                  View Past Tickets ({closedTickets.length})
                </button>
              )}

              <div style={{ marginTop: 24, padding: '12px', background: 'var(--clr-bg-surface)', borderRadius: 10, border: '1px solid var(--clr-border)' }}>
                <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', lineHeight: 1.6, margin: 0 }}>
                  📧 You can also email us directly at{' '}
                  <a href="mailto:humandyt@gmail.com" style={{ color: 'var(--clr-accent)', textDecoration: 'none' }}>
                    humandyt@gmail.com
                  </a>
                </p>
              </div>
            </div>
          )}

          {/* NEW TICKET VIEW */}
          {view === 'new' && (
            <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%' }}>
              <button onClick={() => setView('home')} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--clr-text-muted)', fontSize: 12, padding: 0, marginBottom: 14,
              }}>← Back</button>

              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--clr-text-primary)', marginBottom: 16 }}>
                New Support Ticket
              </p>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 11, color: 'var(--clr-text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Subject *
                </label>
                <input
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="e.g. My deposit is stuck"
                  className="input"
                  style={{ fontSize: 13 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: 'var(--clr-text-muted)', display: 'block', marginBottom: 5, textTransform: 'uppercase', letterSpacing: 1 }}>
                  Describe your issue *
                </label>
                <textarea
                  value={firstMsg}
                  onChange={e => setFirstMsg(e.target.value)}
                  placeholder="Please describe the problem in detail…"
                  rows={5}
                  style={{
                    width: '100%', background: 'var(--clr-bg-input)',
                    border: '1px solid var(--clr-border)', borderRadius: 8,
                    padding: '10px 12px', fontSize: 13, color: 'var(--clr-text-primary)',
                    resize: 'vertical', outline: 'none', fontFamily: 'inherit', lineHeight: 1.55,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {userEmail && (
                <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginBottom: 12 }}>
                  📧 Reply will be sent to <strong style={{ color: 'var(--clr-text-secondary)' }}>{userEmail}</strong>
                </p>
              )}

              {submitErr && (
                <p style={{ fontSize: 12, color: 'var(--clr-text-red)', marginBottom: 10 }}>{submitErr}</p>
              )}

              <button
                className="btn btn-primary"
                onClick={handleSubmitTicket}
                disabled={submitting}
                style={{ width: '100%', fontSize: 13 }}
              >
                {submitting ? 'Submitting…' : 'Send Ticket →'}
              </button>
            </div>
          )}

          {/* CHAT VIEW */}
          {view === 'chat' && activeTicket && (
            <div style={{ height: '100%', position: 'relative' }}>
              <SupportChat
                ticket={activeTicket}
                userId={walletAddress}
                username={activeTicket._username || ''}
                onClose={() => setView('home')}
                onTicketClosed={() => { loadTickets(); setView('home'); }}
              />
            </div>
          )}

          {/* HISTORY VIEW */}
          {view === 'history' && (
            <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%' }}>
              <button onClick={() => setView('home')} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--clr-text-muted)', fontSize: 12, padding: 0, marginBottom: 14,
              }}>← Back</button>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--clr-text-primary)', marginBottom: 14 }}>
                Past Tickets
              </p>
              {closedTickets.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--clr-text-muted)', textAlign: 'center', marginTop: 40 }}>No closed tickets yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {closedTickets.map(t => (
                    <div
                      key={t.id}
                      onClick={() => { setActiveTicket(t); setView('chat'); }}
                      style={{
                        background: 'var(--clr-bg-surface)', border: '1px solid var(--clr-border)',
                        borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--clr-border-accent)'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--clr-border)'}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text-primary)' }}>
                          #{t.id} · {t.subject}
                        </p>
                        <span className="badge badge-danger" style={{ fontSize: 9 }}>CLOSED</span>
                      </div>
                      <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', marginTop: 4 }}>
                        Closed {formatDate(t.closed_at)} · View history →
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
