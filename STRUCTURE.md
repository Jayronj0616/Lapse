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
│   │       ├── review/page.tsx               —   the needs_review queue
│   │       ├── subjects/page.tsx             —   vehicles and people
│   │       ├── audit/page.tsx                OK  trigger-written log, owner/manager only
│   │       └── settings/                     —   org settings, members
│   └── api/
│       ├── cron/sweep/route.ts               —   daily sweep, checks CRON_SECRET
│       └── inngest/route.ts                  —   Inngest handler
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
│   ├── review/                               —   ReviewQueue, ExtractionCompare, FieldCorrection
│   └── dashboard/
│       ├── ExceptionGroup.tsx                OK  renders nothing when empty
│       └── HeartbeatIndicator.tsx            —   Phase 5
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
│   │   ├── membership.service.ts             —
│   │   ├── subject.service.ts                OK  list, get, create
│   │   ├── document.service.ts               OK  list, get, create, signed URLs
│   │   ├── extraction.service.ts             —   provider call + gate
│   │   ├── review.service.ts                 —
│   │   ├── reminder.service.ts               —   ladder, escalation
│   │   ├── notification.service.ts           —
│   │   └── audit.service.ts                  OK  read-only by design
│   ├── actions/
│   │   ├── form-state.ts                     OK  shared FormState, kept out of "use server" files
│   │   ├── form-data.ts                      OK  FormData "" → null, so blank means unknown
│   │   ├── auth.actions.ts                   OK
│   │   ├── organization.actions.ts           OK
│   │   ├── document.actions.ts               OK
│   │   ├── subject.actions.ts                OK
│   │   ├── review.actions.ts                 —
│   │   └── reminder.actions.ts               —   acknowledge
│   ├── validations/
│   │   ├── auth.schema.ts                    OK
│   │   ├── organization.schema.ts            OK
│   │   ├── document.schema.ts                OK  incl. file size and MIME rules
│   │   ├── subject.schema.ts                 OK
│   │   ├── extraction.schema.ts              —   expected model output shape
│   │   └── review.schema.ts                  —
│   ├── extraction/
│   │   ├── provider.ts                       —   interface + env selector
│   │   ├── gemini.ts                         —   deployed default
│   │   ├── foundry.ts                        —   local/bulk
│   │   ├── prompt.ts                         —
│   │   └── gate.ts                           —   confidence + date sanity
│   ├── jobs/
│   │   ├── client.ts                         —   Inngest client
│   │   ├── extract-document.job.ts           —   lapse/document.uploaded
│   │   └── sweep.ts                          —   called by the cron route
│   ├── email/                                —   resend.ts + templates
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
│       ├── 0003_extractions_and_reviews.sql  —
│       ├── 0004_reminders_and_notifications.sql —
│       └── 0005_audit_and_jobs.sql           —
│
├── .github/workflows/keepalive.yml           —   backup sweep trigger
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
