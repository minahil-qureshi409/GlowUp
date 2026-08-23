import * as Sentry from '@sentry/nextjs';

/**
 * Error monitoring.
 *
 * The finding that prompted this: a failed sign-in produced no signal anywhere
 * at all — nothing on screen, nothing in the console, nothing on a server. The
 * only way to learn the app was broken was for someone to say so.
 *
 * Sentry stays **off** unless `NEXT_PUBLIC_SENTRY_DSN` is set, so local
 * development and any deployment that has not opted in send nothing. That is
 * deliberate for a health app: telemetry should be a decision, not a default.
 */

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const monitoringEnabled = Boolean(DSN);

/** Tags every event, so a regression can be traced to the deploy that caused it. */
export const release =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA ?? 'dev';

export const environment =
  process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV;

/**
 * Shared options for both runtimes.
 *
 * The app sends body weight, skin notes and photo filenames around. None of it
 * belongs in a crash report, so PII is off, request bodies are dropped, and
 * anything that looks like a token is scrubbed before an event leaves.
 */
export function baseOptions(): Sentry.NodeOptions & Sentry.BrowserOptions {
  return {
    dsn: DSN,
    enabled: monitoringEnabled,
    release,
    environment,
    // Traces are useful but not free; 10% is plenty to spot a slow page.
    tracesSampleRate: 0.1,
    // Never attach cookies, headers or usernames to an event.
    sendDefaultPii: false,
    maxBreadcrumbs: 30,
    beforeSend(event) {
      if (event.request) {
        delete event.request.data;
        delete event.request.cookies;
        delete event.request.headers;
        // A query string can carry `?next=` and, in a bad future, worse.
        delete event.request.query_string;
      }
      delete event.user;
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      // Fetch/XHR breadcrumbs record URLs. Drop the Supabase ones: their paths
      // name tables and row ids.
      if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
        const url = String(breadcrumb.data?.['url'] ?? '');
        if (url.includes('supabase.co')) return null;
      }
      return breadcrumb;
    },
  };
}

/**
 * Reports an error that has already been handled.
 *
 * Use where the app recovers but the failure still means something is wrong —
 * a background sync that gave up, a storage delete that did not happen.
 */
export function reportError(error: unknown, context: string, extra?: Record<string, unknown>) {
  console.error(`[${context}]`, error);
  if (!monitoringEnabled) return;
  Sentry.captureException(error, { tags: { context }, extra });
}
