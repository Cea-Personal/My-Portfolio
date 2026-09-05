create table if not exists app.career_brain_snapshots (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  source_hash text not null,
  content jsonb not null,
  focus_jobs jsonb not null default '[]'::jsonb,
  provider text,
  model text,
  model_version text,
  input_hash text,
  output_hash text,
  generated_at timestamptz not null default now(),
  unique(owner_id, source_hash)
);

create table if not exists app.career_brain_public_selections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  item_key text not null,
  item_type text not null check (item_type in (
    'experience', 'project', 'certification', 'skill', 'portfolio_summary', 'about'
  )),
  public_eligible boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(owner_id, item_key)
);

alter table published.portfolio_items
  add column if not exists structured_content jsonb not null default '{}'::jsonb;

update app.extracted_facts
set review_status = 'available_private'
where review_status = 'candidate';

alter table app.career_brain_snapshots enable row level security;
alter table app.career_brain_public_selections enable row level security;

grant select, insert on app.career_brain_snapshots to authenticated;
grant select, insert, update, delete on app.career_brain_public_selections to authenticated;
grant select, insert on app.career_brain_snapshots to service_role;
grant select, insert, update, delete on app.career_brain_public_selections to service_role;

create policy career_brain_snapshots_owner on app.career_brain_snapshots
for all to authenticated
using (owner_id = (select auth.uid()) and app.is_configured_owner())
with check (owner_id = (select auth.uid()) and app.is_configured_owner());

create policy career_brain_selections_owner on app.career_brain_public_selections
for all to authenticated
using (owner_id = (select auth.uid()) and app.is_configured_owner())
with check (owner_id = (select auth.uid()) and app.is_configured_owner());

create index if not exists career_brain_snapshots_latest
  on app.career_brain_snapshots(owner_id, generated_at desc);

create or replace function app.match_owner_private_evidence(
  requested_owner uuid,
  requested_embedding vector(1536),
  requested_provider text,
  requested_model text,
  requested_model_version text,
  requested_kinds text[] default null,
  requested_limit integer default 12,
  requested_min_similarity real default 0.20
)
returns table(
  chunk_id uuid, evidence_source_id uuid, document_id uuid, document_kind text,
  source_title text, content text, page_start integer, page_end integer,
  section_path text[], similarity real
)
language sql
stable
security definer
set search_path = pg_catalog, app, public
as $$
  select
    chunk.id, source.id, document.id, coalesce(document.document_kind, 'other'),
    source.title, chunk.content, chunk.page_start, chunk.page_end, chunk.section_path,
    (1 - (embedding.embedding <=> requested_embedding))::real
  from app.chunk_embeddings embedding
  join app.evidence_chunks chunk on chunk.id = embedding.chunk_id
  join app.evidence_versions version on version.id = chunk.evidence_version_id
  join app.evidence_sources source on source.id = version.evidence_source_id
  left join app.document_versions document_version on document_version.evidence_version_id = version.id
  left join app.documents document on document.id = document_version.document_id
  where source.owner_id = requested_owner
    and exists (
      select 1 from app.owner_authorizations authz
      where authz.user_id = requested_owner and authz.active
    )
    and source.availability = 'available' and chunk.deleted_at is null
    and embedding.status = 'completed' and embedding.provider = requested_provider
    and embedding.model = requested_model and embedding.model_version = requested_model_version
    and (requested_kinds is null or coalesce(document.document_kind, 'other') = any(requested_kinds))
    and 1 - (embedding.embedding <=> requested_embedding) >= requested_min_similarity
  order by embedding.embedding <=> requested_embedding, chunk.id
  limit least(greatest(requested_limit, 1), 50);
$$;

revoke all on function app.match_owner_private_evidence(uuid,vector,text,text,text,text[],integer,real)
  from public, anon, authenticated;
grant execute on function app.match_owner_private_evidence(uuid,vector,text,text,text,text[],integer,real)
  to service_role;

create or replace function app.stage_career_brain_items(target_publication_id uuid)
returns integer
language plpgsql
security definer
set search_path = pg_catalog, app, published
as $$
declare
  owner uuid := auth.uid();
  snapshot_id uuid;
  snapshot jsonb;
  inserted_count integer := 0;
begin
  if owner is null or not app.is_configured_owner() then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from published.portfolio_publications
    where id = target_publication_id and owner_id = owner and status = 'staged'
  ) then
    raise exception 'STAGED_PUBLICATION_REQUIRED' using errcode = 'P0002';
  end if;

  select id, content into snapshot_id, snapshot
  from app.career_brain_snapshots
  where owner_id = owner
  order by generated_at desc
  limit 1;
  if snapshot_id is null then return 0; end if;

  with generated_items as (
    select
      item->>'id' item_key, 'experience' item_type, 'experience' section,
      coalesce(nullif(item->>'role', ''), 'Experience') title,
      nullif(item->>'organization', '') subtitle,
      coalesce(nullif(item->>'summary', ''), 'Career experience') summary,
      nullif(item->>'role', '') career_stage,
      case when jsonb_typeof(item->'technologies') = 'array'
        then array(select jsonb_array_elements_text(item->'technologies')) else '{}'::text[] end technologies,
      item structured
    from jsonb_array_elements(coalesce(snapshot->'experiences', '[]'::jsonb)) item
    union all
    select
      item->>'id', 'project', 'projects', coalesce(nullif(item->>'title', ''), 'Project'),
      null, coalesce(nullif(item->>'summary', ''), 'Selected project'), null,
      case when jsonb_typeof(item->'technologies') = 'array'
        then array(select jsonb_array_elements_text(item->'technologies')) else '{}'::text[] end,
      item
    from jsonb_array_elements(coalesce(snapshot->'projects', '[]'::jsonb)) item
    union all
    select
      item->>'id', 'certification', 'credentials',
      coalesce(nullif(item->>'name', ''), 'Certification'), nullif(item->>'issuer', ''),
      coalesce(nullif(item->>'summary', ''), nullif(item->>'date', ''), 'Certification'), null,
      '{}'::text[], item
    from jsonb_array_elements(coalesce(snapshot->'certifications', '[]'::jsonb)) item
    union all
    select
      item->>'id', 'skill', 'skills', coalesce(nullif(item->>'category', ''), 'Technical skills'),
      null, coalesce(nullif(item->>'summary', ''), 'Technical skills'), null,
      case when jsonb_typeof(item->'skills') = 'array'
        then array(select jsonb_array_elements_text(item->'skills')) else '{}'::text[] end,
      item
    from jsonb_array_elements(coalesce(snapshot->'technicalSkills', '[]'::jsonb)) item
    union all
    select 'profile:portfolio', 'portfolio_summary', 'about', 'Profile', null,
      coalesce(snapshot->>'portfolioSummary', ''), null, '{}'::text[],
      jsonb_build_object('summary', snapshot->>'portfolioSummary')
    union all
    select 'profile:about', 'about', 'about', 'About Basil', null,
      coalesce(snapshot->>'about', ''), null, '{}'::text[],
      jsonb_build_object('summary', snapshot->>'about')
  )
  insert into published.portfolio_items(
    publication_id, public_id, source_entity_type, source_entity_id, section,
    career_stage, display_order, title, subtitle, public_summary,
    display_technologies, structured_content, payload_schema_version
  )
  select
    target_publication_id, 'career-brain-' || generated.item_key,
    generated.item_type, snapshot_id, generated.section, generated.career_stage,
    row_number() over (order by generated.section, generated.item_key)::integer + 1000,
    generated.title, generated.subtitle, generated.summary, generated.technologies,
    generated.structured,
    'career-brain-item.v1'
  from generated_items generated
  join app.career_brain_public_selections selection
    on selection.owner_id = owner
   and selection.item_key = generated.item_key
   and selection.item_type = generated.item_type
   and selection.public_eligible
  where generated.item_key is not null and generated.summary <> ''
  on conflict (publication_id, public_id) do nothing;

  get diagnostics inserted_count = row_count;
  update published.portfolio_publications publication
  set content_hash = encode(digest(coalesce((
    select jsonb_agg(to_jsonb(item) - 'id' - 'publication_id' order by item.display_order, item.public_id)
    from published.portfolio_items item
    where item.publication_id = target_publication_id
  ), '[]'::jsonb)::text, 'sha256'), 'hex')
  where publication.id = target_publication_id and publication.owner_id = owner;
  return inserted_count;
end;
$$;

revoke all on function app.stage_career_brain_items(uuid) from public, anon;
grant execute on function app.stage_career_brain_items(uuid) to authenticated;

notify pgrst, 'reload schema';
