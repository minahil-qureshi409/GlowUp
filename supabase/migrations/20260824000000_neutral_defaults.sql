-- =============================================================================
-- GlowUp — neutral defaults + retirable routine steps
-- =============================================================================
-- Additive on purpose. `20260101000200_seed_defaults.sql` has already run
-- against the live project and is not idempotent, so it is left exactly as it
-- was; this file redefines the two functions it created and adds one column.
--
-- Two changes, one theme — a new account should start with *its own* data:
--
--   1. The signup seed no longer carries the developer's body metrics
--      (171.5 cm, 47 kg -> 55 kg) or their personal skincare shelf (a named
--      azelaic acid, a named SPF, a named vitamin-B serum). Recommending named
--      actives to a stranger in a health app is a liability, and the numbers
--      were meaningless to anyone but their owner.
--
--   2. Routine steps can be retired instead of deleted, matching habits, so a
--      step that leaves someone's routine keeps its completion history.
--
-- Existing accounts are untouched: `create or replace function` only changes
-- what happens at the *next* signup, and the new column defaults to true.
-- =============================================================================

-- -- retirable routine steps ---------------------------------------------------

alter table public.skincare_routine_steps
  add column if not exists is_active boolean not null default true;

comment on column public.skincare_routine_steps.is_active is
  'False = retired. Hidden from the daily routine, but its past step completions still count in Routine history.';

create index if not exists skincare_steps_routine_active_idx
  on public.skincare_routine_steps (routine_id, is_active, sort_order);

-- -- neutral signup seed -------------------------------------------------------

create or replace function public.seed_user_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $seed$
declare
  v_recipe_id uuid;
  v_goal_id uuid;
  v_tpl_a uuid;
  v_tpl_b uuid;
  v_tpl_c uuid;
  v_am uuid;
  v_pm uuid;
begin
  -- Already seeded? Do nothing. Makes the trigger safe to re-run.
  if exists (select 1 from public.habits where user_id = p_user_id) then
    return;
  end if;

  -- gym: no access window is assumed. Both times null means "no restriction",
  -- and onboarding step 4 asks for the real one.
  insert into public.gym_configs (
    user_id, name, location, access_start, access_end, available_days, equipment, is_default
  )
  values (
    p_user_id, 'Gym', null,
    null, null,
    '{1,2,3,4,5}',
    array['dumbbells', 'barbell', 'cable machine', 'bench'],
    true
  );

  -- A starter shake recipe: generic, editable, not tied to anyone's goal.
  insert into public.shake_recipes (user_id, name, notes, is_default, source)
  values (
    p_user_id, 'Protein shake',
    'A starting point - edit the ingredients to match what you actually use. Nutrition values are approximate.',
    true, 'seed'
  )
  returning id into v_recipe_id;

  insert into public.shake_ingredients
    (user_id, recipe_id, name, quantity, unit, calories_per_unit, protein_g_per_unit, sort_order)
  values
    (p_user_id, v_recipe_id, 'Milk',          300, 'ml',   0.640, 0.033, 0),
    (p_user_id, v_recipe_id, 'Banana',          1, 'whole', 105.0,  1.300, 1),
    (p_user_id, v_recipe_id, 'Peanut butter',   1, 'tbsp',   94.0,  3.600, 2);

  -- habits
  insert into public.habits
    (user_id, name, category, icon, frequency, target_per_week, preferred_part,
     is_optional, sort_order, recipe_id, source)
  values
    (p_user_id, 'Breakfast',        'nutrition', 'egg',       'daily',  null, 'morning',   false, 10, null,        'seed'),
    (p_user_id, 'Morning shake',    'nutrition', 'shake',     'daily',  null, 'morning',   true,  20, v_recipe_id, 'seed'),
    (p_user_id, 'AM skincare',      'skincare',  'sun',       'daily',  null, 'morning',   false, 30, null,        'seed'),
    (p_user_id, 'Lunch',            'nutrition', 'bowl',      'daily',  null, 'afternoon', false, 40, null,        'seed'),
    (p_user_id, 'Afternoon snack',  'nutrition', 'sandwich',  'daily',  null, 'afternoon', true,  50, null,        'seed'),
    (p_user_id, 'Strength workout', 'workout',   'dumbbell',  'weekly',    3, 'anytime',   false, 60, null,        'seed'),
    (p_user_id, 'Dinner',           'nutrition', 'plate',     'daily',  null, 'evening',   false, 80, null,        'seed'),
    (p_user_id, 'PM skincare',      'skincare',  'moon',      'daily',  null, 'evening',   false, 90, null,        'seed'),
    (p_user_id, 'Sleep & recovery', 'recovery',  'bed',       'daily',  null, 'evening',   true, 100, null,        'seed');

  -- Goals are deliberately unvalued. Onboarding writes the real start and
  -- target and rebuilds the milestone ladder around them; seeding numbers here
  -- put one person's body on every stranger's dashboard.
  insert into public.goals
    (user_id, type, title, description, start_value, target_value, unit, is_primary, status)
  values (
    p_user_id, 'weight', 'Your weight goal',
    'Set during onboarding. Progress is read from your actual trend, not a countdown.',
    null, null, 'kg', true, 'active'
  )
  returning id into v_goal_id;

  insert into public.goals (user_id, type, title, target_value, unit, status)
  values
    (p_user_id, 'workout_frequency', 'Strength sessions each week', 3, 'sessions', 'active'),
    (p_user_id, 'skincare_consistency', 'Keep skincare consistent', 80, '%', 'active'),
    (p_user_id, 'nutrition_consistency', 'Stay consistent with food habits', 80, '%', 'active');

  -- exercises
  insert into public.exercises
    (user_id, name, muscle_group, secondary_muscles, equipment, is_bodyweight, source)
  values
    (p_user_id, 'Biceps curl',           'biceps',     '{forearms}',            'dumbbell', false, 'seed'),
    (p_user_id, 'Hammer curl',           'biceps',     '{forearms}',            'dumbbell', false, 'seed'),
    (p_user_id, 'Triceps extension',     'triceps',    '{}',                    'dumbbell', false, 'seed'),
    (p_user_id, 'Triceps pushdown',      'triceps',    '{}',                    'cable',    false, 'seed'),
    (p_user_id, 'Shoulder press',        'shoulders',  '{triceps}',             'dumbbell', false, 'seed'),
    (p_user_id, 'Lateral raise',         'shoulders',  '{}',                    'dumbbell', false, 'seed'),
    (p_user_id, 'Seated row',            'back',       '{biceps}',              'cable',    false, 'seed'),
    (p_user_id, 'Lat pulldown',          'back',       '{biceps}',              'cable',    false, 'seed'),
    (p_user_id, 'Hip thrust',            'glutes',     '{hamstrings}',          'barbell',  false, 'seed'),
    (p_user_id, 'Squat',                 'quads',      '{glutes,hamstrings}',   'barbell',  false, 'seed'),
    (p_user_id, 'Romanian deadlift',     'hamstrings', '{glutes,back}',         'barbell',  false, 'seed'),
    (p_user_id, 'Bulgarian split squat', 'quads',      '{glutes}',              'dumbbell', false, 'seed'),
    (p_user_id, 'Leg press',             'quads',      '{glutes}',              'machine',  false, 'seed'),
    (p_user_id, 'Walking lunge',         'quads',      '{glutes,hamstrings}',   'dumbbell', false, 'seed'),
    (p_user_id, 'Leg curl',              'hamstrings', '{}',                    'machine',  false, 'seed'),
    (p_user_id, 'Calf raise',            'calves',     '{}',                    'machine',  false, 'seed'),
    (p_user_id, 'Push-up',               'chest',      '{triceps,shoulders}',   null,       true,  'seed'),
    (p_user_id, 'Plank',                 'core',       '{}',                    null,       true,  'seed');

  -- workout templates
  insert into public.workout_templates (user_id, name, focus, description, sort_order, source)
  values (p_user_id, 'Workout A', 'Lower body',
          'Legs and glutes. Lead with the heaviest lift while you are freshest.', 0, 'seed')
  returning id into v_tpl_a;

  insert into public.workout_templates (user_id, name, focus, description, sort_order, source)
  values (p_user_id, 'Workout B', 'Upper body',
          'Shoulders, back and arms, with pulling work for balance.', 1, 'seed')
  returning id into v_tpl_b;

  insert into public.workout_templates (user_id, name, focus, description, sort_order, source)
  values (p_user_id, 'Workout C', 'Full body',
          'A shorter mixed session - a good fit for a busy day.', 2, 'seed')
  returning id into v_tpl_c;

  insert into public.workout_template_exercises
    (user_id, template_id, exercise_id, target_sets, target_reps_min, target_reps_max, sort_order)
  select p_user_id, t.template_id, e.id, t.sets, t.rmin, t.rmax, t.ord
  from (
    values
      (v_tpl_a, 'Hip thrust',            4::smallint,  8::smallint, 12::smallint, 0::smallint),
      (v_tpl_a, 'Romanian deadlift',     3::smallint,  8::smallint, 12::smallint, 1::smallint),
      (v_tpl_a, 'Bulgarian split squat', 3::smallint,  8::smallint, 12::smallint, 2::smallint),
      (v_tpl_a, 'Leg curl',              3::smallint, 10::smallint, 15::smallint, 3::smallint),
      (v_tpl_a, 'Calf raise',            3::smallint, 12::smallint, 20::smallint, 4::smallint),

      (v_tpl_b, 'Shoulder press',        4::smallint,  8::smallint, 12::smallint, 0::smallint),
      (v_tpl_b, 'Lat pulldown',          3::smallint,  8::smallint, 12::smallint, 1::smallint),
      (v_tpl_b, 'Seated row',            3::smallint,  8::smallint, 12::smallint, 2::smallint),
      (v_tpl_b, 'Lateral raise',         3::smallint, 12::smallint, 15::smallint, 3::smallint),
      (v_tpl_b, 'Biceps curl',           3::smallint, 10::smallint, 12::smallint, 4::smallint),
      (v_tpl_b, 'Triceps pushdown',      3::smallint, 10::smallint, 15::smallint, 5::smallint),

      (v_tpl_c, 'Squat',                 3::smallint,  8::smallint, 12::smallint, 0::smallint),
      (v_tpl_c, 'Leg press',             3::smallint, 10::smallint, 15::smallint, 1::smallint),
      (v_tpl_c, 'Push-up',               3::smallint,  6::smallint, 15::smallint, 2::smallint),
      (v_tpl_c, 'Hammer curl',           3::smallint, 10::smallint, 12::smallint, 3::smallint),
      (v_tpl_c, 'Triceps extension',     3::smallint, 10::smallint, 15::smallint, 4::smallint)
  ) as t(template_id, exercise_name, sets, rmin, rmax, ord)
  join public.exercises e
    on e.user_id = p_user_id and e.name = t.exercise_name;

  -- Skincare: generic step *types* with no product behind them. The user names
  -- their own products during onboarding step 5, or later in Settings.
  -- No branded product is ever created for someone who did not choose it.
  insert into public.skincare_routines (user_id, period, name)
  values (p_user_id, 'am', 'Morning routine')
  returning id into v_am;

  insert into public.skincare_routines (user_id, period, name)
  values (p_user_id, 'pm', 'Evening routine')
  returning id into v_pm;

  -- Treatment is seeded optional: it is the step most people do not have yet,
  -- and an empty optional step must never read as a missed one.
  insert into public.skincare_routine_steps
    (user_id, routine_id, product_id, label, sort_order, is_optional)
  values
    (p_user_id, v_am, null, 'Cleanser',    0, false),
    (p_user_id, v_am, null, 'Treatment',   1, true),
    (p_user_id, v_am, null, 'Moisturiser', 2, false),
    (p_user_id, v_am, null, 'SPF',         3, false),
    (p_user_id, v_pm, null, 'Cleanser',    0, false),
    (p_user_id, v_pm, null, 'Treatment',   1, true),
    (p_user_id, v_pm, null, 'Moisturiser', 2, false);
end;
$seed$;

comment on function public.seed_user_defaults(uuid) is
  'Creates starter habits, exercises, templates, generic skincare steps, a starter shake recipe and unvalued goals for a new account. Carries no personal metrics and no branded products. Idempotent: returns immediately if habits already exist.';

-- -- new-account bootstrap -----------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $newuser$
begin
  -- height_cm starts null. Onboarding asks for it; a pre-filled 171.5 was one
  -- person's height shown to everybody.
  insert into public.profiles (id, display_name, height_cm, timezone)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    null,
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'UTC')
  )
  on conflict (id) do nothing;

  -- No assumed work hours or commute either: onboarding step 4 asks.
  insert into public.user_settings (user_id, workouts_per_week)
  values (new.id, 3)
  on conflict (user_id) do nothing;

  perform public.seed_user_defaults(new.id);

  return new;
end;
$newuser$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
