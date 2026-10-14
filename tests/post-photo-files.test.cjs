const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
function harness() {
  const files = new Map();
  const Paths = { document: 'file:///old/Documents' };
  const join = parts => parts.map(p => typeof p === 'string' ? p : p.uri).join('/');
  class Directory {
    constructor(...parts) { this.uri = join(parts); }
    create() {}
    delete() { throw new Error('Unexpected deletion'); }
  }
  class File {
    constructor(...parts) { this.uri = join(parts); }
    get exists() { return files.has(this.uri); }
    copy(destination) { if (!this.exists) throw new Error('Missing source'); files.set(destination.uri, files.get(this.uri)); }
    async arrayBuffer() { if (!this.exists) throw new Error('Missing source'); return Uint8Array.from(files.get(this.uri)).buffer; }
  }
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/lib/postPhotoFiles.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  new Function('require', 'module', 'exports', code)(() => ({ Directory, File, Paths }), module, module.exports);
  return { ...module.exports, files, Paths };
}
test('new photo references survive container changes without deleting or overwriting photos', async () => {
  const h = harness(); h.files.set('file:///picker.jpg', [1, 2, 3]);
  const ref = await h.persistPhoto('file:///picker.jpg', A, 'client-1');
  assert.equal(ref, `loads-photo:v1/post-photos/${A}/client-1.jpg`);
  h.files.set('file:///picker.jpg', [9]);
  assert.equal(await h.persistPhoto('file:///picker.jpg', A, 'client-1'), ref);
  const path = `/post-photos/${A}/client-1.jpg`;
  h.files.set('file:///new/Documents' + path, h.files.get('file:///old/Documents' + path));
  h.Paths.document = 'file:///new/Documents';
  assert.deepEqual([...new Uint8Array(await h.photoBytes(ref, A, 'client-1'))], [1, 2, 3]);
  assert.ok(h.files.has('file:///old/Documents' + path));
});
test('legacy iOS and Android references resolve in the current container and keep snapshots unchanged', async () => {
  for (const oldRoot of ['file:///old/Documents', 'file:///data/user/0/app/files']) {
    const h = harness(); h.Paths.document = 'file:///new/Documents';
    const suffix = `/post-photos/${A}/client-1.jpg`;
    h.files.set(h.Paths.document + suffix, [7]);
    const post = { id: 'client-1', caption: 'unchanged', photoUri: oldRoot + suffix };
    const original = JSON.stringify(post);
    assert.equal((await h.photoBytes(post.photoUri, A, post.id)).byteLength, 1);
    assert.equal(JSON.stringify(post), original);
  }
});
test('missing photo fails independently, with no fallback to stale files or changes to other photos', async () => {
  const h = harness(); const suffix = `/post-photos/${A}/client-1.jpg`;
  h.files.set('file:///old/Documents' + suffix, [1]); h.Paths.document = 'file:///new/Documents';
  h.files.set(h.Paths.document + `/post-photos/${A}/client-2.jpg`, [2]);
  await assert.rejects(h.photoBytes('file:///old/Documents' + suffix, A, 'client-1'), /saved photo is unavailable/);
  assert.equal((await h.photoBytes(`loads-photo:v1/post-photos/${A}/client-2.jpg`, A, 'client-2')).byteLength, 1);
  assert.equal(h.files.size, 2);
});
test('saved references reject other owners, other posts, traversal and unsupported versions', async () => {
  const h = harness();
  for (const uri of [`loads-photo:v1/post-photos/${B}/client-1.jpg`, `loads-photo:v1/post-photos/${A}/client-2.jpg`, `loads-photo:v2/post-photos/${A}/client-1.jpg`, 'file:///photo.jpg']) {
    await assert.rejects(h.photoBytes(uri, A, 'client-1'), /Invalid saved photo/);
  }
  await assert.rejects(h.persistPhoto('file:///picker.jpg', A, '../escape'), /Invalid saved photo/);
  await assert.rejects(h.photoBytes(`loads-photo:v1/post-photos/${A}/client-1.jpg`), /Invalid saved photo/);
});
test('fresh temporary image reads remain supported', async () => {
  const h = harness(); h.files.set('file:///cache/image.jpg', [3]);
  assert.equal((await h.photoBytes('file:///cache/image.jpg')).byteLength, 1);
});

test('actual upload reads an upgraded legacy photo and preserves its immutable cloud path', async () => {
  const h = harness(); h.Paths.document = 'file:///new/Documents';
  h.files.set(`${h.Paths.document}/post-photos/${A}/client-1.jpg`, [5, 6]);
  const calls = [];
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/lib/postPhotos.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const mocks = {
    'expo-image-manipulator': {}, 'react-native': { Platform: { OS: 'ios' } }, './postPhotoFiles': h,
    './supabase': { supabase: { storage: { from: bucket => ({ upload: async (path, bytes, options) => { calls.push({ bucket, path, bytes: [...new Uint8Array(bytes)], options }); return { error: null }; } }) } } },
  };
  new Function('require', 'module', 'exports', code)(name => mocks[name], module, module.exports);
  assert.equal(await module.exports.uploadPhoto(`file:///old/Documents/post-photos/${A}/client-1.jpg`, A, 'client-1'), `${A}/client-1.jpg`);
  assert.deepEqual(calls, [{ bucket: 'post-photos', path: `${A}/client-1.jpg`, bytes: [5, 6], options: { contentType: 'image/jpeg', upsert: false } }]);
  await assert.rejects(module.exports.uploadPhoto(`loads-photo:v1/post-photos/${B}/client-1.jpg`, A, 'client-1'), /Invalid saved photo/);
  assert.equal(calls.length, 1);
});
