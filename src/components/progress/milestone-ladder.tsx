import { Check } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { MilestoneProgress } from '@/lib/domain/weight';
import { formatWeight } from '@/lib/format';

type MilestoneLadderProps = {
  milestones: MilestoneProgress[];
  currentKg: number | null;
};

/**
 * The milestone ladder.
 *
 * Shows values reached and values ahead — and nothing about *when*. A reached
 * milestone stays reached even if today's reading dips below it, because
 * progress that happened is not undone by a fluctuation.
 */
export function MilestoneLadder({ milestones, currentKg }: MilestoneLadderProps) {
  return (
    <ol className="space-y-0">
      {milestones.map((milestone, index) => {
        const isLast = index === milestones.length - 1;

        return (
          <li key={milestone.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-semibold transition-colors',
                  milestone.reached
                    ? 'border-primary bg-primary text-primary-foreground'
                    : milestone.isNext
                      ? 'border-primary bg-card text-primary'
                      : 'border-border bg-card text-muted-foreground',
                )}
                aria-hidden="true"
              >
                {milestone.reached ? <Check className="size-3" strokeWidth={3} /> : index + 1}
              </span>
              {!isLast ? (
                <span
                  className={cn(
                    'w-0.5 flex-1 rounded-full',
                    milestone.reached ? 'bg-primary/40' : 'bg-border',
                  )}
                  aria-hidden="true"
                />
              ) : null}
            </div>

            <div className={cn('min-w-0 flex-1', !isLast && 'pb-5')}>
              <p className="flex items-baseline gap-2">
                <span className="tabular text-sm font-medium">
                  {formatWeight(milestone.targetKg)}
                </span>
                {milestone.isNext && currentKg !== null ? (
                  <span className="tabular text-xs text-muted-foreground">
                    {(milestone.targetKg - currentKg).toFixed(1)} kg away
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">
                {milestone.label}
                {milestone.reached ? ' · reached' : ''}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
