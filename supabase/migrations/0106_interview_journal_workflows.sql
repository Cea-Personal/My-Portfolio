alter table app.journal_entries
  add column if not exists title text,
  add column if not exists entry_date date not null default current_date,
  add column if not exists related_type text,
  add column if not exists related_id uuid,
  add column if not exists attachment_keys text[] not null default '{}',
  add column if not exists updated_at timestamptz not null default now();

alter table app.journal_insights
  add column if not exists kind text,
  add column if not exists decision_note text,
  add column if not exists reviewed_at timestamptz;

alter table app.interview_stages
  add column if not exists stage_type text not null default 'unknown',
  add column if not exists notes text,
  add column if not exists preparation_state text not null default 'not_started',
  add column if not exists outcome text,
  add column if not exists confidence text not null default 'low';

alter table app.preparation_kits
  add column if not exists version integer not null default 1,
  add column if not exists status text not null default 'draft',
  add column if not exists evidence_ids uuid[] not null default '{}';

alter table app.mock_interviews
  add column if not exists mode text not null default 'behavioral',
  add column if not exists questions jsonb not null default '[]',
  add column if not exists responses jsonb not null default '[]',
  add column if not exists completed_at timestamptz;

alter table app.star_stories
  add column if not exists metrics jsonb not null default '[]',
  add column if not exists skills text[] not null default '{}',
  add column if not exists technologies text[] not null default '{}',
  add column if not exists project_id uuid,
  add column if not exists role_id uuid,
  add column if not exists visibility text not null default 'private',
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create table if not exists app.interview_debriefs (
  id uuid primary key default gen_random_uuid(),
  stage_id uuid not null references app.interview_stages(id) on delete cascade,
  owner_id uuid not null references app.profiles(id) on delete cascade,
  original_notes text not null,
  questions jsonb not null default '[]',
  topics jsonb not null default '[]',
  successes jsonb not null default '[]',
  difficulties jsonb not null default '[]',
  follow_ups jsonb not null default '[]',
  derived_insights jsonb not null default '[]',
  insight_status text not null default 'candidate' check (insight_status in ('candidate', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table app.interview_debriefs enable row level security;
grant select, insert, update, delete on app.interview_debriefs to authenticated;
create policy interview_debriefs_owner on app.interview_debriefs for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create unique index if not exists interview_processes_application_unique
  on app.interview_processes(application_id);
create unique index if not exists preparation_kits_stage_version_unique
  on app.preparation_kits(stage_id, version);
create index if not exists journal_entries_related
  on app.journal_entries(owner_id, related_type, related_id, entry_date desc);
