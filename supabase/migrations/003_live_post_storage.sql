-- 003_live_post_storage.sql
-- 现场帖图片存储：live-posts bucket + storage.objects RLS
--
-- 背景：live_posts.image_urls 此前存的是 blob: 临时 URL（刷新即破图），
-- 前端已改为先上传 Supabase Storage 再存公开 URL（src/lib/supabase/storage.ts）。
-- 本迁移创建所需 bucket 与访问策略。
--
-- 执行方式：Supabase Dashboard → SQL Editor（需 postgres 角色）
-- 幂等：可重复执行

-- 1. 创建公开 bucket（10MB 上限，仅图片类型）
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'live-posts',
  'live-posts',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- 2. 公开读（公开 bucket 的 /object/public/ 路径不走 RLS，此策略供列出/受控读取）
drop policy if exists "live_posts_public_read" on storage.objects;
create policy "live_posts_public_read" on storage.objects
  for select
  using (bucket_id = 'live-posts');

-- 3. 登录用户可上传，仅限本人目录：${auth.uid()}/xxx
drop policy if exists "live_posts_insert_own" on storage.objects;
create policy "live_posts_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'live-posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. 作者可删除自己上传的图片
drop policy if exists "live_posts_delete_own" on storage.objects;
create policy "live_posts_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'live-posts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
