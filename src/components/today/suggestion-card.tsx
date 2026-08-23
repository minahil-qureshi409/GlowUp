'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
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
 */
export function SuggestionCard({ suggestion, today, className }: SuggestionCardProps) {
  const router = useRouter();
  const [dismissed, setDismissed] = React.useState(false);
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
            setDismissed(true);
            toast.success('Logged.');
          } else {
            toast.error(result.error);
          }
          break;
        }
        case 'set-preferred-day': {
          const result = await addPreferredWorkoutDay(action.weekday);
          if (result.ok) {
            setDismissed(true);
            toast.success('Added to your preferred days.');
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
          router.push('/progress?log=1');
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

  return (
    <div
      className={cn(
        'relative rounded-2xl border p-4 pr-10 transition-colors',
        tone === 'positive' && 'border-primary/20 bg-primary-soft/60',
        tone === 'gentle' && 'border-border bg-accent/50',
        tone === 'neutral' && 'border-border bg-card',
        className,
      )}
    >
      <button
        type="button"
        onClick={dismiss}
        disabled={pending}
        className="absolute right-2 top-2 rounded-full p-2 text-muted-foreground transition-colors hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Dismiss: ${suggestion.title}`}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>

      <p className="text-sm font-medium leading-snug">{suggestion.title}</p>
      {suggestion.body ? (
        <p className="mt-1 text-sm text-muted-foreground">{suggestion.body}</p>
      ) : null}

      {hasAction ? (
        <div className="mt-3">
          {action?.kind === 'navigate' ? (
            <Button size="sm" variant="outline" asChild>
              <Link href={action.href}>{actionLabel}</Link>
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={runAction} disabled={pending}>
              {actionLabel}
            </Button>
          )}
        </div>
      ) : null}

      <span className="sr-only">{SUGGESTION_DISCLAIMER}</span>
    </div>
  );
}
