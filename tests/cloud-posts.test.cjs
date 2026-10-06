const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const cloudId = '33333333-3333-4333-8333-333333333333';
const post = () => ({ id: 'client-1', workoutId: 'local-1700', createdAt: '2026-09-28T01:00:00.000Z', caption: 'Training',
  photoUri: null, durationSeconds: 60, totalSets: 1, totalVolume: 500, prCount: 1,
  exercises: [{ id: 1, name: 'BENCH PRESS', focus: 'PR', bestWeight: 100, bestReps: 5, sets: 1, volume: 500, note: '', prTypes: ['WEIGHT PR'] }] });

function harness() {
  const disk = new Map();
  const rows = new Map();
  const state = { user: A, inserts: 0, uploads: 0, loseResponse: false, switchOnUpload: false, pageRows: [], queries: [], payloads: [] };
  const storage = {
    getItem: async key => disk.get(key) ?? null,
    getAllKeys: async () => [...disk.keys()],
    multiGet: async keys => keys.map(key => [key, disk.get(key) ?? null]),
    setItem: async (key, value) => { disk.set(key, value); },
  };
  const supabase = {
    auth: { getSession: async () => ({ data: { session: state.user ? { user: { id: state.user } } : null }, error: null }) },
    storage: { from: () => ({ createSignedUrls: async paths => ({ data: paths.map(item => ({ path: item, signedUrl: 'https://signed/' + item })), error: null }) }) },
    from: table => {
      const filters = {};
      let payload;
      let relationshipError = null;
      const builder = {
        select: selection => {
          // Model production PostgREST: post_partners creates a second profiles
          // relationship, so an unqualified embedding returns HTTP 300/PGRST201.
          if (table === 'following_feed' && !selection.includes('profiles!posts_user_id_fkey(')) {
            relationshipError = { code: 'PGRST201', message: 'Ambiguous profiles relationship' };
          }
          return builder;
        },
        eq: (key, value) => { filters[key] = value; return builder; },
        order: (key, options) => { state.queries.push(['order', key, options]); return builder; },
        limit: value => { state.queries.push(['limit', value]); return builder; },
        or: value => { state.queries.push(['or', value]); return builder; },
        contains: (key, value) => { state.queries.push(['contains', key, value]); return builder; },
        then: (resolve, reject) => Promise.resolve({ data: relationshipError ? null : state.pageRows, error: relationshipError }).then(resolve, reject),
        maybeSingle: async () => ({ data: table === 'deleted_posts' ? (state.deleted ? { post_id: cloudId } : null) : rows.get(filters.user_id + '/' + filters.client_post_id) ?? null, error: null }),
        insert: value => { payload = value; return builder; },
        single: async () => {
          state.inserts++;
          state.payloads.push(JSON.parse(JSON.stringify(payload)));
          rows.set(payload.user_id + '/' + payload.client_post_id, { id: cloudId });
          if (state.loseResponse) { state.loseResponse = false; return { data: null, error: new Error('Connection lost after commit') }; }
          return { data: { id: cloudId }, error: null };
        },
      };
      return builder;
    },
  };
  const mocks = {
    '@react-native-async-storage/async-storage': storage,
    './supabase': { supabase },
    './postPhotos': { PHOTO_BUCKET: 'post-photos', preparePhoto: async uri => uri,
      uploadPhoto: async (_uri, userId, id) => { state.uploads++; if (state.switchOnUpload) state.user = B; return `${userId}/${id}.jpg`; } },
  };
  const cache = new Map();
  function load(filename) {
    const absolute = path.resolve(filename);
    if (cache.has(absolute)) return cache.get(absolute);
    const module = { exports: {} };
    cache.set(absolute, module.exports);
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    const requireLocal = specifier => mocks[specifier] ?? load(path.resolve(path.dirname(absolute), specifier + '.ts'));
    new Function('require', 'module', 'exports', code)(requireLocal, module, module.exports);
    return module.exports;
  }
  return { state, disk, rows, api: load('src/lib/cloudPosts.ts'), outbox: load('src/lib/postOutbox.ts'), validation: load('src/lib/postValidation.ts'),
    restart: () => { cache.clear(); return load('src/lib/cloudPosts.ts'); } };
}

test('a fresh runtime reloads a failed photo post and retries the same snapshot once', async () => {
  const h = harness();
  const entry = await h.api.prepareLocalPost({ ...post(), photoUri: 'file:///documents/post-photos/saved.jpg' }, A);
  await h.outbox.saveLocalPost({ ...entry, status: 'failed', error: 'Offline' });
  const fresh = h.restart();
  const pending = await fresh.getPendingPosts(A);
  assert.equal(pending.length, 1);
  assert.deepEqual(pending[0].post, entry.post);
  await fresh.publishLocalPost(pending[0]);
  assert.equal(h.state.uploads, 1);
  assert.equal(h.state.inserts, 1);
  const restartedAgain = h.restart();
  assert.deepEqual(await restartedAgain.getPendingPosts(A), []);
  await restartedAgain.publishLocalPost(pending[0]);
  assert.equal(h.state.uploads, 1);
  assert.equal(h.state.inserts, 1);
});

test('outbox isolates accounts, preserves legacy posts and survives reloading', async () => {
  const h = harness();
  h.disk.set('@loads/posts', JSON.stringify([post()]));
  await h.api.prepareLocalPost(post(), A);
  assert.equal((await h.outbox.getLocalPosts(A)).length, 1);
  assert.deepEqual(await h.outbox.getLocalPosts(B), []);
  assert.equal(JSON.parse(h.disk.get('@loads/posts'))[0].id, 'client-1');
  h.state.user = B;
  await assert.rejects(h.api.publishLocalPost((await h.outbox.getLocalPosts(A))[0]), /account changed/);
  assert.equal(h.state.inserts, 0);
});

test('training partners survive outbox restart, publish as recipient IDs and hydrate server snapshots with tagged-only filter',async()=>{
  const h=harness();const tagged={...post(),trainingPartners:[{id:B,username:'athlete_b'}]};const entry=await h.api.prepareLocalPost(tagged,A);
  const api=h.restart();await api.publishLocalPost(entry);assert.deepEqual(h.state.payloads[0].training_partner_ids,[B]);
  const row={id:cloudId,user_id:B,client_post_id:'p',workout_id:'w',created_at:post().createdAt,caption:'',photo_path:null,duration_seconds:60,total_sets:1,total_volume:500,pr_count:1,exercises:post().exercises,profiles:{username:'b',display_name:'B'},post_partners:[{user_id:A,username:'a'}],training_partner_ids:[A]};
  h.state.pageRows=[row];const page=await api.getFeedPage(null,true);assert.deepEqual(page.posts[0].trainingPartners,[{id:A,username:'a'}]);
  assert.deepEqual(h.state.queries.find(q=>q[0]==='contains'),['contains','training_partner_ids',[A]]);
});

test('response lost after commit retries with the same id without uploading/inserting again', async () => {
  const h = harness();
  const entry = await h.api.prepareLocalPost({ ...post(), photoUri: 'file:///photo.jpg' }, A);
  h.state.loseResponse = true;
  await assert.rejects(h.api.publishLocalPost(entry), /Connection lost/);
  assert.equal((await h.outbox.getLocalPosts(A))[0].status, 'failed');
  const published = await h.api.publishLocalPost((await h.outbox.getLocalPosts(A))[0]);
  assert.equal(published.status, 'published');
  assert.equal(h.state.inserts, 1);
  assert.equal(h.state.uploads, 1);
  assert.deepEqual(await h.api.getPendingPosts(A), []);
});

test('concurrent send buttons share one operation', async () => {
  const h = harness();
  const entry = await h.api.prepareLocalPost(post(), A);
  const first = h.api.publishLocalPost(entry);
  const second = h.api.publishLocalPost(entry);
  assert.equal(first, second);
  await Promise.all([first, second]);
  assert.equal(h.state.inserts, 1);
});

test('account change during photo upload prevents the post INSERT', async () => {
  const h = harness();
  const entry = await h.api.prepareLocalPost({ ...post(), photoUri: 'file:///photo.jpg' }, A);
  h.state.switchOnUpload = true;
  await assert.rejects(h.api.publishLocalPost(entry), /account changed/);
  assert.equal(h.state.inserts, 0);
  assert.equal((await h.outbox.getLocalPosts(A))[0].status, 'failed');
  assert.deepEqual(await h.outbox.getLocalPosts(B), []);
});

function row(index = 0) {
  return { id: `${String(index).padStart(8, '0')}-3333-4333-8333-333333333333`, user_id: A,
    client_post_id: 'client-' + index, workout_id: 'local-1', created_at: '2026-09-28T01:00:00.123456+00:00',
    caption: '', photo_path: null, duration_seconds: 60, total_sets: 1, total_volume: 500, pr_count: 1,
    exercises: post().exercises, profiles: { username: 'athlete', display_name: 'Athlete A' } };
}

test('feed preserves snapshots and author identity, skips corrupt JSON, and keeps cursor precision', async () => {
  const h = harness();
  h.state.pageRows = Array.from({ length: 21 }, (_, index) => row(index));
  h.state.pageRows[0].exercises = { invalid: true };
  const page = await h.api.getFeedPage();
  assert.equal(page.posts.length, 19);
  assert.equal(page.invalidCount, 1);
  assert.equal(page.posts[0].authorName, 'Athlete A');
  assert.deepEqual(page.posts[0].exercises, post().exercises);
  assert.equal(page.nextCursor.createdAt, '2026-09-28T01:00:00.123456+00:00');
  assert.match(h.api.feedCursorFilter(page.nextCursor), /123456/);
  assert.throws(() => h.api.feedCursorFilter({ id: cloudId, createdAt: 'injected,filter' }), /cursor/);
  assert.equal(h.api.toFeedPost({ ...row(), profiles: { username: 'fallback', display_name: '  ' } }, null).authorName, 'fallback');
});

test('validation rejects negative/nonfinite stats, malformed exercises and duplicate ids', () => {
  const { validation } = harness();
  assert.throws(() => validation.validatePost({ ...post(), totalVolume: Infinity }));
  assert.throws(() => validation.validatePost({ ...post(), durationSeconds: -1 }));
  assert.throws(() => validation.parseExercises([{ ...post().exercises[0], focus: 'unknown' }]));
  assert.throws(() => validation.parseExercises([...post().exercises, ...post().exercises]));
});

test('migrations enforce feed and photo permissions in PostgreSQL', async () => {
  const db = new PGlite();
  try {
    // Reproduce only the pre-existing Supabase schemas used by these migrations.
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create schema storage;
      create table auth.users (id uuid primary key);
      insert into auth.users values ('${A}'), ('${B}');
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, storage, public to anon, authenticated;
      create table public.profiles (id uuid primary key, username text not null, display_name text);
      insert into public.profiles values ('${A}', 'a', 'Athlete A'), ('${B}', 'b', 'Athlete B');
      grant select on public.profiles to authenticated;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid default gen_random_uuid() primary key, bucket_id text, name text);
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
    `);
    for (const migration of fs.readdirSync('supabase/migrations').sort()) {
      await db.exec(fs.readFileSync(path.join('supabase/migrations', migration), 'utf8'));
    }
    async function asUser(user, sql, params = []) {
      await db.exec(`begin; set local role ${user ? 'authenticated' : 'anon'}; set local request.jwt.claim.sub = '${user ?? ''}';`);
      try { const result = await db.query(sql, params); await db.exec('commit'); return result.rows; }
      catch (error) { await db.exec('rollback'); throw error; }
    }
    const insert = `insert into public.posts (user_id, client_post_id, workout_id, duration_seconds, total_sets, total_volume, pr_count, exercises, photo_path)
      values ($1, $2, 'local-1700', 60, 1, 500, 1, $3::jsonb, $4) returning id`;
    const values = [A, 'test-post', JSON.stringify(post().exercises), `${A}/test-post.jpg`];
    await assert.rejects(asUser(null, 'select * from public.posts'), /permission denied/);
    await assert.rejects(asUser(B, insert, values), /row-level security/);
    await assert.rejects(asUser(null, insert, values), /permission denied/);
    await asUser(A, "insert into storage.objects(bucket_id, name) values ('post-photos', $1)", [`${A}/test-post.jpg`]);
    assert.equal((await asUser(A, 'select * from storage.objects')).length, 1);
    assert.equal((await asUser(B, 'select * from storage.objects')).length, 0);
    await assert.rejects(asUser(B, "insert into storage.objects(bucket_id, name) values ('post-photos', $1)", [`${A}/forged.jpg`]), /row-level security/);
    const inserted = await asUser(A, insert, values);
    assert.equal(inserted.length, 1);
    // The feed is now opt-in: published posts remain hidden until followed.
    assert.equal((await asUser(B, 'select * from public.posts')).length, 0);
    await asUser(B, 'insert into public.follows(follower_id,following_id) values($1,$2)', [B,A]);
    assert.equal((await asUser(B, 'select * from public.posts')).length, 1);
    assert.equal((await asUser(B, 'select * from storage.objects')).length, 1);
    assert.equal((await asUser(null, 'select * from storage.objects')).length, 0);
    await assert.rejects(asUser(A, insert, values), /unique constraint/);
    await assert.rejects(asUser(A, insert, [A, 'different', '[]', `${B}/different.jpg`]), /check constraint/);
    await assert.rejects(asUser(B, "update public.posts set caption = 'forged'"), /permission denied/);
    await assert.rejects(asUser(B, 'delete from public.posts'), /permission denied/);
    await assert.rejects(asUser(A, 'delete from public.posts'), /permission denied/);
    assert.equal((await asUser(B, "update storage.objects set name = 'changed' returning id")).length, 0);
    assert.equal((await asUser(B, 'delete from storage.objects returning id')).length, 0);
    const bucket = (await db.query("select * from storage.buckets where id = 'post-photos'")).rows[0];
    assert.equal(bucket.public, false);
    assert.deepEqual(bucket.allowed_mime_types, ['image/jpeg']);
    await assert.rejects(asUser(B, 'select public.delete_owned_post($1, $2)', [A, inserted[0].id]), /permission denied/);
    await assert.rejects(db.query('select public.delete_owned_post($1, $2)', [B, inserted[0].id]), /POST_NOT_FOUND/);
    await db.exec('set role service_role');
    await db.query('select public.delete_owned_post($1, $2)', [A, inserted[0].id]);
    await db.exec('reset role');
    await db.query('select public.delete_owned_post($1, $2)', [A, inserted[0].id]);
    assert.equal((await asUser(B, 'select * from public.posts')).length, 0);
    assert.equal((await asUser(B, 'select * from public.deleted_posts')).length, 0);
    assert.equal((await asUser(A, 'select * from public.deleted_posts')).length, 1);
    await assert.rejects(asUser(A, insert, values), /POST_DELETED/);
    await assert.rejects(asUser(A, "insert into storage.objects(bucket_id, name) values ('post-photos', $1)", [`${A}/test-post.jpg`]), /row-level security/);
    assert.equal((await asUser(A, 'select * from storage.objects')).length, 0);
    assert.equal((await db.query('select * from public.photo_cleanup_jobs')).rows.length, 1);
    // A crafted primary-key reuse must fail the transaction, never delete without a tombstone.
    await asUser(B, `insert into public.posts(id,user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises)
      values($1,$2,'reused-uuid','local',1,1,1,0,'[]')`, [inserted[0].id, B]);
    await assert.rejects(db.query('select public.delete_owned_post($1,$2)', [B, inserted[0].id]), /unique constraint/);
    assert.equal((await asUser(B, 'select * from public.posts where id=$1', [inserted[0].id])).length, 1);
    const cardio = { id: 2, name: 'RUNNING', type: 'cardio', focus: 'VOLUME',
      bestWeight: 0, bestReps: 0, sets: 0, volume: 0, prTypes: [], note: 'Easy pace',
      cardio: { durationMinutes: 30, distanceKm: 5, speedKmh: 10.4, inclinePercent: 0, resistanceLevel: null, paceSeconds: null, floors: null } };
    for (const exercises of [[cardio], [...post().exercises, cardio]]) {
      const clientId = exercises.length === 1 ? 'cardio-only' : 'mixed';
      const result = await asUser(A, `insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises)
        values($1,$2,'cardio-workout',1800,$3,$4,$5,$6::jsonb) returning exercises`,
        [A, clientId, exercises.length === 1 ? 0 : 1, exercises.length === 1 ? 0 : 500, exercises.length === 1 ? 0 : 1, JSON.stringify(exercises)]);
      assert.deepEqual(result[0].exercises, exercises);
      assert.deepEqual((await asUser(B, 'select exercises from public.posts where client_post_id=$1', [clientId]))[0].exercises, exercises);
      await assert.rejects(asUser(B, `insert into public.posts(user_id,client_post_id,workout_id,duration_seconds,total_sets,total_volume,pr_count,exercises)
        values($1,'forged-cardio','local',1800,0,0,0,$2::jsonb)`, [A, JSON.stringify(exercises)]), /row-level security/);
    }
  } finally { await db.close(); }
});

test('cardio-only and mixed post snapshots publish and hydrate through the existing Supabase pipeline', async () => {
  const cardio = { id: 2, name: 'RUNNING', type: 'cardio', focus: 'VOLUME', bestWeight: 0, bestReps: 0,
    sets: 0, volume: 0, note: 'Easy pace', prTypes: [], cardio: { durationMinutes: 30, distanceKm: 5, speedKmh: 10.4, inclinePercent: 0, resistanceLevel: null, paceSeconds: 125, floors: 0 } };
  for (const exercises of [[cardio], [...post().exercises, cardio]]) {
    const h = harness();
    const snapshot = { ...post(), exercises, totalSets: exercises.length === 1 ? 0 : 1,
      totalVolume: exercises.length === 1 ? 0 : 500, prCount: exercises.length === 1 ? 0 : 1 };
    const entry = await h.api.prepareLocalPost(snapshot, A);
    const pending = await h.restart().getPendingPosts(A);
    assert.deepEqual(pending[0].post, snapshot);
    h.state.loseResponse = true;
    await assert.rejects(h.api.publishLocalPost(entry), /Connection lost/);
    const failed = (await h.restart().getPendingPosts(A))[0];
    assert.deepEqual(failed.post.exercises, exercises);
    await h.api.publishLocalPost(failed);
    assert.equal(h.state.inserts, 1);
    const payload = h.state.payloads[0];
    assert.deepEqual(payload.exercises, exercises);
    const feed = h.api.toFeedPost({ ...payload, id: cloudId, created_at: snapshot.createdAt, profiles: { username: 'a', display_name: 'Athlete A' } }, null);
    assert.deepEqual(feed.exercises, exercises);
    assert.equal(feed.totalSets, snapshot.totalSets);
    assert.equal(feed.prCount, snapshot.prCount);
  }
});

test('deleted post from another device retires the durable outbox without upload or insert', async () => {
  const h = harness();
  const entry = await h.api.prepareLocalPost({ ...post(), photoUri: 'file:///photo.jpg' }, A);
  h.state.deleted = true;
  const fresh = h.restart();
  assert.equal((await fresh.publishLocalPost(entry)).status, 'deleted');
  assert.deepEqual(await fresh.getPendingPosts(A), []);
  assert.equal(h.state.uploads, 0);
  assert.equal(h.state.inserts, 0);
});
