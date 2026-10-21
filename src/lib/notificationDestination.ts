const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Notification data is untrusted. Routes are fixed; the destination must fetch
// the post again under the signed-in user's RLS, including on cold start.
export function notificationDestination(owner: string, value: unknown) {
  if (!owner || !value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  if (data.recipientId !== owner) return null;
  if (data.kind === 'reaction' && typeof data.postId === 'string' && uuid.test(data.postId)) {
    return { pathname: '/workout-post' as const, params: { id: data.postId } };
  }
  if (data.kind === 'partner') return '/tagged' as const;
  if (data.kind === 'workout' && typeof data.actorId === 'string' && uuid.test(data.actorId)) {
    return { pathname: '/athlete' as const, params: { id: data.actorId } };
  }
  return null;
}
