-- The local Codex Supabase MCP bridge is deliberately read-only.  It uses the
-- service role from a local process, but PostgREST still requires explicit
-- table privileges even when RLS is bypassed.  Grant only the bounded read
-- graph exposed by the bridge; no insert, update, delete, storage, or SQL
-- execution privileges are added.
grant usage on schema app, published to service_role;

grant select on table
  app.owner_authorizations,
  app.profiles,
  app.organizations,
  app.career_experiences,
  app.skills,
  app.experience_skills,
  app.projects,
  app.project_skills,
  app.achievements,
  app.career_metrics,
  app.education_records,
  app.certifications,
  app.architecture_decisions,
  app.leadership_examples,
  app.career_facts,
  app.career_fact_versions,
  app.career_brain_snapshots,
  app.evidence_sources,
  app.evidence_versions,
  app.evidence_chunks
to service_role;

grant select on table
  published.portfolio_publications,
  published.portfolio_items,
  published.public_evidence,
  published.blog_posts
to service_role;

notify pgrst, 'reload schema';
