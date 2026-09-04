alter table app.automation_schedules
  add column if not exists cron_expression text;

update app.automation_schedules
set cron_expression = case recurrence
  when 'hourly' then '0 * * * *'
  when 'weekly' then '0 9 * * 1'
  else '0 9 * * *'
end
where cron_expression is null;

alter table app.automation_schedules
  alter column cron_expression set default '0 9 * * *',
  alter column cron_expression set not null;

alter table app.automation_schedules
  drop constraint if exists automation_schedules_cron_length;

alter table app.automation_schedules
  add constraint automation_schedules_cron_length
  check (char_length(cron_expression) between 9 and 120);
