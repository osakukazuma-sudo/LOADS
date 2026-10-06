const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const diagnosticsModule = { exports: {} };
new Function('module', 'exports', ts.transpileModule(fs.readFileSync('src/lib/deletionDiagnostics.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(diagnosticsModule, diagnosticsModule.exports);
function harness() {
  let owner = 'a', failure = false; const events = [];
  const entry = { userId: 'a', post: { id: 'client' }, status: 'published' };
  const mocks = {
    './deletionDiagnostics': diagnosticsModule.exports,
    './accountActivity': { beginAccountOperation: () => () => events.push('released') },
    './cloudPosts': { currentUserId: async () => owner },
    './postOutbox': { getLocalPosts: async () => [entry], saveLocalPost: async e => events.push(e.status) },
    './supabase': { supabase: { functions: { invoke: async (_name, args) => { events.push(args); return failure ? { error: Error('offline') } : { data: { deleted: true, photoCleanupPending: true } }; } } } },
    '@supabase/supabase-js': { FunctionsHttpError: class extends Error {} },
  };
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/lib/postDeletion.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', '__DEV__', code)(name => mocks[name], m, m.exports, false);
  return { events, remove: () => m.exports.deleteOwnPost({ id: 'cloud', userId: 'a', clientPostId: 'client' }), other: () => { owner = 'b'; }, fail: flag => { failure = flag; } };
}
test('deletion client rejects another owner before invoking the server', async () => {
  const h = harness(); h.other();
  await assert.rejects(h.remove(), /Only the owner/);
  assert.deepEqual(h.events, ['released']);
});

test('diagnostics retain fetch and HTTP details without response headers or payloads', () => {
  const diagnostic = diagnosticsModule.exports.deletionFailureDiagnostic;
  const fetchError = { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function', context: new TypeError('Failed to fetch') };
  const result = diagnostic(fetchError, Date.now() - 10);
  assert.equal(result.name, 'FunctionsFetchError');
  assert.equal(result.context.name, 'TypeError');
  assert.equal(result.context.message, 'Failed to fetch');
  assert.equal(result.status, null);
  assert.ok(Number.isFinite(Date.parse(result.occurredAt)));
  assert.ok(result.elapsedMs >= 10);
  const http = diagnostic({ name: 'FunctionsHttpError', message: 'HTTP failure', context: new Response('private-body', { status: 503, headers: { authorization: 'private-token' } }) }, Date.now());
  assert.equal(http.status, 503);
  assert.equal(JSON.stringify(http).includes('private-'), false);
  const redacted = diagnostic({ message: 'Bearer secret https://example.test/?token=secret', context: { headers: 'secret', body: 'secret' } }, Date.now());
  assert.equal(JSON.stringify(redacted).includes('secret'), false);
});
test('failed deletion preserves local entry; retry retires it only after server confirmation', async () => {
  const h = harness(); h.fail(true);
  await assert.rejects(h.remove(), /Could not confirm/);
  assert.equal(h.events.includes('deleted'), false);
  h.fail(false); assert.equal((await h.remove()).photoCleanupPending, true);
  assert.equal(h.events.includes('deleted'), true);
  assert.deepEqual(h.events[0], { body: { postId: 'cloud' } });
});
