-- Freelance opportunity workspace. The canonical opportunity remains app.jobs;
-- freelance-specific data lives in owner-scoped sidecar/version tables.
alter table app.jobs
  add column if not exists opportunity_domain text not null default 'employment';

alter table app.applications
  add column if not exists application_kind text not null default 'employment';

create index if not exists jobs_owner_opportunity_domain
  on app.jobs(owner_id, opportunity_domain);
create unique index if not exists jobs_owner_id_identity
  on app.jobs(owner_id, id);
create unique index if not exists jobs_owner_upwork_freelance_source_url
  on app.jobs(owner_id, source_url)
  where opportunity_domain = 'freelance' and source_provider = 'upwork' and source_url is not null;

create table if not exists app.freelance_clients (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  provider text not null default 'upwork',
  external_id text,
  display_name text,
  profile_url text,
  country text,
  timezone text,
  industry text,
  observed_attributes jsonb not null default '{}'::jsonb,
  unknown_attributes text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id)
);

create unique index if not exists freelance_clients_external_identity
  on app.freelance_clients(owner_id, provider, external_id)
  where external_id is not null;

create table if not exists app.freelance_opportunities (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  job_id uuid not null unique,
  provider text not null default 'upwork',
  import_mode text not null default 'manual' check (import_mode in ('manual', 'url_reference', 'api')),
  provider_external_id text,
  client_id uuid references app.freelance_clients(id) on delete set null,
  budget_type text not null default 'unknown' check (budget_type in ('hourly', 'fixed', 'milestone', 'unknown')),
  budget_min numeric check (budget_min is null or budget_min >= 0),
  budget_max numeric check (budget_max is null or budget_max >= 0),
  hourly_min numeric check (hourly_min is null or hourly_min >= 0),
  hourly_max numeric check (hourly_max is null or hourly_max >= 0),
  currency text,
  estimated_duration text,
  timezone_requirements text,
  skills text[] not null default '{}',
  service_tags text[] not null default '{}',
  owner_notes text,
  source_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id),
  foreign key (owner_id, job_id) references app.jobs(owner_id, id) on delete cascade,
  foreign key (owner_id, client_id) references app.freelance_clients(owner_id, id) on delete restrict,
  check (budget_min is null or budget_max is null or budget_min <= budget_max),
  check (hourly_min is null or hourly_max is null or hourly_min <= hourly_max)
);

create unique index if not exists freelance_opportunities_external_identity
  on app.freelance_opportunities(owner_id, provider, provider_external_id)
  where provider_external_id is not null;
create unique index if not exists freelance_opportunities_source_hash
  on app.freelance_opportunities(owner_id, source_hash);
create index if not exists freelance_opportunities_owner_updated
  on app.freelance_opportunities(owner_id, updated_at desc);

create table if not exists app.freelance_opportunity_analyses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  opportunity_id uuid not null,
  version integer not null,
  description_id uuid references app.job_descriptions(id) on delete set null,
  client_need jsonb not null default '{}'::jsonb,
  problem_summary text,
  deliverables jsonb not null default '[]'::jsonb,
  project_type text,
  seniority text,
  industry text,
  pricing_model text,
  duration text,
  timezone text,
  architecture_clues jsonb not null default '[]'::jsonb,
  hidden_requirements jsonb not null default '[]'::jsonb,
  complexity jsonb not null default '{}'::jsonb,
  risks jsonb not null default '[]'::jsonb,
  observed jsonb not null default '{}'::jsonb,
  inferred jsonb not null default '{}'::jsonb,
  unknown jsonb not null default '{}'::jsonb,
  agent_run_id uuid,
  prompt_version text,
  model_version text,
  content_hash text not null,
  created_at timestamptz not null default now(),
  unique (opportunity_id, version),
  foreign key (owner_id, opportunity_id) references app.freelance_opportunities(owner_id, id) on delete cascade
);

create index if not exists freelance_analyses_owner_opportunity
  on app.freelance_opportunity_analyses(owner_id, opportunity_id, created_at desc);

create table if not exists app.freelance_opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  opportunity_id uuid not null references app.freelance_opportunities(id) on delete cascade,
  analysis_id uuid references app.freelance_opportunity_analyses(id) on delete set null,
  technical_fit numeric check (technical_fit is null or technical_fit between 0 and 100),
  evidence_strength numeric check (evidence_strength is null or evidence_strength between 0 and 100),
  budget_economics numeric check (budget_economics is null or budget_economics between 0 and 100),
  win_probability numeric check (win_probability is null or win_probability between 0 and 100),
  client_quality numeric check (client_quality is null or client_quality between 0 and 100),
  strategic_value numeric check (strategic_value is null or strategic_value between 0 and 100),
  scope_clarity numeric check (scope_clarity is null or scope_clarity between 0 and 100),
  delivery_risk numeric check (delivery_risk is null or delivery_risk between 0 and 100),
  weights jsonb not null,
  unknown_factors text[] not null default '{}',
  total_score numeric not null check (total_score between 0 and 100),
  evidence_coverage numeric not null check (evidence_coverage between 0 and 1),
  recommendation text not null check (recommendation in ('APPLY_NOW', 'APPLY', 'CONSIDER', 'LOW_PRIORITY', 'SKIP')),
  explanation jsonb not null default '{}'::jsonb,
  calculation_version text not null,
  created_at timestamptz not null default now()
);

create index if not exists freelance_scores_owner_opportunity
  on app.freelance_opportunity_scores(owner_id, opportunity_id, created_at desc);

create table if not exists app.freelance_evidence_matches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  opportunity_id uuid not null,
  requirement_text text not null,
  evidence_handles jsonb not null default '[]'::jsonb,
  support_class text not null check (support_class in ('direct', 'transferable', 'related', 'weak', 'contradictory', 'missing')),
  confidence numeric check (confidence is null or confidence between 0 and 1),
  reason text not null,
  agent_run_id uuid references app.ai_runs(id) on delete set null,
  approved_for_proposal boolean not null default false,
  created_at timestamptz not null default now(),
  foreign key (owner_id, opportunity_id) references app.freelance_opportunities(owner_id, id) on delete cascade
);

create table if not exists app.freelance_evidence_gaps (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  opportunity_id uuid not null,
  requirement_text text not null,
  gap_type text not null check (gap_type in ('missing', 'weak', 'contradictory', 'unavailable')),
  smallest_improvement text not null,
  severity text not null default 'medium',
  created_at timestamptz not null default now(),
  foreign key (owner_id, opportunity_id) references app.freelance_opportunities(owner_id, id) on delete cascade
);

create table if not exists app.freelance_pricing_recommendations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  opportunity_id uuid not null references app.freelance_opportunities(id) on delete cascade,
  analysis_id uuid references app.freelance_opportunity_analyses(id) on delete set null,
  currency text not null,
  pricing_mode text not null check (pricing_mode in ('hourly', 'fixed', 'milestone')),
  estimated_hours numeric not null check (estimated_hours > 0),
  target_effective_rate numeric not null check (target_effective_rate > 0),
  risk_buffer_percent numeric not null check (risk_buffer_percent between 0 and 100),
  minimum_amount numeric not null check (minimum_amount >= 0),
  recommended_amount numeric not null check (recommended_amount >= 0),
  premium_amount numeric not null check (premium_amount >= 0),
  assumptions jsonb not null default '[]'::jsonb,
  evidence_snapshot jsonb not null default '{}'::jsonb,
  calculation_version text not null,
  created_at timestamptz not null default now()
);

create table if not exists app.freelance_proposals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  opportunity_id uuid not null unique,
  application_id uuid references app.applications(id) on delete set null,
  application_package_id uuid references app.application_packages(id) on delete set null,
  crm_status text not null default 'DISCOVERED',
  approval_state text not null default 'DRAFT',
  current_version_id uuid,
  pricing_recommendation_id uuid references app.freelance_pricing_recommendations(id) on delete set null,
  owner_notes text,
  revision integer not null default 0,
  approved_at timestamptz,
  submitted_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, id),
  foreign key (owner_id, opportunity_id) references app.freelance_opportunities(owner_id, id) on delete cascade,
  check (crm_status in ('DISCOVERED', 'QUALIFIED', 'PROPOSAL_DRAFTED', 'READY_FOR_REVIEW', 'SUBMITTED', 'VIEWED', 'CLIENT_RESPONDED', 'INTERVIEW', 'NEGOTIATION', 'WON', 'LOST', 'WITHDRAWN')),
  check (approval_state in ('DRAFT', 'READY_FOR_REVIEW', 'APPROVED', 'SUBMITTED', 'DECLINED'))
);

create table if not exists app.freelance_proposal_versions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  proposal_id uuid not null,
  version integer not null,
  content jsonb not null,
  rendered_body text not null,
  claim_refs jsonb not null default '[]'::jsonb,
  evidence_refs jsonb not null default '[]'::jsonb,
  unsupported_claims jsonb not null default '[]'::jsonb,
  source text not null check (source in ('generated', 'owner_edited', 'imported')),
  agent_run_id uuid,
  prompt_version text,
  model_version text,
  owner_edits jsonb not null default '{}'::jsonb,
  content_hash text not null,
  reviewed_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  unique (proposal_id, version),
  foreign key (owner_id, proposal_id) references app.freelance_proposals(owner_id, id) on delete cascade
);

alter table app.freelance_proposals
  add constraint freelance_proposals_current_version_fk
  foreign key (current_version_id) references app.freelance_proposal_versions(id) on delete set null;

create table if not exists app.freelance_proposal_status_history (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  proposal_id uuid not null,
  from_status text,
  to_status text,
  from_approval_state text,
  to_approval_state text,
  actor_id uuid,
  reason text,
  transitioned_at timestamptz not null default now(),
  foreign key (owner_id, proposal_id) references app.freelance_proposals(owner_id, id) on delete cascade
);

drop trigger if exists freelance_proposal_status_history_append_only on app.freelance_proposal_status_history;
create trigger freelance_proposal_status_history_append_only
  before update or delete on app.freelance_proposal_status_history
  for each row execute function app.prevent_append_only_mutation();

create table if not exists app.freelance_attachments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  opportunity_id uuid not null,
  private_object_key text,
  original_filename text,
  media_type text,
  byte_size bigint,
  content_hash text,
  availability text not null default 'available',
  visibility text not null default 'private',
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  removed_at timestamptz,
  foreign key (owner_id, opportunity_id) references app.freelance_opportunities(owner_id, id) on delete cascade
);

create table if not exists app.freelance_agent_feedback (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references app.profiles(id) on delete cascade,
  opportunity_id uuid not null,
  proposal_version_id uuid,
  agent_task text not null,
  rating integer check (rating is null or rating between 1 and 5),
  feedback text,
  labels text[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (owner_id, opportunity_id) references app.freelance_opportunities(owner_id, id) on delete cascade
);

create or replace function app.is_valid_freelance_score_weights(p_weights jsonb)
returns boolean
language plpgsql
immutable
set search_path = pg_catalog, app
as $$
declare
  item record;
  total numeric := 0;
begin
  if jsonb_typeof(p_weights) <> 'object' or jsonb_object_length(p_weights) <> 8 then
    return false;
  end if;
  if not (p_weights ?& array['technicalFit', 'evidenceStrength', 'budgetEconomics', 'winProbability', 'clientQuality', 'strategicValue', 'scopeClarity', 'deliveryRisk']) then
    return false;
  end if;
  for item in select key, value from jsonb_each_text(p_weights) loop
    if item.value !~ '^[0-9]+([.][0-9]+)?$' then
      return false;
    end if;
    total := total + item.value::numeric;
  end loop;
  return total = 100;
exception when others then
  return false;
end;
$$;

create table if not exists app.freelance_score_configurations (
  owner_id uuid primary key references app.profiles(id) on delete cascade,
  weights jsonb not null check (app.is_valid_freelance_score_weights(weights)),
  updated_at timestamptz not null default now()
);

create or replace function app.create_manual_freelance_opportunity(p_input jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, app, public
as $$
declare
  v_owner_id uuid := auth.uid();
  v_client_id uuid;
  v_job app.jobs%rowtype;
  v_opportunity app.freelance_opportunities%rowtype;
  v_description text := left(btrim(coalesce(p_input->>'description', '')), 100000);
  v_title text := left(btrim(coalesce(p_input->>'title', '')), 240);
  v_client_name text := nullif(left(btrim(coalesce(p_input->>'clientName', '')), 240), '');
  v_client_url text := nullif(left(btrim(coalesce(p_input->>'clientUrl', '')), 2000), '');
  v_url text := nullif(left(btrim(coalesce(p_input->>'url', '')), 2000), '');
  v_fingerprint text := p_input->>'fingerprint';
begin
  if v_owner_id is null or not app.is_configured_owner() then
    raise exception using errcode = '42501', message = 'OWNER_AUTHORIZATION_REQUIRED';
  end if;
  if v_title = '' or v_description = '' or v_fingerprint is null
     or v_fingerprint !~ '^[0-9a-f]{64}$'
     or coalesce(p_input->>'descriptionHash', '') !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'FREELANCE_TITLE_AND_DESCRIPTION_REQUIRED';
  end if;
  if v_url is not null and v_url !~* '^https://([[:alnum:]-]+\.)*upwork\.com(:[0-9]+)?(/|\?|#|$)' then
    raise exception using errcode = '22023', message = 'UPWORK_URL_REQUIRED';
  end if;
  if v_client_url is not null and v_client_url !~* '^https://' then
    raise exception using errcode = '22023', message = 'CLIENT_URL_MUST_USE_HTTPS';
  end if;
  if coalesce(p_input->>'budgetType', 'unknown') not in ('hourly', 'fixed', 'milestone', 'unknown') then
    raise exception using errcode = '22023', message = 'BUDGET_TYPE_INVALID';
  end if;
  if exists (select 1 from app.freelance_opportunities where owner_id = v_owner_id and source_hash = v_fingerprint) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_FREELANCE_OPPORTUNITY';
  end if;
  if v_url is not null and exists (
    select 1 from app.jobs
    where owner_id = v_owner_id
      and opportunity_domain = 'freelance'
      and source_provider = 'upwork'
      and source_url = v_url
  ) then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_FREELANCE_OPPORTUNITY';
  end if;

  if v_client_name is not null then
    select id into v_client_id
    from app.freelance_clients
    where owner_id = v_owner_id and provider = 'upwork' and lower(display_name) = lower(v_client_name)
    order by created_at
    limit 1;
    if v_client_id is null then
      insert into app.freelance_clients(owner_id, provider, display_name, profile_url, country, timezone)
      values (
        v_owner_id,
        'upwork',
        v_client_name,
        v_client_url,
        nullif(left(btrim(coalesce(p_input->>'clientCountry', '')), 120), ''),
        nullif(left(btrim(coalesce(p_input->>'clientTimezone', '')), 120), '')
      ) returning id into v_client_id;
    end if;
  end if;

  insert into app.jobs(
    owner_id, canonical_company, canonical_title, current_description, source_url,
    source_provider, opportunity_domain, contract_type, normalized_fingerprint, status
  ) values (
    v_owner_id,
    coalesce(v_client_name, 'Upwork client'),
    v_title,
    v_description,
    v_url,
    'upwork', 'freelance', 'freelance', v_fingerprint, 'discovered'
  ) returning * into v_job;

  insert into app.job_descriptions(job_id, version, original_text_hash, normalized_text, source, active)
  values (
    v_job.id,
    1,
    p_input->>'descriptionHash',
    v_description,
    'owner',
    true
  );

  insert into app.freelance_opportunities(
    owner_id, job_id, provider, import_mode, client_id, budget_type,
    budget_min, budget_max, hourly_min, hourly_max, currency,
    estimated_duration, timezone_requirements, skills, service_tags, owner_notes, source_hash
  ) values (
    v_owner_id,
    v_job.id,
    'upwork',
    'manual',
    v_client_id,
    coalesce(nullif(p_input->>'budgetType', ''), 'unknown'),
    nullif(p_input->>'budgetMin', '')::numeric,
    nullif(p_input->>'budgetMax', '')::numeric,
    nullif(p_input->>'hourlyMin', '')::numeric,
    nullif(p_input->>'hourlyMax', '')::numeric,
    nullif(upper(left(btrim(coalesce(p_input->>'currency', '')), 12)), ''),
    nullif(left(btrim(coalesce(p_input->>'duration', '')), 120), ''),
    nullif(left(btrim(coalesce(p_input->>'timezoneRequirements', '')), 240), ''),
    case when jsonb_typeof(p_input->'skills') = 'array' then array(select left(value, 120) from jsonb_array_elements_text(p_input->'skills') with ordinality as skill(value, n) order by n limit 80) else '{}' end,
    case when jsonb_typeof(p_input->'serviceTags') = 'array' then array(select left(value, 120) from jsonb_array_elements_text(p_input->'serviceTags') with ordinality as tag(value, n) order by n limit 80) else '{}' end,
    nullif(left(btrim(coalesce(p_input->>'ownerNotes', '')), 10000), ''),
    v_fingerprint
  ) returning * into v_opportunity;

  insert into app.job_status_history(job_id, from_status, to_status, actor_id, reason)
  values (v_job.id, null, 'discovered', v_owner_id, 'manual_freelance_import');

  return jsonb_build_object('opportunity', to_jsonb(v_opportunity), 'job', to_jsonb(v_job));
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'DUPLICATE_FREELANCE_OPPORTUNITY';
end;
$$;

revoke all on function app.create_manual_freelance_opportunity(jsonb) from public, anon;
grant execute on function app.create_manual_freelance_opportunity(jsonb) to authenticated;

-- Existing lexical retrieval is owner filtered, so manual opportunity analysis
-- can combine it with the existing private vector retrieval RPC.
create or replace function app.search_owner_evidence_lexical(
  requested_query text,
  requested_limit integer default 24
)
returns table(
  chunk_id uuid,
  evidence_source_id uuid,
  source_title text,
  source_type text,
  content text,
  rank real
)
language sql
stable
security invoker
set search_path = pg_catalog, app, public
as $$
  select chunk.id, source.id, source.title, source.source_type, chunk.content,
    ts_rank_cd(chunk.search_vector, plainto_tsquery('simple', requested_query))::real
  from app.evidence_chunks chunk
  join app.evidence_versions version on version.id = chunk.evidence_version_id
  join app.evidence_sources source on source.id = version.evidence_source_id
  where source.owner_id = auth.uid()
    and app.is_configured_owner()
    and source.availability in ('available', 'partial')
    and chunk.deleted_at is null
    and chunk.visibility in ('private', 'public')
    and chunk.search_vector @@ plainto_tsquery('simple', requested_query)
  order by ts_rank_cd(chunk.search_vector, plainto_tsquery('simple', requested_query)) desc, chunk.id
  limit least(greatest(requested_limit, 1), 50);
$$;

revoke all on function app.search_owner_evidence_lexical(text, integer) from public, anon;
grant execute on function app.search_owner_evidence_lexical(text, integer) to authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'freelance_clients',
    'freelance_opportunities',
    'freelance_opportunity_analyses',
    'freelance_opportunity_scores',
    'freelance_evidence_matches',
    'freelance_evidence_gaps',
    'freelance_pricing_recommendations',
    'freelance_proposals',
    'freelance_proposal_versions',
    'freelance_proposal_status_history',
    'freelance_attachments',
    'freelance_agent_feedback',
    'freelance_score_configurations'
  ] loop
    execute format('alter table app.%I enable row level security', table_name);
    execute format('drop policy if exists %I_owner on app.%I', table_name, table_name);
    execute format(
      'create policy %I_owner on app.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      table_name,
      table_name
    );
    execute format('grant select, insert, update, delete on app.%I to authenticated', table_name);
  end loop;
end $$;
