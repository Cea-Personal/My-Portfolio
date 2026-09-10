-- Project media is optional enrichment. A missing/unavailable media record must
-- never prevent a project or Career Brain item from being staged or published.
create or replace function app.apply_project_cover_media()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app, published
as $$
declare
  publication_owner uuid;
  project_key text;
  cover jsonb;
begin
  if new.section <> 'projects' or new.source_entity_type <> 'project'
     or jsonb_typeof(new.structured_content) <> 'object' then
    return new;
  end if;

  begin
    select owner_id into publication_owner
    from published.portfolio_publications
    where id = new.publication_id;
    project_key := nullif(new.structured_content->>'id', '');
    if publication_owner is null or project_key is null then return new; end if;

    select jsonb_build_array(jsonb_build_object(
      'kind', 'cover_image',
      'url', media.public_url,
      'alt', media.alt_text,
      'source', media.source_type
    )) into cover
    from app.portfolio_project_media media
    where media.owner_id = publication_owner
      and media.project_key = project_key
      and media.media_type = 'cover_image'
      and media.status = 'approved'
    order by media.created_at desc
    limit 1;
  exception when others then
    -- Keep the project publication usable when storage/media enrichment is
    -- unavailable, misconfigured, or has not been migrated yet.
    return new;
  end;

  if cover is not null then new.sanitized_media := cover; end if;
  return new;
end;
$$;

revoke all on function app.apply_project_cover_media() from public, anon, authenticated;
notify pgrst, 'reload schema';
