const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const filename = '20261003074946_gym_social_improvements.sql';
const sql = fs.readFileSync(path.join('supabase/migrations', filename), 'utf8');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

async function setup() {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth,storage,public to authenticated,anon;
    create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,username text,display_name text);
    grant select on public.profiles to authenticated;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text);
    alter table storage.objects enable row level security;
    grant select,insert,update,delete on storage.objects to authenticated,anon;
  `);
  for (const id of [A,B,C]) {
    await db.query('insert into auth.users values($1)',[id]);
    await db.query('insert into public.profiles values($1,$2,$2)',[id,`athlete_${id[0]}`]);
  }
  for (const file of fs.readdirSync('supabase/migrations').sort().filter(file => file < filename)) {
    await db.exec(fs.readFileSync(path.join('supabase/migrations',file),'utf8'));
  }
  async function as(user, statement, args=[]) {
    await db.exec(`begin; set local role authenticated; set local request.jwt.claim.sub='${user}';`);
    try { const result = await db.query(statement,args); await db.exec('commit'); return result.rows; }
    catch (error) { await db.exec('rollback'); throw error; }
  }
  const policy = async () => (await db.query("select oid,polcmd,polpermissive,polroles,pg_get_expr(polqual,polrelid) as using_expression from pg_policy where polrelid='public.posts'::regclass and polname='posts_following_read'")).rows[0];
  return { db, as, policy };
}

test('reviewed migration uses ALTER POLICY with no destructive SQL, including function bodies', () => {
  const executable = sql.replace(/--[^\n]*/g,'');
  assert.doesNotMatch(executable,/\bdrop\s+(table|column|policy|function|view|trigger)\b|\btruncate\b|\bdelete\s+from\b/i);
  assert.match(executable,/alter policy posts_following_read on public\.posts using/i);
  assert.doesNotMatch(executable,/create policy posts_following_read/i);
});

test('ALTER preserves policy identity/roles/additional visibility and reruns without changing existing records or duplicating objects', async () => {
  const { db,as,policy } = await setup();
  try {
    // Simulate an additional legitimate production clause: it must not be erased.
    await db.exec("alter policy posts_following_read on public.posts using (user_id=(select auth.uid()) or user_id in(select following_id from public.follows where follower_id=(select auth.uid())) or client_post_id='existing-extra-access')");
    const original = await policy();
    await as(B,'insert into public.follows(follower_id,following_id) values($1,$2)',[B,A]);
    const insert = "insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises) values($1,$2,'w',60,1,480,0,$3) returning id";
    const exercises = [{ id:1,name:'BENCH PRESS',sets:1,bestWeight:80,bestReps:6,volume:480,focus:'VOLUME',note:'',prTypes:[] },{id:2,name:'RUNNING',type:'cardio',cardio:{durationMinutes:20,distanceKm:null,caloriesKcal:null},sets:0,bestWeight:0,bestReps:0,volume:0,focus:'VOLUME',note:'',prTypes:[]}];
    await as(A,insert,[A,'existing-extra-access',JSON.stringify(exercises)]);
    await as(A,insert,[A,'ordinary-existing',JSON.stringify(exercises)]);
    const before = (await db.query('select id,user_id,client_post_id,exercises from public.posts order by id')).rows;
    await db.exec(sql);
    const updated = await policy();
    for (const key of ['oid','polcmd','polpermissive','polroles']) assert.deepEqual(updated[key],original[key]);
    assert.ok(updated.using_expression.includes("existing-extra-access"));
    assert.ok(updated.using_expression.includes('loads_private.is_training_partner(id)'));
    assert.equal((await as(B,'select * from public.posts')).length,2);
    assert.equal((await as(C,'select * from public.posts')).length,1); // Original extra condition preserved.
    assert.deepEqual((await db.query('select id,user_id,client_post_id,exercises from public.posts order by id')).rows,before);
    await as(A,'insert into public.follows(follower_id,following_id) values($1,$2)',[A,C]);
    const tagged = (await as(A,"insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises,training_partner_ids) values($1,'tagged','w',60,1,480,0,$2,$3) returning id",[A,JSON.stringify(exercises),[C]]))[0].id;
    assert.equal((await as(C,'select * from public.posts where id=$1',[tagged])).length,1);
    assert.equal((await as(C,'select * from public.following_feed where id=$1',[tagged])).length,1);
    await as(C,"select public.register_push_device($1,'ExpoPushToken[original]','ios')",[C]);
    await as(B,'insert into public.notification_preferences(user_id,workout_enabled) values($1,true)',[B]);
    await as(A,"select public.record_workout_completion('finished',now(),60)");
    const relations = ['public.profiles','public.follows','public.posts','public.notification_preferences','public.push_devices','public.workout_completions','public.post_partners','loads_private.push_deliveries'];
    const snapshot = async () => Promise.all(relations.map(async table => (await db.query(`select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text),'[]') as data from ${table} t`)).rows[0].data));
    const rows = await snapshot();
    await db.exec(sql); await db.exec(sql);
    assert.deepEqual(await snapshot(),rows);
    assert.deepEqual(await policy(),updated);
    const rls = (await db.query("select c.relrowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where (n.nspname='public' and c.relname in('notification_preferences','push_devices','workout_completions','post_partners')) or (n.nspname='loads_private' and c.relname='push_deliveries')")).rows;
    assert.equal(rls.length,5); assert.ok(rls.every(row => row.relrowsecurity));
    // Rebinding an Expo token retains the old row without sending its queue to the new owner.
    const oldDevice = (await db.query('select * from public.push_devices where user_id=$1',[C])).rows[0];
    await as(B,"select public.register_push_device($1,'ExpoPushToken[original]','ios')",[B]);
    const retained = (await db.query('select * from public.push_devices where id=$1',[oldDevice.id])).rows[0];
    assert.equal(retained.user_id,C); assert.equal(retained.enabled,false); assert.match(retained.token,/retired_/);
    assert.equal((await db.query('select * from public.push_devices where user_id=$1 and token=$2',[B,'ExpoPushToken[original]'])).rows.length,1);
  } finally { await db.close(); }
});

test('incompatible existing column definitions fail transactionally without editing existing rows', async () => {
  const { db,as }=await setup();
  try {
    await as(A,"insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises) values($1,'keep','w',60,1,80,0,'[]')",[A]);
    await db.exec("alter table public.posts add column training_partner_ids uuid[] not null default '{11111111-1111-4111-8111-111111111111}'");
    const before=(await db.query('select * from public.posts')).rows;
    await assert.rejects(db.exec(sql),/must default to an empty UUID array/);
    await db.exec('rollback');
    assert.deepEqual((await db.query('select * from public.posts')).rows,before);
    assert.equal((await db.query("select to_regclass('public.notification_preferences') as table_name")).rows[0].table_name,null);
  } finally { await db.close(); }
});
