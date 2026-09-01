do $$ declare table_name text; begin
  foreach table_name in array array['organizations','career_experiences','skills','projects','achievements','career_metrics','education_records','certifications','architecture_decisions','leadership_examples','career_facts','evidence_sources','documents','portfolio_projection_rules','ingestion_runs'] loop
    execute format('alter table app.%I enable row level security', table_name);
    execute format('create policy %I_owner on app.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))', table_name || '_owner', table_name);
  end loop;
end $$;
grant select on published.portfolio_publications, published.portfolio_items, published.public_evidence to anon, authenticated;
