import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { AmbientBackground } from '@/components/layout/ambient-background';
import { OnboardingFlow } from '@/components/onboarding/onboarding-flow';
import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getActiveHabits } from '@/services/habits';
import { getRoutines } from '@/services/skincare';
import { listProviders } from '@/lib/calendar/registry';

export const metadata: Metadata = { title: 'Welcome' };
export const dynamic = 'force-dynamic';

export default async function OnboardingPage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  // Already onboarded — there is nothing here for them.
  if (context.profile.onboarding_completed_at) redirect('/today');

  const [habits, routines] = await Promise.all([
    getActiveHabits(supabase, userId),
    getRoutines(supabase, userId),
  ]);

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <AmbientBackground />
      <div className="relative z-10">
        <OnboardingFlow
          displayName={context.profile.display_name}
          heightCm={context.profile.height_cm}
          habits={habits}
          routines={routines}
          calendarProviders={listProviders()
            .filter((provider) => provider.available && provider.configured)
            .map((provider) => ({ id: provider.id, label: provider.label }))}
        />
      </div>
    </div>
  );
}
