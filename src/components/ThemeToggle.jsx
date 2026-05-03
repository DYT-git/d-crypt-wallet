import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ compact = false }) {
  const { theme, toggle, isDark } = useTheme();

  return (
    <button
      id="theme-toggle-btn"
      onClick={toggle}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label="Toggle theme"
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: compact ? 0 : 8,
        background: isDark
          ? 'rgba(148,163,184,0.06)'
          : 'rgba(99,102,241,0.08)',
        border: isDark
          ? '1px solid rgba(148,163,184,0.13)'
          : '1px solid rgba(99,102,241,0.25)',
        borderRadius: 'var(--radius-pill)',
        padding: compact ? '5px' : '5px 14px',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        overflow: 'hidden',
        flexShrink: 0,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = isDark
          ? 'rgba(148,163,184,0.28)'
          : 'rgba(99,102,241,0.5)';
        e.currentTarget.style.background = isDark
          ? 'rgba(148,163,184,0.1)'
          : 'rgba(99,102,241,0.14)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isDark
          ? 'rgba(148,163,184,0.13)'
          : 'rgba(99,102,241,0.25)';
        e.currentTarget.style.background = isDark
          ? 'rgba(148,163,184,0.06)'
          : 'rgba(99,102,241,0.08)';
      }}
    >
      {/* Track with sliding pill */}
      <div style={{
        position: 'relative',
        width: 36,
        height: 20,
        background: isDark
          ? 'rgba(148,163,184,0.15)'
          : 'linear-gradient(135deg, #6366f1, #818cf8)',
        borderRadius: 10,
        transition: 'background 0.4s ease',
        flexShrink: 0,
      }}>
        {/* Sliding thumb */}
        <div style={{
          position: 'absolute',
          top: 2,
          left: isDark ? 2 : 18,
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: isDark ? '#94a3b8' : '#ffffff',
          transition: 'left 0.3s cubic-bezier(0.4,0,0.2,1), background 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isDark
            ? '0 1px 4px rgba(0,0,0,0.4)'
            : '0 1px 6px rgba(99,102,241,0.4)',
        }}>
          {/* Icon inside thumb */}
          {isDark ? (
            // Moon icon
            <svg width="8" height="8" viewBox="0 0 24 24" fill="#030712" stroke="none">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
            </svg>
          ) : (
            // Sun icon
            <svg width="8" height="8" viewBox="0 0 24 24" fill="#6366f1" stroke="none">
              <circle cx="12" cy="12" r="5"/>
              <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="#6366f1" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
        </div>
      </div>

      {/* Label */}
      {!compact && (
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.5px',
          color: isDark ? 'var(--clr-text-secondary)' : 'var(--clr-accent)',
          transition: 'color 0.3s ease',
          userSelect: 'none',
        }}>
          {isDark ? 'Dark' : 'Light'}
        </span>
      )}
    </button>
  );
}
