-- Project cover media can be uploaded or generated, but only an explicitly
-- approved asset is copied into an immutable public portfolio snapshot.
create table if not exists app.portfolio_project_media (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  project_key text not null,
  media_type text not null default 'cover_image' check (media_type = 'cover_image'),
  source_type text not null check (source_type in ('uploaded', 'ai_generated')),
  status text not null default 'draft' check (status in ('draft', 'approved', 'rejected', 'superseded')),
  storage_path text not null,
  public_url text not null,
  alt_text text not null default '',
  prompt text,
  provider_config_id uuid references app.ai_provider_configs(id) on delete set null,
  provider text,
  model text,
  model_version text,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  superseded_at timestamptz
);

create index if not exists portfolio_project_media_current
  on app.portfolio_project_media(owner_id, project_key, status, created_at desc);

alter table app.portfolio_project_media enable row level security;
grant select, insert, update, delete on app.portfolio_project_media to authenticated;
grant select, insert, update, delete on app.portfolio_project_media to service_role;

drop policy if exists portfolio_project_media_owner on app.portfolio_project_media;
create policy portfolio_project_media_owner on app.portfolio_project_media
for all to authenticated
using (owner_id = (select auth.uid()) and app.is_configured_owner())
with check (owner_id = (select auth.uid()) and app.is_configured_owner());

-- Attach the latest approved cover image to project items as they are staged.
-- The trigger reads only owner-scoped media and never exposes draft assets.
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

  if cover is not null then new.sanitized_media := cover; end if;
  return new;
end;
$$;

drop trigger if exists apply_project_cover_media on published.portfolio_items;
create trigger apply_project_cover_media
before insert on published.portfolio_items
for each row execute function app.apply_project_cover_media();

revoke all on function app.apply_project_cover_media() from public, anon, authenticated;
notify pgrst, 'reload schema';
