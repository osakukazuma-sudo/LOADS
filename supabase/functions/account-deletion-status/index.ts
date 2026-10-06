import { adminClient, headers, json } from '../_shared/runtime.ts';
import { receiptHash } from '../_shared/account-receipt.ts';

// Status-only capability: rate-limit metadata changes, deletion jobs never do.
export async function handleAccountStatus(req: Request) {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  try {
    const { receipt } = await req.json();
    if (typeof receipt !== 'string' || !/^[a-f0-9]{64}$/.test(receipt)) return json({ error: 'RECEIPT_UNAVAILABLE' }, 404);
    const result = await adminClient().rpc('account_deletion_status', { receipt_hash: await receiptHash(receipt) });
    if (result.error) return json({ error: 'STATUS_UNAVAILABLE' }, 503);
    if (!result.data) return json({ error: 'RECEIPT_UNAVAILABLE' }, 404);
    if (result.data.retry_after) return Response.json({ error: 'RATE_LIMITED' }, {
      status: 429, headers: { ...headers, 'Retry-After': String(result.data.retry_after), 'Access-Control-Expose-Headers': 'Retry-After', 'Cache-Control': 'no-store' },
    });
    return json({ status: result.data.status, completed_at: result.data.completed_at, failure_code: result.data.failure_code });
  } catch { return json({ error: 'STATUS_UNAVAILABLE' }, 503); }
}
Deno.serve(handleAccountStatus);
