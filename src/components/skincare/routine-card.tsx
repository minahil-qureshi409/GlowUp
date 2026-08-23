'use client';

import * as React from 'react';
import { Check, Moon, SkipForward, Sun } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { clearRoutine, completeRoutine, setStepStatus } from '@/server/actions/skincare';
import type { Enums } from '@/lib/db/database.types';
import {
  PERIOD_LABELS,
  stepLabel,
  stepSubLabel,
  summariseRoutine,
  type StepWithStatus,
} from '@/lib/domain/skincare';
import { cn } from '@/lib/utils';

type RoutineCardProps = {
  period: Enums<'skincare_period'>;
  steps: StepWithStatus[];
  date: string;
};

/**
 * One routine for one day.
 *
 * Optional steps are visually and behaviourally distinct: they carry an
 * "optional" tag, are excluded from the completion count, and skipping one
 * never moves the progress bar. That is the whole point — the seeded PM
 * moisturiser is optional because several have caused breakouts, and the app
 * must not imply it was missed.
 */
export function RoutineCard({ period, steps: initialSteps, date }: RoutineCardProps) {
  const [pending, startTransition] = React.useTransition();

  const [steps, applyOptimistic] = React.useOptimistic(
    initialSteps,
    (current: StepWithStatus[], change: { stepId: string | null; status: Enums<'completion_status'> | null }) =>
      current.map((step) =>
        change.stepId === null || step.id === change.stepId
          ? {
              ...step,
              // A "complete all" pass leaves optional steps exactly as they were.
              status: change.stepId === null && step.is_optional ? step.status : change.status,
            }
          : step,
      ),
  );

  const progress = summariseRoutine(steps);
  const Icon = period === 'am' ? Sun : Moon;

  function toggleStep(step: StepWithStatus, status: Enums<'completion_status'> | null) {
    startTransition(async () => {
      applyOptimistic({ stepId: step.id, status });
      const result = await setStepStatus({ date, period, stepId: step.id, status });
      if (!result.ok) toast.error(result.error);
    });
  }

  function completeAll() {
    startTransition(async () => {
      applyOptimistic({ stepId: null, status: 'completed' });
      const result = await completeRoutine(date, period);
      if (!result.ok) toast.error(result.error);
    });
  }

  function clearAll() {
    startTransition(async () => {
      applyOptimistic({ stepId: null, status: null });
      const result = await clearRoutine(date, period);
      if (!result.ok) toast.error(result.error);
    });
  }

  const allDone = progress.required > 0 && progress.completed === progress.required;

  return (
    <Card className={cn(pending && 'opacity-70')}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon
              className={cn(
                'size-4',
                period === 'am' ? 'text-domain-nutrition' : 'text-domain-skincare',
              )}
              aria-hidden="true"
            />
            <h2 className="text-sm font-semibold">{PERIOD_LABELS[period]}</h2>
          </div>
          <span className="tabular text-xs text-muted-foreground">
            {progress.completed} / {progress.required}
          </span>
        </div>

        <Progress
          value={progress.percent}
          className="h-1.5"
          aria-label={`${PERIOD_LABELS[period]} routine, ${progress.percent}% complete`}
        />

        <ul className="space-y-0.5">
          {steps.map((step) => {
            const done = step.status === 'completed' || step.status === 'modified';
            const skipped = step.status === 'skipped';
            const sub = stepSubLabel(step);

            return (
              <li key={step.id} className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => toggleStep(step, done ? null : 'completed')}
                  aria-pressed={done}
                  aria-label={
                    done ? `Mark ${stepLabel(step)} not done` : `Mark ${stepLabel(step)} done`
                  }
                  className="flex min-h-12 flex-1 items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-all',
                      done
                        ? 'animate-check-pop border-primary bg-primary text-primary-foreground'
                        : skipped
                          ? 'border-dashed border-muted-foreground/50'
                          : 'border-border',
                    )}
                    aria-hidden="true"
                  >
                    {done ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>

                  <span className="min-w-0 flex-1">
                    {/*
                      Wrapping, not truncating. "La Roche-Posay Anthelios UVMune
                      400 SPF50+" clipped at the container edge even at desktop
                      width, and a product name you cannot read is not much use
                      on the screen whose whole job is telling you which product
                      to use next.
                    */}
                    <span
                      className={cn(
                        'block break-words text-sm font-medium',
                        (done || skipped) && 'text-muted-foreground',
                        done && 'line-through decoration-muted-foreground/40',
                      )}
                    >
                      {stepLabel(step)}
                    </span>
                    {sub ? (
                      <span className="block break-words text-xs text-muted-foreground">{sub}</span>
                    ) : null}
                  </span>

                  {step.is_optional ? (
                    <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                      Optional
                    </span>
                  ) : null}
                </button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => toggleStep(step, skipped ? null : 'skipped')}
                  aria-label={skipped ? `Un-skip ${stepLabel(step)}` : `Skip ${stepLabel(step)}`}
                  aria-pressed={skipped}
                >
                  <SkipForward className={cn('size-4', skipped && 'text-foreground')} />
                </Button>
              </li>
            );
          })}
        </ul>

        {step_note(steps)}

        <Button
          variant={allDone ? 'outline' : 'brand'}
          className="w-full"
          onClick={allDone ? clearAll : completeAll}
          disabled={pending}
        >
          {allDone
            ? `Clear today's ${PERIOD_LABELS[period].toLowerCase()} routine`
            : `Mark ${PERIOD_LABELS[period].toLowerCase()} routine done`}
        </Button>
      </CardContent>
    </Card>
  );
}

/** Surfaces a product's own caution note, e.g. the optional moisturiser. */
function step_note(steps: StepWithStatus[]) {
  const noted = steps.find((step) => step.is_optional && step.product?.notes);
  if (!noted?.product?.notes) return null;

  return (
    <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      {noted.product.notes}
    </p>
  );
}
