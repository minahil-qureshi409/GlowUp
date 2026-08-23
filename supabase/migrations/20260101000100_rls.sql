-- =============================================================================
-- GlowUp — Row Level Security
-- =============================================================================
-- Every table is owner-scoped: a row is visible and writable only by the user
-- whose id is in `user_id` (`id` on `profiles`). Policies are generated in a
-- loop so no table can be forgotten and no policy can drift from the others.
--
-- `(select auth.uid())` rather than a bare `auth.uid()` is deliberate: wrapping
-- it in a subselect lets Postgres evaluate it once per query (an InitPlan)
-- instead of once per row, which matters on the history tables.
-- =============================================================================

do $rls$
declare
  t text;
  owner_col text;
begin
  foreach t in array array[
    'profiles', 'user_settings', 'gym_configs', 'weight_entries', 'goals',
    'goal_milestones', 'shake_recipes', 'shake_ingredients', 'habits',
    'habit_completions', 'exercises', 'workout_templates',
    'workout_template_exercises', 'workouts', 'workout_exercises',
    'exercise_sets', 'skincare_products', 'skincare_routines',
    'skincare_routine_steps', 'skincare_entries', 'skincare_step_completions',
    'skin_logs', 'progress_photos', 'weekly_reviews', 'timeline_milestones',
    'calendar_connections', 'calendar_event_metadata', 'reminders',
    'suggestion_dismissals'
  ]
  loop
    -- `profiles` is keyed by the auth user id itself; everything else carries user_id.
    owner_col := case when t = 'profiles' then 'id' else 'user_id' end;

    execute format('alter table public.%I enable row level security', t);
    -- Table owners bypass RLS by default; force it so a mistake in a SECURITY
    -- DEFINER function can't leak another user's rows.
    execute format('alter table public.%I force row level security', t);

    execute format(
      'create policy "own rows are selectable" on public.%I
         for select to authenticated using ((select auth.uid()) = %I)', t, owner_col);

    execute format(
      'create policy "own rows are insertable" on public.%I
         for insert to authenticated with check ((select auth.uid()) = %I)', t, owner_col);

    execute format(
      'create policy "own rows are updatable" on public.%I
         for update to authenticated
         using ((select auth.uid()) = %I)
         with check ((select auth.uid()) = %I)', t, owner_col, owner_col);

    execute format(
      'create policy "own rows are deletable" on public.%I
         for delete to authenticated using ((select auth.uid()) = %I)', t, owner_col);
  end loop;
end;
$rls$;

-- ── OAuth tokens: no client access at all ────────────────────────────────────
-- RLS is enabled with *zero* policies, so `anon` and `authenticated` can never
-- read a token even with a valid JWT. Only the service role (which bypasses
-- RLS) touches this table, and only inside server-side route handlers.
alter table public.calendar_credentials enable row level security;
revoke all on public.calendar_credentials from anon, authenticated;

comment on table public.calendar_credentials is
  'OAuth tokens. Service-role only: RLS enabled with no policies and grants revoked. Never expose through PostgREST.';

comment on table public.calendar_event_metadata is
  'Free/busy blocks only. Titles, descriptions, attendees and locations are never requested or stored.';

-- =============================================================================
-- Private storage for progress photos
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'progress-photos',
  'progress-photos',
  false,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

-- Objects live at `${auth.uid()}/${uuid}.ext`, so the first path segment is the
-- owner and every policy pivots on it. The bucket is private; the app hands out
-- short-lived signed URLs rather than public links.
create policy "photos are readable by their owner"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "photos are uploadable by their owner"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "photos are updatable by their owner"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "photos are deletable by their owner"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
