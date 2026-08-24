# GlowUp — setup walkthrough

Start to finish: a real Supabase project, the database created and verified, and the app
running with your account in it.

Allow about **20 minutes**. Google Calendar (step 10) is optional and adds ~10 more.

Commands are written for **PowerShell** (your default shell). Where bash differs, both
are shown.

---

## Contents

| # | Step | Time |
|---|---|---|
| 1 | [Prerequisites](#1-prerequisites) | 1 min |
| 2 | [Install dependencies](#2-install-dependencies) | 2 min |
| 3 | [Create the Supabase project](#3-create-the-supabase-project) | 3 min |
| 4 | [Get your API keys and write `.env.local`](#4-get-your-api-keys-and-write-envlocal) | 3 min |
| 5 | [Create the database](#5-create-the-database) | 4 min |
| 6 | [Verify the schema](#6-verify-the-schema) | 2 min |
| 7 | [Configure authentication URLs](#7-configure-authentication-urls) | 2 min |
| 8 | [Run the app and create your account](#8-run-the-app-and-create-your-account) | 3 min |
| 9 | [Verify your seed data](#9-verify-your-seed-data) | 2 min |
| 10 | [Optional — demo history](#10-optional--demo-history) | 1 min |
| 11 | [Optional — Google Calendar](#11-optional--google-calendar) | 10 min |
| 12 | [Everyday commands](#12-everyday-commands) | — |
| 13 | [Troubleshooting](#13-troubleshooting) | — |

---

## 1. Prerequisites

You need **Node 18.18+** (Node 22 recommended) and npm.

```powershell
node -v    # expect v22.x (v18.18+ works)
npm -v     # expect 10.x
```

Both are already installed on this machine (Node v22.17.1, npm 10.9.2).

You also need a **Supabase account** — free tier is plenty. Sign up at
[supabase.com](https://supabase.com) if you don't have one.

> **Note on the folder location.** This project sits inside OneDrive, and the enclosing
> Git repository is rooted at `C:\Users\minah` rather than at this folder. Neither breaks
> anything, but OneDrive syncing `node_modules` can slow installs down. If you want to
> move it somewhere outside OneDrive and run `git init` here, now is the moment — before
> you create any data.

---

## 2. Install dependencies

```powershell
cd "c:\Users\minah\OneDrive\Documents\health tracker app"
npm install
```

Already done, but safe to re-run.

**Check it worked:**

```powershell
npm run typecheck
```

Expect **no output**. Silence means zero type errors.

---

## 3. Create the Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. Click **New project**.
3. Fill in:
   - **Name** — `glowup` (anything you like)
   - **Database password** — click *Generate*, then **save it in your password manager**.
     You will need it if you ever use the CLI or connect with `psql`. It cannot be
     retrieved later, only reset.
   - **Region** — pick the one closest to you. This is the single biggest factor in how
     fast the app feels.
4. Click **Create new project**.

Provisioning takes **1–3 minutes**. Wait until the dashboard stops showing "Setting up
your project" before continuing.

---

## 4. Get your API keys and write `.env.local`

### 4a. Find the keys

In your project, go to **Project Settings** (gear icon, bottom left) → **API**.

> Depending on when your account was created this page may be split into **API** and
> **API Keys**, and keys may be shown either in the older JWT format (`eyJhbGci…`) or the
> newer prefixed format (`sb_publishable_…` / `sb_secret_…`). **Either format works** —
> the client libraries accept both. Just match them by role, not by appearance.

You need three values:

| Dashboard label | Goes into | Role |
|---|---|---|
| **Project URL** | `NEXT_PUBLIC_SUPABASE_URL` | Your project's address |
| **anon** / **public** / **publishable** key | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Safe in the browser |
| **service_role** / **secret** key | `SUPABASE_SERVICE_ROLE_KEY` | **Server only. Never commit.** |

> **Why the anon key is safe in the browser:** every table in this app has row level
> security enabled, so that key can only ever read and write the signed-in user's own
> rows. The service_role key is the opposite — it *bypasses* RLS entirely, which is why
> it is used for exactly one thing in this codebase (calendar OAuth tokens) and never
> reaches the client bundle.

### 4b. Edit `.env.local`

The file already exists with placeholder values. **Open it and replace them** — do not
copy `.env.example` over it, or you will lose nothing but gain nothing either.

```powershell
code .env.local     # or: notepad .env.local
```

Set it to:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-or-secret-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Leave the three `GOOGLE_*` lines out for now — step 11 covers them.

`SUPABASE_SERVICE_ROLE_KEY` is only needed for the calendar integration. You can leave it
unset and everything else will work.

**Check it worked:** `.env.local` is already in `.gitignore`, so it will not be committed.
Confirm:

```powershell
git check-ignore -v .env.local
```

Expect a line naming `.gitignore`. If you get **no output**, stop and add `.env.local` to
your `.gitignore` before going further.

---

## 5. Create the database

Seven migration files, **run in order**. Order matters: each one builds on the tables,
enums and functions the ones before it created.

```
supabase/migrations/20260101000000_init_schema.sql              tables, enums, triggers
supabase/migrations/20260101000100_rls.sql                      row level security + storage bucket
supabase/migrations/20260101000200_seed_defaults.sql            per-user defaults + signup trigger
supabase/migrations/20260824000000_neutral_defaults.sql         neutral seeded content
supabase/migrations/20260824000100_calendar_token_encryption.sql  encrypted OAuth token columns
supabase/migrations/20260824010000_google_only_calendar_provider.sql  Google-only calendar provider enum
supabase/migrations/20260824010100_daily_metrics.sql            hydration, sleep and mood
```

Pick **one** of the two paths below.

---

### Path A — SQL editor (recommended, no CLI needed)

1. In the dashboard, open **SQL Editor** (left sidebar).
2. Click **New query**.
3. Open `supabase/migrations/20260101000000_init_schema.sql` in your editor, select all
   (`Ctrl+A`), copy, and paste into the SQL editor.
4. Click **Run** (or `Ctrl+Enter`).
5. Expect **Success. No rows returned.**
6. Repeat for each remaining file, in the order listed above.

Run each file **completely and once**. These migrations are not written to be re-run —
`create table` and `create policy` both fail on a second pass. If you need to start over,
see [Troubleshooting → Start the database over](#start-the-database-over).

---

### Path B — Supabase CLI

Useful if you plan to keep changing the schema.

```powershell
npx supabase login
npx supabase link --project-ref YOUR-REF
npx supabase db push
```

Your `YOUR-REF` is the subdomain in your Project URL — for
`https://abcdefghijkl.supabase.co`, the ref is `abcdefghijkl`.

`link` will prompt for the database password you saved in step 3.

`db push` applies every migration in filename order automatically.

---

## 6. Verify the schema

Don't take "Success" on faith. Run this in the **SQL Editor**:

```sql
select
  (select count(*) from pg_tables where schemaname = 'public')                        as tables,
  (select count(*) from pg_tables where schemaname = 'public' and rowsecurity)        as rls_enabled,
  (select count(*) from pg_policies where schemaname = 'public')                      as table_policies,
  (select count(*) from pg_policies where schemaname = 'storage')                     as storage_policies,
  (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname in
       ('seed_user_defaults','handle_new_user','set_updated_at'))                     as functions,
  (select count(*) from pg_trigger where tgname = 'on_auth_user_created')             as signup_trigger,
  (select count(*) from storage.buckets where id = 'progress-photos')                 as photo_bucket;
```

**Expected result — every number must match:**

| Column | Expected | What it means |
|---|---|---|
| `tables` | **30** | All tables created |
| `rls_enabled` | **30** | RLS on every single one, no exceptions |
| `table_policies` | **116** | 29 tables × 4 policies. `calendar_credentials` deliberately has **0** |
| `storage_policies` | **4** | Progress photos: select / insert / update / delete, all owner-scoped. Higher if the project already had other buckets |
| `functions` | **3** | Seeding and timestamp helpers |
| `signup_trigger` | **1** | New accounts get their starter content |
| `photo_bucket` | **1** | Private bucket exists |

If `table_policies` is **116** but `rls_enabled` is less than 30, something partially
applied — start over rather than patching.

> **Why `calendar_credentials` has zero policies:** that table holds OAuth tokens. RLS is
> enabled with *no policies at all* and grants are revoked from `anon` and
> `authenticated`, so no client role can read a token even with a valid session. Only the
> service role, inside server-side route handlers, can touch it. Zero here is correct.

**Second check — confirm the bucket is private:**

```sql
select id, public, file_size_limit from storage.buckets where id = 'progress-photos';
```

Expect `public = false` and `file_size_limit = 10485760` (10 MB). If `public` is `true`,
your photos would be readable by anyone with the URL — stop and re-run the RLS migration.

---

## 7. Configure authentication URLs

Without this, confirmation emails will send you to the wrong place.

Go to **Authentication** → **URL Configuration**:

1. **Site URL** → `http://localhost:3000`
2. **Redirect URLs** → click *Add URL* and enter:
   ```
   http://localhost:3000/auth/callback
   ```

Click **Save**.

### Email confirmation — on or off?

Go to **Authentication** → **Sign In / Providers** → **Email**.

- **Confirm email ON** (default) — signup shows a "check your inbox" screen and you must
  click the emailed link before you can sign in. More realistic, slower to test.
- **Confirm email OFF** — signup logs you straight in. **Recommended while you set up.**

The app handles both correctly. If you leave it on, note that Supabase's built-in email
service is rate-limited to a few messages per hour on the free tier.

---

## 8. Run the app and create your account

```powershell
npm run dev
```

Open **http://localhost:3000**.

You should land on the **sign-in page** — the root redirects there when you have no
session.

### Create your account

1. Click **Create an account**.
2. Enter your name, email, and a password of **at least 8 characters**.
3. Click **Create account**.
   - If email confirmation is **off** → you go straight to onboarding.
   - If it is **on** → check your inbox and click the link, which lands you on onboarding.

### Complete onboarding

Seven short steps. **Every field is pre-filled with your seeded values** and every step
can be accepted as-is — there is a *"Skip the rest — the defaults are fine"* link under
the button that finishes immediately.

| Step | Pre-filled with |
|---|---|
| 1 · About you | Height 171.5 cm, timezone auto-detected from your device |
| 2 · Your goal | Current 47 kg → goal 55 kg |
| 3 · Food | 6 nutrition habits, evening shake marked optional |
| 4 · Training | 3 sessions/week, work 10:00–18:30, office gym until 15:00 |
| 5 · Skincare | AM and PM routines, moisturiser marked optional |
| 6 · Calendar | Skip unless you did step 11 first |
| 7 · Reminders | Off by default |

The one value genuinely worth changing is **step 2 — your current weight**, since that
becomes your first real weigh-in and the baseline for every trend the app draws.

You'll land on **Today**.

---

## 9. Verify your seed data

Back in the **SQL Editor**:

```sql
select
  (select count(*) from public.habits)            as habits,
  (select count(*) from public.exercises)         as exercises,
  (select count(*) from public.workout_templates) as templates,
  (select count(*) from public.shake_recipes)     as recipes,
  (select count(*) from public.shake_ingredients) as ingredients,
  (select count(*) from public.skincare_routines) as routines,
  (select count(*) from public.skincare_products) as products,
  (select count(*) from public.gym_configs)       as gyms,
  (select count(*) from public.goals)             as goals;
```

> This counts **every** row, which is what you want while yours is the only account. Note
> that `auth.uid()` is null in the SQL editor (it runs as `postgres`, not as you), so
> don't reach for it here — if you add a second account later, filter with an explicit
> `where user_id = 'the-id'` taken from **Authentication → Users**.

**Expected:**

| Column | Expected | Contents |
|---|---|---|
| `habits` | **10** | Eggs, morning shake, AM skincare, lunch, snack, workout, evening shake, dinner, PM skincare, sleep |
| `exercises` | **16** | 8 upper, 8 lower — weighted to arms, shoulders, glutes, legs |
| `templates` | **3** | Workout A (lower + glutes), B (upper + arms + shoulders), C (lower + arms) |
| `recipes` | **1** | Weight Gain Shake |
| `ingredients` | **4** | 300 ml milk, 1 banana, 2 dates, 2 tbsp peanut butter |
| `routines` | **2** | Morning and evening |
| `products` | **6** | Incl. B-Bomb, Anthelios SPF50+, Azelaic Acid, optional moisturiser |
| `gyms` | **1** | Office gym, women's hours to 15:00 |
| `goals` | **4** | Weight (primary) + workout frequency + 2 consistency goals |

### Click through the app

Confirm each screen loads with real data:

- **Today** — greeting matched to your local time, weight card, habit checklist. Tick a
  habit: it should respond instantly.
- **Nutrition** — habits plus the Weight Gain Shake showing **≈ 617 kcal · 19.2 g protein**,
  labelled *approximate*.
- **Workout** — 0 / 3 this week, three templates. Press **Start a session** and check the
  office gym option is only offered inside its access window.
- **Skincare** — both routines, moisturiser tagged **Optional**.
- **Progress** — one weigh-in and your milestone ladder.
- **Settings** — every seeded value editable.

> **A note on milestones:** completing onboarding *rebuilds* the milestone ladder from
> your chosen start and goal weight. With the defaults (47 → 55 kg) you get five rungs:
> starting point, three evenly spaced milestones, and the goal. So `goal_milestones` will
> read 5 after onboarding, not the 4 that were seeded at signup. That's expected.

---

## 10. Optional — demo history

The charts, streaks, insights and timeline are more interesting with data behind them.
This generates **twelve weeks** of plausible history.

> **Development only.** Everything it writes is stamped `source = 'seed'`, which is how
> the app tells demo content apart from anything you actually log. Don't run it once you
> have real data you care about.

1. **SQL Editor** → paste the whole of `supabase/seed/dev_seed.sql` → **Run**. This only
   creates the two functions.
2. Get your user id from **Authentication → Users**.
3. Run:

```sql
select public.seed_demo_history('paste-your-user-id-here');
```

You get weekly weigh-ins drifting gently upward with realistic noise, habit completions
improving from ~55% to ~90%, three workouts most weeks with loads creeping up, skincare
where mornings beat evenings, and a couple of milestones.

Reload **Progress** and the trend line, milestones and consistency chart all fill in.

**To undo:**

```sql
select public.clear_demo_history('your-user-id');
```

This removes only `source = 'seed'` rows, plus habit/skincare logs. Anything you logged
yourself as `source = 'user'` survives.

---

## 11. Optional — Google Calendar

Skip this and everything else works — the app falls back to your typical work hours from
Settings. Connect it and suggestions start working around your real meetings.

### 11a. Google Cloud Console

1. [console.cloud.google.com](https://console.cloud.google.com/) → create or select a
   project.
2. **APIs & Services → Library** → search **Google Calendar API** → **Enable**.
3. **APIs & Services → OAuth consent screen**:
   - User type **External** → Create
   - App name `GlowUp`, your email for support and developer contact
   - **Scopes** → *Add or remove scopes* → paste each of these:
     ```
     https://www.googleapis.com/auth/calendar.freebusy
     https://www.googleapis.com/auth/userinfo.email
     ```
   - **Test users** → add your own Google address. While the app is unverified, only
     listed test users can connect — which is fine for personal use.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type **Web application**
   - **Authorised redirect URIs** → add exactly:
     ```
     http://localhost:3000/api/calendar/google/callback
     ```
   - Create, then copy the **Client ID** and **Client secret**.

### 11b. Add to `.env.local`

```ini
CALENDAR_TOKEN_KEY=<64 hex characters>
CALENDAR_REDIRECT_BASE_URL=http://localhost:3000

GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

`CALENDAR_TOKEN_KEY` encrypts the OAuth tokens at rest (AES-256-GCM, per-row IV).
Generate one with:

```powershell
openssl rand -hex 32
```

It is **required**: without it the Calendar screen keeps its "Not configured" state and no
connection can be made, because writing refresh tokens in plaintext is not an acceptable
fallback. RLS keeps one user out of another user's tokens; encryption is what protects them
in a database dump.

Register the redirect URI `http://localhost:3000/api/calendar/google/callback` with Google.
`CALENDAR_REDIRECT_BASE_URL` is what the app builds that URL from; the older
`GOOGLE_REDIRECT_URI` still works if you already have it set.

**Restart the dev server** — `NEXT_PUBLIC_*` and server env vars are read at boot.

### 11c. Connect

Open **Calendar** in the app → **Connect** → approve on Google's screen. You return with
"Calendar connected", and the next two weeks of busy blocks sync immediately.

### What Google is actually granting

The `calendar.freebusy` scope is the **narrowest Calendar scope Google offers**. It grants
exactly one capability: asking *"is this person busy between X and Y."* Event titles,
descriptions, attendees, locations and even calendar names are **unreadable with it** —
not by this app, and not by anything that steals the token.

`userinfo.email` is requested solely so the settings screen can show which account is
connected.

The app stores start time, end time and a busy flag, for 14 days ahead. **Disconnect**
revokes the token at Google and deletes every cached block — and if Google is unreachable,
local deletion still happens, because disconnect must always disconnect.

### 11d. Keeping it fresh

The **Refresh** button on the Calendar screen covers "I just added a meeting". For the rest,
point a cron at the sync endpoint roughly hourly:

```powershell
curl -H "Authorization: Bearer $env:CALENDAR_SYNC_SECRET" https://your-app/api/calendar/sync
```

Set `CALENDAR_SYNC_SECRET` (16+ characters) to enable it; without it the endpoint refuses
every request rather than defaulting open. Each run also deletes blocks before today, so
retention is enforced even on a connection nobody has opened in a fortnight.

---

## 12. Everyday commands

```powershell
npm run dev           # dev server on http://localhost:3000
npm run typecheck     # tsc --noEmit — silence is success
npm run lint          # eslint
npm run test          # vitest — dates, validation, redirects, rate limits, token crypto
npm run build         # production build
npm run start         # serve the production build (run build first)
npm run check:bundle  # fails if a server secret reached the browser bundle
npm run verify        # all of the above, in order — the pre-deploy gate
npm run format        # prettier
```

`npm run check:bundle` reads what actually shipped in `.next` and looks for the
service-role key, the calendar token key and anything shaped like a service-role JWT. One
careless import of a server module into a `"use client"` file is enough to publish a
service-role key to every visitor, and nothing about the app would look broken — so this
runs in CI, after the build.

### After changing the database schema

Regenerate the TypeScript types so the compiler knows about your change:

```powershell
npx supabase login
npx supabase link --project-ref YOUR-REF
npm run db:types
```

This overwrites `src/lib/db/database.types.ts`. The hand-written file is deliberately in
the CLI's exact output shape, so it drops in cleanly with no import changes anywhere.

Then run `npm run typecheck` — anything your schema change broke shows up there.

---

## 13. Troubleshooting

### "Missing or invalid Supabase environment variables"

The app is telling you `.env.local` is wrong, and it lists which key. Check for:

- A trailing slash on `NEXT_PUBLIC_SUPABASE_URL` (should end `.supabase.co`, no `/`)
- Quotes around values — don't use them
- A stale dev server. Env vars are read at boot: **stop and restart**.

### The sign-in page loads but signing in always fails

- Confirm the anon key is the **anon/publishable** one, not the service_role key.
- If email confirmation is on, check you actually clicked the link.
- Check **Authentication → Users** in the dashboard — if your user isn't there, signup
  failed rather than sign-in.

### Signed up, but the app is empty — no habits, no exercises

The signup trigger didn't fire, which means migration 3 didn't apply. Check:

```sql
select count(*) from pg_trigger where tgname = 'on_auth_user_created';
```

If it returns `0`, re-run `20260101000200_seed_defaults.sql`. Then backfill your existing
account rather than making a new one:

```sql
select public.seed_user_defaults('your-user-id');
```

It's idempotent — safe to call even if some content already exists.

### "relation already exists" when running a migration

That file has already been applied. Move on to the next one, or start over.

### Start the database over

Cleanest reset. **Deletes everything, including your account.**

```sql
drop schema public cascade;
create schema public;
grant usage on schema public to anon, authenticated, service_role;
grant all on all tables in schema public to anon, authenticated, service_role;

-- Remove the trigger on auth.users, which lives outside the public schema
drop trigger if exists on_auth_user_created on auth.users;

-- Remove storage policies and the bucket
drop policy if exists "photos are readable by their owner"   on storage.objects;
drop policy if exists "photos are uploadable by their owner" on storage.objects;
drop policy if exists "photos are updatable by their owner"  on storage.objects;
drop policy if exists "photos are deletable by their owner"  on storage.objects;
delete from storage.objects where bucket_id = 'progress-photos';
delete from storage.buckets where id = 'progress-photos';
```

Then delete your user under **Authentication → Users**, and re-run all three migrations
from step 5.

### Charts are empty

Expected with a new account — you have one weigh-in and no workouts. Either use the app
for a week or run the [demo history](#10-optional--demo-history) in step 10.

### Calendar shows "not configured"

The three `GOOGLE_*` variables aren't all set, or the dev server wasn't restarted after
setting them. All three are required together.

### Google returns `redirect_uri_mismatch`

The redirect URI in Google Cloud Console must match `GOOGLE_REDIRECT_URI` **character for
character**, including protocol, port and trailing path. `http` vs `https` and
`localhost` vs `127.0.0.1` are all distinct.

### Photo upload fails

- Max **10 MB**, and only JPEG / PNG / WebP / HEIC.
- If it fails regardless, confirm the bucket and its 4 policies exist (step 6).

### Port 3000 is taken

```powershell
npm run dev -- --port 3001
```

Then update `NEXT_PUBLIC_SITE_URL`, the Supabase redirect URL, and — if you're using it —
the Google redirect URI, to match the new port.

---

## What "done" looks like

- [ ] `npm run typecheck` produces no output
- [ ] Schema check in step 6 returns 30 / 30 / 116 / 4 / 3 / 1 / 1
- [ ] `progress-photos` bucket exists and is **private**
- [ ] You can sign in, and **Today** greets you at the right local time
- [ ] Ticking a habit responds instantly and survives a page reload
- [ ] The shake shows **≈ 617 kcal · 19.2 g protein**, labelled *approximate*
- [ ] The office gym is only offered inside its access window
- [ ] Optional: calendar connected, and the Today screen mentions your busy day

Once that's all true, deployment is covered in
[README.md → Deployment](./README.md#deployment).
