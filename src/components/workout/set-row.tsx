'use client';

import * as React from 'react';
import { Check, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SetValues = {
  id: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  isWarmup: boolean;
  completed: boolean;
};

type SetRowProps = {
  set: SetValues;
  /** What was logged for this set number last session, shown as a ghost hint. */
  previous?: { reps: number | null; weightKg: number | null } | null;
  onChange: (patch: Partial<SetValues>) => void;
  onDelete: () => void;
  disabled?: boolean;
};

/**
 * One set.
 *
 * Numeric keypads, no spinners, and the previous session's numbers as
 * placeholder text — most sets repeat what came before, so the fastest path is
 * "tap the tick" and the second fastest is "change one digit".
 */
export function SetRow({ set, previous, onChange, onDelete, disabled }: SetRowProps) {
  const [weight, setWeight] = React.useState(set.weightKg?.toString() ?? '');
  const [reps, setReps] = React.useState(set.reps?.toString() ?? '');

  // Keep local text in step with server state after a revalidate.
  React.useEffect(() => {
    setWeight(set.weightKg?.toString() ?? '');
    setReps(set.reps?.toString() ?? '');
  }, [set.weightKg, set.reps]);

  function commit(patch: Partial<SetValues>) {
    onChange(patch);
  }

  return (
    <li
      className={cn(
        'grid grid-cols-[2rem_1fr_1fr_auto_auto] items-center gap-2 rounded-xl px-1 py-1.5 transition-colors',
        set.completed && 'bg-primary-soft/40',
      )}
    >
      <span
        className={cn(
          'tabular text-center text-xs font-medium',
          set.isWarmup ? 'text-muted-foreground' : 'text-foreground',
        )}
      >
        {set.isWarmup ? 'W' : set.setIndex}
      </span>

      <input
        type="number"
        inputMode="decimal"
        step="0.5"
        min="0"
        aria-label={`Set ${set.setIndex} weight in kilograms`}
        value={weight}
        placeholder={previous?.weightKg != null ? String(previous.weightKg) : '—'}
        disabled={disabled}
        onChange={(event) => setWeight(event.target.value)}
        onBlur={() => commit({ weightKg: weight === '' ? null : Number(weight) })}
        className="h-11 w-full rounded-lg border border-input bg-card px-2 text-center text-base tabular-nums focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      />

      <input
        type="number"
        inputMode="numeric"
        min="0"
        aria-label={`Set ${set.setIndex} repetitions`}
        value={reps}
        placeholder={previous?.reps != null ? String(previous.reps) : '—'}
        disabled={disabled}
        onChange={(event) => setReps(event.target.value)}
        onBlur={() => commit({ reps: reps === '' ? null : Number(reps) })}
        className="h-11 w-full rounded-lg border border-input bg-card px-2 text-center text-base tabular-nums focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
      />

      <Button
        type="button"
        variant={set.completed ? 'default' : 'outline'}
        size="icon-sm"
        disabled={disabled}
        aria-label={set.completed ? `Mark set ${set.setIndex} incomplete` : `Mark set ${set.setIndex} complete`}
        aria-pressed={set.completed}
        onClick={() =>
          commit({
            completed: !set.completed,
            // Ticking a blank set adopts whatever is in the boxes.
            weightKg: weight === '' ? null : Number(weight),
            reps: reps === '' ? null : Number(reps),
          })
        }
      >
        <Check className="size-4" strokeWidth={3} />
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground"
        disabled={disabled}
        aria-label={`Remove set ${set.setIndex}`}
        onClick={onDelete}
      >
        <X className="size-4" />
      </Button>
    </li>
  );
}
