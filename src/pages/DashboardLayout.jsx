import { useState } from 'react';
import { Outlet }   from 'react-router-dom';
import Sidebar      from '../components/Sidebar';
import TopHeader    from '../components/TopHeader';
import OmniChat     from '../components/OmniChat';

/*
  DashboardLayout — The master shell (desktop + mobile)
  On desktop: sidebar is always visible (240px fixed left)
  On mobile:  sidebar slides in/out via hamburger toggle
              Overlay closes it on tap
*/
export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div style={{
      display: 'flex', height: '100vh', width: '100%',
      overflow: 'hidden', background: 'var(--clr-bg-base)', position: 'relative',
    }}>

      {/* Ambient background glows */}
      <div style={{
        position: 'fixed', bottom: -200, right: -200,
        width: 700, height: 700,
        background: 'radial-gradient(circle, rgba(192,132,252,0.06) 0%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }}/>
      <div style={{
        position: 'fixed', top: -150, left: 200,
        width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 65%)',
        pointerEvents: 'none', zIndex: 0,
      }}/>

      {/* ── Mobile overlay (tap to close sidebar) ── */}
      {sidebarOpen && (
        <div
          className="dc-sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <div className={`dc-sidebar${sidebarOpen ? ' open' : ''}`}>
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* ── Main area ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        height: '100vh', overflow: 'hidden',
        position: 'relative', zIndex: 1,
      }}>

        {/* Sticky top header — passes toggle to hamburger */}
        <TopHeader onMenuToggle={() => setSidebarOpen(o => !o)} />

        {/* Scrollable page content */}
        <main className="dashboard-main" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          <div style={{ maxWidth: 1100, margin: '0 auto', width: '100%' }}>
            <Outlet />
          </div>
        </main>

        {/* Omni-Chat AI Tutor */}
        <OmniChat />

      </div>
    </div>
  );
}