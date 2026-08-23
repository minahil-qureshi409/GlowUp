-- =============================================================================
-- GlowUp — schema verification
-- =============================================================================
-- Run against the linked Supabase project after applying migrations.
--
-- Expected, after 20260824000000_neutral_defaults.sql and
-- 20260824000100_calendar_token_encryption.sql:
--
--   tables            30   unchanged — neither migration adds or drops a table
--   rls_enabled       30   unchanged — every table still has RLS forced
--   table_policies   116   unchanged — the new columns live on tables that were
--                          already in the owner-scoped policy loop, so the
--                          skincare step editor and the encrypted token columns
--                          needed no new policy. This was checked before
--                          writing one.
--   storage_policies  >=4  the four progress-photo policies
--   functions          3   seed_user_defaults, handle_new_user, set_updated_at
--                          (both redefined in place with `create or replace`,
--                           so the count does not move)
--   signup_trigger     1
--   photo_bucket       1   and it must still be private
--
-- If `table_policies` has moved, something added a policy that was not
-- intended. Do not just accept a new total.
-- =============================================================================

select
  (select count(*) from pg_tables where schemaname = 'public')                 as tables,
  (select count(*) from pg_tables where schemaname = 'public' and rowsecurity) as rls_enabled,
  (select count(*) from pg_policies where schemaname = 'public')               as table_policies,
  (select count(*) from pg_policies where schemaname = 'storage')              as storage_policies,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in
       ('seed_user_defaults','handle_new_user','set_updated_at'))              as functions,
  (select count(*) from pg_trigger where tgname = 'on_auth_user_created')      as signup_trigger,
  (select count(*) from storage.buckets where id = 'progress-photos')          as photo_bucket;

-- The photo bucket must stay private with a 10 MB cap.
select id, public, file_size_limit
from storage.buckets
where id = 'progress-photos';

-- =============================================================================
-- calendar_credentials: still service-role only
-- =============================================================================
-- Expect: rls_enabled = true, policy_count = 0, and no grants to anon or
-- authenticated. This is the one table where *zero* policies is correct.

select
  c.relrowsecurity                                                             as rls_enabled,
  (select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'calendar_credentials')       as policy_count,
  (select count(*) from information_schema.role_table_grants
     where table_schema = 'public'
       and table_name = 'calendar_credentials'
       and grantee in ('anon', 'authenticated'))                               as client_grants
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname = 'calendar_credentials';

-- =============================================================================
-- New columns from this round of migrations
-- =============================================================================
-- Expect three rows: skincare_routine_steps.is_active,
-- calendar_credentials.encrypted_access_token, .encrypted_refresh_token.

select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'skincare_routine_steps' and column_name = 'is_active')
    or (table_name = 'calendar_credentials'
        and column_name in ('encrypted_access_token', 'encrypted_refresh_token'))
  )
order by table_name, column_name;

-- =============================================================================
-- Tokens are ciphertext, not readable strings
-- =============================================================================
-- Every stored credential should report looks_encrypted = true and have no
-- leftover plaintext. A row with plaintext_left_behind = true was written
-- before the encryption migration and will be rewritten on its next refresh.

select
  connection_id,
  encrypted_refresh_token is not null                                          as has_encrypted_refresh,
  coalesce(encrypted_refresh_token, '') like 'v1.%'                            as looks_encrypted,
  (access_token is not null or refresh_token is not null)                      as plaintext_left_behind
from public.calendar_credentials;

-- =============================================================================
-- Busy blocks hold nothing but times
-- =============================================================================
-- The Calendar screen promises start and end only, for the next 14 days.
-- Expect: no columns beyond the ones listed, and stale_rows = 0 after a sync.

select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'calendar_event_metadata'
order by ordinal_position;

select
  count(*)                                                    as total_rows,
  count(*) filter (where day < current_date)                   as rows_before_today,
  count(*) filter (where day > current_date + interval '14 days') as rows_beyond_window
from public.calendar_event_metadata;
