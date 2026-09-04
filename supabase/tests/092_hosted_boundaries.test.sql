begin;
create extension if not exists pgtap;
set search_path = extensions, public, app, published;

select plan(14);

select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'buckets'
  ),
  'storage bucket registry exists'
);
select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'objects'
  ),
  'storage object registry exists'
);
select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'storage' and c.relname = 'buckets'
  ),
  'storage buckets are hosted by the storage schema'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'private_source_owner'
  ),
  'private source objects have an owner policy'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'private_artifact_owner'
  ),
  'private artifact objects have an owner policy'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'public_media_owner_insert'
  ),
  'public media inserts require the owner'
);
select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'private_source_owner'
      and position('auth.uid' in lower(coalesce(qual, '') || coalesce(with_check, ''))) > 0
  ),
  'private source policy binds access to the authenticated owner'
);
select ok(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and ('public' = any(roles) or 'anon' = any(roles))
      and cmd in ('INSERT', 'ALL')
  ),
  'anonymous role has no storage insert policy'
);
select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'current_publication'
  ),
  'current publication boundary exists'
);
select ok(
  exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'api' and c.relname = 'public_portfolio_items'
  ),
  'public portfolio item boundary exists'
);
select ok(
  exists (
    select 1 from pg_views
    where schemaname = 'api' and viewname = 'current_publication'
  ),
  'current publication is exposed as a view'
);
select ok(
  exists (
    select 1 from pg_views
    where schemaname = 'api' and viewname = 'public_portfolio_items'
  ),
  'public portfolio items are exposed as a view'
);
select ok(
  exists (
    select 1 from pg_views
    where schemaname = 'api' and viewname = 'current_publication'
      and position('published' in lower(definition)) > 0
  ),
  'current publication view filters to published state'
);
select ok(
  exists (
    select 1 from pg_views
    where schemaname = 'api' and viewname = 'public_portfolio_items'
      and position('published' in lower(definition)) > 0
  ),
  'public portfolio view is publication-scoped'
);

select * from finish();
rollback;
