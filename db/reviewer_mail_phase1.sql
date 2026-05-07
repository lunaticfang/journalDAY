-- Reviewer workflow mail support

alter table manuscript_reviews
  add column if not exists invited_at timestamptz;

alter table manuscript_reviews
  add column if not exists due_at timestamptz;

alter table manuscript_reviews
  add column if not exists last_reminder_at timestamptz;

create index if not exists manuscript_reviews_due_at_idx
  on manuscript_reviews (due_at);

create index if not exists manuscript_reviews_last_reminder_at_idx
  on manuscript_reviews (last_reminder_at);

update manuscript_reviews
set invited_at = coalesce(invited_at, created_at),
    due_at = coalesce(due_at, created_at + interval '14 days')
where invited_at is null
   or due_at is null;
