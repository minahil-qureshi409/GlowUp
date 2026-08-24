'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';

import { dismissSuggestion } from '@/server/actions/habits';
import { setHabitStatus } from '@/server/actions/habits';
import { addPreferredWorkoutDay } from '@/server/actions/settings';
import type { PlanSuggestion } from '@/lib/domain/planner';
import type { Insight } from '@/lib/domain/insights';
import { SUGGESTION_DISCLAIMER } from '@/lib/domain/copy';
import { cn } from '@/lib/utils';

type SuggestionCardProps = {
  suggestion: PlanSuggestion | Insight;
  today: string;
  className?: string;
};

/**
 * A single suggestion.
 *
 * Two rules make this a suggestion rather than an instruction: it always has a
 * dismiss control, and its action is optional. Dismissals are stored per day,
 * so saying "not today" does not delete the idea forever.
 *
 * Acting on one paints the card over with a confirmation before it goes. The
 * card vanishing the instant you tap it reads as a misfire; a beat of "yes,
 * that happened" is the difference between an app that responded and one that
 * ate your tap.
 */
export function SuggestionCard({ suggestion, today, className }: SuggestionCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = React.useState(false);
  const [done, setDone] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  if (dismissed) return null;

  const tone = suggestion.tone;

  function dismiss() {
    setDismissed(true);
    startTransition(async () => {
      const result = await dismissSuggestion(suggestion.key, today);
      if (!result.ok) {
        setDismissed(false);
        toast.error(result.error);
      }
    });
  }

  /** Show the confirmation, then let the card go. */
  function confirmThenClear(label: string) {
    setDone(label);
    setTimeout(() => setDismissed(true), 1100);
  }

  function runAction() {
    const action = 'action' in suggestion ? suggestion.action : undefined;
    if (!action) return;

    startTransition(async () => {
      switch (action.kind) {
        case 'log-habit': {
          const result = await setHabitStatus({
            habitId: action.habitId,
            date: today,
            status: 'completed',
          });
          if (result.ok) {
            confirmThenClear('Logged');
          } else {
            toast.error(result.error);
          }
          break;
        }
        case 'set-preferred-day': {
          const result = await addPreferredWorkoutDay(action.weekday);
          if (result.ok) {
            confirmThenClear('Added to your week');
          } else {
            toast.error(result.error);
          }
          break;
        }
        case 'start-workout': {
          router.push(`/workout?location=${action.location}`);
          break;
        }
        case 'open-skincare': {
          router.push(`/skincare?period=${action.period}`);
          break;
        }
        case 'log-weight': {
          router.push('/weight?log=1');
          break;
        }
        case 'navigate': {
          router.push(action.href);
          break;
        }
        case 'none':
          break;
      }
    });
  }

  const action = 'action' in suggestion ? suggestion.action : undefined;
  const actionLabel = 'actionLabel' in suggestion ? suggestion.actionLabel : undefined;
  const hasAction = Boolean(action && action.kind !== 'none' && actionLabel);

  const pillClass =
    'inline-flex shrink-0 items-center justify-center rounded-full border border-border bg-muted px-4 py-2.5 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary hover:bg-primary-soft disabled:opacity-50';

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl border p-5 pr-11 shadow-soft transition-colors',
        tone === 'positive' && 'border-primary/20 bg-primary-soft/60',
        tone === 'gentle' && 'border-border-soft bg-accent',
        tone === 'neutral' && 'border-border/70 bg-card',
        className,
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        disabled={pending}
        className="absolute right-2.5 top-2.5 rounded-full p-2 text-subtle transition-colors hover:bg-background/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Dismiss: ${suggestion.title}`}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>

      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug">{suggestion.title}</p>
          {suggestion.body ? (
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
              {suggestion.body}
            </p>
          ) : null}
        </div>

        {hasAction ? (
          <div className="self-center">
            {action?.kind === 'navigate' ? (
              <Link href={action.href} className={pillClass}>
                {actionLabel}
              </Link>
            ) : (
              <button type="button" className={pillClass} onClick={runAction} disabled={pending}>
                {actionLabel}
              </button>
            )}
          </div>
        ) : null}
      </div>

      {done ? (
        <p
          role="status"
          className="animate-pop absolute inset-0 flex items-center justify-center gap-2.5 bg-sage-soft text-[14.5px] font-semibold"
        >
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-full bg-sage text-background"
          >
            <Check className="size-4" strokeWidth={3} />
          </span>
          {done}
        </p>
      ) : null}

      <span className="sr-only">{SUGGESTION_DISCLAIMER}</span>
    </div>
  );
}
