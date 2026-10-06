// Do not serialize Response bodies/headers, tokens, request data or arbitrary context fields.
function summary(value: unknown): Record<string, string | number> | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const result: Record<string, string | number> = {};
  for (const key of ['name', 'message', 'code', 'status', 'statusText', 'type']) {
    const item = source[key];
    if (typeof item === 'number') result[key] = item;
    if (typeof item === 'string') result[key] = item
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(/https?:\/\/[^\s]+/gi, '[url]')
      .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[token]')
      .slice(0, 500);
  }
  return result;
}

export function deletionFailureDiagnostic(error: unknown, startedAt: number) {
  const source = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const context = summary(source.context);
  const details = summary(error);
  return {
    event: 'post_deletion_failed',
    occurredAt: new Date().toISOString(),
    elapsedMs: Math.max(0, Date.now() - startedAt),
    name: details?.name ?? 'UnexpectedDeletionResponse',
    message: details?.message ?? 'Deletion response did not confirm success.',
    context,
    status: context?.status ?? details?.status ?? null,
  };
}
