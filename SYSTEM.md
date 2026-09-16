# SYSTEM.md — architecture reference and progress log

Companion to `README.md` (what it is), `SCHEMA.md` (the data), and `CLAUDE.md` (how to work on it). This file covers how the pieces fit and what has actually been built.

---

## Global status

**Planning.** No application code exists yet. Documentation set complete; next step is scaffolding.

---

## Architecture

### Request paths

There are three distinct ways work enters the system, and they have different trust and timing characteristics.

**1. User request (the ordinary path)**

```
Server Component ──> service ──> supabase (publishable key, RLS enforced)
Client Component ──> Server Action ──> Zod ──> service ──> supabase
```

The publishable key is used with the user's session, so RLS is active. A bug in a service can't cross tenants.

**2. Background job (extraction)**

```
upload Server Action ──> inngest.send("lapse/document.uploaded")
                                    │
Inngest ──> extraction job ──┬── download file from Storage
                             ├── call extraction provider
                             ├── write extractions row
                             └── gate ──> documents.status = active | needs_review
```

Runs with the service role client. **RLS is bypassed here**, so every query must scope `organization_id` explicitly. Inngest owns retries and step durability; a provider timeout doesn't lose the upload.

**3. Scheduled sweep**

```
Vercel Cron (daily) ─┐
                     ├──> POST /api/cron/sweep (checks CRON_SECRET)
GitHub Actions ──────┘            │
                                  ├── write job_runs row (status=running)  ← always, first
                                  ├── recompute document statuses
                                  ├── insert due reminders (idempotent on document_id+tier+channel)
                                  ├── send email via Resend, insert notifications
                                  ├── escalate unacknowledged t7 reminders to owner
                                  ├── retry extraction_failed documents
                                  └── close job_runs row (succeeded | failed)
```

Two independent triggers because the sweep is also the keepalive — if Vercel Cron misfires, GitHub Actions still hits the endpoint and the Supabase project stays awake.

### The extraction provider interface

Model calls sit behind one small interface so the provider is swappable by environment variable:

```
lib/extraction/
  provider.ts   ← interface + selector, reads EXTRACTION_PROVIDER
  gemini.ts     ← deployed default, free tier
  foundry.ts    ← Azure AI Foundry, for local dev and bulk testing
  prompt.ts     ← the extraction prompt and expected output shape
  gate.ts       ← confidence threshold and date-sanity checks
```

Services and jobs import only `provider.ts`. Nothing else in the codebase knows which model is running.

**The gate** is the part worth caring about. It fails a document into `needs_review` when any of these hold:
- reported confidence below threshold (starting at 0.85, tunable)
- no parsable expiry date
- expiry date before issue date, or more than 20 years out
- document type disagrees with the type the uploader selected

### Layers

See `CLAUDE.md` for the enforced table. Summary: pages and Server Actions delegate to services; services own all logic and are the only place `supabase.from()` appears; jobs are services with a different client and no user session.

---

## Build order

Each phase should leave the app deployable.

**Phase 1 — Foundation**
Scaffold Next.js + Tailwind + shadcn. Supabase project, initial migration (organizations, profiles, memberships), RLS helpers, auth pages, org creation, org switcher. *Done when a user can sign up, create an org, and see an empty dashboard.*

**Phase 2 — Documents without intelligence**
Subjects CRUD. Document upload to Storage. Manual entry of expiry fields. Document list and detail. Audit log writes. *Done when the system is a working manual tracker — useful even with no model involved.*

**Phase 3 — Extraction**
Provider interface, prompt, gate. Inngest wiring. `extractions` table. Status flows to `active` or `needs_review`. *Done when an upload populates its own fields.*

**Phase 4 — Review queue**
Review screen: source document beside extracted fields. Approve / correct / reject. `document_reviews` writes. *Done when a human can fix what the model got wrong, and the correction is recorded.*

**Phase 5 — The sweep**
`job_runs`, status recomputation, reminder ladder, Resend email, in-app notifications, acknowledgment, escalation. Vercel Cron + GitHub Actions backup. *Done when the system does useful work with nobody logged in.*

**Phase 6 — Exceptions dashboard**
One screen: expiring, expired, awaiting review, extraction failed, unacknowledged reminders, stale heartbeat. *Done when the dashboard answers "what needs a human right now" without scrolling.*

**Phase 7 — Polish for demo**
Seeded demo org with realistic fleet data, empty states, deploy, public demo login.

---

## Decisions made, and why

**Supabase client over an ORM.** Tenant isolation is the point of this system, and RLS only works if queries run as the user. An ORM connecting with a privileged role would bypass the mechanism worth demonstrating.

**Inngest for extraction, Vercel Cron for the sweep.** Extraction is multi-step, slow, and fails in ways that need retrying — that's a job runner's job. The sweep is a single daily pass and doesn't need the machinery.

**Confidence gating rather than accuracy chasing.** A better prompt reduces errors; it doesn't eliminate them. The design assumption is that the model will be wrong sometimes and the system must handle that gracefully.

**`job_runs` written before work, not after.** If the sweep crashes, the row still exists with `status=running` and a stale `finished_at` — which is detectable. Writing only on success would make failures invisible.

**Escalation to the org owner, not a manager chain.** A configurable chain is a feature nobody asked for yet. One level of escalation covers the real case.

---

## Known gaps — not bugs, just unbuilt

- Email-in intake (forward a document to an address). Deferred from v1; upload only for now.
- Renewal history — replacing an expired document currently means uploading a new one with no link to the old.
- Bulk upload.
- Only three document types. Adding a fourth needs an enum migration.
- No per-document custom reminder schedules; the 60/30/7/1 ladder is global.
- Vercel Hobby cron runs roughly once daily within a loose window, not at an exact time. Fine for a daily sweep; would need Pro or a move to GitHub Actions for anything hourly. **Verify current Hobby limits before relying on this.**

---

## Progress log

Newest first. Append an entry per working session.

### 2026-09-16 — Project defined, documentation set written
Chose the concept (compliance document expiry monitoring) as a standalone project rather than an extension of the trucking system. Settled the stack: Next.js on Vercel, Supabase with the JS client and RLS, explicitly no Prisma. Three document types for v1: vehicle registration, insurance policy, driver's license. Upload-only intake. Roles `owner / manager / staff`. Reminder ladder at 60/30/7/1 days then daily overdue, email plus in-app, escalating to the org owner when a 7-day notice goes unacknowledged.

Decided extraction sits behind a provider interface — Gemini free tier for the deployed demo, Azure AI Foundry as a local/bulk swap — so no personal spend is required and the deployment doesn't depend on employer-provided credits.

Wrote `README.md`, `CLAUDE.md`, `SCHEMA.md`, `SYSTEM.md`, `STRUCTURE.md`, `DESIGN.md`. No code yet.

**Chunk A (scaffold) complete.** Next.js 16.3.5 / React 19.2.8 / Tailwind v4 / TypeScript 5.9, App Router, no `src/`. Installed `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `lucide-react`, `date-fns`. shadcn initialized (base-nova style, neutral base, RSC on).

Two things the scaffold forced that the docs did not anticipate:

- **Tailwind v4 is CSS-first — there is no `tailwind.config.ts`.** All tokens live in `app/globals.css`. shadcn owns the top of that file; the Lapse status tokens are appended in a clearly marked block at the bottom so a shadcn regeneration cannot clobber them. A token only becomes a utility class once it is mapped inside `@theme inline`. `DESIGN.md` and `CLAUDE.md` were corrected.
- **`create-next-app`'s `.gitignore` ignores `.env*`, which swallows `.env.example`.** Added a `!.env.example` negation — the repo is public and is useless to anyone without it.

Next 16 also ships an `AGENTS.md` telling agents to read `node_modules/next/dist/docs/` before writing code, and introduces global route types such as `LayoutProps<"/">`, which the root layout uses.

`pnpm build` passes clean. Nothing committed yet.

**Chunk B (database foundation) complete — written, not yet applied.**

`supabase/migrations/0001_orgs_and_auth.sql` creates the `member_role` enum; the `organizations`, `profiles` and `memberships` tables; the RLS helper functions; the `auth.users → profiles` trigger; and all policies.

Four decisions in that migration worth not re-litigating later:

- **The RLS helpers are `SECURITY DEFINER` for a reason.** A policy on `memberships` that queries `memberships` recurses infinitely under RLS. `SECURITY DEFINER` runs the inner query as the function owner, skipping RLS and breaking the cycle. `search_path` is pinned on every one of them so a caller cannot shadow `memberships` with their own table and escalate.
- **`organizations` has no INSERT policy.** Creating an org is two inserts that must both land — the org, and the membership making the creator its owner. Allowing it client-side would need a `memberships` INSERT policy permissive enough for someone who is not yet a member. Instead, `create_organization()` is the only way in.
- **`profiles` has no INSERT policy** either; the `handle_new_user` trigger owns that table. If a client cannot write a row, a client bug cannot forge one.
- **A `guard_last_owner` trigger** blocks the last owner of an organization from being demoted or removed, which would otherwise leave an org nobody can administer.

Supabase client modules are in place: `client.ts` (browser, RLS enforced), `server.ts` (RSC/Actions, async `cookies()` per Next 16, RLS enforced), `admin.ts` (secret key, `server-only`, bypasses RLS), and `env.ts`, which throws at call time rather than import time so `next build` fails with a clear runtime error instead of a confusing build one.

The project uses Supabase's **new key format** (`sb_publishable_` / `sb_secret_`), not the legacy `anon` / `service_role` JWTs. Docs and `.env.example` renamed to match.

Supabase CLI added as a dev dependency and `supabase init` run. `pnpm build` passes.

**Chunk C (auth and app shell) complete.** Migration `0001` applied to the remote project with `supabase db push`.

Built: the proxy guard, sign-in and sign-up, organization creation, the `[orgSlug]` shell with sidebar, and an empty dashboard. Verified in the browser — an unauthenticated request to `/` redirects to `/login`, and both auth screens render.

Four things worth recording, because they were not obvious going in:

- **Next 16 renamed the `middleware` convention to `proxy`.** The behaviour is identical and one file per project is still the rule. `middleware.ts` became `proxy.ts` exporting `proxy`, and `lib/supabase/middleware.ts` became `lib/supabase/session.ts`, which is a better name for what it does anyway.
- **`supabase gen types typescript --linked` fails on this project** with a management-API privilege error, so `lib/supabase/types.ts` is hand-maintained against the migration for now. It must be updated alongside every migration — a type that has drifted is worse than no type, because it lies confidently. Replace it with generated output as soon as that endpoint works.
- **This shadcn style's `Button` has no `asChild`.** Links that should look like buttons use `buttonVariants({ ... })` on the `Link` instead of nesting one inside the other.
- **The organization list needs no `.eq()`.** The RLS policy on `organizations` is `is_member_of(id)`, so an unqualified select already returns exactly the caller's organizations. A redundant filter there would teach the next reader that the filter is what protects the data, when it is not.

**Deliberately not built yet**, though both were in the chunk C sketch:

- **The org switcher.** A user can currently belong to exactly one organization, because invites do not exist. A switcher with nothing to switch to is dead UI. It lands with member invites.
- **An upload button on the dashboard empty state.** Upload arrives in Phase 2; a button that goes nowhere is worse than no button.

The sidebar lists one destination for the same reason. Links get added as their routes land.

**Phase 1 is functionally complete pending one manual check**: signing up, creating an organization, and landing on the dashboard. That path needs an account and a password, so it is Jayron's to run.

If Supabase's email-confirmation setting is on (the default), sign-up returns no session and the form shows a "check your inbox" state rather than redirecting. Turning confirmation off in Auth settings makes local testing quicker; it should be on again before anything is deployed.
