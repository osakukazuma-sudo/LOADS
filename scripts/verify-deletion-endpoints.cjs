const fs = require('node:fs');
const assert = require('node:assert/strict');
const { corsHeaders } = require('@supabase/supabase-js/cors');
const env = Object.fromEntries(fs.readFileSync('.env', 'utf8').split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => { const at = line.indexOf('='); return [line.slice(0, at), line.slice(at + 1).replace(/^["']|["']$/g, '')]; }));
async function main() {
  const base = env.EXPO_PUBLIC_SUPABASE_URL + '/functions/v1/';
  for (const [name, headers] of [
    ['delete-post', { apikey: env.EXPO_PUBLIC_SUPABASE_KEY }],
    ['delete-post', { apikey: env.EXPO_PUBLIC_SUPABASE_KEY, authorization: 'Bearer invalid-test-token' }],
    ['deletion-worker', {}],
    ['deletion-worker', { 'x-cleanup-secret': 'invalid-test-secret' }],
  ]) {
    const result = await fetch(base + name, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(result.status, 401, `${name} must reject unauthenticated/invalid credentials`);
    console.log(`${name}: invalid/missing credentials rejected (401)`);
  }
  const preflight = await fetch(base + 'delete-post', { method: 'OPTIONS', headers: { Origin: 'http://localhost:8081', 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': corsHeaders['Access-Control-Allow-Headers'] } });
  assert.equal(preflight.status, 200);
  assert.equal(preflight.headers.get('access-control-allow-origin'), '*');
  for (const name of corsHeaders['Access-Control-Allow-Headers'].split(', ')) assert.ok(preflight.headers.get('access-control-allow-headers').toLowerCase().split(', ').includes(name));
  console.log('delete-post: browser preflight passed');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
