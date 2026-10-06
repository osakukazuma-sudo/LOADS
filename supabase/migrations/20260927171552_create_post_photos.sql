begin;

alter table public.posts add constraint posts_photo_identity check (
  photo_path is null or (
    photo_path = user_id::text || '/' || client_post_id || '.jpg'
    and client_post_id ~ '^[a-zA-Z0-9_-]{1,100}$'
  )
);
revoke all on public.posts from public;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', false, 6291456, array['image/jpeg']);

-- Uploads are immutable. Retrying an identical path requires no UPDATE grant.
create policy post_photos_insert_own on storage.objects for insert to authenticated
with check (
  bucket_id = 'post-photos'
  and split_part(name, '/', 1) = (select auth.uid())::text
  and name ~ '^[0-9a-f-]{36}/[a-zA-Z0-9_-]{1,100}\.jpg$'
);

-- Unpublished uploads remain private to their owner.
create policy post_photos_read on storage.objects for select to authenticated
using (
  bucket_id = 'post-photos'
  and (
    split_part(name, '/', 1) = (select auth.uid())::text
    or exists (select 1 from public.posts where photo_path = storage.objects.name)
  )
);

create index posts_photo_path_idx on public.posts (photo_path) where photo_path is not null;
commit;
