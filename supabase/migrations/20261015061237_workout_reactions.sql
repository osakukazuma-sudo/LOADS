begin;
-- Refuse to overwrite deployment-specific worker logic. Review drift explicitly.
-- Fingerprint is the whitespace-normalized body from the preceding gym migration.
do $preflight$
begin
 if (select md5(trim(regexp_replace(prosrc, '\s+', ' ', 'g'))) from pg_proc
     where oid=to_regprocedure('public.claim_push_deliveries()')) is distinct from '4687aba5f527bcf011fcc999cd92b040'
 then raise exception 'REVIEW_REQUIRED: claim_push_deliveries differs from reviewed baseline'; end if;
end; $preflight$;
alter table public.notification_preferences add column reaction_enabled boolean not null default false;

create table public.workout_reactions (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 reaction_type text not null check(reaction_type in ('beast','yeah_buddy','pain_zone','light_weight','no_tomorrow','wagmi','slay','built_different')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(post_id,user_id)
);
create index workout_reactions_user_idx on public.workout_reactions(user_id);
alter table public.workout_reactions enable row level security;
revoke all on public.workout_reactions from public,anon,authenticated;
grant select,insert,delete on public.workout_reactions to authenticated;
grant update(post_id,user_id,reaction_type) on public.workout_reactions to authenticated;
create policy reactions_read on public.workout_reactions for select to authenticated
 using(user_id=(select auth.uid()) and exists(select 1 from public.posts p where p.id=post_id));
create policy reactions_insert on public.workout_reactions for insert to authenticated
 with check(user_id=(select auth.uid()) and (select loads_private.current_account_writable())
 and exists(select 1 from public.posts p where p.id=post_id and p.user_id<>(select auth.uid())));
create policy reactions_update on public.workout_reactions for update to authenticated
 using(user_id=(select auth.uid()))
 with check(user_id=(select auth.uid()) and (select loads_private.current_account_writable())
 and exists(select 1 from public.posts p where p.id=post_id and p.user_id<>(select auth.uid())));
-- DELETE without WHERE/RETURNING need not consult the SELECT policy.
create policy reactions_delete on public.workout_reactions for delete to authenticated
 using(user_id=(select auth.uid()) and (select loads_private.current_account_writable())
 and exists(select 1 from public.posts p where p.id=post_id and p.user_id<>(select auth.uid())));

-- Private one-time event marker survives cancellation and device token rotation.
create table loads_private.reaction_events (
 post_id uuid not null references public.posts(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 primary key(post_id,user_id)
);
create index reaction_events_user_idx on loads_private.reaction_events(user_id);
alter table loads_private.reaction_events enable row level security;
revoke all on loads_private.reaction_events from public,anon,authenticated;
alter table loads_private.push_deliveries drop constraint push_deliveries_kind_check;
alter table loads_private.push_deliveries add constraint push_deliveries_kind_check check(kind in ('workout','partner','reaction'));
alter table loads_private.push_deliveries add column reaction_type text;

create function loads_private.guard_reaction() returns trigger
language plpgsql security definer set search_path='' as $$
declare author uuid;
begin
 if auth.uid() is null or auth.uid()<>new.user_id then raise exception 'REACTION_NOT_ALLOWED'; end if;
 select user_id into author from public.posts where id=new.post_id;
 if author is null or author=new.user_id then raise exception 'REACTION_NOT_ALLOWED'; end if;
 perform pg_advisory_xact_lock_shared(hashtextextended('loads-account/'||least(new.user_id,author)::text,0));
 perform pg_advisory_xact_lock_shared(hashtextextended('loads-account/'||greatest(new.user_id,author)::text,0));
 if exists(select 1 from loads_private.account_deletion_jobs where user_id in(new.user_id,author)) then raise exception 'REACTION_NOT_ALLOWED'; end if;
 if tg_op='UPDATE' then
 if new.post_id<>old.post_id or new.user_id<>old.user_id then raise exception 'REACTION_IMMUTABLE'; end if;
 new.created_at=old.created_at; end if;
 new.updated_at=now();
 return new;
end; $$;
revoke all on function loads_private.guard_reaction() from public,anon,authenticated;
create trigger reaction_guard before insert or update on public.workout_reactions for each row execute function loads_private.guard_reaction();

create function loads_private.queue_reaction() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 insert into loads_private.reaction_events values(new.post_id,new.user_id) on conflict do nothing;
 if not found then return new; end if;
 -- Transport runs later in the existing worker. Even queue failures cannot
 -- roll back the reaction; the marker prevents notification storms on retries.
 begin
 insert into loads_private.push_deliveries(event_key,kind,actor_id,recipient_id,device_id,post_id,reaction_type)
 select 'reaction/'||new.post_id::text||'/'||new.user_id::text,'reaction',new.user_id,p.user_id,d.id,p.id,new.reaction_type
 from public.posts p join public.notification_preferences pref on pref.user_id=p.user_id and pref.reaction_enabled
 join public.push_devices d on d.user_id=p.user_id and d.enabled and d.updated_at>now()-interval '90 days'
 where p.id=new.post_id and p.user_id<>new.user_id
 on conflict do nothing;
 exception when others then null;
 end;
 return new;
end; $$;
revoke all on function loads_private.queue_reaction() from public,anon,authenticated;
create trigger reaction_queue after insert on public.workout_reactions for each row execute function loads_private.queue_reaction();

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
 and ((q.kind='reaction' and coalesce(p.reaction_enabled,false) and exists(select 1 from public.posts target where target.id=q.post_id and target.user_id=q.recipient_id)) or (q.kind='partner' and coalesce(p.partner_enabled,true)) or (q.kind='workout' and coalesce(p.workout_enabled,false)
 and exists(select 1 from public.follows f where f.follower_id=q.recipient_id and f.following_id=q.actor_id)))
 order by q.created_at for update of q skip locked limit 100
 ), claimed as (update loads_private.push_deliveries q set state='sending',attempted_at=now() from candidates c where q.id=c.id returning q.*)
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'token',d.token,'kind',c.kind,'recipientId',c.recipient_id,'actorId',c.actor_id,'postId',c.post_id,'reactionType',c.reaction_type,'actorName',case when c.kind='reaction' then p.username else coalesce(nullif(trim(p.display_name),''),p.username) end)), '[]'::jsonb)
 into payload from claimed c join public.push_devices d on d.id=c.device_id join public.profiles p on p.id=c.actor_id;
 return payload;
end; $$;

-- Reassert the worker-only boundary even if an existing deployment has ACL drift.
revoke all on function public.claim_push_deliveries() from public,anon,authenticated;
grant execute on function public.claim_push_deliveries() to service_role;

notify pgrst,'reload schema';
commit;
