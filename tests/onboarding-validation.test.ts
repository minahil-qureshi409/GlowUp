import { describe, expect, it } from 'vitest';

import {
  ONBOARDING_STEP_FIELDS,
  onboardingSchema,
  onboardingStepForFields,
  onboardingStepSchema,
  profileSchema,
  routineStepFormSchema,
  signUpSchema,
  weeklyReviewSchema,
  weightEntrySchema,
  WEIGHT_MAX_KG,
  WEIGHT_MIN_KG,
} from '@/lib/validation/schemas';

/**
 * Onboarding validation.
 *
 * The bug: current weight `0` and goal weight `5` were accepted on step 2, the
 * wizard let you walk all the way to step 7, and Finish then produced a bare
 * red banner reading "Number must be greater than or equal to 20" — with no
 * field named, no unit, no step, and no way back to the input.
 *
 * So there are two things to hold: the *bounds* must reject what they always
 * should have, on the step that owns them, and the *messages* must never be a
 * raw Zod string again.
 */

/** Mirrors the component: blank is `undefined`, anything else goes to Number. */
function parseNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  return Number(trimmed);
}

const GOAL_STEP = 1;

function checkWeight(field: 'current_weight_kg' | 'goal_weight_kg', typed: string) {
  const other = field === 'current_weight_kg' ? 'goal_weight_kg' : 'current_weight_kg';
  const result = onboardingStepSchema(GOAL_STEP).safeParse({
    [field]: parseNumber(typed),
    [other]: 60,
  });

  if (result.success) return { ok: true as const, message: null };
  const issue = result.error.issues.find((i) => i.path[0] === field);
  return { ok: false as const, message: issue?.message ?? null };
}

const RAW_ZOD_PATTERNS = [
  /^Number must be/i,
  /^Expected number/i,
  /^String must contain/i,
  /^Invalid input/i,
  /^Required$/i,
  /greater than or equal to/i,
  /less than or equal to/i,
];

describe.each(['current_weight_kg', 'goal_weight_kg'] as const)('%s', (field) => {
  const label = field === 'current_weight_kg' ? 'a current weight' : 'a goal weight';
  const expected = `Enter ${label} between ${WEIGHT_MIN_KG} and ${WEIGHT_MAX_KG} kg`;

  // The exact set the acceptance criteria name.
  it.each([
    ['0', false],
    ['-5', false],
    ['19', false],
    ['20', true],
    ['400', true],
    ['401', false],
    ['', false],
    ['abc', false],
  ] as const)('%s -> %s', (typed, shouldPass) => {
    const result = checkWeight(field, typed);
    expect(result.ok).toBe(shouldPass);
  });

  it('names the field and the unit in every rejection', () => {
    for (const typed of ['0', '-5', '19', '401', '', 'abc']) {
      const result = checkWeight(field, typed);
      expect(result.ok).toBe(false);
      expect(result.message).toBe(expected);
    }
  });

  it('never surfaces a raw Zod message', () => {
    for (const typed of ['0', '-5', '19', '401', '', 'abc', 'NaN', 'Infinity', '1e400']) {
      const result = checkWeight(field, typed);
      if (result.ok) continue;
      for (const pattern of RAW_ZOD_PATTERNS) {
        expect(result.message).not.toMatch(pattern);
      }
    }
  });

  it('rejects a negative that an <input type="number"> would have swallowed', () => {
    // The browser drops the typed `-`, so `-5` used to arrive as `5` and pass a
    // `min(20)` check it should have failed. Parsing the raw string is what
    // makes this test meaningful.
    expect(checkWeight(field, '-5').ok).toBe(false);
    expect(checkWeight(field, '5').ok).toBe(false);
    expect(Number('-5')).toBe(-5);
  });
});

describe('height', () => {
  const ABOUT_STEP = 0;

  function checkHeight(typed: string) {
    return onboardingStepSchema(ABOUT_STEP).safeParse({
      display_name: '',
      height_cm: typed.trim() === '' ? null : parseNumber(typed),
      timezone: 'Asia/Karachi',
      time_format: '12h',
    });
  }

  it.each([
    ['', true], // optional — blank is a legitimate answer
    ['99', false],
    ['100', true],
    ['250', true],
    ['251', false],
    ['0', false],
    ['-170', false],
    ['abc', false],
  ] as const)('%s -> %s', (typed, shouldPass) => {
    expect(checkHeight(typed).success).toBe(shouldPass);
  });

  it('names the field and the unit', () => {
    const result = checkHeight('99');
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues[0]?.message).toBe('Enter a height between 100 and 250 cm');
  });
});

describe('step ownership', () => {
  it('routes a weight error back to the step that owns it', () => {
    expect(onboardingStepForFields(['current_weight_kg'])).toBe(1);
    expect(onboardingStepForFields(['goal_weight_kg'])).toBe(1);
    expect(onboardingStepForFields(['height_cm'])).toBe(0);
    expect(onboardingStepForFields(['workouts_per_week'])).toBe(3);
    expect(onboardingStepForFields(['notifications_enabled'])).toBe(6);
  });

  it('falls back to the first step for an unrecognised field', () => {
    expect(onboardingStepForFields(['something_else'])).toBe(0);
    expect(onboardingStepForFields([])).toBe(0);
  });

  it('covers every field of the schema exactly once', () => {
    const owned = ONBOARDING_STEP_FIELDS.flat();
    const schemaFields = Object.keys(onboardingSchema.shape);

    expect(new Set(owned).size).toBe(owned.length);
    expect([...owned].sort()).toEqual([...schemaFields].sort());
  });

  it('means the wizard cannot reach the last step in an unsubmittable state', () => {
    // If every step validates its own fields, a draft that passes all of them
    // must pass the whole schema — which is the property the wizard relies on.
    const draft = {
      display_name: 'Sam',
      height_cm: 168,
      timezone: 'Asia/Karachi',
      time_format: '24h' as const,
      current_weight_kg: 62,
      goal_weight_kg: 67,
      workouts_per_week: 3,
      preferred_workout_days: [1, 3, 5],
      typical_work_start: '09:00',
      typical_work_end: '17:30',
      gym_access_end: null,
      enabled_habit_ids: [],
      notifications_enabled: false,
    };

    for (let step = 0; step < ONBOARDING_STEP_FIELDS.length; step += 1) {
      const fields = ONBOARDING_STEP_FIELDS[step] ?? [];
      const subset = Object.fromEntries(
        fields.map((field) => [field, draft[field as keyof typeof draft]]),
      );
      expect(onboardingStepSchema(step).safeParse(subset).success).toBe(true);
    }

    expect(onboardingSchema.safeParse(draft).success).toBe(true);
  });

  it('rejects the whole draft when a weight is out of bounds', () => {
    const parsed = onboardingSchema.safeParse({
      display_name: '',
      height_cm: null,
      timezone: 'UTC',
      time_format: '12h',
      current_weight_kg: 0,
      goal_weight_kg: 5,
      workouts_per_week: 3,
      preferred_workout_days: [],
      typical_work_start: null,
      typical_work_end: null,
      gym_access_end: null,
      enabled_habit_ids: [],
      notifications_enabled: false,
    });

    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const fields = parsed.error.issues.map((issue) => issue.path.join('.'));
    expect(fields).toContain('current_weight_kg');
    expect(fields).toContain('goal_weight_kg');
    // …and the wizard would land the user on step 2, not leave them on step 7.
    expect(onboardingStepForFields(fields)).toBe(1);
  });
});

/**
 * Every one of these schemas is parsed twice: once by the form, and again by
 * the Server Action that receives the form's *output*. So parsing a parsed
 * value has to be a no-op.
 *
 * It was not. `.optional().transform(v => v === '' ? null : v)` turns a blank
 * field into `null` on the way out, and `.optional()` rejects `null` on the way
 * back in — so leaving the name box empty in onboarding failed on the server
 * with "Expected string, received null", which is exactly the class of
 * unattributed Zod message WP1 exists to eliminate.
 */
describe('schemas survive a round trip', () => {
  const cases = [
    {
      name: 'onboarding with a blank name',
      schema: onboardingSchema,
      input: {
        display_name: '',
        height_cm: null,
        timezone: 'Asia/Karachi',
        time_format: '12h',
        current_weight_kg: 62,
        goal_weight_kg: 67,
        workouts_per_week: 3,
        preferred_workout_days: [],
        typical_work_start: null,
        typical_work_end: null,
        gym_access_end: null,
        enabled_habit_ids: [],
        notifications_enabled: false,
      },
    },
    {
      name: 'profile with a blank name',
      schema: profileSchema,
      input: {
        display_name: '',
        height_cm: null,
        timezone: 'UTC',
        time_format: '24h',
        theme: 'system',
      },
    },
    {
      name: 'weigh-in with no note',
      schema: weightEntrySchema,
      input: { weight_kg: 62.4, entry_date: '2026-08-24', note: '' },
    },
    {
      name: 'weekly review with no notes',
      schema: weeklyReviewSchema,
      input: { week_start: '2026-08-17', feeling: 'good', notes: '' },
    },
    {
      name: 'routine step with no brand or note',
      schema: routineStepFormSchema,
      input: {
        period: 'am',
        name: 'Gentle gel cleanser',
        brand: '',
        category: 'cleanser',
        note: '',
        is_optional: false,
      },
    },
    {
      name: 'signup with no display name',
      schema: signUpSchema,
      input: {
        email: 'someone@example.com',
        password: 'a-good-password',
        confirm_password: 'a-good-password',
        display_name: '',
        accepted_terms: true,
      },
    },
  ] as const;

  it.each(cases)('$name', ({ schema, input }) => {
    const first = schema.safeParse(input);
    expect(first.success).toBe(true);
    if (!first.success) return;

    // The output must be acceptable input, and must not change again.
    const second = schema.safeParse(first.data);
    expect(second.success).toBe(true);
    if (!second.success) return;

    expect(second.data).toEqual(first.data);
  });
});
