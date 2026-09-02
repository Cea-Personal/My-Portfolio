create or replace function app.stage_portfolio_publication()
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, app, published
as $$
declare
  owner uuid := auth.uid();
  publication_id uuid;
  next_version bigint;
  projection jsonb;
begin
  if owner is null or not app.is_configured_owner() then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;

  select coalesce(max(version), 0) + 1 into next_version
  from published.portfolio_publications where owner_id = owner;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.id,
    'type', f.fact_type,
    'statement', v.statement,
    'structured', v.structured_value
  ) order by f.valid_from nulls last, f.created_at, f.id), '[]'::jsonb)
  into projection
  from app.career_facts f
  join app.career_fact_versions v on v.id = f.current_version_id
  where f.owner_id = owner
    and f.visibility = 'public'
    and f.review_status in ('approved', 'edited_approved')
    and f.verified_by_owner
    and exists (
      select 1
      from app.claim_evidence ce
      join app.evidence_chunks ec on ec.id = ce.evidence_chunk_id
      join app.evidence_versions ev on ev.id = ec.evidence_version_id
      join app.evidence_sources es on es.id = ev.evidence_source_id
      where ce.fact_version_id = v.id
        and ce.verification_status = 'verified'
        and ce.support_class in ('direct', 'transferable')
        and ec.visibility = 'public'
        and ec.deleted_at is null
        and es.visibility = 'public'
        and es.availability = 'available'
    );

  insert into published.portfolio_publications(
    owner_id, version, status, content_hash, schema_version, reviewed_at
  ) values (
    owner,
    next_version,
    'staged',
    encode(digest(projection::text, 'sha256'), 'hex'),
    'portfolio.v2',
    now()
  ) returning id into publication_id;

  insert into published.public_evidence(
    publication_id, public_evidence_id, safe_title, issuer, sanitized_excerpt,
    source_location_label, evidence_type, source_version_hash
  )
  select distinct on (ec.id)
    publication_id,
    'evidence-' || ec.id::text,
    left(es.title, 240),
    left(es.issuer, 240),
    left(ec.content, 480),
    case when ec.page_start is null then 'Verified source' else 'Page ' || ec.page_start::text end,
    es.source_type,
    coalesce(ev.raw_sha256, ev.normalized_text_sha256)
  from app.career_facts f
  join app.career_fact_versions v on v.id = f.current_version_id
  join app.claim_evidence ce on ce.fact_version_id = v.id
  join app.evidence_chunks ec on ec.id = ce.evidence_chunk_id
  join app.evidence_versions ev on ev.id = ec.evidence_version_id
  join app.evidence_sources es on es.id = ev.evidence_source_id
  where f.owner_id = owner
    and f.visibility = 'public'
    and f.review_status in ('approved', 'edited_approved')
    and f.verified_by_owner
    and ce.verification_status = 'verified'
    and ce.support_class in ('direct', 'transferable')
    and ec.visibility = 'public'
    and ec.deleted_at is null
    and es.visibility = 'public'
    and es.availability = 'available'
  order by ec.id, ce.created_at desc;

  insert into published.portfolio_items(
    publication_id, public_id, source_entity_type, source_entity_id, section,
    career_stage, display_order, title, public_summary, display_metric,
    display_technologies, public_citations, payload_schema_version
  )
  select
    publication_id,
    'fact-' || f.id::text,
    'career_fact',
    f.id,
    case
      when f.fact_type in ('experience', 'responsibility', 'achievement') then 'experience'
      when f.fact_type = 'project' then 'projects'
      when f.fact_type in ('blog', 'article') then 'blog'
      else 'about'
    end,
    nullif(v.structured_value->>'careerStage', ''),
    row_number() over (order by f.valid_from nulls last, f.created_at, f.id)::integer,
    initcap(replace(f.fact_type, '_', ' ')),
    v.statement,
    nullif(v.structured_value->>'metric', ''),
    case when jsonb_typeof(v.structured_value->'technologies') = 'array'
      then array(select jsonb_array_elements_text(v.structured_value->'technologies'))
      else '{}'::text[] end,
    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'evidenceId', 'evidence-' || ec.id::text,
        'label', left(es.title, 120)
      ) order by ce.created_at), '[]'::jsonb)
      from app.claim_evidence ce
      join app.evidence_chunks ec on ec.id = ce.evidence_chunk_id
      join app.evidence_versions ev on ev.id = ec.evidence_version_id
      join app.evidence_sources es on es.id = ev.evidence_source_id
      where ce.fact_version_id = v.id
        and ce.verification_status = 'verified'
        and ce.support_class in ('direct', 'transferable')
        and ec.visibility = 'public'
        and ec.deleted_at is null
        and es.visibility = 'public'
        and es.availability = 'available'
    ),
    'portfolio-item.v2'
  from app.career_facts f
  join app.career_fact_versions v on v.id = f.current_version_id
  where f.owner_id = owner
    and f.visibility = 'public'
    and f.review_status in ('approved', 'edited_approved')
    and f.verified_by_owner
    and exists (
      select 1 from app.claim_evidence ce
      join app.evidence_chunks ec on ec.id = ce.evidence_chunk_id
      join app.evidence_versions ev on ev.id = ec.evidence_version_id
      join app.evidence_sources es on es.id = ev.evidence_source_id
      where ce.fact_version_id = v.id
        and ce.verification_status = 'verified'
        and ce.support_class in ('direct', 'transferable')
        and ec.visibility = 'public' and ec.deleted_at is null
        and es.visibility = 'public' and es.availability = 'available'
    );

  return publication_id;
end;
$$;

create or replace function app.activate_portfolio_publication(target_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, app, published
as $$
declare owner uuid := auth.uid();
begin
  if owner is null or not app.is_configured_owner() then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from published.portfolio_publications
    where id = target_id and owner_id = owner and status in ('staged', 'withdrawn')
  ) then raise exception 'PUBLICATION_NOT_ACTIVATABLE' using errcode = 'P0002'; end if;
  perform 1 from published.portfolio_publications where owner_id = owner for update;
  update published.portfolio_publications
  set status = 'withdrawn', withdrawn_at = now()
  where owner_id = owner and status = 'published';
  update published.portfolio_publications
  set status = 'published', published_at = now(), withdrawn_at = null, reviewed_at = coalesce(reviewed_at, now())
  where id = target_id and owner_id = owner;
  return target_id;
end;
$$;

create or replace function app.withdraw_portfolio_publication(target_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, app, published
as $$
declare owner uuid := auth.uid();
begin
  if owner is null or not app.is_configured_owner() then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;
  update published.portfolio_publications
  set status = 'withdrawn', withdrawn_at = now()
  where id = target_id and owner_id = owner and status = 'published';
  if not found then raise exception 'ACTIVE_PUBLICATION_NOT_FOUND' using errcode = 'P0002'; end if;
  return target_id;
end;
$$;

revoke all on function app.stage_portfolio_publication() from public, anon;
revoke all on function app.activate_portfolio_publication(uuid) from public, anon;
revoke all on function app.withdraw_portfolio_publication(uuid) from public, anon;
grant execute on function app.stage_portfolio_publication() to authenticated;
grant execute on function app.activate_portfolio_publication(uuid) to authenticated;
grant execute on function app.withdraw_portfolio_publication(uuid) to authenticated;

notify pgrst, 'reload schema';
