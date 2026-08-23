import Link from 'next/link';

import { TONE } from '@/lib/domain/copy';

/**
 * The permanent home for the medical disclaimer.
 *
 * It used to appear once, on the last step of onboarding, which meant most
 * people saw it exactly once and never again. An app holding body weight, skin
 * condition and progress photos should carry it everywhere.
 */
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={className}>
      <div className="mx-auto w-full max-w-2xl space-y-2 px-5 py-8 text-xs text-muted-foreground">
        <p>{TONE.notMedical}</p>
        <nav aria-label="Legal">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            <li>
              <Link href="/legal/privacy" className="underline-offset-4 hover:text-foreground hover:underline">
                Privacy policy
              </Link>
            </li>
            <li>
              <Link href="/legal/terms" className="underline-offset-4 hover:text-foreground hover:underline">
                Terms
              </Link>
            </li>
            <li>
              <Link href="/settings" className="underline-offset-4 hover:text-foreground hover:underline">
                Export or delete your data
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
