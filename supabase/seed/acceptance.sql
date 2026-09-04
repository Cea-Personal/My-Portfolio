-- Acceptance fixtures are deterministic and synthetic; never place personal data or provider
-- credentials in this file. The first active configured owner is used when a harness has already
-- provisioned one (as in hosted acceptance). A local reset creates the fixed synthetic owner.

do $$
declare
  owner_id uuid;
  v_organization_id uuid := '00000000-0000-4000-8000-000000000010';
  v_experience_id uuid := '00000000-0000-4000-8000-000000000011';
  v_project_id uuid := '00000000-0000-4000-8000-000000000012';
  v_fact_id uuid := '00000000-0000-4000-8000-000000000013';
  v_fact_version_id uuid := '00000000-0000-4000-8000-000000000014';
  v_evidence_source_id uuid := '00000000-0000-4000-8000-000000000015';
  v_evidence_version_id uuid := '00000000-0000-4000-8000-000000000016';
  v_chunk_id uuid := '00000000-0000-4000-8000-000000000017';
  v_publication_id uuid := '00000000-0000-4000-8000-000000000018';
begin
  select user_id into owner_id
  from app.owner_authorizations
  where active
  order by granted_at
  limit 1;

  if owner_id is null then
    owner_id := '00000000-0000-4000-8000-000000000001';
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      owner_id, 'authenticated', 'authenticated', 'acceptance.owner@example.test',
      crypt('acceptance-only', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now()
    ) on conflict (id) do nothing;

    insert into app.owner_authorizations (user_id, active, note)
    values (owner_id, true, 'Synthetic acceptance owner')
    on conflict (user_id) do update set active = true, revoked_at = null;
  end if;

  insert into app.profiles (id, display_name, headline, bio, links)
  values (
    owner_id,
    'Acceptance Owner',
    'Data and AI Engineer',
    'Synthetic profile used only by automated acceptance tests.',
    '{"github":"https://example.test/acceptance","linkedin":"https://example.test/acceptance"}'
  ) on conflict (id) do nothing;

  insert into app.organizations (id, owner_id, canonical_name, public_name, visibility)
  values (v_organization_id, owner_id, 'Acceptance Systems', 'Acceptance Systems', 'public')
  on conflict (id) do nothing;

  insert into app.career_experiences (
    id, owner_id, organization_id, role_title, career_stage, start_date,
    end_date, approved_public_summary, visibility, display_order
  ) values (
    v_experience_id, owner_id, v_organization_id, 'Data Engineer', 'data-engineer',
    date '2024-01-01', null,
    'Built reliable data systems for synthetic acceptance workloads.',
    'public', 1
  ) on conflict (id) do nothing;

  insert into app.projects (
    id, owner_id, project_type, title, slug, experience_id, source_availability,
    public_description, links, visibility
  ) values (
    v_project_id, owner_id, 'personal', 'Acceptance Data Platform', 'acceptance-data-platform',
    v_experience_id, 'available',
    'A deterministic project fixture for public portfolio checks.',
    '[{"label":"Repository","url":"https://example.test/acceptance-data-platform"}]',
    'public'
  ) on conflict (id) do nothing;

  insert into app.career_facts (
    id, owner_id, fact_type, subject_type, subject_id, trust_level,
    review_status, visibility, verified_by_owner
  ) values (
    v_fact_id, owner_id, 'impact', 'experience', v_experience_id, 'owner_verified',
    'approved', 'public', true
  ) on conflict (id) do nothing;

  insert into app.career_fact_versions (
    id, fact_id, version, statement, source_type, editor_actor, content_hash
  ) values (
    v_fact_version_id, v_fact_id, 1,
    'Reduced synthetic pipeline latency by 40 percent.',
    'manual_fact', owner_id::text, 'sha256:acceptance-fact-v1'
  ) on conflict (id) do nothing;

  update app.career_facts
  set current_version_id = v_fact_version_id
  where id = v_fact_id and current_version_id is null;

  insert into app.evidence_sources (
    id, owner_id, source_type, title, visibility, trust_level, verification_state
  ) values (
    v_evidence_source_id, owner_id, 'acceptance_fixture', 'Acceptance evidence',
    'public', 'owner_verified', 'verified'
  ) on conflict (id) do nothing;

  insert into app.evidence_versions (
    id, evidence_source_id, ordinal, normalized_text_sha256, media_type,
    byte_size, parser_name, parser_version, processed_at, quarantine_status
  ) values (
    v_evidence_version_id, v_evidence_source_id, 1, 'sha256:acceptance-evidence-v1',
    'text/plain', 64, 'acceptance', '1.0.0', now(), 'approved'
  ) on conflict (id) do nothing;

  insert into app.evidence_chunks (
    id, evidence_version_id, ordinal, char_start, char_end, content,
    content_hash, visibility, trust_level
  ) values (
    v_chunk_id, v_evidence_version_id, 0, 0, 64,
    'Synthetic evidence: reduced pipeline latency by 40 percent.',
    'sha256:acceptance-chunk-v1', 'public', 'owner_verified'
  ) on conflict (id) do nothing;

  insert into app.claim_evidence (
    fact_version_id, evidence_chunk_id, exact_start, exact_end,
    support_class, verification_status, verifier_actor
  ) values (
    v_fact_version_id, v_chunk_id, 0, 64, 'direct', 'verified', owner_id::text
  ) on conflict do nothing;

  insert into published.portfolio_publications (
    id, owner_id, version, status, content_hash, schema_version,
    reviewed_at, published_at
  ) values (
    v_publication_id, owner_id, 1, 'published', 'sha256:acceptance-publication-v1',
    'portfolio.v1', now(), now()
  ) on conflict (id) do nothing;

  insert into published.portfolio_items (
    publication_id, public_id, source_entity_type, source_entity_id, section,
    career_stage, display_order, title, public_summary, display_technologies,
    public_citations, detail_slug
  ) values (
    v_publication_id, 'acceptance-project', 'project', v_project_id, 'projects',
    'data-engineer', 1, 'Acceptance Data Platform',
    'A deterministic project fixture for public portfolio checks.',
    array['PostgreSQL','pgvector'],
    '[{"public_evidence_id":"acceptance-evidence"}]', 'acceptance-data-platform'
  ) on conflict (publication_id, public_id) do nothing;

  insert into published.public_evidence (
    publication_id, public_evidence_id, safe_title, issuer, sanitized_excerpt,
    source_location_label, evidence_type, source_version_hash
  ) values (
    v_publication_id, 'acceptance-evidence', 'Acceptance evidence', 'Acceptance Systems',
    'Reduced synthetic pipeline latency by 40 percent.', 'Acceptance fixture',
    'impact', 'sha256:acceptance-evidence-v1'
  ) on conflict (publication_id, public_evidence_id) do nothing;
end;
$$;
