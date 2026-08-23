-- =============================================================================
-- GlowUp — development / demo history
-- =============================================================================
-- DEVELOPMENT ONLY. This fabricates twelve weeks of plausible history so the
-- charts, streaks, insights and timeline have something to draw. Do not run it
-- against a database holding real logs.
--
-- Everything it writes is stamped `source = 'seed'`, which is the flag the UI
-- uses to tell demo content apart from anything the user actually logged. Real
-- entries are always `source = 'user'`.
--
-- Usage (psql, or the Supabase SQL editor):
--   select public.seed_demo_history('<your-auth-user-id>');
--
-- To undo:
--   select public.clear_demo_history('<your-auth-user-id>');
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
  v_weight numeric;
  v_habit record;
  v_workout_id uuid;
  v_we_id uuid;
  v_template record;
  v_tpl_ex record;
  v_set_index int;
  v_base_load numeric;
  v_week int;
  v_am_id uuid;
  v_pm_id uuid;
  v_entry_id uuid;
  v_step record;
  v_roll numeric;
begin
  -- ── weekly weigh-ins ───────────────────────────────────────────────────────
  -- A gentle upward drift with realistic noise: the trend line has to have
  -- something to smooth, or it is not testing anything.
  v_day := v_start;
  while v_day <= v_today loop
    if extract(dow from v_day) = 1 then
      v_week := (v_day - v_start) / 7;
      v_weight := 47.0 + (v_week * 0.19) + (random() - 0.5) * 0.7;
      insert into public.weight_entries (user_id, weight_kg, entry_date, source)
      values (p_user_id, round(v_weight, 1), v_day, 'seed')
      on conflict (user_id, entry_date) do nothing;
    end if;
    v_day := v_day + 1;
  end loop;

  -- ── habit completions ──────────────────────────────────────────────────────
  -- Consistency improves over the twelve weeks, and no habit is ever perfect —
  -- a 100% history would hide every bug in the streak and insight logic.
  for v_habit in
    select id, category, is_optional, frequency
    from public.habits
    where user_id = p_user_id and is_active and frequency = 'daily'
  loop
    v_day := v_start;
    while v_day <= v_today loop
      v_week := (v_day - v_start) / 7;
      v_roll := random();

      -- 55% at the start, rising to about 90% by the end.
      if v_roll < (0.55 + v_week * 0.03) and not (v_habit.is_optional and random() < 0.5) then
        insert into public.habit_completions (user_id, habit_id, log_date, status, completed_at)
        values (p_user_id, v_habit.id, v_day, 'completed', v_day + time '12:00')
        on conflict (habit_id, log_date) do nothing;
      elsif v_roll < 0.72 then
        insert into public.habit_completions (user_id, habit_id, log_date, status, completed_at)
        values (p_user_id, v_habit.id, v_day, 'skipped', v_day + time '12:00')
        on conflict (habit_id, log_date) do nothing;
      end if;

      v_day := v_day + 1;
    end loop;
  end loop;

  -- ── skincare entries ───────────────────────────────────────────────────────
  select id into v_am_id from public.skincare_routines
    where user_id = p_user_id and period = 'am';
  select id into v_pm_id from public.skincare_routines
    where user_id = p_user_id and period = 'pm';

  v_day := v_start;
  while v_day <= v_today loop
    v_week := (v_day - v_start) / 7;

    -- Mornings are more reliable than evenings, which is the realistic pattern
    -- and the one the "evenings are lighter" insight keys off.
    if random() < (0.6 + v_week * 0.03) then
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

    if random() < (0.45 + v_week * 0.035) then
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

    -- An occasional skin note.
    if random() < 0.12 then
      insert into public.skin_logs (user_id, log_date, conditions)
      values (
        p_user_id,
        v_day,
        (array[
          array['good']::skin_condition[],
          array['clear']::skin_condition[],
          array['dry']::skin_condition[],
          array['breakout']::skin_condition[],
          array['oily','irritated']::skin_condition[]
        ])[1 + floor(random() * 5)::int]
      )
      on conflict (user_id, log_date) do nothing;
    end if;

    v_day := v_day + 1;
  end loop;

  -- ── workouts ───────────────────────────────────────────────────────────────
  -- Roughly three a week, cycling through the templates, with loads creeping up
  -- so the progression charts and personal bests have a real slope.
  v_day := v_start;
  while v_day <= v_today loop
    if extract(dow from v_day) in (1, 3, 5) and random() < 0.8 then
      v_week := (v_day - v_start) / 7;

      select * into v_template
      from public.workout_templates
      where user_id = p_user_id and is_active
      order by sort_order
      offset (((v_day - v_start) / 2) % greatest(1, (select count(*) from public.workout_templates where user_id = p_user_id)))
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

          -- Compound lower-body work starts heavier than isolation work.
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

  -- ── a couple of manual milestones ──────────────────────────────────────────
  insert into public.timeline_milestones (user_id, occurred_on, title, description, kind)
  values
    (p_user_id, v_start + 21, 'First full month of training',
     'Three sessions a week held together through a busy stretch.', 'manual'),
    (p_user_id, v_start + 56, 'Hip thrusts felt easy at last week''s weight',
     null, 'strength')
  on conflict do nothing;
end;
$demo$;

comment on function public.seed_demo_history(uuid) is
  'DEVELOPMENT ONLY. Generates 12 weeks of demo history marked source = seed.';

-- =============================================================================

create or replace function public.clear_demo_history(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $clear$
begin
  -- Only removes rows the demo seeder created. Anything the user logged
  -- (source = 'user') is left untouched.
  delete from public.workouts where user_id = p_user_id and source = 'seed';
  delete from public.weight_entries where user_id = p_user_id and source = 'seed';
  delete from public.timeline_milestones where user_id = p_user_id and kind in ('manual', 'strength');
  delete from public.skin_logs where user_id = p_user_id;
  delete from public.skincare_entries where user_id = p_user_id;
  delete from public.habit_completions where user_id = p_user_id;
end;
$clear$;

comment on function public.clear_demo_history(uuid) is
  'DEVELOPMENT ONLY. Removes demo history created by seed_demo_history.';
