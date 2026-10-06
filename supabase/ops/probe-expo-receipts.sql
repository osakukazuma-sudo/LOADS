-- Empty receipt lookup only: does not send notifications or transmit user data.
select net.http_post(url:='https://exp.host/--/api/v2/push/getReceipts',
 headers:=jsonb_build_object('Content-Type','application/json'),
 body:=jsonb_build_object('ids','[]'::jsonb),timeout_milliseconds:=15000) as expo_probe_id;
