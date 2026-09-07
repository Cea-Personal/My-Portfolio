-- Remove the pre-production deterministic Career Brain index. Production
-- retrieval uses the owner-configured embedding provider/model/version; these
-- rows can never be returned by that path and should not remain misleadingly
-- visible in the knowledge index.
delete from app.chunk_embeddings
where provider = 'career-worker'
  and model = 'deterministic-private-index'
  and model_version = '1';

notify pgrst, 'reload schema';
