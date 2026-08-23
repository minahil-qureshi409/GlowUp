'use client';

import { ThemeProvider } from 'next-themes';

import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';

/**
 * There is deliberately no client-side data cache here.
 *
 * Every screen's data is fetched in a Server Component and mutated through a
 * Server Action that calls `revalidatePath`, with `useOptimistic` covering the
 * gap so a tap feels instant. A client query cache would duplicate that state
 * and give it a second chance to disagree with the database — the classic
 * source of "I ticked it but it came back untickd" bugs in habit trackers.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <TooltipProvider delayDuration={200}>
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
