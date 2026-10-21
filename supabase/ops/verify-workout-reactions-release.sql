-- READ ONLY, post-migration. Does not invoke notification/cleanup RPCs.
-- Run inspect-workout-reactions.sql first; absence of required tables is a STOP.
begin read only;
set local statement_timeout = '10s';

select version,name from supabase_migrations.schema_migrations
where version='20261015061237';

select n.nspname as schema_name,c.relname,c.relrowsecurity,
 has_table_privilege('anon',c.oid,'select') as anon_select,
 has_table_privilege('authenticated',c.oid,'select') as authenticated_select,
 has_table_privilege('authenticated',c.oid,'insert') as authenticated_insert,
 has_table_privilege('authenticated',c.oid,'delete') as authenticated_delete
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.oid in (to_regclass('public.workout_reactions'),to_regclass('loads_private.reaction_events'),to_regclass('loads_private.push_deliveries'));

select column_name,is_nullable,column_default from information_schema.columns
where table_schema='public' and table_name='notification_preferences' and column_name='reaction_enabled';

select column_name,
 has_column_privilege('authenticated','public.workout_reactions',column_name,'update') as authenticated_update
from information_schema.columns where table_schema='public' and table_name='workout_reactions';

select conrelid::regclass as relation,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where conrelid in
 (to_regclass('public.workout_reactions'),to_regclass('loads_private.reaction_events'),to_regclass('loads_private.push_deliveries'))
order by relation,conname;

-- PUBLIC default grants and inherited privileges are included by has_*_privilege.
select n.nspname,p.proname,p.prosecdef,p.proconfig,
 has_function_privilege('anon',p.oid,'execute') as anon_execute,
 has_function_privilege('authenticated',p.oid,'execute') as authenticated_execute,
 has_function_privilege('service_role',p.oid,'execute') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where (n.nspname,p.proname) in
 (('loads_private','guard_reaction'),('loads_private','queue_reaction'),('public','claim_push_deliveries'));

-- Replace ALL THREE NULLs with approved test UUIDs only. Unset scope reads no rows.
-- Never print device tokens, ticket IDs, event_key, profile details or general queue rows.
with scope as (
 select null::uuid as post_id,null::uuid as actor_id,null::uuid as recipient_id
)
select s.post_id is not null and s.actor_id is not null and s.recipient_id is not null as scope_ready,
 (select count(*) from public.workout_reactions r where r.post_id=s.post_id and r.user_id=s.actor_id) as own_reaction_rows,
 (select count(*) from loads_private.reaction_events e where e.post_id=s.post_id and e.user_id=s.actor_id) as event_markers,
 (select count(*) from loads_private.push_deliveries q where q.post_id=s.post_id and q.actor_id=s.actor_id
  and q.recipient_id=s.recipient_id and q.kind='reaction') as test_delivery_rows
from scope s where s.post_id is not null and s.actor_id is not null and s.recipient_id is not null;

with scope as (
 select null::uuid as post_id,null::uuid as actor_id,null::uuid as recipient_id
)
select q.state,count(*) as test_deliveries
from loads_private.push_deliveries q cross join scope s
where s.post_id is not null and s.actor_id is not null and s.recipient_id is not null
 and q.kind='reaction' and q.post_id=s.post_id and q.actor_id=s.actor_id and q.recipient_id=s.recipient_id
group by q.state;
commit;
