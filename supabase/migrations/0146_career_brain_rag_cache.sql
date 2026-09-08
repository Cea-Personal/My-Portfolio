-- Bounded stale-while-revalidate cache for Career Brain retrieval.
-- Cached evidence is an optimization only; the synthesis path still performs
-- a fresh Supabase vector search for every refresh.
create table if not exists app.career_brain_retrieval_cache (
  owner_id uuid not null references app.profiles(id) on delete cascade,
  cache_key text not null,
  embedding_provider text not null,
  embedding_model text not null,
  embedding_model_version text not null default '',
  query_embeddings jsonb not null default '[]'::jsonb,
  evidence jsonb not null default '[]'::jsonb,
  source_hash text,
  refreshed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (owner_id, cache_key)
);

create index if not exists career_brain_rag_cache_expiry
  on app.career_brain_retrieval_cache(owner_id, expires_at);

alter table app.career_brain_retrieval_cache enable row level security;
grant select, insert, update, delete on app.career_brain_retrieval_cache to authenticated;
grant select, insert, update, delete on app.career_brain_retrieval_cache to service_role;

drop policy if exists career_brain_rag_cache_owner on app.career_brain_retrieval_cache;
create policy career_brain_rag_cache_owner on app.career_brain_retrieval_cache
for all to authenticated
using (owner_id = (select auth.uid()) and app.is_configured_owner())
with check (owner_id = (select auth.uid()) and app.is_configured_owner());

notify pgrst, 'reload schema';
