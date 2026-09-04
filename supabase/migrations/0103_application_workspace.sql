alter table app.applications drop constraint if exists applications_status_check;
alter table app.applications add constraint applications_status_check check (status in (
  'draft', 'in_progress', 'ready', 'submitted', 'interviewing', 'offer', 'closed', 'withdrawn'
));

alter table app.application_answer_versions
  add column if not exists original_question text,
  add column if not exists evidence_ids uuid[] not null default '{}',
  add column if not exists generation_context jsonb not null default '{}',
  add column if not exists owner_approved_at timestamptz;

create table if not exists app.application_profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  name text not null,
  identity jsonb not null default '{}',
  contact jsonb not null default '{}',
  links jsonb not null default '{}',
  location jsonb not null default '{}',
  work_authorization jsonb not null default '{}',
  availability jsonb not null default '{}',
  languages jsonb not null default '[]',
  education jsonb not null default '[]',
  certifications jsonb not null default '[]',
  status text not null default 'draft' check (status in ('draft', 'approved', 'superseded')),
  revision integer not null default 1,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app.application_profile_versions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references app.application_profiles(id) on delete cascade,
  version integer not null,
  snapshot jsonb not null,
  decision text not null check (decision in ('draft', 'approved', 'superseded')),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(profile_id, version)
);

create table if not exists app.application_required_materials (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references app.applications(id) on delete cascade,
  material_type text not null,
  label text not null,
  required boolean not null default true,
  status text not null default 'missing' check (status in ('missing', 'draft', 'ready', 'submitted', 'not_applicable')),
  artifact_version_id uuid references app.artifact_versions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  unique(application_id, material_type, label)
);

alter table app.application_profiles enable row level security;
alter table app.application_profile_versions enable row level security;
alter table app.application_required_materials enable row level security;

grant select, insert, update, delete on app.application_profiles to authenticated;
grant select, insert, update, delete on app.application_profile_versions to authenticated;
grant select, insert, update, delete on app.application_required_materials to authenticated;

create policy application_profiles_owner on app.application_profiles for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy application_profile_versions_owner on app.application_profile_versions for all to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy application_required_materials_owner on app.application_required_materials for all to authenticated
  using (exists (select 1 from app.applications a where a.id = application_id and a.owner_id = (select auth.uid())))
  with check (exists (select 1 from app.applications a where a.id = application_id and a.owner_id = (select auth.uid())));

create unique index if not exists application_profiles_one_default
  on app.application_profiles(owner_id) where is_default;
create index if not exists application_required_materials_application
  on app.application_required_materials(application_id, status);
