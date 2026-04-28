/* ═══════════════════════════════════════════════════════
   SendCryptoCard.jsx
   Full UI component + D-CRYPT confirmation modal.
   All logic lives in Send.jsx — this is pure display.
═══════════════════════════════════════════════════════ */
import PasskeyModal from './PasskeyModal';

/* ── Token definitions ── */
const TOKENS = [
  {
    symbol: 'ETH',  name: 'Ethereum',
    color: 'var(--clr-accent)',  dim: 'var(--clr-accent-dim)',  border: 'var(--clr-border-accent)',
    live: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
        <line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="8.5" x2="22" y2="8.5"/>
      </svg>
    ),
  },
  {
    symbol: 'USDC', name: 'USD Coin',
    color: 'var(--clr-blue)',    dim: 'var(--clr-blue-dim)',    border: 'var(--clr-blue-border)',
    live: true,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/><path d="M12 6v2m0 8v2M8 12h8"/>
      </svg>
    ),
  },
  {
    symbol: 'BNB',  name: 'BNB Chain',
    color: 'var(--clr-amber)',   dim: 'var(--clr-amber-dim)',   border: 'rgba(245,158,11,0.25)',
    live: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.5 8.5 22 9.5 17 14.5 18.5 21 12 17.5 5.5 21 7 14.5 2 9.5 8.5 8.5 12 2"/>
      </svg>
    ),
  },
  {
    symbol: 'MATIC', name: 'Polygon',
    color: 'var(--clr-purple)',  dim: 'var(--clr-purple-dim)',  border: 'var(--clr-purple-border)',
    live: false,
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
      </svg>
    ),
  },
];

function getRecipientMeta(status) {
  switch (status) {
    case 'loading':         return { color: 'var(--clr-text-muted)',   icon: '⟳', msg: 'Looking up username...' };
    case 'found':           return { color: 'var(--clr-text-emerald)', icon: '✓', msg: 'Recipient found' };
    case 'not_found':       return { color: 'var(--clr-text-red)',     icon: '✗', msg: 'Username not found on D-CRYPT' };
    case 'invalid_address': return { color: 'var(--clr-text-red)',     icon: '✗', msg: 'Invalid wallet address — must be 0x + 40 hex chars' };
    default: return null;
  }
}

function shortAddr(addr) {
  if (!addr) return '';
  return `${addr.slice(0, 10)}...${addr.slice(-6)}`;
}

/* ═══════════════════════════════════════════════════════
   D-CRYPT CONFIRMATION MODAL
═══════════════════════════════════════════════════════ */
// ConfirmModal removed as we now use PasskeyModal

/* ═══════════════════════════════════════════════════════
   MAIN CARD COMPONENT
═══════════════════════════════════════════════════════ */
export default function SendCryptoCard({
  selectedToken, setSelectedToken,
  recipientInput, setRecipientInput,
  lookupStatus, resolvedAddress, resolvedUsername,
  amountInr, setAmountInr,
  inrBalance, parsedAmount, platformFee, netAmount,
  cryptoEquiv = 0, livePrice = {}, priceLoading = false,
  canReview, handleReview,
  showConfirm, setShowConfirm,
  txState, txError, handleConfirm,
  senderUsername, senderAddress,
}) {
  const recipientMeta = getRecipientMeta(lookupStatus);
  const tokenObj      = TOKENS.find(t => t.symbol === selectedToken);
  const isOverBudget  = parsedAmount > 0 && parsedAmount > inrBalance;

  return (
    <>
      <div className="card" style={{ padding: 28 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 26 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 'var(--radius-md)',
            background: 'var(--clr-emerald-dim)', border: '1px solid var(--clr-emerald-border)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--clr-emerald)', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </div>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--clr-text-white)', marginBottom: 2 }}>
              Send via INR Fuel
            </h3>
            <p style={{ fontSize: 12, color: 'var(--clr-text-muted)' }}>
              Your INR vault pays the gas. No token holding required.
            </p>
          </div>
        </div>

        {/* ── Token selector ── */}
        <div style={{ marginBottom: 22 }}>
          <label className="input-label" style={{ marginBottom: 10, display: 'block' }}>Select Token</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {TOKENS.map(t => {
              const active = selectedToken === t.symbol;
              return (
                <button
                  key={t.symbol}
                  onClick={() => t.live && setSelectedToken(t.symbol)}
                  style={{
                    padding: '13px 14px',
                    background: active ? t.dim : 'var(--clr-bg-card)',
                    border: `1px solid ${active ? t.border : 'var(--clr-border)'}`,
                    borderRadius: 'var(--radius-md)',
                    cursor: t.live ? 'pointer' : 'default',
                    transition: 'var(--transition-fast)',
                    display: 'flex', alignItems: 'center', gap: 10,
                    opacity: t.live ? 1 : 0.5,
                    position: 'relative',
                  }}
                >
                  <span style={{ color: active ? t.color : 'var(--clr-text-muted)', flexShrink: 0 }}>
                    {t.icon}
                  </span>
                  <div style={{ textAlign: 'left', flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: active ? t.color : 'var(--clr-text-secondary)' }}>
                      {t.symbol}
                    </p>
                    <p style={{ fontSize: 10, color: 'var(--clr-text-muted)' }}>{t.name}</p>
                  </div>
                  {active && <span style={{ fontSize: 12, color: t.color }}>✓</span>}
                  {!t.live && (
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.8px',
                      textTransform: 'uppercase',
                      background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
                      color: 'var(--clr-text-amber)', padding: '2px 6px', borderRadius: 4,
                    }}>
                      Soon
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Recipient ── */}
        <div style={{ marginBottom: 18 }}>
          <label className="input-label">Recipient</label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="@username or 0x wallet address"
              value={recipientInput}
              onChange={e => setRecipientInput(e.target.value)}
              className="input input-mono"
              style={{
                paddingRight: 36,
                borderColor:
                  lookupStatus === 'found'            ? 'var(--clr-emerald-border)' :
                  lookupStatus === 'not_found'         ? 'var(--clr-border-danger)'  :
                  lookupStatus === 'invalid_address'   ? 'var(--clr-border-danger)'  : undefined,
              }}
            />
            {lookupStatus !== 'idle' && (
              <div style={{
                position: 'absolute', right: 12, top: '50%',
                transform: 'translateY(-50%)',
                color:
                  lookupStatus === 'loading' ? 'var(--clr-text-muted)' :
                  lookupStatus === 'found'   ? 'var(--clr-text-emerald)' : 'var(--clr-text-red)',
                animation: lookupStatus === 'loading' ? 'dc-spin 0.8s linear infinite' : 'none',
                fontSize: 15,
              }}>
                {lookupStatus === 'loading' ? '⟳' : lookupStatus === 'found' ? '✓' : '✗'}
              </div>
            )}
          </div>

          {recipientMeta && (
            <p className="animate-fade-in" style={{ fontSize: 11, fontWeight: 500, color: recipientMeta.color, marginTop: 6 }}>
              {recipientMeta.msg}
            </p>
          )}

          {lookupStatus === 'found' && resolvedAddress && (
            <div className="animate-fade-in" style={{
              marginTop: 8, padding: '8px 12px',
              background: 'rgba(16,185,129,0.04)',
              border: '1px solid var(--clr-emerald-border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke="var(--clr-emerald)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="2"/>
              </svg>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--clr-text-emerald)' }}>
                {resolvedUsername
                  ? `@${resolvedUsername} → ${resolvedAddress.slice(0,10)}...${resolvedAddress.slice(-6)}`
                  : `${resolvedAddress.slice(0,14)}...${resolvedAddress.slice(-8)}`}
              </span>
            </div>
          )}
        </div>

        {/* ── INR Amount ── */}
        <div style={{ marginBottom: 20 }}>
          <label className="input-label">Amount (INR)</label>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700,
              color: 'var(--clr-text-secondary)', pointerEvents: 'none',
            }}>₹</span>
            <input
              type="number"
              placeholder="0.00"
              value={amountInr}
              onChange={e => setAmountInr(e.target.value)}
              className="input input-mono"
              style={{
                paddingLeft: 32, fontSize: 20, fontWeight: 700, height: 54,
                borderColor: isOverBudget ? 'var(--clr-border-danger)' : undefined,
              }}
            />
          </div>
          {isOverBudget && (
            <p className="animate-fade-in" style={{ fontSize: 11, color: 'var(--clr-text-red)', marginTop: 6 }}>
              ✗ Insufficient balance — you have ₹{inrBalance.toFixed(2)}
            </p>
          )}

          {/* Live crypto equivalent */}
          {parsedAmount > 0 && !isOverBudget && (
            <div className="animate-fade-in" style={{
              marginTop: 8, padding: '8px 12px',
              background: 'rgba(0,229,255,0.04)',
              border: '1px solid var(--clr-border-accent)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'var(--clr-text-muted)' }}>
                ≈ Crypto equivalent
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: tokenObj?.color }}>
                {priceLoading ? '⋯' : (
                  selectedToken === 'ETH'
                    ? `${cryptoEquiv.toFixed(8)} ETH`
                    : `${cryptoEquiv.toFixed(4)} USDC`
                )}
              </span>
            </div>
          )}

          {parsedAmount > 0 && !isOverBudget && (
            <div className="animate-fade-in" style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 11, color: 'var(--clr-text-muted)',
              marginTop: 4, padding: '4px 0',
            }}>
              <span>Fee (0.5%) ₹{platformFee.toFixed(2)}</span>
              <span style={{ color: 'var(--clr-text-emerald)', fontWeight: 600 }}>
                Net: ₹{netAmount.toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* ── Review button ── */}
        <button
          onClick={handleReview}
          disabled={!canReview}
          style={{
            width: '100%', padding: 15,
            background:     canReview ? 'var(--clr-emerald)' : 'var(--clr-bg-card)',
            border:         canReview ? 'none' : '1px solid var(--clr-border)',
            color:          canReview ? '#030812' : 'var(--clr-text-muted)',
            fontFamily:     'var(--font-main)',
            fontWeight:     700, fontSize: 14,
            borderRadius:   'var(--radius-md)',
            cursor:         canReview ? 'pointer' : 'not-allowed',
            transition:     'var(--transition-med)',
            boxShadow:      canReview ? '0 6px 24px rgba(16,185,129,0.25)' : 'none',
            display:        'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          {canReview ? (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              Review Transaction
            </>
          ) : 'Complete fields above to continue'}
        </button>

      </div>

      {/* D-CRYPT Confirmation Modal */}
      <PasskeyModal
        show={showConfirm}
        onClose={() => !['sending','success'].includes(txState) && setShowConfirm(false)}
        onVerify={handleConfirm}
        state={txState === 'sending' ? 'verifying' : txState}
        errorMsg={txError}
        title={`Send ${selectedToken}`}
        subtitle="Review carefully before confirming"
        accentColor="var(--clr-accent)"
        accentDim={tokenObj?.dim || 'var(--clr-accent-dim)'}
        accentBorder={tokenObj?.border || 'var(--clr-border-accent)'}
        icon={<span style={{ color: tokenObj?.color }}>{tokenObj?.icon}</span>}
        rows={[
          { label: 'From', value: `@${senderUsername}` },
          { label: 'To', value: resolvedUsername ? `@${resolvedUsername}` : shortAddr(resolvedAddress) },
          { label: 'INR Amount', value: `₹${parsedAmount.toFixed(2)}`, highlight: true },
          { label: 'Platform Fee', value: `−₹${platformFee.toFixed(2)}`, dim: true },
          { label: 'Net Deducted', value: `₹${netAmount.toFixed(2)}`, bold: true },
        ]}
      />
    </>
  );
}