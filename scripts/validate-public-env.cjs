// Build-time checks only. Never print credentials or place private values in extra.
function validatePublicEnv(env, required = false) {
  const names = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_KEY', 'EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED'];
  for (const name of names) if (required && !env[name]) throw new Error(`Missing EAS environment variable: ${name}`);
  if (env.EXPO_PUBLIC_SUPABASE_URL) {
    const url = new URL(env.EXPO_PUBLIC_SUPABASE_URL);
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Supabase URL must use HTTPS without credentials.');
  }
  const key = env.EXPO_PUBLIC_SUPABASE_KEY;
  if (key && !key.startsWith('sb_publishable_')) {
    let role;
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role; } catch { /* reject below */ }
    if (role !== 'anon') throw new Error('Only a publishable or legacy anon Supabase key may be bundled.');
  }
  const flag = env.EXPO_PUBLIC_ACCOUNT_DELETION_ENABLED;
  if (flag && !['true', 'false'].includes(flag)) throw new Error('Account deletion flag must be true or false.');
}
module.exports = { validatePublicEnv };
