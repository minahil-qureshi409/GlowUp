import type { Metadata, Viewport } from 'next';
import { DM_Sans, Instrument_Serif } from 'next/font/google';

import { Providers } from '@/components/providers';

import './globals.css';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// The editorial serif, for headlines and hero numbers — the one place the app
// is allowed to feel like a magazine rather than a dashboard. It ships in a
// single weight, so nothing should ever ask it for bold: the browser would
// synthesise a smeared one. Size and colour carry the emphasis instead.
const instrumentSerif = Instrument_Serif({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'GlowUp',
    template: '%s · GlowUp',
  },
  description:
    'A calm wellness tracker for weight gain, strength, nutrition and skincare — built around consistency rather than a rigid schedule.',
  applicationName: 'GlowUp',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'GlowUp' },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Zoom stays enabled: pinch-to-zoom is an accessibility feature, not a bug.
  maximumScale: 5,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf7f4' },
    { media: '(prefers-color-scheme: dark)', color: '#141110' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${dmSans.variable} ${instrumentSerif.variable}`}>
      <body className="min-h-dvh bg-background font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
