export type Delivery = { id: string; token: string; kind: 'workout' | 'partner'; actorId: string; recipientId: string; postId: string | null; actorName: string };
type Client = { rpc: (name: string, args?: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }> };
type Ticket = { status: 'ok' | 'error'; id?: string; details?: { error?: string } };
export function pushMessage(delivery: Delivery) {
  return { to: delivery.token, title: 'LOADS', body: `${delivery.actorName} ${delivery.kind === 'workout' ? 'finished a workout.' : 'tagged you as a training partner.'}`, sound: 'default', channelId: 'workouts', data: { kind: delivery.kind, actorId: delivery.actorId, recipientId: delivery.recipientId, postId: delivery.postId } };
}
export async function processPushQueue(admin: Client, fetcher: typeof fetch = fetch, accessToken?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const receipts = await admin.rpc('pending_push_receipts');
  if (receipts.error) throw receipts.error;
  const waiting = receipts.data as { id: string; ticket: string }[];
  if (waiting.length) {
    try {
      const response = await fetcher('https://exp.host/--/api/v2/push/getReceipts', { method: 'POST', headers, body: JSON.stringify({ ids: waiting.map(row => row.ticket) }), signal: AbortSignal.timeout(15000) });
      if (response.ok) {
        const payload = await response.json();
        for (const row of waiting) {
          const receipt = payload.data?.[row.ticket] as Ticket | undefined;
          if (!receipt || !['ok','error'].includes(receipt.status)) continue;
          const result = await admin.rpc('finish_push_delivery', { p_id: row.id, p_state: receipt.status === 'ok' ? 'delivered' : 'failed', p_disable: receipt.details?.error === 'DeviceNotRegistered' });
          if (result.error) throw result.error;
        }
      }
    } catch { /* Receipt lookup is read-only and safe to retry on the next scheduled run. */ }
  }
  const claimed = await admin.rpc('claim_push_deliveries');
  if (claimed.error) throw claimed.error;
  const deliveries = claimed.data as Delivery[];
  if (!deliveries.length) return { attempted: 0 };
  let tickets: Ticket[] | null = null;
  try {
    const response = await fetcher('https://exp.host/--/api/v2/push/send', { method: 'POST', headers, body: JSON.stringify(deliveries.map(pushMessage)), signal: AbortSignal.timeout(15000) });
    if (response.ok) { const payload = await response.json(); if (Array.isArray(payload.data) && payload.data.length === deliveries.length) tickets = payload.data; }
  } catch { /* A lost response may already have delivered: never blindly resend. */ }
  for (const [index, delivery] of deliveries.entries()) {
    const ticket = tickets?.[index];
    const state = ticket?.status === 'ok' && ticket.id ? 'accepted' : ticket?.status === 'error' ? 'failed' : 'uncertain';
    const result = await admin.rpc('finish_push_delivery', { p_id: delivery.id, p_state: state, p_ticket: ticket?.id ?? null, p_disable: ticket?.details?.error === 'DeviceNotRegistered' });
    if (result.error) throw result.error;
  }
  return { attempted: deliveries.length };
}
