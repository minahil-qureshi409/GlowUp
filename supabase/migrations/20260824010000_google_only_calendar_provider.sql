-- ─── Google is the only calendar provider ────────────────────────────────
--
-- `calendar_provider` used to read ('google', 'apple', 'outlook'). Neither of
-- the other two survives contact with what it actually takes to ship them:
--
--   apple    never had an implementation at all — no module in `lib/calendar`
--            satisfied the provider contract, the registry never listed it, and
--            no Connect button could reach it. It was an enum value and nothing
--            else. Shipping it for real needs a paid Apple Developer account.
--
--   outlook  had a working implementation, but every deployment that wanted to
--            use it needed its own Entra ID app registration and a tenant
--            decision, and Microsoft has no free/busy-only scope — the
--            narrowest grant available is `Calendars.Read`, which is a wider
--            promise than this app wants to make.
--
-- An enum value nothing can produce is a promise the app cannot keep, so both
-- go. Postgres has no `ALTER TYPE ... DROP VALUE`, so the enum is rebuilt and
-- the one column that uses it is recast through `text`.
--
-- Written to run from either starting shape — the three-value original, or the
-- two-value form an earlier revision of this migration produced.

-- Remove any connection on a provider that is going away. Credentials and
-- cached busy blocks cascade from here, so nothing is left orphaned.
delete from public.calendar_connections
where provider::text in ('apple', 'outlook');

alter type public.calendar_provider rename to calendar_provider__old;

create type public.calendar_provider as enum ('google');

alter table public.calendar_connections
  alter column provider type public.calendar_provider
  using provider::text::public.calendar_provider;

drop type public.calendar_provider__old;

comment on type public.calendar_provider is
  'Google only. Apple needs a paid developer account; Outlook needs a per-deployment Entra registration and offers no free/busy-only scope.';
