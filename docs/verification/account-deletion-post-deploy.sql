-- Read-only deployment inspection. Never invokes deletion or reads credentials.
with checks as (
select 'counts' as item, jsonb_build_object(
 'posts',(select count(*) from public.posts),
 'profiles',(select count(*) from public.profiles),
 'deleted_posts',(select count(*) from public.deleted_posts),
 'jobs',(select count(*) from loads_private.account_deletion_jobs),
 'receipts',(select count(*) from loads_private.account_deletion_receipts)) as detail
union all
select 'table:'||c.relname, jsonb_build_object('rls',c.relrowsecurity,
 'anon_access',has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
 'authenticated_access',has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='loads_private' and c.relname in ('account_deletion_jobs','account_deletion_receipts')
union all
select 'function:'||p.proname, jsonb_build_object('definer',p.prosecdef,'settings',p.proconfig,
 'anon_execute',has_function_privilege('anon',p.oid,'EXECUTE'),
 'authenticated_execute',has_function_privilege('authenticated',p.oid,'EXECUTE'),
 'service_execute',has_function_privilege('service_role',p.oid,'EXECUTE'))
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname='loads_private' and p.proname='current_account_writable')
or (n.nspname='public' and p.proname in ('prepare_account_receipt','accept_account_deletion','cancel_unstarted_account_deletion','account_deletion_status','claim_account_deletion','account_photo_paths','advance_account_deletion','completed_account_cleanup_paths'))
union all
select 'policy:'||policyname,jsonb_build_object('table',schemaname||'.'||tablename,'type',permissive,'roles',roles,'command',cmd,'using',qual,'check',with_check)
from pg_policies where policyname in ('posts_account_insert','posts_account_update','profiles_account_insert','profiles_account_update','storage_account_insert','storage_account_update')
union all
select 'cron:'||jobname,jsonb_build_object('jobid',jobid,'schedule',schedule,'active',active)
from cron.job where jobname='loads-deletion-cleanup'
union all
select 'cron_recent',coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from (
 select d.jobid,d.status,d.start_time,d.end_time from cron.job_run_details d
 join cron.job j using(jobid) where j.jobname='loads-deletion-cleanup'
 order by d.start_time desc limit 3
) r
)
select item,detail::text from checks order by item;
