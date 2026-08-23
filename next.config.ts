import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const isDev = process.env.NODE_ENV === 'development';

/**
 * Sentry's browser SDK posts to its own ingest host, so CSP has to allow it —
 * but only when monitoring is actually switched on. With no DSN the origin
 * never appears in the policy.
 */
const sentryOrigin = (() => {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    return new URL(dsn).origin;
  } catch {
    return null;
  }
})();

/**
 * Content Security Policy.
 *
 * `script-src` still carries `'unsafe-inline'` because Next injects its own
 * bootstrap and streaming scripts inline with no nonce unless one is threaded
 * through middleware on every request. Everything else is locked down, and the
 * directives that actually stop the common attacks here — `frame-ancestors`
 * (clickjacking a page showing someone's body photos), `base-uri`, `form-action`
 * and `object-src` — are all strict.
 *
 * `'unsafe-eval'` is development only: it is what webpack's hot reload needs,
 * and it is not present in a production build.
 */
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  // Tailwind's runtime styles and next/font both emit inline <style>.
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  // blob: covers the local preview shown while a progress photo uploads.
  "img-src 'self' data: blob: https://*.supabase.co",
  `connect-src 'self' https://*.supabase.co wss://*.supabase.co${sentryOrigin ? ` ${sentryOrigin}` : ''}`,
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "media-src 'self'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  // Two years, subdomains included. Only ever honoured over HTTPS, so it is
  // inert in local development.
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing in the app uses these; a progress photo is uploaded from the file
  // picker, not the camera API.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
  },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Moved out of `experimental` — deprecated in 15.5, an error in 16.
  typedRoutes: false,
  images: {
    remotePatterns: [
      // Supabase Storage signed URLs for progress photos.
      { protocol: 'https', hostname: '*.supabase.co', pathname: '/storage/v1/object/**' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

/**
 * Sentry's build plugin uploads source maps and instruments the server bundle.
 *
 * Wrapping is unconditional but harmless without credentials: with no auth
 * token it skips the upload, and with no DSN the SDK itself is inert.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  // Source maps are uploaded, then deleted from the build output — shipping
  // them publicly would hand out the whole client source.
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  // Proxies Sentry's ingest through the app's own origin, so an ad blocker
  // does not silently swallow every error report.
  tunnelRoute: '/monitoring',
  // Strips Sentry's own debug logging from the production bundle.
  webpack: { treeshake: { removeDebugLogging: true } },
});
