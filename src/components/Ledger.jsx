/* ══════════════════════════════════════════════════
   Ledger.jsx — Recent transactions widget (Overview)
   Shows user's own transactions with full expandable
   detail panel (same detail level as public ledger).
══════════════════════════════════════════════════ */
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

/* ── Type metadata ── */
function getTxMeta(tx) {
  switch (tx.txn_type) {
    case 'deposit':
      return {
        label: 'UPI Deposit',
        badge: 'badge-blue',
        color: 'var(--clr-blue)',
        colorDim: 'var(--clr-blue-dim)',
        colorBdr: 'var(--clr-blue-border)',
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
          </svg>
        ),
        amountColor: tx.status === 'pending'
          ? 'var(--clr-text-amber)'
          : tx.status === 'failed'
            ? 'var(--clr-text-red)'
            : 'var(--clr-text-emerald)',
        prefix: '+',
      };
    case 'crypto_send':
      return {
        label: `Sent ${tx.token_symbol || 'Crypto'}`,
        badge: 'badge-accent',
        color: 'var(--clr-accent)',
        colorDim: 'var(--clr-accent-dim)',
        colorBdr: 'var(--clr-border-accent)',
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        ),
        amountColor: 'var(--clr-text-white)',
        prefix: '−',
      };
    case 'swap':
      return {
        label: tx.direction === 'sell' ? 'Sell Crypto' : 'Buy Crypto',
        badge: 'badge-purple',
        color: 'var(--clr-purple)',
        colorDim: 'var(--clr-purple-dim)',
        colorBdr: 'var(--clr-purple-border)',
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 16V4m0 0L3 8m4-4l4 4"/><path d="M17 8v12m0 0l4-4m-4 4l-4-4"/>
          </svg>
        ),
        amountColor: 'var(--clr-accent)',
        prefix: '⇄',
      };
    case 'inr_send':
      return {
        label: 'INR Transfer',
        badge: 'badge-amber',
        color: 'var(--clr-amber)',
        colorDim: 'var(--clr-amber-dim)',
        colorBdr: 'rgba(245,158,11,0.25)',
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        ),
        amountColor: 'var(--clr-text-amber)',
        prefix: '−',
      };
    case 'account_created':
      return {
        label: 'Account Created',
        badge: 'badge-emerald',
        color: 'var(--clr-emerald)',
        colorDim: 'var(--clr-emerald-dim)',
        colorBdr: 'var(--clr-emerald-border)',
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        ),
        amountColor: 'var(--clr-text-emerald)',
        prefix: '🎉',
      };
    default:
      return {
        label: tx.txn_type || 'Transaction',
        badge: 'badge-accent',
        color: 'var(--clr-accent)',
        colorDim: 'var(--clr-accent-dim)',
        colorBdr: 'var(--clr-border-accent)',
        icon: null,
        amountColor: 'var(--clr-text-white)',
        prefix: '',
      };
  }
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatTokenAmount(amount) {
  if (!amount) return '';
  const n = parseFloat(amount);
  if (isNaN(n)) return amount;
  if (n >= 1)    return n.toFixed(4);
  if (n >= 0.01) return n.toFixed(6);
  return n.toFixed(8);
}

function shorten(str, start = 8, end = 6) {
  if (!str) return '—';
  if (str.length <= start + end + 3) return str;
  return `${str.slice(0, start)}...${str.slice(-end)}`;
}

/* ── Copy helper ── */
function useCopy() {
  const [copied, setCopied] = useState(null);
  const copy = (text, key) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };
  return { copied, copy };
}

/* ── Expanded detail panel ── */
function TxDetail({ tx, meta }) {
  const { copied, copy } = useCopy();
  const isPending = tx.status === 'pending';
  const isFailed  = tx.status === 'failed';
  const isAcct    = tx.txn_type === 'account_created';

  const rows = [
    { label: 'Transaction ID', value: String(tx.id),    key: 'id',   mono: true },
    { label: 'Type',           value: meta.label,        key: null,   mono: false },
    { label: 'Status',
      value: tx.status || 'completed',
      key: null, mono: false,
      color: isPending ? 'var(--clr-text-amber)' : isFailed ? 'var(--clr-text-red)' : 'var(--clr-text-emerald)',
    },
    tx.txn_type === 'deposit' && tx.utr_number
      ? { label: 'UTR Number', value: tx.utr_number, key: 'utr', mono: true }
      : null,
    tx.receiver_username
      ? { label: 'Recipient', value: `@${tx.receiver_username}`, key: null, mono: true }
      : tx.receiver_address
        ? { label: 'Recipient Address', value: tx.receiver_address, key: 'recv', mono: true }
        : null,
    tx.web3_hash
      ? { label: 'On-Chain Hash', value: tx.web3_hash, key: 'hash', mono: true, isHash: true }
      : null,
    !isAcct
      ? { label: 'INR Amount',
          value: `${meta.prefix !== '⇄' && meta.prefix !== '🎉' ? meta.prefix : ''}₹${Number(tx.amount_inr || 0).toFixed(2)}`,
          key: null, mono: true }
      : null,
    tx.token_amount
      ? { label: 'Token Amount', value: `${formatTokenAmount(tx.token_amount)} ${tx.token_symbol || ''}`, key: null, mono: true }
      : null,
    { label: 'Timestamp', value: formatTime(tx.created_at), key: null, mono: false },
  ].filter(Boolean);

  return (
    <div className="animate-fade-in" style={{
      margin: '4px 0 4px',
      background: 'var(--clr-bg-surface)',
      border: `1px solid ${meta.colorBdr}`,
      borderRadius: 'var(--radius-md)',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '7px 12px' }}>
        {rows.map((r) => (
          <div key={r.label} style={{ display: 'contents' }}>
            <span style={{
              fontSize: 9, color: 'var(--clr-text-muted)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.8px',
              paddingTop: 2, alignSelf: 'start',
            }}>
              {r.label}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
              {r.isHash ? (
                <a
                  href={`https://sepolia.etherscan.io/tx/${r.value}`}
                  target="_blank" rel="noreferrer"
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--clr-accent)', textDecoration: 'none',
                    wordBreak: 'break-all',
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
                  color: r.color || 'var(--clr-text-secondary)',
                  wordBreak: 'break-all',
                }}>
                  {r.value || '—'}
                </span>
              )}
              {r.key && r.value && r.value !== '—' && (
                <button
                  onClick={e => { e.stopPropagation(); copy(r.value, r.key); }}
                  style={{
                    flexShrink: 0, background: 'none', border: 'none',
                    color: copied === r.key ? 'var(--clr-text-emerald)' : 'var(--clr-text-muted)',
                    cursor: 'pointer', fontSize: 10, padding: '1px 4px',
                    transition: 'var(--transition-fast)',
                  }}
                >
                  {copied === r.key ? '✓ Copied' : '⎘ Copy'}
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Single collapsible tx row ── */
function TxRow({ tx }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getTxMeta(tx);
  const isAccountCreated = tx.txn_type === 'account_created';
  const isPending = tx.status === 'pending';
  const isFailed  = tx.status === 'failed';

  return (
    <div style={{
      borderRadius: 'var(--radius-md)',
      border: isPending
        ? '1px solid rgba(251,191,36,0.25)'
        : '1px solid var(--clr-border)',
      overflow: 'hidden',
      transition: 'var(--transition-fast)',
    }}>
      {/* Clickable summary row */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, padding: '12px 14px', cursor: 'pointer',
          background: expanded ? 'var(--clr-bg-card-hover)' : 'transparent',
          transition: 'var(--transition-fast)',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--clr-bg-card-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = expanded ? 'var(--clr-bg-card-hover)' : 'transparent'}
      >
        {/* Left: icon + label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
          <div style={{
            width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
            background: meta.colorDim, border: `1px solid ${meta.colorBdr}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: meta.color,
          }}>
            {meta.icon}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text-primary)' }}>
                {meta.label}
              </span>
              {isPending && (
                <span className="badge badge-amber" style={{ fontSize: 9, padding: '2px 6px' }}>PENDING</span>
              )}
              {isFailed && (
                <span className="badge badge-danger" style={{ fontSize: 9, padding: '2px 6px' }}>FAILED</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {tx.web3_hash && (
                <a
                  href={`https://sepolia.etherscan.io/tx/${tx.web3_hash}`}
                  target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--clr-accent)', textDecoration: 'none' }}
                  onMouseEnter={e => e.target.style.textDecoration = 'underline'}
                  onMouseLeave={e => e.target.style.textDecoration = 'none'}
                >
                  {shorten(tx.web3_hash, 5, 4)} ↗
                </a>
              )}
              {tx.txn_type === 'deposit' && tx.utr_number && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--clr-blue)', background: 'var(--clr-blue-dim)', border: '1px solid var(--clr-blue-border)', borderRadius: 4, padding: '1px 6px' }}>
                  UTR: {tx.utr_number}
                </span>
              )}
              <span style={{ fontSize: 10, color: 'var(--clr-text-muted)' }}>
                {formatTime(tx.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: amount + chevron */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ textAlign: 'right' }}>
            {!isAccountCreated && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: meta.amountColor }}>
                {meta.prefix !== '⇄' && meta.prefix !== '🎉' ? meta.prefix : ''}
                ₹{Number(tx.amount_inr || 0).toFixed(2)}
              </p>
            )}
            {isAccountCreated && (
              <p style={{ fontSize: 11, color: 'var(--clr-text-emerald)', fontWeight: 600 }}>Vault Opened</p>
            )}
            {tx.token_amount && !isAccountCreated && (
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--clr-text-muted)', marginTop: 2 }}>
                {formatTokenAmount(tx.token_amount)} {tx.token_symbol}
              </p>
            )}
          </div>
          <svg
            width="13" height="13" viewBox="0 0 24 24" fill="none"
            stroke="var(--clr-text-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: 'transform 0.2s ease', transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', flexShrink: 0 }}
          >
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{ padding: '0 12px 12px' }}>
          <TxDetail tx={tx} meta={meta} />
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════ */
export default function Ledger({ transactions = [], limit }) {
  const navigate = useNavigate();
  const [isExpanded, setIsExpanded] = useState(false);
  const txList = Array.isArray(transactions) ? transactions : [];
  const displayList = (limit && !isExpanded) ? txList.slice(0, limit) : txList;
  const hasMore = limit && txList.length > limit;

  return (
    <div className="card" style={{ padding: 22 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, paddingBottom: 14, borderBottom: '1px solid var(--clr-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 'var(--radius-md)',
            background: 'var(--clr-purple-dim)', border: '1px solid var(--clr-purple-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--clr-purple)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--clr-text-white)', lineHeight: 1 }}>Recent Transactions</h3>
            <p style={{ fontSize: 10, color: 'var(--clr-text-muted)', marginTop: 2 }}>Click any row to expand details</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {txList.length > 0 && (
            <span className="badge badge-accent">{txList.length} total</span>
          )}
          <button
            onClick={() => navigate('/ledger')}
            style={{
              background: 'none', border: '1px solid var(--clr-border)',
              borderRadius: 'var(--radius-sm)', padding: '4px 10px',
              fontSize: 11, color: 'var(--clr-text-muted)', cursor: 'pointer',
              transition: 'var(--transition-fast)',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--clr-accent)'; e.currentTarget.style.color = 'var(--clr-accent)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--clr-border)'; e.currentTarget.style.color = 'var(--clr-text-muted)'; }}
          >
            Public Ledger ↗
          </button>
        </div>
      </div>

      {/* Empty state */}
      {displayList.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px', color: 'var(--clr-text-muted)',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
            </svg>
          </div>
          <p style={{ fontSize: 14, color: 'var(--clr-text-secondary)', marginBottom: 4 }}>No transactions yet</p>
          <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>Deposit INR or send crypto to get started</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {displayList.map((tx) => (
            <TxRow key={tx.id} tx={tx} />
          ))}

          {/* Show more / less */}
          {hasMore && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              style={{
                marginTop: 4, width: '100%', padding: '11px 0',
                background: 'transparent', border: '1px solid var(--clr-border)',
                borderRadius: 'var(--radius-md)', color: 'var(--clr-accent)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'var(--transition-fast)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--clr-accent-dim)'; e.currentTarget.style.borderColor = 'var(--clr-border-accent)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--clr-border)'; }}
            >
              {isExpanded ? 'Show Less' : `View All ${txList.length} Transactions`}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'var(--transition-fast)' }}>
                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}