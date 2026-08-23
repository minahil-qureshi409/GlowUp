'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';

/**
 * Route-level error boundary. Shows a calm message and a way out rather than a
 * stack trace — the detail is in the server logs where it belongs.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60dvh] flex-col items-center justify-center gap-4 px-6 text-center">
      <p className="font-display text-2xl font-semibold tracking-tight">That did not load</p>
      <p className="max-w-sm text-sm text-muted-foreground">
        Something went wrong on our side. Nothing you logged has been lost.
      </p>
      <div className="flex gap-2">
        <Button onClick={reset} variant="brand">
          Try again
        </Button>
      </div>
      {error.digest ? (
        <p className="text-xs text-muted-foreground">Reference: {error.digest}</p>
      ) : null}
    </div>
  );
}
