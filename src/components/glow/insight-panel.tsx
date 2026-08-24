import { cn } from '@/lib/utils';

export type InsightBar = { label: string; percent: number };

export type InsightPanelProps = {
  tag: string;
  headline: string;
  body: string;
  bars?: InsightBar[];
  /** Background tint. One of the pillar `-soft` tokens. */
  tint?: string;
  /** Bar fill. One of the pillar fill tokens. */
  barClass?: string;
};

/**
 * One observation, with the shape it came from underneath it.
 *
 * The bars are not a chart — no axis, no gridlines, no tooltip. They exist so
 * the sentence above them can be checked at a glance instead of taken on
 * faith. Anything that needs reading precisely belongs on Progress.
 */
export function InsightPanel({
  tag,
  headline,
  body,
  bars,
  tint = 'bg-accent',
  barClass = 'bg-primary-fill',
}: InsightPanelProps) {
  return (
    <article className={cn('rounded-3xl border border-border-soft p-6', tint)}>
      <p className="eyebrow !tracking-[0.16em] text-[10.5px]">{tag}</p>
      <h2 className="mt-2 font-display text-display-sm">{headline}</h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{body}</p>

      {bars && bars.length > 0 ? (
        <div className="mt-4">
          <ul className="flex h-11 items-end gap-1" aria-hidden="true">
            {bars.map((bar) => (
              <li
                key={bar.label}
                className={cn('flex-1 rounded-t-[5px] rounded-b-[3px]', barClass)}
                style={{ height: `${Math.max(4, bar.percent)}%` }}
              />
            ))}
          </ul>
          <ul className="mt-1.5 flex gap-1">
            {bars.map((bar) => (
              <li key={bar.label} className="flex-1 text-center text-[9.5px] text-subtle">
                {bar.label}
              </li>
            ))}
          </ul>
          {/* The same figures, in a form a screen reader can actually use. */}
          <p className="sr-only">
            {bars.map((bar) => `${bar.label}: ${bar.percent}%`).join('. ')}
          </p>
        </div>
      ) : null}
    </article>
  );
}
