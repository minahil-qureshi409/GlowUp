import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import { AccountData } from '@/components/settings/account-data';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getActiveHabits, getCompletionsInRange } from '@/services/habits';
import { getWeightEntries, getWeightGoal } from '@/services/weight';

import { currentStreak, dailyPercentMap } from '@/lib/domain/habits';
import { summariseWeight } from '@/lib/domain/weight';
import { subDaysKey, todayIn } from '@/lib/date';
import { formatWeightNumber, initialsFrom } from '@/lib/format';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Profile' };
export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const { supabase, userId, email } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  const from = subDaysKey(today, 89);

  const [habits, completions, entries, goalContext] = await Promise.all([
    getActiveHabits(supabase, userId),
    getCompletionsInRange(supabase, userId, from, today),
    getWeightEntries(supabase, userId, { from: subDaysKey(today, 364) }),
    getWeightGoal(supabase, userId),
  ]);

  const summary = summariseWeight(entries, {
    goalKg: goalContext.goal?.target_value ?? null,
    startKg: goalContext.goal?.start_value ?? null,
    today,
  });
  const streak = currentStreak(dailyPercentMap(habits, completions, from, today), today);

  const age = context.profile.birth_date ? yearsSince(context.profile.birth_date, today) : null;
  const goalLine = [
    goalContext.goal?.title ?? 'Build consistency',
    age !== null ? `${age}` : null,
    context.profile.height_cm ? `${context.profile.height_cm} cm` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const rows = [
    {
      href: '/settings',
      label: 'My goals',
      value: goalContext.goal ? '1 active' : 'None set',
      dot: 'bg-primary-fill',
    },
    {
      href: '/settings',
      label: 'Preferences',
      value: `${context.settings.workouts_per_week} workouts / week`,
      dot: 'bg-sage',
    },
    {
      href: '/settings',
      label: 'Notifications',
      value: context.settings.notifications_enabled ? 'On' : 'Off',
      dot: 'bg-lav',
    },
    {
      href: '/settings/habits',
      label: 'Daily habits',
      value: `${habits.length} active`,
      dot: 'bg-mauve',
    },
    {
      href: '/settings/skincare',
      label: 'Skincare routines',
      value: 'Manage steps',
      dot: 'bg-amber',
    },
    {
      href: '/calendar',
      label: 'Calendar',
      value: context.calendarConnected ? 'Connected' : 'Not connected',
      dot: 'bg-border',
    },
  ];

  return (
    <div className="animate-fade-up space-y-4 py-4">
      <section className="surface-card p-6 text-center">
        <span
          aria-hidden="true"
          className="mx-auto flex size-20 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground"
        >
          {initialsFrom(context.profile.display_name ?? email)}
        </span>
        <h1 className="mt-4 font-display text-display-sm">
          {context.profile.display_name ?? 'Your profile'}
        </h1>
        <p className="mt-1 text-[13.5px] text-muted-foreground">{goalLine}</p>

        <dl className="mt-5 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
          {[
            { k: 'Weight', v: formatWeightNumber(summary.current) },
            { k: 'Goal', v: formatWeightNumber(summary.goal) },
            { k: 'Streak', v: streak > 0 ? String(streak) : '—' },
          ].map((stat) => (
            <div key={stat.k} className="bg-accent px-2 py-3.5">
              <dt className="eyebrow !tracking-[0.12em] text-[10px]">{stat.k}</dt>
              <dd className="tabular mt-1 text-[17px] font-semibold">{stat.v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <nav aria-label="Profile settings">
        <ul className="flex flex-col gap-px overflow-hidden rounded-3xl border border-border/70 bg-border">
          {rows.map((row) => (
            <li key={row.label}>
              <Link
                href={row.href}
                className="flex items-center gap-3 bg-card px-5 py-4 transition-colors hover:bg-muted/60"
              >
                <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', row.dot)} />
                <span className="flex-1 text-[14.5px] font-medium">{row.label}</span>
                <span className="text-[13px] text-subtle">{row.value}</span>
                <ChevronRight className="size-4 shrink-0 text-subtle" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <AccountData />

      <p className="px-1 text-xs text-subtle">
        Signed in as {email ?? 'this account'}. Everything above is stored against your account
        alone.
      </p>
    </div>
  );
}

function yearsSince(birthDate: string, today: string): number {
  const birth = birthDate.split('-').map(Number);
  const now = today.split('-').map(Number);
  const [by = 0, bm = 1, bd = 1] = birth;
  const [ty = 0, tm = 1, td = 1] = now;

  let years = ty - by;
  // Not had the birthday yet this year.
  if (tm < bm || (tm === bm && td < bd)) years -= 1;
  return years;
}
