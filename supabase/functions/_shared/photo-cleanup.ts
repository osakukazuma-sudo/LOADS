import type { adminClient } from './runtime.ts';

export async function cleanupPhotos(admin: ReturnType<typeof adminClient>, path?: string) {
  let query = admin.from('photo_cleanup_jobs').select('photo_path,attempts').order('next_run_at').limit(50);
  query = path ? query.eq('photo_path', path) : query.lte('next_run_at', new Date().toISOString());
  const { data, error } = await query;
  if (error) throw error;
  let failed = 0;
  for (const job of data ?? []) {
    const result = await admin.storage.from('post-photos').remove([job.photo_path]);
    if (result.error) failed++;
    const update = await admin.from('photo_cleanup_jobs').update({
      attempts: job.attempts + 1,
      last_error: result.error ? 'Storage deletion failed' : null,
      next_run_at: new Date(Date.now() + (result.error ? 60_000 : 86_400_000)).toISOString(),
    }).eq('photo_path', job.photo_path);
    if (update.error) throw update.error;
  }
  return { processed: data?.length ?? 0, failed };
}
