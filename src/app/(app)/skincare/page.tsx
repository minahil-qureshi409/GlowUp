import type { Metadata } from 'next';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';

import { PageHeader } from '@/components/common/page-header';
import { EmptyState } from '@/components/common/empty-state';
import { RoutineCard } from '@/components/skincare/routine-card';
import { SkinLogCard } from '@/components/skincare/skin-log-card';
import { SkincareTimeline } from '@/components/skincare/skincare-timeline';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import {
  getEntriesForDate,
  getEntriesInRange,
  getRoutines,
  getSkinLogs,
} from '@/services/skincare';

import { attachStepStatus } from '@/lib/domain/skincare';
import { EMPTY_STATES } from '@/lib/domain/copy';
import { subDaysKey, todayIn } from '@/lib/date';

export const metadata: Metadata = { title: 'Skincare' };
export const dynamic = 'force-dynamic';

export default async function SkincarePage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  const yearAgo = subDaysKey(today, 364);

  const [routines, todayEntries, historyEntries, skinLogs] = await Promise.all([
    getRoutines(supabase, userId),
    getEntriesForDate(supabase, userId, today),
    getEntriesInRange(supabase, userId, yearAgo, today),
    getSkinLogs(supabase, userId, yearAgo, today),
  ]);

  const amRoutine = routines.find((routine) => routine.period === 'am');
  const pmRoutine = routines.find((routine) => routine.period === 'pm');

  const amEntry = todayEntries.find((entry) => entry.period === 'am');
  const pmEntry = todayEntries.find((entry) => entry.period === 'pm');

  const todaySkinLog = skinLogs.find((log) => log.log_date === today);

  return (
    <div className="animate-fade-up space-y-6 py-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PageHeader
          title="Skincare"
          description="Two routines, no pressure. Optional steps never count against you."
        />
        <Link
          href="/settings/skincare"
          className="shrink-0 px-1 pb-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Edit routine
        </Link>
      </div>

      {amRoutine || pmRoutine ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {amRoutine ? (
            <RoutineCard
              period="am"
              date={today}
              steps={attachStepStatus(amRoutine.steps, amEntry?.step_completions ?? [])}
            />
          ) : null}
          {pmRoutine ? (
            <RoutineCard
              period="pm"
              date={today}
              steps={attachStepStatus(pmRoutine.steps, pmEntry?.step_completions ?? [])}
            />
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={Sparkles}
          title={EMPTY_STATES.skincare.title}
          body="Set up your morning and evening routines in Settings → Skincare to get started."
        />
      )}

      <SkinLogCard
        date={today}
        conditions={todaySkinLog?.conditions ?? []}
        note={todaySkinLog?.note ?? null}
      />

      <SkincareTimeline today={today} entries={historyEntries} logs={skinLogs} />
    </div>
  );
}
