-- Approved project covers are public portfolio presentation data.  Keep the
-- publication rows immutable, but resolve the latest approved cover at read
-- time so approving a cover does not require rebuilding an otherwise
-- unchanged publication snapshot.
--
-- The view is deliberately security-definer (the default for a view).  It
-- exposes only rows from published publications and only the approved media
-- URL/alt text for a project that is already present in that publication.
create or replace view api.public_portfolio_items as
select
  i.id,
  i.publication_id,
  i.public_id,
  i.source_entity_type,
  i.source_entity_id,
  i.section,
  i.career_stage,
  i.display_order,
  i.title,
  i.subtitle,
  i.public_summary,
  i.display_metric,
  i.display_technologies,
  case
    when media.cover is not null then media.cover
    else i.sanitized_media
  end as sanitized_media,
  i.public_citations,
  i.detail_slug,
  i.payload_schema_version
from published.portfolio_items i
join published.portfolio_publications p
  on p.id = i.publication_id
 and p.status = 'published'
left join lateral (
  select jsonb_build_array(jsonb_build_object(
    'kind', 'cover_image',
    'url', m.public_url,
    'alt', m.alt_text,
    'source', m.source_type
  )) as cover
  from app.portfolio_project_media m
  where i.section = 'projects'
    and i.source_entity_type = 'project'
    and m.owner_id = p.owner_id
    and m.project_key = nullif(i.structured_content->>'id', '')
    and m.media_type = 'cover_image'
    and m.status = 'approved'
  order by m.approved_at desc nulls last, m.created_at desc
  limit 1
) media on true;

grant select on api.public_portfolio_items to anon, authenticated;
notify pgrst, 'reload schema';
