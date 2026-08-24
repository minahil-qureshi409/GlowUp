import { ProgressRing } from '@/components/common/progress-ring';
import type { GlowSummary } from '@/lib/domain/glow';
import { cn } from '@/lib/utils';

/**
 * The Today hero: one number, and the five things it is made of.
 *
 * The pillar rows are not decoration. A single score with nothing behind it is
 * a mood ring; the bars are what let someone see *why* the number is where it
 * is and which one thing would move it.
 */
export function GlowScoreCard({ summary }: { summary: GlowSummary }) {
  const { score, pillars, measured, headline } = summary;

  return (
    <section
      aria-labelledby="glow-score-heading"
      className="rounded-3xl border border-border/70 bg-gradient-card p-6 shadow-soft sm:p-7 lg:flex lg:items-center lg:gap-8"
    >
      <div className="flex items-center gap-6 lg:shrink-0">
        <ProgressRing
          value={score ?? 0}
          size={124}
          strokeWidth={11}
          stroke="hsl(var(--primary-fill))"
          label={
            score === null
              ? 'Glow score not available yet'
              : `Glow score ${score} out of 100, averaged across ${measured} ${measured === 1 ? 'pillar' : 'pillars'}`
          }
        >
          <span className="tabular text-[32px] leading-none tracking-tight">
            {score ?? '—'}
            {score !== null ? (
              <span className="text-base text-subtle">%</span>
            ) : null}
          </span>
          <span className="eyebrow mt-1.5 !tracking-[0.14em]">Glow score</span>
        </ProgressRing>

        <div className="lg:hidden">
          <h2 id="glow-score-heading" className="text-[15px] font-semibold leading-snug">
            {headline}
          </h2>
        </div>
      </div>

      <div className="mt-6 flex-1 space-y-2.5 lg:mt-0">
        <h2 className="hidden text-[17px] font-semibold lg:block">{headline}</h2>
        <dl className="space-y-2.5">
          {pillars.map((pillar) => (
            <div key={pillar.key} className="flex items-center gap-3">
              <dt className="w-[72px] shrink-0 text-[12.5px] text-muted-foreground">
                {pillar.label}
              </dt>
              <dd className="flex flex-1 items-center gap-3">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn(
                      'block h-full rounded-full transition-[width] duration-700 ease-out',
                      pillar.colorClass,
                    )}
                    style={{ width: `${pillar.percent ?? 0}%` }}
                  />
                </span>
                <span className="tabular w-[68px] shrink-0 text-right text-[11.5px] text-subtle">
                  {pillar.percent === null ? '—' : `${pillar.percent}%`}
                </span>
                {/*
                  Inside the `dd`, not beside it: a `div` grouping in a `dl` may
                  only hold `dt` and `dd`. The detail is what a screen reader
                  gets instead of "72 percent", which on its own says nothing
                  about what was counted.
                */}
                <span className="sr-only">{pillar.detail}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
