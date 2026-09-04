alter table app.posts
  add column if not exists updated_at timestamptz not null default now();

alter table app.post_versions
  add column if not exists excerpt text not null default '',
  add column if not exists cover_url text,
  add column if not exists tags text[] not null default '{}',
  add column if not exists seo_title text,
  add column if not exists seo_description text;

create table if not exists published.blog_posts (
  id uuid primary key default gen_random_uuid(),
  source_post_id uuid not null unique references app.posts(id) on delete cascade,
  slug text not null unique,
  title text not null,
  excerpt text not null,
  markdown text not null,
  cover_url text,
  tags text[] not null default '{}',
  seo_title text,
  seo_description text,
  visible_at timestamptz not null,
  archived_at timestamptz,
  evidence_type text not null default 'technical_knowledge',
  supports_employment_claim boolean not null default false,
  source_version_hash text not null,
  updated_at timestamptz not null default now()
);

alter table published.blog_posts enable row level security;
revoke all on published.blog_posts from anon, authenticated;
grant select (
  id, slug, title, excerpt, markdown, cover_url, tags, seo_title, seo_description,
  visible_at, evidence_type, supports_employment_claim, source_version_hash, updated_at
) on published.blog_posts to anon, authenticated;
grant select, insert, update, delete on app.post_versions, app.post_publication_approvals to authenticated;

drop policy if exists public_visible_blog_posts on published.blog_posts;
create policy public_visible_blog_posts on published.blog_posts for select to anon, authenticated
  using (archived_at is null and visible_at <= now());

create or replace function app.publish_post(target_id uuid, requested_visible_at timestamptz default now())
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, app, published
as $$
declare
  owner uuid := auth.uid();
  selected_post app.posts%rowtype;
  selected_version app.post_versions%rowtype;
  public_id uuid;
begin
  if owner is null or not app.is_configured_owner() then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;
  select * into selected_post from app.posts where id = target_id and owner_id = owner for update;
  if not found or selected_post.current_version_id is null then
    raise exception 'POST_VERSION_REQUIRED' using errcode = 'P0002';
  end if;
  select * into selected_version from app.post_versions
    where id = selected_post.current_version_id and post_id = selected_post.id;
  if not found then raise exception 'POST_VERSION_REQUIRED' using errcode = 'P0002'; end if;
  if selected_version.markdown ~* '(I led|my role|my team|my work|at [A-Z][[:alnum:]_-]+)'
    and cardinality(selected_version.evidence_ids) = 0 then
    raise exception 'CAREER_CLAIM_EVIDENCE_REQUIRED' using errcode = '23514';
  end if;
  if exists (
    select 1 from unnest(selected_version.evidence_ids) evidence_id
    where not exists (
      select 1 from app.career_facts fact
      where fact.id = evidence_id and fact.owner_id = owner and fact.verified_by_owner
        and fact.review_status in ('approved', 'edited_approved')
    )
  ) then raise exception 'UNVERIFIED_ARTICLE_EVIDENCE' using errcode = '23514'; end if;

  insert into app.post_publication_approvals(post_id, version_id, reviewer_id)
  values (selected_post.id, selected_version.id, owner);

  insert into published.blog_posts(
    source_post_id, slug, title, excerpt, markdown, cover_url, tags, seo_title,
    seo_description, visible_at, archived_at, source_version_hash, updated_at
  ) values (
    selected_post.id, selected_post.slug, selected_version.title, selected_version.excerpt,
    selected_version.markdown, selected_version.cover_url, selected_version.tags,
    selected_version.seo_title, selected_version.seo_description,
    greatest(requested_visible_at, now()), null, selected_version.content_hash, now()
  )
  on conflict (source_post_id) do update set
    slug = excluded.slug, title = excluded.title, excerpt = excluded.excerpt,
    markdown = excluded.markdown, cover_url = excluded.cover_url, tags = excluded.tags,
    seo_title = excluded.seo_title, seo_description = excluded.seo_description,
    visible_at = excluded.visible_at, archived_at = null,
    source_version_hash = excluded.source_version_hash, updated_at = now()
  returning id into public_id;

  update app.posts set
    status = case when requested_visible_at > now() then 'scheduled' else 'published' end,
    scheduled_at = case when requested_visible_at > now() then requested_visible_at else null end,
    published_at = case when requested_visible_at <= now() then now() else published_at end,
    archived_at = null,
    updated_at = now()
  where id = selected_post.id;
  return public_id;
end;
$$;

create or replace function app.archive_post(target_id uuid)
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
  update app.posts set status = 'archived', archived_at = now(), updated_at = now()
  where id = target_id and owner_id = owner;
  if not found then raise exception 'POST_NOT_FOUND' using errcode = 'P0002'; end if;
  update published.blog_posts set archived_at = now(), updated_at = now()
  where source_post_id = target_id;
  return target_id;
end;
$$;

revoke all on function app.publish_post(uuid, timestamptz) from public, anon;
revoke all on function app.archive_post(uuid) from public, anon;
grant execute on function app.publish_post(uuid, timestamptz) to authenticated;
grant execute on function app.archive_post(uuid) to authenticated;

create index if not exists blog_posts_visible_at on published.blog_posts(visible_at desc)
  where archived_at is null;
notify pgrst, 'reload schema';
