import { Info } from 'lucide-react';

import { TONE } from '@/lib/domain/copy';
import { cn } from '@/lib/utils';

/**
 * Every nutrition figure in the app is an estimate assembled from reference
 * values. This marker is the app being honest about that, and it is required
 * wherever a calorie or protein number appears.
 */
export function ApproximateNote({ className }: { className?: string }) {
  return (
    <p className={cn('flex items-start gap-1.5 text-xs text-muted-foreground', className)}>
      <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
      <span>{TONE.approximateNote}</span>
    </p>
  );
}

export function ApproximateTag({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground',
        className,
      )}
    >
      {TONE.approximate}
    </span>
  );
}
