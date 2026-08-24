'use client';

import * as React from 'react';

/**
 * Registers the service worker. Renders nothing.
 *
 * Production only. In development the worker would sit in front of every hot
 * reload and serve yesterday's chunks, which produces the worst class of bug —
 * one where the code on screen is not the code on disk.
 */
export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;

    // After load: registration competes with the page's own JS and CSS for
    // bandwidth, and the first paint matters more than the second visit.
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error) => {
        // Not fatal. A failed registration costs offline support and nothing
        // else, so it is logged rather than surfaced to the user.
        console.error('[sw] registration failed', error);
      });
    };

    if (document.readyState === 'complete') {
      register();
      return;
    }

    window.addEventListener('load', register);
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}

/**
 * Drops every cache the worker holds.
 *
 * Call on sign-out. The worker caches nothing personal by design, so this is
 * belt-and-braces — but sign-out is exactly the moment to be sure.
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  registration?.active?.postMessage({ type: 'CLEAR_CACHES' });
}
