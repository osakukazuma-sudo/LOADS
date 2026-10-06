const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222';
test('account jobs isolate receipts, freeze writes, require final absence, and never regress completed', async () => {
 const db=new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key);
  insert into auth.users values('${A}'),('${B}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth,storage,public to authenticated,anon;
  create table public.profiles(id uuid primary key,username text,display_name text);
  insert into public.profiles values('${A}','a','A'),('${B}','b','B');
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);
  alter table storage.objects enable row level security;
  grant select,insert,update,delete on storage.objects to authenticated;
  grant select on public.profiles to authenticated;`);
  for(const file of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync(path.join('supabase/migrations',file),'utf8'));
  async function user(id,sql,params=[]) {
   await db.exec(`begin;set local role authenticated;set local request.jwt.claim.sub='${id}';`);
   try {const r=await db.query(sql,params);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}
  }
  const rpc=async(sql,params=[]) => (await db.query(sql,params)).rows;
  const H='a'.repeat(64);
  const cancelled='b'.repeat(64);
  const limited='c'.repeat(64);
  await rpc('select public.prepare_account_receipt($1,$2)',[B,limited]);
  for(let i=0;i<4;i++) assert.equal((await rpc('select public.account_deletion_status($1) as s',[limited]))[0].s.status,'not_started');
  const throttled=(await rpc('select public.account_deletion_status($1) as s',[limited]))[0].s;
  assert.ok(throttled.retry_after>0 && throttled.retry_after<=5);
  assert.equal((await rpc('select count(*)::int as n from loads_private.account_deletion_jobs'))[0].n,0);
  await rpc("update loads_private.account_deletion_receipts set status_checked_at=clock_timestamp()-interval '5 seconds' where token_hash=$1",[limited]);
  assert.equal((await rpc('select public.account_deletion_status($1) as s',[limited]))[0].s.status,'not_started');
  await rpc('insert into public.photo_cleanup_jobs(photo_path) values($1),($2)',[A+'/old.jpg',B+'/old.jpg']);
  await rpc('select public.prepare_account_receipt($1,$2)',[A,cancelled]);
  await rpc('select public.cancel_unstarted_account_deletion($1,$2)',[A,cancelled]);
  await assert.rejects(rpc('select public.accept_account_deletion($1,$2)',[A,cancelled]),/INVALID_RECEIPT/);
  await rpc('select public.prepare_account_receipt($1,$2)',[A,H]);
  assert.equal((await rpc('select public.account_deletion_status($1) as s',[H]))[0].s.status,'not_started');
  await assert.rejects(user(A,'select * from loads_private.account_deletion_jobs'),/permission denied/);
  await assert.rejects(user(A,'select public.accept_account_deletion($1,$2)',[A,H]),/permission denied/);
  await rpc('select public.accept_account_deletion($1,$2)',[A,H]);
  await assert.rejects(rpc('select public.cancel_unstarted_account_deletion($1,$2)',[A,H]),/ALREADY_ACCEPTED/);
  assert.equal((await user(A,'select loads_private.current_account_writable() as w'))[0].w,false);
  assert.equal((await user(B,'select loads_private.current_account_writable() as w'))[0].w,true);
  await assert.rejects(user(A,"insert into storage.objects(bucket_id,name) values('post-photos',$1)",[`${A}/blocked.jpg`]),/row-level security/);
  await user(B,"insert into storage.objects(bucket_id,name) values('post-photos',$1)",[`${B}/kept.jpg`]);
  await assert.rejects(user(A,"insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises) values($1,'blocked','w',1,1,1,0,'[]')",[A]),/row-level security/);
  async function claim(){await db.exec('update loads_private.account_deletion_jobs set next_run_at=now()');return (await rpc('select public.claim_account_deletion() as j'))[0].j;}
  async function move(j,p,f=null){await rpc('select public.advance_account_deletion($1,$2,$3,$4)',[A,j.lease_id,p,f]);}
  let j=await claim();
  assert.equal((await rpc('select public.claim_account_deletion() as j'))[0].j,null);
  await move(j,'failed','PHOTO_CLEANUP_FAILED');
  assert.equal(await claim(),null); // Receipt reads never resume failed work.
  assert.equal((await rpc('select public.account_deletion_status($1) as s',[H]))[0].s.status,'failed');
  await assert.rejects(rpc('select public.accept_account_deletion($1,$2)',[B,H]),/INVALID_RECEIPT/);
  await rpc('select public.accept_account_deletion($1,$2)',[A,H]);
  j=await claim();await move(j,'rows');j=await claim();await move(j,'delete_auth');
  assert.equal((await rpc('select * from auth.users where id=$1',[A])).length,1);
  j=await claim();await move(j,'verify_auth');j=await claim();
  await assert.rejects(move(j,'failed'),/MUST_RECONCILE/);
  await assert.rejects(move(j,'final_storage_cleanup'),/AUTH_REMAINS/);
  await rpc('delete from auth.users where id=$1',[A]);
  await move(j,'final_storage_cleanup');j=await claim();
  await rpc("insert into storage.objects(bucket_id,name) values('post-photos',$1)",[`${A}/late.jpg`]);
  await assert.rejects(move(j,'completed'),/DATA_REMAINS/);
  await move(j,'final_storage_cleanup','FINAL_STORAGE_CLEANUP_PENDING');
  assert.equal((await rpc('select public.account_deletion_status($1) as s',[H]))[0].s.status,'processing');
  await rpc('delete from storage.objects where name=$1',[`${A}/late.jpg`]);
  j=await claim();await move(j,'completed');
  assert.equal((await rpc('select photo_path from public.photo_cleanup_jobs')).length,1);
  assert.equal((await rpc('select photo_path from public.photo_cleanup_jobs'))[0].photo_path,B+'/old.jpg');
  const done=(await rpc('select public.account_deletion_status($1) as s',[H]))[0].s;
  assert.equal(done.status,'completed');assert.ok(done.completed_at);
  assert.deepEqual(Object.keys(done).sort(),['completed_at','failure_code','status']);
  await assert.rejects(move(j,'failed'),/LEASE_LOST/);
  assert.equal((await user(A,'select loads_private.current_account_writable() as w'))[0].w,false);
  assert.equal((await rpc('select * from public.profiles where id=$1',[B])).length,1);
  assert.equal((await rpc('select * from storage.objects where name=$1',[`${B}/kept.jpg`])).length,1);
  await db.exec("update loads_private.account_deletion_receipts set expires_at=now()-interval '1 second'");
  assert.equal((await rpc('select public.account_deletion_status($1) as s',[H]))[0].s,null);
 } finally {await db.close();}
});
