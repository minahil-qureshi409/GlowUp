-- =============================================================================
-- GlowUp — Daily metrics (hydration, sleep, mood)
-- =============================================================================

create type public.day_mood as enum (
  'calm', 'happy', 'motivated', 'tired', 'stressed', 'low'
);

-- ─── Daily metrics ───────────────────────────────────────────────────────────
--
-- The GlowUp Today screen shows five pillars — nutrition, movement, skincare,
-- sleep and hydration — plus a small vitals row (streak, mood, energy). Three
-- of those five already had a source of truth: habits, workouts and skincare
-- entries. Sleep and hydration did not, and a ring that averages two invented
-- numbers with three real ones is not a score, it is a decoration.
--
-- This table is the missing source. One row per user per day, every column
-- nullable except the water count, which starts at zero because "no glasses
-- logged" and "zero glasses" are the same thing in a way that "no sleep
-- logged" and "zero hours of sleep" are emphatically not.

create table public.daily_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  metric_date date not null,

  -- Glasses, not millilitres. The design counts eight of them, and asking
  -- someone to estimate volume is how a two-second log becomes a chore.
  water_glasses smallint not null default 0 check (water_glasses between 0 and 30),

  -- Hours, to the quarter. Null means not logged, which the UI shows as a dash
  -- rather than as a zero.
  sleep_hours numeric(4, 2) check (sleep_hours between 0 and 24),

  mood public.day_mood,
  note text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- One row per day. Logging again updates rather than accumulating, the same
  -- contract `weight_entries` already uses.
  unique (user_id, metric_date)
);

create index daily_metrics_user_date_idx
  on public.daily_metrics (user_id, metric_date desc);

create trigger set_updated_at before update on public.daily_metrics
  for each row execute function public.set_updated_at();

-- Owner-scoped, exactly like every other table.
alter table public.daily_metrics enable row level security;
alter table public.daily_metrics force row level security;

create policy "own rows are selectable" on public.daily_metrics
  for select to authenticated using ((select auth.uid()) = user_id);

create policy "own rows are insertable" on public.daily_metrics
  for insert to authenticated with check ((select auth.uid()) = user_id);

create policy "own rows are updatable" on public.daily_metrics
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "own rows are deletable" on public.daily_metrics
  for delete to authenticated using ((select auth.uid()) = user_id);

comment on table public.daily_metrics is
  'One row per user per day: hydration, sleep and mood. Feeds the Today pillars.';
