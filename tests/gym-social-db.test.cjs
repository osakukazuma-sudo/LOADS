const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', C='33333333-3333-4333-8333-333333333333', D='44444444-4444-4444-8444-444444444444';
test('PostgreSQL enforces notification recipients/preferences, dedup, worker isolation, tags and tagged post/photo RLS', async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;create schema storage;create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage,public to authenticated,anon;
 create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,username text,display_name text);
 grant select on public.profiles to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated,anon;`);
 for(const id of [A,B,C,D]) {await db.query('insert into auth.users values($1)',[id]); await db.query('insert into public.profiles values($1,$2,$2)',[id,`athlete_${id[0]}`]);}
 for(const file of fs.readdirSync('supabase/migrations').sort()) await db.exec(fs.readFileSync(path.join('supabase/migrations',file),'utf8'));
 async function as(id,sql,args=[]) {await db.exec(`begin;set local role ${id==='service'?'service_role':id?'authenticated':'anon'};set local request.jwt.claim.sub='${id==='service'?'':id??''}';`);try{const r=await db.query(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
 const follow=(from,to)=>as(from,'insert into public.follows(follower_id,following_id) values($1,$2)',[from,to]);
 const pref=(who,value)=>as(who,'insert into public.notification_preferences(user_id,workout_enabled) values($1,$2) on conflict(user_id) do update set workout_enabled=excluded.workout_enabled',[who,value]);
 const register=(who,device,token)=>as(who,"select public.register_push_device($1,$2,'ios')",[device,token]);
 const finish=(id)=>as(A,"select public.record_workout_completion($1,now(),60) as id",[id]);
 await follow(B,A);await follow(C,A);await pref(B,true);await pref(C,false);await pref(A,true);
 await register(B,B,'ExpoPushToken[b]');await register(C,C,'ExpoPushToken[c]');await register(A,A,'ExpoPushToken[a]');await register(D,D,'ExpoPushToken[d]');
 await assert.rejects(as(B,"insert into public.push_devices(user_id,device_id,token,platform) values($1,$2,'ExpoPushToken[forged]','ios')",[A,B]),/permission denied/);
 assert.equal((await as(C,'select * from public.push_devices where user_id=$1',[B])).length,0);
 assert.equal((await as(C,'update public.notification_preferences set workout_enabled=false where user_id=$1 returning *',[B])).length,0);
 assert.equal((await as(B,'select workout_enabled from public.notification_preferences'))[0].workout_enabled,true);
 const first=(await finish('w1'))[0].id;assert.equal((await finish('w1'))[0].id,first);
 let deliveries=(await db.query('select * from loads_private.push_deliveries')).rows;
 assert.equal(deliveries.length,1);assert.equal(deliveries[0].recipient_id,B);assert.notEqual(deliveries[0].actor_id,deliveries[0].recipient_id);
 // Refreshing a token keeps pending queue rows and device identity intact.
 await register(B,B,'ExpoPushToken[b]');assert.equal((await db.query('select * from loads_private.push_deliveries')).rows.length,1);
 await assert.rejects(as(A,'select public.claim_push_deliveries()'),/permission denied/);
 await pref(B,false);assert.deepEqual((await as('service','select public.claim_push_deliveries() as p'))[0].p,[]);
 await pref(B,true);let claimed=(await as('service','select public.claim_push_deliveries() as p'))[0].p;assert.equal(claimed.length,1);assert.equal(claimed[0].recipientId,B);
 assert.deepEqual((await as('service','select public.claim_push_deliveries() as p'))[0].p,[]);
 await as('service',"select public.finish_push_delivery($1,'accepted','ticket',false)",[claimed[0].id]);
 await db.exec("update loads_private.push_deliveries set attempted_at=now()-interval '16 minutes'");
 assert.equal((await as('service','select public.pending_push_receipts() as p'))[0].p.length,1);
 await as('service',"select public.finish_push_delivery($1,'failed',null,true)",[claimed[0].id]);assert.equal((await as(B,'select enabled from public.push_devices'))[0].enabled,false);
 // Tag requires the author to follow the partner; recipients need not follow author.
 await follow(A,D);
 const insert="insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises,photo_path,training_partner_ids) values($1,$2,'w',60,1,80,0,'[]',$3,$4) returning id";
 await assert.rejects(as(A,insert,[A,'bad',null,[C]]),/INVALID_PARTNER/);
 await assert.rejects(as(A,insert,[A,'self',null,[A]]),/INVALID_PARTNER/);
 await assert.rejects(as(A,insert,[A,'dupe',null,[D,D]]),/INVALID_PARTNERS/);
 await assert.rejects(as(A,insert,[A,'four',null,[A,B,C,D]]),/INVALID_PARTNERS/);
 await as(A,"insert into storage.objects(bucket_id,name) values('post-photos',$1)",[`${A}/tag.jpg`]);
 const post=(await as(A,insert,[A,'tag',`${A}/tag.jpg`,[D]]))[0].id;
 assert.equal((await as(D,'select * from public.following_feed')).length,1);
 assert.equal((await as(D,'select * from storage.objects')).length,1);
 assert.deepEqual((await as(D,'select user_id,username from public.post_partners')),[{user_id:D,username:'athlete_4'}]);
 await assert.rejects(as(D,'insert into public.post_partners(post_id,author_id,user_id,username) values($1,$2,$3,$4)',[post,A,D,'spoof']),/permission denied/);
 await assert.rejects(as(D,'select * from loads_private.push_deliveries'),/permission denied/);
 deliveries=(await db.query("select * from loads_private.push_deliveries where kind='partner'")).rows;assert.equal(deliveries.length,1);assert.equal(deliveries[0].recipient_id,D);
 await assert.rejects(as(A,insert,[A,'tag',null,[D]]),/unique constraint/);assert.equal((await db.query("select * from loads_private.push_deliveries where kind='partner'")).rows.length,1);
 await as(D,'update public.notification_preferences set partner_enabled=false where user_id=$1',[D]); // No pref row yet; use upsert below.
 await as(D,'insert into public.notification_preferences(user_id,partner_enabled) values($1,false)',[D]);
 assert.deepEqual((await as('service','select public.claim_push_deliveries() as p'))[0].p,[]);
 await db.query('select public.delete_owned_post($1,$2)',[A,post]);assert.equal((await as(D,'select * from public.following_feed')).length,0);assert.equal((await as(D,'select * from public.post_partners')).length,0);
 await db.query('delete from public.profiles where id=$1',[A]);
 assert.equal((await db.query('select * from public.workout_completions where user_id=$1',[A])).rows.length,0);
 assert.equal((await db.query('select * from loads_private.push_deliveries where actor_id=$1 or recipient_id=$1',[A])).rows.length,0);
 assert.equal((await db.query('select * from public.push_devices where user_id=$1',[A])).rows.length,0);
 assert.equal((await db.query('select * from public.push_devices where user_id=$1',[B])).rows.length,1);
 } finally {await db.close();}
});
