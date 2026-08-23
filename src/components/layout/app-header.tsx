'use client';

import Link from 'next/link';
import { CalendarDays, LogOut, Moon, Settings, Sun } from 'lucide-react';
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

  // The theme is unknown until hydration, so the toggle's icon renders neutral
  // on the first pass rather than flashing the wrong one.
  React.useEffect(() => setMounted(true), []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/login';
  }

  return (
    <header className="pt-safe sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur-lg lg:border-none lg:bg-transparent lg:backdrop-blur-none">
      <div className="flex h-14 items-center justify-between gap-3 px-4 lg:h-16 lg:px-8">
        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/today" className="font-display text-lg font-semibold tracking-tight">
            GlowUp
          </Link>
        </div>

        <div className="hidden lg:block">
          <LiveClock timezone={timezone} timeFormat={timeFormat} />
        </div>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-sm" asChild>
            <Link href="/calendar" aria-label="Calendar">
              <span className="relative">
                <CalendarDays className="size-[18px]" aria-hidden="true" />
                {calendarConnected ? (
                  <span
                    className="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-success"
                    aria-hidden="true"
                  />
                ) : null}
              </span>
            </Link>
          </Button>

          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label={
              mounted && resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'
            }
          >
            {mounted && resolvedTheme === 'dark' ? (
              <Sun className="size-[18px]" aria-hidden="true" />
            ) : (
              <Moon className="size-[18px]" aria-hidden="true" />
            )}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-1 flex size-9 items-center justify-center rounded-full bg-gradient-brand text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
