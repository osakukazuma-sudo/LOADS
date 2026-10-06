const fs = require('node:fs');
const source = fs.readFileSync('supabase/migrations/20261003074946_gym_social_improvements.sql', 'utf8');
if (/\b(drop\s+(table|column|policy)|truncate|delete\s+from)\b/i.test(source)) throw new Error('Destructive SQL');
const snapshot = `select jsonb_build_object(
 'profiles',(select jsonb_agg(to_jsonb(p) order by id) from public.profiles p),
 'posts',(select jsonb_agg(to_jsonb(p)-'training_partner_ids' order by id) from public.posts p),
 'follows',(select jsonb_agg(to_jsonb(f) order by follower_id,following_id) from public.follows f))`;
const sql = `begin;
set local lock_timeout='10s';
set local statement_timeout='60s';
lock table public.profiles,public.posts,public.follows in share mode;
create temporary table loads_deploy_snapshot on commit drop as ${snapshot} as data;
create temporary table loads_deploy_policy on commit drop as select oid,polroles,polpermissive,polcmd from pg_policy where polrelid='public.posts'::regclass and polname='posts_following_read';
do $preflight$ begin
 if exists(select 1 from supabase_migrations.schema_migrations where version='20261003074946') then raise exception 'Migration already applied'; end if;
 if exists(select 1 from pg_attribute where attrelid='public.posts'::regclass and attname='training_partner_ids' and not attisdropped) then raise exception 'Unexpected existing partner column'; end if;
end; $preflight$;
${source.replace(/^\s*begin;/i,'').replace(/commit;\s*$/i,'')}
do $verify$ declare actual jsonb; begin
 ${snapshot} into actual;
 if actual is distinct from (select data from loads_deploy_snapshot) then raise exception 'Existing data changed'; end if;
 if not exists(select 1 from pg_policy p join loads_deploy_policy old on p.oid=old.oid and p.polroles=old.polroles and p.polpermissive=old.polpermissive and p.polcmd=old.polcmd where p.polrelid='public.posts'::regclass and p.polname='posts_following_read' and strpos(pg_get_expr(p.polqual,p.polrelid),'loads_private.is_training_partner(id)')>0) then raise exception 'Policy identity changed'; end if;
 if (select count(*) from pg_class where oid=any(array['public.notification_preferences'::regclass,'public.push_devices'::regclass,'public.workout_completions'::regclass,'public.post_partners'::regclass,'loads_private.push_deliveries'::regclass,'public.posts'::regclass]) and relrowsecurity)<>6 then raise exception 'RLS verification failed'; end if;
end; $verify$;
insert into supabase_migrations.schema_migrations(version,name,statements) values('20261003074946','gym_social_improvements',array[$migration_source$${source}$migration_source$]);
commit;
select 'applied; existing row contents unchanged; RLS 6/6; policy identity preserved' as result;
`;
fs.mkdirSync('docs/verification', { recursive: true });
fs.writeFileSync('docs/verification/gym-production-apply.sql', sql);
console.log('Prepared atomic migration with data-preservation and RLS guards.');
