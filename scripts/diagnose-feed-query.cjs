// Read-only REST schema diagnostic; prints no keys, sessions or post content.
process.loadEnvFile();
async function main() {
  for (const select of [
    '*, profiles(username, display_name), post_partners(user_id, username)',
    '*, profiles!posts_user_id_fkey(username, display_name), post_partners!post_partners_post_id_fkey(user_id, username)',
  ]) {
    const url = new URL('/rest/v1/following_feed', process.env.EXPO_PUBLIC_SUPABASE_URL);
    url.searchParams.set('select', select);
    url.searchParams.set('limit', '0');
    const response = await fetch(url, { headers: { apikey: process.env.EXPO_PUBLIC_SUPABASE_KEY } });
    const body = await response.json();
    console.log(JSON.stringify({ select, status: response.status, code: body.code, message: body.message, details: body.details, hint: body.hint }));
  }
}
main().catch(e => { console.error(e.message); process.exitCode=1; });
