-- Native Codex App Server providers use the user's local Codex authentication
-- and therefore do not require an API-key environment variable reference.
create or replace function app.register_ai_provider(requested_provider text, requested_model text,
  requested_model_version text, requested_capabilities text[], requested_secret_ref text)
returns uuid language plpgsql security definer set search_path = pg_catalog, app as $$
declare provider_id uuid;
begin
  if not app.is_configured_owner() then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;
  if requested_provider !~ '^[a-z0-9_-]{2,40}$'
    or length(requested_model) not between 1 and 120
    or length(requested_model_version) not between 1 and 80
    or (requested_provider <> 'codex_app_server'
        and (requested_secret_ref is null or requested_secret_ref !~ '^[A-Z][A-Z0-9_]{2,80}$'))
    or cardinality(requested_capabilities) = 0 then
    raise exception 'INVALID_PROVIDER_CONFIGURATION' using errcode = '23514';
  end if;
  insert into app.ai_provider_configs(provider,model,model_version,capabilities,secret_ref,enabled)
  values(requested_provider,requested_model,requested_model_version,requested_capabilities,
    nullif(requested_secret_ref, ''),true)
  on conflict(provider,model,model_version) do update set capabilities=excluded.capabilities,
    secret_ref=excluded.secret_ref, enabled=true returning id into provider_id;
  insert into app.ai_provider_health(provider_config_id,status)
    values(provider_id,'unknown') on conflict do nothing;
  return provider_id;
end; $$;

notify pgrst, 'reload schema';
