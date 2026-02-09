-- Admin flow schema additions

-- Profiles: add role/approved if missing
alter table profiles
  add column if not exists role text default 'author';

alter table profiles
  add column if not exists approved boolean default false;

-- Manuscripts: store Word file path
alter table manuscripts
  add column if not exists word_path text;

-- Reviewer assignments and decisions
create table if not exists manuscript_reviews (
  id uuid primary key default gen_random_uuid(),
  manuscript_id uuid not null references manuscripts(id) on delete cascade,
  reviewer_id uuid not null references profiles(id) on delete cascade,
  recommendation text,
  notes text,
  created_at timestamptz default now(),
  decided_at timestamptz
);

create unique index if not exists manuscript_reviews_unique
  on manuscript_reviews (manuscript_id, reviewer_id);

create index if not exists manuscript_reviews_manuscript_id_idx
  on manuscript_reviews (manuscript_id);

-- In-app notifications
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  manuscript_id uuid references manuscripts(id) on delete set null,
  title text,
  body text,
  created_at timestamptz default now(),
  read_at timestamptz
);

create index if not exists notifications_user_id_idx
  on notifications (user_id);
