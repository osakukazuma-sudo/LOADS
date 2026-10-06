-- PUBLIC TEMPLATE: replace project/request placeholders for your own environment.
-- Run after migrations and successful deployment of deletion-worker.
-- Dedicated credential is generated in the migration; no client or personal token is used.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('loads-deletion-cleanup', '* * * * *', $job$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/deletion-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cleanup-secret',
      (select token from loads_private.cleanup_credentials where singleton)),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
$job$);
