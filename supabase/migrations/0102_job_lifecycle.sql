update app.jobs set status = case status
  when 'reviewing' then 'shortlisted'
  when 'archived' then 'withdrawn'
  when 'closed' then 'expired'
  else status
end
where status in ('reviewing', 'archived', 'closed');

alter table app.jobs drop constraint if exists jobs_status_check;
alter table app.jobs add constraint jobs_status_check check (status in (
  'discovered', 'shortlisted', 'interested', 'preparing_application', 'ready_to_apply',
  'applied', 'recruiter_contact', 'interview', 'technical_assessment', 'final_interview',
  'offer', 'rejected', 'withdrawn', 'expired'
));
