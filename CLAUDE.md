# CLAUDE.md — working rules for this repo

Read this before touching anything. Then read `SYSTEM.md` for architecture and `SCHEMA.md` for the data model. Do not guess at field names — check the schema.

---

## What this project is

Lapse: multi-tenant compliance document expiry monitoring. Organizations upload documents, a model extracts the expiry date, uncertain extractions go to a human review queue, and a daily job sends escalating reminders before things lapse. See `README.md` for the full flow.

---

## Hard rules

These are not preferences. Do not violate them and do not propose alternatives that violate them.

- **No Prisma. No ORM of any kind.** Data access is `supabase-js` only.
- **No Bootstrap.** Ever. Tailwind + shadcn/ui.
- **No hardcoded colors.** Semantic tokens only. Tailwind v4 is CSS-first — there is **no `tailwind.config.ts`**; tokens live in `app/globals.css`, in the marked "Lapse status tokens" block at the bottom (shadcn owns the top half). Read `DESIGN.md` before introducing a class.
- **The service role key never reaches the client.** It is server-only, used only in jobs and admin paths, and every such use must be deliberate.
- **App Router only.** Server Components by default; a component becomes a Client Component only when it needs interactivity, browser APIs, or hooks.
- **SQL migrations are the schema source of truth.** Never mutate the database through the dashboard and leave the repo behind. Every schema change is a numbered migration file.
- **Every tenant table has `organization_id` and an RLS policy.** A new table without both is a bug, not a follow-up.

---

## Layer responsibilities

| Layer | Job | Path |
|---|---|---|
| Page | Compose UI, call services for data | `app/**/page.tsx` |
| Server Action | Validate input with Zod, delegate to a service | `lib/actions/{module}.actions.ts` |
| Service | All business logic | `lib/services/{module}.service.ts` |
| Supabase client | Query construction only | `lib/supabase/` |
| Zod schema | Input validation, shared client and server | `lib/validations/{module}.schema.ts` |
| Inngest function | Durable multi-step background work | `lib/jobs/` |
| Component | UI only | `components/` |

**Rules that follow from the table:**

- No `supabase.from(...)` calls in components, page files, or Server Actions. Services only.
- Server Actions validate with Zod *before* calling a service. Services assume valid input.
- Services return data or throw. They do not redirect, do not touch `cookies()`, and do not return UI.
- Components never fetch from the database directly. Server Components call services; Client Components receive props or call Server Actions.

---

## Naming

| Thing | Convention |
|---|---|
| Service | `lib/services/{module}.service.ts` |
| Server Action | `lib/actions/{module}.actions.ts` |
| Zod schema | `lib/validations/{module}.schema.ts` |
| Component | PascalCase, `components/{module}/ComponentName.tsx` |
| Zustand store | `store/{module}.store.ts`, exported as `use{Module}Store` |
| Migration | `supabase/migrations/{NNNN}_{description}.sql` |
| Inngest function | `lib/jobs/{name}.job.ts`, function id `lapse/{name}` |

---

## Working style

- **Explanation first.** Do not write code until Jayron says to proceed. Propose a plan, wait.
- **One step at a time.** Finish and verify a step before starting the next.
- **Anything touching 3+ files gets a warning first** — ask whether to go step by step or all at once. Default to step by step.
- **Docs are part of the task, not a follow-up.** Every completed phase or task updates `SYSTEM.md`'s progress log and `STRUCTURE.md`'s status column *before* the work is reported as done. Not optional, and not something to wait to be asked for. Record the decisions and the surprises, not just the file list — the point is that a later session does not re-litigate a settled choice or rediscover the same framework quirk.
- **No summary documents** written out for Jayron after a task unless he asks. The progress log is where that goes.
- **Say when something is wrong.** If Jayron's approach conflicts with an existing pattern or one of the hard rules, say so directly rather than complying.
- **Read before writing.** Before working on an existing module, read the closest parallel implementation and match its naming, signatures, and data flow.
- **Flag unrelated problems briefly** at the end of a response, one line, and do not fix them unsolicited.

---

## Things that are easy to get wrong here

**RLS and the service role.** Background jobs run without a user session, so they use the service role client and bypass RLS entirely. That means a job is the one place where forgetting to filter by `organization_id` will actually leak data across tenants. Every query in `lib/jobs/` must scope explicitly.

**Extraction is not trusted.** Never write model output straight to `documents` as `active`. It passes through the confidence gate in the extraction service. If you find yourself bypassing that gate, stop.

**The daily sweep must always write.** Its `job_runs` row is what keeps the free-tier Supabase project from pausing. A "nothing to do, exit early" optimization that skips the write would break the keepalive. Write the row first, do the work second.

**Idempotency.** The sweep can run twice in a day (Vercel Cron plus the GitHub Actions backup). Reminder creation is keyed on `(document_id, tier)` so a second run is a no-op rather than a duplicate email.

**Dates are dates, not timestamps.** `issue_date` and `expiry_date` are `date` columns. Do not let timezone conversion shift an expiry across midnight.

---

## Definition of done

A feature is not done until:

- Input is Zod-validated at the Server Action boundary
- The query is in a service, scoped to the organization
- The table has an RLS policy covering the operation
- Sensitive mutations write an `audit_log` row
- Loading, empty, and error states exist in the UI
- `SYSTEM.md`'s progress log and `STRUCTURE.md`'s status column are updated
