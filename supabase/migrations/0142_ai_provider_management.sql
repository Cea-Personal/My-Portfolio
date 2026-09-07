-- Allow the configured owner to correct provider metadata and remove providers
-- from the active catalogue without deleting historical AI-run provenance.
create or replace function app.update_ai_provider(
  requested_id uuid,
  requested_provider text,
  requested_model text,
  requested_model_version text,
  requested_capabilities text[],
  requested_secret_ref text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, app
as $$
declare
  updated boolean;
  existing_secret_ref text;
  effective_secret_ref text;
begin
  if not app.is_configured_owner() then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;

  select secret_ref into existing_secret_ref
  from app.ai_provider_configs
  where id = requested_id;
  if not found then
    return false;
  end if;

  effective_secret_ref := case
    when requested_provider = 'codex_app_server' then null
    else coalesce(nullif(requested_secret_ref, ''), existing_secret_ref)
  end;

  if requested_provider !~ '^[a-z0-9_-]{2,40}$'
    or length(requested_model) not between 1 and 120
    or length(requested_model_version) not between 1 and 80
    or cardinality(requested_capabilities) = 0
    or (
      requested_provider <> 'codex_app_server'
      and (effective_secret_ref is null or effective_secret_ref !~ '^[A-Z][A-Z0-9_]{2,80}$')
    ) then
    raise exception 'INVALID_PROVIDER_CONFIGURATION' using errcode = '23514';
  end if;

  update app.ai_provider_configs
  set provider = requested_provider,
      model = requested_model,
      model_version = requested_model_version,
      capabilities = requested_capabilities,
      secret_ref = effective_secret_ref,
      enabled = true
  where id = requested_id;

  updated := found;
  if updated then
    update app.ai_provider_health
    set status = 'unknown',
        consecutive_failures = 0,
        circuit_open_until = null,
        last_error_code = null,
        checked_at = now()
    where provider_config_id = requested_id;
  end if;
  return updated;
end;
$$;

create or replace function app.remove_ai_provider(requested_id uuid)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, app
as $$
declare
  removed boolean;
begin
  if not app.is_configured_owner() then
    raise exception 'OWNER_AUTHORIZATION_REQUIRED' using errcode = '42501';
  end if;

  -- Removing an active provider also removes this owner's capability links so
  -- no hidden configuration continues pointing at a disabled provider.
  delete from app.ai_capability_configs
  where owner_id = auth.uid()
    and (
      provider_config_id = requested_id
      or fallback_provider_config_id = requested_id
    );

  update app.ai_provider_configs
  set enabled = false
  where id = requested_id
    and enabled;
  removed := found;

  if removed then
    update app.ai_provider_health
    set status = 'down',
        circuit_open_until = null,
        last_error_code = 'PROVIDER_REMOVED',
        checked_at = now()
    where provider_config_id = requested_id;
  end if;
  return removed;
end;
$$;

revoke all on function app.update_ai_provider(uuid,text,text,text,text[],text) from public, anon;
revoke all on function app.remove_ai_provider(uuid) from public, anon;
grant execute on function app.update_ai_provider(uuid,text,text,text,text[],text) to authenticated;
grant execute on function app.remove_ai_provider(uuid) to authenticated;

notify pgrst, 'reload schema';
