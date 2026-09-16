-- 0001_orgs_and_auth.sql
-- Organizations, profiles, memberships, and the RLS foundation everything else
-- builds on. See SCHEMA.md for the reasoning behind the shape.
--
-- Read this before adding a policy to any later table: the pattern here
-- (SECURITY DEFINER helpers called from policies) is deliberate and repeated.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────

create type member_role as enum ('owner', 'manager', 'staff');

-- ─────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────

create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 120),
  -- used in URLs: /{orgSlug}/dashboard
  slug       text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  created_at timestamptz not null default now()
);

-- Mirrors auth.users so the rest of the app can join on user data without
-- reaching into the auth schema. Populated by a trigger, never by a client.
create table profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text not null,
  full_name  text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- The join table that makes everything multi-tenant. Every RLS policy in this
-- project resolves through it.
create table memberships (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  role            member_role not null default 'staff',
  created_at      timestamptz not null default now(),
  unique (organization_id, user_id)
);

create index memberships_user_id_idx on memberships (user_id);
create index memberships_organization_id_idx on memberships (organization_id);

-- ─────────────────────────────────────────────────────────────────────────
-- RLS helpers
--
-- These are SECURITY DEFINER on purpose, and it is not incidental: a policy ON
-- memberships that queries memberships would recurse infinitely under RLS.
-- SECURITY DEFINER runs the function as its owner, which skips RLS on the
-- inner query and breaks the cycle. Every later table reuses these rather
-- than inlining an EXISTS over memberships.
--
-- search_path is pinned on every SECURITY DEFINER function so a caller cannot
-- shadow `memberships` with their own table and lift their privileges.
-- ─────────────────────────────────────────────────────────────────────────

create function is_member_of(org uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from memberships
    where organization_id = org and user_id = auth.uid()
  );
$$;

create function role_in(org uuid)
returns member_role
language sql
security definer
stable
set search_path = public
as $$
  select role from memberships
  where organization_id = org and user_id = auth.uid();
$$;

-- Used by the profiles read policy: can the caller see this person at all?
create function shares_org_with(other_user uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from memberships mine
    join memberships theirs on theirs.organization_id = mine.organization_id
    where mine.user_id = auth.uid() and theirs.user_id = other_user
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- auth.users → profiles
-- ─────────────────────────────────────────────────────────────────────────

create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────
-- Organization creation
--
-- Creating an org is two inserts that must both happen or neither: the org,
-- and the membership that makes the creator its owner. Doing it client-side
-- would need an INSERT policy on memberships permissive enough for someone
-- with no membership yet — which is exactly the hole we do not want. So
-- organizations has no INSERT policy at all, and this function is the only
-- way in.
-- ─────────────────────────────────────────────────────────────────────────

create function create_organization(org_name text, org_slug text)
returns organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  new_org organizations;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  insert into organizations (name, slug)
  values (org_name, org_slug)
  returning * into new_org;

  insert into memberships (organization_id, user_id, role)
  values (new_org.id, auth.uid(), 'owner');

  return new_org;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────
-- An organization must always keep at least one owner
--
-- Without this, an owner can demote or delete themselves and leave an org
-- that nobody can administer — unrecoverable without database access.
-- ─────────────────────────────────────────────────────────────────────────

create function guard_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining int;
begin
  if (tg_op = 'DELETE' and old.role = 'owner')
     or (tg_op = 'UPDATE' and old.role = 'owner' and new.role <> 'owner') then

    select count(*) into remaining
    from memberships
    where organization_id = old.organization_id
      and role = 'owner'
      and id <> old.id;

    if remaining = 0 then
      raise exception 'an organization must keep at least one owner';
    end if;
  end if;

  return coalesce(new, old);
end;
$$;

create trigger memberships_guard_last_owner
before update or delete on memberships
for each row execute function guard_last_owner();

-- ─────────────────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Note what has no policy: organizations INSERT (use create_organization) and
-- profiles INSERT (the trigger owns it). If a client cannot write a row, a
-- client bug cannot forge one.
-- ─────────────────────────────────────────────────────────────────────────

alter table organizations enable row level security;
alter table profiles      enable row level security;
alter table memberships   enable row level security;

-- organizations
create policy "members read their orgs"
  on organizations for select
  to authenticated
  using (is_member_of(id));

create policy "owners update their org"
  on organizations for update
  to authenticated
  using (role_in(id) = 'owner')
  with check (role_in(id) = 'owner');

create policy "owners delete their org"
  on organizations for delete
  to authenticated
  using (role_in(id) = 'owner');

-- profiles
create policy "read self and co-members"
  on profiles for select
  to authenticated
  using (id = auth.uid() or shares_org_with(id));

create policy "update own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- memberships
create policy "members read memberships in their orgs"
  on memberships for select
  to authenticated
  using (is_member_of(organization_id));

create policy "owners and managers add members"
  on memberships for insert
  to authenticated
  with check (role_in(organization_id) in ('owner', 'manager'));

create policy "owners change roles"
  on memberships for update
  to authenticated
  using (role_in(organization_id) = 'owner')
  with check (role_in(organization_id) = 'owner');

create policy "owners remove members"
  on memberships for delete
  to authenticated
  using (role_in(organization_id) = 'owner');

-- ─────────────────────────────────────────────────────────────────────────
-- Grants
--
-- RLS is the gate; these grants only decide which verbs are reachable at all.
-- anon gets nothing: every table here requires a session.
-- ─────────────────────────────────────────────────────────────────────────

grant select, update, delete on organizations to authenticated;
grant select, update          on profiles      to authenticated;
grant select, insert, update, delete on memberships to authenticated;

grant execute on function is_member_of(uuid)        to authenticated;
grant execute on function role_in(uuid)             to authenticated;
grant execute on function shares_org_with(uuid)     to authenticated;
grant execute on function create_organization(text, text) to authenticated;
