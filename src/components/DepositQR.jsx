import QRCode from 'react-qr-code';

// Handle Vite ESM/CJS interop issues where default import is an object
const QRCodeComponent = QRCode?.default || QRCode;

export default function DepositQR({ currentUsername, amount, transactionId }) {
  const safeUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return Math.random().toString(36).substring(2, 15);
  };
  const txId = transactionId || safeUUID();
  const qrValue = `upi://pay?pa=${currentUsername}@d-crypt&pn=D-CRYPT&am=${amount}&tr=${txId}`;

  return (
    <div style={{ textAlign: 'center' }}>
      {/* QR code in white box for scannability */}
      <div style={{
        background: '#ffffff',
        borderRadius: 'var(--radius-lg)',
        padding: 18, display: 'inline-block',
        marginBottom: 16,
        boxShadow: '0 0 24px rgba(0,229,255,0.1)',
      }}>
        <QRCodeComponent value={qrValue} size={180} bgColor="#fff" fgColor="#030812"/>
      </div>

      {/* Disclaimer (Crucial) */}
      <div style={{
        background: 'var(--clr-amber-dim)',
        border: '1px solid rgba(245,158,11,0.2)',
        borderRadius: 'var(--radius-sm)',
        padding: '12px 16px',
        margin: '0 auto',
        maxWidth: 320,
      }}>
        <p style={{
          fontSize: 11, color: 'var(--clr-text-amber)',
          lineHeight: 1.5, textAlign: 'left',
        }}>
          ⚠️ <strong>Disclaimer:</strong> We are currently in the testing phase. Please use the D-CRYPT Dummy UPI app for depositing. This will be replaced with real Mainnet integrations in the future.
        </p>
      </div>
    </div>
  );
}
