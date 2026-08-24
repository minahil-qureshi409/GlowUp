'use client';

import * as React from 'react';
import { Minus, Plus } from 'lucide-react';
import { toast } from 'sonner';

import { Celebration } from '@/components/glow/celebration';
import { adjustWater } from '@/server/actions/daily';
import { cn } from '@/lib/utils';

type WaterCardProps = {
  date: string;
  glasses: number;
  goal: number;
  className?: string;
};

/**
 * Hydration, as eight slots you fill by tapping.
 *
 * The count updates on tap and reconciles when the server answers, so the row
 * never stalls behind a round trip. A rejected write snaps back and says so —
 * a counter that silently keeps a number the server refused is worse than one
 * that is briefly wrong.
 */
export function WaterCard({ date, glasses, goal, className }: WaterCardProps) {
  const [optimistic, setOptimistic] = React.useState(glasses);
  const [celebrate, setCelebrate] = React.useState(0);
  const [, startTransition] = React.useTransition();

  // The server is the source of truth; a revalidation that lands with a
  // different number wins over whatever the last tap assumed.
  React.useEffect(() => setOptimistic(glasses), [glasses]);

  function adjust(delta: 1 | -1) {
    const next = Math.max(0, Math.min(30, optimistic + delta));
    if (next === optimistic) return;

    const previous = optimistic;
    setOptimistic(next);
    if (next === goal && previous < goal) setCelebrate((n) => n + 1);

    startTransition(async () => {
      const result = await adjustWater({ metric_date: date, delta });
      if (!result.ok) {
        setOptimistic(previous);
        toast.error(result.error);
        return;
      }
      setOptimistic(result.data.glasses);
      if (result.data.glasses === goal && previous < goal) {
        toast.success(`${goal} glasses — beautifully hydrated`);
      }
    });
  }

  return (
    <section
      aria-labelledby="water-heading"
      className={cn('surface-card relative overflow-hidden p-5', className)}
    >
      <Celebration fireKey={celebrate} />

      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="water-heading" className="text-[15px] font-semibold">
            Water
          </h2>
          <p className="tabular text-[13px] text-muted-foreground">
            {optimistic} / {goal} glasses
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => adjust(-1)}
            disabled={optimistic === 0}
            aria-label="Remove a glass of water"
            className="flex size-10 items-center justify-center rounded-full border border-border bg-muted text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
          >
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => adjust(1)}
            aria-label="Add a glass of water"
            className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-90 motion-reduce:active:scale-100"
          >
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/*
        Decorative: the count above already says it in words, and eight
        identical rectangles announced one by one is noise in a screen reader.
      */}
      <div aria-hidden="true" className="mt-4 flex gap-1.5">
        {Array.from({ length: goal }).map((_, i) => (
          <span
            key={i}
            className={cn(
              'h-8 flex-1 rounded-[10px] border border-border transition-all duration-300',
              i < optimistic ? 'bg-lav' : 'bg-muted',
              i === optimistic - 1 && 'scale-[1.06]',
            )}
          />
        ))}
      </div>

      {optimistic > goal ? (
        <p className="mt-3 text-[12.5px] text-muted-foreground">
          {optimistic - goal} past your goal. Nicely done.
        </p>
      ) : null}
    </section>
  );
}
