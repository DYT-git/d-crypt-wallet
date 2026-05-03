import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';

/* ═══════════════════════════════════════════════════════
   History.jsx — Public Transaction Ledger

   Shows ALL user transactions (public ledger, no auth required).
   Privacy rules:
     - Show @username (partial ok)
     - Show receiver_username OR "External User" for 0x addresses
     - Show UTR for INR deposits
     - Show clickable Etherscan link for web3_hash
     - Wallet addresses shown shortened only in expanded detail

   Types: deposit | crypto_send | inr_send | swap
═══════════════════════════════════════════════════════ */

const PAGE_SIZE = 20;

/* ── Filter tabs ── */
const FILTERS = [
  { key: 'all',         label: 'All',       color: 'var(--clr-accent)'  },
  { key: 'deposit',     label: 'Deposits',  color: 'var(--clr-blue)'    },
  { key: 'crypto_send', label: 'Sends',     color: 'var(--clr-emerald)' },
  { key: 'swap',        label: 'Swaps',     color: 'var(--clr-purple)'  },
  { key: 'inr_send',    label: 'P2P INR',   color: 'var(--clr-amber)'   },
];

/* ── Type metadata ── */
function getTxConfig(type, direction) {
  switch (type) {
    case 'deposit':
      return {
        label:      'UPI Deposit',
        badgeClass: 'badge-blue',
        color:      'var(--clr-blue)',
        colorDim:   'var(--clr-blue-dim)',
        colorBdr:   'var(--clr-blue-border)',
        prefix:     '+',
        amtColor:   'var(--clr-text-emerald)',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/>
            <polyline points="5 12 12 5 19 12"/>
          </svg>
        ),
      };
    case 'crypto_send':
      return {
        label:      'Crypto Send',
        badgeClass: 'badge-accent',
        color:      'var(--clr-accent)',
        colorDim:   'var(--clr-accent-dim)',
        colorBdr:   'var(--clr-border-accent)',
        prefix:     '−',
        amtColor:   'var(--clr-text-white)',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        ),
      };
    case 'swap':
      return {
        label:      direction === 'buy' ? 'Buy Crypto' : direction === 'sell' ? 'Sell Crypto' : 'Swap',
        badgeClass: 'badge-purple',
        color:      'var(--clr-purple)',
        colorDim:   'var(--clr-purple-dim)',
        colorBdr:   'var(--clr-purple-border)',
        prefix:     '⇄',
        amtColor:   direction === 'buy' ? 'var(--clr-accent)' : 'var(--clr-text-emerald)',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 16V4m0 0L3 8m4-4l4 4"/>
            <path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
          </svg>
        ),
      };
    case 'inr_send':
      return {
        label:      'P2P Transfer',
        badgeClass: 'badge-amber',
        color:      'var(--clr-amber)',
        colorDim:   'var(--clr-amber-dim)',
        colorBdr:   'rgba(245,158,11,0.25)',
        prefix:     '−',
        amtColor:   'var(--clr-text-amber)',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
            <polyline points="12 5 19 12 12 19"/>
          </svg>
        ),
      };
    case 'account_created':
      return {
        label:      'Account Created',
        badgeClass: 'badge-emerald',
        color:      'var(--clr-emerald)',
        colorDim:   'var(--clr-emerald-dim)',
        colorBdr:   'var(--clr-emerald-border)',
        prefix:     '🎉',
        amtColor:   'var(--clr-text-emerald)',
        icon: (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        ),
      };
    default:
      return {
        label:      type || 'Transaction',
        badgeClass: 'badge-accent',
        color:      'var(--clr-accent)',
        colorDim:   'var(--clr-accent-dim)',
        colorBdr:   'var(--clr-border-accent)',
        prefix:     '',
        amtColor:   'var(--clr-text-white)',
        icon:       null,
      };
  }
}

/* ── Helpers ── */
function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtDateShort(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit',
  });
}

function fmtTokenAmount(amount) {
  if (!amount) return '';
  const n = parseFloat(amount);
  if (isNaN(n)) return String(amount);
  if (n >= 1)    return n.toFixed(4);
  if (n >= 0.01) return n.toFixed(6);
  return n.toFixed(8);
}

function maskEmail(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const masked = local.length <= 2
    ? local[0] + '***'
    : local.slice(0, 2) + '*'.repeat(Math.min(local.length - 2, 6));
  return `${masked}@${domain}`;
}

function shorten(str, start = 8, end = 6) {
  if (!str) return '—';
  if (str.length <= start + end + 3) return str;
  return `${str.slice(0, start)}...${str.slice(-end)}`;
}

function isExternalAddress(val) {
  return val && val.startsWith('0x');
}

/* Return display name for receiver — privacy-safe */
function receiverDisplay(tx) {
  const recv = tx.receiver_username || tx.receiver_address || '';
  if (!recv) return null;
  if (isExternalAddress(recv)) return 'External User';
  return `@${recv}`;
}

/* ── Copy hook ── */
function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

/* ══════════════════════════════════════
   Expanded detail panel for a transaction
══════════════════════════════════════ */
function TxDetail({ tx, cfg }) {
  const { copied, copy } = useCopy();

  const recvDisplay = receiverDisplay(tx);

  const rows = [
    { label: 'Transaction ID', value: String(tx.id),         key: 'id',   mono: true  },
    { label: 'Type',           value: cfg.label,              key: null,   mono: false },
    { label: 'Username',       value: tx.username ? `@${tx.username}` : '—', key: 'user', mono: true },
    recvDisplay && { label: 'Recipient',  value: recvDisplay, key: null, mono: !recvDisplay.startsWith('@') },

    /* Account created: show masked email */
    tx.txn_type === 'account_created' && tx.email
      ? { label: 'Email', value: maskEmail(tx.email), key: null, mono: true }
      : null,

    /* INR deposit: show UTR */
    tx.txn_type === 'deposit' && tx.utr_number
      ? { label: 'UTR Number', value: tx.utr_number, key: 'utr', mono: true }
      : null,

    /* Crypto send / swap: show hash with link */
    tx.web3_hash
      ? { label: 'On-Chain Hash', value: tx.web3_hash, key: 'hash', mono: true, isHash: true }
      : null,

    tx.txn_type !== 'account_created'
      ? { label: 'INR Amount',
          value: `${cfg.prefix !== '⇄' && cfg.prefix !== '🎉' ? cfg.prefix : ''} ₹${Number(tx.amount_inr || 0).toFixed(2)}`,
          key: null, mono: true }
      : null,

    tx.token_amount
      ? { label: 'Token Amount', value: `${fmtTokenAmount(tx.token_amount)} ${tx.token_symbol || ''}`, key: null, mono: true }
      : null,

    { label: 'Status',    value: tx.status || 'completed', key: null, mono: false },
    { label: 'Timestamp', value: fmtDate(tx.created_at),   key: null, mono: false },
  ].filter(Boolean);

  return (
    <div className="animate-fade-in" style={{
      margin: '4px 0 8px',
      background: 'var(--clr-bg-surface)',
      border: `1px solid ${cfg.colorBdr}`,
      borderRadius: 'var(--radius-md)',
      padding: '16px 20px',
      overflow: 'hidden',
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '140px 1fr',
        gap: '8px 16px',
      }}>
        {rows.map((r) => (
          <React.Fragment key={r.label}>
            <span style={{
              fontSize: 10, color: 'var(--clr-text-muted)',
              fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.8px', paddingTop: 2, alignSelf: 'start',
            }}>
              {r.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Etherscan link for hashes */}
              {r.isHash ? (
                <a
                  href={`https://sepolia.etherscan.io/tx/${r.value}`}
                  target="_blank" rel="noreferrer"
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--clr-accent)', textDecoration: 'none',
                    fontWeight: 600, wordBreak: 'break-all',
                  }}
                  onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                  onMouseLeave={e => e.target.style.textDecoration = 'none'}
                >
                  {shorten(r.value, 10, 8)} ↗
                </a>
              ) : (
                <span style={{
                  fontSize: 12, fontWeight: 500,
                  fontFamily: r.mono ? 'var(--font-mono)' : undefined,
                  color: r.label === 'Status'
                    ? (tx.status === 'completed'
                        ? 'var(--clr-text-emerald)'
                        : 'var(--clr-text-amber)')
                    : 'var(--clr-text-secondary)',
                  wordBreak: 'break-all',
                }}>
                  {r.value || '—'}
                </span>
              )}
              {/* Copy button */}
              {r.key && r.value && r.value !== '—' && (
                <button
                  onClick={(e) => { e.stopPropagation(); copy(r.value, r.key); }}
                  style={{
                    flexShrink: 0, background: 'none', border: 'none',
                    color: copied === r.key ? 'var(--clr-text-emerald)' : 'var(--clr-text-muted)',
                    cursor: 'pointer', fontSize: 10, padding: '2px 4px',
                    transition: 'var(--transition-fast)',
                  }}
                  title="Copy"
                >
                  {copied === r.key ? '✓ Copied' : '⎘ Copy'}
                </button>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════
   Single transaction row (collapsible)
   — Desktop: grid table | Mobile: card
══════════════════════════════════════ */
function TxRow({ tx, isNew }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getTxConfig(tx.txn_type, tx.direction);
  const recv = receiverDisplay(tx);

  const amountLabel = cfg.prefix === '⇄'
    ? (tx.direction === 'buy'
        ? `${tx.token_amount} ${tx.token_symbol}`
        : `+₹${Number(tx.amount_inr || 0).toFixed(2)}`)
    : `${cfg.prefix}₹${Number(tx.amount_inr || 0).toFixed(2)}`;

  return (
    <div
      className="tx-entry animate-fade-in"
      style={{
        borderRadius: 'var(--radius-md)',
        border: isNew ? '1px solid var(--clr-border-accent)' : '1px solid transparent',
        background: isNew ? 'var(--clr-accent-dim)' : 'transparent',
        transition: 'var(--transition-med)',
        marginBottom: 2,
        overflow: 'hidden',
      }}
    >
      {/* ═══════════════════════════
          DESKTOP ROW (hidden on mobile via CSS)
      ═══════════════════════════ */}
      <div
        className="tx-desktop-row"
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'grid',
          gridTemplateColumns: '36px 1fr 160px 130px 90px',
          gap: 12, padding: '12px 14px',
          cursor: 'pointer',
          alignItems: 'center',
          borderRadius: expanded ? `var(--radius-md) var(--radius-md) 0 0` : 'var(--radius-md)',
          transition: 'var(--transition-fast)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-bg-card-hover)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Icon */}
        <div style={{
          width: 34, height: 34, borderRadius: '50%',
          background: cfg.colorDim, border: `1px solid ${cfg.colorBdr}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: cfg.color, flexShrink: 0,
        }}>{cfg.icon}</div>

        {/* User + secondary */}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: 'var(--clr-text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tx.username ? `@${tx.username}` : '—'}
            </span>
            {recv && (<>
              <span style={{ fontSize: 10, color: 'var(--clr-text-muted)' }}>→</span>
              <span style={{ fontSize: 11, fontWeight: 500, color: isExternalAddress(tx.receiver_username || tx.receiver_address) ? 'var(--clr-text-muted)' : 'var(--clr-text-secondary)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recv}</span>
            </>)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {tx.txn_type === 'deposit' && tx.utr_number && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--clr-blue)', background: 'var(--clr-blue-dim)', border: '1px solid var(--clr-blue-border)', borderRadius: 4, padding: '1px 6px' }}>UTR: {tx.utr_number}</span>
            )}
            {tx.web3_hash && (
              <a href={`https://sepolia.etherscan.io/tx/${tx.web3_hash}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--clr-accent)', textDecoration: 'none' }} onMouseEnter={e => e.target.style.textDecoration = 'underline'} onMouseLeave={e => e.target.style.textDecoration = 'none'}>{shorten(tx.web3_hash, 6, 4)} ↗</a>
            )}
            {tx.token_amount && !tx.web3_hash && (<span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--clr-text-muted)' }}>{fmtTokenAmount(tx.token_amount)} {tx.token_symbol}</span>)}
            {!tx.utr_number && !tx.web3_hash && !tx.token_amount && (<span style={{ fontSize: 10, color: 'var(--clr-text-muted)' }}>{fmtDateShort(tx.created_at)}</span>)}
          </div>
        </div>

        {/* Badge */}
        <div>
          <span className={`badge ${cfg.badgeClass}`} style={{ fontSize: 10 }}>{cfg.label}</span>
          {isNew && <span className="badge badge-emerald" style={{ fontSize: 9, marginLeft: 4 }}>NEW</span>}
        </div>

        {/* Amount */}
        <div style={{ textAlign: 'right' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: cfg.amtColor }}>{amountLabel}</p>
          {tx.token_amount && tx.txn_type !== 'swap' && (<p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--clr-text-muted)', marginTop: 2 }}>{fmtTokenAmount(tx.token_amount)} {tx.token_symbol}</p>)}
          {tx.txn_type === 'account_created' && (<p style={{ fontSize: 11, color: 'var(--clr-text-emerald)', fontWeight: 600 }}>Vault Opened</p>)}
        </div>

        {/* Date + chevron */}
        <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', fontFamily: 'var(--font-mono)' }}>{fmtDateShort(tx.created_at)}</p>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* ═══════════════════════════
          MOBILE CARD (hidden on desktop via CSS)
      ═══════════════════════════ */}
      <div
        className="tx-mobile-card"
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'none', /* CSS media query shows this on mobile */
          padding: '12px 14px',
          cursor: 'pointer',
          transition: 'var(--transition-fast)',
          gap: 10,
        }}
      >
        {/* Row 1: Icon + User info + Chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          {/* Icon avatar */}
          <div style={{
            width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
            background: cfg.colorDim, border: `1px solid ${cfg.colorBdr}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: cfg.color,
          }}>{cfg.icon}</div>

          {/* Username + recipient */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', overflow: 'hidden' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--clr-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: recv ? '45%' : '100%' }}>
                {tx.username ? `@${tx.username}` : '—'}
              </span>
              {recv && (
                <>
                  <span style={{ fontSize: 11, color: 'var(--clr-text-muted)', flexShrink: 0 }}>→</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--clr-text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{recv}</span>
                </>
              )}
            </div>
            {/* Sub-line: hash or UTR */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
              {tx.txn_type === 'deposit' && tx.utr_number && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--clr-blue)', background: 'var(--clr-blue-dim)', border: '1px solid var(--clr-blue-border)', borderRadius: 4, padding: '1px 5px' }}>UTR: {tx.utr_number}</span>
              )}
              {tx.web3_hash && (
                <a href={`https://sepolia.etherscan.io/tx/${tx.web3_hash}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--clr-accent)', textDecoration: 'none' }}>{shorten(tx.web3_hash, 5, 4)} ↗</a>
              )}
            </div>
          </div>

          {/* Chevron */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--clr-text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>

        {/* Row 2: Badge + Amount + Date */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className={`badge ${cfg.badgeClass}`} style={{ fontSize: 9 }}>{cfg.label}</span>
            {isNew && <span className="badge badge-emerald" style={{ fontSize: 9 }}>NEW</span>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: cfg.amtColor }}>{amountLabel}</p>
            {tx.txn_type === 'account_created' && <p style={{ fontSize: 10, color: 'var(--clr-text-emerald)', fontWeight: 600 }}>Vault Opened</p>}
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--clr-text-muted)', marginTop: 2 }}>{fmtDateShort(tx.created_at)}</p>
          </div>
        </div>
      </div>

      {/* Expanded detail (both desktop + mobile) */}
      {expanded && (
        <div style={{ padding: '0 14px 12px' }}>
          <TxDetail tx={tx} cfg={cfg} />
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════ */
import React from 'react';

export default function History() {
  const [allTx,       setAllTx]       = useState([]);
  const [displayed,   setDisplayed]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [activeFilter,setActiveFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [page,        setPage]        = useState(0);
  const [newTxIds,    setNewTxIds]    = useState(new Set());
  const [stats, setStats] = useState({
    total: 0, volumeTraded: 0, depositsInr: 0, users: 0,
  });

  const realtimeRef = useRef(null);
  const searchRef   = useRef(searchQuery);
  searchRef.current = searchQuery;

  /* Profile card state for username search */
  const [userProfile,    setUserProfile]    = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  /* ── Load transactions from Supabase ── */
  const loadTx = async (reset = true) => {
    if (reset) setLoading(true);

    let q = supabase
      .from('transactions')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      // Exclude pending UPI deposits — only show completed/failed in public ledger
      .not('status', 'eq', 'pending')
      .range(reset ? 0 : page * PAGE_SIZE, (reset ? 0 : page) * PAGE_SIZE + PAGE_SIZE - 1);

    const { data, error, count } = await q;

    if (error) {
      console.warn('Ledger load error:', error.message);
      setLoading(false);
      return;
    }

    const rows = Array.isArray(data) ? data : [];
    if (reset) {
      setAllTx(rows);
    } else {
      setAllTx(prev => {
        const ids = new Set(prev.map(t => t.id));
        return [...prev, ...rows.filter(r => !ids.has(r.id))];
      });
    }
    setLoading(false);
  };

  /* ── Load stats ── */
  const loadStats = async () => {
    const [
      { count: total },
      { count: users },
      { data: tradedData },
      { data: depositData },
    ] = await Promise.all([
      supabase.from('transactions').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('transactions').select('amount_inr').eq('status', 'completed').in('txn_type', ['swap', 'crypto_send', 'inr_send']).not('amount_inr', 'is', null),
      supabase.from('transactions').select('amount_inr').eq('status', 'completed').eq('txn_type', 'deposit').not('amount_inr', 'is', null),
    ]);

    const volumeTraded = Array.isArray(tradedData)
      ? tradedData.reduce((s, r) => s + (parseFloat(r.amount_inr) || 0), 0) : 0;
    const depositsInr = Array.isArray(depositData)
      ? depositData.reduce((s, r) => s + (parseFloat(r.amount_inr) || 0), 0) : 0;

    setStats({ total: total || 0, users: users || 0, volumeTraded, depositsInr });
  };

  /* ── Initial load ── */
  useEffect(() => {
    loadTx(true);
    loadStats();
  }, []);

  /* ── Supabase Realtime subscription ── */
  useEffect(() => {
    realtimeRef.current = supabase
      .channel('public-ledger')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'transactions',
      }, (payload) => {
        const newTx = payload.new;
        // Don't show pending deposits in the public ledger
        if (newTx.txn_type === 'deposit' && newTx.status === 'pending') return;
        setAllTx(prev => [newTx, ...prev]);
        setNewTxIds(prev => new Set([...prev, newTx.id]));
        setTimeout(() => {
          setNewTxIds(prev => {
            const next = new Set(prev);
            next.delete(newTx.id);
            return next;
          });
        }, 8000);
        loadStats(); // refresh stats on new tx
      })
      .subscribe();

    return () => {
      if (realtimeRef.current) supabase.removeChannel(realtimeRef.current);
    };
  }, []);

  /* ── Filter + search ── */
  useEffect(() => {
    let filtered = allTx;

    /* Type filter */
    if (activeFilter !== 'all') {
      filtered = filtered.filter(tx => tx.txn_type === activeFilter);
    }

    /* Search by username, receiver, hash, UTR */
    const q = searchQuery.trim().toLowerCase().replace(/^@/, '');
    if (q) {
      filtered = filtered.filter(tx =>
        (tx.username          || '').toLowerCase().includes(q) ||
        (tx.receiver_username || '').toLowerCase().includes(q) ||
        (tx.receiver_address  || '').toLowerCase().includes(q) ||
        (tx.web3_hash         || '').toLowerCase().includes(q) ||
        (tx.utr_number        || '').toLowerCase().includes(q) ||
        (tx.wallet_address    || '').toLowerCase().includes(q)
      );
    }

    setDisplayed(filtered.slice(0, (page + 1) * PAGE_SIZE));
  }, [allTx, activeFilter, searchQuery, page]);

  /* ── Fetch user profile when search looks like a username ── */
  useEffect(() => {
    const q = searchQuery.trim().replace(/^@/, '').toLowerCase();
    // A username search: not empty, no spaces, no 0x prefix, no hash-like string
    const looksLikeUsername = q.length >= 2 && !q.includes(' ') && !q.startsWith('0x') && q.length < 40;
    if (!looksLikeUsername) { setUserProfile(null); return; }

    const timer = setTimeout(async () => {
      setProfileLoading(true);
      try {
        const { data } = await supabase
          .from('users')
          .select('username, wallet_address, created_at')
          .ilike('username', q)
          .limit(1)
          .single();
        if (data) {
          // Count their transactions
          const { count } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('username', data.username);
          setUserProfile({ ...data, txCount: count || 0 });
        } else {
          setUserProfile(null);
        }
      } catch { setUserProfile(null); }
      setProfileLoading(false);
    }, 400); // debounce

    return () => clearTimeout(timer);
  }, [searchQuery]);

  /* ─────────────────────────────────────────────── */
  return (
    <div className="animate-fade-in">

      {/* ── Page heading ── */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{
          fontSize: 22, fontWeight: 700, letterSpacing: -0.3,
          color: 'var(--clr-text-white)', marginBottom: 4,
        }}>
          Public Ledger
        </h2>
        <p style={{ fontSize: 13, color: 'var(--clr-text-muted)' }}>
          Every transaction, on-chain and visible to everyone. Updates in real time.
        </p>
      </div>

      {/* ── Stats row ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 12, marginBottom: 24,
      }}>
        {[
          {
            label: 'Total Transactions',
            value: stats.total.toLocaleString('en-IN'),
            color: 'var(--clr-accent)',
            sub: 'All time',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
            ),
          },
          {
            label: 'Traded Volume',
            value: `₹${stats.volumeTraded.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            color: 'var(--clr-emerald)',
            sub: 'Swaps & Sends',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
            ),
          },
          {
            label: 'UPI Deposited',
            value: `₹${stats.depositsInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
            color: 'var(--clr-blue)',
            sub: 'Completed deposits',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/>
                <polyline points="5 12 12 5 19 12"/>
              </svg>
            ),
          },
          {
            label: 'Active Wallets',
            value: stats.users.toLocaleString('en-IN'),
            color: 'var(--clr-purple)',
            sub: 'Registered users',
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            ),
          },
        ].map((s) => (
          <div key={s.label} className="stat-card" style={{ minWidth: 0 }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 8,
            }}>
              <span className="stat-label" style={{ fontSize: 9 }}>{s.label}</span>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <div className="stat-value" style={{ fontSize: 18, letterSpacing: -0.5 }}>{s.value}</div>
            <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', marginTop: 4 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filter + Search bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        gap: 12, marginBottom: 16,
        flexWrap: 'wrap',
      }}>

        {/* ── User Profile Card (appears when username search matches) ── */}
        {(userProfile || profileLoading) && (
          <div style={{ width: '100%', marginBottom: 4 }}>
            {profileLoading ? (
              <div className="shimmer" style={{ height: 90, borderRadius: 'var(--radius-md)' }} />
            ) : userProfile && (
              <div style={{
                background: 'var(--clr-bg-card)',
                border: '1px solid var(--clr-accent-border)',
                borderRadius: 'var(--radius-md)',
                padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
                boxShadow: 'var(--shadow-accent)',
                animation: 'dc-fade-in 0.25s ease',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 48, height: 48, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--clr-accent-dim), var(--clr-purple-dim))',
                  border: '2px solid var(--clr-accent-border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, fontWeight: 700, color: 'var(--clr-accent)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {userProfile.username?.[0]?.toUpperCase() || '?'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: 'var(--clr-text-white)' }}>
                      @{userProfile.username}
                    </span>
                    <span className="badge badge-accent" style={{ fontSize: 9 }}>Verified User</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>Wallet</div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--clr-text-secondary)' }}>
                        {userProfile.wallet_address
                          ? `${userProfile.wallet_address.slice(0, 8)}...${userProfile.wallet_address.slice(-6)}`
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>Joined</div>
                      <span style={{ fontSize: 11, color: 'var(--clr-text-secondary)' }}>
                        {userProfile.created_at
                          ? new Date(userProfile.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '—'}
                      </span>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--clr-text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: 2 }}>Transactions</div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: 'var(--clr-accent)' }}>
                        {userProfile.txCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Dismiss */}
                <button
                  onClick={() => { setUserProfile(null); setSearchQuery(''); }}
                  style={{
                    flexShrink: 0, background: 'none', border: 'none',
                    color: 'var(--clr-text-muted)', cursor: 'pointer', fontSize: 18,
                    padding: '2px 6px', transition: 'var(--transition-fast)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--clr-text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--clr-text-muted)'}
                  title="Clear"
                >×</button>
              </div>
            )}
          </div>
        )}
        {/* Filter tabs */}
        <div style={{
          display: 'flex', gap: 4,
          background: 'var(--clr-bg-card)',
          border: '1px solid var(--clr-border)',
          borderRadius: 'var(--radius-md)',
          padding: 4, flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          {FILTERS.map((f) => {
            const active = activeFilter === f.key;
            return (
              <button
                key={f.key}
                onClick={() => { setActiveFilter(f.key); setPage(0); }}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none', cursor: 'pointer',
                  fontSize: 12, fontWeight: 600,
                  transition: 'var(--transition-fast)',
                  background: active ? `${f.color}18` : 'transparent',
                  color:      active ? f.color : 'var(--clr-text-muted)',
                  outline:    active ? `1px solid ${f.color}40` : 'none',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--clr-text-muted)" strokeWidth="2"
            strokeLinecap="round" strokeLinejoin="round"
            style={{
              position: 'absolute', left: 12, top: '50%',
              transform: 'translateY(-50%)', pointerEvents: 'none',
            }}
          >
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            type="text"
            placeholder="Search @username, 0x address, UTR, hash..."
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }}
            className="input input-mono"
            style={{ paddingLeft: 34, fontSize: 12 }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute', right: 10, top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                color: 'var(--clr-text-muted)',
                cursor: 'pointer', fontSize: 16,
              }}
            >×</button>
          )}
        </div>
      </div>

      {/* ── Transaction table ── */}
      <div className="card" style={{ overflow: 'hidden' }}>

        {/* Column headers (hidden on mobile via .tx-table-header) */}
        <div className="tx-table-header" style={{
          display: 'grid',
          gridTemplateColumns: '36px 1fr 160px 130px 90px',
          gap: 12, padding: '10px 14px',
          borderBottom: '1px solid var(--clr-border)',
        }}>
          {['', 'User / Details', 'Type', 'Amount', 'Date'].map((h, i) => (
            <p key={i} style={{
              fontSize: 10, fontWeight: 700,
              color: 'var(--clr-text-muted)',
              textTransform: 'uppercase', letterSpacing: '1.2px',
              textAlign: i >= 3 ? 'right' : 'left',
            }}>
              {h}
            </p>
          ))}
        </div>

        {/* Loading skeleton */}
        {loading && (
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="shimmer" style={{
                height: 52, borderRadius: 'var(--radius-md)',
                animationDelay: `${i * 0.07}s`,
              }}/>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && displayed.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%',
              background: 'var(--clr-bg-card)',
              border: '1px solid var(--clr-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
              color: 'var(--clr-text-muted)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <p style={{ fontSize: 14, color: 'var(--clr-text-secondary)', marginBottom: 6 }}>
              {searchQuery ? 'No results found' : 'No transactions yet'}
            </p>
            <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>
              {searchQuery
                ? 'Try a different @username, address, UTR, or hash'
                : 'Transactions appear here in real time'}
            </p>
          </div>
        )}

        {/* Rows */}
        {!loading && displayed.length > 0 && (
          <div style={{ padding: '8px' }}>
            {displayed.map((tx) => (
              <TxRow
                key={tx.id}
                tx={tx}
                isNew={newTxIds.has(tx.id)}
              />
            ))}
          </div>
        )}

        {/* Load more */}
        {!loading && displayed.length > 0 && allTx.length > displayed.length && (
          <div style={{
            borderTop: '1px solid var(--clr-border)',
            padding: '14px', textAlign: 'center',
          }}>
            <button
              onClick={() => { setPage(p => p + 1); loadTx(false); }}
              className="btn btn-secondary btn-sm"
            >
              Load more transactions
            </button>
          </div>
        )}
      </div>

      {/* ── Ledger info footer ── */}
      <div style={{
        marginTop: 16, padding: '12px 16px',
        background: 'var(--clr-accent-dim)',
        border: '1px solid var(--clr-border-accent)',
        borderRadius: 'var(--radius-md)',
        display: 'flex', alignItems: 'flex-start', gap: 10,
        flexWrap: 'wrap',
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--clr-accent)" strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round"
          style={{ flexShrink: 0, marginTop: 1 }}>
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <p style={{ fontSize: 12, color: 'var(--clr-text-secondary)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--clr-text-primary)' }}>Public ledger</strong> —
          all transactions are visible to everyone. User wallet addresses are never shown publicly.
          On-chain transactions link to{' '}
          <a href="https://sepolia.etherscan.io" target="_blank" rel="noreferrer"
            style={{ color: 'var(--clr-accent)', textDecoration: 'none', fontWeight: 600 }}>
            Sepolia Etherscan ↗
          </a>.
          Click any row for full details.
        </p>
      </div>

    </div>
  );
}