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
