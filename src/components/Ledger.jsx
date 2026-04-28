/* ══════════════════════════════════════════════════
   Ledger.jsx — Recent transactions widget
   Used in Overview. Shows last 10 user transactions.
══════════════════════════════════════════════════ */

function getTxMeta(tx) {
  switch (tx.txn_type) {
    case 'deposit':
      return {
        label: 'UPI Deposit',
        badge: 'badge-blue',
        icon: (
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
          </svg>
        ),
        amountColor: 'var(--clr-text-emerald)',
        prefix: '+',
      };
    case 'crypto_send':
      return {
        label: `Sent ${tx.token_symbol || 'Crypto'}`,
        badge: 'badge-accent',
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
        icon: null,
        amountColor: 'var(--clr-text-white)',
        prefix: '',
      };
  }
}

function formatTime(ts) {
  if (!ts) return '';
  return new Date(ts).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function formatTokenAmount(amount) {
  if (!amount) return '';
  const n = parseFloat(amount);
  if (isNaN(n)) return amount;
  if (n >= 1)    return n.toFixed(4);
  if (n >= 0.01) return n.toFixed(6);
  return n.toFixed(8);
}

export default function Ledger({ transactions = [] }) {
  const txList = Array.isArray(transactions) ? transactions : [];

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
          <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--clr-text-white)' }}>Recent Transactions</h3>
        </div>
        {txList.length > 0 && (
          <span className="badge badge-accent">{txList.length} total</span>
        )}
      </div>

      {/* Empty state */}
      {txList.length === 0 ? (
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {txList.map((tx) => {
            const meta = getTxMeta(tx);
            const isAccountCreated = tx.txn_type === 'account_created';
            return (
              <div key={tx.id} className="tx-row">
                {/* Icon */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'var(--clr-bg-card)', border: '1px solid var(--clr-border)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--clr-text-secondary)', flexShrink: 0,
                  }}>
                    {meta.icon}
                  </div>

                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--clr-text-primary)', marginBottom: 3 }}>
                      {meta.label}
                    </p>

                    {/* Etherscan link */}
                    {tx.web3_hash && (tx.txn_type === 'crypto_send' || tx.txn_type === 'swap') && (
                      <a href={`https://sepolia.etherscan.io/tx/${tx.web3_hash}`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: 'var(--clr-text-muted)', textDecoration: 'none', fontFamily: 'var(--font-mono)', transition: 'var(--transition-fast)' }}
                        onMouseEnter={e => e.target.style.color = 'var(--clr-accent)'}
                        onMouseLeave={e => e.target.style.color = 'var(--clr-text-muted)'}
                      >
                        {tx.web3_hash.slice(0, 14)}… ↗
                      </a>
                    )}

                    {tx.created_at && (
                      <p style={{ fontSize: 11, color: 'var(--clr-text-muted)', marginTop: tx.web3_hash ? 2 : 0 }}>
                        {formatTime(tx.created_at)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Right: amount */}
                <div style={{ textAlign: 'right' }}>
                  {!isAccountCreated && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: meta.amountColor }}>
                      {meta.prefix !== '⇄' && meta.prefix !== '🎉' && meta.prefix}{' '}
                      ₹{Number(tx.amount_inr || 0).toFixed(2)}
                    </p>
                  )}
                  {isAccountCreated && (
                    <p style={{ fontSize: 12, color: 'var(--clr-text-emerald)', fontWeight: 600 }}>Vault Opened</p>
                  )}
                  {tx.token_amount && !isAccountCreated && (
                    <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--clr-text-muted)', marginTop: 2 }}>
                      {formatTokenAmount(tx.token_amount)} {tx.token_symbol}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}