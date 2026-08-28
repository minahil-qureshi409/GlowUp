-- =============================================================================
-- GlowUp — development / demo history
-- =============================================================================
-- DEVELOPMENT ONLY. Fabricates twelve weeks of plausible history so the charts,
-- streaks, pillars, insights and timeline have something real to draw. Do not
-- run it against a database holding real logs.
--
-- Everything it writes is stamped `source = 'seed'` where the table has that
-- column, which is the flag the UI uses to tell demo content from anything the
-- user actually logged. Real entries are always `source = 'user'`.
--
-- Usage (psql, or the Supabase SQL editor):
--   select public.seed_demo_history('<your-auth-user-id>');
--
-- To undo:
--   select public.clear_demo_history('<your-auth-user-id>');
--
--
-- ── Two decisions that make this a demo rather than a data dump ──────────────
--
-- 1. IT IS DETERMINISTIC. `setseed` is called first, so every run produces the
--    identical history. A demo where the streak is 4 one day and 26 the next is
--    a demo you cannot rehearse, and "let me just refresh" is not a thing you
--    want to say in front of an audience.
--
-- 2. TODAY IS LEFT HALF DONE, ON PURPOSE. Breakfast, lunch and the morning
--    routine are logged; dinner, the evening routine and the workout are not,
--    and water sits at 4 of 8. A fully-completed today has nothing to tap, and
--    an empty one has nothing to show. Half-done is the only state where the
--    app can be demonstrated *doing* something — including tapping water four
--    times to fire the confetti.
-- =============================================================================

create or replace function public.seed_demo_history(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $demo$
declare
  v_day date;
  v_today date := current_date;
  v_start date := current_date - interval '84 days';
  v_dow int;
  v_week int;
  v_weight numeric;
  v_habit record;
  v_workout_id uuid;
  v_we_id uuid;
  v_template record;
  v_tpl_ex record;
  v_set_index int;
  v_base_load numeric;
  v_am_id uuid;
  v_pm_id uuid;
  v_entry_id uuid;
  v_step record;
  v_roll numeric;
  v_rate numeric;
  v_conditions skin_condition[];
  v_goal_id uuid;
  v_sleep numeric;
  v_water int;
  v_mood day_mood;
  v_template_count int;
  v_done int;
  v_required int;
  v_review_start date;

  -- The streak the demo shows. 24 lands just under the 30-day milestone, so
  -- the sidebar has something to count down to instead of a finished ladder.
  c_streak_days constant int := 23;
begin
  -- Deterministic. Everything below that calls random() depends on this.
  perform setseed(0.4242);

  -- ── profile ────────────────────────────────────────────────────────────────
  -- Onboarding normally writes these. Without them the Profile screen shows a
  -- name-less avatar and the app layout bounces you back into onboarding.
  update public.profiles
  set display_name = coalesce(display_name, 'Minahil'),
      height_cm = coalesce(height_cm, 162),
      birth_date = coalesce(birth_date, date '2001-04-17'),
      onboarding_completed_at = coalesce(onboarding_completed_at, now())
  where id = p_user_id;

  -- ── the weight goal ────────────────────────────────────────────────────────
  -- `seed_user_defaults` deliberately leaves start and target null, because
  -- putting one person's body on every stranger's dashboard is not a default.
  -- A demo needs them: without a start and a target, "% to goal" is null and
  -- the Progress ring, the More tile and half the Weight screen show dashes.
  select id into v_goal_id
  from public.goals
  where user_id = p_user_id and type = 'weight' and status = 'active'
  order by is_primary desc
  limit 1;

  if v_goal_id is not null then
    update public.goals
    set start_value = 45.2, target_value = 54.0, unit = 'kg'
    where id = v_goal_id;

    delete from public.goal_milestones where goal_id = v_goal_id;

    -- Two behind, two ahead. `achieved_at` is sticky by design, so the reached
    -- ones stay reached even when the trend dips.
    insert into public.goal_milestones
      (user_id, goal_id, label, target_value, sort_order, achieved_at)
    values
      (p_user_id, v_goal_id, 'First kilo',   47.0, 0, now() - interval '70 days'),
      (p_user_id, v_goal_id, 'Halfway',      49.0, 1, now() - interval '12 days'),
      (p_user_id, v_goal_id, 'Nearly there', 51.5, 2, null),
      (p_user_id, v_goal_id, 'Goal',         54.0, 3, null);
  end if;

  -- ── weigh-ins ──────────────────────────────────────────────────────────────
  -- Four a week rather than one: the seven-day trend line has to have enough
  -- points to actually smooth, or the chart is not testing anything.
  v_day := v_start;
  while v_day <= v_today loop
    v_dow := extract(dow from v_day);
    if v_dow in (1, 3, 5, 0) then
      v_week := (v_day - v_start) / 7;
      -- 47.0 climbing to about 49.4, with enough noise to be believable.
      v_weight := 47.0 + (v_week * 0.2) + (random() - 0.5) * 0.55;
      insert into public.weight_entries (user_id, weight_kg, entry_date, source)
      values (p_user_id, round(v_weight, 1), v_day, 'seed')
      on conflict (user_id, entry_date) do nothing;
    end if;
    v_day := v_day + 1;
  end loop;

  -- ── habit completions ──────────────────────────────────────────────────────
  --
  -- Three shaping rules, each of which exists to make a specific screen say
  -- something true and interesting:
  --
  --   improving      the rate climbs over twelve weeks, so Progress has a slope
  --   weekday gap    weekdays run well ahead of weekends, so the Consistency
  --                  insight has a real pattern to report instead of shrugging
  --   recent run     the last 23 days are forced past the streak threshold, so
  --                  the streak is a known number rather than a coin flip
  for v_habit in
    select id, name, category, is_optional, frequency
    from public.habits
    where user_id = p_user_id and is_active and frequency = 'daily'
  loop
    v_day := v_start;
    while v_day < v_today loop
      v_week := (v_day - v_start) / 7;
      v_dow := extract(dow from v_day);
      v_roll := random();

      -- 0.58 at the start, drifting up to about 0.85.
      v_rate := 0.58 + v_week * 0.023;
      -- Saturday and Sunday are genuinely harder. This is the gap the
      -- Consistency panel reads.
      if v_dow in (0, 6) then
        v_rate := v_rate - 0.24;
      else
        v_rate := v_rate + 0.06;
      end if;

      -- The guaranteed run. Non-optional habits are forced through so the
      -- streak lands on exactly `c_streak_days`.
      --
      -- Except the evening routine at weekends. A run of identical perfect days
      -- would flatten the weekday/weekend gap inside the 30-day window the
      -- Insights page reads, and the Consistency panel would go from reporting
      -- a real pattern to shrugging. Dropping one of five required habits still
      -- leaves the day at 80%, comfortably past the 60% streak threshold.
      if v_day > v_today - c_streak_days - 1 and not v_habit.is_optional then
        if v_dow in (0, 6) and v_habit.name = 'PM skincare' then
          v_rate := 0.0;
        else
          v_rate := 1.0;
        end if;
      end if;

      -- ...and the day before it is forced to fail, so the streak has a clean
      -- edge rather than trailing off into whatever the noise happened to do.
      if v_day = v_today - c_streak_days - 1 and not v_habit.is_optional then
        v_rate := 0.0;
      end if;

      if v_roll < v_rate and not (v_habit.is_optional and random() < 0.45) then
        insert into public.habit_completions (user_id, habit_id, log_date, status, completed_at)
        values (p_user_id, v_habit.id, v_day, 'completed', v_day + time '12:00')
        on conflict (habit_id, log_date) do nothing;
      elsif v_roll < v_rate + 0.14 then
        -- Skipped, not missed. The app has no "missed" state and this seed
        -- must not invent one.
        insert into public.habit_completions (user_id, habit_id, log_date, status, completed_at)
        values (p_user_id, v_habit.id, v_day, 'skipped', v_day + time '12:00')
        on conflict (habit_id, log_date) do nothing;
      end if;

      v_day := v_day + 1;
    end loop;
  end loop;

  -- ── today, deliberately half finished ──────────────────────────────────────
  -- Morning and midday logged; evening left open. Three of the five required
  -- habits is 60%, which is exactly the streak threshold, so today counts and
  -- the streak reads 24 — while dinner and the evening routine sit there
  -- waiting to be tapped on stage.
  insert into public.habit_completions (user_id, habit_id, log_date, status, completed_at)
  select p_user_id, h.id, v_today, 'completed', v_today + time '09:00'
  from public.habits h
  where h.user_id = p_user_id
    and h.is_active
    and h.name in ('Breakfast', 'Morning shake', 'AM skincare', 'Lunch')
  on conflict (habit_id, log_date) do nothing;

  -- Fallback, in case the habits were renamed during onboarding. Matching on
  -- names is the clearest way to say "morning and midday done, evening not",
  -- but it fails silently on a customised account and would leave today empty —
  -- which is the one state this seed exists to avoid. Completing the first
  -- three required habits by sort order lands in the same place: 3 of 5, the
  -- streak threshold, with the evening still open.
  select count(*) into v_done
  from public.habit_completions
  where user_id = p_user_id and log_date = v_today;

  if coalesce(v_done, 0) = 0 then
    insert into public.habit_completions (user_id, habit_id, log_date, status, completed_at)
    select p_user_id, h.id, v_today, 'completed', v_today + time '09:00'
    from (
      select id, sort_order
      from public.habits
      where user_id = p_user_id
        and is_active and not is_optional and frequency = 'daily'
      order by sort_order
      limit 3
    ) h
    on conflict (habit_id, log_date) do nothing;
  end if;

  -- ── daily metrics: hydration, sleep, mood ──────────────────────────────────
  -- Without these the Glow ring averages three pillars instead of five, the
  -- vitals row shows two dashes, and the Sleep and Hydration insight panels
  -- never appear at all.
  v_day := v_start;
  while v_day <= v_today loop
    v_week := (v_day - v_start) / 7;
    v_dow := extract(dow from v_day);

    -- Friday and Saturday nights run late. That is the pattern the Sleep panel
    -- reports, and it is the one almost everybody actually has.
    if v_dow in (5, 6) then
      v_sleep := 6.0 + random() * 0.9;
    else
      v_sleep := 7.1 + random() * 1.1;
    end if;

    -- Hydration improves over the window: 4-ish at the start, 7-ish by now.
    v_water := least(8, greatest(2, round(4.0 + v_week * 0.28 + (random() - 0.5) * 2)::int));

    v_mood := case
      when v_sleep < 6.5 then (array['tired', 'low', 'stressed'])[(1 + floor(random() * 3))::int]::day_mood
      when random() < 0.45 then 'calm'::day_mood
      when random() < 0.7 then 'happy'::day_mood
      else 'motivated'::day_mood
    end;

    if v_day = v_today then
      -- Today is fixed, not rolled: 7.5 hours reads as "Good" energy, and four
      -- glasses leaves exactly four taps to the confetti.
      v_sleep := 7.5;
      v_water := 4;
      v_mood := 'calm'::day_mood;
    end if;

    insert into public.daily_metrics (user_id, metric_date, water_glasses, sleep_hours, mood)
    values (p_user_id, v_day, v_water, round(v_sleep, 2), v_mood)
    on conflict (user_id, metric_date) do update
      set water_glasses = excluded.water_glasses,
          sleep_hours = excluded.sleep_hours,
          mood = excluded.mood;

    v_day := v_day + 1;
  end loop;

  -- ── skincare ───────────────────────────────────────────────────────────────
  select id into v_am_id from public.skincare_routines
    where user_id = p_user_id and period = 'am';
  select id into v_pm_id from public.skincare_routines
    where user_id = p_user_id and period = 'pm';

  v_day := v_start;
  while v_day <= v_today loop
    v_week := (v_day - v_start) / 7;

    -- Mornings beat evenings, consistently. That gap is what the Skincare
    -- insight reports, and it is true of almost every real routine.
    if (v_day < v_today and random() < (0.62 + v_week * 0.025)) or v_day = v_today then
      insert into public.skincare_entries (user_id, log_date, period, status)
      values (p_user_id, v_day, 'am', 'completed')
      on conflict (user_id, log_date, period) do update set status = 'completed'
      returning id into v_entry_id;

      for v_step in
        select id from public.skincare_routine_steps
        where routine_id = v_am_id and not is_optional
      loop
        insert into public.skincare_step_completions (user_id, entry_id, step_id, status)
        values (p_user_id, v_entry_id, v_step.id, 'completed')
        on conflict (entry_id, step_id) do nothing;
      end loop;
    end if;

    -- Today's evening routine is left undone on purpose: it is the tidiest
    -- thing to demonstrate completing, and it is what the Today screen's
    -- skincare priority card points at.
    if v_day < v_today and random() < (0.44 + v_week * 0.03) then
      insert into public.skincare_entries (user_id, log_date, period, status)
      values (p_user_id, v_day, 'pm', 'completed')
      on conflict (user_id, log_date, period) do update set status = 'completed'
      returning id into v_entry_id;

      for v_step in
        select id from public.skincare_routine_steps
        where routine_id = v_pm_id and not is_optional
      loop
        insert into public.skincare_step_completions (user_id, entry_id, step_id, status)
        values (p_user_id, v_entry_id, v_step.id, 'completed')
        on conflict (entry_id, step_id) do nothing;
      end loop;
    end if;

    if random() < 0.14 then
      v_conditions := case floor(random() * 5)::int
        when 0 then array['good']::skin_condition[]
        when 1 then array['clear']::skin_condition[]
        when 2 then array['dry']::skin_condition[]
        when 3 then array['breakout']::skin_condition[]
        else array['oily', 'irritated']::skin_condition[]
      end;

      insert into public.skin_logs (user_id, log_date, conditions)
      values (p_user_id, v_day, v_conditions)
      on conflict (user_id, log_date) do nothing;
    end if;

    v_day := v_day + 1;
  end loop;

  -- ── workouts ───────────────────────────────────────────────────────────────
  -- Three a week, cycling the templates, loads creeping up so the progression
  -- charts and personal bests have a real slope.
  --
  -- Today is excluded unconditionally: an unlogged workout is what puts the
  -- "Lower body strength — Start" card on the Today screen, and that card is
  -- the best single thing to demonstrate.
  select count(*) into v_template_count
  from public.workout_templates where user_id = p_user_id;

  v_day := v_start;
  while v_day < v_today loop
    if extract(dow from v_day) in (1, 3, 5) and random() < 0.85 then
      v_week := (v_day - v_start) / 7;

      select * into v_template
      from public.workout_templates
      where user_id = p_user_id and is_active
      order by sort_order
      offset (((v_day - v_start) / 2) % greatest(1, v_template_count))
      limit 1;

      if v_template.id is not null then
        insert into public.workouts (
          user_id, template_id, name, workout_date, location, status,
          started_at, completed_at, duration_minutes, source
        )
        values (
          p_user_id, v_template.id, v_template.name, v_day,
          case when random() < 0.6 then 'office_gym'::workout_location else 'home'::workout_location end,
          'completed',
          v_day + time '13:00', v_day + time '14:00',
          45 + floor(random() * 25)::int,
          'seed'
        )
        returning id into v_workout_id;

        for v_tpl_ex in
          select wte.exercise_id, wte.target_sets, wte.target_reps_min, wte.target_reps_max,
                 wte.sort_order, e.muscle_group
          from public.workout_template_exercises wte
          join public.exercises e on e.id = wte.exercise_id
          where wte.template_id = v_template.id
          order by wte.sort_order
        loop
          insert into public.workout_exercises (user_id, workout_id, exercise_id, sort_order)
          values (p_user_id, v_workout_id, v_tpl_ex.exercise_id, v_tpl_ex.sort_order)
          returning id into v_we_id;

          v_base_load := case
            when v_tpl_ex.muscle_group in ('glutes', 'quads', 'hamstrings') then 25
            when v_tpl_ex.muscle_group in ('back', 'shoulders') then 12
            else 6
          end;

          for v_set_index in 1..v_tpl_ex.target_sets loop
            insert into public.exercise_sets (
              user_id, workout_exercise_id, set_index, reps, weight_kg, completed
            )
            values (
              p_user_id,
              v_we_id,
              v_set_index,
              v_tpl_ex.target_reps_min + floor(random() * (v_tpl_ex.target_reps_max - v_tpl_ex.target_reps_min + 1))::int,
              round((v_base_load + v_week * 0.8 + (random() - 0.5) * 2)::numeric * 2) / 2,
              true
            );
          end loop;
        end loop;
      end if;
    end if;

    v_day := v_day + 1;
  end loop;

  -- ── weekly reviews ─────────────────────────────────────────────────────────
  -- The last six completed weeks, so /progress/review is not an empty state.
  -- `stats` is frozen jsonb by design: a later habit edit must not rewrite what
  -- a past week said.
  for v_week in 1..6 loop
    v_review_start := date_trunc('week', v_today)::date - (v_week * 7);

    select
      count(*) filter (where status in ('completed', 'modified')),
      count(*)
    into v_done, v_required
    from public.habit_completions
    where user_id = p_user_id
      and log_date >= v_review_start
      and log_date < v_review_start + 7;

    insert into public.weekly_reviews
      (user_id, week_start, start_weight_kg, end_weight_kg, feeling, notes, stats)
    values (
      p_user_id,
      v_review_start,
      (select weight_kg from public.weight_entries
        where user_id = p_user_id
          and entry_date >= v_review_start and entry_date < v_review_start + 7
        order by entry_date limit 1),
      (select weight_kg from public.weight_entries
        where user_id = p_user_id
          and entry_date >= v_review_start and entry_date < v_review_start + 7
        order by entry_date desc limit 1),
      (array['great', 'good', 'good', 'okay', 'good', 'difficult'])[v_week]::week_feeling,
      (array[
        'Best week so far. Evening routine finally stuck.',
        'Steady. Three sessions in without having to force it.',
        'Busy at work but the mornings held.',
        'Slept badly midweek and it showed in everything else.',
        'Back on track. Protein was the thing that moved.',
        'Rough one. Kept breakfast going and let the rest slide.'
      ])[v_week],
      jsonb_build_object(
        'habitsCompleted', coalesce(v_done, 0),
        'habitsLogged', coalesce(v_required, 0),
        'workouts', (select count(*) from public.workouts
                      where user_id = p_user_id and status = 'completed'
                        and workout_date >= v_review_start
                        and workout_date < v_review_start + 7)
      )
    )
    on conflict (user_id, week_start) do nothing;
  end loop;

  -- ── timeline ───────────────────────────────────────────────────────────────
  delete from public.timeline_milestones where user_id = p_user_id;
  insert into public.timeline_milestones (user_id, occurred_on, title, description, kind)
  values
    (p_user_id, v_start + 7,  'Started tracking properly',
     'First full week where everything got logged.', 'manual'),
    (p_user_id, v_start + 21, 'First full month of training',
     'Three sessions a week held together through a busy stretch.', 'manual'),
    (p_user_id, v_start + 42, '47 kg — first kilo',
     'The first milestone on the ladder.', 'weight'),
    (p_user_id, v_start + 56, 'Hip thrusts felt easy at last week''s weight',
     null, 'strength'),
    (p_user_id, v_today - 12, '49 kg — halfway',
     'Halfway from 45.2 to 54.0, and the trend is still going the right way.', 'weight'),
    (p_user_id, v_today - 4,  'Three weeks unbroken',
     'The longest run so far.', 'consistency');
end;
$demo$;

comment on function public.seed_demo_history(uuid) is
  'DEVELOPMENT ONLY. Deterministic 12-week demo history, marked source = seed. Leaves today half complete on purpose so the app has something to demonstrate.';

-- =============================================================================

create or replace function public.clear_demo_history(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $clear$
begin
  -- Only removes rows the demo seeder created. Anything the user logged
  -- (source = 'user') is left untouched where the table records it.
  delete from public.workouts where user_id = p_user_id and source = 'seed';
  delete from public.weight_entries where user_id = p_user_id and source = 'seed';
  delete from public.timeline_milestones where user_id = p_user_id;
  delete from public.weekly_reviews where user_id = p_user_id;
  delete from public.daily_metrics where user_id = p_user_id;
  delete from public.skin_logs where user_id = p_user_id;
  delete from public.skincare_entries where user_id = p_user_id;
  delete from public.habit_completions where user_id = p_user_id;

  -- Put the weight goal back to the unvalued state `seed_user_defaults`
  -- creates, so clearing really does return the account to new.
  update public.goals
  set start_value = null, target_value = null
  where user_id = p_user_id and type = 'weight';

  delete from public.goal_milestones
  where user_id = p_user_id
    and goal_id in (select id from public.goals where user_id = p_user_id and type = 'weight');
end;
$clear$;

comment on function public.clear_demo_history(uuid) is
  'DEVELOPMENT ONLY. Removes demo history created by seed_demo_history and resets the weight goal.';

-- ── who may call these ───────────────────────────────────────────────────────
--
-- Postgres grants EXECUTE on a new function to PUBLIC, and Supabase's PostgREST
-- exposes every function in the `public` schema as an RPC endpoint. Both
-- functions below are SECURITY DEFINER, so they run as the owner and RLS does
-- not apply to them.
--
-- Left as created, that combination means anyone holding the anon key — which
-- ships in the browser bundle and is *meant* to be public — could POST to
--
--     /rest/v1/rpc/clear_demo_history   {"p_user_id": "<anyone's uuid>"}
--
-- and delete that person's weigh-ins, habits, workouts, metrics and reviews.
-- The parameter is a plain uuid; nothing checks it belongs to the caller.
--
-- So execute is revoked from every client role. Both functions stay callable
-- from the SQL editor and from a service-role connection, which is the only
-- place a seeder belongs.

revoke all on function public.seed_demo_history(uuid) from public, anon, authenticated;
revoke all on function public.clear_demo_history(uuid) from public, anon, authenticated;

