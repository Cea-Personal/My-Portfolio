alter table app.compensation_recommendations
  add column if not exists observed_min numeric,
  add column if not exists observed_max numeric,
  add column if not exists benchmark numeric,
  add column if not exists strategy text,
  add column if not exists assumptions jsonb not null default '[]',
  add column if not exists source_ids uuid[] not null default '{}',
  add column if not exists normalized_evidence jsonb not null default '[]',
  add column if not exists research_date date not null default current_date;
