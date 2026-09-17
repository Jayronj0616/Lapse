-- 0005_invitations.sql
--
-- How everyone except the first person gets into an organization.
--
-- Public sign-up stays: someone at a new customer has to be able to create the
-- organization in the first place, and a demo nobody can try is not a demo.
-- What changes is that signing up is no longer the *only* way in. With an
-- invitation you join an existing organization and never see the
-- organization-creation screen; without one, you create your own.

create table invitations (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  -- Stored lowercased by the trigger below so matching is predictable.
  email           text not null check (position('@' in email) > 1),
  role            member_role not null default 'staff',
  -- Unguessable. gen_random_bytes is cryptographic; a uuid would be adequate
  -- but reads like an identifier, and this is a bearer credential.
  token           text not null unique default encode(gen_random_bytes(24), 'hex'),
  invited_by      uuid references profiles (id) on delete set null,
  expires_at      timestamptz not null default now() + interval '14 days',
  accepted_at     timestamptz,
  accepted_by     uuid references profiles (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- One live invitation per person per organization. Re-inviting someone who is
-- already pending should be a no-op, not a second link that also works.
create unique index invitations_pending_idx
  on invitations (organization_id, email)
  where accepted_at is null;

create index invitations_org_idx on invitations (organization_id, created_at desc);

create function normalize_invitation_email()
returns trigger
language plpgsql
as $$
begin
  new.email = lower(btrim(new.email));
  return new;
end;
$$;

create trigger invitations_normalize_email
before insert or update on invitations
for each row execute function normalize_invitation_email();

-- Role changes and removals are exactly the kind of thing an audit log exists
-- for, and memberships already carries organization_id, so the existing
-- trigger function works unchanged.
create trigger memberships_audit
after insert or update or delete on memberships
for each row execute function record_audit();

create trigger invitations_audit
after insert or update or delete on invitations
for each row execute function record_audit();

-- ─────────────────────────────────────────────────────────────────────────
-- Preview
--
-- Callable by anon, because the person following an invitation link has not
-- signed up yet and cannot be authenticated. It returns only what is needed to
-- render the screen — the organization's name, the address invited, and
-- whether the link is still good.
--
-- It deliberately does not reveal who invited them, the role, or anything
-- about the organization's contents. A token that has leaked should expose as
-- little as possible.
-- ─────────────────────────────────────────────────────────────────────────

create function invitation_preview(invite_token text)
returns table (organization_name text, email text, valid boolean)
language sql
security definer
stable
set search_path = public
as $$
  select
    o.name,
    i.email,
    (i.accepted_at is null and i.expires_at > now()) as valid
  from invitations i
  join organizations o on o.id = i.organization_id
  where i.token = invite_token;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Acceptance
--
-- The email check is the important line in this function. Without it the token
-- alone grants membership, so a forwarded link — or one pasted into a group
-- chat — would let anybody into the organization. Requiring the signed-in
-- address to match the invited one makes the token a second factor rather than
-- the whole credential.
-- ─────────────────────────────────────────────────────────────────────────

create function accept_invitation(invite_token text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  invite     invitations;
  caller     text;
  org_slug   text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into invite from invitations where token = invite_token;

  if not found then
    raise exception 'that invitation link is not valid';
  end if;

  if invite.accepted_at is not null then
    raise exception 'that invitation has already been used';
  end if;

  if invite.expires_at <= now() then
    raise exception 'that invitation has expired';
  end if;

  select lower(email) into caller from profiles where id = auth.uid();

  if caller is distinct from invite.email then
    raise exception 'this invitation was sent to a different email address';
  end if;

  insert into memberships (organization_id, user_id, role)
  values (invite.organization_id, auth.uid(), invite.role)
  on conflict (organization_id, user_id) do nothing;

  update invitations
  set accepted_at = now(),
      accepted_by = auth.uid()
  where id = invite.id;

  select slug into org_slug from organizations where id = invite.organization_id;
  return org_slug;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Note there is no select policy for the invited person: they reach their
-- invitation through invitation_preview() and accept_invitation(), never by
-- reading the table. Otherwise a pending invitee would need read access to a
-- table listing everyone else who has been invited.
-- ─────────────────────────────────────────────────────────────────────────

alter table invitations enable row level security;

create policy "owners and managers read invitations"
  on invitations for select
  to authenticated
  using (role_in(organization_id) in ('owner', 'manager'));

create policy "owners and managers send invitations"
  on invitations for insert
  to authenticated
  with check (
    role_in(organization_id) in ('owner', 'manager')
    and invited_by = auth.uid()
  );

-- Revoking is a delete. There is no update policy: an invitation's role or
-- email should not be editable after the link has been sent.
create policy "owners and managers revoke invitations"
  on invitations for delete
  to authenticated
  using (role_in(organization_id) in ('owner', 'manager'));

grant select, insert, delete on invitations to authenticated;

grant execute on function invitation_preview(text) to anon, authenticated;
grant execute on function accept_invitation(text) to authenticated;
