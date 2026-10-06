const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

function load(lookups, result, thrown) {
  const calls = [];
  const query = {
    select(value) { calls.push(['select', value]); return query; },
    eq(column, value) { calls.push(['eq', column, value]); return query; },
    limit() { return query; },
    async maybeSingle() { const next = lookups.shift(); if (next instanceof Error) throw next; return next; },
  };
  const supabase = {
    from(table) { assert.equal(table, 'profiles'); return query; },
    auth: { async signUp(input) { calls.push(['signUp', input]); if (thrown) throw thrown; return result; } },
  };
  const m = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync('src/lib/signup.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function('require', 'module', 'exports', code)(() => ({ supabase }), m, m.exports);
  return { create: m.exports.createAccount, calls };
}
const input = { username: ' New_User ', displayName: ' Alice ', email: ' A@EXAMPLE.COM ', password: 'secret', emailRedirectTo: 'loads://auth/callback' };
const free = { data: null, error: null };
const taken = { data: { username: 'new_user' }, error: null };

test('unused username preserves signup metadata, redirect, session and email confirmation results', async () => {
  for (const session of [null, { access_token: 'token' }]) {
    const data = { session, user: { id: 'new' } };
    const { create, calls } = load([free], { data, error: null });
    assert.deepEqual(await create(input), { data, error: null });
    assert.deepEqual(calls.at(-1), ['signUp', { email: 'a@example.com', password: 'secret', options: {
      emailRedirectTo: input.emailRedirectTo, data: { username: 'new_user', display_name: 'Alice' },
    } }]);
    assert.deepEqual(calls[1], ['eq', 'username', 'new_user']);
  }
  const { create, calls } = load([free], { data: {}, error: null });
  await create({ ...input, displayName: ' ' });
  assert.equal(calls.at(-1)[1].options.data.display_name, 'new_user');
});

test('taken username stops before calling Auth', async () => {
  const { create, calls } = load([taken]);
  assert.equal((await create(input)).error.message, 'This username is already taken.');
  assert.equal(calls.some(c => c[0] === 'signUp'), false);
});

test('concurrent username collision hidden by Auth is checked again after failure', async () => {
  const { create } = load([free, taken], { data: null, error: { code: 'unexpected_failure', message: 'Database error saving new user' } });
  assert.equal((await create(input)).error.message, 'This username is already taken.');
});

test('explicit username unique constraint is handled without a second lookup', async () => {
  const { create } = load([free], { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "profiles_username_key"' } });
  assert.equal((await create(input)).error.message, 'This username is already taken.');
});

test('unrelated DB failures and failed rechecks never expose database details or claim a collision', async () => {
  for (const lookup of [free, { data: null, error: { message: 'permission denied' } }, new Error('offline')]) {
    const { create } = load([free, lookup], { data: null, error: { message: 'Database error saving new user' } });
    assert.equal((await create(input)).error.message, 'Could not create account. Please try again later.');
  }
});

test('lookup failure still delegates to the DB constraint and Auth', async () => {
  for (const lookup of [{ data: null, error: { message: 'unavailable' } }, new Error('offline')]) {
    const { create } = load([lookup, taken], { data: null, error: { message: 'Database error saving new user' } });
    assert.equal((await create(input)).error.message, 'This username is already taken.');
  }
});

test('duplicate email, weak password, rate limit and other Auth errors remain intact', async () => {
  for (const code of ['email_exists', 'user_already_exists', 'weak_password', 'over_email_send_rate_limit']) {
    const { create } = load([free], { data: null, error: { code, message: code } });
    assert.equal((await create(input)).error.message, code);
  }
  const { create } = load([free], null, new Error('offline'));
  await assert.rejects(create(input), /offline/);
});
