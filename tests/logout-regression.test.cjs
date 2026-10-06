const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const post = { id: 'client', workoutId: 'workout', createdAt: '2026-10-06T00:00:00Z',
  caption: '', photoUri: 'file:///saved.jpg', durationSeconds: 60, totalSets: 0,
  totalVolume: 0, prCount: 0, exercises: [] };
function harness(disk = new Map(), os = 'ios') {
  const state = { owner: A, rpcCalls: 0, upload: null, deletion: null, token: null, rpc: null, tokenStarted: deferred(), uploadStarted: deferred(), deleteStarted: deferred(), rpcStarted: deferred() };
  const storage = { getItem: async key => disk.get(key) ?? null,
    setItem: async (key, value) => { disk.set(key, value); },
    getAllKeys: async () => [...disk.keys()], multiGet: async keys => keys.map(key => [key, disk.get(key) ?? null]) };
  const client = {
    auth: { getSession: async () => ({ data: { session: state.owner ? { user: { id: state.owner } } : null }, error: null }),
      signOut: async () => { state.owner = null; return { error: null }; } },
    rpc: async () => { state.rpcCalls++; state.rpcStarted.resolve(); return state.rpc ? state.rpc.promise : { error: null }; },
    functions: { invoke: async () => { state.deleteStarted.resolve(); return state.deletion.promise; } },
    from: () => {
      const builder = { select: () => builder, eq: () => builder, delete: () => builder,
        maybeSingle: async () => ({ data: null, error: null }), insert: () => builder,
        single: async () => ({ data: { id: 'cloud' }, error: null }),
        then: (yes, no) => Promise.resolve({ error: null }).then(yes, no) };
      return builder;
    },
  };
  const mocks = { '@react-native-async-storage/async-storage': storage, './supabase': { supabase: client },
    '@supabase/supabase-js': { FunctionsHttpError: class extends Error {} },
    './postPhotos': { preparePhoto: async uri => uri, uploadPhoto: async () => { state.uploadStarted.resolve(); return state.upload.promise; } },
    'react-native': { Platform: { OS: os } }, 'expo-device': { isDevice: true },
    'expo-crypto': { randomUUID: () => 'device' }, 'expo-constants': { expoConfig: { extra: { eas: { projectId: 'project' } } } },
    'expo-notifications': { getPermissionsAsync: async () => ({ granted: true }),
      getExpoPushTokenAsync: async () => { state.tokenStarted.resolve(); return state.token.promise; } },
  };
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const m = { exports: {} }; cache[name] = m.exports;
    const code = ts.transpileModule(fs.readFileSync(`src/lib/${name}.ts`, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
    }).outputText;
    new Function('require', 'module', 'exports', '__DEV__', code)(spec => mocks[spec] ?? load(spec.slice(2)), m, m.exports, false);
    return m.exports;
  }
  return { state, disk, load, logout: () => load('accountSession').logoutAccount() };
}

for (const failed of [false, true]) {
  test(`actual upload/retry blocks logout, then ${failed ? 'failure' : 'completion'} releases it`, async () => {
    const h = harness(); const api = h.load('cloudPosts');
    const entry = await api.prepareLocalPost(post, A);
    h.state.upload = deferred();
    const run = api.publishLocalPost(entry);
    assert.equal(api.publishLocalPost(entry), run); // retry shares the in-flight lock
    await h.state.uploadStarted.promise;
    await assert.rejects(h.logout(), /upload or deletion/);
    if (failed) { h.state.upload.reject(Error('offline')); await assert.rejects(run, /offline/); }
    else { h.state.upload.resolve('photo.jpg'); await run; }
    await h.logout();
    assert.equal(h.state.owner, null);
    if (failed) assert.equal((await h.load('postOutbox').getLocalPosts(A))[0].status, 'failed');
  });
  test(`actual deletion blocks logout, then ${failed ? 'failure' : 'completion'} releases it`, async () => {
    const h = harness(); h.state.deletion = deferred();
    const run = h.load('postDeletion').deleteOwnPost({ id: 'cloud', userId: A, clientPostId: post.id });
    await h.state.deleteStarted.promise;
    await assert.rejects(h.logout(), /upload or deletion/);
    if (failed) { h.state.deletion.reject(Error('offline')); await assert.rejects(run, /Could not confirm/); }
    else { h.state.deletion.resolve({ data: { deleted: true } }); await run; }
    await h.logout(); assert.equal(h.state.owner, null);
  });
}

test('idle pending/failed posts survive logout and restart; A/B/A restores only each owner’s data', async () => {
  const h = harness(); const outbox = h.load('postOutbox');
  await outbox.saveLocalPost({ userId: A, post, status: 'pending', error: null, cloudId: null });
  await outbox.saveLocalPost({ userId: A, post: { ...post, id: 'failed' }, status: 'failed', error: 'offline', cloudId: null });
  await h.load('workoutStorage').saveWorkout(A, { id: 'workout', exercises: [] });
  await h.load('workoutStorage').saveActiveWorkout(A, { startedAt: 'now', exercises: [] });
  await h.load('templateStorage').saveTemplate(A, { id: 'template' });
  const before = [...h.disk]; await h.logout();
  assert.deepEqual([...h.disk], before);
  const reopened = harness(h.disk); reopened.state.owner = B;
  assert.deepEqual(await reopened.load('cloudPosts').getPendingPosts(B), []);
  assert.deepEqual(await reopened.load('workoutStorage').getWorkouts(B), []);
  assert.equal(await reopened.load('workoutStorage').getActiveWorkout(B), null);
  assert.deepEqual(await reopened.load('templateStorage').getTemplates(B), []);
  await reopened.logout(); reopened.state.owner = A;
  assert.equal((await reopened.load('cloudPosts').getPendingPosts(A)).length, 2);
  assert.equal((await reopened.load('workoutStorage').getWorkouts(A))[0].id, 'workout');
  assert.equal((await reopened.load('workoutStorage').getActiveWorkout(A)).startedAt, 'now');
  assert.equal((await reopened.load('templateStorage').getTemplates(A))[0].id, 'template');
  await reopened.logout();
});

for (const nextOwner of [A, B, null]) {
  test(`iOS token wait permits logout and late token cannot register after signout (next owner ${nextOwner})`, async () => {
    const h = harness(); h.state.token = deferred();
    const run = h.load('registerPush').registerPush(A, false);
    await h.state.tokenStarted.promise;
    await h.logout(); h.state.owner = nextOwner;
    h.state.token.resolve({ data: 'token' });
    await assert.rejects(run, /Account changed/);
    assert.equal(h.state.rpcCalls, 0);
    await h.logout();
  });
}
test('push registration RPC retains logout exclusion and releases on failure', async () => {
  const h = harness(); h.state.token = deferred(); h.state.rpc = deferred();
  const run = h.load('registerPush').registerPush(A, false);
  h.state.token.resolve({ data: 'token' }); await h.state.rpcStarted.promise;
  await assert.rejects(h.logout(), /upload or deletion/);
  h.state.rpc.reject(Error('offline')); await assert.rejects(run, /offline/);
  await h.logout();
});
test('rejected iOS token and skipped Web registration leave logout available', async () => {
  const h = harness(); h.state.token = deferred();
  const run = h.load('registerPush').registerPush(A, false);
  await h.state.tokenStarted.promise; h.state.token.reject(Error('cancelled'));
  await assert.rejects(run, /cancelled/); await h.logout();
  const web = harness(new Map(), 'web'); await web.load('registerPush').registerPush(A, false); await web.logout();
});
