'use client';

import Link from 'next/link';
import { CalendarDays, LogOut, Settings, UserRound } from 'lucide-react';
import { useTheme } from 'next-themes';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { LiveClock } from '@/components/layout/live-clock';
import { clearServiceWorkerCaches } from '@/components/pwa/service-worker';
import { initialsFrom } from '@/lib/format';
import { createClient } from '@/lib/supabase/client';
import type { Enums } from '@/lib/db/database.types';

type AppHeaderProps = {
  displayName: string | null;
  email: string | null;
  timezone: string;
  timeFormat: Enums<'time_format'>;
  calendarConnected: boolean;
};

export function AppHeader({
  displayName,
  email,
  timezone,
  timeFormat,
  calendarConnected,
}: AppHeaderProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // The theme is unknown until hydration, so the toggle renders its neutral
  // label on the first pass rather than flashing the wrong one.
  React.useEffect(() => setMounted(true), []);
  const isDark = mounted && resolvedTheme === 'dark';

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await clearServiceWorkerCaches();
    window.location.href = '/login';
  }

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-border-soft bg-background/80 backdrop-blur-xl lg:border-none lg:bg-transparent lg:backdrop-blur-none">
      <div className="flex h-16 items-center justify-between gap-3 px-4 lg:h-20 lg:px-10">
        <div className="flex items-baseline gap-3 lg:hidden">
          <Link href="/today" className="font-display text-2xl tracking-tight">
            GlowUp
          </Link>
        </div>

        <div className="hidden lg:block">
          <LiveClock timezone={timezone} timeFormat={timeFormat} />
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/calendar" aria-label="Calendar">
              <span className="relative">
                <CalendarDays className="size-[18px]" aria-hidden="true" />
                {calendarConnected ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-sage"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
            </Link>
          </Button>

          {/*
            A labelled pill rather than a sun/moon glyph. The icon-only version
            was a coin flip — half the people who pressed it expected it to show
            the mode they were in, not the one they were switching to.
          */}
          <button
            type="button"
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-subtle hover:text-foreground"
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-full bg-primary-fill transition-colors"
            />
            {mounted ? (isDark ? 'Dark' : 'Light') : 'Theme'}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex size-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label="Account menu"
              >
                {initialsFrom(displayName ?? email)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate normal-case">
                {displayName ?? email ?? 'Your account'}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/profile">
                  <UserRound aria-hidden="true" />
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/settings">
                  <Settings aria-hidden="true" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/calendar">
                  <CalendarDays aria-hidden="true" />
                  Calendar
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void signOut()}>
                <LogOut aria-hidden="true" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
