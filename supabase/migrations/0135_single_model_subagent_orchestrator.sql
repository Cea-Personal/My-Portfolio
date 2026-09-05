-- Reasoning agents are role-specific subagents coordinated by one owner-level
-- model. The existing capability table is reused so this migration is safe for
-- deployments that already have provider settings and does not copy secrets.
comment on table app.ai_capability_configs is
  'One task_type=orchestrator row is the shared reasoning model for all subagents. Embeddings remain separate.';

-- Preserve existing installations when every enabled reasoning task already
-- points at the same provider. Mixed installations are intentionally left for
-- the owner to choose in Settings → Agents rather than selecting a model
-- implicitly.
with uniform_owner_provider as (
  select owner_id,
    (array_agg(provider_config_id order by updated_at desc))[1] as provider_config_id,
    (array_agg(model_class order by updated_at desc))[1] as model_class,
    (array_agg(creativity order by updated_at desc))[1] as creativity,
    (array_agg(length_limit order by updated_at desc))[1] as length_limit,
    (array_agg(timeout_ms order by updated_at desc))[1] as timeout_ms,
    (array_agg(retry_limit order by updated_at desc))[1] as retry_limit
  from app.ai_capability_configs
  where enabled and task_type not in ('embedding', 'orchestrator')
  group by owner_id
  having count(distinct provider_config_id) = 1
)
insert into app.ai_capability_configs(
  owner_id, task_type, provider_config_id, fallback_provider_config_id,
  model_class, creativity, length_limit, timeout_ms, retry_limit, enabled
)
select owner_id, 'orchestrator', provider_config_id, null,
  coalesce(model_class, 'balanced'), coalesce(creativity, 0.2),
  coalesce(length_limit, 2000), coalesce(timeout_ms, 30000), coalesce(retry_limit, 2), true
from uniform_owner_provider
on conflict (owner_id, task_type) do nothing;

create index if not exists ai_orchestrator_owner
  on app.ai_capability_configs(owner_id)
  where task_type = 'orchestrator';

notify pgrst, 'reload schema';
