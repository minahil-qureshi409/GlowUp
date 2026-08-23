import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { GlowUpTimeline } from '@/components/progress/glow-up-timeline';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getWeightEntries, getWeightGoal } from '@/services/weight';
import { getActiveHabits, getCompletionsInRange } from '@/services/habits';
import { getSetHistory, getWorkouts } from '@/services/workouts';
import { getEntriesInRange } from '@/services/skincare';
import { getProgressPhotos, getTimelineMilestones, getWeeklyReviews } from '@/services/progress';

import { subDaysKey, todayIn } from '@/lib/date';

export const metadata: Metadata = { title: 'Glow-Up timeline' };
export const dynamic = 'force-dynamic';

export default async function TimelinePage() {
  const { supabase, userId } = await requireUser();
  const context = await getUserContext(supabase, userId);

  const today = todayIn(context.profile.timezone);
  // A year of data covers every range filter, so the client can switch
  // between 1m / 3m / 6m / 1y without another round trip.
  const yearAgo = subDaysKey(today, 364);

  const [
    weightEntries,
    goalContext,
    habits,
    completions,
    workouts,
    setHistory,
    skincareEntries,
    reviews,
    milestones,
    photos,
  ] = await Promise.all([
    getWeightEntries(supabase, userId, { from: yearAgo }),
    getWeightGoal(supabase, userId),
    getActiveHabits(supabase, userId),
    getCompletionsInRange(supabase, userId, yearAgo, today),
    getWorkouts(supabase, userId, { from: yearAgo }),
    getSetHistory(supabase, userId, yearAgo),
    getEntriesInRange(supabase, userId, yearAgo, today),
    getWeeklyReviews(supabase, userId, 60),
    getTimelineMilestones(supabase, userId, yearAgo),
    getProgressPhotos(supabase, userId, { from: yearAgo, limit: 60 }),
  ]);

  const { data: exercises } = await supabase
    .from('exercises')
    .select('id, name')
    .eq('user_id', userId);

  return (
    <div className="animate-fade-up space-y-5 py-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/progress" aria-label="Back to progress">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">Glow-Up timeline</h1>
          <p className="text-xs text-muted-foreground">
            Everything in one place, week by week.
          </p>
        </div>
      </div>

      <GlowUpTimeline
        today={today}
        weightEntries={weightEntries}
        goalKg={goalContext.goal?.target_value ?? null}
        habits={habits}
        completions={completions}
        workouts={workouts}
        setHistory={setHistory}
        exercises={exercises ?? []}
        skincareEntries={skincareEntries}
        reviews={reviews}
        milestones={milestones}
        photos={photos}
      />
    </div>
  );
}
