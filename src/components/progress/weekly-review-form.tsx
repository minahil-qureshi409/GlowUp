'use client';

import * as React from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { saveWeeklyReview } from '@/server/actions/progress';
import type { Enums } from '@/lib/db/database.types';
import { cn } from '@/lib/utils';

type WeeklyReviewFormProps = {
  weekStart: string;
  feeling: Enums<'week_feeling'> | null;
  notes: string;
};

const FEELINGS: { value: Enums<'week_feeling'>; label: string; emoji: string }[] = [
  { value: 'great', label: 'Great', emoji: '✨' },
  { value: 'good', label: 'Good', emoji: '🙂' },
  { value: 'okay', label: 'Okay', emoji: '😌' },
  { value: 'difficult', label: 'Difficult', emoji: '🫂' },
];

/**
 * How the week felt.
 *
 * "Difficult" is offered as a normal answer, not a red flag — the point of
 * asking is to let the user record a hard week without the app reacting to it.
 */
export function WeeklyReviewForm({ weekStart, feeling: initialFeeling, notes: initialNotes }: WeeklyReviewFormProps) {
  const [feeling, setFeeling] = React.useState<Enums<'week_feeling'> | null>(initialFeeling);
  const [notes, setNotes] = React.useState(initialNotes);
  const [pending, startTransition] = React.useTransition();

  const dirty = feeling !== initialFeeling || notes !== initialNotes;

  function save() {
    startTransition(async () => {
      const result = await saveWeeklyReview({
        week_start: weekStart,
        feeling,
        notes: notes || null,
      });
      if (result.ok) toast.success('Review saved.');
      else toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">How did this week feel?</h2>
          <p className="text-xs text-muted-foreground">
            However it went is fine — this is just for you.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="How the week felt">
          {FEELINGS.map((option) => {
            const active = feeling === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setFeeling(active ? null : option.value)}
                aria-pressed={active}
                className={cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl border text-sm transition-colors',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active
                    ? 'border-primary bg-primary-soft text-primary'
                    : 'border-border hover:bg-muted/60',
                )}
              >
                <span aria-hidden="true" className="text-lg">
                  {option.emoji}
                </span>
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="review-notes">Anything you want to remember</Label>
          <Textarea
            id="review-notes"
            rows={4}
            value={notes}
            maxLength={2000}
            placeholder="What worked, what got in the way, anything else."
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <Button variant="brand" className="w-full" onClick={save} disabled={!dirty || pending}>
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          Save review
        </Button>
      </CardContent>
    </Card>
  );
}
