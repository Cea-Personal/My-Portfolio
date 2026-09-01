create table if not exists app.career_facts (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  fact_type text not null, subject_type text not null, subject_id uuid not null, current_version_id uuid,
  trust_level text not null default 'ai_inferred' check (trust_level in ('verified_document','owner_verified','corroborated','ai_extracted_reviewed','ai_extracted','ai_inferred')),
  review_status text not null default 'candidate' check (review_status in ('candidate','in_review','approved','edited_approved','rejected','deferred')),
  visibility text not null default 'private' check (visibility in ('public','private','restricted')), verified_by_owner boolean not null default false,
  valid_from date, valid_to date, superseded_by_id uuid references app.career_facts(id) on delete set null, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), revision integer not null default 0,
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);
create table if not exists app.career_fact_versions (
  id uuid primary key default gen_random_uuid(), fact_id uuid not null references app.career_facts(id) on delete restrict, version integer not null check (version > 0),
  statement text not null, structured_value jsonb not null default '{}'::jsonb, source_type text not null, extractor_version text, confidence numeric(4,3) check (confidence between 0 and 1),
  editor_actor text not null, edit_reason text, content_hash text not null, created_at timestamptz not null default now(), unique (fact_id, version)
);
alter table app.career_facts add constraint career_facts_current_version_fk foreign key (current_version_id) references app.career_fact_versions(id) on delete restrict;
create or replace function app.prevent_fact_version_update() returns trigger language plpgsql set search_path = pg_catalog, app as $$ begin raise exception 'career fact versions are append-only'; end; $$;
create trigger career_fact_versions_append_only before update or delete on app.career_fact_versions for each row execute function app.prevent_fact_version_update();
