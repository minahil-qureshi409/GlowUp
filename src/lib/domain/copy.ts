/**
 * Voice.
 *
 * Every phrase the app says about the user's performance lives here, so the
 * tone is reviewable in one file rather than scattered across forty components.
 *
 * The rules, stated once:
 *   1. Never assign blame. No "you failed", "you're behind", "you missed".
 *   2. Never issue commands. Suggestions are offers, and every one is dismissible.
 *   3. Never predict a date for a body outcome. Report the trend that exists.
 *   4. Never diagnose. Point at a professional and stop.
 *   5. A gap in the data is a gap in the data, not a verdict on the person.
 */

export const TONE = {
  missedDay: 'Missed today? No problem — pick it back up tomorrow.',
  emptyDay: 'Nothing logged yet. Whenever it fits is the right time.',
  quietWeek: 'A lighter week. That happens, and it evens out.',
  encouragementGeneric: 'Small things, done often. That is the whole plan.',
  approximate: 'Approximate',
  approximateNote:
    'Nutrition values are estimates based on typical figures for each ingredient, not exact measurements.',
  notMedical:
    'GlowUp tracks habits and progress. It does not give medical advice or diagnose anything.',
} as const;

/** Weekly consistency, described without a grade attached. */
export function consistencyPhrase(rate: number, label: string): string {
  if (rate >= 90) return `${label} has been very steady this week.`;
  if (rate >= 70) return `${label} has been mostly steady this week.`;
  if (rate >= 40) return `${label} came and went this week.`;
  if (rate > 0) return `${label} was light this week.`;
  return `No ${label.toLowerCase()} logged this week yet.`;
}

/**
 * Weight trend, stated as an observation. Deliberately avoids "gained/lost" as
 * a judgement and never extrapolates to a date.
 */
export function weightTrendPhrase(changeKg: number | null, weeks: number): string {
  if (changeKg === null) return 'Not enough weigh-ins yet to read a trend.';
  const abs = Math.abs(changeKg);
  const span = weeks === 1 ? 'over the last week' : `over the last ${weeks} weeks`;

  if (abs < 0.2) return `Your trend has been roughly level ${span}.`;
  if (changeKg > 0) return `Your trend is up about ${abs.toFixed(1)} kg ${span}.`;
  return `Your trend is down about ${abs.toFixed(1)} kg ${span}.`;
}

/** Shown when the trend has been flat for a while. Neutral, one action. */
export const STALL_NOTE =
  "Your recent trend hasn't moved much. It may be worth reviewing your food intake.";

/**
 * Shown on a sustained downward trend while the goal is gain. Points outward
 * rather than interpreting anything.
 */
export const DOWNWARD_TREND_NOTE =
  'Your weight has been trending down over several weeks while your goal is to gain. If that is unexpected, consider checking in with a doctor or dietitian.';

export const NO_COUNTDOWN_NOTE = 'Progress is based on your actual trend, not a target date.';

/** Milestone celebration — warm, brief, no confetti-cannon gamification. */
export function milestonePhrase(label: string, value: number, unit: string): string {
  return `${label} reached — ${value}${unit ? ` ${unit}` : ''}.`;
}

export const SUGGESTION_DISCLAIMER = 'A suggestion, not a plan. Dismiss it any time.';

/** Reminder copy: an offer with a question mark, never an alarm. */
export function reminderPhrase(habitName: string): string {
  return `Your ${habitName.toLowerCase()} isn't logged yet. Want to mark it now?`;
}

export const EMPTY_STATES = {
  weight: {
    title: 'No weigh-ins yet',
    body: 'Log your first weight and the chart fills in from there. Once a week is plenty.',
  },
  workouts: {
    title: 'No workouts logged yet',
    body: 'Start from one of your templates, or build a session as you go.',
  },
  skincare: {
    title: 'Nothing logged yet today',
    body: 'Tick off the steps you did. Optional steps never count against you.',
  },
  photos: {
    title: 'No photos yet',
    body: 'Photos are private to your account. Add one whenever you feel like it.',
  },
  timeline: {
    title: 'Your timeline starts here',
    body: 'As you log weight, workouts and routines, this fills in week by week.',
  },
  reviews: {
    title: 'No weekly reviews yet',
    body: 'At the end of a week, jot down how it felt. It takes about a minute.',
  },
  insights: {
    title: 'Not enough data yet',
    body: 'Insights appear once there is about a week of logs to look at.',
  },
} as const;
