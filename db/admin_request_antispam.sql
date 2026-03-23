-- Anti-spam hardening for the public admin access request form.
-- Stores a private client fingerprint so we can throttle abuse without CAPTCHAs.

alter table admin_access_requests
  add column if not exists ip_fingerprint text,
  add column if not exists user_agent text;

create index if not exists admin_access_requests_ip_fingerprint_idx
  on admin_access_requests (ip_fingerprint, created_at desc);
