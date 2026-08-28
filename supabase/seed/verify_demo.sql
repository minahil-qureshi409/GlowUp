-- =============================================================================
-- GlowUp — demo state check
-- =============================================================================
-- Run straight after `seed_demo_history`, before presenting. Every query below
-- prints an `expect` column next to the real value, so a wrong number is
-- obvious without having to remember what right looks like.
--
--   \set uid 'b2c27de0-85df-4862-bace-38d37b0077e0'
--
-- Or in the Supabase SQL editor, paste your user id over :'uid' throughout.
-- =============================================================================

-- ── the shape of today ───────────────────────────────────────────────────────
-- This is the one that matters. Today has to be *partly* done: enough logged
-- that the screens have something to show, enough left that the demo has
-- something to tap.

select
  'today' as scope,
  (select count(*) from public.habit_completions
     where user_id = :'uid' and log_date = current_date
       and status in ('completed', 'modified'))                    as habits_done,
  '4 (3 required + 1 optional)'                                    as expect_habits,
  (select water_glasses from public.daily_metrics
     where user_id = :'uid' and metric_date = current_date)        as water,
  '4 of 8 — four taps to the confetti'                             as expect_water,
  (select sleep_hours from public.daily_metrics
     where user_id = :'uid' and metric_date = current_date)        as sleep,
  '7.50 — reads as "Good" energy'                                  as expect_sleep,
  (select mood from public.daily_metrics
     where user_id = :'uid' and metric_date = current_date)        as mood,
  'calm'                                                           as expect_mood;

-- ── what is deliberately left undone today ───────────────────────────────────
-- All three should be absent. Each one is a thing to demonstrate completing.

select
  (select count(*) from public.habit_completions hc
     join public.habits h on h.id = hc.habit_id
     where hc.user_id = :'uid' and hc.log_date = current_date
       and h.name = 'Dinner')                                      as dinner_logged,
  (select count(*) from public.skincare_entries
     where user_id = :'uid' and log_date = current_date
       and period = 'pm')                                          as pm_routine_logged,
  (select count(*) from public.workouts
     where user_id = :'uid' and workout_date = current_date)       as workout_logged,
  'all three should be 0'                                          as expect;

-- ── the streak ───────────────────────────────────────────────────────────────
-- The app counts a day as kept at 60% of required habits. Today is 3 of 5
-- (60%, exactly on the line) and the 23 days before it are 100% on weekdays,
-- 80% at weekends — so the streak reads 24 and the sidebar counts down to the
-- 30-day milestone.

with required as (
  select id from public.habits
  where user_id = :'uid' and is_active and not is_optional and frequency = 'daily'
),
daily as (
  select d::date as day,
         round(100.0 * count(hc.id) filter (where hc.status in ('completed','modified'))
               / greatest(1, (select count(*) from required))) as pct
  from generate_series(current_date - 40, current_date, interval '1 day') d
  left join public.habit_completions hc
    on hc.user_id = :'uid' and hc.log_date = d::date
   and hc.habit_id in (select id from required)
  group by d
)
select day, pct, case when pct >= 60 then 'kept' else 'broken' end as counts
from daily
order by day desc
limit 27;

-- ── history volume, per screen ───────────────────────────────────────────────
-- Every one of these feeds a specific screen. A zero means that screen shows
-- an empty state instead of the thing you meant to demonstrate.

select 'weight entries'   as feeds, count(*) as rows, '~48 over 84 days' as expect
  from public.weight_entries where user_id = :'uid'
union all select 'daily metrics',    count(*), '85 — one per day inc. today'
  from public.daily_metrics where user_id = :'uid'
union all select 'habit completions', count(*), 'several hundred'
  from public.habit_completions where user_id = :'uid'
union all select 'workouts',          count(*), '~30 (none today)'
  from public.workouts where user_id = :'uid'
union all select 'skincare entries',  count(*), '~110 (AM ahead of PM)'
  from public.skincare_entries where user_id = :'uid'
union all select 'skin logs',         count(*), '~12'
  from public.skin_logs where user_id = :'uid'
union all select 'weekly reviews',    count(*), '6'
  from public.weekly_reviews where user_id = :'uid'
union all select 'timeline',          count(*), '6'
  from public.timeline_milestones where user_id = :'uid'
union all select 'goal milestones',   count(*), '4 (2 reached)'
  from public.goal_milestones where user_id = :'uid';

-- ── the weight goal must have real numbers ───────────────────────────────────
-- Null start or target is what makes "% to goal" render as a dash on the
-- Progress ring, the More tile and the Weight screen.

select start_value, target_value, unit,
       '45.20 / 54.00 / kg' as expect
from public.goals
where user_id = :'uid' and type = 'weight' and is_primary;

-- ── the weekday gap the Consistency insight reports ──────────────────────────
-- Weekends should sit clearly below weekdays. If the gap is under 12 points the
-- panel switches to "your week is remarkably even", which is true but dull.

with required as (
  select id from public.habits
  where user_id = :'uid' and is_active and not is_optional and frequency = 'daily'
),
daily as (
  select d::date as day,
         extract(isodow from d) as dow,
         100.0 * count(hc.id) filter (where hc.status in ('completed','modified'))
           / greatest(1, (select count(*) from required)) as pct
  from generate_series(current_date - 29, current_date - 1, interval '1 day') d
  left join public.habit_completions hc
    on hc.user_id = :'uid' and hc.log_date = d::date
   and hc.habit_id in (select id from required)
  group by d
)
select
  round(avg(pct) filter (where dow <= 5))                as weekday_avg,
  round(avg(pct) filter (where dow >= 6))                as weekend_avg,
  round(avg(pct) filter (where dow <= 5)
        - avg(pct) filter (where dow >= 6))              as gap,
  'gap should be 12 or more'                             as expect
from daily;

-- ── sleep and hydration, which the Insights panels key off ───────────────────
-- Each panel needs at least five logged days in the last thirty.

select
  count(*) filter (where sleep_hours is not null)        as nights_logged,
  round(avg(sleep_hours), 2)                             as avg_sleep,
  count(*) filter (where sleep_hours < 6.5)              as short_nights,
  round(avg(water_glasses), 1)                           as avg_water,
  'both counts well over 5'                              as expect
from public.daily_metrics
where user_id = :'uid' and metric_date >= current_date - 29;
