import { redirect } from 'next/navigation';

import { AmbientBackground } from '@/components/layout/ambient-background';
import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { SiteFooter } from '@/components/layout/site-footer';
import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getWeightGoal } from '@/services/weight';
import { getActiveHabits, getCompletionsInRange } from '@/services/habits';
import { currentStreak, dailyPercentMap } from '@/lib/domain/habits';
import { subDaysKey, todayIn } from '@/lib/date';
import { formatWeight } from '@/lib/format';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, userId, email } = await requireUser();
  const context = await getUserContext(supabase, userId);

  // Onboarding is a hard gate: without a timezone and a starting weight the
  // dashboard has nothing honest to show.
  if (!context.profile.onboarding_completed_at) {
    redirect('/onboarding');
  }

  const today = todayIn(context.profile.timezone);
  const streakFrom = subDaysKey(today, 120);

  const [{ goal }, habits, completions] = await Promise.all([
    getWeightGoal(supabase, userId),
    getActiveHabits(supabase, userId),
    getCompletionsInRange(supabase, userId, streakFrom, today),
  ]);

  const goalSummary = goal?.target_value
    ? `Working toward ${formatWeight(goal.target_value)}. Progress follows your actual trend.`
    : null;

  // The streak is chrome — it shows in the sidebar on every screen — so it is
  // computed once here rather than in each page that wants to mention it.
  const streakDays = currentStreak(dailyPercentMap(habits, completions, streakFrom, today), today);

  return (
    <div className="relative flex min-h-dvh">
      <AmbientBackground />

      <Sidebar
        displayName={context.profile.display_name}
        goalSummary={goalSummary}
        streakDays={streakDays}
      />

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <AppHeader
          displayName={context.profile.display_name}
          email={email}
          timezone={context.profile.timezone}
          timeFormat={context.profile.time_format}
          calendarConnected={context.calendarConnected}
        />

        {/* Bottom padding clears the fixed mobile nav; it collapses on desktop. */}
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-1 sm:px-6 lg:max-w-5xl lg:px-10">
          {children}
        </main>

        {/*
          The medical disclaimer used to live on the last step of onboarding and
          nowhere else, so most people saw it once.
        */}
        <SiteFooter className="pb-28 lg:pb-6" />
      </div>

      <BottomNav />
    </div>
  );
}
