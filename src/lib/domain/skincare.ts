import type { Enums, Tables } from '@/lib/db/database.types';
import { dateRangeKeys, type DateKey } from '@/lib/date';

export type SkincareProduct = Tables<'skincare_products'>;
export type SkincareRoutine = Tables<'skincare_routines'>;
export type SkincareStep = Tables<'skincare_routine_steps'>;
export type SkincareEntry = Tables<'skincare_entries'>;
export type SkincareStepCompletion = Tables<'skincare_step_completions'>;
export type SkinLog = Tables<'skin_logs'>;

export type StepWithProduct = SkincareStep & {
  product: Pick<SkincareProduct, 'id' | 'name' | 'brand' | 'category' | 'notes'> | null;
};

export type StepWithStatus = StepWithProduct & {
  status: Enums<'completion_status'> | null;
  note: string | null;
};

/** A step's display name: its product, or its own label for productless steps. */
export function stepLabel(step: StepWithProduct): string {
  if (step.product) {
    return step.product.brand ? `${step.product.brand} ${step.product.name}` : step.product.name;
  }
  return step.label ?? 'Step';
}

export function stepSubLabel(step: StepWithProduct): string | null {
  // A labelled product step keeps both: "Cleanse or rinse" over the product name.
  if (step.product && step.label) return step.label;
  return null;
}

export function attachStepStatus(
  steps: StepWithProduct[],
  completions: Pick<SkincareStepCompletion, 'step_id' | 'status' | 'note'>[],
): StepWithStatus[] {
  const byStep = new Map(completions.map((c) => [c.step_id, c]));
  return [...steps]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((step) => {
      const completion = byStep.get(step.id);
      return { ...step, status: completion?.status ?? null, note: completion?.note ?? null };
    });
}

export type RoutineProgress = {
  /** Non-optional steps only. */
  required: number;
  completed: number;
  optionalCompleted: number;
  percent: number;
  /** True once every required step is either done or explicitly skipped. */
  addressed: boolean;
};

/**
 * Routine completion.
 *
 * Optional steps are excluded from `required` on purpose. The seeded PM
 * moisturiser is optional because several have caused breakouts for this user —
 * skipping it must never read as an incomplete routine.
 */
export function summariseRoutine(steps: StepWithStatus[]): RoutineProgress {
  const required = steps.filter((s) => !s.is_optional);
  const completed = required.filter(
    (s) => s.status === 'completed' || s.status === 'modified',
  ).length;
  const addressedCount = required.filter((s) => s.status !== null).length;
  const optionalCompleted = steps.filter(
    (s) => s.is_optional && (s.status === 'completed' || s.status === 'modified'),
  ).length;

  return {
    required: required.length,
    completed,
    optionalCompleted,
    percent: required.length === 0 ? 100 : Math.round((completed / required.length) * 100),
    addressed: required.length > 0 && addressedCount === required.length,
  };
}

export type PeriodConsistency = {
  period: Enums<'skincare_period'>;
  completedDays: number;
  totalDays: number;
  rate: number;
};

export function periodConsistency(
  entries: Pick<SkincareEntry, 'log_date' | 'period' | 'status'>[],
  period: Enums<'skincare_period'>,
  from: DateKey,
  to: DateKey,
): PeriodConsistency {
  const days = dateRangeKeys(from, to);
  const completedDays = entries.filter(
    (e) =>
      e.period === period &&
      e.log_date >= from &&
      e.log_date <= to &&
      (e.status === 'completed' || e.status === 'modified'),
  ).length;

  return {
    period,
    completedDays,
    totalDays: days.length,
    rate: days.length === 0 ? 0 : Math.round((completedDays / days.length) * 100),
  };
}

export type SkincareTimelinePoint = {
  date: DateKey;
  am: boolean;
  pm: boolean;
  conditions: Enums<'skin_condition'>[];
  note: string | null;
};

export function skincareTimeline(
  entries: Pick<SkincareEntry, 'log_date' | 'period' | 'status'>[],
  logs: Pick<SkinLog, 'log_date' | 'conditions' | 'note'>[],
  from: DateKey,
  to: DateKey,
): SkincareTimelinePoint[] {
  const amDays = new Set(
    entries
      .filter((e) => e.period === 'am' && (e.status === 'completed' || e.status === 'modified'))
      .map((e) => e.log_date),
  );
  const pmDays = new Set(
    entries
      .filter((e) => e.period === 'pm' && (e.status === 'completed' || e.status === 'modified'))
      .map((e) => e.log_date),
  );
  const logByDate = new Map(logs.map((l) => [l.log_date, l]));

  return dateRangeKeys(from, to).map((date) => {
    const log = logByDate.get(date);
    return {
      date,
      am: amDays.has(date),
      pm: pmDays.has(date),
      conditions: log?.conditions ?? [],
      note: log?.note ?? null,
    };
  });
}

/**
 * How often each skin condition was noted. Purely a count — the app never
 * interprets what a run of "breakout" days means, and never links it to a
 * product. That is a conversation for a dermatologist.
 */
export function conditionFrequency(
  logs: Pick<SkinLog, 'log_date' | 'conditions'>[],
  from: DateKey,
  to: DateKey,
): { condition: Enums<'skin_condition'>; count: number }[] {
  const counts = new Map<Enums<'skin_condition'>, number>();

  for (const log of logs) {
    if (log.log_date < from || log.log_date > to) continue;
    for (const condition of log.conditions) {
      counts.set(condition, (counts.get(condition) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count);
}

export const SKIN_CONDITION_LABELS: Record<Enums<'skin_condition'>, string> = {
  good: 'Good',
  clear: 'Clear',
  dry: 'Dry',
  oily: 'Oily',
  irritated: 'Irritated',
  breakout: 'Breakout',
  other: 'Other',
};

export const PRODUCT_CATEGORY_LABELS: Record<Enums<'skincare_product_category'>, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  serum: 'Serum',
  treatment: 'Treatment',
  moisturizer: 'Moisturiser',
  spf: 'SPF',
  other: 'Other',
};

export const PERIOD_LABELS: Record<Enums<'skincare_period'>, string> = {
  am: 'Morning',
  pm: 'Evening',
};
