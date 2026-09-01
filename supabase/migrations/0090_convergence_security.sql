-- Convergence hardening: close the child-table and immutable-history gaps while
-- preserving the existing migration order as the schema authority.

create or replace function app.prevent_append_only_mutation()
returns trigger
language plpgsql
set search_path = pg_catalog, app
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = '55006';
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'career_fact_versions', 'evidence_versions', 'evidence_chunks', 'chunk_embeddings',
    'claim_evidence', 'document_versions', 'fact_reviews', 'job_status_history',
    'application_status_history', 'application_answer_versions', 'artifact_versions',
    'journal_versions', 'interview_stage_history', 'preparation_kits', 'post_versions',
    'post_publication_approvals', 'analytics_events', 'audit_events'
  ] loop
    if to_regclass(format('app.%I', table_name)) is not null
       and not exists (
         select 1 from pg_trigger
         where tgrelid = format('app.%I', table_name)::regclass
           and tgname = table_name || '_append_only'
       ) then
      execute format(
        'create trigger %I before update or delete on app.%I for each row execute function app.prevent_append_only_mutation()',
        table_name || '_append_only', table_name
      );
    end if;
  end loop;
end;
$$;

-- Every table carrying an owner_id receives an explicit owner policy. Existing
-- policies remain in place; this named policy makes the invariant auditable and
-- protects tables added by later feature migrations.
do $$
declare
  v_table_name text;
begin
  for v_table_name in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'app' and c.column_name = 'owner_id'
    group by c.table_name
  loop
    execute format('alter table app.%I enable row level security', v_table_name);
    if not exists (
      select 1 from pg_policies
      where schemaname = 'app' and tablename = v_table_name and policyname = 'convergence_owner'
    ) then
      execute format(
        'create policy convergence_owner on app.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
        v_table_name
      );
    end if;
  end loop;
end;
$$;

-- Child records inherit ownership through their parent. The expressions are
-- intentionally explicit so a child cannot be used to pivot across owners.
do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('experience_skills', '(exists (select 1 from app.career_experiences p where p.id = experience_id and p.owner_id = (select auth.uid())))'),
      ('project_skills', '(exists (select 1 from app.projects p where p.id = project_id and p.owner_id = (select auth.uid())))'),
      ('career_fact_versions', '(exists (select 1 from app.career_facts p where p.id = fact_id and p.owner_id = (select auth.uid())))'),
      ('evidence_versions', '(exists (select 1 from app.evidence_sources p where p.id = evidence_source_id and p.owner_id = (select auth.uid())))'),
      ('evidence_chunks', '(exists (select 1 from app.evidence_versions v join app.evidence_sources s on s.id = v.evidence_source_id where v.id = evidence_version_id and s.owner_id = (select auth.uid())))'),
      ('chunk_embeddings', '(exists (select 1 from app.evidence_chunks c join app.evidence_versions v on v.id = c.evidence_version_id join app.evidence_sources s on s.id = v.evidence_source_id where c.id = chunk_id and s.owner_id = (select auth.uid())))'),
      ('claim_evidence', '(exists (select 1 from app.career_fact_versions v join app.career_facts f on f.id = v.fact_id where v.id = fact_version_id and f.owner_id = (select auth.uid())))'),
      ('document_versions', '(exists (select 1 from app.documents d where d.id = document_id and d.owner_id = (select auth.uid())))'),
      ('ingestion_items', '(exists (select 1 from app.ingestion_runs r where r.id = run_id and r.owner_id = (select auth.uid())))'),
      ('extracted_facts', '(exists (select 1 from app.ingestion_items i join app.ingestion_runs r on r.id = i.run_id where i.id = ingestion_item_id and r.owner_id = (select auth.uid())))'),
      ('fact_reviews', '(exists (select 1 from app.extracted_facts x join app.ingestion_items i on i.id = x.ingestion_item_id join app.ingestion_runs r on r.id = i.run_id where x.id = extracted_fact_id and r.owner_id = (select auth.uid())))'),
      ('job_source_configs', '(exists (select 1 from app.job_sources s where s.id = source_id and s.owner_id = (select auth.uid())))'),
      ('automation_schedules', '(owner_id = (select auth.uid()))'),
      ('job_search_run_sources', '(exists (select 1 from app.job_search_runs r where r.id = run_id and r.owner_id = (select auth.uid())))'),
      ('job_descriptions', '(exists (select 1 from app.jobs j where j.id = job_id and j.owner_id = (select auth.uid())))'),
      ('job_source_references', '(exists (select 1 from app.jobs j where j.id = job_id and j.owner_id = (select auth.uid())))'),
      ('job_requirements', '(exists (select 1 from app.job_descriptions d join app.jobs j on j.id = d.job_id where d.id = description_id and j.owner_id = (select auth.uid())))'),
      ('job_requirement_matches', '(exists (select 1 from app.job_requirements q join app.job_descriptions d on d.id = q.description_id join app.jobs j on j.id = d.job_id where q.id = requirement_id and j.owner_id = (select auth.uid())))'),
      ('job_scores', '(exists (select 1 from app.jobs j where j.id = job_id and j.owner_id = (select auth.uid())))'),
      ('job_status_history', '(exists (select 1 from app.jobs j where j.id = job_id and j.owner_id = (select auth.uid())))'),
      ('application_status_history', '(exists (select 1 from app.applications a where a.id = application_id and a.owner_id = (select auth.uid())))'),
      ('application_forms', '(exists (select 1 from app.applications a where a.id = application_id and a.owner_id = (select auth.uid())))'),
      ('application_fields', '(exists (select 1 from app.application_forms f join app.applications a on a.id = f.application_id where f.id = form_id and a.owner_id = (select auth.uid())))'),
      ('application_answer_versions', '(exists (select 1 from app.application_fields f join app.application_forms af on af.id = f.form_id join app.applications a on a.id = af.application_id where f.id = field_id and a.owner_id = (select auth.uid())))'),
      ('saved_answers', '(owner_id = (select auth.uid()))'),
      ('generated_artifacts', '(owner_id = (select auth.uid()))'),
      ('artifact_versions', '(exists (select 1 from app.generated_artifacts a where a.id = artifact_id and a.owner_id = (select auth.uid())))'),
      ('artifact_evidence', '(exists (select 1 from app.artifact_versions v join app.generated_artifacts a on a.id = v.artifact_id where v.id = artifact_version_id and a.owner_id = (select auth.uid())))'),
      ('application_packages', '(exists (select 1 from app.applications a where a.id = application_id and a.owner_id = (select auth.uid())))'),
      ('application_package_items', '(exists (select 1 from app.application_packages p join app.applications a on a.id = p.application_id where p.id = package_id and a.owner_id = (select auth.uid())))'),
      ('compensation_benchmarks', '(exists (select 1 from app.compensation_sources s where s.id = source_id and s.owner_id = (select auth.uid())))'),
      ('journal_versions', '(exists (select 1 from app.journal_entries e where e.id = entry_id and e.owner_id = (select auth.uid())))'),
      ('journal_tags', '(exists (select 1 from app.journal_entries e where e.id = entry_id and e.owner_id = (select auth.uid())))'),
      ('journal_insights', '(exists (select 1 from app.journal_entries e where e.id = entry_id and e.owner_id = (select auth.uid())))'),
      ('interview_stages', '(exists (select 1 from app.interview_processes p where p.id = process_id and p.owner_id = (select auth.uid())))'),
      ('interview_stage_history', '(exists (select 1 from app.interview_stages s join app.interview_processes p on p.id = s.process_id where s.id = stage_id and p.owner_id = (select auth.uid())))'),
      ('preparation_kits', '(exists (select 1 from app.interview_stages s join app.interview_processes p on p.id = s.process_id where s.id = stage_id and p.owner_id = (select auth.uid())))'),
      ('mock_interviews', '(exists (select 1 from app.interview_stages s join app.interview_processes p on p.id = s.process_id where s.id = stage_id and p.owner_id = (select auth.uid())))'),
      ('post_versions', '(exists (select 1 from app.posts p where p.id = post_id and p.owner_id = (select auth.uid())))'),
      ('post_tags', '(exists (select 1 from app.posts p where p.id = post_id and p.owner_id = (select auth.uid())))'),
      ('post_publication_approvals', '(exists (select 1 from app.posts p where p.id = post_id and p.owner_id = (select auth.uid())))'),
      ('automation_run_steps', '(exists (select 1 from app.automation_runs r where r.id = run_id and r.owner_id = (select auth.uid())))'),
      ('automation_notifications', '(owner_id = (select auth.uid()))'),
      ('automation_dead_letters', '(owner_id = (select auth.uid()))')
    ) as mappings(table_name, expression)
  loop
    if to_regclass(format('app.%I', item.table_name)) is not null then
      execute format('alter table app.%I enable row level security', item.table_name);
      if not exists (
        select 1 from pg_policies
        where schemaname = 'app' and tablename = item.table_name and policyname = 'convergence_parent_owner'
      ) then
        execute format(
          'create policy convergence_parent_owner on app.%I for all to authenticated using %s with check %s',
          item.table_name, item.expression, item.expression
        );
      end if;
    end if;
  end loop;
end;
$$;

-- The foundation migration intentionally starts with a closed `app` schema.
-- Re-open only the authenticated data path now that every table has an RLS
-- policy; without schema/table grants, the owner API cannot reach Supabase
-- Cloud with a user JWT even when the policy itself is correct.
grant usage on schema app to authenticated;
do $$
declare
  table_name text;
begin
  for table_name in
    select tablename from pg_tables where schemaname = 'app'
  loop
    execute format(
      'grant select, insert, update, delete on table app.%I to authenticated',
      table_name
    );
  end loop;
end;
$$;
grant select, insert, update, delete on published.portfolio_publications,
  published.portfolio_items, published.public_evidence to authenticated;

-- `idempotency_keys` has no revision column, so replace the foundation
-- revision trigger with a timestamp-only trigger before replay rows are
-- updated by the API.
create or replace function app.touch_idempotency_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, app
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
drop trigger if exists idempotency_updated_at on app.idempotency_keys;
create trigger idempotency_updated_at before update on app.idempotency_keys
for each row execute function app.touch_idempotency_updated_at();

-- Publication rows are readable only while active. Owner writes are separate
-- from the anonymous read policy and are still constrained by owner_id.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['portfolio_publications','portfolio_items','public_evidence'] loop
    execute format('alter table published.%I enable row level security', table_name);
  end loop;
  if not exists (select 1 from pg_policies where schemaname = 'published' and tablename = 'portfolio_publications' and policyname = 'convergence_owner_write') then
    create policy convergence_owner_write on published.portfolio_publications for all to authenticated
      using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'published' and tablename = 'portfolio_items' and policyname = 'convergence_owner_write') then
    create policy convergence_owner_write on published.portfolio_items for all to authenticated
      using (exists (select 1 from published.portfolio_publications p where p.id = publication_id and p.owner_id = (select auth.uid())))
      with check (exists (select 1 from published.portfolio_publications p where p.id = publication_id and p.owner_id = (select auth.uid())));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'published' and tablename = 'public_evidence' and policyname = 'convergence_owner_write') then
    create policy convergence_owner_write on published.public_evidence for all to authenticated
      using (exists (select 1 from published.portfolio_publications p where p.id = publication_id and p.owner_id = (select auth.uid())))
      with check (exists (select 1 from published.portfolio_publications p where p.id = publication_id and p.owner_id = (select auth.uid())));
  end if;
end;
$$;

-- Keep provider configuration, prompt templates, evaluations, and aggregate
-- metrics service-owned; they must never become a client-side data source.
revoke all on app.ai_provider_configs, app.prompt_versions, app.ai_evaluations, app.analytics_daily_metrics from anon, authenticated;
revoke all on app.outbox_events from anon, authenticated;

create index if not exists career_facts_owner_review_visibility
  on app.career_facts(owner_id, review_status, visibility, updated_at desc);
create index if not exists evidence_sources_owner_visibility
  on app.evidence_sources(owner_id, visibility, availability);
create index if not exists public_items_publication_section_order
  on published.portfolio_items(publication_id, section, display_order);

alter table app.idempotency_keys drop constraint if exists idempotency_keys_key_check;
alter table app.idempotency_keys add constraint idempotency_keys_key_check
  check (key ~ '^[A-Za-z0-9._:-]{16,128}$');

create table if not exists app.artifact_reviews (
  id uuid primary key default gen_random_uuid(),
  artifact_version_id uuid not null references app.artifact_versions(id) on delete restrict,
  owner_id uuid not null references app.profiles(id) on delete cascade,
  decision text not null check (decision in ('approved', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists app.artifact_submitted_snapshots (
  id uuid primary key default gen_random_uuid(),
  artifact_version_id uuid not null references app.artifact_versions(id) on delete restrict,
  owner_id uuid not null references app.profiles(id) on delete cascade,
  snapshot_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists app.export_requests (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed', 'expired')),
  format text not null default 'json' check (format in ('json', 'zip')),
  object_key text,
  manifest_hash text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table app.artifact_reviews enable row level security;
alter table app.artifact_submitted_snapshots enable row level security;
alter table app.export_requests enable row level security;
grant select, insert on app.artifact_reviews, app.artifact_submitted_snapshots to authenticated;
grant select, insert, update on app.export_requests to authenticated;
create policy artifact_reviews_owner on app.artifact_reviews for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy artifact_snapshots_owner on app.artifact_submitted_snapshots for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
create policy export_requests_owner on app.export_requests for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
revoke all on app.export_requests from anon;
