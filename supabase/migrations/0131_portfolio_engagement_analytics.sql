create or replace function app.record_public_analytics_event(
  requested_name text,
  requested_properties jsonb,
  requested_pseudonym text,
  requested_consent text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, app
as $$
declare
  owner uuid;
  session_id uuid;
  event_id uuid;
  property record;
  string_value text;
  numeric_value numeric;
begin
  if requested_name not in (
    'page_view', 'page_engagement', 'section_view', 'section_engagement',
    'project_view', 'article_view', 'ai_conversation_started', 'jd_analysis',
    'skill_query', 'project_interest'
  ) then raise exception 'EVENT_NOT_ALLOWED' using errcode = '23514'; end if;
  if requested_consent <> 'granted' then
    raise exception 'ANALYTICS_CONSENT_REQUIRED' using errcode = '42501';
  end if;
  if requested_pseudonym !~ '^[A-Za-z0-9_-]{20,80}$' then
    raise exception 'INVALID_ANALYTICS_PSEUDONYM' using errcode = '23514';
  end if;
  if jsonb_typeof(coalesce(requested_properties, '{}'::jsonb)) <> 'object'
    or (select count(*) from jsonb_object_keys(coalesce(requested_properties, '{}'::jsonb))) > 4 then
    raise exception 'INVALID_EVENT_PROPERTIES' using errcode = '23514';
  end if;
  for property in select key, value from jsonb_each(coalesce(requested_properties, '{}'::jsonb)) loop
    if property.key !~ '^[a-z][a-z0-9_]{0,31}$'
      or property.key ~* '(url|query|text|content|prompt|answer|email|name|ip|user|document)'
      or jsonb_typeof(property.value) not in ('string', 'number', 'boolean')
      or length(property.value::text) > 160 then
      raise exception 'INVALID_EVENT_PROPERTIES' using errcode = '23514';
    end if;
    string_value := trim(both '"' from property.value::text);
    numeric_value := case when jsonb_typeof(property.value) = 'number' then (property.value::text)::numeric else null end;
    if (requested_name = 'page_view' and not (
          (property.key = 'page' and string_value in ('home','blog','project'))
          or (property.key = 'source' and string_value in ('direct','internal','google','bing','linkedin','github','other'))
          or (property.key = 'country' and string_value ~ '^(unknown|[A-Z]{2})$')
        ))
      or (requested_name = 'page_engagement' and not (
          (property.key = 'page' and string_value in ('home','blog','project'))
          or (property.key = 'duration_seconds' and numeric_value between 1 and 1800)
        ))
      or (requested_name = 'section_view' and (property.key <> 'section' or string_value not in ('about','experience','projects','ask-basil','blog','contact')))
      or (requested_name = 'section_engagement' and not (
          (property.key = 'section' and string_value in ('about','experience','projects','ask-basil','blog','contact'))
          or (property.key = 'duration_seconds' and numeric_value between 1 and 1800)
        ))
      or (requested_name in ('project_view','project_interest') and (property.key <> 'project' or string_value !~ '^[a-z0-9][a-z0-9-]{0,79}$'))
      or (requested_name = 'article_view' and (property.key <> 'article' or string_value !~ '^[a-z0-9][a-z0-9-]{0,79}$'))
      or (requested_name = 'ai_conversation_started')
      or (requested_name = 'jd_analysis' and (property.key <> 'outcome' or string_value not in ('completed','abstained','failed')))
      or (requested_name = 'skill_query' and (property.key <> 'skill' or string_value !~* '^[a-z0-9+#.][a-z0-9+#. -]{0,39}$')) then
      raise exception 'EVENT_PROPERTY_NOT_ALLOWED' using errcode = '23514';
    end if;
  end loop;
  select user_id into owner from app.owner_authorizations where active limit 1;
  if owner is null then raise exception 'ANALYTICS_OWNER_UNAVAILABLE' using errcode = 'P0002'; end if;
  insert into app.analytics_sessions(owner_id, pseudonym, consent, expires_at)
  values (owner, requested_pseudonym, 'granted', now() + interval '30 days')
  on conflict (owner_id, pseudonym) do update set
    consent = 'granted', expires_at = now() + interval '30 days'
  returning id into session_id;
  insert into app.analytics_events(session_id, owner_id, event_name, properties, schema_version)
  values (session_id, owner, requested_name, coalesce(requested_properties, '{}'::jsonb), 'analytics.v3')
  returning id into event_id;
  return event_id;
end;
$$;

revoke all on function app.record_public_analytics_event(text, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function app.record_public_analytics_event(text, jsonb, text, text)
  to service_role;

notify pgrst, 'reload schema';
