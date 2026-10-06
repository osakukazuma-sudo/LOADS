create or replace function public.delete_owned_post(actor uuid, target uuid) returns jsonb
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
    values(p.user_id, p.client_post_id, p.id) on conflict(user_id, client_post_id) do nothing;
  -- Schedule the deterministic photo path even when no photo was published.
  if p.client_post_id ~ '^[a-zA-Z0-9_-]{1,100}$' then
    insert into public.photo_cleanup_jobs(photo_path) values(p.user_id::text || '/' || p.client_post_id || '.jpg')
      on conflict(photo_path) do update set next_run_at = now();
  end if;
  delete from public.posts where id = target and user_id = actor;
  return jsonb_build_object('deleted', true, 'client_post_id', p.client_post_id);
end;
$$;
