'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RoutineStepManager } from '@/components/skincare/routine-step-manager';
import { completeOnboarding } from '@/server/actions/settings';
import type { Habit } from '@/services/habits';
import type { RoutineWithSteps } from '@/services/skincare';
import {
  onboardingSchema,
  onboardingStepForFields,
  onboardingStepSchema,
  ONBOARDING_STEP_FIELDS,
  type OnboardingInput,
} from '@/lib/validation/schemas';
import { detectTimezone, DAY_NAMES, DAY_NAMES_SHORT } from '@/lib/date';
import { formatHeightImperial } from '@/lib/format';
import { cn } from '@/lib/utils';

type OnboardingFlowProps = {
  displayName: string | null;
  heightCm: number | null;
  habits: Habit[];
  routines: RoutineWithSteps[];
  /** Only the ones this deployment actually has credentials for. */
  calendarProviders: { id: string; label: string }[];
};

const STEPS = [
  'About you',
  'Your goal',
  'Food',
  'Training',
  'Skincare',
  'Calendar',
  'Reminders',
] as const;

type FieldName = keyof OnboardingInput;

/**
 * The draft the form actually holds.
 *
 * Every number is a *string* here, deliberately. An `<input type="number">`
 * silently discards characters the browser dislikes — a typed `-` vanishes, so
 * `-5` arrived as `5` and passed a `min(20)` check it should have failed. Text
 * inputs keep exactly what was typed, and the string is parsed once, in one
 * place, and validated as a number.
 */
type Draft = {
  display_name: string;
  height_cm: string;
  timezone: string;
  time_format: OnboardingInput['time_format'];
  current_weight_kg: string;
  goal_weight_kg: string;
  workouts_per_week: string;
  preferred_workout_days: number[];
  typical_work_start: string;
  typical_work_end: string;
  gym_access_end: string;
  enabled_habit_ids: string[];
  notifications_enabled: boolean;
};

/**
 * Parses a typed number.
 *
 * `undefined` for blank so Zod reports "required" rather than reading `''` as
 * `0` — `Number('')` is `0`, which is how an empty weight box used to sail past
 * a minimum of 20 and only fail five steps later.
 */
function parseNumber(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return undefined;
  return Number(trimmed);
}

function toInput(draft: Draft): Record<string, unknown> {
  return {
    display_name: draft.display_name,
    height_cm: draft.height_cm.trim() === '' ? null : parseNumber(draft.height_cm),
    timezone: draft.timezone,
    time_format: draft.time_format,
    current_weight_kg: parseNumber(draft.current_weight_kg),
    goal_weight_kg: parseNumber(draft.goal_weight_kg),
    workouts_per_week: parseNumber(draft.workouts_per_week),
    preferred_workout_days: draft.preferred_workout_days,
    typical_work_start: draft.typical_work_start || null,
    typical_work_end: draft.typical_work_end || null,
    gym_access_end: draft.gym_access_end || null,
    enabled_habit_ids: draft.enabled_habit_ids,
    notifications_enabled: draft.notifications_enabled,
  };
}

/** Field errors for one step, keyed by field name. */
function errorsForStep(draft: Draft, step: number): Partial<Record<FieldName, string>> {
  const fields = ONBOARDING_STEP_FIELDS[step] ?? [];
  const input = toInput(draft);
  const subset = Object.fromEntries(fields.map((field) => [field, input[field]]));
  const parsed = onboardingStepSchema(step).safeParse(subset);
  if (parsed.success) return {};

  const found: Partial<Record<FieldName, string>> = {};
  for (const issue of parsed.error.issues) {
    const key = issue.path[0] as FieldName | undefined;
    if (key && !found[key]) found[key] = issue.message;
  }
  return found;
}

/**
 * Onboarding.
 *
 * Seven short steps. Each one validates the fields it owns — on blur and on
 * Continue — and renders the message directly under the input that caused it.
 * Nothing is deferred to Finish, because an error that appears five steps after
 * the mistake, with no way back to the field, is an abandoned signup.
 */
export function OnboardingFlow({
  displayName,
  heightCm,
  habits,
  routines,
  calendarProviders,
}: OnboardingFlowProps) {
  const router = useRouter();
  const [step, setStep] = React.useState(0);
  const [pending, startTransition] = React.useTransition();
  const [formError, setFormError] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Partial<Record<FieldName, string>>>({});

  const [draft, setDraft] = React.useState<Draft>({
    display_name: displayName ?? '',
    // Empty, with a placeholder. Body metrics belong to the person entering
    // them; a pre-filled 171.5 cm / 47 kg was one person's, shown to everyone.
    height_cm: heightCm === null ? '' : String(heightCm),
    timezone: 'UTC',
    time_format: '12h',
    current_weight_kg: '',
    goal_weight_kg: '',
    workouts_per_week: '3',
    preferred_workout_days: [],
    typical_work_start: '',
    typical_work_end: '',
    gym_access_end: '',
    enabled_habit_ids: habits.map((habit) => habit.id),
    notifications_enabled: false,
  });

  // The device's timezone is the right default; asking would be busywork.
  React.useEffect(() => {
    const stored = (() => {
      try {
        return window.sessionStorage.getItem('glowup:tz');
      } catch {
        return null;
      }
    })();
    setDraft((current) => ({ ...current, timezone: stored ?? detectTimezone() }));
  }, []);

  function patch(next: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...next }));
    // Clear the errors for the fields being edited: an error that survives the
    // fix is just noise.
    const touched = Object.keys(next) as FieldName[];
    setErrors((current) => {
      if (!touched.some((field) => current[field])) return current;
      const next2 = { ...current };
      for (const field of touched) delete next2[field];
      return next2;
    });
  }

  /** Re-checks one field, on blur. Only ever touches that field's message. */
  function validateField(field: FieldName) {
    const found = errorsForStep(draft, step);
    setErrors((current) => {
      const next = { ...current };
      if (found[field]) next[field] = found[field];
      else delete next[field];
      return next;
    });
  }

  function focusField(field: FieldName) {
    if (typeof document === 'undefined') return;
    document.getElementById(`ob-${field}`)?.focus();
  }

  /** True if the step is clean. Otherwise renders its errors and stays put. */
  function commitStep(index: number): boolean {
    const found = errorsForStep(draft, index);
    const keys = Object.keys(found) as FieldName[];
    setErrors((current) => ({ ...current, ...found }));
    if (keys.length === 0) return true;
    setFormError(null);
    const first = keys[0];
    if (first) window.requestAnimationFrame(() => focusField(first));
    return false;
  }

  function goNext() {
    if (!commitStep(step)) return;
    setFormError(null);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function goBack() {
    setFormError(null);
    setStep((s) => Math.max(0, s - 1));
  }

  /** Walks every step, stopping at the first that will not validate. */
  function firstInvalidStep(): number | null {
    for (let index = 0; index < STEPS.length; index += 1) {
      const found = errorsForStep(draft, index);
      if (Object.keys(found).length > 0) {
        setErrors((current) => ({ ...current, ...found }));
        return index;
      }
    }
    return null;
  }

  function finish() {
    setFormError(null);

    const invalid = firstInvalidStep();
    if (invalid !== null) {
      setStep(invalid);
      return;
    }

    const parsed = onboardingSchema.safeParse(toInput(draft));
    if (!parsed.success) {
      applyFieldErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [issue.path.join('.'), [issue.message]]),
        ),
      );
      return;
    }

    startTransition(async () => {
      const result = await completeOnboarding(parsed.data);
      if (!result.ok) {
        // A server error is rendered on the step that owns the field, and the
        // wizard navigates there — not left as a banner five screens away.
        if (result.fieldErrors && Object.keys(result.fieldErrors).length > 0) {
          applyFieldErrors(result.fieldErrors);
          return;
        }
        setFormError(result.error);
        return;
      }
      toast.success("You're set up ✨");
      router.push('/today');
      router.refresh();
    });
  }

  function applyFieldErrors(fieldErrors: Record<string, string[]>) {
    const mapped: Partial<Record<FieldName, string>> = {};
    for (const [key, messages] of Object.entries(fieldErrors)) {
      const field = key.split('.')[0] as FieldName;
      const message = messages[0];
      if (field && message && !mapped[field]) mapped[field] = message;
    }

    const keys = Object.keys(mapped);
    if (keys.length === 0) {
      setFormError('Please check the highlighted fields.');
      return;
    }

    setErrors((current) => ({ ...current, ...mapped }));
    const target = onboardingStepForFields(keys);
    setStep(target);
    const first = keys[0] as FieldName | undefined;
    if (first) window.requestAnimationFrame(() => focusField(first));
  }

  function toggleHabit(id: string) {
    setDraft((current) => ({
      ...current,
      enabled_habit_ids: current.enabled_habit_ids.includes(id)
        ? current.enabled_habit_ids.filter((habitId) => habitId !== id)
        : [...current.enabled_habit_ids, id],
    }));
  }

  function toggleDay(day: number) {
    setDraft((current) => {
      const set = new Set(current.preferred_workout_days);
      if (set.has(day)) set.delete(day);
      else set.add(day);
      return { ...current, preferred_workout_days: [...set].sort() };
    });
  }

  const isLast = step === STEPS.length - 1;
  const nutritionHabits = habits.filter((habit) => habit.category === 'nutrition');
  const skincareHabits = habits.filter((habit) => habit.category === 'skincare');
  const heightNumber = parseNumber(draft.height_cm);

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-5 py-10">
      {/*
        Back, progress and position on one row. The old stacked version pushed
        the actual question below the fold on a small phone, which is a poor
        trade for a wordmark you have already seen.
      */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || pending}
          aria-label="Back a step"
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground disabled:opacity-40"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
        </button>

        <Progress
          value={((step + 1) / STEPS.length) * 100}
          className="h-1"
          aria-label={`Step ${step + 1} of ${STEPS.length}`}
        />

        <span className="tabular shrink-0 text-xs text-subtle">
          {step + 1}/{STEPS.length}
        </span>
      </div>

      <p className="sr-only">
        Step {step + 1} of {STEPS.length}: {STEPS[step]}
      </p>

      <div className="surface-card space-y-5 p-6">
        {step === 0 ? (
          <>
            <StepHeading
              title="A little about you"
              body="Only what the app actually needs. You can change all of it later."
            />
            <div className="space-y-1.5">
              <Label htmlFor="ob-display_name">What should we call you?</Label>
              <Input
                id="ob-display_name"
                autoComplete="given-name"
                placeholder="Optional"
                value={draft.display_name}
                onChange={(event) => patch({ display_name: event.target.value })}
                onBlur={() => validateField('display_name')}
                {...invalidProps('display_name', errors)}
              />
              <FieldError field="display_name" errors={errors} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ob-height_cm">Height in centimetres (optional)</Label>
              <Input
                id="ob-height_cm"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="e.g. 165"
                value={draft.height_cm}
                onChange={(event) => patch({ height_cm: event.target.value })}
                onBlur={() => validateField('height_cm')}
                {...invalidProps('height_cm', errors)}
              />
              <FieldError field="height_cm" errors={errors} />
              {!errors.height_cm && heightNumber !== undefined && Number.isFinite(heightNumber) ? (
                <p className="text-xs text-muted-foreground">
                  ≈ {formatHeightImperial(heightNumber)}
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ob-format">Time format</Label>
              <Select
                value={draft.time_format}
                onValueChange={(value) =>
                  patch({ time_format: value as OnboardingInput['time_format'] })
                }
              >
                <SelectTrigger id="ob-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="12h">12-hour</SelectItem>
                  <SelectItem value="24h">24-hour</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Timezone detected as {draft.timezone.replace(/_/g, ' ')}. Every date in the app is
                worked out in this zone.
              </p>
              <FieldError field="timezone" errors={errors} />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <StepHeading
              title="Where you are, where you're headed"
              body="No deadlines and no pace targets — progress is read from your real trend."
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ob-current_weight_kg">Current weight (kg)</Label>
                <Input
                  id="ob-current_weight_kg"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="e.g. 62"
                  value={draft.current_weight_kg}
                  onChange={(event) => patch({ current_weight_kg: event.target.value })}
                  onBlur={() => validateField('current_weight_kg')}
                  {...invalidProps('current_weight_kg', errors)}
                />
                <FieldError field="current_weight_kg" errors={errors} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-goal_weight_kg">Goal weight (kg)</Label>
                <Input
                  id="ob-goal_weight_kg"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="e.g. 67"
                  value={draft.goal_weight_kg}
                  onChange={(event) => patch({ goal_weight_kg: event.target.value })}
                  onBlur={() => validateField('goal_weight_kg')}
                  {...invalidProps('goal_weight_kg', errors)}
                />
                <FieldError field="goal_weight_kg" errors={errors} />
              </div>
            </div>
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              Milestones are built between these two numbers. Change either one later and they
              rebuild.
            </p>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <StepHeading
              title="Your food habits"
              body="Tick what you want to track. No calorie counting — just habits you complete whenever they fit."
            />
            <ul className="space-y-2">
              {nutritionHabits.map((habit) => (
                <HabitToggle
                  key={habit.id}
                  label={habit.name}
                  hint={habit.is_optional ? 'Optional — never counted as missed' : undefined}
                  checked={draft.enabled_habit_ids.includes(habit.id)}
                  onChange={() => toggleHabit(habit.id)}
                />
              ))}
            </ul>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <StepHeading
              title="Training"
              body="A weekly count rather than fixed days, so a busy week just moves things around."
            />
            <div className="space-y-1.5">
              <Label htmlFor="ob-workouts_per_week">Sessions per week</Label>
              <Input
                id="ob-workouts_per_week"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={draft.workouts_per_week}
                onChange={(event) => patch({ workouts_per_week: event.target.value })}
                onBlur={() => validateField('workouts_per_week')}
                {...invalidProps('workouts_per_week', errors)}
              />
              <FieldError field="workouts_per_week" errors={errors} />
            </div>

            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Days that usually work (optional)</legend>
              <div className="flex flex-wrap gap-1.5">
                {DAY_NAMES.map((name, index) => {
                  const active = draft.preferred_workout_days.includes(index);
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => toggleDay(index)}
                      aria-pressed={active}
                      aria-label={name}
                      className={cn(
                        'min-h-10 min-w-11 rounded-full border px-3 text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        active
                          ? 'border-primary bg-primary-soft text-primary'
                          : 'border-border text-muted-foreground hover:bg-muted/60',
                      )}
                    >
                      {DAY_NAMES_SHORT[index]}
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ob-typical_work_start">Work starts</Label>
                <Input
                  id="ob-typical_work_start"
                  type="time"
                  value={draft.typical_work_start}
                  onChange={(event) => patch({ typical_work_start: event.target.value })}
                  onBlur={() => validateField('typical_work_start')}
                  {...invalidProps('typical_work_start', errors)}
                />
                <FieldError field="typical_work_start" errors={errors} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ob-typical_work_end">Work usually ends</Label>
                <Input
                  id="ob-typical_work_end"
                  type="time"
                  value={draft.typical_work_end}
                  onChange={(event) => patch({ typical_work_end: event.target.value })}
                  onBlur={() => validateField('typical_work_end')}
                  {...invalidProps('typical_work_end', errors)}
                />
                <FieldError field="typical_work_end" errors={errors} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ob-gym_access_end">Gym available until (optional)</Label>
              <Input
                id="ob-gym_access_end"
                type="time"
                value={draft.gym_access_end}
                onChange={(event) => patch({ gym_access_end: event.target.value })}
                onBlur={() => validateField('gym_access_end')}
                {...invalidProps('gym_access_end', errors)}
              />
              <FieldError field="gym_access_end" errors={errors} />
              <p className="text-xs text-muted-foreground">
                Gym suggestions stop before this. Editable any time — gym hours change.
              </p>
            </div>
          </>
        ) : null}

        {step === 4 ? (
          <>
            <StepHeading
              title="Skincare"
              body="Two empty routines to fill in with what you actually use. Skip it and set them up later — nothing here is required."
            />
            <RoutineStepManager routines={routines} compact />
            {skincareHabits.length > 0 ? (
              <ul className="space-y-2">
                {skincareHabits.map((habit) => (
                  <HabitToggle
                    key={habit.id}
                    label={`Track ${habit.name.toLowerCase()}`}
                    checked={draft.enabled_habit_ids.includes(habit.id)}
                    onChange={() => toggleHabit(habit.id)}
                  />
                ))}
              </ul>
            ) : null}
          </>
        ) : null}

        {step === 5 ? (
          <>
            <StepHeading
              title="Calendar (optional)"
              body="Connecting one lets suggestions work around meetings and long days."
            />
            <div className="space-y-2 rounded-xl bg-muted/50 p-4 text-xs text-muted-foreground">
              <p>
                GlowUp asks for <strong className="text-foreground">busy times only</strong> — start
                and end. It cannot read event names, guests or locations, and it never creates or
                edits events.
              </p>
              <p>You can connect it now, later, or never. Everything else works either way.</p>
            </div>
            {calendarProviders.length > 0 ? (
              <div className="space-y-2">
                {calendarProviders.map((provider) => (
                  <Button key={provider.id} variant="outline" className="w-full" asChild>
                    <a href={`/api/calendar/${provider.id}/connect`}>Connect {provider.label}</a>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                No calendar is configured on this deployment yet. You can connect one later from the
                Calendar tab if that changes.
              </p>
            )}
          </>
        ) : null}

        {step === 6 ? (
          <>
            <StepHeading
              title="Reminders (optional)"
              body="Off by default. If you turn them on they stay quiet during meetings, during your quiet hours, and once you've logged the thing."
            />
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
              <div>
                <Label htmlFor="ob-notifications">Gentle reminders</Label>
                <p className="text-xs text-muted-foreground">
                  &ldquo;Your morning shake isn&rsquo;t logged yet. Want to have it now?&rdquo;
                </p>
              </div>
              <Switch
                id="ob-notifications"
                checked={draft.notifications_enabled}
                onCheckedChange={(checked) => patch({ notifications_enabled: checked })}
              />
            </div>
            <p className="rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
              GlowUp tracks habits and progress. It does not give medical advice or diagnose
              anything.
            </p>
          </>
        ) : null}

        {formError ? (
          <p
            role="alert"
            className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {formError}
          </p>
        ) : null}

        <div className="flex gap-2 pt-1">
          <Button
            variant="brand"
            size="cta"
            disabled={pending}
            onClick={() => (isLast ? finish() : goNext())}
          >
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {isLast ? (
              <>
                <Check className="size-4" aria-hidden="true" />
                Finish
              </>
            ) : (
              <>
                Continue
                <ArrowRight className="size-4" aria-hidden="true" />
              </>
            )}
          </Button>
        </div>
      </div>

      {!isLast ? (
        <button
          type="button"
          onClick={finish}
          disabled={pending}
          className="mx-auto block text-xs text-muted-foreground underline-offset-4 hover:underline"
        >
          Skip the rest — the defaults are fine
        </button>
      ) : null}
    </div>
  );
}

function invalidProps(field: FieldName, errors: Partial<Record<FieldName, string>>) {
  return errors[field]
    ? { 'aria-invalid': true as const, 'aria-describedby': `ob-${field}-error` }
    : {};
}

function FieldError({
  field,
  errors,
}: {
  field: FieldName;
  errors: Partial<Record<FieldName, string>>;
}) {
  const message = errors[field];
  if (!message) return null;
  return (
    <p id={`ob-${field}-error`} role="alert" className="text-xs text-destructive">
      {message}
    </p>
  );
}

function StepHeading({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-pretty font-display text-display-sm">{title}</h1>
      <p className="text-[14.5px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}

function HabitToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: () => void;
}) {
  const id = React.useId();
  return (
    <li className="flex items-center justify-between gap-4 rounded-xl border border-border px-4 py-3">
      <div className="min-w-0">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </li>
  );
}
