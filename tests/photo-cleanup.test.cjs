const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function load() {
  const m = { exports: {} };
  new Function('module', 'exports', ts.transpileModule(fs.readFileSync('supabase/functions/_shared/photo-cleanup.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText)(m, m.exports);
  return m.exports;
}
test('Storage failure leaves a durable due job; a later invocation retries and retains reconciliation', async () => {
  const job = { photo_path: 'owner/post.jpg', attempts: 0, next_run_at: '2020-01-01', last_error: null };
  let fail = true; const removed = [];
  const builder = { select: () => builder, order: () => builder, limit: () => builder, lte: () => builder,
    then: resolve => Promise.resolve({ data: [{ ...job }], error: null }).then(resolve),
    update: value => ({ eq: async () => { Object.assign(job, value); return { error: null }; } }) };
  const admin = { from: () => builder, storage: { from: () => ({ remove: async paths => { removed.push(paths); return { error: fail ? Error('offline') : null }; } }) } };
  const { cleanupPhotos } = load();
  assert.equal((await cleanupPhotos(admin)).failed, 1);
  assert.equal(job.attempts, 1); assert.equal(job.last_error, 'Storage deletion failed');
  const firstDue = job.next_run_at;
  fail = false;
  assert.equal((await cleanupPhotos(admin)).failed, 0);
  assert.equal(job.attempts, 2); assert.equal(job.last_error, null);
  assert.ok(job.next_run_at > firstDue);
  assert.deepEqual(removed, [['owner/post.jpg'], ['owner/post.jpg']]);
});
