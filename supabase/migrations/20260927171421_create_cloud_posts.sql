begin;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_post_id text not null check (char_length(client_post_id) between 1 and 100),
  workout_id text not null check (char_length(workout_id) between 1 and 100),
  created_at timestamptz not null default now(),
  caption text not null default '' check (char_length(caption) <= 300),
  photo_path text,
  duration_seconds integer not null check (duration_seconds >= 0),
  total_sets integer not null check (total_sets >= 0),
  total_volume numeric not null check (total_volume >= 0 and total_volume < 1e15),
  pr_count integer not null check (pr_count >= 0),
  exercises jsonb not null check (jsonb_typeof(exercises) = 'array' and jsonb_array_length(exercises) <= 200),
  constraint posts_user_client_unique unique (user_id, client_post_id),
  constraint posts_photo_owner check (
    photo_path is null or (
      split_part(photo_path, '/', 1) = user_id::text
      and photo_path !~ '(^|/)\.\.(/|$)'
    )
  )
);

create index posts_feed_idx on public.posts (created_at desc, id desc);
create index posts_user_idx on public.posts (user_id);
alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated;
grant select, insert on public.posts to authenticated;
create policy posts_read_authenticated on public.posts for select to authenticated using (true);
create policy posts_insert_own on public.posts for insert to authenticated
  with check ((select auth.uid()) = user_id);

comment on table public.posts is 'Published workout snapshots. Local workout/history data stays on device.';
commit;
