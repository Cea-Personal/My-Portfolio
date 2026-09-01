-- Convergence integrity: enforce ownership across relationship tables and
-- protect immutable source/history rows.  The policies in 0090 provide the
-- authenticated access path; these restrictive policies make the relationship
-- predicates mandatory even when an older permissive policy also exists.

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
    'claim_evidence', 'document_versions', 'fact_reviews', 'job_descriptions',
    'job_scores', 'job_status_history', 'application_status_history',
    'application_answer_versions', 'application_package_items', 'artifact_versions',
    'artifact_reviews', 'artifact_submitted_snapshots', 'compensation_sources',
    'compensation_benchmarks', 'compensation_recommendations', 'journal_versions',
    'interview_stage_history', 'preparation_kits', 'post_versions',
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

-- Child ownership map.  Every expression is evaluated against the row being
-- written/read and the authenticated owner.  Nullable references are allowed
-- only when the relationship is intentionally optional.
do $$
declare
  item record;
begin
  for item in
    select * from (values
      ('experience_skills', '(exists (select 1 from app.career_experiences p join app.skills s on s.id = skill_id where p.id = experience_id and p.owner_id = (select auth.uid()) and s.owner_id = (select auth.uid())))'),
      ('project_skills', '(exists (select 1 from app.projects p join app.skills s on s.id = skill_id where p.id = project_id and p.owner_id = (select auth.uid()) and s.owner_id = (select auth.uid())))'),
      ('career_fact_versions', '(exists (select 1 from app.career_facts p where p.id = fact_id and p.owner_id = (select auth.uid())))'),
      ('evidence_versions', '(exists (select 1 from app.evidence_sources p where p.id = evidence_source_id and p.owner_id = (select auth.uid())))'),
      ('evidence_chunks', '(exists (select 1 from app.evidence_versions v join app.evidence_sources s on s.id = v.evidence_source_id where v.id = evidence_version_id and s.owner_id = (select auth.uid())))'),
      ('chunk_embeddings', '(exists (select 1 from app.evidence_chunks c join app.evidence_versions v on v.id = c.evidence_version_id join app.evidence_sources s on s.id = v.evidence_source_id where c.id = chunk_id and s.owner_id = (select auth.uid())))'),
      ('claim_evidence', '(exists (select 1 from app.career_fact_versions v join app.career_facts f on f.id = v.fact_id where v.id = fact_version_id and f.owner_id = (select auth.uid())) and exists (select 1 from app.evidence_chunks c join app.evidence_versions v on v.id = c.evidence_version_id join app.evidence_sources s on s.id = v.evidence_source_id where c.id = evidence_chunk_id and s.owner_id = (select auth.uid())))'),
      ('document_versions', '(exists (select 1 from app.documents d where d.id = document_id and d.owner_id = (select auth.uid())) and (evidence_version_id is null or exists (select 1 from app.evidence_versions v join app.evidence_sources s on s.id = v.evidence_source_id where v.id = evidence_version_id and s.owner_id = (select auth.uid()))))'),
      ('ingestion_items', '(exists (select 1 from app.ingestion_runs r where r.id = run_id and r.owner_id = (select auth.uid())) and exists (select 1 from app.documents d where d.id = document_id and d.owner_id = (select auth.uid())))'),
      ('extracted_facts', '(exists (select 1 from app.ingestion_items i join app.ingestion_runs r on r.id = i.run_id where i.id = ingestion_item_id and r.owner_id = (select auth.uid())))'),
      ('fact_reviews', '(exists (select 1 from app.extracted_facts x join app.ingestion_items i on i.id = x.ingestion_item_id join app.ingestion_runs r on r.id = i.run_id where x.id = extracted_fact_id and r.owner_id = (select auth.uid())) and reviewer_id = (select auth.uid()) and (edited_fact_version_id is null or exists (select 1 from app.career_fact_versions v join app.career_facts f on f.id = v.fact_id where v.id = edited_fact_version_id and f.owner_id = (select auth.uid()))))'),
      ('retrieval_candidates', '(exists (select 1 from app.retrieval_runs r where r.id = run_id and r.owner_id = (select auth.uid())) and (evidence_chunk_id is null or exists (select 1 from app.evidence_chunks c join app.evidence_versions v on v.id = c.evidence_version_id join app.evidence_sources s on s.id = v.evidence_source_id where c.id = evidence_chunk_id and s.owner_id = (select auth.uid()))))'),
      ('ai_claims', '(exists (select 1 from app.ai_runs r where r.id = run_id and r.owner_id = (select auth.uid())))'),
      ('ai_citations', '(exists (select 1 from app.ai_claims c join app.ai_runs r on r.id = c.run_id where c.id = claim_id and r.owner_id = (select auth.uid())) and (evidence_chunk_id is null or exists (select 1 from app.evidence_chunks c join app.evidence_versions v on v.id = c.evidence_version_id join app.evidence_sources s on s.id = v.evidence_source_id where c.id = evidence_chunk_id and s.owner_id = (select auth.uid()))))'),
      ('job_source_configs', '(exists (select 1 from app.job_sources s where s.id = source_id and s.owner_id = (select auth.uid())))'),
      ('job_search_run_sources', '(exists (select 1 from app.job_search_runs r join app.job_sources s on s.id = source_id where r.id = run_id and r.owner_id = (select auth.uid()) and s.owner_id = (select auth.uid())))'),
      ('job_descriptions', '(exists (select 1 from app.jobs j where j.id = job_id and j.owner_id = (select auth.uid())))'),
      ('job_source_references', '(exists (select 1 from app.jobs j join app.job_sources s on s.id = source_id where j.id = job_id and j.owner_id = (select auth.uid()) and s.owner_id = (select auth.uid())))'),
      ('job_requirements', '(exists (select 1 from app.job_descriptions d join app.jobs j on j.id = d.job_id where d.id = description_id and j.owner_id = (select auth.uid())))'),
      ('job_requirement_matches', '(exists (select 1 from app.job_requirements q join app.job_descriptions d on d.id = q.description_id join app.jobs j on j.id = d.job_id where q.id = requirement_id and j.owner_id = (select auth.uid())) and (run_id is null or exists (select 1 from app.ai_runs r where r.id = run_id and r.owner_id = (select auth.uid()))))'),
      ('job_scores', '(exists (select 1 from app.jobs j where j.id = job_id and j.owner_id = (select auth.uid())))'),
      ('job_status_history', '(exists (select 1 from app.jobs j where j.id = job_id and j.owner_id = (select auth.uid())))'),
      ('application_status_history', '(exists (select 1 from app.applications a where a.id = application_id and a.owner_id = (select auth.uid())))'),
      ('application_forms', '(exists (select 1 from app.applications a where a.id = application_id and a.owner_id = (select auth.uid())))'),
      ('application_fields', '(exists (select 1 from app.application_forms f join app.applications a on a.id = f.application_id where f.id = form_id and a.owner_id = (select auth.uid())))'),
      ('application_answer_versions', '(exists (select 1 from app.application_fields f join app.application_forms af on af.id = f.form_id join app.applications a on a.id = af.application_id where f.id = field_id and a.owner_id = (select auth.uid())))'),
      ('application_documents', '(owner_id = (select auth.uid()) and exists (select 1 from app.applications a where a.id = application_id and a.owner_id = (select auth.uid())))'),
      ('application_packages', '(exists (select 1 from app.applications a where a.id = application_id and a.owner_id = (select auth.uid())))'),
      ('application_package_items', '(exists (select 1 from app.application_packages p join app.applications a on a.id = p.application_id where p.id = package_id and a.owner_id = (select auth.uid())) and (artifact_version_id is null or exists (select 1 from app.artifact_versions v join app.generated_artifacts g on g.id = v.artifact_id where v.id = artifact_version_id and g.owner_id = (select auth.uid()))))'),
      ('artifact_versions', '(exists (select 1 from app.generated_artifacts a where a.id = artifact_id and a.owner_id = (select auth.uid())))'),
      ('artifact_reviews', '(owner_id = (select auth.uid()) and exists (select 1 from app.artifact_versions v join app.generated_artifacts a on a.id = v.artifact_id where v.id = artifact_version_id and a.owner_id = (select auth.uid())))'),
      ('artifact_submitted_snapshots', '(owner_id = (select auth.uid()) and exists (select 1 from app.artifact_versions v join app.generated_artifacts a on a.id = v.artifact_id where v.id = artifact_version_id and a.owner_id = (select auth.uid())))'),
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
      ('post_publication_approvals', '(exists (select 1 from app.posts p where p.id = post_id and p.owner_id = (select auth.uid())) and reviewer_id = (select auth.uid()))'),
      ('automation_run_steps', '(exists (select 1 from app.automation_runs r where r.id = run_id and r.owner_id = (select auth.uid())))'),
      ('automation_notifications', '(owner_id = (select auth.uid()) and (run_id is null or exists (select 1 from app.automation_runs r where r.id = run_id and r.owner_id = (select auth.uid()))))'),
      ('automation_dead_letters', '(owner_id = (select auth.uid()))')
    ) as mappings(table_name, expression)
  loop
    if to_regclass(format('app.%I', item.table_name)) is not null then
      -- Add a permissive policy only where 0090 did not already add one.
      if not exists (
        select 1 from pg_policies
        where schemaname = 'app' and tablename = item.table_name and policyname = 'convergence_parent_owner'
      ) then
        execute format(
          'create policy convergence_parent_owner on app.%I for all to authenticated using %s with check %s',
          item.table_name, item.expression, item.expression
        );
      end if;
      if not exists (
        select 1 from pg_policies
        where schemaname = 'app' and tablename = item.table_name and policyname = 'convergence_owner_consistency'
      ) then
        execute format(
          'create policy convergence_owner_consistency on app.%I as restrictive for all to authenticated using %s with check %s',
          item.table_name, item.expression, item.expression
        );
      end if;
    end if;
  end loop;
end;
$$;

-- A chunk cannot be more public than its source.  This prevents a private or
-- restricted source from becoming retrievable through a public chunk row.
create or replace function app.enforce_evidence_chunk_visibility()
returns trigger
language plpgsql
set search_path = pg_catalog, app
as $$
declare
  source_visibility text;
  source_rank integer;
  chunk_rank integer;
begin
  select s.visibility into source_visibility
  from app.evidence_versions v
  join app.evidence_sources s on s.id = v.evidence_source_id
  where v.id = new.evidence_version_id;
  if source_visibility is null then
    raise exception 'evidence source is required' using errcode = '23503';
  end if;
  source_rank := case source_visibility when 'public' then 0 when 'restricted' then 1 when 'private' then 2 else 99 end;
  chunk_rank := case new.visibility when 'public' then 0 when 'restricted' then 1 when 'private' then 2 else 99 end;
  if chunk_rank < source_rank then
    raise exception 'evidence chunk visibility cannot be broader than its source' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists evidence_chunks_visibility_guard on app.evidence_chunks;
create trigger evidence_chunks_visibility_guard
before insert or update of evidence_version_id, visibility on app.evidence_chunks
for each row execute function app.enforce_evidence_chunk_visibility();

alter table app.evidence_versions drop constraint if exists evidence_versions_quarantine_status_check;
alter table app.evidence_versions add constraint evidence_versions_quarantine_status_check
  check (quarantine_status in ('pending', 'approved', 'quarantined', 'rejected'));
alter table app.evidence_chunks drop constraint if exists evidence_chunks_visibility_check;
alter table app.evidence_chunks add constraint evidence_chunks_visibility_check
  check (visibility in ('public', 'restricted', 'private'));

create index if not exists retrieval_candidates_run_chunk on app.retrieval_candidates(run_id, evidence_chunk_id);
create index if not exists ai_citations_claim_chunk on app.ai_citations(claim_id, evidence_chunk_id);
create index if not exists application_package_items_artifact on app.application_package_items(artifact_version_id);
create unique index if not exists job_scores_job_type_version
  on app.job_scores(job_id, score_type, calculation_version);
