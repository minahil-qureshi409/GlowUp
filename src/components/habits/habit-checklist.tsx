'use client';

import * as React from 'react';
import { toast } from 'sonner';

import { HabitItem } from '@/components/habits/habit-item';
import { ModifyHabitDialog } from '@/components/habits/modify-habit-dialog';
import { setHabitStatus } from '@/server/actions/habits';
import type { Enums } from '@/lib/db/database.types';
import type { HabitWithStatus } from '@/lib/domain/habits';
import { TONE } from '@/lib/domain/copy';
import { cn } from '@/lib/utils';

type HabitChecklistProps = {
  habits: HabitWithStatus[];
  date: string;
  /** Optional grouping by part of day. Off for short lists. */
  grouped?: boolean;
  detailByHabitId?: Record<string, string | null>;
  className?: string;
};

type OptimisticChange = {
  habitId: string;
  status: Enums<'completion_status'> | null;
  modification: string | null;
};

const PART_LABELS: Record<Enums<'day_part'>, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  anytime: 'Any time',
};

/**
 * The daily checklist.
 *
 * `useOptimistic` applies the tick before the round trip, so the list responds
 * at the speed of the tap. If the action fails the optimistic state is dropped
 * automatically when the transition ends and the server value re-renders —
 * plus a toast, because a silent revert is worse than no feedback at all.
 */
export function HabitChecklist({
  habits,
  date,
  grouped = false,
  detailByHabitId,
  className,
}: HabitChecklistProps) {
  const [pending, startTransition] = React.useTransition();
  const [modifying, setModifying] = React.useState<HabitWithStatus | null>(null);

  const [optimisticHabits, applyOptimistic] = React.useOptimistic(
    habits,
    (current: HabitWithStatus[], change: OptimisticChange) =>
      current.map((habit) =>
        habit.id === change.habitId
          ? {
              ...habit,
              status: change.status,
              completion: change.status
                ? {
                    ...(habit.completion ?? {
                      id: 'optimistic',
                      user_id: '',
                      habit_id: habit.id,
                      log_date: date,
                      note: null,
                      completed_at: new Date().toISOString(),
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }),
                    status: change.status,
                    modification: change.modification,
                  }
                : null,
            }
          : habit,
      ),
  );

  function update(habit: HabitWithStatus, status: Enums<'completion_status'> | null, modification: string | null = null) {
    startTransition(async () => {
      applyOptimistic({ habitId: habit.id, status, modification });

      const result = await setHabitStatus({
        habitId: habit.id,
        date,
        status,
        modification,
      });

      if (!result.ok) {
        toast.error(result.error);
      } else if (status === 'skipped') {
        // Reinforce that skipping is fine, exactly once, where it happens.
        toast(TONE.missedDay);
      }
    });
  }

  const groups = grouped
    ? (['morning', 'afternoon', 'evening', 'anytime'] as const)
        .map((part) => ({
          part,
          items: optimisticHabits.filter((habit) => habit.preferred_part === part),
        }))
        .filter((group) => group.items.length > 0)
    : [{ part: null, items: optimisticHabits }];

  return (
    <>
      <div className={cn('space-y-4', className)}>
        {groups.map((group) => (
          <div key={group.part ?? 'all'} className="space-y-0.5">
            {group.part ? (
              <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {PART_LABELS[group.part]}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {group.items.map((habit) => (
                <HabitItem
                  key={habit.id}
                  id={habit.id}
                  name={habit.name}
                  status={habit.status}
                  isOptional={habit.is_optional}
                  detail={detailByHabitId?.[habit.id] ?? null}
                  modification={habit.completion?.modification ?? null}
                  pending={pending}
                  onSetStatus={(status) => update(habit, status)}
                  onModify={() => setModifying(habit)}
                />
              ))}
            </ul>
          </div>
        ))}
      </div>

      <ModifyHabitDialog
        habit={modifying}
        onOpenChange={(open) => !open && setModifying(null)}
        onSubmit={(note) => {
          if (modifying) update(modifying, 'modified', note);
          setModifying(null);
        }}
      />
    </>
  );
}
