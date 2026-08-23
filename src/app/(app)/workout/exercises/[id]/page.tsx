import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Stat, StatGrid } from '@/components/common/stat';
import { EmptyState } from '@/components/common/empty-state';
import { StrengthChart } from '@/components/charts/strength-chart';

import { requireUser } from '@/server/auth';
import { getUserContext } from '@/services/profile';
import { getSetHistory } from '@/services/workouts';
import {
  MUSCLE_GROUP_LABELS,
  exerciseProgression,
  personalBests,
  strengthChange,
} from '@/lib/domain/workout';
import { formatDateKey, subDaysKey, todayIn } from '@/lib/date';
import { formatDelta, formatLoad, formatVolume } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { supabase, userId } = await requireUser();
  const { data } = await supabase
    .from('exercises')
    .select('name')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  return { title: data?.name ?? 'Exercise' };
}

export default async function ExerciseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, userId } = await requireUser();

  const { data: exercise } = await supabase
    .from('exercises')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (!exercise) notFound();

  const context = await getUserContext(supabase, userId);
  const today = todayIn(context.profile.timezone);
  const from = subDaysKey(today, 364);

  const setHistory = await getSetHistory(supabase, userId, from);
  const points = exerciseProgression(setHistory, id);
  const best = personalBests(setHistory).get(id) ?? null;
  const change = strengthChange(setHistory, id, from, today);

  return (
    <div className="animate-fade-up space-y-5 py-3">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/workout" aria-label="Back to workouts">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="font-display text-xl font-semibold tracking-tight">{exercise.name}</h1>
          <p className="text-xs text-muted-foreground">
            {MUSCLE_GROUP_LABELS[exercise.muscle_group]}
            {exercise.equipment ? ` · ${exercise.equipment}` : ''}
          </p>
        </div>
      </div>

      {points.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          body="Once you log this exercise in a session, its progression appears here."
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-5">
              <StatGrid columns={3}>
                <Stat
                  label="Best set"
                  value={`${formatLoad(best?.bestWeightKg)} kg`}
                  hint={
                    best?.bestWeightDate
                      ? `× ${best.bestWeightReps ?? '—'} · ${formatDateKey(best.bestWeightDate, 'd MMM')}`
                      : undefined
                  }
                />
                <Stat
                  label="Best volume"
                  value={best?.bestSessionVolume ? formatVolume(best.bestSessionVolume) : '—'}
                  hint="single session"
                />
                <Stat
                  label="Change"
                  value={change ? formatDelta(change.deltaKg) : '—'}
                  hint={change ? `over ${change.weeks} weeks` : 'needs two sessions'}
                  {...(change
                    ? {
                        delta: {
                          value: `${formatLoad(change.fromKg)} → ${formatLoad(change.toKg)}`,
                          direction:
                            change.deltaKg > 0
                              ? ('up' as const)
                              : change.deltaKg < 0
                                ? ('down' as const)
                                : ('flat' as const),
                        },
                      }
                    : {})}
                />
              </StatGrid>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <StrengthChart exerciseName={exercise.name} points={points} metric="load" />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <StrengthChart exerciseName={exercise.name} points={points} metric="volume" />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
