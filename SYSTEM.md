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

**Repository published.** `https://github.com/Jayronj0616/Lapse` — public, branch `main`, initial commit `c9d0523` covering all 63 files of Phase 1.

Two notes for anyone picking this up:

- `.gitignore` carries an explicit `!.env.example` negation, because `create-next-app` ships a blanket `.env*` rule that would otherwise swallow the one env file a public repo actually needs.
- The GitHub repository description and topics are set through the GitHub UI, not from this repo, so they are not version-controlled and will not appear in any diff.

Phase 1 is complete and pushed. The only unverified path is the end-to-end sign-up → create organization → dashboard run, which needs a real account and password.

**Phase 2 (manual tracker) built — migration written, not yet applied.**

The system is now a working expiry tracker with no model involved at all: subjects, document upload with typed-in dates, a document list sorted by expiry, a detail view, an exceptions dashboard grouped by urgency, and an audit log. Eleven routes, build clean.

Migration `0002` adds the `subject_kind`, `document_type` and `document_status` enums; the `subjects` and `documents` tables; the private `documents` storage bucket; and `audit_log`.

Decisions worth not re-litigating:

- **Audit is written by triggers, not by services.** `record_audit()` fires on `documents` and `subjects` and stamps `auth.uid()`. A service that has to remember to log will eventually forget, and a log with gaps is worse than no log — it implies that a missing row means nothing happened. `audit_log` has a read policy and no insert policy at all; the `SECURITY DEFINER` trigger does not need one, so rows cannot be forged from the app.
- **`audit_log` moved from migration `0005` into `0002`**, because Phase 2 writes audit rows. `SCHEMA.md` updated.
- **Storage isolation rides on the object path.** Keys are `{organization_id}/{uuid}.{ext}` and the `storage.objects` policies check that first segment. The path format is load-bearing, not cosmetic.
- **Dates never touch local time.** `lib/utils/dates.ts` works in UTC calendar days throughout. A document expiring on the 30th reading as the 29th is the difference between "renew today" and "you are already operating illegally", and that class of bug comes entirely from letting a timezone offset into date-only math.
- **`expiring` is a stored status, not a derived one**, so the dashboard and the document list cannot disagree about what counts as expiring. `statusFromExpiry` and `toneFor` in `lib/utils/status.ts` are the only places that decide, and `StatusBadge` is the only component that maps a status to a color.
- **Native `<select>` rather than shadcn's Radix Select.** The Radix one is client-only and does not post in a plain form action without a hidden-input workaround. Not worth the machinery for three static option lists.
- **The audit nav link is hidden from staff.** RLS would return them an empty list anyway; a link to a page that is empty by policy is a dead end, not a feature.

Also: `documents` carries a CHECK constraint rejecting an expiry before its issue date. That is a data error whether a person typed it or a model hallucinated it, so it is refused at the source rather than caught in two places later.

**Blocked, and not on us:** `supabase db push` fails with a 403 from the management API's "Initialising login role" step for both Jayron and this session — his access token lacks privileges on that endpoint. The same account-level problem blocks `supabase gen types`. Workaround is to push straight at the database with `--db-url` using the connection URI from the dashboard, which skips the management call entirely.

---

## Applying migrations — the CLI is blocked, use the SQL Editor

**All migrations through `0004` are applied** as of 2026-09-17. This section stays because the underlying problem has not gone away and the next migration will hit it too.

`supabase db push` is blocked by a 403 from the management API's "Initialising login role" step — an account-level permission problem, not a local one; it fails identically for Jayron and for Claude. The same problem blocks `supabase gen types`. The direct database host `db.<ref>.supabase.co` is IPv6-only and unreachable from Jayron's network, so `--db-url` against it also fails.

**The procedure for any new migration:** open the Supabase dashboard → SQL Editor, paste the file's *entire* contents, Run, confirm green. A partial paste fails on the first `create type`. Then register it so the CLI does not try to re-apply it later:

```sql
insert into supabase_migrations.schema_migrations (version, name)
values ('000N', 'migration_name_without_prefix');
```

**To verify** without the CLI — this uses only the REST API and the secret key:

```bash
for T in subjects documents audit_log extractions document_reviews reminders notifications job_runs; do
  curl -s -o /dev/null -w "$T %{http_code}\n" \
    "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/$T?select=id&limit=1" \
    -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
done
```

`200` means the table exists; `404` means that migration did not land. This is the only verification path available while the CLI is broken, and it needs nothing but the secret key.

**Still worth fixing properly:** the CLI's 403. Until it is resolved, every migration is a manual paste and `types.ts` stays hand-maintained.

---

**Phases 3 and 4 built — extraction and the review queue.**

Migration `0003` adds `extraction_status` and `review_action`, the `extractions` and `document_reviews` tables, and the `can_edit_document()` helper.

Upload now has exactly two paths, and deliberately no third:

- **An expiry date typed by the uploader is authoritative.** The document is tracked immediately and no model is consulted, because there is nothing to work out.
- **Left blank**, the document goes to `processing`, an Inngest event fires, and the model reads it. No path exists where a model second-guesses a value a person entered.

Decisions worth not re-litigating:

- **The gate fails toward the review queue, always.** A document queued unnecessarily costs someone ten seconds; a bad expiry waved through costs a fine. It refuses on low confidence, a missing expiry, an expiry before issue, an implausible year, or a document type that disagrees with what the uploader filed it as.
- **Extracted values are written to the document even when the gate refuses.** The reviewer needs to see what the model read in order to judge it. What stops an unreviewed value being acted upon is the `needs_review` status, not the absence of the value.
- **`extractions` keeps one row per attempt, including failures.** That is what makes "how often is this provider wrong, and on what" answerable later. A table holding only the winning attempt would make the review queue look like unexplained busywork.
- **The review queue is ordered oldest first, not by confidence.** Sorting by confidence produces a queue where the least certain documents are never reached.
- **`approved` versus `corrected` is derived by comparing to what is stored**, not from which button was pressed. Asking a reviewer to also classify their own action would only add a way for the record to be wrong.
- **Reviewing takes the same authority as editing the document** — owner, manager, or the responsible user. The first draft of `0003` let any member insert a review they would then have been unable to apply; `can_edit_document()` aligns the two.
- **Providers are called with `fetch`, not an SDK.** The surface is small, Inngest already owns retries, and one fewer dependency is one fewer breaking change on a provider we fully expect to swap.
- **The extraction prompt states that null is an acceptable answer**, and anchors each confidence band. Without the first, models invent dates; without the second, everything comes back 0.95.
- **Azure Foundry rejects PDFs up front** rather than half-processing them — the vision chat API takes images only. A silent failure on one file type is far more confusing than an explicit one.

Framework notes for whoever picks this up:

- **Inngest v4 changed `createFunction` to two arguments**, with `triggers: [{ event }]` inside the options object rather than v3's three-argument form.
- **`EventSchemas` no longer exists in v4.** Rather than guess at its replacement, `lib/jobs/client.ts` exports an `eventData()` helper that narrows a payload at the handler boundary. The event contract still lives in one file; it is enforced one layer later. Worth revisiting once the v4 schema API is confirmed from the docs.

Not built yet: Phase 5 (the daily sweep, reminders, `job_runs` heartbeat, email) and Phase 6 (the dashboard's stale-heartbeat exception). `extraction.service.ts` was never created — the logic lives in the job, which is its only caller, and a service wrapping a single job step would have been indirection for its own sake.

---

**Phase 5 built — the daily sweep, reminders, and the heartbeat.**

This is the phase that makes the system do useful work with nobody logged in. Migration `0004` adds `reminder_tier`, `reminder_channel` and `job_status`; the `reminders`, `notifications` and `job_runs` tables; and the `acknowledge_reminder()` function.

The sweep, in order: open a `job_runs` row, recompute document statuses across the `expiring` boundary, re-enqueue stalled extractions, create the reminders that have come due, deliver them by email and in-app, escalate anything unacknowledged, then close the run.

Decisions worth not re-litigating:

- **The `job_runs` row is written before the work, not after.** That guarantees a database write every day, which is what stops Supabase pausing this free-tier project. An "exit early if there is nothing to do" optimisation would break the keepalive on exactly the quiet weeks where it matters most. Writing first also means a crash leaves a row stuck in `running`, which the dashboard detects — writing only on success would make failures invisible.
- **Two independent triggers.** Vercel Cron at 02:00 UTC and a GitHub Actions workflow at 03:30 UTC. Not caution for its own sake: this endpoint is the keepalive, so a trigger that lives on the same platform as the app would fail at the same time as the app. The sweep is idempotent, so both firing is harmless.
- **Each reminder tier fires exactly once, including `overdue`.** A departure from the original "daily once expired" plan — an expired document already sits permanently in the dashboard's Expired group, and a daily email about it only teaches people to filter the sender. The sweep emits only the most urgent tier that currently applies, so a document filed three days before expiry gets one notice, not the whole ladder.
- **The heartbeat is itself an exception on the dashboard.** If the sweep stops running, nothing else on that page looks wrong — it just quietly stops changing, which reads as "all clear". A deadline-watcher that has silently died is the worst failure this system has, so it is surfaced in the same place as the deadlines.
- **Acknowledgement goes through a `SECURITY DEFINER` function, not an UPDATE policy.** A policy permissive enough to let someone acknowledge would also let them rewrite `scheduled_for` or clear `escalated_at`. The `reminders` Update type in `types.ts` is narrowed to `sent_at` and `escalated_at` for the same reason — the acknowledgement columns are not reachable from application code at all.
- **Email failures never abort the sweep.** `sendEmail` returns a result rather than throwing, and a reminder is marked sent regardless. One bad address should not stop every other organization's reminders that day, and the reminder is still visible in-app and still escalates.
- **Emails are plain text.** These are operational notices, not marketing: plain text renders everywhere, avoids the promotions tab, and cannot break in a mail client.

Deployment requirements this phase introduces, none of which are in the repo:

- `CRON_SECRET`, `RESEND_API_KEY`, `REMINDER_FROM_EMAIL`, `NEXT_PUBLIC_APP_URL`, `GEMINI_API_KEY`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` in Vercel
- `APP_URL` and `CRON_SECRET` as GitHub repository secrets, for the backup workflow
- An Inngest app pointed at `/api/inngest`
- A verified sender domain in Resend

Phases 1–5 are complete in code. What remains is Phase 6 polish (seeded demo data, a members/invite flow, the org switcher that invites make meaningful) and, before any of it runs, the three pending migrations.

### 2026-09-17 — migrations 0002–0004 applied

Run by hand through the Supabase SQL Editor, since `supabase db push` is still blocked by the management-API 403. All eleven tables and the private `documents` bucket verified live via the REST check above.

The database is now fully in step with the code. The application is walkable end to end for everything that does not need a model: sign up, create an organization, add subjects, file documents with typed dates, and see them triaged on the dashboard. Extraction and reminder email remain untested — they need `GEMINI_API_KEY`, `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` and the Inngest keys.

---

**Phase 6 — invitations, roles, and the organization switcher.**

Jayron asked whether users should be able to sign up at all in a system like this. Half right, and the half that was right mattered: self-signup is correct for the *first* person at a company — without it no customer can come into existence and nobody can try the demo — but every subsequent person was also creating a brand-new organization instead of joining their employer. That was the real defect, and invitations are its fix.

Migration `0005` adds `invitations`, plus `invitation_preview()` and `accept_invitation()`, and puts `memberships` and `invitations` under the existing audit trigger so role changes and removals are recorded.

Decisions worth not re-litigating:

- **The email check inside `accept_invitation()` is the security boundary, not the token.** Without it the link alone grants membership, so a forwarded invitation — or one pasted into a group chat — would let anybody in. Requiring the signed-in address to match the invited one makes the token a second factor rather than the entire credential.
- **The invited person has no select policy on `invitations`.** They reach theirs through two `SECURITY DEFINER` functions. A read policy would mean a pending invitee could list everyone else who has been invited.
- **`invitation_preview()` is callable by anon** and returns only the organization name, the invited address, and whether the link is live. A leaked token should reveal as little as possible.
- **Invitations cannot be edited, only revoked.** There is no update policy: changing the role or address after a link has been sent would mean the recipient accepts something other than what they were shown.
- **Owner is not offered in the invite form.** Promoting someone to owner is a deliberate act on an existing member, not something done by typing an address into a box.
- **`/invite` needed its own path class in the proxy.** The old logic bounced any signed-in visitor away from public paths, which would have made it impossible to accept an invitation while already signed in. `AUTH_PATHS` now means "redirect away when signed in"; `OPEN_PATHS` means "reachable in either state".
- **Sign-up carries the token through.** Without that branch a new member lands on the organization-creation screen and ends up owning an empty duplicate of the company that just invited them.
- **The organization switcher finally exists**, and renders only when the viewer belongs to more than one. It was deliberately left unbuilt through Phases 1–5 because there was nothing to switch between; invitations are what make it real.

Also added: `scripts/seed-admin.mjs` (`pnpm seed:admin`), which creates an admin account and an organization for it to own. Every value comes from the environment — nothing is hardcoded, because this repo is public and a committed admin password is found by scrapers within hours. It uses the Admin API rather than the sign-up path so `email_confirm` can be set, which is what makes a non-deliverable address like `admin@lapse.com` usable, and it is safe to run repeatedly.

**Migration `0005` is written but not yet applied.** Same SQL Editor procedure as the others.

---

### Two runtime bugs the build could never have caught

Both surfaced within minutes of actually signing in and running the app, after five phases of clean builds. Worth recording because neither is visible to TypeScript and both would have shipped.

**1. Components cannot cross the server/client boundary.** `Sidebar` is a Server Component and was passing `icon={LayoutDashboard}` — a function — into `NavLink`, a Client Component. React refuses to serialize functions, so the whole organization layout threw at render. `NavLink` now takes `icon: React.ReactNode` and receives an already-rendered element; elements serialize, components do not. This is a serialization rule, not a type rule, which is exactly why every `pnpm build` stayed green while every authenticated page was broken.

**2. The proxy was redirecting the machine endpoints to `/login`.** The auth guard is deny-by-default, and `/api/inngest` and `/api/cron/sweep` were in neither path list. Inngest could never register its functions, so no document would ever have been extracted — and the sweep would never have run, which also means the Supabase keepalive would never have fired and the database would have paused after a week. Both endpoints authenticate themselves (Inngest by request signature, the sweep by `CRON_SECRET`), so they belong in `OPEN_PATHS`. A cron job has no way to complain about a 307 to a login page; this would have been a silent production failure.

The general lesson for this codebase: **a green build says nothing about whether a page renders.** Anything behind the auth guard needs to be loaded at least once before it is called done.

**Local development also needs `INNGEST_DEV=1`.** Without it the SDK assumes cloud mode and fails with "in cloud mode but no signing key found". It must be left unset in production, where the signing key takes over.

### Upload form: two fixes

**A blank optional date reported "Use a valid date".** Phase 3 made `expiryDate` nullable in the schema but left `document.actions.ts` reading it with `text()`, which returns `""` for an untouched input — and `""` fails the ISO regex. So leaving the field blank, the one action that is supposed to trigger extraction, was the one thing the form rejected. Now read with `emptyToNull()`, like every other optional field. The lesson is narrow and worth keeping: **when a field becomes nullable, the reader has to change too** — the schema alone does not make `""` into `null`.

**The chosen file was lost on every failed submit.** A file input's selection does not survive the re-render, and its value cannot be set declaratively — browsers forbid it so a page cannot nominate files from your disk. Re-attaching a scan every time a date is wrong is a miserable way to fill in a form, so the form now keeps the `File` in a ref and restores it through `DataTransfer`, which is the one sanctioned way to write `input.files`. Wrapped in try/catch: where a browser refuses, the field just stays empty and `required` still prevents an empty submit.

---

### First real extraction, and what it taught us

The ambiguous sample fixture was run through the pipeline on 2026-09-17. Attempt 1 failed because `gemini-2.5-flash` is no longer offered to new projects — Google's API says outright which id to use instead, and the default is now `gemini-3.6-flash`. Treat that constant as a moving target, not a fixed value.

Attempt 2 succeeded at confidence 0.85 and returned:

```json
{ "documentType": "vehicle_registration",
  "documentNumber": "CR-2O25-OO479l3",
  "issuer": "Metro Transport Registry Authority",
  "issueDate": "2025-09-11",
  "expiryDate": "2027-04-03",
  "confidence": 0.85 }
```

Two things went right. It transcribed the deliberately mangled characters faithfully — letter `O` for zero, lowercase `l` for one — rather than "helpfully" correcting them, which is the correct behaviour for transcription. And it resolved the ambiguous `03/04/27` by reading it consistently with the other date on the page, which is exactly the reasoning the prompt asks for.

**One thing went wrong, and it was the gate.** The threshold was 0.85 and the check is `confidence < threshold`, so a returned 0.85 passed by a hair and the document went straight to `active`. The model had correctly signalled hesitation and the gate ignored it.

The cause is general, not a one-off: **models do not produce a smooth distribution of confidences — they cluster hard on 0.85, 0.90 and 0.95.** A threshold sitting exactly on one of those common values means documents landing there are decided by which way the comparison is written rather than by anything about the document. The threshold is now 0.90, so only 0.90 and above pass and any expressed doubt reaches a human.

Worth keeping in mind when tuning this later: the useful question is not "what accuracy do we want" but "which of the three or four values this model actually emits should count as confident".

Also confirmed working end to end: the event fired on upload, the job ran its five steps, attempt 1's failure was recorded with its full error rather than vanishing, and attempt 2 was recorded alongside it. Keeping one row per attempt is what made this diagnosable at all.

### Document detail no longer 500s on a failed signature

`signedFileUrl()` throws, and the detail page was calling it unguarded — so any failure to sign took down the whole page rather than just the preview link. Everything else on that page (the expiry date, the status, who is responsible) is worth seeing even when the file cannot be reached, and a 500 tells the reader nothing about which part failed.

Now caught and rendered as a notice, matching how the review queue already handles the same call. Worth generalising: **anything that can fail independently of the page's main purpose should be caught at the point it is used**, not allowed to take the render down with it.

---

**A public landing page at `/`.**

Until now `/` was pure routing — signed out went to `/login`. For a product that is arguably fine; for this project it was the single worst screen in the system, because a link sent to an employer opened a bare login form with no explanation and no way in.

`/` now renders a landing page for signed-out visitors and redirects signed-in ones to their dashboard exactly as before.

Design decisions behind it:

- **Written for who actually arrives** — engineers and hiring managers following a link, not the trucking company in the example. So it explains the mechanism rather than selling an outcome. No testimonials, no metrics nobody measured, no feature grid.
- **The gate is the centrepiece.** Two records side by side, one accepted and one held for review, with the ambiguous field highlighted. Calling a model is easy; deciding when not to believe it is the work, and that is the only part worth building a page around.
- **Shown as records, not a chart.** Two numbers do not need a visualisation, and inventing a bar-and-axis grammar for them would introduce a second visual language on a page whose job is to look like the product. The chips reuse the application's own status vocabulary.
- **The flow is a numbered grid, not an arrow chain.** Seven connected nodes cannot be legible across a phone, and shrinking them to fit destroys the labels at exactly the width most visitors use. Numbering carries the sequence and survives any viewport.
- **Demo credentials render in full**, behind no reveal or modal, and only when `NEXT_PUBLIC_DEMO_EMAIL` and `NEXT_PUBLIC_DEMO_PASSWORD` are set. Anything that makes a visitor work to get into a demo loses most of them.

Two things worth carrying forward:

- **`NEXT_PUBLIC_` variables are bundled into client JavaScript.** Point the demo account at a limited role, never an owner — an owner can delete the organization, remove members and change roles, and anyone reading the page can sign in as it.
- **`/` had to be added to `OPEN_PATHS`.** The `matches()` helper is safe for `"/"` because the prefix test uses `"/" + "/"` = `"//"`, which no real path begins with, so it matches the root exactly and nothing else.

Two bugs found by loading it rather than building it, continuing the pattern: lucide v1 has dropped brand icons, so `Github` does not exist and the repo links use `CodeXml`; and the sections were siblings of `<main>` rather than inside it, which both broke "skip to main content" and gave the hero a `flex-1` box that stretched to the full viewport and pushed everything else below the fold.

---

**A seeded public demo, and a prefilled way into it.**

The landing page previously had two buttons — "Open the demo" and "Sign in" — pointing at the same place with different labels. The demo button now lands on `/login?email=...` with the address already filled, leaving only the password to paste. The header's "Sign in" stays generic; that is the entry for people who already have their own account.

Only the address is passed, never the password. A password in a query string ends up in browser history and server logs, and the demo password is one click to copy from the panel it came from.

`pnpm seed:demo` creates the account the landing page advertises, plus a fleet of five subjects and six documents landing in every dashboard state: one expired, one due in four days, one in nineteen, one in forty-four, one comfortably active, and one waiting in the review queue with its extraction attempt attached.

Three decisions in that script worth keeping:

- **The admin owns the demo organization; the demo account is only a manager.** Anyone reading the landing page can sign in as the demo user. An owner can delete the organization, remove members and change roles — a manager can do everything worth showing and none of that.
- **It resets rather than appends.** Visitors can edit and delete, so re-running restores a known state instead of stacking a second copy of the fleet. Storage objects are removed alongside the rows, so repeated runs do not accumulate orphaned files.
- **Every date is relative to today.** Hardcoded dates drift into "everything expired two years ago", which makes the dashboard look broken rather than urgent.

The review entry carries a real `extractions` row at 0.85 confidence. Without it the review screen has no confidence to display and the queue reads as arbitrary busywork rather than as the model declining to guess.

Sample PDFs moved into `scripts/fixtures/` so the seed is reproducible from a clean clone.

### A late failure could overwrite a successful extraction

Found by seeding the demo and noticing a document that had demonstrably succeeded sitting in `extraction_failed`.

`onFailure` set the status unconditionally. A run can exhaust its retries *after* a later run has already succeeded — a manually re-queued document, or the daily sweep retrying a stalled one — and the late failure then overwrote a good extraction. The document would appear to work and silently revert minutes later, which is the kind of bug nobody ever manages to reproduce on demand.

The update is now scoped with `.eq("status", "processing")`, so a late failure is a no-op against a document that has already moved on.

The general shape is worth remembering: **a background job writing a terminal state should say which state it expects to be replacing.** Retries, re-queues and a sweep that re-enqueues stalled work all mean two runs for the same document can overlap, and the last writer is not necessarily the right one.

---

## Deployment

Live at **https://lapse-chi.vercel.app** (Vercel project `lapse`, first deployed 2026-09-17).

### Environment variables

Already set on the project — none of these are secret:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://lapse-chi.vercel.app` |
| `NEXT_PUBLIC_SUPABASE_URL` | the project URL |
| `EXTRACTION_PROVIDER` | `gemini` |
| `GEMINI_MODEL` | `gemini-3.6-flash` |
| `EXTRACTION_CONFIDENCE_THRESHOLD` | `0.90` |

**All set as of 2026-09-17.** The list below records where each came from:

| Variable | Where it comes from |
|---|---|
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API Keys. Public by design, but project-specific. |
| `SUPABASE_SECRET_KEY` | Supabase → API Keys. **Rotate before entering it.** |
| `GEMINI_API_KEY` | Google AI Studio |
| `CRON_SECRET` | Any long random string. The same value goes in the GitHub secret. |
| `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY` | Inngest Cloud, after creating an app pointed at `/api/inngest` |
| `RESEND_API_KEY`, `REMINDER_FROM_EMAIL` | Resend, once a sender domain is verified. Optional — without them reminders stay in-app. |
| `NEXT_PUBLIC_DEMO_EMAIL`, `NEXT_PUBLIC_DEMO_PASSWORD` | The demo account. Bundled into client JavaScript, so treat as published. |

**`INNGEST_DEV` must NOT be set in production.** It tells the SDK to look for a local dev server. With it set, a deployed app cannot reach Inngest Cloud at all.

### Deployment Protection

New Vercel projects enable it by default, which puts the deployment behind Vercel SSO — a 302 to `vercel.com/sso-api` for anyone who is not the account owner. For a portfolio link that is fatal, and it is silent: the deploy succeeds, the URL works for you, and nobody else can see anything.

Turn it off at Project → Settings → Deployment Protection → Vercel Authentication → Disabled.

### After the first working deploy

- Point an Inngest Cloud app at `https://lapse-chi.vercel.app/api/inngest` and sync it.
- Add `APP_URL` and `CRON_SECRET` as GitHub repository secrets so `.github/workflows/keepalive.yml` can run. That workflow is the backup trigger for the sweep, and therefore the backup for the Supabase keepalive.
- Confirm the cron by calling the endpoint by hand once with the bearer token, then checking that the dashboard heartbeat turns green.

### Deployment verified — 2026-09-17

Live and working at **https://lapse-chi.vercel.app**.

Confirmed rather than assumed:

- The landing page renders publicly, demo panel included.
- `/api/cron/sweep` refuses an unauthenticated call with 401, and with the bearer token runs a full pass: `job_runs` row `succeeded` in 11s, 8 reminders created, 4 in-app notifications. The Supabase keepalive is therefore real from today.
- `/api/inngest` answers `Unauthorized` to an unsigned request, which is the signing key working — in cloud mode the endpoint verifies signatures, so a clean refusal is the success case. The earlier `internal_server_error` was the missing key.
- The demo credentials shown on the landing page were tested against Supabase's token endpoint and return a valid session.

Two things worth recording about the setup:

- **Vercel refuses to set a password-shaped value on a `NEXT_PUBLIC_` variable from the CLI**, and its dialog defaults the type to Secret, which is incompatible with the prefix — a Secret is never readable back, and Next must read this at build time to compile it into the browser bundle. It has to be Config, and a human has to confirm the exposure. A good guard.
- **The Vercel/Inngest integration is a better path than syncing by hand.** It sets both keys on the project, registers the app against `/api/inngest` itself, and avoids the ordering problem where the endpoint needs the signing key before it will accept Inngest's handshake. Scope it to the single project rather than the whole account.

Still outstanding:

- `APP_URL` and `CRON_SECRET` as GitHub repository secrets, so `.github/workflows/keepalive.yml` can act as the backup trigger.
- Resend, for reminder email. Without it the sweep reports `emailsSent: 0` and delivers in-app only, which is the intended degradation rather than a failure.
- **Extraction has never run in production.** The sweep works and the endpoint authenticates, but nothing has yet proven Inngest can execute `extract-document` against the deployed app. That is the last untested path, and it is the one the project is about.
- The demo password is currently a variant of a password used elsewhere. Change it.
