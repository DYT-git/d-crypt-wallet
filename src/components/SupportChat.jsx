/* ══════════════════════════════════════════════════════
   SupportChat.jsx — Real-time message thread
   Used inside SupportBubble for active ticket view.
══════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

const API = import.meta.env.VITE_API_URL;

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── Single message bubble ── */
function MsgBubble({ msg }) {
  const isAdmin = msg.sender_type === 'admin';
  return (
    <div style={{
      display: 'flex',
      flexDirection: isAdmin ? 'row' : 'row-reverse',
      gap: 8, marginBottom: 12, alignItems: 'flex-end',
    }}>
      {/* Avatar */}
      <div style={{
        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
        background: isAdmin
          ? 'linear-gradient(135deg,var(--clr-accent-dim),var(--clr-purple-dim))'
          : 'linear-gradient(135deg,var(--clr-emerald-dim),var(--clr-cyan-dim))',
        border: `1.5px solid ${isAdmin ? 'var(--clr-accent-border)' : 'var(--clr-emerald-border)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, fontWeight: 700,
        color: isAdmin ? 'var(--clr-accent)' : 'var(--clr-emerald)',
      }}>
        {isAdmin ? 'A' : 'U'}
      </div>

      {/* Bubble */}
      <div style={{ maxWidth: '75%' }}>
        <div style={{
          background: isAdmin ? 'var(--clr-accent-dim)' : 'var(--clr-bg-card)',
          border: `1px solid ${isAdmin ? 'var(--clr-accent-border)' : 'var(--clr-border)'}`,
          borderRadius: isAdmin ? '12px 12px 12px 4px' : '12px 12px 4px 12px',
          padding: '9px 13px',
        }}>
          {msg.content && (
            <p style={{
              fontSize: 13, color: 'var(--clr-text-primary)',
              lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
            }}>
              {msg.content}
            </p>
          )}
          {/* Media attachments */}
          {Array.isArray(msg.media_urls) && msg.media_urls.length > 0 && (
            <div style={{ marginTop: msg.content ? 8 : 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {msg.media_urls.map((url, i) => {
                const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                return isImg ? (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="attachment" style={{
                      width: 120, height: 90, objectFit: 'cover',
                      borderRadius: 8, border: '1px solid var(--clr-border)',
                      cursor: 'zoom-in',
                    }} />
                  </a>
                ) : (
                  <a key={i} href={url} target="_blank" rel="noreferrer" style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    fontSize: 11, color: 'var(--clr-accent)',
                    background: 'var(--clr-accent-dim)',
                    border: '1px solid var(--clr-accent-border)',
                    borderRadius: 6, padding: '4px 10px', textDecoration: 'none',
                  }}>
                    📎 File
                  </a>
                );
              })}
            </div>
          )}
        </div>
        <p style={{
          fontSize: 9, color: 'var(--clr-text-muted)', marginTop: 3,
          textAlign: isAdmin ? 'left' : 'right',
        }}>
          {isAdmin ? 'D-CRYPT Support · ' : ''}{formatTime(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

/* ── File upload pill ── */
function FilePreview({ file, onRemove }) {
  const isImg = file.type.startsWith('image/');
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--clr-accent-dim)', border: '1px solid var(--clr-accent-border)',
      borderRadius: 20, padding: '3px 10px 3px 6px', fontSize: 11,
      color: 'var(--clr-accent)',
    }}>
      <span>{isImg ? '🖼' : '📎'}</span>
      <span style={{ maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {file.name}
      </span>
      <button onClick={onRemove} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        color: 'var(--clr-text-muted)', fontSize: 14, padding: 0, lineHeight: 1,
      }}>×</button>
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN EXPORT
════════════════════════════════════════════ */
export default function SupportChat({ ticket, userId, username, onClose, onTicketClosed }) {
  const [messages, setMessages]     = useState([]);
  const [input, setInput]           = useState('');
  const [sending, setSending]       = useState('');
  const [files, setFiles]           = useState([]);
  const [closing, setClosing]       = useState(false);
  const [showConfirmClose, setShowConfirmClose] = useState(false);
  const bottomRef  = useRef(null);
  const fileRef    = useRef(null);
  const channelRef = useRef(null);

  /* Load messages on mount */
  useEffect(() => {
    if (!ticket?.id) return;
    supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticket.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => setMessages(Array.isArray(data) ? data : []));

    /* Mark admin messages as read */
    supabase
      .from('support_messages')
      .update({ is_read: true })
      .eq('ticket_id', ticket.id)
      .eq('sender_type', 'admin')
      .eq('is_read', false)
      .then(() => {
        supabase.from('support_tickets').update({ unread_user: 0 }).eq('id', ticket.id);
      });

    /* Realtime subscription */
    channelRef.current = supabase
      .channel(`support-chat-${ticket.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'support_messages',
        filter: `ticket_id=eq.${ticket.id}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new]);
        if (payload.new.sender_type === 'admin') {
          supabase.from('support_messages').update({ is_read: true }).eq('id', payload.new.id);
          supabase.from('support_tickets').update({ unread_user: 0 }).eq('id', ticket.id);
        }
      })
      .subscribe();

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [ticket?.id]);

  /* Auto scroll to bottom */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  /* Upload files to Supabase Storage */
  const uploadFiles = async (ticketId) => {
    const urls = [];
    for (const f of files) {
      const path = `${ticketId}/${Date.now()}_${f.name}`;
      const { data, error } = await supabase.storage
        .from('support-media')
        .upload(path, f, { upsert: true });
      if (!error && data) {
        const { data: pub } = supabase.storage.from('support-media').getPublicUrl(path);
        if (pub?.publicUrl) urls.push(pub.publicUrl);
      }
    }
    return urls;
  };

  /* Send a message */
  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    setSending('sending');

    const mediaUrls = files.length > 0 ? await uploadFiles(ticket.id) : [];

    const { error } = await supabase.from('support_messages').insert({
      ticket_id:   ticket.id,
      sender_type: 'user',
      content:     input.trim() || null,
      media_urls:  mediaUrls.length ? mediaUrls : null,
    });

    if (!error) {
      /* Update ticket updated_at + unread count for admin */
      await supabase.from('support_tickets').update({
        updated_at:  new Date().toISOString(),
        unread_admin: (ticket.unread_admin || 0) + 1,
      }).eq('id', ticket.id);

      /* Email notify (follow-up message) */
      try {
        await fetch(`${API}/api/support/notify`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'new_message', ticketId: ticket.id,
            username, subject: ticket.subject,
            preview: input.slice(0, 200),
          }),
        });
      } catch (_) {}

      setInput('');
      setFiles([]);
    }
    setSending('');
  };

  /* Close ticket */
  const handleClose = async () => {
    setClosing(true);
    await supabase.from('support_tickets').update({
      status: 'closed', closed_at: new Date().toISOString(),
    }).eq('id', ticket.id);
    setClosing(false);
    setShowConfirmClose(false);
    onTicketClosed?.();
  };

  const isClosed = ticket?.status === 'closed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* ── Chat header ── */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--clr-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--clr-text-white)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              #{ticket.id} · {ticket.subject}
            </p>
            <span className={`badge ${isClosed ? 'badge-danger' : 'badge-emerald'}`} style={{ fontSize: 9, flexShrink: 0 }}>
              {isClosed ? 'CLOSED' : 'OPEN'}
            </span>
          </div>
          <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', marginTop: 2 }}>
            {formatTime(ticket.created_at)}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {!isClosed && (
            <button
              onClick={() => setShowConfirmClose(true)}
              style={{
                background: 'var(--clr-red-dim)', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 6, padding: '4px 10px', fontSize: 11,
                color: 'var(--clr-text-red)', cursor: 'pointer',
              }}
            >
              Close Ticket
            </button>
          )}
          <button onClick={onClose} style={{
            background: 'none', border: '1px solid var(--clr-border)',
            borderRadius: 6, padding: '4px 10px', fontSize: 11,
            color: 'var(--clr-text-muted)', cursor: 'pointer',
          }}>← Back</button>
        </div>
      </div>

      {/* Confirm close dialog */}
      {showConfirmClose && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 10,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 16,
        }}>
          <div style={{
            background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)',
            borderRadius: 12, padding: 24, maxWidth: 280, textAlign: 'center',
          }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>🔒</div>
            <p style={{ fontWeight: 700, color: 'var(--clr-text-white)', marginBottom: 8 }}>Close this ticket?</p>
            <p style={{ fontSize: 12, color: 'var(--clr-text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
              The chat will be archived. You can still view it in history, but cannot send new messages.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowConfirmClose(false)} style={{
                flex: 1, padding: '8px 0', background: 'transparent',
                border: '1px solid var(--clr-border)', borderRadius: 8,
                color: 'var(--clr-text-muted)', cursor: 'pointer', fontSize: 12,
              }}>Cancel</button>
              <button onClick={handleClose} disabled={closing} style={{
                flex: 1, padding: '8px 0',
                background: 'var(--clr-red-dim)', border: '1px solid rgba(220,38,38,0.4)',
                borderRadius: 8, color: 'var(--clr-text-red)', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              }}>
                {closing ? 'Closing...' : 'Yes, Close'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Messages area ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', margin: 'auto', color: 'var(--clr-text-muted)', fontSize: 12 }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>💬</div>
            Your message has been sent. We'll reply as soon as possible.
          </div>
        )}
        {messages.map(msg => <MsgBubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* ── Input area ── */}
      {!isClosed ? (
        <div style={{
          borderTop: '1px solid var(--clr-border)',
          padding: '10px 12px', flexShrink: 0,
          background: 'var(--clr-bg-surface)',
          borderRadius: '0 0 16px 16px',
        }}>
          {/* File previews */}
          {files.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {files.map((f, i) => (
                <FilePreview key={i} file={f} onRemove={() => setFiles(prev => prev.filter((_, j) => j !== i))} />
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            {/* Attachment button */}
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                background: 'none', border: '1px solid var(--clr-border)',
                borderRadius: 8, padding: '8px 9px', cursor: 'pointer',
                color: 'var(--clr-text-muted)', flexShrink: 0,
                transition: 'var(--transition-fast)',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--clr-accent)'; e.currentTarget.style.color = 'var(--clr-accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--clr-border)'; e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
              title="Attach file"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt" style={{ display: 'none' }}
              onChange={e => setFiles(prev => [...prev, ...Array.from(e.target.files || [])])} />

            {/* Text input */}
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type your message… (Enter to send, Shift+Enter for newline)"
              rows={1}
              style={{
                flex: 1, background: 'var(--clr-bg-input)',
                border: '1px solid var(--clr-border)', borderRadius: 10,
                padding: '8px 12px', fontSize: 13, color: 'var(--clr-text-primary)',
                resize: 'none', outline: 'none', fontFamily: 'inherit',
                lineHeight: 1.5, maxHeight: 100, overflowY: 'auto',
              }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!input.trim() && files.length === 0}
              style={{
                background: 'var(--clr-accent)', border: 'none', borderRadius: 8,
                padding: '8px 13px', cursor: 'pointer', flexShrink: 0,
                opacity: (!input.trim() && files.length === 0) ? 0.4 : 1,
                transition: 'var(--transition-fast)',
              }}
            >
              {sending ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
                  <line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              )}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          borderTop: '1px solid var(--clr-border)', padding: '12px 16px',
          textAlign: 'center', flexShrink: 0,
        }}>
          <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>
            This ticket is closed. View history above or open a new ticket.
          </p>
        </div>
      )}
    </div>
  );
}
