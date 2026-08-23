import * as Sentry from '@sentry/nextjs';

import { baseOptions } from '@/lib/monitoring';

/** Browser-side initialisation. Inert unless a DSN is configured. */
Sentry.init({
  ...baseOptions(),
  // Session replay is deliberately not enabled: this app puts body weight and
  // progress photos on screen, and recording those would be a privacy problem
  // dressed as a debugging tool.
  integrations: [],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
