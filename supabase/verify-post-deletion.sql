-- SQL Editor as postgres. Only newly-created test rows are touched; all are rolled back.
begin;
do $$
declare a uuid; b uuid; cid text := 'delete-verification-' || gen_random_uuid()::text; pid uuid; n integer;
begin
  select id into a from public.profiles order by id limit 1;
  select id into b from public.profiles where id <> a limit 1;
  if a is null or b is null then raise exception 'Two profiles required'; end if;
  perform set_config('request.jwt.claim.sub', a::text, true);
  execute 'set local role authenticated';
  insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises,photo_path)
  values(a,cid,'verification',60,1,10,0,'[]',a::text||'/'||cid||'.jpg') returning id into pid;
  insert into storage.objects(bucket_id,name) values('post-photos',a::text||'/'||cid||'.jpg');
  begin
    perform public.delete_owned_post(a,pid);
    raise exception 'Client can bypass Edge authentication';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claim.sub', b::text, true);
  select count(*) into n from public.posts where id=pid;
  if n<>1 then raise exception 'Shared feed broken'; end if;
  begin
    delete from public.posts where id=pid;
    raise exception 'Other user can directly delete';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  execute 'set local role service_role';
  begin
    perform public.delete_owned_post(b,pid);
    raise exception 'Other actor was accepted';
  exception when raise_exception then
    if sqlerrm <> 'POST_NOT_FOUND' then raise; end if;
  end;
  perform public.delete_owned_post(a,pid);
  perform public.delete_owned_post(a,pid);
  select count(*) into n from public.photo_cleanup_jobs where photo_path=a::text||'/'||cid||'.jpg';
  if n<>1 then raise exception 'Cleanup job not committed with delete'; end if;
  execute 'reset role';
  execute 'set local role authenticated';
  perform set_config('request.jwt.claim.sub', a::text, true);
  select count(*) into n from public.posts where id=pid;
  if n<>0 then raise exception 'Post still visible'; end if;
  select count(*) into n from public.deleted_posts where post_id=pid;
  if n<>1 then raise exception 'Missing tombstone'; end if;
  begin
    insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises)
    values(a,cid,'verification',60,1,10,0,'[]');
    raise exception 'Replay resurrected the post';
  exception when raise_exception then if sqlerrm <> 'POST_DELETED' then raise; end if; end;
  begin
    insert into storage.objects(bucket_id,name) values('post-photos',a::text||'/'||cid||'.jpg');
    raise exception 'Deleted photo reupload accepted';
  exception when insufficient_privilege then null; end;
  select count(*) into n from storage.objects where name=a::text||'/'||cid||'.jpg';
  if n<>0 then raise exception 'Deleted photo visible'; end if;
  perform set_config('request.jwt.claim.sub', b::text, true);
  select count(*) into n from public.deleted_posts where post_id=pid;
  if n<>0 then raise exception 'Other user can read tombstone'; end if;
  insert into public.posts(id,user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises)
  values(pid,b,cid||'-collision','verification',1,1,1,0,'[]');
  execute 'reset role';
  execute 'set local role service_role';
  begin
    perform public.delete_owned_post(b,pid);
    raise exception 'Conflicting deletion must not silently omit tombstone';
  exception when unique_violation then null; end;
  select count(*) into n from public.posts where id=pid and user_id=b;
  if n<>1 then raise exception 'Failed tombstone write was not atomic'; end if;
  execute 'reset role';
end $$;
rollback;
select 'PASS: owner-only deletion, atomic tombstone+job, idempotency, stale replay and photo reupload blocked; all test writes rolled back' as verification,
  (select count(*) from public.posts) as existing_posts,
  (select count(*) from auth.users) as existing_users;
