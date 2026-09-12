-- Preserve the full public item contract (including structured_content) while
-- retaining the approved-cover overlay introduced in 0152.
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
  i.payload_schema_version,
  i.structured_content
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
