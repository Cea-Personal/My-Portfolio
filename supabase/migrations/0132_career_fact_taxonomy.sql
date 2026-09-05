-- Career Brain has five top-level record types. Responsibilities, achievements,
-- and impact describe an experience; they are not independent career records.
update app.career_facts
set fact_type = case lower(fact_type)
  when 'responsibility' then 'experience'
  when 'responsibilities' then 'experience'
  when 'achievement' then 'experience'
  when 'achievements' then 'experience'
  when 'impact' then 'experience'
  when 'impacts' then 'experience'
  when 'employment' then 'experience'
  when 'work_experience' then 'experience'
  when 'projects' then 'project'
  when 'skills' then 'skill'
  when 'tools' then 'skill'
  when 'technologies' then 'skill'
  when 'certifications' then 'certification'
  when 'certificate' then 'certification'
  when 'degrees' then 'education'
  else lower(fact_type)
end
where lower(fact_type) in (
  'responsibility', 'responsibilities', 'achievement', 'achievements', 'impact', 'impacts',
  'employment', 'work_experience', 'projects', 'skills', 'tools', 'technologies',
  'certifications', 'certificate', 'degrees'
);

update app.extracted_facts
set subject_candidate = (subject_candidate - 'fact_type') || jsonb_build_object(
  'factType', case lower(coalesce(subject_candidate->>'factType', ''))
    when 'responsibility' then 'experience'
    when 'responsibilities' then 'experience'
    when 'achievement' then 'experience'
    when 'achievements' then 'experience'
    when 'impact' then 'experience'
    when 'impacts' then 'experience'
    when 'employment' then 'experience'
    when 'work_experience' then 'experience'
    when 'projects' then 'project'
    when 'skills' then 'skill'
    when 'tools' then 'skill'
    when 'technologies' then 'skill'
    when 'certifications' then 'certification'
    when 'certificate' then 'certification'
    when 'degrees' then 'education'
    else lower(coalesce(subject_candidate->>'factType', 'project'))
  end
)
where lower(coalesce(subject_candidate->>'factType', '')) in (
  'responsibility', 'responsibilities', 'achievement', 'achievements', 'impact', 'impacts',
  'employment', 'work_experience', 'projects', 'skills', 'tools', 'technologies',
  'certifications', 'certificate', 'degrees'
);

-- Preserve the organisation/role identity when an experience is projected into
-- a staged public portfolio. The publication itself remains an immutable copy.
create or replace function app.enrich_portfolio_experience_item()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app, published
as $$
declare
  details jsonb;
  skills text[] := '{}'::text[];
  tools text[] := '{}'::text[];
begin
  if new.source_entity_type <> 'career_fact' or new.section <> 'experience' then
    return new;
  end if;

  select v.structured_value into details
  from app.career_facts f
  join app.career_fact_versions v on v.id = f.current_version_id
  where f.id = new.source_entity_id;

  if details is null then return new; end if;
  if jsonb_typeof(details->'skills') = 'array' then
    skills := array(select jsonb_array_elements_text(details->'skills'));
  end if;
  if jsonb_typeof(details->'tools') = 'array' then
    tools := array(select jsonb_array_elements_text(details->'tools'));
  end if;

  new.title := coalesce(nullif(details->>'role', ''), new.title);
  new.subtitle := coalesce(nullif(details->>'organization', ''), new.subtitle);
  new.career_stage := coalesce(nullif(details->>'role', ''), new.career_stage);
  new.display_technologies := array(select distinct unnest(skills || tools));
  return new;
end;
$$;

drop trigger if exists enrich_portfolio_experience_item on published.portfolio_items;
create trigger enrich_portfolio_experience_item
before insert on published.portfolio_items
for each row execute function app.enrich_portfolio_experience_item();

revoke all on function app.enrich_portfolio_experience_item() from public, anon, authenticated;
