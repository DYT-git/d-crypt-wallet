/*
 * D-CRYPT Service Worker
 * ─────────────────────────────────────────────────────────
 * This is a minimal "network-first" service worker.
 * It does NOT cache anything — all requests go straight
 * to the network exactly like a normal browser tab.
 *
 * Its only job is to satisfy Chrome's PWA install requirement.
 * Everything in the app (login, realtime, passkey, etc.)
 * works 100% identically to the regular website.
 *
 * ── HOW TO UPDATE ──────────────────────────────────────
 * You never need to touch this file.
 * When you deploy a new version to Firebase, users
 * automatically get the latest code on their next visit.
 * ─────────────────────────────────────────────────────────
 */

const SW_VERSION = 'v1';

/* Install — activate immediately, no waiting */
self.addEventListener('install', () => {
  self.skipWaiting();
});

/* Activate — take control of all open tabs immediately */
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

/* Fetch — pure network passthrough. Zero caching. */
self.addEventListener('fetch', event => {
  /* Skip non-GET requests and chrome-extension requests */
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  event.respondWith(fetch(event.request));
});
