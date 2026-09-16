-- 0004_reminders_notifications_jobs.sql
--
-- The part that does useful work with nobody logged in: the reminder ladder,
-- in-app delivery, and the run record that is also this project's keepalive.

create type reminder_tier as enum ('t60', 't30', 't7', 't1', 'overdue');

create type reminder_channel as enum ('email', 'in_app');

create type job_status as enum ('running', 'succeeded', 'failed');

-- ─────────────────────────────────────────────────────────────────────────
-- Reminders
-- ─────────────────────────────────────────────────────────────────────────

create table reminders (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organizations (id) on delete cascade,
  document_id      uuid not null references documents (id) on delete cascade,
  tier             reminder_tier not null,
  channel          reminder_channel not null,
  scheduled_for    date not null,
  sent_at          timestamptz,
  acknowledged_at  timestamptz,
  acknowledged_by  uuid references profiles (id) on delete set null,
  escalated_at     timestamptz,
  created_at       timestamptz not null default now(),

  -- The idempotency guard, and the reason the sweep can run twice in a day
  -- without sending anything twice. Both triggers (Vercel Cron and the GitHub
  -- Actions backup) can fire on the same day; the second insert is a no-op.
  unique (document_id, tier, channel)
);

create index reminders_org_idx on reminders (organization_id, scheduled_for desc);
create index reminders_unacknowledged_idx
  on reminders (organization_id, tier)
  where acknowledged_at is null;

-- ─────────────────────────────────────────────────────────────────────────
-- Notifications
--
-- Separate from reminders because one reminder fans out to several people
-- during escalation, and each of those needs its own read state.
-- ─────────────────────────────────────────────────────────────────────────

create table notifications (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  reminder_id     uuid references reminders (id) on delete set null,
  title           text not null,
  body            text,
  href            text,
  read_at         timestamptz,
  created_at      timestamptz not null default now()
);

create index notifications_user_unread_idx
  on notifications (user_id, created_at desc)
  where read_at is null;

-- ─────────────────────────────────────────────────────────────────────────
-- Job runs
--
-- Not tenant-scoped; this is system-level. It does three jobs at once:
--
--   1. the dashboard's "last sweep ran N hours ago"
--   2. the stale-heartbeat exception, so the system notices its own silence
--   3. a guaranteed daily write, which is what stops Supabase pausing a
--      free-tier project after a week of inactivity
--
-- (3) is why the sweep must write this row *before* doing its work rather than
-- after. A "nothing to do, exit early" optimisation that skipped the write
-- would quietly break the keepalive on exactly the quiet weeks where it
-- matters most.
-- ─────────────────────────────────────────────────────────────────────────

create table job_runs (
  id              uuid primary key default gen_random_uuid(),
  job_name        text not null,
  status          job_status not null default 'running',
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  items_processed int not null default 0,
  error           text,
  created_at      timestamptz not null default now()
);

create index job_runs_name_started_idx on job_runs (job_name, started_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- Acknowledgement
--
-- A SECURITY DEFINER function rather than an UPDATE policy, so the caller
-- cannot choose *which* columns they set. Acknowledging is one specific act:
-- stamping who did it and when. An update policy permissive enough to allow it
-- would also allow rewriting scheduled_for or clearing escalated_at.
-- ─────────────────────────────────────────────────────────────────────────

create function acknowledge_reminder(reminder uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target reminders;
begin
  select * into target from reminders where id = reminder;

  if not found then
    raise exception 'reminder not found';
  end if;

  if not is_member_of(target.organization_id) then
    raise exception 'not a member of that organization';
  end if;

  -- Already acknowledged by someone else: not an error. Two people clearing
  -- the same notice is ordinary, and the first one stands.
  if target.acknowledged_at is not null then
    return;
  end if;

  update reminders
  set acknowledged_at = now(),
      acknowledged_by = auth.uid()
  where id = reminder;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table reminders     enable row level security;
alter table notifications enable row level security;
alter table job_runs      enable row level security;

create policy "members read reminders"
  on reminders for select
  to authenticated
  using (is_member_of(organization_id));

-- No insert or update policy. Reminders are created by the sweep running with
-- the secret key, and acknowledged through the function above.

create policy "read own notifications"
  on notifications for select
  to authenticated
  using (user_id = auth.uid());

-- Marking as read is the one thing a recipient may do to their own row.
create policy "mark own notifications read"
  on notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "delete own notifications"
  on notifications for delete
  to authenticated
  using (user_id = auth.uid());

-- Readable by any signed-in user: it holds no tenant data, and every
-- organization needs to be able to see whether the sweep is alive.
create policy "signed-in users read job runs"
  on job_runs for select
  to authenticated
  using (true);

grant select          on reminders     to authenticated;
grant select, update, delete on notifications to authenticated;
grant select          on job_runs      to authenticated;

grant execute on function acknowledge_reminder(uuid) to authenticated;
