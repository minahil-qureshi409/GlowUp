import type { MetadataRoute } from 'next';

/**
 * The web app manifest.
 *
 * A route rather than a static file in `public/`, for one reason that matters:
 * Next links it into every page's `<head>` automatically. The static
 * `manifest.webmanifest` that used to live in `public/` was never referenced
 * from anywhere, so no browser ever read it and "Add to Home Screen" produced
 * a bookmark instead of an installed app.
 *
 * Colours are the light-mode `--background`. They paint the splash screen and
 * the status bar during launch, so they have to track `globals.css` by hand —
 * the manifest is served as JSON and cannot read a CSS custom property.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'GlowUp',
    short_name: 'GlowUp',
    description:
      'A calm wellness tracker for weight gain, strength, nutrition and skincare — built around consistency rather than a rigid schedule.',
    // Straight to Today. Launching an installed app onto a marketing page is a
    // small insult; whoever installed it has already been sold.
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#fbf7f4',
    theme_color: '#fbf7f4',
    categories: ['health', 'fitness', 'lifestyle'],
    icons: [
      /*
       * Two purposes, deliberately separate.
       *
       * `any` is drawn as given, so it keeps its rounded corners. `maskable` is
       * composited under a shape Android chooses — a circle, a squircle, a
       * teardrop depending on the launcher — so it is full-bleed with the mark
       * pulled into the centre. Serving one file for both is how icons end up
       * with clipped corners or a small logo floating in a white square.
       */
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
