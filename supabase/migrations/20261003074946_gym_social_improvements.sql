begin;

create table if not exists public.notification_preferences (
 user_id uuid primary key references public.profiles(id) on delete cascade,
 workout_enabled boolean not null default false,
 partner_enabled boolean not null default true
);
alter table public.notification_preferences enable row level security;
revoke all on public.notification_preferences from public, anon, authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
do $new_policy$
begin
 if not exists(select 1 from pg_policy where polrelid='public.notification_preferences'::regclass and polname='preferences_own') then
  create policy preferences_own on public.notification_preferences to authenticated
 using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()) and (select loads_private.current_account_writable()));
 end if;
end; $new_policy$;

create table if not exists public.push_devices (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 device_id uuid not null,
 token text not null unique check(token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$'),
 platform text not null check(platform in ('ios','android')),
 updated_at timestamptz not null default now(),
 enabled boolean not null default true,
 unique(user_id,device_id)
);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from public,anon,authenticated;
grant select,delete on public.push_devices to authenticated;
do $new_policy$
begin
 if not exists(select 1 from pg_policy where polrelid='public.push_devices'::regclass and polname='devices_own') then
  create policy devices_own on public.push_devices to authenticated using(user_id=(select auth.uid()));
 end if;
end; $new_policy$;

-- Authenticated registration is the sole write path; tokens never appear in feed queries.
create or replace function public.register_push_device(p_device_id uuid,p_token text,p_platform text) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not loads_private.current_account_writable() then raise exception 'DEVICE_NOT_ALLOWED'; end if;
 perform pg_advisory_xact_lock_shared(hashtextextended('loads-account/'||auth.uid()::text,0));
 -- Keep the old device row and its delivery history when a token changes owner.
 -- A disabled retirement marker releases the unique token without removing data.
 perform pg_advisory_xact_lock(hashtextextended('loads-push-token/'||p_token,0));
 update public.push_devices set enabled=false,
 token='ExpoPushToken[retired_'||replace(id::text,'-','')||']'
 where token=p_token and (user_id<>auth.uid() or device_id<>p_device_id);
 insert into public.push_devices(user_id,device_id,token,platform) values(auth.uid(),p_device_id,p_token,p_platform)
 on conflict(user_id,device_id) do update set token=excluded.token,platform=excluded.platform,enabled=true,updated_at=now();
end; $$;
revoke all on function public.register_push_device(uuid,text,text) from public,anon,authenticated;
grant execute on function public.register_push_device(uuid,text,text) to authenticated;

create table if not exists public.workout_completions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 client_workout_id text not null check(length(client_workout_id) between 1 and 100),
 finished_at timestamptz not null,
 duration_seconds integer not null check(duration_seconds between 0 and 604800),
 created_at timestamptz not null default now(),
 unique(user_id,client_workout_id)
);
alter table public.workout_completions enable row level security;
revoke all on public.workout_completions from public,anon,authenticated;
grant select on public.workout_completions to authenticated;
do $new_policy$
begin
 if not exists(select 1 from pg_policy where polrelid='public.workout_completions'::regclass and polname='completions_own') then
  create policy completions_own on public.workout_completions for select to authenticated using(user_id=(select auth.uid()));
 end if;
end; $new_policy$;

create table if not exists public.post_partners (
 post_id uuid not null references public.posts(id) on delete cascade,
 author_id uuid not null references public.profiles(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 username text not null,
 primary key(post_id,user_id), check(author_id<>user_id)
);
create index if not exists post_partners_recipient_idx on public.post_partners(user_id,post_id);
create index if not exists post_partners_author_idx on public.post_partners(author_id);
alter table public.post_partners enable row level security;
revoke all on public.post_partners from public,anon,authenticated;
grant select on public.post_partners to authenticated;
-- Do not reference posts here: posts SELECT references tags, which would recurse.
do $new_policy$
begin
 if not exists(select 1 from pg_policy where polrelid='public.post_partners'::regclass and polname='partners_read') then
  create policy partners_read on public.post_partners for select to authenticated using(
 user_id=(select auth.uid()) or author_id=(select auth.uid()) or author_id in
 (select following_id from public.follows where follower_id=(select auth.uid())));
 end if;
end; $new_policy$;

alter table public.posts add column if not exists training_partner_ids uuid[] not null default '{}';
do $constraint$
begin
 if not exists(select 1 from pg_constraint where conrelid='public.posts'::regclass and conname='posts_partner_limit') then
  alter table public.posts add constraint posts_partner_limit check(cardinality(training_partner_ids)<=3);
 end if;
end; $constraint$;
create index if not exists posts_partner_ids_idx on public.posts using gin(training_partner_ids);

create table if not exists loads_private.push_deliveries (
 id uuid primary key default gen_random_uuid(),
 event_key text not null,
 kind text not null check(kind in ('workout','partner')),
 actor_id uuid not null references public.profiles(id) on delete cascade,
 recipient_id uuid not null references public.profiles(id) on delete cascade,
 device_id uuid not null references public.push_devices(id) on delete cascade,
 post_id uuid references public.posts(id) on delete cascade,
 state text not null default 'pending' check(state in ('pending','sending','accepted','delivered','failed','uncertain')),
 ticket_id text,
 created_at timestamptz not null default now(),
 attempted_at timestamptz,
 check(actor_id<>recipient_id), unique(event_key,device_id)
);
alter table loads_private.push_deliveries enable row level security;
revoke all on loads_private.push_deliveries from public,anon,authenticated;
create index if not exists push_deliveries_pending_idx on loads_private.push_deliveries(created_at) where state='pending';
create index if not exists push_deliveries_actor_idx on loads_private.push_deliveries(actor_id);
create index if not exists push_deliveries_recipient_idx on loads_private.push_deliveries(recipient_id);
create index if not exists push_deliveries_device_idx on loads_private.push_deliveries(device_id);
create index if not exists push_deliveries_post_idx on loads_private.push_deliveries(post_id) where post_id is not null;
create index if not exists push_deliveries_receipt_idx on loads_private.push_deliveries(attempted_at) where state='accepted';

create or replace function public.record_workout_completion(p_workout_id text,p_finished_at timestamptz,p_duration_seconds integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare event_id uuid;
begin
 if auth.uid() is null then raise exception 'COMPLETION_NOT_ALLOWED'; end if;
 perform pg_advisory_xact_lock_shared(hashtextextended('loads-account/'||auth.uid()::text,0));
 if not loads_private.current_account_writable() then raise exception 'COMPLETION_NOT_ALLOWED'; end if;
 -- Serialize finish events per account and cap notification fanout abuse.
 perform pg_advisory_xact_lock(hashtextextended('loads-finish/'||auth.uid()::text,0));
 select id into event_id from public.workout_completions where user_id=auth.uid() and client_workout_id=p_workout_id;
 if event_id is not null then return event_id; end if;
 if (select count(*) from public.workout_completions where user_id=auth.uid() and created_at>now()-interval '1 minute')>=5 then raise exception 'PLEASE_RETRY_LATER'; end if;
 insert into public.workout_completions(user_id,client_workout_id,finished_at,duration_seconds)
 values(auth.uid(),p_workout_id,p_finished_at,p_duration_seconds) returning id into event_id;
 insert into loads_private.push_deliveries(event_key,kind,actor_id,recipient_id,device_id)
 select 'workout/'||event_id::text,'workout',auth.uid(),f.follower_id,d.id
 from public.follows f join public.notification_preferences pref on pref.user_id=f.follower_id and pref.workout_enabled
 join public.push_devices d on d.user_id=f.follower_id and d.enabled and d.updated_at>now()-interval '90 days'
 where f.following_id=auth.uid() and f.follower_id<>auth.uid()
 and not exists(select 1 from loads_private.account_deletion_jobs j where j.user_id=f.follower_id)
 on conflict do nothing;
 return event_id;
end; $$;
revoke all on function public.record_workout_completion(text,timestamptz,integer) from public,anon,authenticated;
grant execute on function public.record_workout_completion(text,timestamptz,integer) to authenticated;

create or replace function loads_private.validate_training_partners() returns trigger
language plpgsql security definer set search_path='' as $$
declare partner uuid;
begin
 if tg_op='UPDATE' and new.training_partner_ids is distinct from old.training_partner_ids then raise exception 'TAGS_IMMUTABLE'; end if;
 if tg_op='UPDATE' then return new; end if;
 if cardinality(new.training_partner_ids)=0 then return new; end if;
 if auth.uid() is null or new.user_id<>auth.uid() then raise exception 'TAGS_NOT_ALLOWED'; end if;
 if cardinality(new.training_partner_ids)>3 or cardinality(new.training_partner_ids)<>(select count(distinct x) from unnest(new.training_partner_ids) x) then raise exception 'INVALID_PARTNERS'; end if;
 for partner in select unnest(new.training_partner_ids) order by 1 loop
  perform pg_advisory_xact_lock_shared(hashtextextended('loads-account/'||partner::text,0));
  if partner=new.user_id or not exists(select 1 from public.follows where follower_id=new.user_id and following_id=partner)
   or exists(select 1 from loads_private.account_deletion_jobs where user_id=partner) then raise exception 'INVALID_PARTNER'; end if;
 end loop;
 return new;
end; $$;
revoke all on function loads_private.validate_training_partners() from public,anon,authenticated;
create or replace trigger posts_validate_partners before insert or update on public.posts for each row execute function loads_private.validate_training_partners();

create or replace function loads_private.save_training_partners() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into public.post_partners(post_id,author_id,user_id,username)
 select new.id,new.user_id,p.id,p.username from public.profiles p where p.id=any(new.training_partner_ids);
 insert into loads_private.push_deliveries(event_key,kind,actor_id,recipient_id,device_id,post_id)
 select 'partner/'||new.id::text,'partner',new.user_id,t.user_id,d.id,new.id
 from public.post_partners t join public.push_devices d on d.user_id=t.user_id and d.enabled and d.updated_at>now()-interval '90 days'
 left join public.notification_preferences pref on pref.user_id=t.user_id
 where t.post_id=new.id and coalesce(pref.partner_enabled,true) and t.user_id<>new.user_id
 on conflict do nothing;
 return new;
end; $$;
revoke all on function loads_private.save_training_partners() from public,anon,authenticated;
create or replace trigger posts_save_partners after insert on public.posts for each row execute function loads_private.save_training_partners();

-- Caller RLS still applies to the association lookup. This helper is not privileged.
create or replace function loads_private.is_training_partner(p_post_id uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.post_partners where post_id=p_post_id and user_id=(select auth.uid()));
$$;
revoke all on function loads_private.is_training_partner(uuid) from public,anon,authenticated;
grant execute on function loads_private.is_training_partner(uuid) to authenticated;

-- Preserve the actual existing expression, including any additional production
-- clauses, together with the policy OID, roles, command and restrictive flag.
do $policy$
declare current_using text; policy_command "char"; current_roles oid[];
begin
 select pg_get_expr(polqual,polrelid),polcmd,polroles into current_using,policy_command,current_roles
 from pg_policy where polrelid='public.posts'::regclass and polname='posts_following_read';
 if not found or policy_command<>'r' then raise exception 'posts_following_read SELECT policy is required'; end if;
 if current_roles<>array[(select oid from pg_roles where rolname='authenticated')] then
  raise exception 'Review required: unexpected posts_following_read roles';
 end if;
 -- A missing USING expression already permits every row; never narrow it.
 if current_using is not null and strpos(current_using,'loads_private.is_training_partner(id)')=0 then
  execute format('alter policy posts_following_read on public.posts using ((%s) or loads_private.is_training_partner(id))',current_using);
 end if;
end; $policy$;
create or replace view public.following_feed with (security_invoker=true) as select p.* from public.posts p where
 p.user_id=(select auth.uid()) or p.user_id in(select following_id from public.follows where follower_id=(select auth.uid()))
 or p.id in(select post_id from public.post_partners where user_id=(select auth.uid()));

-- Worker only RPCs. Preferences and follow relationship are rechecked at delivery time.
create or replace function public.claim_push_deliveries() returns jsonb
language plpgsql security definer set search_path='' as $$
declare payload jsonb;
begin
 update loads_private.push_deliveries set state='uncertain' where state='sending' and attempted_at<now()-interval '5 minutes';
 update loads_private.push_deliveries set state='uncertain' where state='accepted' and attempted_at<now()-interval '24 hours';
 with candidates as (
 select q.id from loads_private.push_deliveries q join public.push_devices d on d.id=q.device_id and d.enabled and d.user_id=q.recipient_id
 left join public.notification_preferences p on p.user_id=q.recipient_id
 where q.state='pending' and q.created_at>now()-interval '24 hours'
 and not exists(select 1 from loads_private.account_deletion_jobs j where j.user_id in(q.actor_id,q.recipient_id))
 and ((q.kind='partner' and coalesce(p.partner_enabled,true)) or (q.kind='workout' and coalesce(p.workout_enabled,false)
 and exists(select 1 from public.follows f where f.follower_id=q.recipient_id and f.following_id=q.actor_id)))
 order by q.created_at for update of q skip locked limit 100
 ), claimed as (update loads_private.push_deliveries q set state='sending',attempted_at=now() from candidates c where q.id=c.id returning q.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'token',d.token,'kind',c.kind,'recipientId',c.recipient_id,'actorId',c.actor_id,'postId',c.post_id,'actorName',coalesce(nullif(trim(p.display_name),''),p.username))), '[]'::jsonb)
 into payload from claimed c join public.push_devices d on d.id=c.device_id join public.profiles p on p.id=c.actor_id;
 return payload;
end; $$;
create or replace function public.finish_push_delivery(p_id uuid,p_state text,p_ticket text default null,p_disable boolean default false) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_state not in('accepted','delivered','failed','uncertain') then raise exception 'INVALID_STATE'; end if;
 if p_disable then update public.push_devices set enabled=false where id=(select device_id from loads_private.push_deliveries where id=p_id); end if;
 update loads_private.push_deliveries set state=p_state,ticket_id=coalesce(p_ticket,ticket_id) where id=p_id and state in('sending','accepted');
end; $$;
create or replace function public.pending_push_receipts() returns jsonb
language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'ticket',ticket_id)), '[]'::jsonb) from
 (select id,ticket_id from loads_private.push_deliveries where state='accepted' and attempted_at<now()-interval '15 minutes' order by attempted_at limit 100) q;
$$;
revoke all on function public.claim_push_deliveries(),public.finish_push_delivery(uuid,text,text,boolean),public.pending_push_receipts() from public,anon,authenticated;
grant execute on function public.claim_push_deliveries(),public.finish_push_delivery(uuid,text,text,boolean),public.pending_push_receipts() to service_role;

-- Existing objects may be reused only if their required column contract matches.
-- Incompatible objects abort the transaction instead of silently skipping drift.
do $compatibility$
declare incompatible text;
begin
 select string_agg(expected.relation||'.'||expected.column_name,', ') into incompatible
 from (values
 ('public.notification_preferences','user_id','uuid',true),
 ('public.notification_preferences','workout_enabled','boolean',true),
 ('public.notification_preferences','partner_enabled','boolean',true),
 ('public.push_devices','id','uuid',true),
 ('public.push_devices','user_id','uuid',true),
 ('public.push_devices','device_id','uuid',true),
 ('public.push_devices','token','text',true),
 ('public.push_devices','platform','text',true),
 ('public.push_devices','updated_at','timestamp with time zone',true),
 ('public.push_devices','enabled','boolean',true),
 ('public.workout_completions','id','uuid',true),
 ('public.workout_completions','user_id','uuid',true),
 ('public.workout_completions','client_workout_id','text',true),
 ('public.workout_completions','finished_at','timestamp with time zone',true),
 ('public.workout_completions','duration_seconds','integer',true),
 ('public.workout_completions','created_at','timestamp with time zone',true),
 ('public.post_partners','post_id','uuid',true),
 ('public.post_partners','author_id','uuid',true),
 ('public.post_partners','user_id','uuid',true),
 ('public.post_partners','username','text',true),
 ('loads_private.push_deliveries','id','uuid',true),
 ('loads_private.push_deliveries','event_key','text',true),
 ('loads_private.push_deliveries','kind','text',true),
 ('loads_private.push_deliveries','actor_id','uuid',true),
 ('loads_private.push_deliveries','recipient_id','uuid',true),
 ('loads_private.push_deliveries','device_id','uuid',true),
 ('loads_private.push_deliveries','post_id','uuid',false),
 ('loads_private.push_deliveries','state','text',true),
 ('loads_private.push_deliveries','ticket_id','text',false),
 ('loads_private.push_deliveries','created_at','timestamp with time zone',true),
 ('loads_private.push_deliveries','attempted_at','timestamp with time zone',false),
 ('public.posts','training_partner_ids','uuid[]',true)
 ) expected(relation,column_name,type_name,required)
 left join pg_attribute a on a.attrelid=to_regclass(expected.relation) and a.attname=expected.column_name and not a.attisdropped
 where a.attnum is null or format_type(a.atttypid,a.atttypmod)<>expected.type_name or a.attnotnull<>expected.required;
 if incompatible is not null then raise exception 'Incompatible existing columns: %',incompatible; end if;
 if (select pg_get_expr(d.adbin,d.adrelid) from pg_attrdef d join pg_attribute a on a.attrelid=d.adrelid and a.attnum=d.adnum
     where d.adrelid='public.posts'::regclass and a.attname='training_partner_ids') is distinct from $empty$'{}'::uuid[]$empty$
 then raise exception 'training_partner_ids must default to an empty UUID array'; end if;
 if not exists(select 1 from pg_constraint where conrelid='public.posts'::regclass and conname='posts_partner_limit'
   and contype='c' and convalidated and pg_get_constraintdef(oid)='CHECK ((cardinality(training_partner_ids) <= 3))')
 then raise exception 'Incompatible posts_partner_limit constraint'; end if;
 -- Validate the keys needed by authenticated upserts and server deduplication.
 select string_agg(expected.relation,', ') into incompatible from (values
 ('public.notification_preferences','p',array['user_id']),
 ('public.push_devices','p',array['id']),
 ('public.push_devices','u',array['token']),
 ('public.push_devices','u',array['user_id','device_id']),
 ('public.workout_completions','p',array['id']),
 ('public.workout_completions','u',array['user_id','client_workout_id']),
 ('public.post_partners','p',array['post_id','user_id']),
 ('loads_private.push_deliveries','p',array['id']),
 ('loads_private.push_deliveries','u',array['event_key','device_id'])
 ) expected(relation,key_type,columns) where not exists(
  select 1 from pg_constraint c where c.conrelid=to_regclass(expected.relation) and c.contype::text=expected.key_type
  and array(select a.attname::text from unnest(c.conkey) with ordinality k(attnum,position)
    join pg_attribute a on a.attrelid=c.conrelid and a.attnum=k.attnum order by k.position)=expected.columns
 );
 if incompatible is not null then raise exception 'Incompatible existing keys: %',incompatible; end if;
 -- Foreign keys are required for profile/post/device consistency and the existing
 -- account-removal lifecycle; these definitions do not remove any rows on apply.
 select string_agg(expected.relation||'.'||expected.column_name,', ') into incompatible from (values
 ('public.notification_preferences','user_id','public.profiles'),
 ('public.push_devices','user_id','public.profiles'),
 ('public.workout_completions','user_id','public.profiles'),
 ('public.post_partners','post_id','public.posts'),
 ('public.post_partners','author_id','public.profiles'),
 ('public.post_partners','user_id','public.profiles'),
 ('loads_private.push_deliveries','actor_id','public.profiles'),
 ('loads_private.push_deliveries','recipient_id','public.profiles'),
 ('loads_private.push_deliveries','device_id','public.push_devices'),
 ('loads_private.push_deliveries','post_id','public.posts')
 ) expected(relation,column_name,target) where not exists(
  select 1 from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and c.conkey=array[a.attnum]
  join pg_attribute target_column on target_column.attrelid=c.confrelid and c.confkey=array[target_column.attnum]
  where c.conrelid=to_regclass(expected.relation) and c.confrelid=to_regclass(expected.target)
  and c.contype='f' and c.convalidated and c.confdeltype='c' and a.attname=expected.column_name and target_column.attname='id'
 );
 if incompatible is not null then raise exception 'Incompatible existing references: %',incompatible; end if;
end; $compatibility$;
notify pgrst,'reload schema';
commit;
