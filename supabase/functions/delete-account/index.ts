import { adminClient, authenticatedUser, headers, json } from '../_shared/runtime.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.117.1';
import { receiptHash } from '../_shared/account-receipt.ts';

export async function handleAccountDeletion(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const admin = adminClient();
    const { user, token } = await authenticatedUser(req, admin);
    const body = await req.json();
    if (body.action === 'cancel' && /^[a-f0-9]{64}$/.test(body.receipt ?? '')) {
      const cancelled = await admin.rpc('cancel_unstarted_account_deletion', { actor: user.id, receipt_hash: await receiptHash(body.receipt) });
      return cancelled.error ? json({ error: 'CANNOT_CANCEL' }, 409) : json({ cancelled: true });
    }
    if (body.action === 'prepare') {
      const receipt = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
      const result = await admin.rpc('prepare_account_receipt', { actor: user.id, receipt_hash: await receiptHash(receipt) });
      if (result.error) return json({ error: 'PREPARE_FAILED' }, 503);
      return json({ receipt });
    }
    if (body.action !== 'request' || typeof body.password !== 'string' || !body.password || body.password.length > 1024 || !user.email || !/^[a-f0-9]{64}$/.test(body.receipt ?? '')) return json({ error: 'INVALID_REQUEST' }, 400);
    // Separate non-persistent client: do not replace the caller's session or trust metadata.
    const verifier = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const verified = await verifier.auth.signInWithPassword({ email: user.email, password: body.password });
    if (verified.error || verified.data.user?.id !== user.id) {
      if (verified.data.session) await verifier.auth.signOut({ scope: 'local' });
      return json({ error: 'REAUTHENTICATION_FAILED' }, 401);
    }
    try {
      const accepted = await admin.rpc('accept_account_deletion', { actor: user.id, receipt_hash: await receiptHash(body.receipt) });
      if (accepted.error) return json({ error: 'ACCEPT_FAILED' }, 503);
      // Durable freeze already exists. Revoke sessions; old JWT writes are denied by DB helper.
      await admin.auth.admin.signOut(token, 'global');
      return json({ accepted: true });
    } finally { await verifier.auth.signOut({ scope: 'local' }); }
  } catch (error) {
    if (error instanceof Error && error.message === 'UNAUTHORIZED') return json({ error: 'UNAUTHORIZED' }, 401);
    return json({ error: 'REQUEST_FAILED' }, 503);
  }
}
Deno.serve(handleAccountDeletion);
