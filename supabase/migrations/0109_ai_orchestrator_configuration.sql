create table if not exists app.ai_capability_configs (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references app.profiles(id) on delete cascade,
  task_type text not null, provider_config_id uuid not null references app.ai_provider_configs(id),
  fallback_provider_config_id uuid references app.ai_provider_configs(id), model_class text not null default 'balanced',
  creativity numeric(3,2) not null default 0.20 check (creativity between 0 and 1),
  length_limit integer not null default 2000 check (length_limit between 128 and 32000),
  timeout_ms integer not null default 30000 check (timeout_ms between 1000 and 120000),
  retry_limit integer not null default 2 check (retry_limit between 0 and 5), enabled boolean not null default false,
  updated_at timestamptz not null default now(), unique(owner_id, task_type)
);
create table if not exists app.ai_provider_health (
  provider_config_id uuid primary key references app.ai_provider_configs(id) on delete cascade,
  status text not null default 'unknown' check (status in ('unknown','healthy','degraded','down')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  circuit_open_until timestamptz, last_error_code text, checked_at timestamptz not null default now()
);
alter table app.ai_runs
  add column if not exists instruction_version text,
  add column if not exists usage jsonb not null default '{}'::jsonb,
  add column if not exists elapsed_ms integer check (elapsed_ms is null or elapsed_ms >= 0),
  add column if not exists related_type text,
  add column if not exists related_id uuid,
  add column if not exists sanitized_error text check (sanitized_error is null or length(sanitized_error) <= 500);
alter table app.ai_capability_configs enable row level security;
alter table app.ai_provider_health enable row level security;
grant select, insert, update, delete on app.ai_capability_configs to authenticated;
grant select on app.ai_provider_health to authenticated;
create policy ai_capability_owner on app.ai_capability_configs for all to authenticated
  using (owner_id = auth.uid() and app.is_configured_owner()) with check (owner_id = auth.uid() and app.is_configured_owner());
create policy ai_provider_health_owner_read on app.ai_provider_health for select to authenticated
  using (app.is_configured_owner());

create or replace function app.list_ai_capabilities()
returns table(task_type text, provider_id uuid, provider text, model text, model_class text, creativity numeric,
  length_limit integer, timeout_ms integer, retry_limit integer, enabled boolean, fallback_provider_id uuid,
  health_status text, consecutive_failures integer, circuit_open_until timestamptz, last_error_code text)
language sql stable security definer set search_path = pg_catalog, app
as $$
  select c.task_type, p.id, p.provider, p.model, c.model_class, c.creativity, c.length_limit,
    c.timeout_ms, c.retry_limit, c.enabled, c.fallback_provider_config_id,
    coalesce(h.status, 'unknown'), coalesce(h.consecutive_failures, 0), h.circuit_open_until, h.last_error_code
  from app.ai_capability_configs c join app.ai_provider_configs p on p.id = c.provider_config_id
  left join app.ai_provider_health h on h.provider_config_id = p.id
  where c.owner_id = auth.uid() and app.is_configured_owner()
  order by c.task_type;
$$;
create or replace function app.list_available_ai_providers()
returns table(id uuid, provider text, model text, model_version text, capabilities text[], enabled boolean)
language sql stable security definer set search_path = pg_catalog, app
as $$ select p.id,p.provider,p.model,p.model_version,p.capabilities,p.enabled from app.ai_provider_configs p
  where p.enabled and app.is_configured_owner() order by p.provider,p.model; $$;
create or replace function app.register_ai_provider(requested_provider text, requested_model text,
  requested_model_version text, requested_capabilities text[], requested_secret_ref text)
returns uuid language plpgsql security definer set search_path = pg_catalog, app as $$
declare provider_id uuid;
begin
  if not app.is_configured_owner() then raise exception 'OWNER_AUTHORIZATION_REQUIRED' using errcode = '42501'; end if;
  if requested_provider !~ '^[a-z0-9_-]{2,40}$' or length(requested_model) not between 1 and 120
    or length(requested_model_version) not between 1 and 80
    or requested_secret_ref !~ '^[A-Z][A-Z0-9_]{2,80}$'
    or cardinality(requested_capabilities) = 0 then
    raise exception 'INVALID_PROVIDER_CONFIGURATION' using errcode = '23514';
  end if;
  insert into app.ai_provider_configs(provider,model,model_version,capabilities,secret_ref,enabled)
  values(requested_provider,requested_model,requested_model_version,requested_capabilities,requested_secret_ref,true)
  on conflict(provider,model,model_version) do update set capabilities=excluded.capabilities,
    secret_ref=excluded.secret_ref, enabled=true returning id into provider_id;
  insert into app.ai_provider_health(provider_config_id,status) values(provider_id,'unknown') on conflict do nothing;
  return provider_id;
end; $$;
revoke all on function app.list_ai_capabilities() from public, anon;
revoke all on function app.list_available_ai_providers() from public, anon;
revoke all on function app.register_ai_provider(text,text,text,text[],text) from public, anon;
grant execute on function app.list_ai_capabilities() to authenticated;
grant execute on function app.list_available_ai_providers() to authenticated;
grant execute on function app.register_ai_provider(text,text,text,text[],text) to authenticated;
create index if not exists ai_capability_owner_task on app.ai_capability_configs(owner_id, task_type);
create index if not exists ai_runs_owner_created on app.ai_runs(owner_id, created_at desc);
notify pgrst, 'reload schema';
