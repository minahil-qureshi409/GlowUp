import type { HabitWithStatus } from '@/lib/domain/habits';

/**
 * The Glow score and its five pillars.
 *
 * The score is a plain mean of the pillars that have data today — not a
 * weighted one. A weighting would be this app telling you that sleep matters
 * 1.4x more than skincare, which it has no standing to claim.
 *
 * A pillar with no source of data is `null`, not `0`. That distinction is the
 * whole design of this module: a user who has never set up a nutrition habit
 * should see four pillars and an honest average of four, not five pillars with
 * one permanently at zero dragging the number down.
 */

export type PillarKey = 'nutrition' | 'movement' | 'skincare' | 'sleep' | 'hydration';

export type Pillar = {
  key: PillarKey;
  label: string;
  /** 0–100, or null when there is nothing to measure. */
  percent: number | null;
  /** What the number is made of, in plain words. Shown on the pillar row. */
  detail: string;
  /** Tailwind class for the fill. Fill variants, never the `-ink` text ones. */
  colorClass: string;
};

export type GlowSummary = {
  pillars: Pillar[];
  /** Mean of the measurable pillars, or null when none are. */
  score: number | null;
  /** How many pillars actually contributed. */
  measured: number;
  headline: string;
};

/** Hours of sleep that counts as a full night. Not user-configurable yet. */
export const SLEEP_TARGET_HOURS = 8;

export type GlowInput = {
  habits: HabitWithStatus[];
  workoutsCompletedThisWeek: number;
  workoutsPerWeek: number;
  workoutLoggedToday: boolean;
  /** Required + completed step counts across both routines, today. */
  skincare: { required: number; completed: number };
  sleepHours: number | null;
  waterGlasses: number;
  waterGoal: number;
};

export function buildGlowSummary(input: GlowInput): GlowSummary {
  const pillars: Pillar[] = [
    nutritionPillar(input.habits),
    movementPillar(input),
    skincarePillar(input.skincare),
    sleepPillar(input.sleepHours),
    hydrationPillar(input.waterGlasses, input.waterGoal),
  ];

  const measured = pillars.filter((p): p is Pillar & { percent: number } => p.percent !== null);
  const score =
    measured.length === 0
      ? null
      : Math.round(measured.reduce((sum, p) => sum + p.percent, 0) / measured.length);

  return { pillars, score, measured: measured.length, headline: headlineFor(score) };
}

function nutritionPillar(habits: HabitWithStatus[]): Pillar {
  const counted = habits.filter(
    (h) => h.category === 'nutrition' && h.is_active && !h.is_optional && h.frequency === 'daily',
  );
  const done = counted.filter((h) => h.status === 'completed' || h.status === 'modified').length;

  return {
    key: 'nutrition',
    label: 'Nutrition',
    percent: counted.length === 0 ? null : Math.round((done / counted.length) * 100),
    detail:
      counted.length === 0
        ? 'No nutrition habits yet'
        : `${done} of ${counted.length} nutrition ${counted.length === 1 ? 'habit' : 'habits'}`,
    colorClass: 'bg-primary-fill',
  };
}

function movementPillar(input: GlowInput): Pillar {
  const { workoutsCompletedThisWeek: done, workoutsPerWeek: target, workoutLoggedToday } = input;

  if (target <= 0) {
    return {
      key: 'movement',
      label: 'Movement',
      percent: null,
      detail: 'No weekly target set',
      colorClass: 'bg-sage',
    };
  }

  const percent = Math.min(100, Math.round((done / target) * 100));

  return {
    key: 'movement',
    label: 'Movement',
    percent,
    detail: workoutLoggedToday
      ? `${done} of ${target} this week · logged today`
      : `${done} of ${target} this week`,
    colorClass: 'bg-sage',
  };
}

function skincarePillar(skincare: { required: number; completed: number }): Pillar {
  const { required, completed } = skincare;

  return {
    key: 'skincare',
    label: 'Skincare',
    percent: required === 0 ? null : Math.round((completed / required) * 100),
    detail: required === 0 ? 'No routine set up yet' : `${completed} of ${required} steps`,
    colorClass: 'bg-mauve',
  };
}

function sleepPillar(hours: number | null): Pillar {
  return {
    key: 'sleep',
    label: 'Sleep',
    percent: hours === null ? null : Math.min(100, Math.round((hours / SLEEP_TARGET_HOURS) * 100)),
    detail: hours === null ? 'Not logged' : `${formatHours(hours)} of ${SLEEP_TARGET_HOURS} h`,
    colorClass: 'bg-lav',
  };
}

function hydrationPillar(glasses: number, goal: number): Pillar {
  return {
    key: 'hydration',
    label: 'Hydration',
    percent: goal <= 0 ? null : Math.min(100, Math.round((glasses / goal) * 100)),
    detail: `${glasses} of ${goal} glasses`,
    colorClass: 'bg-amber',
  };
}

/**
 * The line beside the ring.
 *
 * Deliberately flat at the bottom end. A low score early in the day is the
 * normal state of a day, and a score of 20 at 9am is not a verdict on anyone.
 */
function headlineFor(score: number | null): string {
  if (score === null) return 'Set up a habit or two and this fills in.';
  if (score >= 85) return 'Your day is going beautifully.';
  if (score >= 60) return 'Good rhythm today.';
  if (score >= 35) return 'A little progress still counts.';
  return 'Start with one small thing.';
}

export function formatHours(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (minutes === 0) return `${whole} h`;
  return `${whole} h ${minutes} m`;
}

export const MOOD_LABELS: Record<string, string> = {
  calm: 'Calm',
  happy: 'Happy',
  motivated: 'Motivated',
  tired: 'Tired',
  stressed: 'Stressed',
  low: 'Low',
};

/**
 * The Energy vital, read off sleep.
 *
 * Not a separate thing to log — one more field to fill in every morning is how
 * a tracker becomes a chore. Sleep is already the input.
 */
export function energyFromSleep(hours: number | null): { label: string; hint: string } {
  if (hours === null) return { label: '—', hint: 'log sleep' };
  if (hours >= 7.5) return { label: 'Good', hint: `${formatHours(hours)} sleep` };
  if (hours >= 6) return { label: 'Okay', hint: `${formatHours(hours)} sleep` };
  return { label: 'Low', hint: `${formatHours(hours)} sleep` };
}
