alter table app.automation_runs
  add column if not exists revision integer not null default 0,
  add column if not exists retry_count integer not null default 0,
  add column if not exists resumed_from_id uuid references app.automation_runs(id),
  add column if not exists cancellation_requested_at timestamptz,
  add column if not exists last_heartbeat_at timestamptz,
  add column if not exists context_metadata jsonb not null default '{}'::jsonb;
alter table app.automation_dead_letters
  add column if not exists run_id uuid references app.automation_runs(id) on delete set null,
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_note text;
create index if not exists automation_runs_owner_status_created on app.automation_runs(owner_id,status,created_at desc);
create index if not exists outbox_pending_available on app.outbox_events(available_at,created_at) where status='pending';
create or replace function app.request_data_export(requested_key text)
returns uuid language plpgsql security definer set search_path=pg_catalog,app as $$
declare owner uuid := auth.uid(); export_id uuid := gen_random_uuid(); correlation text := gen_random_uuid()::text;
begin
  if owner is null or not app.is_configured_owner() then raise exception 'OWNER_AUTHORIZATION_REQUIRED' using errcode='42501'; end if;
  if requested_key !~ '^[A-Za-z0-9._:-]{16,128}$' then raise exception 'INVALID_IDEMPOTENCY_KEY' using errcode='23514'; end if;
  insert into app.export_requests(id,owner_id,status,format) values(export_id,owner,'queued','json');
  insert into app.outbox_events(aggregate_type,aggregate_id,event_name,payload,idempotency_key)
  values('export_request',export_id,'career/export.requested.v1',jsonb_build_object(
    'schemaVersion',1,'ownerId',owner,'correlationId',correlation,'resourceType','export_request',
    'resourceId',export_id,'operationKey','export:'||export_id::text,'requestedBy','owner','metadata','{}'::jsonb
  ),requested_key);
  return export_id;
end; $$;
revoke all on function app.request_data_export(text) from public,anon;
grant execute on function app.request_data_export(text) to authenticated;
notify pgrst, 'reload schema';
