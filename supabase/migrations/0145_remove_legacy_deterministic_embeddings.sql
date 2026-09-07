-- chunk_embeddings is an immutable, append-only audit/history table. Legacy
-- deterministic rows therefore cannot be deleted or updated. Production
-- retrieval is already keyed by the configured provider/model/version, so the
-- rows below are unreachable after the owner re-indexes with the configured
-- embedding provider. Keep this migration intentionally non-mutating so it can
-- be applied to databases that enforce the append-only trigger.
do $$
begin
  if to_regclass('app.chunk_embeddings') is not null then
    raise notice 'Legacy deterministic embeddings retained as append-only history; current retrieval excludes them by provider/model/version.';
  end if;
end;
$$;

notify pgrst, 'reload schema';
