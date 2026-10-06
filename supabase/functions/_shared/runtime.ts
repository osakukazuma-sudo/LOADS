import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import { corsHeaders } from 'npm:@supabase/supabase-js@2.117.1/cors';

export const headers = { ...corsHeaders, 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
export function json(body: unknown, status = 200) { return Response.json(body, { status, headers }); }
export function adminClient() {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function authenticatedUser(req: Request, admin: ReturnType<typeof adminClient>) {
  const token = req.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) throw new Error('UNAUTHORIZED');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new Error('UNAUTHORIZED');
  return { user: data.user, token };
}
