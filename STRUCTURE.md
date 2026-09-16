# STRUCTURE.md — directory tree and build status

Status legend: **`—`** not started · **`WIP`** in progress · **`OK`** built and working

Update the status column in the same session the work happens. A stale tree is worse than no tree.

---

```
lapse/
├── proxy.ts                                  OK  session refresh + deny-by-default auth guard
│                                                 (Next 16 renamed `middleware` to `proxy`)
├── app/
│   ├── layout.tsx                            OK  root: Poppins, Geist Mono, metadata template
│   ├── globals.css                           OK  shadcn base + Lapse status tokens
│   ├── page.tsx                              OK  routes a signed-in user to their org, or onboarding
│   ├── new-organization/page.tsx             OK  onboarding; bounces out if they already have one
│   ├── (auth)/
│   │   ├── layout.tsx                        OK  centered, no app chrome
│   │   ├── login/page.tsx                    OK  honours ?next=
│   │   └── signup/page.tsx                   OK  handles the email-confirmation branch
│   ├── (app)/
│   │   └── [orgSlug]/
│   │       ├── layout.tsx                    OK  membership guard, sidebar, mobile bar
│   │       ├── dashboard/page.tsx            OK  exception groups by expiry window
│   │       ├── documents/                    OK  list, upload, detail
│   │       ├── review/page.tsx               OK  the needs_review queue
│   │       ├── subjects/page.tsx             —   vehicles and people
│   │       ├── audit/page.tsx                OK  trigger-written log, owner/manager only
│   │       ├── notifications/page.tsx        OK  your reminders, acknowledge here
│   │       └── settings/                     —   org settings, members
│   └── api/
│       ├── cron/sweep/route.ts               OK  daily sweep, checks CRON_SECRET
│       └── inngest/route.ts                  OK  serve(), signature-verified
│
├── components/
│   ├── ui/                                   WIP shadcn primitives, unmodified
│   │                                             (button, input, label, card, sonner)
│   ├── auth/
│   │   ├── LoginForm.tsx                     OK  client, useActionState
│   │   └── SignUpForm.tsx                    OK  client, useActionState
│   ├── organizations/
│   │   └── CreateOrganizationForm.tsx        OK  client, useActionState
│   ├── layout/
│   │   ├── Sidebar.tsx                       OK  desktop; only links to routes that exist
│   │   ├── MobileTopBar.tsx                  OK  under md, until there is more to tab between
│   │   └── NavLink.tsx                       OK  client leaf, active state only
│   ├── documents/
│   │   ├── StatusBadge.tsx                   OK  SOLE owner of status→color mapping
│   │   └── UploadDocumentForm.tsx            OK  client; native selects so a plain form posts
│   ├── subjects/
│   │   └── CreateSubjectForm.tsx             OK  client; resets itself after a successful add
│   ├── review/
│   │   └── ReviewCard.tsx                    OK  source beside fields, approve or reject
│   └── dashboard/
│       ├── ExceptionGroup.tsx                OK  renders nothing when empty
│       └── HeartbeatIndicator.tsx            OK  the system noticing its own silence
│
├── lib/
│   ├── supabase/
│   │   ├── env.ts                            OK  throws at call time, not import time
│   │   ├── client.ts                         OK  browser, publishable key, RLS enforced
│   │   ├── server.ts                         OK  RSC/Actions, session, RLS enforced
│   │   ├── session.ts                        OK  used by proxy.ts; the only place cookies are written
│   │   ├── admin.ts                          OK  secret key, SERVER ONLY, bypasses RLS
│   │   └── types.ts                          WIP hand-maintained — CLI gen types is blocked
│   ├── services/
│   │   ├── auth.service.ts                   OK  sign in/up/out, requireUser
│   │   ├── organization.service.ts           OK  listMine, getBySlug, roleIn, create
│   │   ├── membership.service.ts             —   invites, not yet built
│   │   ├── subject.service.ts                OK  list, get, create
│   │   ├── document.service.ts               OK  list, get, create, signed URLs
│   │   ├── extraction.service.ts             —   folded into the job; no separate service
│   │   ├── review.service.ts                 OK  listPending, countPending, submit, reject
│   │   ├── reminder.service.ts               —   folded into lib/jobs/sweep.ts
│   │   ├── notification.service.ts           OK  list, countUnread, markRead, acknowledge
│   │   ├── audit.service.ts                  OK  read-only by design
│   │   └── job.service.ts                    OK  sweep heartbeat + staleness
│   ├── actions/
│   │   ├── form-state.ts                     OK  shared FormState, kept out of "use server" files
│   │   ├── form-data.ts                      OK  FormData "" → null, so blank means unknown
│   │   ├── auth.actions.ts                   OK
│   │   ├── organization.actions.ts           OK
│   │   ├── document.actions.ts               OK
│   │   ├── subject.actions.ts                OK
│   │   ├── review.actions.ts                 OK
│   │   └── notification.actions.ts           OK  acknowledge, mark read
│   ├── validations/
│   │   ├── auth.schema.ts                    OK
│   │   ├── organization.schema.ts            OK
│   │   ├── document.schema.ts                OK  incl. file size and MIME rules
│   │   ├── subject.schema.ts                 OK
│   │   ├── extraction.schema.ts              OK  model output shape + fence-tolerant parse
│   │   └── review.schema.ts                  OK
│   ├── extraction/
│   │   ├── provider.ts                       OK  interface + env selector
│   │   ├── gemini.ts                         OK  deployed default; fetch, no SDK
│   │   ├── foundry.ts                        OK  local/bulk; rejects PDFs explicitly
│   │   ├── prompt.ts                         OK  calibrated-confidence anchors
│   │   └── gate.ts                           OK  confidence, date sanity, type agreement
│   ├── jobs/
│   │   ├── client.ts                         OK  Inngest client + event contract
│   │   ├── extract-document.job.ts           OK  lapse/document.uploaded, 3 retries
│   │   └── sweep.ts                          OK  statuses, retries, reminders, escalation
│   ├── email/
│   │   ├── resend.ts                         OK  returns a result, never throws
│   │   └── templates.ts                      OK  plain text on purpose
│   ├── utils/
│   │   ├── slug.ts                           OK  slugify + collision suffix
│   │   ├── dates.ts                          OK  UTC calendar days, no TZ drift
│   │   └── status.ts                         OK  expiry → status, status → tone
│   └── utils.ts                              OK  shadcn's cn()
│
├── store/                                    —   Zustand, client-only state
│
├── supabase/
│   ├── config.toml                           OK  supabase init
│   └── migrations/
│       ├── 0001_orgs_and_auth.sql            OK  applied
│       ├── 0002_subjects_documents_audit.sql WIP written, not yet applied
│       ├── 0003_extractions_and_reviews.sql WIP written, not yet applied
│       ├── 0004_reminders_notifications_jobs.sql WIP written, not yet applied
│       └── 0005_audit_and_jobs.sql           —
│
├── .github/workflows/keepalive.yml           OK  backup sweep trigger, offset by 90min
├── vercel.json                               OK  Vercel Cron, 02:00 UTC daily
├── .claude/launch.json                       OK  dev server config
├── .env.example                              OK  committed on purpose
│
├── README.md                                 OK
├── CLAUDE.md                                 OK
├── SYSTEM.md                                 OK
├── SCHEMA.md                                 OK
├── STRUCTURE.md                              OK
├── DESIGN.md                                 OK
└── AGENTS.md                                 OK  written by Next itself, leave it
```

---

## Where things go — quick rules

- A new database query belongs in a **service**, never in a page or an action.
- A new mutation needs a **Zod schema** and a **Server Action**, in that order.
- A component that needs `useState` moves to `components/` with `"use client"`; it does not make its parent page a Client Component.
- Anything slow, retryable, or triggered by an event rather than a click goes in `lib/jobs/`.
- Status colors will live in `StatusBadge.tsx` only. If a second file maps a status to a color, that's a bug.
- **A nav link is added when its route exists**, not before. The sidebar lists one destination today because there is one.
