-- READ ONLY. Run only in the intended project's SQL editor; no row content,
-- credentials, notification RPCs, grants, DDL or migration application.
begin read only;

select name, to_regclass(name) is not null as exists
from (values ('public.workout_reactions'), ('loads_private.reaction_events'),
 ('public.notification_preferences'), ('loads_private.push_deliveries'),
 ('supabase_migrations.schema_migrations')) expected(name);

select n.nspname as schema_name,c.relname,c.relrowsecurity
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where (n.nspname,c.relname) in (('public','workout_reactions'),('loads_private','reaction_events'));

select table_schema,table_name,column_name,data_type
from information_schema.columns
where (table_schema,table_name) in (('public','workout_reactions'),('public','notification_preferences'),('loads_private','push_deliveries'))
and column_name in ('post_id','user_id','reaction_type','created_at','updated_at','reaction_enabled')
order by table_schema,table_name,column_name;

select schemaname,tablename,policyname,cmd,roles,qual,with_check
from pg_policies where schemaname='public' and tablename='workout_reactions';

select grantee,table_schema,table_name,privilege_type
from information_schema.role_table_grants
where table_schema='public' and table_name='workout_reactions' and grantee in ('anon','authenticated');
select grantee,column_name,privilege_type from information_schema.column_privileges
where table_schema='public' and table_name='workout_reactions' and grantee in ('anon','authenticated');

select n.nspname as schema_name,p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'execute') as service_execute,
 case when p.proname='claim_push_deliveries' then strpos(p.prosrc,'reaction_enabled')>0 end as reaction_claim_supported
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname,p.proname) in (('loads_private','guard_reaction'),('loads_private','queue_reaction'),('public','claim_push_deliveries'));

select t.tgname,n.nspname as function_schema,p.proname
from pg_trigger t join pg_proc p on p.oid=t.tgfoid join pg_namespace n on n.oid=p.pronamespace
where t.tgrelid=to_regclass('public.workout_reactions') and not t.tgisinternal;

-- Metadata-only history check; also works when the history table is absent.
do $history$
declare applied boolean;
begin
 if to_regclass('supabase_migrations.schema_migrations') is null then
  raise notice 'Reaction migration history: unavailable';
 else
  execute 'select exists(select 1 from supabase_migrations.schema_migrations where version=$1)' into applied using '20261015061237';
  raise notice 'Reaction migration recorded: %', applied;
 end if;
end; $history$;
commit;
