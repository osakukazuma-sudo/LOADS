-- PUBLIC TEMPLATE: replace project/request placeholders for your own environment.
-- Apply after deploying push-worker. Uses the existing private worker credential.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
select cron.schedule('loads-push-delivery', '* * * * *', $job$
  select net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/push-worker',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cleanup-secret',
      (select token from loads_private.cleanup_credentials where singleton)),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
$job$);
