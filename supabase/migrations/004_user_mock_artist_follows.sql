-- ============================================================
-- 004: user_mock_artist_follows
--
-- V1 HR Demo：真实 Supabase Auth 用户关注「仓库内 Mock 乐队」（字符串 ID，
-- 如 artist-1）的云端持久化。Mock 乐队不在 public.artists 表中，因此
-- artist_id 使用 text，且不建外键到 artists。
--
-- 幂等：可重复执行（IF NOT EXISTS / DROP POLICY IF EXISTS），不覆盖数据。
-- ============================================================

-- 执行前人工检查（只读，不修改数据）：
--   SELECT to_regclass('public.user_mock_artist_follows');
-- 返回 NULL 表示表不存在，可安全执行本脚本；返回表名则本表已存在，
-- 脚本中所有语句均为 IF NOT EXISTS / 幂等策略，不会覆盖现有数据。

CREATE TABLE IF NOT EXISTS public.user_mock_artist_follows (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_mock_artist_follows_pkey PRIMARY KEY (user_id, artist_id)
);

ALTER TABLE public.user_mock_artist_follows ENABLE ROW LEVEL SECURITY;

-- RLS：仅本人可读写自己的关注关系（authenticated）
DROP POLICY IF EXISTS "mock_follows_select_own" ON public.user_mock_artist_follows;
CREATE POLICY "mock_follows_select_own" ON public.user_mock_artist_follows
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "mock_follows_insert_own" ON public.user_mock_artist_follows;
CREATE POLICY "mock_follows_insert_own" ON public.user_mock_artist_follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "mock_follows_delete_own" ON public.user_mock_artist_follows;
CREATE POLICY "mock_follows_delete_own" ON public.user_mock_artist_follows
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
