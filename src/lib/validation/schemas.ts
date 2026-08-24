import { z } from 'zod';

/**
 * Validation schemas.
 *
 * One definition per input, shared by the client form (via
 * `@hookform/resolvers/zod`) and the Server Action that receives it. The action
 * re-parses rather than trusting the client — the shared schema is a
 * convenience, never the security boundary.
 */

const DATE_KEY = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD form');

const CLOCK_TIME = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, 'Expected a time like 14:30');

const uuid = z.string().uuid();

/**
 * Optional free text that stores as `null` when blank.
 *
 * `.nullish()`, not `.optional()`, and that distinction is load-bearing: these
 * schemas are parsed twice, once by the form and again by the Server Action
 * that receives the form's *output*. `.optional()` accepts `undefined` but
 * rejects `null`, so a schema that turns `''` into `null` on the way out would
 * reject its own result on the way back in — a blank display name failed
 * onboarding with "Expected string, received null" and nothing said which
 * field. Parsing a parsed value must be a no-op.
 */
function optionalText(max: number, message?: string) {
  return z
    .string()
    .trim()
    .max(max, message ?? `Keep it under ${max} characters`)
    .nullish()
    .transform((value) => (value == null || value === '' ? null : value));
}

export const dateKeySchema = DATE_KEY;

// ── profile & settings ───────────────────────────────────────────────────────

export const profileSchema = z.object({
  display_name: optionalText(80, 'Keep your name under 80 characters'),
  height_cm: z
    .number({ invalid_type_error: 'Enter your height in centimetres' })
    .min(80, 'That looks too low')
    .max(260, 'That looks too high')
    .nullable(),
  timezone: z.string().min(1, 'Pick a timezone'),
  time_format: z.enum(['12h', '24h']),
  theme: z.enum(['light', 'dark', 'system']),
});
export type ProfileInput = z.infer<typeof profileSchema>;

export const settingsSchema = z.object({
  workouts_per_week: z
    .number()
    .int()
    .min(0, 'Cannot be negative')
    .max(14, 'That is a lot — 14 is the maximum'),
  preferred_workout_days: z.array(z.number().int().min(0).max(6)).max(7),
  typical_work_start: CLOCK_TIME.nullable(),
  typical_work_end: CLOCK_TIME.nullable(),
  commute_minutes: z.number().int().min(0).max(300).nullable(),
  weekly_weigh_in_day: z.number().int().min(0).max(6),
  notifications_enabled: z.boolean(),
  quiet_hours_start: CLOCK_TIME,
  quiet_hours_end: CLOCK_TIME,
  max_daily_reminders: z.number().int().min(0).max(20),
  suggestions_enabled: z.boolean(),
});
export type SettingsInput = z.infer<typeof settingsSchema>;

export const gymConfigSchema = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(1, 'Give the gym a name').max(80),
    location: z.string().trim().max(120).nullable().optional(),
    access_start: CLOCK_TIME.nullable(),
    access_end: CLOCK_TIME.nullable(),
    available_days: z.array(z.number().int().min(0).max(6)),
    equipment: z.array(z.string().trim().min(1).max(60)).max(40),
  })
  .refine(
    (value) =>
      value.access_start === null ||
      value.access_end === null ||
      value.access_end > value.access_start,
    { message: 'Closing time must be after opening time', path: ['access_end'] },
  );
export type GymConfigInput = z.infer<typeof gymConfigSchema>;

// ── weight ───────────────────────────────────────────────────────────────────

export const weightEntrySchema = z.object({
  weight_kg: z
    .number({ invalid_type_error: 'Enter a weight' })
    .min(20, 'That looks too low')
    .max(400, 'That looks too high'),
  entry_date: DATE_KEY,
  note: optionalText(280, 'Keep notes under 280 characters'),
});
export type WeightEntryInput = z.infer<typeof weightEntrySchema>;

// ── daily metrics ─────────────────────────────────────────────────

export const DAY_MOODS = ['calm', 'happy', 'motivated', 'tired', 'stressed', 'low'] as const;

/**
 * One glass, up or down.
 *
 * A delta rather than a total, so the server is the only thing that decides
 * what the count becomes.
 */
export const waterAdjustSchema = z.object({
  metric_date: DATE_KEY,
  delta: z
    .number()
    .int('Water moves a glass at a time')
    .min(-1, 'Water moves a glass at a time')
    .max(1, 'Water moves a glass at a time'),
});
export type WaterAdjustInput = z.infer<typeof waterAdjustSchema>;

export const dailyMetricSchema = z.object({
  metric_date: DATE_KEY,
  // Nullable throughout: an unlogged night is not a night of zero sleep, and
  // the UI shows it as a dash rather than as a number nobody entered.
  sleep_hours: z
    .number({ invalid_type_error: 'Enter hours of sleep' })
    .min(0, 'That looks too low')
    .max(24, 'That looks too high')
    .nullish()
    .transform((value) => value ?? null),
  mood: z
    .enum(DAY_MOODS)
    .nullish()
    .transform((value) => value ?? null),
  note: optionalText(280, 'Keep notes under 280 characters'),
});
export type DailyMetricInput = z.infer<typeof dailyMetricSchema>;

// ── goals ────────────────────────────────────────────────────────────────────

export const goalSchema = z.object({
  id: uuid.optional(),
  type: z.enum([
    'weight',
    'workout_frequency',
    'nutrition_consistency',
    'skincare_consistency',
    'strength',
    'custom',
  ]),
  title: z.string().trim().min(1, 'Give the goal a title').max(120),
  description: z.string().trim().max(400).nullable().optional(),
  start_value: z.number().nullable(),
  target_value: z.number().nullable(),
  unit: z.string().trim().max(16).nullable().optional(),
});
export type GoalInput = z.infer<typeof goalSchema>;

export const milestoneSchema = z.object({
  id: uuid.optional(),
  label: z.string().trim().min(1, 'Give the milestone a label').max(80),
  target_value: z.number(),
  sort_order: z.number().int().min(0).max(100).default(0),
});
export type MilestoneInput = z.infer<typeof milestoneSchema>;

// ── habits ───────────────────────────────────────────────────────────────────

export const habitSchema = z
  .object({
    id: uuid.optional(),
    name: z.string().trim().min(1, 'Give the habit a name').max(60),
    category: z.enum(['nutrition', 'skincare', 'workout', 'recovery', 'custom']),
    icon: z.string().trim().max(32).nullable().optional(),
    frequency: z.enum(['daily', 'weekly', 'custom']),
    target_per_week: z.number().int().min(1).max(21).nullable(),
    preferred_part: z.enum(['morning', 'afternoon', 'evening', 'anytime']),
    window_start: CLOCK_TIME.nullable(),
    window_end: CLOCK_TIME.nullable(),
    reminder_enabled: z.boolean(),
    is_optional: z.boolean(),
    recipe_id: uuid.nullable().optional(),
  })
  .refine(
    (value) =>
      value.window_start === null ||
      value.window_end === null ||
      value.window_end > value.window_start,
    { message: 'The window must end after it starts', path: ['window_end'] },
  )
  .refine((value) => value.frequency !== 'weekly' || value.target_per_week !== null, {
    message: 'Weekly habits need a target',
    path: ['target_per_week'],
  });
export type HabitInput = z.infer<typeof habitSchema>;

export const habitCompletionSchema = z.object({
  habit_id: uuid,
  log_date: DATE_KEY,
  status: z.enum(['completed', 'skipped', 'modified']),
  note: z.string().trim().max(280).nullable().optional(),
  modification: z.string().trim().max(140).nullable().optional(),
});
export type HabitCompletionInput = z.infer<typeof habitCompletionSchema>;

// ── nutrition ────────────────────────────────────────────────────────────────

export const shakeIngredientSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, 'Name the ingredient').max(60),
  quantity: z.number().min(0, 'Cannot be negative').max(10000),
  unit: z.string().trim().min(1).max(16),
  calories_per_unit: z.number().min(0).max(10000),
  protein_g_per_unit: z.number().min(0).max(1000),
});
export type ShakeIngredientInput = z.infer<typeof shakeIngredientSchema>;

export const shakeRecipeSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, 'Give the recipe a name').max(80),
  notes: z.string().trim().max(500).nullable().optional(),
  is_default: z.boolean().default(false),
  ingredients: z
    .array(shakeIngredientSchema)
    .min(1, 'Add at least one ingredient')
    .max(30, 'That is a lot of ingredients'),
});
export type ShakeRecipeInput = z.infer<typeof shakeRecipeSchema>;

// ── workouts ─────────────────────────────────────────────────────────────────

export const exerciseSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, 'Name the exercise').max(60),
  muscle_group: z.enum([
    'biceps',
    'triceps',
    'forearms',
    'shoulders',
    'back',
    'chest',
    'quads',
    'hamstrings',
    'glutes',
    'calves',
    'core',
    'full_body',
  ]),
  equipment: z.string().trim().max(40).nullable().optional(),
  is_bodyweight: z.boolean().default(false),
  notes: z.string().trim().max(280).nullable().optional(),
});
export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const exerciseSetSchema = z.object({
  id: uuid.optional(),
  set_index: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(500).nullable(),
  weight_kg: z.number().min(0).max(1000).nullable(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  is_warmup: z.boolean().default(false),
  completed: z.boolean().default(true),
});
export type ExerciseSetInput = z.infer<typeof exerciseSetSchema>;

export const startWorkoutSchema = z.object({
  template_id: uuid.nullable(),
  name: z.string().trim().min(1).max(80),
  workout_date: DATE_KEY,
  location: z.enum(['office_gym', 'home', 'other']),
});
export type StartWorkoutInput = z.infer<typeof startWorkoutSchema>;

export const finishWorkoutSchema = z.object({
  workout_id: uuid,
  duration_minutes: z.number().int().min(0).max(600).nullable(),
  notes: z.string().trim().max(500).nullable().optional(),
});
export type FinishWorkoutInput = z.infer<typeof finishWorkoutSchema>;

export const workoutTemplateSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, 'Name the template').max(60),
  focus: z.string().trim().max(80).nullable().optional(),
  description: z.string().trim().max(400).nullable().optional(),
  exercises: z
    .array(
      z.object({
        exercise_id: uuid,
        target_sets: z.number().int().min(1).max(20),
        target_reps_min: z.number().int().min(1).max(100),
        target_reps_max: z.number().int().min(1).max(100),
      }),
    )
    .min(1, 'Add at least one exercise')
    .max(20),
});
export type WorkoutTemplateInput = z.infer<typeof workoutTemplateSchema>;

// ── skincare ─────────────────────────────────────────────────────────────────

export const skincareProductSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, 'Name the product').max(80),
  brand: z.string().trim().max(60).nullable().optional(),
  category: z.enum(['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf', 'other']),
  notes: z.string().trim().max(280).nullable().optional(),
});
export type SkincareProductInput = z.infer<typeof skincareProductSchema>;

export const skincareStepSchema = z.object({
  id: uuid.optional(),
  product_id: uuid.nullable(),
  label: z.string().trim().max(60).nullable().optional(),
  is_optional: z.boolean(),
  sort_order: z.number().int().min(0).max(50),
});
export type SkincareStepInput = z.infer<typeof skincareStepSchema>;

/**
 * What the routine editor actually collects.
 *
 * One form, one step: the product it uses, an optional note shown underneath,
 * and whether missing it counts. The action below splits this across
 * `skincare_products` and `skincare_routine_steps` so the caller never has to
 * know there are two tables.
 */
export const routineStepFormSchema = z.object({
  id: uuid.optional(),
  period: z.enum(['am', 'pm']),
  name: z
    .string()
    .trim()
    .min(1, 'Name the step or the product you use')
    .max(80, 'Keep the name under 80 characters'),
  brand: optionalText(60, 'Keep the brand under 60 characters'),
  category: z.enum(['cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf', 'other']),
  note: optionalText(60, 'Keep the note under 60 characters'),
  is_optional: z.boolean(),
});
export type RoutineStepFormInput = z.infer<typeof routineStepFormSchema>;

export const skincareEntrySchema = z.object({
  log_date: DATE_KEY,
  period: z.enum(['am', 'pm']),
  steps: z.array(
    z.object({
      step_id: uuid,
      status: z.enum(['completed', 'skipped', 'modified']),
      note: z.string().trim().max(200).nullable().optional(),
    }),
  ),
  note: z.string().trim().max(280).nullable().optional(),
});
export type SkincareEntryInput = z.infer<typeof skincareEntrySchema>;

export const skinLogSchema = z.object({
  log_date: DATE_KEY,
  conditions: z
    .array(z.enum(['good', 'clear', 'dry', 'oily', 'irritated', 'breakout', 'other']))
    .max(7),
  note: z.string().trim().max(400).nullable().optional(),
});
export type SkinLogInput = z.infer<typeof skinLogSchema>;

// ── photos, reviews, milestones ──────────────────────────────────────────────

export const progressPhotoSchema = z.object({
  category: z.enum(['full_body', 'arms', 'lower_body', 'skin', 'other']),
  taken_on: DATE_KEY,
  note: z.string().trim().max(280).nullable().optional(),
});
export type ProgressPhotoInput = z.infer<typeof progressPhotoSchema>;

export const weeklyReviewSchema = z.object({
  week_start: DATE_KEY,
  feeling: z.enum(['great', 'good', 'okay', 'difficult']).nullable(),
  notes: optionalText(2000, 'Keep the notes under 2000 characters'),
});
export type WeeklyReviewInput = z.infer<typeof weeklyReviewSchema>;

export const timelineMilestoneSchema = z.object({
  id: uuid.optional(),
  occurred_on: DATE_KEY,
  title: z.string().trim().min(1, 'Give the milestone a title').max(120),
  description: z.string().trim().max(500).nullable().optional(),
});
export type TimelineMilestoneInput = z.infer<typeof timelineMilestoneSchema>;

// ── auth & onboarding ────────────────────────────────────────────────────────

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_RULE = `At least ${PASSWORD_MIN_LENGTH} characters.`;

const emailField = z
  .string()
  .trim()
  .min(1, 'Enter your email')
  .email('That does not look like an email');

export const credentialsSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
    .max(72, 'Maximum 72 characters'),
});
export type CredentialsInput = z.infer<typeof credentialsSchema>;

/**
 * Signing in is not signing up.
 *
 * A login form must not enforce the *signup* password rule: someone whose
 * account predates the rule still has to get in, and "Use at least 8
 * characters" under a login box reads as a complaint about a password that is
 * already correct. All this needs to know is whether the box is empty — the
 * auth server decides the rest.
 */
export const signInSchema = z.object({
  email: emailField,
  password: z.string().min(1, 'Enter your password').max(72, 'Maximum 72 characters'),
});
export type SignInInput = z.infer<typeof signInSchema>;

export const signUpSchema = credentialsSchema
  .extend({
    display_name: z
      .string()
      .trim()
      .max(80, 'Keep your name under 80 characters')
      .nullish()
      .transform((v) => (v == null || v === '' ? undefined : v)),
    confirm_password: z.string().min(1, 'Type your password again'),
    accepted_terms: z.literal(true, {
      errorMap: () => ({ message: 'Please accept the privacy policy and terms to continue' }),
    }),
  })
  .refine((value) => value.password === value.confirm_password, {
    message: 'Those two passwords do not match',
    path: ['confirm_password'],
  });
export type SignUpInput = z.infer<typeof signUpSchema>;

export const forgotPasswordSchema = z.object({ email: emailField });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters`)
      .max(72, 'Maximum 72 characters'),
    confirm_password: z.string().min(1, 'Type your new password again'),
  })
  .refine((value) => value.password === value.confirm_password, {
    message: 'Those two passwords do not match',
    path: ['confirm_password'],
  });
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

/**
 * Onboarding.
 *
 * Every message here is written for the person filling the form: it names the
 * field and its unit, so it still makes sense on its own next to an input.
 * Nothing surfaces a raw Zod string like "Number must be greater than or equal
 * to 20" — that told the user neither which field nor which step.
 */

export const WEIGHT_MIN_KG = 20;
export const WEIGHT_MAX_KG = 400;
export const HEIGHT_MIN_CM = 100;
export const HEIGHT_MAX_CM = 250;

/**
 * A bounded weight in kilograms.
 *
 * Bounds are checked on the *parsed number*, never on the keystrokes: a
 * `<input type="number">` quietly drops a typed `-`, which is how `-5` used to
 * arrive at the server as `5`. The inputs are plain text for that reason and
 * the string is parsed here.
 */
function weightKgField(label: string) {
  const message = `Enter ${label} between ${WEIGHT_MIN_KG} and ${WEIGHT_MAX_KG} kg`;
  return z
    .number({ required_error: message, invalid_type_error: message })
    .refine((value) => Number.isFinite(value), message)
    .refine((value) => value >= WEIGHT_MIN_KG && value <= WEIGHT_MAX_KG, message);
}

const HEIGHT_MESSAGE = `Enter a height between ${HEIGHT_MIN_CM} and ${HEIGHT_MAX_CM} cm`;

export const onboardingSchema = z.object({
  display_name: optionalText(80, 'Keep your name under 80 characters'),
  // Optional: someone who would rather not say can leave it blank.
  height_cm: z
    .number({ invalid_type_error: HEIGHT_MESSAGE })
    .refine((value) => Number.isFinite(value), HEIGHT_MESSAGE)
    .refine((value) => value >= HEIGHT_MIN_CM && value <= HEIGHT_MAX_CM, HEIGHT_MESSAGE)
    .nullable(),
  timezone: z.string().min(1, 'Pick a timezone'),
  time_format: z.enum(['12h', '24h']),
  current_weight_kg: weightKgField('a current weight'),
  goal_weight_kg: weightKgField('a goal weight'),
  workouts_per_week: z
    .number({ invalid_type_error: 'Enter how many sessions a week, from 0 to 14' })
    .int('Enter a whole number of sessions')
    .min(0, 'Sessions a week cannot be negative')
    .max(14, 'Enter at most 14 sessions a week'),
  preferred_workout_days: z.array(z.number().int().min(0).max(6)).max(7),
  typical_work_start: CLOCK_TIME.nullable(),
  typical_work_end: CLOCK_TIME.nullable(),
  gym_access_end: CLOCK_TIME.nullable(),
  enabled_habit_ids: z.array(uuid),
  notifications_enabled: z.boolean(),
});
export type OnboardingInput = z.infer<typeof onboardingSchema>;

/**
 * Which wizard step owns which field.
 *
 * Used for two things, and they are the same thing seen from both ends: the
 * client validates only the current step's fields on Continue, and a server
 * error is routed back to the step that owns the offending field instead of
 * being dumped at wizard level with no way back to it.
 */
export const ONBOARDING_STEP_FIELDS = [
  ['display_name', 'height_cm', 'timezone', 'time_format'],
  ['current_weight_kg', 'goal_weight_kg'],
  ['enabled_habit_ids'],
  [
    'workouts_per_week',
    'preferred_workout_days',
    'typical_work_start',
    'typical_work_end',
    'gym_access_end',
  ],
  [],
  [],
  ['notifications_enabled'],
] as const satisfies readonly (readonly (keyof OnboardingInput)[])[];

/** Validates just the fields step `index` owns. */
export function onboardingStepSchema(index: number) {
  const fields = ONBOARDING_STEP_FIELDS[index] ?? [];
  if (fields.length === 0) return z.object({});
  const mask = Object.fromEntries(fields.map((field) => [field, true as const]));
  return onboardingSchema.pick(mask as Record<keyof OnboardingInput, true>);
}

/** The first step that owns any of `fields`, or 0 if none of them do. */
export function onboardingStepForFields(fields: string[]): number {
  for (let index = 0; index < ONBOARDING_STEP_FIELDS.length; index += 1) {
    const owned = ONBOARDING_STEP_FIELDS[index] as readonly string[];
    if (fields.some((field) => owned.includes(field))) return index;
  }
  return 0;
}
