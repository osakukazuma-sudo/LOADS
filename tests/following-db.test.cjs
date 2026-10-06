const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',C='33333333-3333-4333-8333-333333333333',D='44444444-4444-4444-8444-444444444444';
test('follow constraints, private graph, feed/photo visibility and deletion lifecycle',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,public to authenticated,anon;
 create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,username text,display_name text);
 grant select on public.profiles to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated,anon;`);
 for(const id of [A,B,C,D]) {await db.query('insert into auth.users values($1)',[id]);await db.query('insert into public.profiles values($1,$2,$2)',[id,id[0]]);}
 for(const file of fs.readdirSync('supabase/migrations').sort())await db.exec(fs.readFileSync(path.join('supabase/migrations',file),'utf8'));
 async function as(id,sql,args=[]) {await db.exec(`begin;set local role ${id?'authenticated':'anon'};set local request.jwt.claim.sub='${id??''}';`);try{const r=await db.query(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
 const follow=(a,b)=>as(a,'insert into public.follows(follower_id,following_id) values($1,$2)',[a,b]);
 await assert.rejects(follow(A,A),/check constraint/);
 await follow(A,B);await assert.rejects(follow(A,B),/unique constraint/);
 await follow(C,B);await follow(B,C);
 await assert.rejects(as(null,'select * from public.follows'),/permission denied/);
 await assert.rejects(as(A,'insert into public.follows(follower_id,following_id) values($1,$2)',[B,D]),/FOLLOW_NOT_ALLOWED|row-level security/);
 await assert.rejects(as(A,'update public.follows set following_id=$1',[D]),/permission denied/);
 assert.equal((await as(A,'select * from public.follows')).length,1);
 assert.equal((await as(D,'select * from public.follows')).length,0);
 // Even explicit REST-equivalent filters cannot return another person's full list.
 assert.equal((await as(A,'select * from public.follows where follower_id=$1',[B])).length,0);
 assert.equal((await as(A,'select * from public.follows where following_id=$1',[B])).length,1); // only A's own edge
 assert.equal((await as(A,'delete from public.follows where follower_id=$1 returning *',[C])).length,0);
 assert.deepEqual((await as(B,'select public.my_follow_counts() as c'))[0].c,{followers:2,following:1});
 assert.deepEqual((await as(A,'select public.my_follow_counts() as c'))[0].c,{followers:0,following:1});
 assert.deepEqual((await as(B,'select follower_id from public.follows where following_id=$1 order by follower_id',[B])).map(r=>r.follower_id),[A,C]);
 assert.deepEqual((await as(B,'select following_id from public.follows where follower_id=$1',[B])).map(r=>r.following_id),[C]);
 await assert.rejects(as(null,'select public.my_follow_counts()'),/permission denied/);
 await assert.rejects(as(A,'select public.my_follow_counts($1::uuid)',[B]),/does not exist/);
 for(const id of [A,B,C]){
  await as(id,"insert into storage.objects(bucket_id,name) values('post-photos',$1)",[id+'/p.jpg']);
  await as(id,"insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises,photo_path) values($1,'p','w',1,1,1,0,'[]',$2)",[id,id+'/p.jpg']);
 }
 assert.deepEqual((await as(A,'select user_id from public.following_feed order by user_id')).map(r=>r.user_id),[A,B]);
 assert.deepEqual((await as(A,'select user_id from public.posts order by user_id')).map(r=>r.user_id),[A,B]);
 assert.equal((await as(A,'select * from storage.objects')).length,2);
 assert.equal((await as(D,'select * from public.following_feed')).length,0);
 await assert.rejects(as(null,'select * from public.following_feed'),/permission denied/);
 await as(A,'delete from public.follows where follower_id=$1 and following_id=$2',[A,B]);
 assert.deepEqual((await as(A,'select user_id from public.following_feed')).map(r=>r.user_id),[A]);
 assert.equal((await as(A,'select * from storage.objects')).length,1);
 await follow(A,B);
 await follow(D,A); // Unrelated edge must survive B's account deletion.
 const hash='a'.repeat(64);await db.query('select public.prepare_account_receipt($1,$2)',[B,hash]);await db.query('select public.accept_account_deletion($1,$2)',[B,hash]);
 await assert.rejects(follow(D,B),/FOLLOW_NOT_ALLOWED/);await assert.rejects(follow(B,D),/FOLLOW_NOT_ALLOWED/);
 const claim=async()=>{await db.exec('update loads_private.account_deletion_jobs set next_run_at=now()');return (await db.query('select public.claim_account_deletion() as j')).rows[0].j;};
 const move=async phase=>{const j=await claim();await db.query('select public.advance_account_deletion($1,$2,$3)',[B,j.lease_id,phase]);};
 await db.query('delete from storage.objects where name=$1',[B+'/p.jpg']); // emulate successful Storage API removal
 await move('rows');await move('delete_auth');
 assert.equal((await db.query('select * from public.follows where follower_id=$1 or following_id=$1',[B])).rows.length,0);
 await move('verify_auth');await db.query('delete from auth.users where id=$1',[B]);await move('final_storage_cleanup');await move('completed');
 assert.equal((await db.query('select status from loads_private.account_deletion_jobs where user_id=$1',[B])).rows[0].status,'completed');
 assert.deepEqual((await db.query('select follower_id,following_id from public.follows')).rows,[{follower_id:D,following_id:A}]);
 await assert.rejects(follow(A,B),/FOLLOW_NOT_ALLOWED|foreign key/);
 assert.equal((await as(A,'select * from public.following_feed')).length,1);
 } finally {await db.close();}
});
