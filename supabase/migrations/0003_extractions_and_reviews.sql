-- 0003_extractions_and_reviews.sql
--
-- What the model produced, and what a human did about it.
--
-- Both tables carry `organization_id` directly rather than reaching through
-- `documents` for it. SCHEMA.md originally described these policies as
-- "member via document", but CLAUDE.md's rule is that every tenant table holds
-- its own `organization_id` — a policy that joins to another table to find the
-- tenant is slower, harder to read, and one refactor away from being wrong.

create type extraction_status as enum ('pending', 'succeeded', 'failed');

create type review_action as enum ('approved', 'corrected', 'rejected');

-- ─────────────────────────────────────────────────────────────────────────
-- Extractions
--
-- One row per *attempt*, not per document. Keeping the failures and the
-- retries is the whole point: it is what lets you answer "how often is the
-- model wrong, and on which document type" later. A table that only held the
-- winning attempt would make the review queue look like unexplained busywork.
-- ─────────────────────────────────────────────────────────────────────────

create table extractions (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  document_id     uuid not null references documents (id) on delete cascade,
  -- which implementation ran: 'gemini', 'foundry', ...
  provider        text not null,
  model           text not null,
  attempt         int not null default 1 check (attempt >= 1),
  status          extraction_status not null default 'pending',
  -- the model's own confidence, 0.00–1.00; null when the attempt failed
  confidence      numeric(3, 2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  -- the parsed fields
  extracted       jsonb,
  -- what the provider actually returned, kept for debugging a bad parse
  raw_response    jsonb,
  error           text,
  created_at      timestamptz not null default now(),

  unique (document_id, attempt)
);

create index extractions_document_idx on extractions (document_id, attempt desc);
create index extractions_org_status_idx on extractions (organization_id, status);

-- ─────────────────────────────────────────────────────────────────────────
-- Reviews
--
-- Storing `before` and `after` is what turns the queue from an invisible
-- correction into a measurable signal. Without the pair you know a human
-- touched it; with the pair you know what the model got wrong.
-- ─────────────────────────────────────────────────────────────────────────

create table document_reviews (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  document_id     uuid not null references documents (id) on delete cascade,
  reviewer_id     uuid references profiles (id) on delete set null,
  action          review_action not null,
  before          jsonb,
  after           jsonb,
  note            text,
  created_at      timestamptz not null default now()
);

create index document_reviews_document_idx on document_reviews (document_id, created_at desc);
create index document_reviews_org_idx on document_reviews (organization_id, created_at desc);

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- `extractions` has no client write policy at all. Rows are produced by the
-- extraction job running with the secret key, which bypasses RLS. If a client
-- cannot write it, a client bug cannot forge a confidence score.
-- ─────────────────────────────────────────────────────────────────────────

alter table extractions       enable row level security;
alter table document_reviews  enable row level security;

create policy "members read extractions"
  on extractions for select
  to authenticated
  using (is_member_of(organization_id));

create policy "members read reviews"
  on document_reviews for select
  to authenticated
  using (is_member_of(organization_id));

-- Reviewing means changing the document, so it takes the same authority that
-- changing the document takes: owner, manager, or the person answerable for
-- it. Letting any member file a review they could not then apply would produce
-- review rows that decide nothing.
create function can_edit_document(doc uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from documents d
    where d.id = doc
      and (
        role_in(d.organization_id) in ('owner', 'manager')
        or d.responsible_user_id = auth.uid()
      )
  );
$$;

create policy "reviewers record reviews"
  on document_reviews for insert
  to authenticated
  with check (
    is_member_of(organization_id)
    and reviewer_id = auth.uid()
    and can_edit_document(document_id)
  );

-- Reviews are never edited or removed. A correctable audit record is not one.

grant select          on extractions      to authenticated;
grant select, insert  on document_reviews to authenticated;

grant execute on function can_edit_document(uuid) to authenticated;
