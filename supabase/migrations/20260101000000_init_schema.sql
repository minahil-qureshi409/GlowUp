-- =============================================================================
-- GlowUp — core schema
-- =============================================================================
-- Conventions used throughout:
--   * Every user-owned table carries `user_id uuid not null references auth.users`
--     even when it could be reached through a parent. Denormalising the owner
--     keeps RLS policies to a single indexed predicate instead of an EXISTS
--     subquery per row, and lets Postgres use the index on hot paths.
--   * `source` marks whether a row came from the signup seed or from the user,
--     so demo/default content can be told apart from real logged data.
--   * All timestamps are timestamptz. Dates the user reasons about ("the day I
--     logged this") are `date`, resolved in the user's own timezone client-side.
-- =============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ── enums ────────────────────────────────────────────────────────────────────

create type public.time_format as enum ('12h', '24h');
create type public.theme_pref as enum ('light', 'dark', 'system');
create type public.data_source as enum ('user', 'seed');

create type public.habit_category as enum ('nutrition', 'skincare', 'workout', 'recovery', 'custom');
create type public.habit_frequency as enum ('daily', 'weekly', 'custom');
create type public.day_part as enum ('morning', 'afternoon', 'evening', 'anytime');
create type public.completion_status as enum ('completed', 'skipped', 'modified');

create type public.goal_type as enum (
  'weight', 'workout_frequency', 'nutrition_consistency', 'skincare_consistency', 'strength', 'custom'
);
create type public.goal_status as enum ('active', 'achieved', 'archived');

create type public.muscle_group as enum (
  'biceps', 'triceps', 'forearms', 'shoulders', 'back', 'chest',
  'quads', 'hamstrings', 'glutes', 'calves', 'core', 'full_body'
);
create type public.workout_location as enum ('office_gym', 'home', 'other');
create type public.workout_status as enum ('planned', 'in_progress', 'completed', 'skipped');

create type public.skincare_period as enum ('am', 'pm');
create type public.skincare_product_category as enum (
  'cleanser', 'toner', 'serum', 'treatment', 'moisturizer', 'spf', 'other'
);
create type public.skin_condition as enum (
  'good', 'clear', 'dry', 'oily', 'irritated', 'breakout', 'other'
);

create type public.photo_category as enum ('full_body', 'arms', 'lower_body', 'skin', 'other');
create type public.week_feeling as enum ('great', 'good', 'okay', 'difficult');

create type public.calendar_provider as enum ('google');
create type public.calendar_status as enum ('connected', 'expired', 'revoked', 'error');

create type public.milestone_kind as enum ('manual', 'weight', 'strength', 'consistency', 'skincare');

-- ── shared helpers ───────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $fn$
begin
  new.updated_at = now();
  return new;
end;
$fn$;

-- =============================================================================
-- Profile & settings
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  height_cm numeric(5, 1) check (height_cm is null or height_cm between 80 and 260),
  birth_date date,
  timezone text not null default 'UTC',
  time_format public.time_format not null default '12h',
  theme public.theme_pref not null default 'system',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  -- Workout intent, expressed as a weekly count rather than fixed days.
  workouts_per_week smallint not null default 3 check (workouts_per_week between 0 and 14),
  -- Advisory only: the planner biases toward these, it never requires them.
  preferred_workout_days smallint[] not null default '{}',
  -- Typical office day. Nullable because "typical" genuinely varies.
  typical_work_start time,
  typical_work_end time,
  commute_minutes smallint check (commute_minutes is null or commute_minutes between 0 and 300),
  weekly_weigh_in_day smallint not null default 1 check (weekly_weigh_in_day between 0 and 6),
  notifications_enabled boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:30',
  max_daily_reminders smallint not null default 4 check (max_daily_reminders between 0 and 20),
  suggestions_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gym_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  location text,
  -- Women's-only access window. Both null = no restriction.
  access_start time,
  access_end time,
  available_days smallint[] not null default '{1,2,3,4,5}',
  equipment text[] not null default '{}',
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index gym_configs_user_idx on public.gym_configs (user_id) where is_active;

-- =============================================================================
-- Weight & goals
-- =============================================================================

create table public.weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weight_kg numeric(5, 2) not null check (weight_kg between 20 and 400),
  entry_date date not null,
  note text,
  source public.data_source not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One weigh-in per day keeps the trend maths honest; re-logging updates.
  unique (user_id, entry_date)
);
create index weight_entries_user_date_idx on public.weight_entries (user_id, entry_date desc);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type public.goal_type not null,
  title text not null,
  description text,
  start_value numeric(8, 2),
  target_value numeric(8, 2),
  unit text,
  status public.goal_status not null default 'active',
  is_primary boolean not null default false,
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index goals_user_status_idx on public.goals (user_id, status);
-- At most one primary goal per user.
create unique index goals_one_primary_idx on public.goals (user_id) where is_primary;

create table public.goal_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  goal_id uuid not null references public.goals (id) on delete cascade,
  label text not null,
  target_value numeric(8, 2) not null,
  sort_order smallint not null default 0,
  achieved_at timestamptz,
  created_at timestamptz not null default now()
);
create index goal_milestones_goal_idx on public.goal_milestones (goal_id, sort_order);

-- =============================================================================
-- Nutrition + habits — the flexible spine the whole app hangs off
-- =============================================================================

create table public.shake_recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  notes text,
  is_default boolean not null default false,
  source public.data_source not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shake_recipes_user_idx on public.shake_recipes (user_id);
create unique index shake_recipes_one_default_idx on public.shake_recipes (user_id) where is_default;

create table public.shake_ingredients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  recipe_id uuid not null references public.shake_recipes (id) on delete cascade,
  name text not null,
  quantity numeric(8, 2) not null check (quantity >= 0),
  unit text not null default 'g',
  -- Macros are stored per single unit so quantity edits recompute cleanly.
  -- These are reference approximations, always surfaced as "approximate".
  calories_per_unit numeric(8, 3) not null default 0 check (calories_per_unit >= 0),
  protein_g_per_unit numeric(8, 3) not null default 0 check (protein_g_per_unit >= 0),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);
create index shake_ingredients_recipe_idx on public.shake_ingredients (recipe_id, sort_order);

create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  category public.habit_category not null,
  icon text,
  frequency public.habit_frequency not null default 'daily',
  target_per_week smallint check (target_per_week is null or target_per_week between 1 and 21),
  -- Preferred time is a hint for ordering and gentle reminders. Never a deadline.
  preferred_part public.day_part not null default 'anytime',
  window_start time,
  window_end time,
  reminder_enabled boolean not null default false,
  is_optional boolean not null default false,
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  -- Nutrition habits may point at a saved recipe (e.g. the weight-gain shake).
  recipe_id uuid references public.shake_recipes (id) on delete set null,
  source public.data_source not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index habits_user_active_idx on public.habits (user_id, is_active, sort_order);

create table public.habit_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid not null references public.habits (id) on delete cascade,
  log_date date not null,
  status public.completion_status not null default 'completed',
  note text,
  -- Free text set when the user modified the habit (e.g. "half a shake").
  modification text,
  completed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (habit_id, log_date)
);
create index habit_completions_user_date_idx on public.habit_completions (user_id, log_date desc);

-- =============================================================================
-- Workouts
-- =============================================================================

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  muscle_group public.muscle_group not null,
  secondary_muscles public.muscle_group[] not null default '{}',
  equipment text,
  is_bodyweight boolean not null default false,
  notes text,
  is_active boolean not null default true,
  source public.data_source not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);
create index exercises_user_group_idx on public.exercises (user_id, muscle_group);

create table public.workout_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  focus text,
  description text,
  sort_order smallint not null default 0,
  is_active boolean not null default true,
  source public.data_source not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workout_templates_user_idx on public.workout_templates (user_id, sort_order);

create table public.workout_template_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid not null references public.workout_templates (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  target_sets smallint not null default 3 check (target_sets between 1 and 20),
  target_reps_min smallint not null default 8 check (target_reps_min between 1 and 100),
  target_reps_max smallint not null default 12 check (target_reps_max between 1 and 100),
  sort_order smallint not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  check (target_reps_max >= target_reps_min)
);
create index wte_template_idx on public.workout_template_exercises (template_id, sort_order);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_id uuid references public.workout_templates (id) on delete set null,
  name text not null,
  workout_date date not null,
  location public.workout_location not null default 'home',
  status public.workout_status not null default 'in_progress',
  started_at timestamptz,
  completed_at timestamptz,
  duration_minutes smallint check (duration_minutes is null or duration_minutes between 0 and 600),
  notes text,
  source public.data_source not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index workouts_user_date_idx on public.workouts (user_id, workout_date desc);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  sort_order smallint not null default 0,
  notes text,
  created_at timestamptz not null default now()
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id, sort_order);

create table public.exercise_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  workout_exercise_id uuid not null references public.workout_exercises (id) on delete cascade,
  set_index smallint not null check (set_index between 1 and 50),
  reps smallint check (reps is null or reps between 0 and 500),
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg between 0 and 1000),
  rpe numeric(3, 1) check (rpe is null or rpe between 1 and 10),
  is_warmup boolean not null default false,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (workout_exercise_id, set_index)
);
create index exercise_sets_we_idx on public.exercise_sets (workout_exercise_id, set_index);

-- =============================================================================
-- Skincare
-- =============================================================================

create table public.skincare_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  category public.skincare_product_category not null default 'other',
  notes text,
  is_active boolean not null default true,
  source public.data_source not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index skincare_products_user_idx on public.skincare_products (user_id, is_active);

create table public.skincare_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period public.skincare_period not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period)
);

create table public.skincare_routine_steps (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid not null references public.skincare_routines (id) on delete cascade,
  product_id uuid references public.skincare_products (id) on delete cascade,
  -- Steps like "rinse with water" have no product behind them.
  label text,
  sort_order smallint not null default 0,
  -- Optional steps never count against a routine's completion rate.
  -- Moisturiser is seeded optional: this user has reacted badly to several.
  is_optional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (product_id is not null or label is not null)
);
create index skincare_steps_routine_idx on public.skincare_routine_steps (routine_id, sort_order);

create table public.skincare_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  period public.skincare_period not null,
  status public.completion_status not null default 'completed',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date, period)
);
create index skincare_entries_user_date_idx on public.skincare_entries (user_id, log_date desc);

create table public.skincare_step_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  entry_id uuid not null references public.skincare_entries (id) on delete cascade,
  step_id uuid not null references public.skincare_routine_steps (id) on delete cascade,
  status public.completion_status not null default 'completed',
  note text,
  created_at timestamptz not null default now(),
  unique (entry_id, step_id)
);

create table public.skin_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  conditions public.skin_condition[] not null default '{}',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, log_date)
);
create index skin_logs_user_date_idx on public.skin_logs (user_id, log_date desc);

-- =============================================================================
-- Progress, reviews, timeline
-- =============================================================================

create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Path inside the private `progress-photos` bucket: `${user_id}/${uuid}.ext`.
  storage_path text not null unique,
  category public.photo_category not null default 'full_body',
  taken_on date not null,
  note text,
  created_at timestamptz not null default now()
);
create index progress_photos_user_date_idx on public.progress_photos (user_id, taken_on desc);

create table public.weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  week_start date not null,
  start_weight_kg numeric(5, 2),
  end_weight_kg numeric(5, 2),
  feeling public.week_feeling,
  notes text,
  -- Factual counts frozen at review time, so a later habit edit doesn't
  -- silently rewrite history.
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
create index weekly_reviews_user_idx on public.weekly_reviews (user_id, week_start desc);

create table public.timeline_milestones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  occurred_on date not null,
  title text not null,
  description text,
  kind public.milestone_kind not null default 'manual',
  created_at timestamptz not null default now()
);
create index timeline_milestones_user_idx on public.timeline_milestones (user_id, occurred_on desc);

-- =============================================================================
-- Calendar integration
-- =============================================================================
-- Split in two on purpose:
--   `calendar_connections` holds non-sensitive status the UI reads directly.
--   `calendar_credentials` holds OAuth tokens and is readable by NO client role
--     — only the service role, inside server-side route handlers.

create table public.calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  provider public.calendar_provider not null,
  account_email citext,
  scopes text[] not null default '{}',
  status public.calendar_status not null default 'connected',
  last_synced_at timestamptz,
  last_error text,
  connected_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create table public.calendar_credentials (
  connection_id uuid primary key references public.calendar_connections (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Busy blocks only. No titles, descriptions, attendees or locations are ever
-- persisted — the Google free/busy endpoint does not even return them.
create table public.calendar_event_metadata (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  connection_id uuid not null references public.calendar_connections (id) on delete cascade,
  day date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_busy boolean not null default true,
  fetched_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index calendar_busy_user_day_idx on public.calendar_event_metadata (user_id, day);

-- =============================================================================
-- Reminders & suggestions
-- =============================================================================

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  habit_id uuid references public.habits (id) on delete cascade,
  kind text not null default 'habit',
  enabled boolean not null default true,
  -- Earliest local time the reminder may fire. A floor, never a deadline.
  earliest_at time,
  last_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reminders_user_idx on public.reminders (user_id) where enabled;

-- Suggestions are generated, never stored. Only dismissals persist, so a
-- dismissed suggestion stays dismissed for the day it applied to.
create table public.suggestion_dismissals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  suggestion_key text not null,
  dismissed_for date not null,
  created_at timestamptz not null default now(),
  unique (user_id, suggestion_key, dismissed_for)
);

-- ── updated_at triggers ──────────────────────────────────────────────────────

do $mig$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'gym_configs', 'weight_entries', 'goals',
    'shake_recipes', 'habits', 'habit_completions', 'exercises',
    'workout_templates', 'workouts', 'skincare_products', 'skincare_routines',
    'skincare_routine_steps', 'skincare_entries', 'skin_logs', 'weekly_reviews',
    'calendar_connections', 'calendar_credentials', 'reminders'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function public.set_updated_at()', t
    );
  end loop;
end;
$mig$;
