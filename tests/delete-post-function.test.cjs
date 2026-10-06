const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function harness({ unauthorized = false, missing = false, storageFails = false } = {}) {
  const calls = [];
  const admin = { rpc: async (name, args) => { calls.push({ name, args }); return missing ? { error: { message: 'POST_NOT_FOUND' } } : { data: { deleted: true, client_post_id: 'client-1' } }; } };
  const runtime = {
    headers: {}, json: (body, status = 200) => Response.json(body, { status }), adminClient: () => admin,
    authenticatedUser: async () => { if (unauthorized) throw Error('UNAUTHORIZED'); return { user: { id: 'verified-owner' } }; },
  };
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('supabase/functions/delete-post/index.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', 'Deno', code)(name => name.includes('runtime') ? runtime : { cleanupPhotos: async () => { if (storageFails) throw Error('storage offline'); return { failed: 0 }; } }, m, m.exports, { serve: () => {} });
  return { calls, handle: m.exports.handle };
}
const request = () => new Request('https://example.test/delete-post', { method: 'POST', body: JSON.stringify({ postId: '33333333-3333-4333-8333-333333333333', userId: 'forged-owner' }) });
test('delete endpoint uses verified actor, ignores body identity and commits despite failed photo removal', async () => {
  const h = harness({ storageFails: true });
  const response = await h.handle(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { deleted: true, photoCleanupPending: true });
  assert.equal(h.calls[0].args.actor, 'verified-owner');
});
test('unauthenticated callers and non-owner/missing posts cannot reach successful deletion', async () => {
  const unauth = harness({ unauthorized: true });
  assert.equal((await unauth.handle(request())).status, 401); assert.equal(unauth.calls.length, 0);
  const other = harness({ missing: true });
  assert.equal((await other.handle(request())).status, 404);
});
