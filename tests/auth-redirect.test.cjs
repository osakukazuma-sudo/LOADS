const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
function harness(base = 'loads://auth/callback') {
  const calls = [];
  let signedIn = false;
  let failure = false;
  const auth = {
    getSession: async () => ({ data: { session: signedIn ? { user: { id: 'existing' } } : null }, error: null }),
    exchangeCodeForSession: async code => { calls.push(['code', code]); return { data: { session: failure ? null : { user: { id: 'new' } } }, error: failure ? new Error('private SDK detail') : null }; },
    setSession: async tokens => { calls.push(['tokens', tokens]); return { data: { session: {} }, error: null }; },
  };
  const mod = { exports: {} };
  const js = ts.transpileModule(fs.readFileSync('src/lib/authRedirect.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', js)(name => name === 'expo-linking' ? { createURL: (path, options) => { assert.equal(path, 'auth/callback'); assert.equal(options.scheme, 'loads'); return base; } } : { supabase: { auth } }, mod, mod.exports);
  return { api: mod.exports, calls, signedIn: () => { signedIn = true; }, fail: () => { failure = true; } };
}
test('callback exchanges a PKCE code once across duplicate delivery/remount', async () => {
  assert.equal(harness('loads://192.168.1.5:8081/auth/callback').api.authRedirectUrl(), 'loads://auth/callback');
  const h = harness(); const url = h.api.authRedirectUrl() + '?code=one-use';
  await Promise.all([h.api.completeAuthRedirect(url), h.api.completeAuthRedirect(url)]);
  await h.api.completeAuthRedirect(url);
  assert.deepEqual(h.calls, [['code', 'one-use']]);
});
test('callback screen waits for session completion, navigates HOME and ignores unmounted work', async () => {
  for (const unmount of [false, true]) {
    let effect, resolve; const routes = [];
    const work = new Promise(r => { resolve = r; });
    const mocks = {
      react: { useEffect: fn => { effect = fn; }, useState: v => [v, () => {}] },
      'react/jsx-runtime': require('react/jsx-runtime'),
      'react-native': { View: 'View', Text: 'Text', Pressable: 'Pressable' },
      'expo-linking': { useLinkingURL: () => 'loads://auth/callback?code=x' },
      'expo-router': { useRouter: () => ({ replace: p => routes.push(p) }) },
      '../../lib/authRedirect': { completeAuthRedirect: () => work },
    };
    const mod = { exports: {} };
    const js = ts.transpileModule(fs.readFileSync('src/app/auth/callback.tsx', 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
    new Function('require','module','exports',js)(n => mocks[n],mod,mod.exports);
    const root = mod.exports.default(); root.type(root.props); const cleanup = effect();
    assert.deepEqual(routes, []); if (unmount) cleanup(); resolve(); await new Promise(r => setImmediate(r));
    assert.deepEqual(routes, unmount ? [] : ['/']);
  }
});
test('callback handles Expo Go and web destinations, and legacy token fragments', async () => {
  for (const base of ['exp://192.168.1.5:8081/--/auth/callback', 'http://localhost:8081/auth/callback']) {
    const h = harness(base); await h.api.completeAuthRedirect(base + '?code=abc'); assert.equal(h.calls.length, 1);
  }
  const h = harness(); await h.api.completeAuthRedirect('loads://auth/callback#access_token=access&refresh_token=refresh');
  assert.deepEqual(h.calls, [['tokens', { access_token: 'access', refresh_token: 'refresh' }]]);
});
test('callback rejects wrong destinations, incomplete/ambiguous payloads and expired links', async () => {
  const h = harness();
  for (const url of ['https://evil.test/auth/callback?code=x', 'loads://other?code=x', 'loads://auth/callback', 'loads://auth/callback#access_token=x', 'loads://auth/callback?code=x#access_token=y&refresh_token=z', 'loads://auth/callback?error=access_denied&error_description=SECRET']) {
    await assert.rejects(h.api.completeAuthRedirect(url), error => !error.message.includes('SECRET'));
  }
  assert.equal(h.calls.length, 0);
});
test('callback never silently replaces an existing account and sanitizes exchange errors', async () => {
  const h = harness(); h.signedIn(); await assert.rejects(h.api.completeAuthRedirect('loads://auth/callback?code=x'), /already signed in/); assert.equal(h.calls.length, 0);
  const failed = harness(); failed.fail(); await assert.rejects(failed.api.completeAuthRedirect('loads://auth/callback?code=x'), /device where you registered/);
});
test('signup, callback route and client connect redirect to PKCE without automatic URL handling', () => {
  assert.match(fs.readFileSync('src/app/signup.tsx', 'utf8'), /emailRedirectTo: authRedirectUrl\(\)/);
  const client = fs.readFileSync('src/lib/supabase.ts', 'utf8');
  assert.match(client, /flowType: 'pkce'/); assert.match(client, /detectSessionInUrl: false/);
  const layout = fs.readFileSync('src/app/_layout.tsx', 'utf8');
  assert.match(layout, /<\/Tabs.Protected>\s*<Tabs.Screen name="auth\/callback"/);
});
test('EAS rejects missing/private public environment values and accepts anon/publishable keys', () => {
  const { validatePublicEnv } = require('../scripts/validate-public-env.cjs');
  assert.throws(() => validatePublicEnv({}, true), /Missing/);
  const env = { EXPO_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED: 'true', EXPO_PUBLIC_SUPABASE_KEY: 'sb_publishable_test' };
  assert.doesNotThrow(() => validatePublicEnv(env, true));
  for (const key of ['sb_secret_test', 'bad', 'x.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.x']) assert.throws(() => validatePublicEnv({ ...env, EXPO_PUBLIC_SUPABASE_KEY: key }, true), /Only a publishable/);
  assert.doesNotThrow(() => validatePublicEnv({ ...env, EXPO_PUBLIC_SUPABASE_KEY: 'x.' + Buffer.from(JSON.stringify({ role: 'anon' })).toString('base64url') + '.x' }, true));
});
test('iOS release settings keep loads scheme, photo permissions and no microphone', () => {
  const config = require('../app.json').expo; const eas = require('../eas.json');
  assert.equal(config.scheme, 'loads'); assert.equal(config.name, 'LOADS');
  assert.equal(config.ios.bundleIdentifier, 'com.gyuta.loads');
  const picker = config.plugins.find(p => Array.isArray(p) && p[0] === 'expo-image-picker')[1];
  assert.equal(picker.microphonePermission, false); assert.ok(picker.photosPermission); assert.ok(picker.cameraPermission);
  assert.equal(eas.build.production.distribution, 'store'); assert.equal(eas.build.production.environment, 'production');
});
