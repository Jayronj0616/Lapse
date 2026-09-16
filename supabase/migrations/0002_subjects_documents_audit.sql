-- 0002_subjects_documents_audit.sql
--
-- Subjects (the vehicle or person a document is about), documents themselves,
-- the private storage bucket their files live in, and the audit log.
--
-- audit_log was originally planned for a later migration, but Phase 2 writes
-- audit rows, so it lands here. SCHEMA.md reflects the move.

-- ─────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────

create type subject_kind as enum ('vehicle', 'person');

create type document_type as enum (
  'vehicle_registration',
  'insurance_policy',
  'drivers_license'
);

-- `expiring` is deliberately a separate state from `active` rather than
-- something the UI derives from a date comparison. The daily sweep computes it
-- once, so two screens cannot disagree about whether a document is expiring.
create type document_status as enum (
  'processing',
  'needs_review',
  'active',
  'expiring',
  'expired',
  'extraction_failed',
  'archived'
);

-- ─────────────────────────────────────────────────────────────────────────
-- Subjects
-- ─────────────────────────────────────────────────────────────────────────

create table subjects (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  kind            subject_kind not null,
  -- human-facing: "Truck ABC-1234", "Juan dela Cruz"
  label           text not null check (char_length(btrim(label)) between 1 and 120),
  -- the plate or license number; optional because not every subject has one
  identifier      text check (identifier is null or char_length(btrim(identifier)) <= 60),
  created_at      timestamptz not null default now()
);

create index subjects_organization_id_idx on subjects (organization_id);

-- ─────────────────────────────────────────────────────────────────────────
-- Documents
-- ─────────────────────────────────────────────────────────────────────────

create table documents (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references organizations (id) on delete cascade,
  -- nullable: a document can be filed before anyone says what it covers
  subject_id          uuid references subjects (id) on delete set null,
  type                document_type not null,
  title               text not null check (char_length(btrim(title)) between 1 and 200),
  -- path inside the private `documents` bucket, always "{organization_id}/..."
  storage_path        text not null,
  status              document_status not null default 'processing',
  document_number     text,
  issuer              text,
  issue_date          date,
  -- nullable: a document still processing, or whose extraction failed, does
  -- not have one yet
  expiry_date         date,
  uploaded_by         uuid references profiles (id) on delete set null,
  -- who reminders address; defaults to the uploader at insert time
  responsible_user_id uuid references profiles (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- An expiry before issue is always a data error, whether typed by a person
  -- or hallucinated by a model. Reject it at the source.
  constraint documents_expiry_after_issue
    check (issue_date is null or expiry_date is null or expiry_date >= issue_date)
);

create index documents_org_status_idx on documents (organization_id, status);
create index documents_org_expiry_idx on documents (organization_id, expiry_date);
create index documents_subject_idx on documents (subject_id);

create function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger documents_touch_updated_at
before update on documents
for each row execute function touch_updated_at();

-- ─────────────────────────────────────────────────────────────────────────
-- Audit log
--
-- Written by triggers, not by application code. A service that has to remember
-- to log is a service that will eventually forget, and the whole value of an
-- audit trail is that it has no gaps. Nothing in the app can mutate a document
-- or a subject without a row landing here.
-- ─────────────────────────────────────────────────────────────────────────

create table audit_log (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  -- nullable: background jobs act without a user
  actor_id        uuid references profiles (id) on delete set null,
  action          text not null,
  entity_type     text not null,
  entity_id       uuid not null,
  before          jsonb,
  after           jsonb,
  created_at      timestamptz not null default now()
);

create index audit_log_org_created_idx on audit_log (organization_id, created_at desc);
create index audit_log_entity_idx on audit_log (entity_type, entity_id);

create function record_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_org uuid;
begin
  row_org := coalesce(
    (to_jsonb(new) ->> 'organization_id')::uuid,
    (to_jsonb(old) ->> 'organization_id')::uuid
  );

  insert into audit_log (
    organization_id, actor_id, action, entity_type, entity_id, before, after
  )
  values (
    row_org,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  return coalesce(new, old);
end;
$$;

create trigger documents_audit
after insert or update or delete on documents
for each row execute function record_audit();

create trigger subjects_audit
after insert or update or delete on subjects
for each row execute function record_audit();

-- ─────────────────────────────────────────────────────────────────────────
-- Storage
--
-- Private bucket. Files are reached through short-lived signed URLs, never a
-- public link — an expired insurance policy is not something to leave on a
-- guessable URL.
--
-- Isolation rides on the object path: every key is "{organization_id}/...",
-- and the policies below check that first path segment against membership. A
-- file cannot be written outside the caller's own organization folder.
-- ─────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'documents',
  'documents',
  false,
  10485760, -- 10 MB
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do nothing;

create policy "members read their org's document files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'documents'
    and is_member_of(((storage.foldername(name))[1])::uuid)
  );

create policy "members upload into their own org folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'documents'
    and is_member_of(((storage.foldername(name))[1])::uuid)
  );

create policy "owners and managers delete document files"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'documents'
    and role_in(((storage.foldername(name))[1])::uuid) in ('owner', 'manager')
  );

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────────────────

alter table subjects  enable row level security;
alter table documents enable row level security;
alter table audit_log enable row level security;

-- subjects
create policy "members read subjects"
  on subjects for select
  to authenticated
  using (is_member_of(organization_id));

create policy "owners and managers write subjects"
  on subjects for insert
  to authenticated
  with check (role_in(organization_id) in ('owner', 'manager'));

create policy "owners and managers update subjects"
  on subjects for update
  to authenticated
  using (role_in(organization_id) in ('owner', 'manager'))
  with check (role_in(organization_id) in ('owner', 'manager'));

create policy "owners and managers delete subjects"
  on subjects for delete
  to authenticated
  using (role_in(organization_id) in ('owner', 'manager'));

-- documents
create policy "members read documents"
  on documents for select
  to authenticated
  using (is_member_of(organization_id));

-- Any member may file a document. Staff need this — they are usually the ones
-- holding the piece of paper.
create policy "members add documents"
  on documents for insert
  to authenticated
  with check (is_member_of(organization_id));

create policy "managers or the responsible person update documents"
  on documents for update
  to authenticated
  using (
    role_in(organization_id) in ('owner', 'manager')
    or responsible_user_id = auth.uid()
  )
  with check (
    role_in(organization_id) in ('owner', 'manager')
    or responsible_user_id = auth.uid()
  );

create policy "owners and managers delete documents"
  on documents for delete
  to authenticated
  using (role_in(organization_id) in ('owner', 'manager'));

-- audit_log: readable by leadership, writable by nobody. The trigger is
-- SECURITY DEFINER, so it inserts without needing a policy — which is exactly
-- the property we want. A row here cannot be forged or edited from the app.
create policy "owners and managers read the audit log"
  on audit_log for select
  to authenticated
  using (role_in(organization_id) in ('owner', 'manager'));

-- ─────────────────────────────────────────────────────────────────────────
-- Grants
-- ─────────────────────────────────────────────────────────────────────────

grant select, insert, update, delete on subjects  to authenticated;
grant select, insert, update, delete on documents to authenticated;
grant select                          on audit_log to authenticated;
