import Link from 'next/link';

import { SiteFooter } from '@/components/layout/site-footer';

/**
 * Legal pages are readable signed out — the signup checkbox links to them, and
 * Google's OAuth verification requires a publicly reachable privacy policy URL.
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-border">
        <div className="mx-auto w-full max-w-2xl px-5 py-4">
          <Link href="/" className="font-display text-lg tracking-tight">
            GlowUp <span aria-hidden="true">✨</span>
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-10">
        <article className="prose-glow space-y-6">{children}</article>
      </main>

      <SiteFooter />
    </div>
  );
}
