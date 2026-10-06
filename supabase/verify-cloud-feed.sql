-- Run in the project's SQL Editor as postgres. All test writes are rolled back.
-- Uses an existing profile; creates no Auth users and persists no posts/files.
begin;
do $$
declare
  owner_id uuid;
  other_id uuid := gen_random_uuid();
  test_id text := 'verification-' || gen_random_uuid()::text;
  inserted_id uuid;
  visible_count integer;
begin
  select id into owner_id from public.profiles limit 1;
  if owner_id is null then raise exception 'An existing profile is required'; end if;
  if not exists (select 1 from storage.buckets where id='post-photos' and not public
    and file_size_limit=6291456 and allowed_mime_types=array['image/jpeg']) then
    raise exception 'Photo bucket configuration mismatch';
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.posts'::regclass
    and conname='posts_photo_identity') then raise exception 'Missing photo identity constraint'; end if;
  if not exists (select 1 from pg_indexes where schemaname='public' and indexname='posts_photo_path_idx') then
    raise exception 'Missing photo index'; end if;

  perform set_config('request.jwt.claim.sub', owner_id::text, true);
  execute 'set local role authenticated';
  insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises,photo_path)
  values(owner_id,test_id,'verification',60,1,10,0,'[]',owner_id::text||'/'||test_id||'.jpg') returning id into inserted_id;
  begin
    insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises)
    values(owner_id,test_id,'verification',60,1,10,0,'[]');
    raise exception 'Duplicate post unexpectedly accepted';
  exception when unique_violation then null;
  end;
  begin
    insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises,photo_path)
    values(owner_id,test_id||'-bad','verification',60,1,10,0,'[]',other_id::text||'/bad.jpg');
    raise exception 'Foreign photo path unexpectedly accepted';
  exception when check_violation then null;
  end;
  perform set_config('request.jwt.claim.sub', other_id::text, true);
  select count(*) into visible_count from public.posts where id=inserted_id;
  if visible_count<>1 then raise exception 'Shared feed read failed'; end if;
  begin
    insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises)
    values(owner_id,test_id||'-forged','verification',60,1,10,0,'[]');
    raise exception 'Forged owner unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.posts set caption='forged' where id=inserted_id;
    raise exception 'Post update unexpectedly permitted';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.posts where id=inserted_id;
    raise exception 'Post delete unexpectedly permitted';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
  perform set_config('request.jwt.claim.sub','',true);
  execute 'set local role anon';
  begin
    perform id from public.posts limit 1;
    raise exception 'Anonymous post read unexpectedly permitted';
  exception when insufficient_privilege then null;
  end;
  execute 'reset role';
end $$;
rollback;
select 'PASS: owner insert, shared read, duplicate rejection, foreign photo rejection, forged owner rejection, update/delete denial, anonymous denial; all writes rolled back' as verification,
  (select count(*) from public.posts) as persisted_posts;
