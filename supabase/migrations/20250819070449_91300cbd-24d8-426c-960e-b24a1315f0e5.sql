-- 1) Create a protected table for inspector contact details (PII)
create table if not exists public.inspector_contacts (
  id uuid primary key default gen_random_uuid(),
  inspector_id uuid not null references public.inspectors(id) on delete cascade,
  organization_id uuid not null,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

-- Enable Row Level Security on the new table
alter table public.inspector_contacts enable row level security;

-- 2) Add trigger to automatically set org and user columns on insert/update
--    This uses the existing public.set_org_and_user_columns() function
create trigger set_org_user_cols_on_inspector_contacts
before insert or update on public.inspector_contacts
for each row execute function public.set_org_and_user_columns();

-- 3) RLS Policies for inspector_contacts
-- Only admins in their org, or users with explicit elevated access (manager/lead/owner) can read PII
create policy "Admins can view inspector contacts in org"
  on public.inspector_contacts
  for select
  using (is_admin() and organization_id = get_current_user_org_id());

create policy "Managers with explicit access can view inspector contacts"
  on public.inspector_contacts
  for select
  using (
    exists (
      select 1
      from public.user_inspector_access a
      where a.user_id = auth.uid()
        and a.inspector_id = inspector_contacts.inspector_id
        and a.organization_id = inspector_contacts.organization_id
        and a.role in ('manager','lead','owner')
    )
  );

-- Allow admins to insert/update/delete rows in their org
create policy "Admins manage inspector contacts (insert)"
  on public.inspector_contacts
  for insert
  with check (is_admin() and organization_id = get_current_user_org_id());

create policy "Admins manage inspector contacts (update)"
  on public.inspector_contacts
  for update
  using (is_admin() and organization_id = get_current_user_org_id())
  with check (organization_id = get_current_user_org_id());

create policy "Admins manage inspector contacts (delete)"
  on public.inspector_contacts
  for delete
  using (is_admin() and organization_id = get_current_user_org_id());

-- 4) Migrate existing PII from inspectors to inspector_contacts
insert into public.inspector_contacts (
  inspector_id, organization_id, email, phone, created_by, updated_by, created_at, updated_at
)
select
  id, organization_id, email, phone, created_by, updated_by, created_at, updated_at
from public.inspectors
where (email is not null and email <> '') or (phone is not null and phone <> '');

-- 5) Remove PII columns from the inspectors table to prevent future exposure
alter table public.inspectors drop column if exists email;
alter table public.inspectors drop column if exists phone;

-- 6) Create a PII-safe view for general use that never exposes email/phone
create or replace view public.inspectors_public as
select
  i.id,
  i.name,
  i.position,
  i.technical_grade,
  i.is_team_leader,
  i.location_id,
  i.organization_id,
  i.created_at,
  i.updated_at,
  i.created_by,
  i.updated_by
from public.inspectors i;

-- Grant select on the view to authenticated users; underlying RLS on inspectors still applies
grant select on public.inspectors_public to authenticated;
