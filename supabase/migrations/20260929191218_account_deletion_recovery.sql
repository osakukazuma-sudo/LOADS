begin;
create table loads_private.account_deletion_jobs (
 user_id uuid primary key, status text not null check(status in ('pending','processing','failed','completed')),
 phase text not null default 'photos', failure_code text, requested_at timestamptz not null default now(),
 completed_at timestamptz, lease_id uuid, lease_until timestamptz, next_run_at timestamptz not null default now()
);
create table loads_private.account_deletion_receipts (
 token_hash text primary key check(token_hash ~ '^[0-9a-f]{64}$'), user_id uuid not null, cancelled boolean not null default false,
 expires_at timestamptz default now() + interval '1 day',
 status_tokens double precision not null default 4,
 status_checked_at timestamptz not null default now()
);
alter table loads_private.account_deletion_jobs enable row level security;
alter table loads_private.account_deletion_receipts enable row level security;
revoke all on loads_private.account_deletion_jobs, loads_private.account_deletion_receipts from public, anon, authenticated;
create index account_deletion_due on loads_private.account_deletion_jobs(next_run_at) where status in ('pending','processing');

-- No argument, no job details. Only the requesting identity's write permission.
-- PostgreSQL cannot grant EXECUTE only while inside a policy. Private schema is not
-- exposed by PostgREST; a direct SQL call still reveals only this boolean.
create function loads_private.current_account_writable() returns boolean
language plpgsql security definer set search_path = '' as $$
declare actor uuid := auth.uid();
begin
 if actor is null then return false; end if;
 perform pg_advisory_xact_lock_shared(hashtextextended('loads-account/'||actor::text,0));
 return exists(select 1 from auth.users where id=actor)
 and not exists(select 1 from loads_private.account_deletion_jobs where user_id=actor);
end;
$$;
revoke all on function loads_private.current_account_writable() from public, anon;
grant execute on function loads_private.current_account_writable() to authenticated;
create policy posts_account_insert on public.posts as restrictive for insert to authenticated
 with check ((select loads_private.current_account_writable()));
create policy posts_account_update on public.posts as restrictive for update to authenticated
 using ((select loads_private.current_account_writable())) with check ((select loads_private.current_account_writable()));
create policy profiles_account_insert on public.profiles as restrictive for insert to authenticated
 with check ((select loads_private.current_account_writable()));
create policy profiles_account_update on public.profiles as restrictive for update to authenticated
 using ((select loads_private.current_account_writable())) with check ((select loads_private.current_account_writable()));
create policy storage_account_insert on storage.objects as restrictive for insert to authenticated
 with check ((select loads_private.current_account_writable()));
create policy storage_account_update on storage.objects as restrictive for update to authenticated
 using ((select loads_private.current_account_writable())) with check ((select loads_private.current_account_writable()));

create function public.prepare_account_receipt(actor uuid, receipt_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 if not exists(select 1 from auth.users where id=actor) then raise exception 'USER_NOT_FOUND'; end if;
 delete from loads_private.account_deletion_receipts where user_id=actor and expires_at < now();
 if (select count(*) from loads_private.account_deletion_receipts where user_id=actor and not cancelled) >= 5 then raise exception 'RECEIPT_LIMIT'; end if;
 insert into loads_private.account_deletion_receipts(token_hash,user_id,expires_at)
 values(receipt_hash,actor,case when exists(select 1 from loads_private.account_deletion_jobs where user_id=actor and status <> 'completed') then null else now()+interval '1 day' end);
end; $$;
create function public.accept_account_deletion(actor uuid, receipt_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('loads-account/'||actor::text,0));
 perform 1 from loads_private.account_deletion_receipts where token_hash=receipt_hash and user_id=actor and not cancelled and (expires_at is null or expires_at>now()) for update;
 if not found then raise exception 'INVALID_RECEIPT'; end if;
 if not exists(select 1 from auth.users where id=actor) then raise exception 'USER_NOT_FOUND'; end if;
 insert into loads_private.account_deletion_jobs(user_id,status) values(actor,'pending')
 on conflict(user_id) do update set status='pending',phase='photos',failure_code=null,lease_id=null,lease_until=null,next_run_at=now()
 where account_deletion_jobs.status='failed';
 update loads_private.account_deletion_receipts set expires_at=null where user_id=actor;
end; $$;
create function public.cancel_unstarted_account_deletion(actor uuid, receipt_hash text) returns void
language plpgsql security definer set search_path = '' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('loads-account/'||actor::text,0));
 perform 1 from loads_private.account_deletion_receipts where token_hash=receipt_hash and user_id=actor for update;
 if not found then raise exception 'INVALID_RECEIPT'; end if;
 if exists(select 1 from loads_private.account_deletion_jobs where user_id=actor) then raise exception 'ALREADY_ACCEPTED'; end if;
 update loads_private.account_deletion_receipts set cancelled=true where token_hash=receipt_hash;
end; $$;
create function public.account_deletion_status(receipt_hash text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare r loads_private.account_deletion_receipts; t timestamptz; available double precision; result jsonb;
begin
 select * into r from loads_private.account_deletion_receipts
 where token_hash=receipt_hash and (expires_at is null or expires_at>now()) for update;
 if not found then return null; end if;
 -- Atomic across Edge instances: burst 4, refill 12 tokens/minute. No job mutation.
 t := clock_timestamp();
 available := least(4, r.status_tokens + greatest(0,extract(epoch from (t-r.status_checked_at))) / 5.0);
 if available < 1 then
   return jsonb_build_object('retry_after',greatest(1,ceil((1-available)*5)));
 end if;
 update loads_private.account_deletion_receipts set status_tokens=available-1,status_checked_at=t where token_hash=receipt_hash;
 select jsonb_build_object('status',coalesce(j.status,'not_started'),'completed_at',j.completed_at,'failure_code',case when j.user_id is null and r.cancelled then 'CANCELLED' else j.failure_code end)
 into result from (select 1) singleton left join loads_private.account_deletion_jobs j on j.user_id=r.user_id;
 return result;
end;
$$;
create function public.claim_account_deletion() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare j loads_private.account_deletion_jobs;
begin
 select * into j from loads_private.account_deletion_jobs where status in ('pending','processing') and next_run_at<=now() and (lease_until is null or lease_until<now()) order by next_run_at for update skip locked limit 1;
 if not found then return null; end if;
 update loads_private.account_deletion_jobs set status='processing',lease_id=gen_random_uuid(),lease_until=now()+interval '5 minutes' where user_id=j.user_id returning * into j;
 return to_jsonb(j);
end; $$;
create function public.account_photo_paths(actor uuid) returns table(path text)
language sql security definer set search_path = '' as $$
 select name from storage.objects where bucket_id='post-photos' and left(name,37)=actor::text||'/' order by name limit 100;
$$;
create function public.advance_account_deletion(actor uuid, lease uuid, next_phase text, failure text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare j loads_private.account_deletion_jobs;
begin
 select * into j from loads_private.account_deletion_jobs where user_id=actor for update;
 if not found then raise exception 'LEASE_LOST'; end if;
 if j.status<>'processing' or j.lease_id is distinct from lease or j.lease_until<now() then raise exception 'LEASE_LOST'; end if;
 if next_phase not in ('photos','rows','delete_auth','verify_auth','final_storage_cleanup','completed','failed') then raise exception 'INVALID_PHASE'; end if;
 if next_phase='failed' and j.phase in ('verify_auth','final_storage_cleanup') then raise exception 'MUST_RECONCILE'; end if;
 if not ((j.phase='photos' and next_phase in ('photos','rows','failed'))
 or (j.phase='rows' and next_phase in ('delete_auth','failed'))
 or (j.phase='delete_auth' and next_phase in ('verify_auth','failed'))
 or (j.phase='verify_auth' and next_phase in ('verify_auth','final_storage_cleanup'))
 or (j.phase='final_storage_cleanup' and next_phase in ('final_storage_cleanup','completed'))) then raise exception 'INVALID_TRANSITION'; end if;
 if next_phase='delete_auth' then
   if exists(select 1 from storage.objects where bucket_id='post-photos' and left(name,37)=actor::text||'/') then raise exception 'PHOTOS_REMAIN'; end if;
   delete from public.posts where user_id=actor;
   delete from public.deleted_posts where user_id=actor;
   delete from public.profiles where id=actor;
 end if;
 if next_phase='final_storage_cleanup' and exists(select 1 from auth.users where id=actor) then raise exception 'AUTH_REMAINS'; end if;
 if next_phase='completed' then
   if j.phase<>'final_storage_cleanup' or exists(select 1 from auth.users where id=actor)
   or exists(select 1 from public.profiles where id=actor) or exists(select 1 from public.posts where user_id=actor)
   or exists(select 1 from public.deleted_posts where user_id=actor)
   or exists(select 1 from storage.objects where bucket_id='post-photos' and left(name,37)=actor::text||'/') then raise exception 'DATA_REMAINS'; end if;
   delete from public.photo_cleanup_jobs where left(photo_path,37)=actor::text||'/';
   update loads_private.account_deletion_receipts set expires_at=now()+interval '30 days' where user_id=actor;
 end if;
 update loads_private.account_deletion_jobs set
 status=case when next_phase='completed' then 'completed' when next_phase='failed' then 'failed' else 'processing' end,
 phase=next_phase,failure_code=failure,completed_at=case when next_phase='completed' then now() else null end,
 lease_id=null,lease_until=null,next_run_at=now()+interval '1 minute' where user_id=actor;
end; $$;
-- The worker also reconciles late files after completion without changing completed.
create function public.completed_account_cleanup_paths() returns table(path text)
language sql security definer set search_path = '' as $$
 select o.name from storage.objects o join loads_private.account_deletion_jobs j on left(o.name,37)=j.user_id::text||'/'
 where j.status='completed' and o.bucket_id='post-photos' order by o.name limit 100;
$$;
revoke all on function public.prepare_account_receipt(uuid,text),public.accept_account_deletion(uuid,text),public.account_deletion_status(text),public.claim_account_deletion(),public.account_photo_paths(uuid),public.advance_account_deletion(uuid,uuid,text,text),public.completed_account_cleanup_paths() from public,anon,authenticated;
grant execute on function public.prepare_account_receipt(uuid,text),public.accept_account_deletion(uuid,text),public.account_deletion_status(text),public.claim_account_deletion(),public.account_photo_paths(uuid),public.advance_account_deletion(uuid,uuid,text,text),public.completed_account_cleanup_paths() to service_role;
revoke all on function public.cancel_unstarted_account_deletion(uuid,text) from public,anon,authenticated;
grant execute on function public.cancel_unstarted_account_deletion(uuid,text) to service_role;
commit;
