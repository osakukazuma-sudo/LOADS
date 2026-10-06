begin;

create table public.follows (
 follower_id uuid not null references public.profiles(id) on delete cascade,
 following_id uuid not null references public.profiles(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(follower_id,following_id),
 constraint follows_not_self check(follower_id <> following_id)
);
create index follows_incoming_idx on public.follows(following_id,follower_id);
alter table public.follows enable row level security;
revoke all on public.follows from public,anon,authenticated;
grant select,insert,delete on public.follows to authenticated;
create policy follows_read_participant on public.follows for select to authenticated
 using ((select auth.uid()) = follower_id or (select auth.uid()) = following_id);
create policy follows_insert_own on public.follows for insert to authenticated
 with check ((select auth.uid()) = follower_id);
create policy follows_delete_own on public.follows for delete to authenticated
 using ((select auth.uid()) = follower_id);

-- Serialize against account-deletion acceptance on either endpoint. No caller-supplied
-- deletion data or public helper exposes job details. Trigger runs before INSERT only.
create function loads_private.guard_follow_insert() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or auth.uid() <> new.follower_id then raise exception 'FOLLOW_NOT_ALLOWED'; end if;
 perform pg_advisory_xact_lock_shared(hashtextextended('loads-account/'||least(new.follower_id,new.following_id)::text,0));
 perform pg_advisory_xact_lock_shared(hashtextextended('loads-account/'||greatest(new.follower_id,new.following_id)::text,0));
 if exists(select 1 from loads_private.account_deletion_jobs where user_id in (new.follower_id,new.following_id))
 or (select count(*) from auth.users where id in (new.follower_id,new.following_id)) < (case when new.follower_id=new.following_id then 1 else 2 end)
 then raise exception 'FOLLOW_NOT_ALLOWED'; end if;
 return new;
end; $$;
revoke all on function loads_private.guard_follow_insert() from public,anon,authenticated;
create trigger follows_guard before insert on public.follows for each row execute function loads_private.guard_follow_insert();

-- Existing permissive read policy is narrowed, even for direct REST requests.
create policy posts_following_read on public.posts as restrictive for select to authenticated
 using (user_id=(select auth.uid()) or user_id in (
 select following_id from public.follows where follower_id=(select auth.uid())
 ));
-- Storage post_photos_read already checks public.posts under caller RLS.
-- Invoker view keeps the HOME contract explicit; no fallback to a global feed.
create view public.following_feed with (security_invoker=true) as
 select p.* from public.posts p where p.user_id=(select auth.uid()) or p.user_id in (
 select following_id from public.follows where follower_id=(select auth.uid())
 );
revoke all on public.following_feed from public,anon,authenticated;
grant select on public.following_feed to authenticated;

-- No owner argument: counts always describe the current user's own connections.
create function public.my_follow_counts() returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object(
 'followers',(select count(*) from public.follows where following_id=(select auth.uid())),
 'following',(select count(*) from public.follows where follower_id=(select auth.uid()))
 );
$$;
revoke all on function public.my_follow_counts() from public,anon,authenticated;
grant execute on function public.my_follow_counts() to authenticated;

-- Existing account deletion removes profiles in the rows phase. Both FKs cascade
-- before Auth deletion; no follow can survive the absent profile at completed.
comment on table public.follows is 'Only the two participants may read an edge. No public social graph.';
notify pgrst, 'reload schema';
commit;
