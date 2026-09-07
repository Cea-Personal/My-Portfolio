-- The original foundation migration over-escaped the dot in this regex.
-- That rejected valid durable event names such as career/export.requested.v1.
alter table app.outbox_events
  drop constraint if exists outbox_events_event_name_check;

alter table app.outbox_events
  add constraint outbox_events_event_name_check
  check (event_name ~ E'\\.v[0-9]+$');

notify pgrst, 'reload schema';
