/* ══════════════════════════════════════════════════════
   AdminSupport.jsx — Admin panel at /admin/support
   Protected: only renders for humandyt@gmail.com
══════════════════════════════════════════════════════ */
import { useState, useEffect, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../supabase';

const ADMIN_EMAIL = 'humandyt@gmail.com';

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/* ── File upload pill ── */
function FilePreview({ file, onRemove }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: 'var(--clr-accent-dim)', border: '1px solid var(--clr-accent-border)',
      borderRadius: 20, padding: '3px 10px 3px 6px', fontSize: 11, color: 'var(--clr-accent)',
    }}>
      <span>{file.type.startsWith('image/') ? '🖼' : '📎'}</span>
      <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
      <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--clr-text-muted)', fontSize: 14, padding: 0 }}>×</button>
    </div>
  );
}

/* ── Message bubble (admin panel side) ── */
function MsgBubble({ msg }) {
  const isAdmin = msg.sender_type === 'admin';
  return (
    <div style={{
      display: 'flex', flexDirection: isAdmin ? 'row-reverse' : 'row',
      gap: 8, marginBottom: 12, alignItems: 'flex-end',
    }}>
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
      <div style={{ maxWidth: '70%' }}>
        <div style={{
          background: isAdmin ? 'var(--clr-accent-dim)' : 'var(--clr-bg-card)',
          border: `1px solid ${isAdmin ? 'var(--clr-accent-border)' : 'var(--clr-border)'}`,
          borderRadius: isAdmin ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
          padding: '9px 13px',
        }}>
          {msg.content && (
            <p style={{ fontSize: 13, color: 'var(--clr-text-primary)', lineHeight: 1.55, margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {msg.content}
            </p>
          )}
          {Array.isArray(msg.media_urls) && msg.media_urls.length > 0 && (
            <div style={{ marginTop: msg.content ? 8 : 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {msg.media_urls.map((url, i) => {
                const isImg = /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
                return isImg ? (
                  <a key={i} href={url} target="_blank" rel="noreferrer">
                    <img src={url} alt="" style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--clr-border)' }} />
                  </a>
                ) : (
                  <a key={i} href={url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: 'var(--clr-accent)', background: 'var(--clr-accent-dim)', border: '1px solid var(--clr-accent-border)', borderRadius: 6, padding: '4px 10px', textDecoration: 'none' }}>📎 File</a>
                );
              })}
            </div>
          )}
        </div>
        <p style={{ fontSize: 9, color: 'var(--clr-text-muted)', marginTop: 3, textAlign: isAdmin ? 'right' : 'left' }}>
          {isAdmin ? 'You (admin) · ' : `@${msg.username || 'user'} · `}{formatTime(msg.created_at)}
        </p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════
   TICKET DETAIL (right panel)
════════════════════════════════════════════ */
function TicketDetail({ ticket, onClosed }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput]       = useState('');
  const [files, setFiles]       = useState([]);
  const [sending, setSending]   = useState(false);
  const [closing, setClosing]   = useState(false);
  const bottomRef  = useRef(null);
  const fileRef    = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!ticket?.id) return;
    supabase.from('support_messages').select('*').eq('ticket_id', ticket.id).order('created_at', { ascending: true })
      .then(({ data }) => setMessages(Array.isArray(data) ? data : []));

    // Mark all user messages as read
    supabase.from('support_messages').update({ is_read: true }).eq('ticket_id', ticket.id).eq('sender_type', 'user').eq('is_read', false);
    supabase.from('support_tickets').update({ unread_admin: 0 }).eq('id', ticket.id);

    channelRef.current = supabase.channel(`admin-chat-${ticket.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'support_messages', filter: `ticket_id=eq.${ticket.id}` },
        (payload) => setMessages(prev => [...prev, payload.new]))
      .subscribe();

    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [ticket?.id]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const uploadFiles = async () => {
    const urls = [];
    for (const f of files) {
      const path = `${ticket.id}/${Date.now()}_${f.name}`;
      const { data, error } = await supabase.storage.from('support-media').upload(path, f, { upsert: true });
      if (!error && data) {
        const { data: pub } = supabase.storage.from('support-media').getPublicUrl(path);
        if (pub?.publicUrl) urls.push(pub.publicUrl);
      }
    }
    return urls;
  };

  const handleSend = async () => {
    if (!input.trim() && files.length === 0) return;
    setSending(true);
    const mediaUrls = files.length > 0 ? await uploadFiles() : [];
    await supabase.from('support_messages').insert({
      ticket_id: ticket.id, sender_type: 'admin',
      content: input.trim() || null,
      media_urls: mediaUrls.length ? mediaUrls : null,
    });
    await supabase.from('support_tickets').update({
      updated_at: new Date().toISOString(),
      unread_user: (ticket.unread_user || 0) + 1,
    }).eq('id', ticket.id);
    setInput(''); setFiles([]); setSending(false);
  };

  const handleClose = async () => {
    setClosing(true);
    await supabase.from('support_tickets').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', ticket.id);
    setClosing(false);
    onClosed?.();
  };

  const isClosed = ticket?.status === 'closed';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--clr-border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--clr-text-white)' }}>
                #{ticket.id} · {ticket.subject}
              </span>
              <span className={`badge ${isClosed ? 'badge-danger' : 'badge-emerald'}`} style={{ fontSize: 9 }}>
                {isClosed ? 'CLOSED' : 'OPEN'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
                👤 <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--clr-accent)' }}>@{ticket.username || '—'}</span>
              </span>
              {ticket.user_email && (
                <span style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
                  📧 <a href={`mailto:${ticket.user_email}`} style={{ color: 'var(--clr-text-secondary)', textDecoration: 'none' }}>{ticket.user_email}</a>
                </span>
              )}
              <span style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>🕐 {formatTime(ticket.created_at)}</span>
            </div>
          </div>
          {!isClosed && (
            <button onClick={handleClose} disabled={closing} style={{
              background: 'var(--clr-red-dim)', border: '1px solid rgba(220,38,38,0.35)',
              borderRadius: 8, padding: '6px 14px', fontSize: 12, color: 'var(--clr-text-red)',
              cursor: 'pointer', fontWeight: 600, flexShrink: 0,
            }}>
              {closing ? 'Closing…' : '🔒 Close Ticket'}
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
        {messages.map(msg => <MsgBubble key={msg.id} msg={msg} />)}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isClosed ? (
        <div style={{ borderTop: '1px solid var(--clr-border)', padding: '12px 20px', background: 'var(--clr-bg-surface)', flexShrink: 0 }}>
          {files.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {files.map((f, i) => <FilePreview key={i} file={f} onRemove={() => setFiles(p => p.filter((_, j) => j !== i))} />)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <button onClick={() => fileRef.current?.click()} style={{
              background: 'none', border: '1px solid var(--clr-border)', borderRadius: 8,
              padding: '8px 10px', cursor: 'pointer', color: 'var(--clr-text-muted)', flexShrink: 0,
            }} title="Attach file">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
            </button>
            <input ref={fileRef} type="file" multiple accept="image/*,.pdf,.txt" style={{ display: 'none' }}
              onChange={e => setFiles(p => [...p, ...Array.from(e.target.files || [])])} />
            <textarea
              value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
              placeholder="Type your reply… (Enter to send)"
              rows={1}
              style={{
                flex: 1, background: 'var(--clr-bg-input)', border: '1px solid var(--clr-border)',
                borderRadius: 10, padding: '8px 12px', fontSize: 13, color: 'var(--clr-text-primary)',
                resize: 'none', outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                maxHeight: 100, overflowY: 'auto',
              }}
              onInput={e => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
            />
            <button onClick={handleSend} disabled={!input.trim() && files.length === 0} style={{
              background: 'var(--clr-accent)', border: 'none', borderRadius: 8,
              padding: '8px 14px', cursor: 'pointer', flexShrink: 0,
              opacity: (!input.trim() && files.length === 0) ? 0.4 : 1,
              color: '#fff', fontSize: 12, fontWeight: 600,
            }}>
              {sending ? '…' : 'Reply →'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ borderTop: '1px solid var(--clr-border)', padding: '12px 20px', textAlign: 'center' }}>
          <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>This ticket is closed.</p>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════ */
export default function AdminSupport() {
  const { user, ready } = usePrivy();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [tickets, setTickets]         = useState([]);
  const [selected, setSelected]       = useState(null);
  const [filter, setFilter]           = useState('open');
  const [searchQ, setSearchQ]         = useState('');
  const [loading, setLoading]         = useState(true);
  const channelRef = useRef(null);

  const adminEmail = user?.email?.address || user?.google?.email || '';
  const isAdmin = adminEmail === ADMIN_EMAIL;

  /* Guard */
  useEffect(() => {
    if (ready && !isAdmin) navigate('/dashboard');
  }, [ready, isAdmin]);

  /* Load tickets */
  const loadTickets = async () => {
    setLoading(true);
    const { data } = await supabase.from('support_tickets').select('*').order('updated_at', { ascending: false });
    setTickets(Array.isArray(data) ? data : []);
    setLoading(false);
  };

  useEffect(() => { loadTickets(); }, []);

  /* Auto-select from URL param */
  useEffect(() => {
    const tid = searchParams.get('ticket');
    if (tid && tickets.length > 0) {
      const t = tickets.find(t => String(t.id) === tid);
      if (t) setSelected(t);
    }
  }, [tickets, searchParams]);

  /* Realtime */
  useEffect(() => {
    channelRef.current = supabase.channel('admin-support-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' }, () => loadTickets())
      .subscribe();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, []);

  /* Filtered list */
  const filtered = tickets.filter(t => {
    const matchFilter = filter === 'all' || t.status === filter;
    const q = searchQ.toLowerCase();
    const matchSearch = !q || (t.username || '').toLowerCase().includes(q) || (t.subject || '').toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const openCount = tickets.filter(t => t.status === 'open').length;
  const unread = tickets.reduce((s, t) => s + (t.unread_admin || 0), 0);

  if (!ready) return null;
  if (!isAdmin) return null;

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--clr-bg-base)', fontFamily: 'var(--font-main)' }}>

      {/* ── Left: Ticket List ── */}
      <div style={{
        width: 320, flexShrink: 0, borderRight: '1px solid var(--clr-border)',
        display: 'flex', flexDirection: 'column', background: 'var(--clr-bg-surface)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 14px', borderBottom: '1px solid var(--clr-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: 'linear-gradient(135deg,var(--clr-accent),var(--clr-purple))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--clr-text-white)', margin: 0 }}>Support Inbox</p>
              <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', margin: 0 }}>
                {openCount} open · {unread > 0 ? `${unread} unread` : 'all read'}
              </p>
            </div>
            <button onClick={() => navigate('/dashboard')} style={{
              marginLeft: 'auto', background: 'none', border: '1px solid var(--clr-border)',
              borderRadius: 6, padding: '3px 8px', fontSize: 10, color: 'var(--clr-text-muted)', cursor: 'pointer',
            }}>← Dashboard</button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative', marginBottom: 10 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-muted)" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search user or subject…"
              style={{
                width: '100%', background: 'var(--clr-bg-input)', border: '1px solid var(--clr-border)',
                borderRadius: 8, padding: '7px 10px 7px 28px', fontSize: 12, color: 'var(--clr-text-primary)',
                outline: 'none', boxSizing: 'border-box',
              }} />
          </div>

          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 4, background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)', borderRadius: 8, padding: 3 }}>
            {['open', 'closed', 'all'].map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                background: filter === f ? 'var(--clr-accent)' : 'transparent',
                color: filter === f ? '#fff' : 'var(--clr-text-muted)',
                transition: 'var(--transition-fast)',
                textTransform: 'capitalize',
              }}>{f}</button>
            ))}
          </div>
        </div>

        {/* Ticket rows */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading && <div className="shimmer" style={{ margin: 12, height: 60, borderRadius: 8 }} />}
          {!loading && filtered.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--clr-text-muted)', textAlign: 'center', marginTop: 40 }}>No tickets found.</p>
          )}
          {filtered.map(t => {
            const isActive = selected?.id === t.id;
            return (
              <div key={t.id} onClick={() => setSelected(t)} style={{
                padding: '12px 16px', borderBottom: '1px solid var(--clr-border)',
                cursor: 'pointer', transition: 'var(--transition-fast)',
                background: isActive ? 'var(--clr-accent-dim)' : 'transparent',
                borderLeft: isActive ? '3px solid var(--clr-accent)' : '3px solid transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--clr-accent)' }}>@{t.username || '—'}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {t.unread_admin > 0 && (
                      <span style={{
                        width: 16, height: 16, borderRadius: '50%', background: 'var(--clr-red)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 8, color: '#fff', fontWeight: 700,
                      }}>{t.unread_admin}</span>
                    )}
                    <span className={`badge ${t.status === 'open' ? 'badge-emerald' : 'badge-danger'}`} style={{ fontSize: 8 }}>
                      {t.status.toUpperCase()}
                    </span>
                  </div>
                </div>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--clr-text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.subject}
                </p>
                <p style={{ fontSize: 10, color: 'var(--clr-text-muted)' }}>#{t.id} · {formatTime(t.updated_at)}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Right: Ticket Detail ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <TicketDetail
            key={selected.id}
            ticket={selected}
            onClosed={() => { loadTickets(); setSelected(null); }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--clr-text-muted)' }}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.4 }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <p style={{ fontSize: 13 }}>Select a ticket to view the conversation</p>
          </div>
        )}
      </div>
    </div>
  );
}
