-- No rows, grants or policies are changed. Never returns user IDs/post contents.
begin read only;
select set_config('request.jwt.claim.sub', (select user_id::text from public.posts order by created_at desc limit 1), true);
set local role authenticated;
select jsonb_build_object(
 'visible_posts',(select count(*) from public.following_feed),
 'own_posts',(select count(*) from public.following_feed where user_id=auth.uid()),
 'followed_posts',(select count(*) from public.following_feed where user_id in(select following_id from public.follows where follower_id=auth.uid())),
 'tagged_posts',(select count(*) from public.following_feed where training_partner_ids @> array[auth.uid()]),
 'author_join_readable',(select count(*) from public.following_feed f join public.profiles p on p.id=f.user_id),
 'partner_join_readable',(select count(*) from public.following_feed f join public.post_partners p on p.post_id=f.id)
) as authenticated_feed;
commit;
