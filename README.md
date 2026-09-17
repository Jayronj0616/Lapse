# Lapse

Compliance document expiry monitoring. Organizations upload their permits, registrations, and policies; Lapse reads each document, works out when it expires, and chases the responsible person until it's renewed.

The problem it solves is unglamorous and real: companies get fined or grounded because a registration lapsed and nobody was watching a spreadsheet. Lapse replaces the spreadsheet with a system that runs on its own.

---

## The flow

```
upload  →  extract  →  gate  →  review?  →  track  →  remind  →  escalate
```

1. **Upload.** A member uploads a PDF or photo of a document and tags it to a subject (a vehicle or a person). The file goes to Supabase Storage; a `documents` row is created with status `processing`.
2. **Extract.** An Inngest job sends the file to a vision-capable model and asks for structured fields: document type, document number, issuer, issue date, expiry date — plus a self-reported confidence.
3. **Gate.** If confidence clears the threshold *and* an expiry date actually parsed, the document goes straight to `active`. Otherwise it goes to `needs_review`. Nothing uncertain is silently trusted.
4. **Review.** A human opens the review queue, sees the extracted fields next to the source document, and approves or corrects them. The correction is stored — both the before and the after — so the extraction can be judged later.
5. **Track.** Each active document has an expiry date and a responsible user.
6. **Remind.** A daily sweep recomputes every document's state and emits reminders at 60, 30, 7 and 1 days out, then once on expiry. Delivered by email and in-app. Only the most urgent tier that applies is sent, so a document filed three days before it expires gets one notice rather than the whole ladder at once.
7. **Escalate.** A 7-day reminder that goes unacknowledged escalates to the organization owner.

## Why it's built this way

Three decisions carry most of the design:

**Confidence gating, not blind trust.** A model that reads dates off a scanned permit will sometimes be wrong. The interesting engineering isn't the model call — it's the queue that catches its mistakes and the record of who corrected what.

**The daily sweep is also the heartbeat.** Every sweep writes a `job_runs` row whether or not anything expired. That guarantees database activity every day, which keeps the free-tier Supabase project from pausing. The dashboard shows when the sweep last ran, and a stale heartbeat is itself surfaced as an exception — the system monitors itself.

**Tenancy lives in the database.** Every tenant table carries `organization_id` and is protected by Row Level Security. Postgres refuses to return another organization's rows even if the application layer has a bug.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router), TypeScript strict |
| Styling | Tailwind CSS + shadcn/ui, Poppins, lucide-react |
| Database | Supabase Postgres, accessed via `supabase-js` |
| Schema source of truth | SQL migrations in `supabase/migrations/` |
| Tenant isolation | Row Level Security |
| Auth | Supabase Auth, organization-scoped via `memberships` |
| File storage | Supabase Storage (private bucket, signed URLs) |
| Extraction | Provider interface — Gemini free tier (deployed), Azure AI Foundry (local/bulk) |
| Background jobs | Inngest (extraction pipeline), Vercel Cron (daily sweep) |
| Email | Resend |
| Hosting | Vercel |

**No Prisma. No ORM. No Bootstrap.** Data access goes through the Supabase client, inside the service layer only.

---

## Running locally

```bash
pnpm install
cp .env.example .env.local   # fill in the values below
pnpm supabase db push        # applies migrations to your Supabase project
pnpm dev
```

### Environment variables

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Browser client key — subject to RLS |
| `SUPABASE_SECRET_KEY` | Server-only. Bypasses RLS. Never import into a Client Component. |
| `EXTRACTION_PROVIDER` | `gemini` or `foundry` |
| `GEMINI_API_KEY` | When provider is `gemini` |
| `AZURE_FOUNDRY_ENDPOINT` / `AZURE_FOUNDRY_API_KEY` / `AZURE_FOUNDRY_DEPLOYMENT` | When provider is `foundry` |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Job runner |
| `RESEND_API_KEY` | Reminder email |
| `CRON_SECRET` | Shared secret the sweep endpoint checks before running |

---

## Document set

| File | What it covers |
|---|---|
| `README.md` | This file — what Lapse is and how to run it |
| `WALKTHROUGH.md` | Drive the whole system end to end, screen by screen |
| `CLAUDE.md` | Working rules for Claude sessions on this repo |
| `SYSTEM.md` | Architecture reference and running progress log |
| `SCHEMA.md` | Tables, enums, and RLS policies |
| `STRUCTURE.md` | Directory tree with per-area build status |
| `DESIGN.md` | Design tokens, component conventions, status colors |

---

## Status

**Phases 1–6 built, and extraction verified against real documents.** Authentication and organizations; subjects and documents; extraction behind a swappable provider interface with a confidence gate; a human review queue; a daily sweep that sends escalating reminders and doubles as the database keepalive; and invitations with role-based access.

All migrations through `0005` are applied. The pipeline has been run end to end: upload, extract, gate, review, sweep.

Not yet deployed. What that needs: `RESEND_API_KEY` for reminder email, an Inngest app for production job runs (`INNGEST_DEV` must be unset there), and the Vercel Cron schedule in `vercel.json` with `CRON_SECRET` set.

See `SYSTEM.md` for the build order and the running progress log, and `STRUCTURE.md` for what exists file by file.
