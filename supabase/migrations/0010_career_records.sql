create table if not exists app.organizations (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  canonical_name text not null, public_name text, industry text, location text, website text,
  visibility text not null default 'private' check (visibility in ('public','private','restricted')),
  normalized_name text generated always as (lower(regexp_replace(canonical_name, '\\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision integer not null default 0
);
create unique index if not exists organization_owner_name on app.organizations(owner_id, normalized_name);

create table if not exists app.career_experiences (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  organization_id uuid references app.organizations(id) on delete set null, role_title text not null,
  career_stage text, employment_type text, start_date date, end_date date, is_current boolean not null default false,
  private_summary text, approved_public_summary text, display_order integer not null default 0,
  visibility text not null default 'private' check (visibility in ('public','private','restricted')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision integer not null default 0,
  check (end_date is null or start_date is null or end_date >= start_date)
);
create table if not exists app.skills (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  name text not null, category text, aliases text[] not null default '{}', description text,
  visibility text not null default 'private' check (visibility in ('public','private','restricted')),
  normalized_name text generated always as (lower(regexp_replace(name, '\\s+', ' ', 'g'))) stored,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision integer not null default 0
);
create unique index if not exists skill_owner_name on app.skills(owner_id, normalized_name);
create table if not exists app.experience_skills (
  experience_id uuid not null references app.career_experiences(id) on delete cascade,
  skill_id uuid not null references app.skills(id) on delete cascade, evidence_strength numeric(4,3) check (evidence_strength between 0 and 1),
  first_used_date date, last_used_date date, claim_id uuid, primary key (experience_id, skill_id)
);
create table if not exists app.projects (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  project_type text not null check (project_type in ('personal','open_source','professional')), title text not null,
  slug text not null, organization_id uuid references app.organizations(id) on delete set null,
  experience_id uuid references app.career_experiences(id) on delete set null, source_availability text not null default 'available',
  private_description text, public_description text, contribution_type text, start_date date, end_date date,
  links jsonb not null default '[]'::jsonb, architecture_reference jsonb, visibility text not null default 'private' check (visibility in ('public','private','restricted')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision integer not null default 0,
  unique (owner_id, slug)
);
create table if not exists app.project_skills (
  project_id uuid not null references app.projects(id) on delete cascade, skill_id uuid not null references app.skills(id) on delete cascade,
  evidence_strength numeric(4,3) check (evidence_strength between 0 and 1), claim_id uuid, primary key (project_id, skill_id)
);
create table if not exists app.achievements (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  experience_id uuid references app.career_experiences(id) on delete set null, project_id uuid references app.projects(id) on delete set null,
  statement text not null, action text, outcome text, business_context text, contribution_type text, controlling_claim_id uuid,
  visibility text not null default 'private' check (visibility in ('public','private','restricted')), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision integer not null default 0
);
create table if not exists app.career_metrics (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  achievement_id uuid references app.achievements(id) on delete cascade, project_id uuid references app.projects(id) on delete cascade,
  value numeric, unit text not null, direction text, baseline text, timeframe text, context text, attribution text,
  display_text text not null, visibility text not null default 'private' check (visibility in ('public','private','restricted')), controlling_claim_id uuid,
  check (value is not null or display_text is not null)
);
create table if not exists app.education_records (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  institution text not null, qualification text not null, subject text, start_date date, end_date date, status text, visibility text not null default 'private', claim_id uuid
);
create table if not exists app.certifications (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  issuer text not null, name text not null, issued_date date, expiry_date date, credential_identifier text, credential_url text, visibility text not null default 'private', claim_id uuid
);
create table if not exists app.architecture_decisions (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  experience_id uuid references app.career_experiences(id) on delete set null, project_id uuid references app.projects(id) on delete set null,
  title text not null, context text, decision text not null, alternatives text, outcome text, sanitized_public_summary text, visibility text not null default 'private', claim_id uuid
);
create table if not exists app.leadership_examples (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  experience_id uuid references app.career_experiences(id) on delete set null, project_id uuid references app.projects(id) on delete set null,
  situation text not null, owner_contribution text not null, team_context text, outcome text, visibility text not null default 'private', claim_id uuid
);
