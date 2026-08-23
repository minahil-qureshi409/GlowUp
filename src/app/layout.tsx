import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';

import { Providers } from '@/components/providers';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

// A high-optical-size serif for headline numbers — the one place the app is
// allowed to feel editorial rather than utilitarian.
const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
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
    { media: '(prefers-color-scheme: light)', color: '#fdfaf7' },
    { media: '(prefers-color-scheme: dark)', color: '#141017' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${fraunces.variable}`}>
      <body className="min-h-dvh bg-background font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
