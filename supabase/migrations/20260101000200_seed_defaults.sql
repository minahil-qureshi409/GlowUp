-- =============================================================================
-- GlowUp — default content for a brand-new account
-- =============================================================================
-- Everything created here is marked `source = 'seed'` so the UI can tell
-- starter content apart from anything the user actually logged, and so a
-- "reset to defaults" can be implemented later without guessing.
--
-- Nothing here is a *log*: no weigh-ins, no completions, no workouts. A new
-- account starts with an empty history and a furnished set of defaults.
-- =============================================================================

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
  v_p_bbomb uuid;
  v_p_spf uuid;
  v_p_azelaic uuid;
  v_p_cleanser_am uuid;
  v_p_cleanser_pm uuid;
  v_p_moisturizer uuid;
begin
  -- Already seeded? Do nothing. Makes the trigger safe to re-run.
  if exists (select 1 from public.habits where user_id = p_user_id) then
    return;
  end if;

  -- ── office gym ─────────────────────────────────────────────────────────────
  insert into public.gym_configs (
    user_id, name, location, access_start, access_end, available_days, equipment, is_default
  )
  values (
    p_user_id, 'Office gym', 'Office building',
    '06:00', '15:00',            -- women's-only hours end at 3 PM
    '{1,2,3,4,5}',
    array['dumbbells', 'barbell', 'cable machine', 'leg press', 'bench', 'smith machine'],
    true
  );

  -- ── weight-gain shake ──────────────────────────────────────────────────────
  insert into public.shake_recipes (user_id, name, notes, is_default, source)
  values (
    p_user_id, 'Weight Gain Shake',
    'Blend everything until smooth. Nutrition values are approximate.',
    true, 'seed'
  )
  returning id into v_recipe_id;

  -- Per-unit macros so editing a quantity recomputes cleanly. Values are
  -- rounded reference figures, never presented as exact.
  insert into public.shake_ingredients
    (user_id, recipe_id, name, quantity, unit, calories_per_unit, protein_g_per_unit, sort_order)
  values
    (p_user_id, v_recipe_id, 'Milk',          300, 'ml',   0.640, 0.033, 0),
    (p_user_id, v_recipe_id, 'Banana',          1, 'whole', 105.0,  1.300, 1),
    (p_user_id, v_recipe_id, 'Dates',           2, 'whole',  66.0,  0.400, 2),
    (p_user_id, v_recipe_id, 'Peanut butter',   2, 'tbsp',   94.0,  3.600, 3);

  -- ── habits ─────────────────────────────────────────────────────────────────
  -- `preferred_part` orders the day loosely. It is a hint, not a schedule:
  -- no habit carries a hard time and none of them can be "late".
  insert into public.habits
    (user_id, name, category, icon, frequency, target_per_week, preferred_part,
     is_optional, sort_order, recipe_id, source)
  values
    (p_user_id, 'Boiled eggs',      'nutrition', 'egg',       'daily',  null, 'morning',   false, 10, null,        'seed'),
    (p_user_id, 'Morning shake',    'nutrition', 'shake',     'daily',  null, 'morning',   false, 20, v_recipe_id, 'seed'),
    (p_user_id, 'AM skincare',      'skincare',  'sun',       'daily',  null, 'morning',   false, 30, null,        'seed'),
    (p_user_id, 'Lunch',            'nutrition', 'bowl',      'daily',  null, 'afternoon', false, 40, null,        'seed'),
    (p_user_id, 'Afternoon snack',  'nutrition', 'sandwich',  'daily',  null, 'afternoon', false, 50, null,        'seed'),
    (p_user_id, 'Strength workout', 'workout',   'dumbbell',  'weekly',    3, 'anytime',   false, 60, null,        'seed'),
    (p_user_id, 'Evening shake',    'nutrition', 'shake',     'daily',  null, 'evening',   true,  70, v_recipe_id, 'seed'),
    (p_user_id, 'Dinner',           'nutrition', 'plate',     'daily',  null, 'evening',   false, 80, null,        'seed'),
    (p_user_id, 'PM skincare',      'skincare',  'moon',      'daily',  null, 'evening',   false, 90, null,        'seed'),
    (p_user_id, 'Sleep & recovery', 'recovery',  'bed',       'daily',  null, 'evening',   true, 100, null,        'seed');

  -- ── goals ──────────────────────────────────────────────────────────────────
  insert into public.goals
    (user_id, type, title, description, start_value, target_value, unit, is_primary, status)
  values (
    p_user_id, 'weight', 'Reach around 55 kg',
    'Gradual, healthy weight gain. Progress is read from the actual trend, not a countdown.',
    47.0, 55.0, 'kg', true, 'active'
  )
  returning id into v_goal_id;

  insert into public.goal_milestones (user_id, goal_id, label, target_value, sort_order)
  values
    (p_user_id, v_goal_id, 'Starting point', 47.0, 0),
    (p_user_id, v_goal_id, 'First milestone', 50.0, 1),
    (p_user_id, v_goal_id, 'Second milestone', 52.0, 2),
    (p_user_id, v_goal_id, 'Goal', 55.0, 3);

  insert into public.goals (user_id, type, title, target_value, unit, status)
  values
    (p_user_id, 'workout_frequency', '3 strength sessions a week', 3, 'sessions', 'active'),
    (p_user_id, 'skincare_consistency', 'Keep skincare consistent', 80, '%', 'active'),
    (p_user_id, 'nutrition_consistency', 'Stay consistent with food habits', 80, '%', 'active');

  -- ── exercises ──────────────────────────────────────────────────────────────
  -- Hypertrophy-oriented and weighted toward the user's stated focus areas
  -- (arms, shoulders, glutes, legs). No cardio: the goal is weight gain.
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
    (p_user_id, 'Calf raise',            'calves',     '{}',                    'machine',  false, 'seed');

  -- ── workout templates ──────────────────────────────────────────────────────
  insert into public.workout_templates (user_id, name, focus, description, sort_order, source)
  values (p_user_id, 'Workout A', 'Lower body + glutes',
          'Glute and leg focus. Lead with hip thrusts while you are freshest.', 0, 'seed')
  returning id into v_tpl_a;

  insert into public.workout_templates (user_id, name, focus, description, sort_order, source)
  values (p_user_id, 'Workout B', 'Upper body + arms + shoulders',
          'Shoulders and arms, with pulling work for a balanced upper body.', 1, 'seed')
  returning id into v_tpl_b;

  insert into public.workout_templates (user_id, name, focus, description, sort_order, source)
  values (p_user_id, 'Workout C', 'Lower body + arms',
          'A shorter mixed session — a good fit for a busy day.', 2, 'seed')
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
      (v_tpl_b, 'Hammer curl',           3::smallint, 10::smallint, 12::smallint, 5::smallint),
      (v_tpl_b, 'Triceps pushdown',      3::smallint, 10::smallint, 15::smallint, 6::smallint),

      (v_tpl_c, 'Squat',                 3::smallint,  8::smallint, 12::smallint, 0::smallint),
      (v_tpl_c, 'Leg press',             3::smallint, 10::smallint, 15::smallint, 1::smallint),
      (v_tpl_c, 'Walking lunge',         3::smallint, 10::smallint, 12::smallint, 2::smallint),
      (v_tpl_c, 'Hammer curl',           3::smallint, 10::smallint, 12::smallint, 3::smallint),
      (v_tpl_c, 'Triceps extension',     3::smallint, 10::smallint, 15::smallint, 4::smallint)
  ) as t(template_id, exercise_name, sets, rmin, rmax, ord)
  join public.exercises e
    on e.user_id = p_user_id and e.name = t.exercise_name;

  -- ── skincare ───────────────────────────────────────────────────────────────
  insert into public.skincare_products (user_id, name, brand, category, notes, source)
  values (p_user_id, 'Gentle cleanser', null, 'cleanser', 'Morning rinse or gentle cleanse.', 'seed')
  returning id into v_p_cleanser_am;

  insert into public.skincare_products (user_id, name, brand, category, source)
  values (p_user_id, 'B-Bomb', 'Geek & Gorgeous', 'serum', 'seed')
  returning id into v_p_bbomb;

  insert into public.skincare_products (user_id, name, brand, category, notes, source)
  values (p_user_id, 'Anthelios UVMune 400 SPF50+', 'La Roche-Posay', 'spf',
          'Apply generously as the last morning step.', 'seed')
  returning id into v_p_spf;

  insert into public.skincare_products (user_id, name, brand, category, source)
  values (p_user_id, 'Evening cleanser', null, 'cleanser', 'seed')
  returning id into v_p_cleanser_pm;

  insert into public.skincare_products (user_id, name, brand, category, source)
  values (p_user_id, 'Azelaic Acid', 'Paula''s Choice', 'treatment', 'seed')
  returning id into v_p_azelaic;

  insert into public.skincare_products (user_id, name, brand, category, notes, source)
  values (p_user_id, 'Moisturiser', null, 'moisturizer',
          'Optional. Some moisturisers have caused breakouts before — only use if it agrees with your skin.',
          'seed')
  returning id into v_p_moisturizer;

  insert into public.skincare_routines (user_id, period, name)
  values (p_user_id, 'am', 'Morning routine')
  returning id into v_am;

  insert into public.skincare_routines (user_id, period, name)
  values (p_user_id, 'pm', 'Evening routine')
  returning id into v_pm;

  insert into public.skincare_routine_steps
    (user_id, routine_id, product_id, label, sort_order, is_optional)
  values
    (p_user_id, v_am, v_p_cleanser_am, 'Cleanse or rinse', 0, false),
    (p_user_id, v_am, v_p_bbomb,       null,               1, false),
    (p_user_id, v_am, v_p_spf,         null,               2, false),
    (p_user_id, v_pm, v_p_cleanser_pm, 'Cleanse',          0, false),
    (p_user_id, v_pm, v_p_azelaic,     null,               1, false),
    -- Optional by design: never counted as a missed step.
    (p_user_id, v_pm, v_p_moisturizer, null,               2, true);
end;
$seed$;

comment on function public.seed_user_defaults(uuid) is
  'Creates starter habits, exercises, templates, skincare routines, a default shake recipe and goals for a new account. Idempotent: returns immediately if habits already exist.';

-- =============================================================================
-- New-account bootstrap
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $newuser$
begin
  insert into public.profiles (id, display_name, height_cm, timezone)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), ''),
    171.5,                                                   -- 5'7.5"
    coalesce(nullif(new.raw_user_meta_data ->> 'timezone', ''), 'UTC')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (
    user_id, workouts_per_week, typical_work_start, typical_work_end, commute_minutes
  )
  values (new.id, 3, '10:00', '18:30', 70)
  on conflict (user_id) do nothing;

  perform public.seed_user_defaults(new.id);

  return new;
end;
$newuser$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
