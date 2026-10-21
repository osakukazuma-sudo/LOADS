const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'),path=require('node:path');
const {PGlite}=require('@electric-sql/pglite');
const A='11111111-1111-4111-8111-111111111111', B='22222222-2222-4222-8222-222222222222', C='33333333-3333-4333-8333-333333333333', D='44444444-4444-4444-8444-444444444444';
async function fixture(beforeReaction=async()=>{}, skipReaction=false) {
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
 for(const file of fs.readdirSync('supabase/migrations').sort()) {
  if(file.includes('workout_reactions')) await beforeReaction(db);
  if(file.includes('workout_reactions') && skipReaction) continue;
  await db.exec(fs.readFileSync(path.join('supabase/migrations',file),'utf8'));
 }
 async function as(id,sql,args=[]) {await db.exec(`begin;set local role ${id==='service'?'service_role':id?'authenticated':'anon'};set local request.jwt.claim.sub='${id==='service'?'':id??''}';`);try{const r=await db.query(sql,args);await db.exec('commit');return r.rows;}catch(e){await db.exec('rollback');throw e;}}
 return {db,as};
 }catch(error){await db.close();throw error;}
}

test('prepared production envelope commits history atomically and rolls back late failure', {skip:!fs.existsSync('.expo/workout-reactions-stage2/apply-reviewed.sql')}, async()=>{
 const preparedPath='.expo/workout-reactions-stage2/apply-reviewed.sql';
 const prepared=fs.readFileSync(preparedPath,'utf8');
 const {db}=await fixture(async db=>{
  await db.exec('create schema supabase_migrations; create table supabase_migrations.schema_migrations(version text primary key,name text,statements text[])');
  const oldClaim=(await db.query("select pg_get_functiondef('public.claim_push_deliveries()'::regprocedure) as d")).rows[0].d;
  await assert.rejects(db.exec(prepared.replace(/commit;\s*$/i,'select 1/0; commit;')),/division by zero/);
  await db.exec('rollback');
  assert.equal((await db.query("select to_regclass('public.workout_reactions') as t")).rows[0].t,null);
  assert.equal((await db.query('select count(*)::int as n from supabase_migrations.schema_migrations')).rows[0].n,0);
  assert.equal((await db.query("select pg_get_functiondef('public.claim_push_deliveries()'::regprocedure) as d")).rows[0].d,oldClaim);
  await db.exec(prepared);
  const rows=(await db.query('select version,statements from supabase_migrations.schema_migrations')).rows;
  assert.equal(rows[0].version,'20261015061237');
  assert.equal(rows[0].statements[0],fs.readFileSync('supabase/migrations/20261015061237_workout_reactions.sql','utf8'));
  await assert.rejects(db.exec(prepared),/already recorded/); await db.exec('rollback');
 },true);
 await db.close();
});
test('reaction RLS, all types, notification dedup/preferences and cascades', async()=>{
 const {db,as}=await fixture();try {
 await db.exec(fs.readFileSync('supabase/ops/inspect-workout-reactions.sql','utf8'));
 // SQL Editor postflight must be executable without querying any user fixture rows.
 await db.exec('create schema if not exists supabase_migrations; create table if not exists supabase_migrations.schema_migrations(version text,name text)');
 await db.exec(fs.readFileSync('supabase/ops/verify-workout-reactions-release.sql','utf8'));


 const follow=(a,b)=>as(a,'insert into public.follows values($1,$2)',[a,b]);
 await follow(B,A); await follow(C,A);
 const post=(await as(A,"insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises) values($1,'reaction-post','w',60,1,80,0,'[]') returning id",[A]))[0].id;
 await as(A,'insert into public.notification_preferences(user_id,reaction_enabled) values($1,true)',[A]);
 await as(A,"select public.register_push_device($1,'ExpoPushToken[reactions]','ios')",[A]);
 const insert=(who,type='beast',user=who)=>as(who,'insert into public.workout_reactions(post_id,user_id,reaction_type) values($1,$2,$3)',[post,user,type]);
 await assert.rejects(insert(A),/REACTION_NOT_ALLOWED|row-level security/);
 await assert.rejects(insert(D),/row-level security/);
 await assert.rejects(insert(B,'beast',C),/REACTION_NOT_ALLOWED|row-level security/);
 await assert.rejects(insert(null),/permission denied/);
 await insert(B);
 await assert.rejects(insert(B),/unique constraint/);
 for(const type of ['beast','yeah_buddy','pain_zone','light_weight','no_tomorrow','wagmi','slay','built_different']) {
  await as(B,'insert into public.workout_reactions(post_id,user_id,reaction_type) values($1,$2,$3) on conflict(post_id,user_id) do update set post_id=excluded.post_id,user_id=excluded.user_id,reaction_type=excluded.reaction_type',[post,B,type]);
  assert.equal((await as(B,'select * from public.workout_reactions'))[0].reaction_type,type);
 }
 await assert.rejects(insert(C,'invalid'),/check constraint/);
 assert.equal((await as(A,'select * from public.workout_reactions')).length,0);
 assert.equal((await as(C,'select count(*)::int as n from public.workout_reactions'))[0].n,0);
 assert.equal((await as(C,"update public.workout_reactions set reaction_type='beast' returning *")).length,0);
 assert.equal((await as(C,'delete from public.workout_reactions returning *')).length,0);
 await assert.rejects(as(B,'update public.workout_reactions set user_id=$1',[C]),/REACTION_NOT_ALLOWED|REACTION_IMMUTABLE|row-level security|permission denied/);
 await assert.rejects(as(B,'select * from loads_private.reaction_events'),/permission denied/);
 await as(B,'delete from public.workout_reactions'); await insert(B);
 assert.equal((await db.query("select * from loads_private.push_deliveries where kind='reaction'")).rows.length,1);
 await as(A,'update public.notification_preferences set reaction_enabled=false,workout_enabled=true');
 assert.deepEqual((await as('service','select public.claim_push_deliveries() as p'))[0].p,[]);
 await insert(C); // OFF at creation never queues retroactively.
 assert.equal((await db.query("select * from loads_private.push_deliveries where kind='reaction'")).rows.length,1);
 await as(A,'update public.notification_preferences set reaction_enabled=true');
 const payload=(await as('service','select public.claim_push_deliveries() as p'))[0].p;
 assert.equal(payload.length,1);assert.equal(payload[0].actorName,'athlete_2');assert.equal(payload[0].recipientId,A);assert.equal(payload[0].postId,post);assert.equal(payload[0].reactionType,'beast');
 assert.deepEqual((await as('service','select public.claim_push_deliveries() as p'))[0].p,[]);
 const rowCounts=async()=>Promise.all(['public.workout_reactions','loads_private.reaction_events','loads_private.push_deliveries'].map(async table=>(await db.query('select count(*)::int as n from '+table)).rows[0].n));
 const beforeReplay=await rowCounts();
 await assert.rejects(db.exec(migration),/REVIEW_REQUIRED/);await db.exec('rollback');
 assert.deepEqual(await rowCounts(),beforeReplay);
 await as(B,'delete from public.follows');
 assert.equal((await as(B,'select * from public.workout_reactions')).length,0);
 assert.equal((await as(B,"update public.workout_reactions set reaction_type='slay' returning *")).length,0);
 // No WHERE/RETURNING means PostgreSQL need not apply SELECT policies.
 await as(B,'delete from public.workout_reactions');
 assert.equal((await db.query('select * from public.workout_reactions where user_id=$1',[B])).rows.length,1,'hidden reaction must not be deletable via bare DELETE');

 await db.query("insert into loads_private.account_deletion_jobs(user_id,status) values($1,'pending')",[C]);
 await assert.rejects(as(C,"update public.workout_reactions set reaction_type='slay'"),/REACTION_NOT_ALLOWED|row-level security/);
 await as(C,'delete from public.workout_reactions');
 assert.equal((await db.query('select * from public.workout_reactions where user_id=$1',[C])).rows.length,1);
 await db.query('delete from public.profiles where id=$1',[C]);
 assert.equal((await db.query('select * from public.workout_reactions where user_id=$1',[C])).rows.length,0);
 assert.equal((await db.query('select * from loads_private.reaction_events where user_id=$1',[C])).rows.length,0);
 await db.query('select public.delete_owned_post($1,$2)',[A,post]);
 await assert.rejects(insert(B),/REACTION_NOT_ALLOWED|row-level security/);
 await as(B,'delete from public.workout_reactions');
 for(const table of ['public.workout_reactions','loads_private.reaction_events','loads_private.push_deliveries'])assert.equal((await db.query('select * from '+table)).rows.length,0);
 }finally{await db.close();}
});

const migration=fs.readFileSync('supabase/migrations/20261015061237_workout_reactions.sql','utf8');

// In-process integration: actual SQL RPCs and worker source; transport never reaches Expo.
function reactionWorker() {
 const ts=require('typescript'),mod={exports:{}};
 new Function('module','exports',ts.transpileModule(fs.readFileSync('supabase/functions/_shared/push.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod,mod.exports);
 return mod.exports;
}
function sqlWorkerClient(db) {
 return {rpc:async(name,args={})=>{
  const calls={pending_push_receipts:['select public.pending_push_receipts() as payload',[]],claim_push_deliveries:['select public.claim_push_deliveries() as payload',[]],finish_push_delivery:['select public.finish_push_delivery($1,$2,$3,$4) as payload',[args.p_id,args.p_state,args.p_ticket??null,args.p_disable??false]]};
  assert.ok(calls[name],'only reviewed worker RPCs may run');
  await db.exec('begin;set local role service_role');
  try {const rows=await db.query(...calls[name]);await db.exec('commit');return {data:rows.rows[0].payload,error:null};}
  catch(error){await db.exec('rollback');return {data:null,error};}
 }};
}
function mockExpo(messages) {
 return async(url,options)=>{
  assert.equal(url,'https://exp.host/--/api/v2/push/send');
  const batch=JSON.parse(options.body);messages.push(...batch);
  return Response.json({data:batch.map((_,i)=>({status:'ok',id:`mock-${messages.length}-${i}`}))});
 };
}

test('new worker consumes old claim payload before migration and preserved legacy queue after migration',async()=>{
 const worker=reactionWorker(),messages=[];
 const {db}=await fixture(async db=>{
  await db.exec(`insert into public.notification_preferences(user_id,workout_enabled) values('${B}',true);
   insert into public.push_devices(user_id,device_id,token,platform) values('${B}','${B}','ExpoPushToken[legacy]','ios');
   begin;set local role authenticated;set local request.jwt.claim.sub='${B}';
   insert into public.follows(follower_id,following_id) values('${B}','${A}');commit;
   insert into loads_private.push_deliveries(event_key,kind,actor_id,recipient_id,device_id)
   select 'legacy/'||kind,kind,'${A}','${B}',id from public.push_devices cross join (values('workout'),('partner')) k(kind);`);
  assert.deepEqual(await worker.processPushQueue(sqlWorkerClient(db),mockExpo(messages)),{attempted:2});
  assert.deepEqual(messages.map(m=>m.body),['athlete_1 finished a workout.','athlete_1 tagged you as a training partner.']);
  assert.ok(messages.every(m=>m.title==='LOADS'));
  await db.exec(`insert into loads_private.push_deliveries(event_key,kind,actor_id,recipient_id,device_id)
   select 'pending/'||kind,kind,'${A}','${B}',id from public.push_devices cross join (values('workout'),('partner')) k(kind);`);
 });
 try {
  assert.deepEqual(await worker.processPushQueue(sqlWorkerClient(db),mockExpo(messages)),{attempted:2});
  assert.deepEqual(messages.slice(2).map(m=>m.body),messages.slice(0,2).map(m=>m.body));
  assert.deepEqual(await worker.processPushQueue(sqlWorkerClient(db),mockExpo(messages)),{attempted:0});
  assert.equal(messages.length,4);
 }finally{await db.close();}
});

test('reaction INSERT through RLS reaches real claim and worker once, uses username, and respects OFF',async()=>{
 const {db,as}=await fixture(),worker=reactionWorker(),messages=[];
 try {
  await db.query('update public.profiles set username=$1,display_name=$2 where id=$3',['gym_bro','Private display name',B]);
  await as(B,'insert into public.follows(follower_id,following_id) values($1,$2)',[B,A]);
  await as(A,'insert into public.notification_preferences(user_id,reaction_enabled) values($1,true)',[A]);
  await as(A,"select public.register_push_device($1,'ExpoPushToken[integration]','ios')",[A]);
  const post=(await as(A,"insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises) values($1,'integrated','w',60,1,80,0,'[]') returning id",[A]))[0].id;
  const insert=()=>as(B,"insert into public.workout_reactions(post_id,user_id,reaction_type) values($1,$2,'beast')",[post,B]);
  const run=()=>worker.processPushQueue(sqlWorkerClient(db),mockExpo(messages));
  await insert();assert.deepEqual(await run(),{attempted:1});
  assert.equal(messages[0].title,'gym_bro');assert.equal(messages[0].body,'BEAST!! 🦍');
  assert.deepEqual(messages[0].data,{kind:'reaction',actorId:B,recipientId:A,postId:post});
  assert.equal(JSON.stringify(messages).includes('Private display name'),false);
  await as(B,"update public.workout_reactions set reaction_type='slay'");
  await as(B,'delete from public.workout_reactions');await insert();
  assert.deepEqual(await run(),{attempted:0});assert.equal(messages.length,1);
  await as(A,'update public.notification_preferences set reaction_enabled=false');
  await as(C,'insert into public.follows(follower_id,following_id) values($1,$2)',[C,A]);
  await as(C,"insert into public.workout_reactions(post_id,user_id,reaction_type) values($1,$2,'slay')",[post,C]);
  assert.equal((await as(C,'select count(*)::int as n from public.workout_reactions'))[0].n,1);
  assert.equal((await as(A,'select count(*)::int as n from public.workout_reactions'))[0].n,0);
  assert.deepEqual(await as(C,'select user_id,reaction_type from public.workout_reactions where user_id=$1',[B]),[]);
  assert.deepEqual(await run(),{attempted:0});
  await as(A,'update public.notification_preferences set reaction_enabled=true');
  assert.deepEqual(await run(),{attempted:0});assert.equal(messages.length,1);
 }finally{await db.close();}
});

test('late migration failure rolls back added objects and preserves old claim and pending deliveries',async()=>{
 const {db}=await fixture(async db=>{
  const before=(await db.query("select pg_get_functiondef('public.claim_push_deliveries()'::regprocedure) as body")).rows[0].body;
  await db.exec(`insert into public.push_devices(user_id,device_id,token,platform) values('${B}','${B}','ExpoPushToken[rollback]','ios');
   insert into loads_private.push_deliveries(event_key,kind,actor_id,recipient_id,device_id)
   select 'rollback/pending','partner','${A}','${B}',id from public.push_devices;`);
  const pending=(await db.query('select * from loads_private.push_deliveries')).rows;
  const failure=migration.replace("notify pgrst,'reload schema';",()=>"do $$begin raise exception 'ISOLATED_FAILURE';end;$$;");
  await assert.rejects(db.exec(failure),/ISOLATED_FAILURE/);await db.exec('rollback');
  assert.equal((await db.query("select to_regclass('public.workout_reactions') as table_name")).rows[0].table_name,null);
  assert.equal((await db.query("select count(*)::int as n from information_schema.columns where table_name='notification_preferences' and column_name='reaction_enabled'")).rows[0].n,0);
  assert.equal((await db.query("select pg_get_functiondef('public.claim_push_deliveries()'::regprocedure) as body")).rows[0].body,before);
  assert.equal((await db.query('select count(*)::int as n from public.profiles')).rows[0].n,4);
  assert.deepEqual((await db.query('select * from loads_private.push_deliveries')).rows,pending);
 });
 await db.close();
});
test('worker ACL is restored, unreviewed function drift aborts and migration replay leaves data intact',async()=>{
 const {db,as}=await fixture(db=>db.exec('grant execute on function public.claim_push_deliveries() to public,anon,authenticated'));
 try {
  for(const role of [null,A])await assert.rejects(as(role,'select public.claim_push_deliveries()'),/permission denied/);
  const before=(await db.query("select pg_get_functiondef('public.claim_push_deliveries()'::regprocedure) as definition")).rows;
  await assert.rejects(db.exec(migration),/REVIEW_REQUIRED/);await db.exec('rollback');
  assert.deepEqual((await db.query("select pg_get_functiondef('public.claim_push_deliveries()'::regprocedure) as definition")).rows,before);
  assert.equal((await db.query('select * from public.profiles')).rows.length,4);
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.workout_reactions'::regclass")).rows[0].relrowsecurity,true);
 }finally{await db.close();}
 await assert.rejects(fixture(db=>db.exec("create or replace function public.claim_push_deliveries() returns jsonb language sql security definer as $$select '[]'::jsonb$$")),/REVIEW_REQUIRED/);
});
test('independent actors, queue failure isolation, token rotation and account worker cascade',async()=>{
 const {db,as}=await fixture();try {
  for(const who of [B,C])await as(who,'insert into public.follows(follower_id,following_id) values($1,$2)',[who,A]);
  await as(A,'insert into public.notification_preferences(user_id,reaction_enabled) values($1,true)',[A]);
  await as(A,"select public.register_push_device($1,'ExpoPushToken[first]','ios')",[A]);
  const post=(await as(A,"insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises) values($1,'review','w',60,1,80,0,'[]') returning id",[A]))[0].id;
  const insert=who=>as(who,"insert into public.workout_reactions(post_id,user_id,reaction_type) values($1,$2,'beast')",[post,who]);
  await insert(B);await insert(C);
  assert.equal((await db.query('select * from public.workout_reactions')).rows.length,2);
  assert.equal((await as(B,'select * from public.workout_reactions'))[0].user_id,B);
  assert.equal((await as(A,'select count(*)::int as n from public.workout_reactions'))[0].n,0);
  // Correct device ownership alone must not bypass post-author validation.
  await as(D,"select public.register_push_device($1,'ExpoPushToken[unrelated]','ios')",[D]);
  const unrelated=(await as(D,'select id from public.push_devices'))[0].id;
  await db.query("update loads_private.push_deliveries set recipient_id=$1,device_id=$2 where actor_id=$3",[D,unrelated,B]);
  assert.equal((await as('service','select public.claim_push_deliveries() as p'))[0].p.length,1);
  await as(A,"select public.register_push_device($1,'ExpoPushToken[rotated]','ios')",[A]);
  await as(A,"select public.register_push_device($1,'ExpoPushToken[second]','ios')",[D]);
  await as(C,'delete from public.workout_reactions');await insert(C);
  assert.equal((await db.query("select * from loads_private.push_deliveries where actor_id=$1",[C])).rows.length,1);
  // Force queue failure: the reaction and one-time event still commit.
  await db.exec("create function loads_private.test_queue_failure() returns trigger language plpgsql as $$begin raise exception 'fixture queue failure';end;$$; create trigger test_queue_failure before insert on loads_private.push_deliveries for each row execute function loads_private.test_queue_failure();");
  const second=(await as(A,"insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises) values($1,'queue-failure','w',60,1,80,0,'[]') returning id",[A]))[0].id;
  await as(B,"insert into public.workout_reactions(post_id,user_id,reaction_type) values($1,$2,'beast')",[second,B]);
  assert.equal((await db.query('select * from public.workout_reactions where post_id=$1',[second])).rows.length,1);
  assert.equal((await db.query('select * from loads_private.reaction_events where post_id=$1',[second])).rows.length,1);
  assert.equal((await db.query('select * from loads_private.push_deliveries where post_id=$1',[second])).rows.length,0);
  await db.exec('drop trigger test_queue_failure on loads_private.push_deliveries;drop function loads_private.test_queue_failure()');
  // Exercise the real rows phase rather than manually deleting a profile.
  const hash='d'.repeat(64);
  await db.query('select public.prepare_account_receipt($1,$2)',[A,hash]);
  await db.query('select public.accept_account_deletion($1,$2)',[A,hash]);
  await assert.rejects(as(B,"update public.workout_reactions set reaction_type='slay'"),/REACTION_NOT_ALLOWED/);
  const advance=async phase=>{
   await db.exec('update loads_private.account_deletion_jobs set next_run_at=now()');
   const job=(await db.query('select public.claim_account_deletion() as j')).rows[0].j;
   await db.query('select public.advance_account_deletion($1,$2,$3)',[A,job.lease_id,phase]);
  };
  await advance('rows');await advance('delete_auth');
  for(const table of ['public.workout_reactions','loads_private.reaction_events','loads_private.push_deliveries'])assert.equal((await db.query('select * from '+table)).rows.length,0);
  assert.equal((await db.query('select * from public.profiles where id=$1',[B])).rows.length,1);
  assert.deepEqual((await as('service','select public.claim_push_deliveries() as p'))[0].p,[]);
 }finally{await db.close();}
});
