<<<<<<< HEAD
# GlowUp
=======
# GlowUp

A personal wellness tracker built around **consistency rather than schedules** — weight
gain, strength, nutrition habits and skincare in one place, adapting to a busy and
unpredictable office day.

The product rule that drives every design decision: **nothing in this app can be late,
overdue, or failed.** Those states do not exist in the data model, so no component can
render them.

---

## Table of contents

- [Architecture](#architecture)
- [Database schema](#database-schema)
- [Security model](#security-model)
- [Setup](#setup)
- [Environment variables](#environment-variables)
- [Supabase setup](#supabase-setup)
- [Google Calendar setup](#google-calendar-setup)
- [Local development](#local-development)
- [Deployment](#deployment)
- [Known limitations](#known-limitations)
- [Future improvements](#future-improvements)

---

## Architecture

### Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19 | Server Components keep per-user data fetching on the server; Server Actions keep mutations there too |
| Language | TypeScript, `strict` + `noUncheckedIndexedAccess` | |
| Styling | Tailwind CSS 3.4 + CSS custom properties | One token set, two themes |
| Components | shadcn/ui conventions, hand-rolled on Radix primitives | Owned in-repo, not a dependency to fight |
| Charts | Recharts | |
| Backend | Supabase (Postgres, Auth, Storage) | |
| Validation | Zod, shared client ↔ server | |
| Forms | React Hook Form + `@hookform/resolvers/zod` | |
| Dates | `date-fns` + `date-fns-tz` | |

### State management — and the deliberate absence of a client cache

There is **no React Query / SWR / Zustand layer**, and that is a decision rather than an
omission:

- Every screen's data is fetched in a **Server Component**.
- Every mutation is a **Server Action** that calls `revalidatePath`.
- **`useOptimistic`** covers the round trip, so a tap responds instantly.

A client query cache would duplicate server state and give it a second chance to
disagree with the database — the classic source of "I ticked it and it came back
unticked" bugs in habit trackers. `@tanstack/react-query` was in the original dependency
list and was removed once it turned out to have nothing to do.

### Layers

```
src/
├── app/                          Routes only — thin, no business logic
│   ├── (auth)/                   login, signup
│   ├── (app)/                    authenticated shell + all main screens
│   ├── onboarding/
│   ├── api/calendar/google/      OAuth start + callback (needs redirects & cookies)
│   └── auth/callback/            Supabase email confirmation exchange
│
├── lib/
│   ├── domain/                   ★ Pure functions. No I/O, no React, no Supabase.
│   │   ├── copy.ts               Every user-facing phrase about performance
│   │   ├── planner.ts            The adaptive daily plan
│   │   ├── insights.ts           Behavioural suggestions over weeks
│   │   ├── reminders.ts          Reminder eligibility rules
│   │   ├── weight.ts             Trend smoothing, milestones, stall detection
│   │   ├── habits.ts             Consistency, streaks, weekday patterns
│   │   ├── workout.ts            Volume, e1RM, PRs, progression
│   │   ├── nutrition.ts          Recipe macros, weekly observations
│   │   └── skincare.ts           Routine completion, timelines
│   ├── calendar/                 Provider abstraction + Google implementation
│   ├── supabase/                 client / server / admin / middleware clients
│   ├── validation/schemas.ts     Zod, shared by forms and actions
│   ├── db/database.types.ts      Generated-shape DB types
│   ├── date.ts, format.ts, env.ts, utils.ts
│
├── services/                     Data access. Takes a client + userId, returns typed rows.
├── server/
│   ├── auth.ts                   requireUser() — the single auth entry point
│   └── actions/                  Server Actions, one module per domain
├── components/
│   ├── ui/                       Radix-based primitives
│   ├── common/ layout/ charts/   Shared building blocks
│   └── habits/ nutrition/ workout/ skincare/ progress/ calendar/ settings/ today/
├── hooks/  config/  middleware.ts
```

The **`lib/domain` layer is the heart of the app** and has zero dependencies on React,
Next or Supabase. Every rule that matters — what counts as a streak, when the office gym
stops being suggested, whether a reminder may fire, when a trend is "flat" — is a pure
function there.

### Two decisions worth flagging

**1. The voice lives in one file.** `lib/domain/copy.ts` holds every phrase the app says
about the user's performance, with the tone rules written at the top. Scattering that
copy across forty components would make "never say you failed" unenforceable in review.

**2. Calendar access is narrowed by the type system.** The `CalendarProvider` interface
exposes only `fetchBusy()`. There is no method that can return an event title, so no
future contributor can accidentally start collecting them. The privacy promise is
enforced by the interface, not by a comment.

### The adaptive planner

`buildDailyPlan()` combines the current time, calendar busy blocks, work hours, gym
access hours, habit state, workout count and weigh-in recency into:

- a **day shape** (`open` / `normal` / `busy` / `late`) that controls tone and *volume* of
  suggestions — never permission;
- **free windows** left in the day;
- at most **three dismissible suggestions**.

Office-gym suggestions treat the women's-only window as a hard boundary, minus a
45-minute travel buffer. Past that, the planner offers home instead — and says why.

---

## Database schema

29 tables, all owner-scoped. Full DDL in `supabase/migrations/`.

### Profile & configuration
| Table | Notes |
|---|---|
| `profiles` | 1:1 with `auth.users`. Timezone, time format, theme, onboarding stamp |
| `user_settings` | Workouts/week, preferred days (advisory), typical work hours, quiet hours, reminder cap |
| `gym_configs` | Name, location, **`access_start`/`access_end`** (women's-only window), available days, equipment |

### Weight & goals
| Table | Notes |
|---|---|
| `weight_entries` | One per user per day (`unique(user_id, entry_date)`) — daily noise would corrupt the trend |
| `goals` | Weight, workout frequency, consistency goals. Partial unique index enforces one primary |
| `goal_milestones` | Value-based. `achieved_at` is sticky: a dip below does not un-reach a milestone |

### Habits & nutrition
| Table | Notes |
|---|---|
| `habits` | Category, frequency, `preferred_part` (a hint), optional window, `is_optional`, optional `recipe_id` |
| `habit_completions` | `completed` / `skipped` / `modified`. **No "missed" state exists** |
| `shake_recipes`, `shake_ingredients` | Macros stored **per unit**, so editing a quantity recomputes cleanly |

### Workouts
| Table | Notes |
|---|---|
| `exercises` | Per-user rows (seeded), so RLS stays a single predicate |
| `workout_templates`, `workout_template_exercises` | Workout A / B / C |
| `workouts`, `workout_exercises`, `exercise_sets` | Sets carry reps, weight, RPE, warm-up and completed flags |

### Skincare
| Table | Notes |
|---|---|
| `skincare_products`, `skincare_routines`, `skincare_routine_steps` | Steps carry **`is_optional`** — the moisturiser is seeded optional and never counts against completion |
| `skincare_entries`, `skincare_step_completions`, `skin_logs` | Conditions are a `skin_condition[]`; skin is rarely one thing |

### Progress & review
`progress_photos` (private bucket paths), `weekly_reviews` (stats frozen as `jsonb` at
review time so a later habit edit cannot rewrite history), `timeline_milestones`.

### Calendar — split deliberately in two
| Table | Access |
|---|---|
| `calendar_connections` | Status metadata. Readable by the owner via RLS |
| `calendar_credentials` | **OAuth tokens. RLS enabled with zero policies + grants revoked.** No client role can read a token, ever — only the service role inside route handlers |
| `calendar_event_metadata` | Start, end, `is_busy`, day. **No titles, descriptions, attendees or locations** are requested or stored |

### Conventions
- Every user-owned table carries `user_id` even when reachable through a parent — RLS
  stays a single indexed predicate instead of an `EXISTS` subquery per row.
- `source` (`user` | `seed`) distinguishes real logs from seeded/demo content.
- `updated_at` triggers on all mutable tables.

---

## Security model

- **RLS on all 29 tables**, generated in a loop so no table can be forgotten and no policy
  can drift. Policies use `(select auth.uid())` — a subselect, so Postgres evaluates it
  once per query as an InitPlan rather than once per row.
- `force row level security` so a mistake in a `SECURITY DEFINER` function cannot leak
  another user's rows.
- **Auth uses `getUser()`**, which verifies the JWT against the auth server, never
  `getSession()`, which only decodes the cookie.
- **Progress photos** live in a private bucket at `${auth.uid()}/…`; storage policies key
  on the first path segment. The app hands out 30-minute signed URLs — there is no public
  link to any photo.
- **OAuth `state`** is a random UUID in a short-lived httpOnly cookie, compared on
  callback.
- The auth callback validates `next` as a relative path, so it cannot be used as an open
  redirect.
- Sign-in errors are deliberately vague — distinguishing "no such account" from "wrong
  password" tells an attacker which addresses are registered.

---

## Setup

> **Setting this up for the first time? Follow [SETUP.md](./SETUP.md).**
> It's a step-by-step walkthrough — create the Supabase project, run and *verify* the
> migrations, configure auth, sign up, and confirm your seed data landed. About 20
> minutes. The sections below are the condensed reference version.

```bash
npm install
# edit .env.local with your Supabase values (see .env.example for the shape)
npm run dev
```

---

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Safe in the browser — RLS is the boundary |
| `SUPABASE_SERVICE_ROLE_KEY` | For calendar | Bypasses RLS. Server-only. Used **solely** for `calendar_credentials` |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Auth email redirect origin |
| `GOOGLE_CLIENT_ID` | Optional | Calendar integration hides itself if unset |
| `GOOGLE_CLIENT_SECRET` | Optional | |
| `GOOGLE_REDIRECT_URI` | Optional | `{origin}/api/calendar/google/callback` |

`lib/env.ts` validates these with Zod and fails loudly with a readable message rather than
producing a confusing runtime error.

---

## Supabase setup

1. **Create a project** at [supabase.com](https://supabase.com).

2. **Run the migrations**, in order. Either with the CLI:

   ```bash
   npx supabase link --project-ref <your-ref>
   npx supabase db push
   ```

   …or by pasting each file into the SQL editor in this order:

   ```
   supabase/migrations/20260101000000_init_schema.sql     # tables, enums, triggers
   supabase/migrations/20260101000100_rls.sql             # RLS + storage bucket & policies
   supabase/migrations/20260101000200_seed_defaults.sql   # per-user defaults + signup trigger
   ```

3. **Auth settings** → *Authentication → URL Configuration*:
   - Site URL: `http://localhost:3000` (your deployed origin in production)
   - Redirect URLs: add `http://localhost:3000/auth/callback`

   Email confirmation can be left on or off. With it on, signup shows a "check your
   inbox" state; the callback route handles the exchange either way.

4. **Storage** — the `progress-photos` bucket and its four policies are created by the RLS
   migration. Nothing to do manually.

5. **Regenerate types** after any schema change:

   ```bash
   npx supabase gen types typescript --project-id <ref> --schema public \
     > src/lib/db/database.types.ts
   ```

   The hand-maintained file is written in the CLI's exact output shape, so this overwrites
   it cleanly with no import changes.

6. **Optional demo data** (development only):

   ```sql
   -- paste supabase/seed/dev_seed.sql first, then:
   select public.seed_demo_history('<your-auth-user-id>');
   ```

   It generates twelve weeks of plausible history — weigh-ins, habits, workouts with
   creeping loads, skincare — all stamped `source = 'seed'`. Undo with
   `select public.clear_demo_history('<id>');`.

### What happens on signup

The `on_auth_user_created` trigger runs `handle_new_user()`, which creates a profile and
settings row, then calls `seed_user_defaults()` to create: 10 habits, the Weight Gain
Shake recipe, 16 exercises, Workouts A/B/C, AM and PM skincare routines with 6 products,
the office gym config (women's hours to 3 PM), and the weight goal with its milestone
ladder. The function is idempotent — it returns immediately if habits already exist.

Onboarding then *adjusts* that content. It never re-seeds.

---

## Google Calendar setup

The integration is entirely optional. Without credentials the UI shows "not configured"
and every other feature works unchanged.

1. [Google Cloud Console](https://console.cloud.google.com/) → create or select a project.
2. **APIs & Services → Library** → enable **Google Calendar API**.
3. **OAuth consent screen** → External → add your email as a test user. Add scopes:
   - `https://www.googleapis.com/auth/calendar.freebusy`
   - `https://www.googleapis.com/auth/userinfo.email`
4. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorised redirect URI: `http://localhost:3000/api/calendar/google/callback`
     (add your production URL too)
5. Copy the client ID and secret into `.env.local`.

### Why `calendar.freebusy` and nothing more

It is the narrowest Calendar scope Google offers, and it grants exactly one capability:
asking *"is this person busy between X and Y"*. Event titles, descriptions, attendees,
locations and even calendar names are unreadable with it — not by this app, and not by
anything that steals the token. `userinfo.email` is requested only so the settings screen
can show which account is connected.

The app caches **14 days** of busy blocks — the horizon the planner and weekly view
actually use. Disconnecting revokes the token at Google and deletes every cached block;
if Google is unreachable, local deletion still happens, because *disconnect must always
disconnect*.

---

## Local development

```bash
npm run dev         # dev server on :3000
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run format      # prettier
npm run db:types    # regenerate DB types (needs SUPABASE_PROJECT_ID + linked CLI)
```

---

## Deployment

**Vercel** is the path of least resistance:

1. Push to a Git remote and import the repo.
2. Add every environment variable from the table above. Set `NEXT_PUBLIC_SITE_URL` to the
   production origin.
3. Add `https://<your-domain>/auth/callback` to Supabase → Auth → Redirect URLs.
4. Add `https://<your-domain>/api/calendar/google/callback` to the Google OAuth client and
   set `GOOGLE_REDIRECT_URI` to match.
5. Deploy.

Any Node host works — nothing depends on Vercel-specific APIs. All pages are
`force-dynamic` because every read is user-scoped and time-sensitive, so there is nothing
to prerender or revalidate on a timer.

---

## Known limitations

Stated plainly, because these are real:

1. **Reminders are client-side only.** They use the browser `Notification` API and fire
   only while a tab is open. Real background delivery needs Web Push (VAPID keys, a
   service worker, and a scheduled function). `lib/domain/reminders.ts` already contains
   the full eligibility logic, so the delivery mechanism is the only missing piece.

2. **Calendar sync is pull-only and manual/on-connect.** There is no webhook or cron; the
   cache refreshes when you connect or press Refresh. Google's push notification channels
   would fix this.

3. **Apple and Outlook are interface-only.** `CalendarProvider` is implemented for Google
   alone. The registry lists the other two as unavailable.

4. **Nutrition values are approximations** by design, from per-ingredient reference
   figures. Every surface that shows a calorie or protein number says so. Brands vary
   considerably and all values are editable.

5. **Images are not processed on upload.** A 10 MB HEIC is stored as-is. Client-side
   resizing before upload would be a clear win.

6. **`getLastSetsForExercise` runs one query per exercise** in a session (typically 5–7).
   Fine at this scale; would want batching if sessions grew much larger.

7. **No automated tests.** The domain layer is pure and was written to be testable —
   `planner`, `weight`, `habits`, `workout` and `reminders` are the obvious first targets —
   but no suite exists yet. Verification so far is `tsc --noEmit` clean, a clean production
   build, and a manual smoke test of routing and auth gating.

8. **`exactOptionalPropertyTypes` is off.** Turning it on would be a worthwhile tightening
   pass but touches a lot of optional props.

9. **The project sits inside a OneDrive folder**, and the enclosing Git repository is
   rooted at `C:\Users\minah` rather than this directory. Neither affects the app, but
   OneDrive can be slow with `node_modules`, and you may want a dedicated repo here.

10. **Charts render client-side**, adding Recharts to the bundle on chart-bearing routes.
    Acceptable for an authenticated personal app; server-rendered SVG would be leaner.

---

## Future improvements

Roughly in order of value:

1. **Web Push reminders** — service worker + VAPID + a Supabase scheduled function, reusing
   the existing `nextReminder()` rules.
2. **A test suite for `lib/domain`** — pure functions, no mocking needed. Start with trend
   smoothing, streak edge cases and gym-window boundaries.
3. **Google Calendar push notifications** so busy blocks stay fresh without a manual
   refresh.
4. **Outlook (Graph)** provider behind the existing interface.
5. **Client-side image compression** before upload.
6. **Template editing in the UI** — templates are seeded and usable but not yet editable
   (exercises can be added to any session ad hoc).
7. **Data export** — a JSON or CSV dump of everything, which for a personal health tracker
   is close to a moral obligation.
8. **Offline support** via a service worker, so habits can be ticked on a commute with no
   signal and synced later.
9. **Body measurements** (arms, waist, hips) as a first-class tracked series alongside
   weight — a natural fit for the stated physique goals, and more informative than weight
   alone.
10. **Rest timer** in the session logger.

---

## Health & safety posture

GlowUp tracks habits and progress. It does not diagnose, treat, or give medical advice,
and the code is written to keep it that way:

- No calorie or macro targets are ever prescribed.
- No countdown to a goal weight, and no predicted date — `NO_COUNTDOWN_NOTE` appears
  wherever a goal is shown.
- A flat trend produces a neutral suggestion to review food intake, nothing more.
- A **sustained downward trend against a gain goal** surfaces one neutral line pointing at
  a doctor or dietitian — it does not interpret, explain, or speculate.
- Skin conditions are recorded and counted, never correlated with products or explained.
- Progress photos are stored and shown back. Nothing analyses, describes or scores them.
>>>>>>> 31b5aac (first deploy)
