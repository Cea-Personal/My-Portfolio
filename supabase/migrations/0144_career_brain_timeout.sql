-- Career Brain synthesis reconciles many private sources and needs a longer
-- execution window than the short default used by health checks.
update app.ai_capability_configs
set timeout_ms = 120000,
    updated_at = now()
where task_type = 'orchestrator'
  and timeout_ms < 120000;

notify pgrst, 'reload schema';
