-- Repairs legacy/incomplete admin access request tables.
-- Safe to run multiple times.

create table if not exists admin_access_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null
);

alter table admin_access_requests
  add column if not exists status text not null default 'pending',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references profiles(id) on delete set null,
  add column if not exists reviewed_by_email text,
  add column if not exists ip_fingerprint text,
  add column if not exists user_agent text;

create index if not exists admin_access_requests_email_idx
  on admin_access_requests (lower(email));

create index if not exists admin_access_requests_status_idx
  on admin_access_requests (status, created_at desc);

create index if not exists admin_access_requests_ip_fingerprint_idx
  on admin_access_requests (ip_fingerprint, created_at desc);

create table if not exists admin_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  inviter_id uuid references profiles(id) on delete set null,
  inviter_email text,
  request_id uuid references admin_access_requests(id) on delete set null,
  token_hash text not null unique
);

alter table admin_invites
  add column if not exists status text not null default 'pending',
  add column if not exists expires_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists used_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid references profiles(id) on delete set null,
  add column if not exists revoked_by_email text;

update admin_invites
set expires_at = coalesce(expires_at, created_at + interval '7 days')
where expires_at is null;

alter table admin_invites
  alter column expires_at set not null;

create index if not exists admin_invites_email_idx
  on admin_invites (lower(email), status, expires_at desc);

create index if not exists admin_invites_request_id_idx
  on admin_invites (request_id);
