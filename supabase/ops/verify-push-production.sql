-- PUBLIC TEMPLATE: replace project/request placeholders for your own environment.
-- Read-only verification; no secret values or recipient identifiers are returned.
select jsonb_build_object(
 'smoke',(select jsonb_build_object('status',status_code,'body',content,'timed_out',timed_out,'error',error_msg) from net._http_response where id=:smoke_request_id),
 'cron',(select jsonb_agg(jsonb_build_object('jobid',jobid,'schedule',schedule,'active',active,'correct_url',strpos(command,'YOUR_PROJECT_REF.supabase.co/functions/v1/push-worker')>0)) from cron.job where jobname='loads-push-delivery'),
 'runs',(select jsonb_agg(jsonb_build_object('status',status,'message',return_message)) from (select status,return_message from cron.job_run_details where jobid=(select jobid from cron.job where jobname='loads-push-delivery') order by start_time desc limit 3) r),
 'counts',jsonb_build_object('profiles',(select count(*) from public.profiles),'posts',(select count(*) from public.posts),'follows',(select count(*) from public.follows),'devices',(select count(*) from public.push_devices),'deliveries',(select count(*) from loads_private.push_deliveries))) as verification;
