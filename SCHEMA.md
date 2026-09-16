# SCHEMA.md — data model

Source of truth is `supabase/migrations/`. This file explains *why* the tables look the way they do; the SQL is authoritative on exact types.

Every tenant-owned table carries `organization_id` and is protected by RLS. Isolation is enforced by Postgres, not by remembering to filter.

---

## Enums

| Enum | Values |
|---|---|
| `member_role` | `owner`, `manager`, `staff` |
| `subject_kind` | `vehicle`, `person` |
| `document_type` | `vehicle_registration`, `insurance_policy`, `drivers_license` |
| `document_status` | `processing`, `needs_review`, `active`, `expiring`, `expired`, `extraction_failed`, `archived` |
| `extraction_status` | `pending`, `succeeded`, `failed` |
| `review_action` | `approved`, `corrected`, `rejected` |
| `reminder_tier` | `t60`, `t30`, `t7`, `t1`, `overdue` |
| `reminder_channel` | `email`, `in_app` |
| `job_status` | `running`, `succeeded`, `failed` |

`document_status` deliberately separates `expiring` from `active`. The daily sweep computes it; the UI never derives it from a date comparison in two different places.

---

## Tables

### `organizations`
`id uuid pk` · `name text` · `slug text unique` · `created_at timestamptz`

The tenant boundary. Slug is used in URLs (`/{orgSlug}/dashboard`).

### `profiles`
`id uuid pk → auth.users.id` · `email text` · `full_name text` · `avatar_url text` · `created_at`

Mirrors Supabase Auth users so we can join on user data without touching the `auth` schema. Populated by a trigger on `auth.users` insert.

### `memberships`
`id uuid pk` · `organization_id → organizations` · `user_id → profiles` · `role member_role` · `created_at`
Unique on `(organization_id, user_id)`.

The join table that makes everything multi-tenant. Every RLS policy resolves through this.

### `subjects`
`id uuid pk` · `organization_id` · `kind subject_kind` · `label text` · `identifier text` · `created_at`

The thing a document is *about* — a truck or a driver. `label` is human-facing ("Truck ABC-1234"), `identifier` is the plate or license number. Without this, the dashboard can only say "a registration expires soon" instead of naming which vehicle.

### `documents`
`id uuid pk` · `organization_id` · `subject_id → subjects (nullable)` · `type document_type` · `title text` · `storage_path text` · `status document_status` · `document_number text` · `issuer text` · `issue_date date` · `expiry_date date` · `uploaded_by → profiles` · `responsible_user_id → profiles` · `created_at` · `updated_at`

The core record. `expiry_date` is nullable because a document in `processing` or `extraction_failed` doesn't have one yet.

`responsible_user_id` defaults to `uploaded_by` and is who reminders address. Escalation looks past it to the organization owner.

Indexes: `(organization_id, status)`, `(organization_id, expiry_date)`.

### `extractions`
`id uuid pk` · `document_id → documents` · `provider text` · `model text` · `attempt int` · `status extraction_status` · `confidence numeric(3,2)` · `extracted jsonb` · `raw_response jsonb` · `error text` · `created_at`

One row per attempt, not one per document. Keeping failures and retries means you can answer "how often is the model wrong, and on which document type" later — which is the whole reason the review queue exists.

`extracted` holds the parsed fields; `raw_response` holds what the provider actually returned, for debugging.

### `document_reviews`
`id uuid pk` · `document_id` · `reviewer_id → profiles` · `action review_action` · `before jsonb` · `after jsonb` · `note text` · `created_at`

What a human did to a `needs_review` document. Storing both `before` and `after` is what turns the queue into a measurable feedback signal rather than an invisible correction.

### `reminders`
`id uuid pk` · `organization_id` · `document_id` · `tier reminder_tier` · `channel reminder_channel` · `scheduled_for date` · `sent_at timestamptz` · `acknowledged_at timestamptz` · `acknowledged_by → profiles` · `escalated_at timestamptz` · `created_at`
Unique on `(document_id, tier, channel)`.

That unique constraint is the idempotency guard. The sweep can run twice in one day and the second run inserts nothing.

### `notifications`
`id uuid pk` · `organization_id` · `user_id → profiles` · `reminder_id → reminders (nullable)` · `title text` · `body text` · `href text` · `read_at timestamptz` · `created_at`

In-app delivery. Separate from `reminders` because one reminder can fan out to several people during escalation.

### `audit_log`
`id uuid pk` · `organization_id` · `actor_id → profiles (nullable)` · `action text` · `entity_type text` · `entity_id uuid` · `before jsonb` · `after jsonb` · `created_at`

`actor_id` is nullable because background jobs act without a user. Written for: document upload, review decision, reminder acknowledgment, role change, member invite/removal, document archive/delete.

### `job_runs`
`id uuid pk` · `job_name text` · `status job_status` · `started_at` · `finished_at` · `items_processed int` · `error text` · `created_at`

Not tenant-scoped — it's system-level. Serves three purposes: the dashboard's "last sweep ran N hours ago", the stale-heartbeat exception, and the guaranteed daily write that keeps Supabase from pausing the project.

---

## RLS

A helper function does the work so policies stay readable:

```sql
create function is_member_of(org uuid) returns boolean
language sql security definer stable as $$
  select exists (
    select 1 from memberships
    where organization_id = org and user_id = auth.uid()
  );
$$;
```

With a `role_in(org uuid)` companion returning the caller's `member_role`.

**Policy shape per table:**

| Table | Select | Insert / Update | Delete |
|---|---|---|---|
| `organizations` | member | owner | owner |
| `memberships` | member | owner, manager | owner |
| `subjects` | member | owner, manager | owner, manager |
| `documents` | member | member (insert), owner/manager or responsible user (update) | owner, manager |
| `extractions` | member via document | service role only | none |
| `document_reviews` | member via document | owner, manager | none |
| `reminders` | member via document | service role only; acknowledge via a `security definer` function | none |
| `notifications` | own rows only | service role only | own rows |
| `audit_log` | owner, manager | service role only | none |
| `job_runs` | authenticated read | service role only | none |

Rows written exclusively by background jobs have no user-facing insert policy at all. If a client can't write it, a client bug can't forge it.

---

## The expiry state machine

The sweep recomputes `documents.status` daily:

```
processing ──extract──> needs_review ──review──> active
     │                        │
     └──fail──> extraction_failed ──retry──> processing

active ──(expiry - today) <= 60──> expiring ──(today > expiry)──> expired
```

`archived` is terminal and set manually. Reminder tiers fire off the day gap: 60, 30, 7, 1, then daily once `expired`.

---

## Open schema questions

- Should `document_type` stay an enum or become a table? An enum is simpler now but means a migration to add a fourth type. Revisit when a fourth type is actually requested.
- Renewal history: when a document is renewed, is it a new row linked to the old one, or an update in place? Leaning toward a new row with a `replaces_document_id`, but not needed for v1.
