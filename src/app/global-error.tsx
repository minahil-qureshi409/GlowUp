'use client';

import * as React from 'react';
import * as Sentry from '@sentry/nextjs';

/**
 * The last resort.
 *
 * `app/error.tsx` handles a failure inside the app shell; this handles one that
 * took the shell down with it, so it has to render its own `<html>`. It also
 * reports — an error that replaces the whole page with a blank screen is
 * exactly the kind nobody bothers to file a ticket about.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'system-ui, sans-serif',
          background: '#fdfaf7',
          color: '#2d262f',
        }}
      >
        <main style={{ maxWidth: '28rem', textAlign: 'center' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.5rem' }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: '#655e68' }}>
            Nothing you logged has been lost. Try again, and if it keeps happening it has been
            reported.
          </p>
          {error.digest ? (
            <p style={{ fontSize: '0.75rem', color: '#8a828d', marginTop: '0.75rem' }}>
              Reference {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.5rem',
              minHeight: '2.75rem',
              padding: '0 1.25rem',
              borderRadius: '0.875rem',
              border: 'none',
              background: '#8e3f6e',
              color: '#fffdfb',
              fontSize: '0.875rem',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
