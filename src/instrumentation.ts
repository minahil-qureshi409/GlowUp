import * as Sentry from '@sentry/nextjs';

import { baseOptions } from '@/lib/monitoring';

/**
 * Server and edge initialisation.
 *
 * Next calls `register()` once per runtime before anything else runs, which is
 * the only place a server-side error reporter can be installed early enough to
 * catch a failure during startup.
 */
export async function register() {
  Sentry.init(baseOptions());
}

/**
 * Every uncaught error in a server component, route handler or server action.
 *
 * This is the hook that closes the original gap: a failure inside a server
 * action used to surface to the browser as an opaque digest and land nowhere
 * else at all.
 */
export const onRequestError = Sentry.captureRequestError;
