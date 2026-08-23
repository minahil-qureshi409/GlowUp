-- =============================================================================
-- GlowUp — encrypted calendar credentials
-- =============================================================================
-- `calendar_credentials` stays service-role-only: RLS on, zero policies, grants
-- revoked. That protects one user from another. It does nothing about a
-- database dump, a leaked backup, or anything else holding the service-role
-- key, and a column of live Google refresh tokens is a far worse thing to lose
-- than a table of weigh-ins.
--
-- So both tokens are now stored as AES-256-GCM ciphertext with a per-row IV,
-- keyed by CALENDAR_TOKEN_KEY, which lives in the environment and never in the
-- database. The plaintext columns stay for one release so an existing
-- connection keeps working; `20260824000200` drops them.
--
-- Additive: no existing migration is rewritten, and nothing here rewrites a row.
-- =============================================================================

alter table public.calendar_credentials
  add column if not exists encrypted_access_token text,
  add column if not exists encrypted_refresh_token text,
  -- Which envelope version wrote the row, so a future key rotation can tell
  -- what it is looking at instead of guessing.
  add column if not exists token_version smallint not null default 1;

-- New rows write ciphertext only, so the plaintext column can no longer be
-- required. It is not dropped yet: an account connected before this migration
-- still has its token there, and forcing everyone to re-authorise for a
-- storage change would be rude.
alter table public.calendar_credentials
  alter column access_token drop not null;

comment on column public.calendar_credentials.encrypted_access_token is
  'AES-256-GCM envelope: v1.<iv>.<tag>.<ciphertext>, base64url. Key is CALENDAR_TOKEN_KEY, held outside the database.';

comment on column public.calendar_credentials.encrypted_refresh_token is
  'AES-256-GCM envelope, same format. This is the long-lived credential — it must never be written in plaintext.';

comment on table public.calendar_credentials is
  'OAuth tokens, encrypted at rest. Service-role only: RLS enabled with no policies and grants revoked. Never expose through PostgREST.';

-- Belt to those braces. `revoke` is not idempotent across a role being
-- re-granted by a later `grant all on all tables`, which is a common footgun in
-- Supabase projects, so it is asserted again here.
revoke all on public.calendar_credentials from anon, authenticated;

-- =============================================================================
-- Busy-block retention
-- =============================================================================
-- The Calendar screen promises "only start and end times of busy blocks, for
-- the next two weeks". Sync enforces that on every run, but an abandoned
-- connection that never syncs again would leave stale rows behind forever.
-- This index is what makes the retention sweep cheap enough to run every time.

create index if not exists calendar_busy_connection_day_idx
  on public.calendar_event_metadata (connection_id, day);

comment on column public.calendar_event_metadata.day is
  'The busy block start, resolved to the user''s local calendar day. Used for retention and for day lookups.';
