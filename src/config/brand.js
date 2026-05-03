/* ═══════════════════════════════════════════════════════════════
   D-CRYPT — Central Brand Configuration
   ─────────────────────────────────────────────────────────────────
   This is the SINGLE FILE to change when you decide on a final logo.
   Every place in the app that needs logo/brand info imports from here.

   ── HOW TO UPDATE LOGO IN FUTURE ──────────────────────────────
   1. Put your new logo files in /public:
        /public/logo.svg        (for inline use in components)
        /public/icon-192.png    (for PWA home screen)
        /public/icon-512.png    (for PWA splash screen)
        /public/favicon.svg     (for browser tab)
   2. Change LOGO_URL below to '/logo.svg' (or any URL)
   3. That's it — all components that import from this file update automatically
   ─────────────────────────────────────────────────────────────────

   ── WHERE LOGOS ARE USED ─────────────────────────────────────────
   1. Browser tab icon      → public/favicon.svg
   2. PWA home screen icon  → public/icon-192.png
   3. PWA splash screen     → public/icon-512.png
   4. Privy login modal     → src/main.jsx → appearance.logo
   5. Landing page navbar   → src/pages/Landing.jsx (text logo)
   6. Sidebar               → src/components/Sidebar.jsx (text logo)
   ═══════════════════════════════════════════════════════════════ */

export const BRAND = {
  /* ── App Name ─────────────────────────────────────────────── */
  name:       'D-CRYPT',
  shortName:  'D-CRYPT',
  tagline:    'Trustless by design, secure by default.',

  /* ── Logo ─────────────────────────────────────────────────── */
  // Set this to your logo URL once decided.
  // Must be a public HTTPS URL for Privy login modal to show it.
  // Example: '/logo.svg' for a file in /public
  //          'https://yourdomain.com/logo.png' for an absolute URL
  logoUrl: 'https://d-crypt-wallet.web.app/icon-512.png',

  /* ── Colors (must match index.css :root tokens) ──────────── */
  accentColor:     '#818cf8',   // --clr-accent
  bgDark:          '#030711',   // --clr-bg-base
  bgSurface:       '#060d1f',   // --clr-bg-surface

  /* ── Contact / Support ────────────────────────────────────── */
  supportEmail: 'humandyt@gmail.com',
  website:      'https://d-crypt-wallet.web.app',
};
