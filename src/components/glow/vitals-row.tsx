import { cn } from '@/lib/utils';

export type Vital = {
  label: string;
  value: string;
  hint: string;
};

/**
 * Three small facts under the hero: streak, mood, energy.
 *
 * Every one of them is read from something already logged. None is a target,
 * and none is coloured good-or-bad — they are a status line, not a report card.
 */
export function VitalsRow({ vitals, className }: { vitals: Vital[]; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-3 gap-2.5', className)}>
      {vitals.map((vital) => (
        <div key={vital.label} className="surface-card px-4 py-4">
          <dt className="eyebrow !tracking-[0.12em] text-[10.5px]">{vital.label}</dt>
          <dd className="mt-2">
            <span className="tabular block text-xl font-semibold tracking-tight">
              {vital.value}
            </span>
            <span className="mt-0.5 block text-[11.5px] text-subtle">{vital.hint}</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}
