-- Admin security hardening
-- 1) Move owner privilege to a protected profile role.
-- 2) Store admin access requests in a private table.
-- 3) Store admin invites in a revocable, single-use table.

alter table profiles
  add column if not exists role text default 'author';

alter table profiles
  add column if not exists approved boolean default false;

create table if not exists admin_access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id) on delete set null,
  reviewed_by_email text
);

create index if not exists admin_access_requests_email_idx
  on admin_access_requests (lower(email));

create index if not exists admin_access_requests_status_idx
  on admin_access_requests (status, created_at desc);

create table if not exists admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  inviter_id uuid references profiles(id) on delete set null,
  inviter_email text,
  request_id uuid references admin_access_requests(id) on delete set null,
  token_hash text not null unique,
  status text not null default 'pending',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  revoked_at timestamptz,
  revoked_by uuid references profiles(id) on delete set null,
  revoked_by_email text
);

create index if not exists admin_invites_email_idx
  on admin_invites (lower(email), status, expires_at desc);

create index if not exists admin_invites_request_id_idx
  on admin_invites (request_id);

-- Promote the configured legacy owner account into the protected owner role.
update profiles
set role = 'owner',
    approved = true
where lower(email) = lower('updaytesjournal@gmail.com');

-- Best-effort migration of older request records out of site_content.
insert into admin_access_requests (
  name,
  email,
  message,
  status,
  created_at,
  updated_at,
  reviewed_at,
  reviewed_by_email
)
select
  coalesce(nullif(value::jsonb ->> 'name', ''), 'Unknown requester'),
  lower(value::jsonb ->> 'email'),
  coalesce(value::jsonb ->> 'message', ''),
  coalesce(nullif(value::jsonb ->> 'status', ''), 'pending'),
  coalesce((value::jsonb ->> 'created_at')::timestamptz, now()),
  nullif(value::jsonb ->> 'updated_at', '')::timestamptz,
  nullif(value::jsonb ->> 'reviewed_at', '')::timestamptz,
  nullif(value::jsonb ->> 'reviewed_by_email', '')
from site_content
where key like 'admin_access_request.%'
  and coalesce(value::jsonb ->> 'email', '') <> ''
on conflict do nothing;
