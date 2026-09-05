alter table app.career_brain_public_selections
  drop constraint if exists career_brain_public_selections_item_type_check;
alter table app.career_brain_public_selections
  add constraint career_brain_public_selections_item_type_check check (item_type in (
    'experience', 'project', 'education', 'certification', 'skill', 'portfolio_summary', 'about'
  ));

create or replace function app.stage_career_brain_education_items(target_publication_id uuid)
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
  from app.career_brain_snapshots where owner_id = owner
  order by generated_at desc limit 1;
  if snapshot_id is null then return 0; end if;

  insert into published.portfolio_items(
    publication_id, public_id, source_entity_type, source_entity_id, section,
    display_order, title, subtitle, public_summary, structured_content, payload_schema_version
  )
  select
    target_publication_id, 'career-brain-' || item->>'id', 'education', snapshot_id,
    'credentials', row_number() over (order by item->>'id')::integer + 1200,
    coalesce(nullif(item->>'qualification', ''), 'Education'),
    nullif(item->>'institution', ''),
    coalesce(nullif(item->>'summary', ''), nullif(item->>'period', ''), 'Education'),
    item, 'career-brain-item.v1'
  from jsonb_array_elements(coalesce(snapshot->'education', '[]'::jsonb)) item
  join app.career_brain_public_selections selection
    on selection.owner_id = owner and selection.item_key = item->>'id'
   and selection.item_type = 'education' and selection.public_eligible
  on conflict (publication_id, public_id) do nothing;

  get diagnostics inserted_count = row_count;
  update published.portfolio_publications publication
  set content_hash = encode(digest(coalesce((
    select jsonb_agg(to_jsonb(portfolio_item) - 'id' - 'publication_id'
      order by portfolio_item.display_order, portfolio_item.public_id)
    from published.portfolio_items portfolio_item
    where portfolio_item.publication_id = target_publication_id
  ), '[]'::jsonb)::text, 'sha256'), 'hex')
  where publication.id = target_publication_id and publication.owner_id = owner;
  return inserted_count;
end;
$$;

revoke all on function app.stage_career_brain_education_items(uuid) from public, anon;
grant execute on function app.stage_career_brain_education_items(uuid) to authenticated;

notify pgrst, 'reload schema';
