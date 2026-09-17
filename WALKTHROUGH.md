# WALKTHROUGH.md — driving the system end to end

A path through every screen, in an order that makes sense. Each step says what to do, what you should see, and what is happening underneath — so when something looks wrong you know which layer to look at.

Follow it once and you will have exercised every feature that exists.

URLs below assume local development on port 3001 and the seeded organization `northern-freight`. Adjust if yours differ.

---

## 0. Before you start

Three things need to be running or set. Skipping any of them makes a later step fail in a way that looks like a bug.

| | |
|---|---|
| **Terminal 1** | `pnpm dev` — the app |
| **Terminal 2** | `npx inngest-cli@latest dev` — runs background jobs |
| **`.env.local`** | `GEMINI_API_KEY`, `INNGEST_DEV=1`, `CRON_SECRET` all set |

Inngest is the one people forget. Without it, step 5 leaves a document stuck on "Processing" forever and nothing tells you why.

Check it found the app: **http://localhost:8288/apps** should list `lapse` with 2 functions.

---

## 1. Sign in

**http://localhost:3001/login** → `admin@lapse.com`, password from `SEED_ADMIN_PASSWORD` in `.env.local`.

You land on the dashboard for Northern Freight.

*Underneath:* `proxy.ts` refreshes your session on every request and redirects anything unauthenticated to `/login`. The root page `/` has no UI at all — it looks up which organizations you belong to and forwards you to the first one, or to organization creation if you have none.

---

## 2. The dashboard, and the red banner

**http://localhost:3001/northern-freight/dashboard**

You should see a **red banner saying the daily check is not running.**

That is correct, not a bug. The sweep has never run, so there is no heartbeat. You will make it green in step 7.

*Why it exists:* if the daily job dies, nothing else on this page looks wrong — it just quietly stops changing, which reads as "all clear". A deadline-watcher that has silently died is the worst failure this system has, so it is surfaced next to the deadlines rather than hidden in a log.

---

## 3. Add a subject

**Subjects → ** add a vehicle, e.g. `Honda City 2016`, plate `NDQ 9807`.

A subject is the *thing a document is about* — a truck or a person. Without it the dashboard can only say "a registration expires soon" instead of naming which vehicle.

Now open **Audit log**. Your subject is already recorded there.

*Underneath:* nothing in the application code wrote that audit row. A database trigger caught the insert and stamped your user id on it. That is why the log cannot have gaps — no service can forget to log, because no service is doing the logging.

---

## 4. Path A — file a document with a date you type

**Documents → Add document.**

Attach any PDF or image, pick the subject, give it a title, and **type an expiry date about 5 days from today**.

It saves and appears in the list immediately with an orange chip reading "Expiring · in 5 days".

*Underneath:* an expiry you type is treated as authoritative. No model is consulted, because there is nothing to work out. The status is computed straight from the date. There is deliberately no third path where a model second-guesses a value a person entered.

Go back to **Dashboard** — it is now under "Expiring within 7 days".

---

## 5. Path B — let it read the document

**Documents → Add document** again. Attach `sample-registration-clean.pdf`, pick the subject, title it, and **leave Expires blank.**

It saves with status **Processing**.

Now watch **http://localhost:8288/runs** and hit refresh. You should see a run with five steps:

```
load-document → download-file → call-provider → record-attempt → apply-result
```

Within a few seconds the document picks up its expiry date, issuer and document number on its own, and moves to tracked.

*Underneath:* leaving the date blank fires an event. Inngest runs the job and checkpoints each step, so a provider timeout retries only the model call rather than re-downloading the file. Every attempt is written to the `extractions` table — successes and failures both — which is what makes "how often is the model wrong, and on what" answerable later.

---

## 6. Path C — the part worth showing people

Same again, but attach **`sample-registration-ambiguous.pdf`**.

That fixture is a faded, skewed photocopy whose date reads `03/04/27` — which is either 3 April 2027 or 4 March 2027, and nothing on the page settles it.

The model should report lowered confidence, fail the gate, and the document should land in **Review** with a badge showing how confident it was.

Open **Review**. The source document is on the left, what the model read is on the right, every field editable. Correct anything wrong and press **Approve**.

*Underneath:* the gate refuses on low confidence, a missing expiry, an expiry before the issue date, an implausible year, or a document type that disagrees with what you filed it as. It always fails *toward* review — a document queued unnecessarily costs someone ten seconds, a bad expiry waved through costs a fine.

Whether you changed anything decides whether the review is recorded as `approved` or `corrected`, and both the before and after are stored. That is what turns the queue from an invisible correction into a measurable signal about the model.

---

## 7. Run the daily sweep by hand

Normally Vercel Cron does this at 02:00. Locally, call it yourself — take `CRON_SECRET` from `.env.local`:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3001/api/cron/sweep
```

You get back a summary: statuses updated, reminders created, emails sent, escalations.

Reload the **dashboard**. The red banner is now **green**: "Daily check ran less than an hour ago".

*Underneath:* the sweep recomputes every document's status, re-enqueues stalled extractions, creates the reminders that have come due, delivers them, and escalates anything unacknowledged for three days.

It writes its `job_runs` row **before** doing any of that. That guarantees a database write every single day, which is what stops the free-tier Supabase project pausing after a week of inactivity. It also means a crash leaves a row stuck in `running`, which the dashboard detects — writing only on success would make failures invisible.

Run it twice. Nothing duplicates: reminders are unique on `(document_id, tier, channel)`.

---

## 8. Notifications

**Notifications** — if a document was within 60 days of expiry when the sweep ran, there is a reminder addressed to you here.

Press **Acknowledge**. That stops it escalating to the owner and records who saw it and when.

*Underneath:* acknowledging goes through a database function rather than an ordinary update, so the caller can only perform that one specific act. A permission broad enough to let you acknowledge would also let you rewrite the schedule or erase an escalation — which is exactly what an escalation record must not allow.

Email only sends if `RESEND_API_KEY` is set. Without it the in-app notification still appears; the email is skipped and the sweep carries on.

---

## 9. The audit log

**Audit log** — every document and subject change, with who and when.

Try this: open a document, change something through the review screen, then come back. The change is already logged.

Staff do not see this link at all. The policy restricts reads to owners and managers, so a staff member would get an empty page — a link to a page that is empty by policy is a dead end, not a feature.

---

## 10. Members and invitations

**Members** → invite an address you control, role `Staff`.

If Resend is not configured, the invitation is still created and the screen gives you the link to copy. Open it in a private window.

You will see the organization name and the address it was sent to, and be offered sign-up or sign-in.

*Worth testing:* open that link while signed in as `admin@lapse.com`. It refuses, because the invitation is for a different address. **The token is not the credential** — accepting requires the signed-in email to match the invited one, so a forwarded link or one pasted into a group chat does nothing.

Complete the sign-up in a private window and that person joins Northern Freight as staff, rather than creating an organization of their own.

---

## 11. The organization switcher

Only appears once you belong to more than one organization. With a single membership the sidebar just shows the name — a switcher with nothing to switch to is a control that cannot do anything.

To see it: sign in as the invited staff account, create a second organization, then accept an invitation back into the first.

---

## 12. Checking roles actually hold

The interesting test. Sign in as the staff account and try to reach:

- `/northern-freight/audit` — link is hidden, and the page is empty if you type the URL
- `/northern-freight/settings/members` — visible, but no invite form and no role controls
- Adding a subject — refused

None of that is enforced by the UI hiding things. Row Level Security refuses the query in Postgres, so the same refusal applies to anything hitting the database, including a bug in my own code.

---

## When something breaks

**A page 500s.** Look at the `pnpm dev` terminal first — the real error is there, not in the browser.

**A document sits on "Processing".** The Inngest dev server is not running, or it has not found the app. Check http://localhost:8288/apps.

**A run fails.** Open it at http://localhost:8288/runs and read the failing step. The full provider response is also stored in the `extractions` table, so nothing is lost.

**"Use a valid date" on a field you left blank.** A reader is using `text()` where it should use `emptyToNull()` — an untouched input submits `""`, not null.

**A write is silently refused.** Almost always RLS. The error surfaces as Postgres code `42501`. Check which role the account has, and what the policy for that table actually allows.

**Checking the database without the dashboard**, using only the secret key:

```bash
curl -s "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/documents?select=title,status,expiry_date" \
  -H "apikey: $SUPABASE_SECRET_KEY" -H "Authorization: Bearer $SUPABASE_SECRET_KEY"
```

Swap `documents` for any table. This is the fastest way to tell an application bug from a database one.
