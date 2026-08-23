import { redirect } from 'next/navigation';

import { AppHeader } from '@/components/layout/app-header';
import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { SiteFooter } from '@/components/layout/site-footer';
import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getWeightGoal } from '@/services/weight';
import { formatWeight } from '@/lib/format';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { supabase, userId, email } = await requireUser();
  const context = await getUserContext(supabase, userId);

  // Onboarding is a hard gate: without a timezone and a starting weight the
  // dashboard has nothing honest to show.
  if (!context.profile.onboarding_completed_at) {
    redirect('/onboarding');
  }

  const { goal } = await getWeightGoal(supabase, userId);
  const goalSummary = goal?.target_value
    ? `Working toward ${formatWeight(goal.target_value)}. Progress follows your actual trend.`
    : null;

  return (
    <div className="flex min-h-dvh">
      <Sidebar displayName={context.profile.display_name} goalSummary={goalSummary} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          displayName={context.profile.display_name}
          email={email}
          timezone={context.profile.timezone}
          timeFormat={context.profile.time_format}
          calendarConnected={context.calendarConnected}
        />

        {/* Bottom padding clears the fixed mobile nav; it collapses on desktop. */}
        <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-2 sm:px-6 lg:max-w-4xl lg:px-8">
          {children}
        </main>

        {/*
          The medical disclaimer used to live on the last step of onboarding and
          nowhere else, so most people saw it once. Bottom padding clears the
          fixed mobile nav; it collapses on desktop.
        */}
        <SiteFooter className="pb-28 lg:pb-4" />
      </div>

      <BottomNav />
    </div>
  );
}
