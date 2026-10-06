begin;

-- Persistent identities contain no caption/photo content. They prevent stale-device replay.
create table public.deleted_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_post_id text not null,
  post_id uuid not null unique,
  deleted_at timestamptz not null default now(),
  primary key (user_id, client_post_id)
);
alter table public.deleted_posts enable row level security;
revoke all on public.deleted_posts from public, anon, authenticated;
grant select on public.deleted_posts to authenticated;
grant all on public.deleted_posts to service_role;
create policy deleted_posts_read_own on public.deleted_posts for select to authenticated
using (user_id = (select auth.uid()));

-- Retain cleanup jobs after success: a Storage upload started before deletion may finish later.
create table public.photo_cleanup_jobs (
  photo_path text primary key,
  next_run_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_error text
);
alter table public.photo_cleanup_jobs enable row level security;
revoke all on public.photo_cleanup_jobs from public, anon, authenticated;
grant all on public.photo_cleanup_jobs to service_role;
create index photo_cleanup_due_idx on public.photo_cleanup_jobs(next_run_at);

create schema if not exists loads_private;
revoke all on schema loads_private from public, anon;
grant usage on schema loads_private to authenticated, service_role;

-- Dedicated worker credential, never readable by application roles.
create table loads_private.cleanup_credentials (
  singleton boolean primary key default true check(singleton),
  token text not null default gen_random_uuid()::text || gen_random_uuid()::text
);
alter table loads_private.cleanup_credentials enable row level security;
revoke all on loads_private.cleanup_credentials from public, anon, authenticated;
grant select on loads_private.cleanup_credentials to service_role;
insert into loads_private.cleanup_credentials(singleton) values(true);
create function public.verify_cleanup_worker(candidate text) returns boolean
language sql security invoker set search_path = '' as $$
  select exists(select 1 from loads_private.cleanup_credentials where token = candidate);
$$;
revoke all on function public.verify_cleanup_worker(text) from public, anon, authenticated;
grant execute on function public.verify_cleanup_worker(text) to service_role;

-- Serialize inserts and deletions for the same logical post, including concurrent requests.
create function loads_private.guard_post_replay() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text || '/' || new.client_post_id, 0));
  if exists (select 1 from public.deleted_posts d where d.user_id = new.user_id and d.client_post_id = new.client_post_id) then
    raise exception 'POST_DELETED' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function loads_private.guard_post_replay() from public, anon, authenticated;
create trigger posts_guard_replay before insert on public.posts
for each row execute function loads_private.guard_post_replay();

-- Only an authenticated Edge Function may call this with its independently verified actor.
create function public.delete_owned_post(actor uuid, target uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare p public.posts; d public.deleted_posts;
begin
  select * into p from public.posts where id = target;
  if not found then
    select * into d from public.deleted_posts where post_id = target and user_id = actor;
    if found then return jsonb_build_object('deleted', true, 'client_post_id', d.client_post_id); end if;
    raise exception 'POST_NOT_FOUND' using errcode = 'P0001';
  end if;
  if p.user_id <> actor then raise exception 'POST_NOT_FOUND' using errcode = 'P0001'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p.user_id::text || '/' || p.client_post_id, 0));
  insert into public.deleted_posts(user_id, client_post_id, post_id)
    values(p.user_id, p.client_post_id, p.id) on conflict do nothing;
  -- Schedule the deterministic photo path even when no photo was published.
  if p.client_post_id ~ '^[a-zA-Z0-9_-]{1,100}$' then
    insert into public.photo_cleanup_jobs(photo_path) values(p.user_id::text || '/' || p.client_post_id || '.jpg')
      on conflict(photo_path) do update set next_run_at = now();
  end if;
  delete from public.posts where id = target and user_id = actor;
  return jsonb_build_object('deleted', true, 'client_post_id', p.client_post_id);
end;
$$;
revoke all on function public.delete_owned_post(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_owned_post(uuid, uuid) to service_role;
grant select, delete on public.posts to service_role;

-- Restrictive policies also apply if a broader permissive policy is added later.
create policy post_photos_no_deleted_insert on storage.objects as restrictive for insert to authenticated
with check (bucket_id <> 'post-photos' or not exists (
  select 1 from public.deleted_posts d
  where d.user_id = (select auth.uid()) and name = d.user_id::text || '/' || d.client_post_id || '.jpg'
));
create policy post_photos_no_deleted_read on storage.objects as restrictive for select to authenticated
using (bucket_id <> 'post-photos' or not exists (
  select 1 from public.deleted_posts d
  where d.user_id = (select auth.uid()) and name = d.user_id::text || '/' || d.client_post_id || '.jpg'
));
commit;
