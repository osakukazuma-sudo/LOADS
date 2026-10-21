// Read-only: public-key GETs with limit=0. Never fetches rows or calls an RPC.
const fs = require('node:fs');
const path = require('node:path');
const probes = [
  ['posts', 'id'], ['following_feed', 'id'],
  ['workout_reactions', 'post_id,user_id,reaction_type,created_at,updated_at'],
  ['notification_preferences', 'user_id'], ['notification_preferences', 'reaction_enabled'],
];
function publicKeyRole(key) {
  if (key?.startsWith('sb_publishable_')) return 'publishable';
  try { if (JSON.parse(Buffer.from(key.split('.')[1], 'base64url')).role === 'anon') return 'anon'; } catch {}
  throw new Error('A public application key is required. No secret or service key is accepted.');
}
async function diagnose({ baseUrl, key, linkedRef, fetcher = fetch }) {
  const url = new URL(baseUrl);
  if (url.protocol !== 'https:' || url.username || url.password || !url.hostname.endsWith('.supabase.co')) throw new Error('Expected a hosted Supabase HTTPS URL.');
  const role = publicKeyRole(key);
  const projectRef = url.hostname.split('.')[0];
  const result = { environment: { host: url.hostname, keyRole: role, linkedProjectMatches: linkedRef ? projectRef === linkedRef : null }, probes: [] };
  for (const [table, select] of probes) {
    const endpoint = new URL(`/rest/v1/${table}`, url);
    endpoint.searchParams.set('select', select); endpoint.searchParams.set('limit', '0');
    try {
      const response = await fetcher(endpoint, { method: 'GET', headers: { apikey: key }, signal: AbortSignal.timeout(15000) });
      const body = await response.json().catch(() => null);
      const code = typeof body?.code === 'string' && /^(?:PGRST\d{3}|[0-9A-Z]{5})$/.test(body.code) ? body.code : null;
      result.probes.push({ table, select, status: response.status, code });
    } catch { result.probes.push({ table, select, status: null, code: 'NETWORK_ERROR' }); }
  }
  return result;
}
async function main() {
  // Same resolver/precedence as Expo. Prints neither env values nor response bodies.
  process.env.NODE_ENV ??= 'development';
  require('@expo/env').load(process.cwd(), { silent: true });
  const file = path.join('supabase', '.temp', 'linked-project.json');
  const linked = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  console.log(JSON.stringify(await diagnose({ baseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL, key: process.env.EXPO_PUBLIC_SUPABASE_KEY, linkedRef: linked?.ref }), null, 2));
}
if (require.main === module) main().catch(() => { console.error('Reaction diagnostic failed. Check local public configuration; no credentials were printed.'); process.exitCode = 1; });
module.exports = { diagnose };
