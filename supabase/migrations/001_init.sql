-- ============================================================================
-- GigRoom 001_init.sql — 初始 Schema
-- P10.0: Supabase 接入前数据库设计
--
-- 命名规则：snake_case 英文，表名 plural
-- 时间：UTC timestamptz，前端显示转 Asia/Shanghai
-- RLS：所有业务表从第一天打开
-- ============================================================================

-- ========================
-- Extensions
-- ========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ========================
-- 通用工具函数
-- ========================

-- 统一 updated_at 自动更新函数
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ========================
-- 1. profiles
-- ========================
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  avatar_url text,
  city text,
  bio text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- profiles RLS
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_insert_self" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_self" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- updated_at trigger
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================
-- 2. artists
-- ========================
CREATE TABLE public.artists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  cover_url text,
  city text,
  country text,
  genres text[] NOT NULL DEFAULT '{}',
  bio text,
  external_links jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "artists_public_read" ON public.artists
  FOR SELECT TO anon, authenticated USING (true);

-- ========================
-- 3. venues
-- ========================
CREATE TABLE public.venues (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  city text NOT NULL,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "venues_public_read" ON public.venues
  FOR SELECT TO anon, authenticated USING (true);

-- ========================
-- 4. shows
-- ========================
CREATE TABLE public.shows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  title text,
  venue_id uuid REFERENCES public.venues(id) ON DELETE SET NULL,
  city text NOT NULL,
  date_time timestamptz NOT NULL,
  poster_url text,
  price_presale numeric,
  price_door numeric,
  price_text text,
  ticket_platform text,
  ticket_url text,
  ticket_status text CHECK (ticket_status IN ('coming_soon', 'on_sale', 'sold_out')),
  status text NOT NULL CHECK (status IN ('upcoming', 'ended', 'cancelled', 'postponed')),
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shows_public_read" ON public.shows
  FOR SELECT TO anon, authenticated USING (true);

-- updated_at trigger
CREATE TRIGGER set_updated_at_shows
  BEFORE UPDATE ON public.shows
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================
-- 5. show_artists
-- ========================
CREATE TABLE public.show_artists (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('headliner', 'support', 'guest')),
  billing_order integer NOT NULL DEFAULT 1,
  UNIQUE (show_id, artist_id)
);

ALTER TABLE public.show_artists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "show_artists_public_read" ON public.show_artists
  FOR SELECT TO anon, authenticated USING (true);

-- ========================
-- 6. show_rooms
-- ========================
CREATE TABLE public.show_rooms (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id uuid NOT NULL UNIQUE REFERENCES public.shows(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.show_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "show_rooms_public_read" ON public.show_rooms
  FOR SELECT TO anon, authenticated USING (true);

-- ========================
-- Show → ShowRoom 自动创建 trigger
-- ========================
CREATE OR REPLACE FUNCTION public.handle_new_show()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.show_rooms (show_id)
  VALUES (NEW.id)
  ON CONFLICT (show_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_show_create_room
  AFTER INSERT ON public.shows
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_show();

-- ========================
-- 7. room_memberships
-- ========================
CREATE TABLE public.room_memberships (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.show_rooms(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, room_id)
);

ALTER TABLE public.room_memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memberships_select_own" ON public.room_memberships
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "memberships_insert_own" ON public.room_memberships
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "memberships_delete_own" ON public.room_memberships
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========================
-- 8. user_artist_follows
-- ========================
CREATE TABLE public.user_artist_follows (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id uuid NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, artist_id)
);

ALTER TABLE public.user_artist_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_select_own" ON public.user_artist_follows
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "follows_insert_own" ON public.user_artist_follows
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "follows_delete_own" ON public.user_artist_follows
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========================
-- 9. user_show_statuses
-- ========================
CREATE TABLE public.user_show_statuses (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('interested', 'going', 'attended')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, show_id)
);

ALTER TABLE public.user_show_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "show_statuses_select_own" ON public.user_show_statuses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "show_statuses_insert_own" ON public.user_show_statuses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "show_statuses_update_own" ON public.user_show_statuses
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "show_statuses_delete_own" ON public.user_show_statuses
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER set_updated_at_user_show_statuses
  BEFORE UPDATE ON public.user_show_statuses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================
-- 10. discussion_messages
-- ========================
CREATE TABLE public.discussion_messages (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id uuid NOT NULL REFERENCES public.show_rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  reply_to_id uuid REFERENCES public.discussion_messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discussion_messages ENABLE ROW LEVEL SECURITY;

-- 公共 SELECT（未登录可浏览）
CREATE POLICY "discussion_select_public" ON public.discussion_messages
  FOR SELECT TO anon, authenticated USING (true);

-- INSERT：需 authenticated + 本人 + 是该 Room 成员
CREATE POLICY "discussion_insert_member" ON public.discussion_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.room_memberships rm
      WHERE rm.user_id = auth.uid()
        AND rm.room_id = discussion_messages.room_id
    )
  );

-- UPDATE / DELETE：仅作者
CREATE POLICY "discussion_update_author" ON public.discussion_messages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "discussion_delete_author" ON public.discussion_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========================
-- 12. buddy_posts
-- ========================
CREATE TABLE public.buddy_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buddy_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buddy_posts_select_public" ON public.buddy_posts
  FOR SELECT TO anon, authenticated USING (true);

-- INSERT：需 authenticated + 本人 + 通过 show → room 验证 membership
CREATE POLICY "buddy_posts_insert_member" ON public.buddy_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.show_rooms sr
      JOIN public.room_memberships rm ON rm.room_id = sr.id
      WHERE sr.show_id = buddy_posts.show_id
        AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "buddy_posts_update_author" ON public.buddy_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "buddy_posts_delete_author" ON public.buddy_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========================
-- 13. buddy_post_comments
-- ========================
CREATE TABLE public.buddy_post_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  buddy_post_id uuid NOT NULL REFERENCES public.buddy_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.buddy_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "buddy_comments_select_public" ON public.buddy_post_comments
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "buddy_comments_insert_member" ON public.buddy_post_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.buddy_posts bp
      JOIN public.show_rooms sr ON sr.show_id = bp.show_id
      JOIN public.room_memberships rm ON rm.room_id = sr.id
      WHERE bp.id = buddy_post_comments.buddy_post_id
        AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "buddy_comments_update_author" ON public.buddy_post_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "buddy_comments_delete_author" ON public.buddy_post_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========================
-- 14. ticket_posts
-- ========================
CREATE TABLE public.ticket_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('selling', 'buying')),
  quantity integer NOT NULL CHECK (quantity > 0),
  face_value numeric CHECK (face_value IS NULL OR face_value >= 0),
  price numeric CHECK (price IS NULL OR price >= 0),
  note text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_posts_select_public" ON public.ticket_posts
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "ticket_posts_insert_member" ON public.ticket_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.show_rooms sr
      JOIN public.room_memberships rm ON rm.room_id = sr.id
      WHERE sr.show_id = ticket_posts.show_id
        AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "ticket_posts_update_author" ON public.ticket_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ticket_posts_delete_author" ON public.ticket_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- updated_at trigger
CREATE TRIGGER set_updated_at_ticket_posts
  BEFORE UPDATE ON public.ticket_posts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================
-- 15. ticket_post_comments
-- ========================
CREATE TABLE public.ticket_post_comments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_post_id uuid NOT NULL REFERENCES public.ticket_posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_comments_select_public" ON public.ticket_post_comments
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "ticket_comments_insert_member" ON public.ticket_post_comments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.ticket_posts tp
      JOIN public.show_rooms sr ON sr.show_id = tp.show_id
      JOIN public.room_memberships rm ON rm.room_id = sr.id
      WHERE tp.id = ticket_post_comments.ticket_post_id
        AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "ticket_comments_update_author" ON public.ticket_post_comments
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ticket_comments_delete_author" ON public.ticket_post_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========================
-- 16. live_posts
-- ========================
CREATE TABLE public.live_posts (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  show_id uuid NOT NULL REFERENCES public.shows(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text,
  image_urls text[] NOT NULL DEFAULT '{}',
  video_url text,
  video_platform text CHECK (video_platform IN ('bilibili', 'xiaohongshu', 'douyin', 'youtube')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.live_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "live_posts_select_public" ON public.live_posts
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "live_posts_insert_member" ON public.live_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.show_rooms sr
      JOIN public.room_memberships rm ON rm.room_id = sr.id
      WHERE sr.show_id = live_posts.show_id
        AND rm.user_id = auth.uid()
    )
  );

CREATE POLICY "live_posts_update_author" ON public.live_posts
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "live_posts_delete_author" ON public.live_posts
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ========================
-- 17. notifications
-- ========================
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('new_show', 'attended_check', 'discussion_reply', 'buddy_reply', 'buddy_interaction', 'ticket_favorite', 'ticket_message', 'live_interaction')),
  title text NOT NULL,
  related_show_id uuid REFERENCES public.shows(id) ON DELETE CASCADE,
  related_content_id text,
  from_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_url text,
  is_content_deleted boolean NOT NULL DEFAULT false,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 用户只能 SELECT 自己的通知
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 用户只能 UPDATE is_read 自己的通知
CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ⚠️ 没有 INSERT policy for authenticated/anon
-- 通知生成由 server/service role 完成，普通客户端无法伪造

-- 防重复：partial unique indexes
-- new_show: 同一用户 + 同一 show 不重复
CREATE UNIQUE INDEX notifications_new_show_unique
  ON public.notifications (user_id, related_show_id)
  WHERE type = 'new_show' AND related_show_id IS NOT NULL;

-- attended_check: 同一用户 + 同一 show 不重复
CREATE UNIQUE INDEX notifications_attended_check_unique
  ON public.notifications (user_id, related_show_id)
  WHERE type = 'attended_check' AND related_show_id IS NOT NULL;

-- ========================
-- 18. reports
-- ========================
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN (
    'discussion_message', 'buddy_post', 'ticket_post', 'live_post',
    'buddy_comment', 'ticket_comment'
  )),
  target_id uuid NOT NULL,
  reason text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- 用户只能 INSERT 自己的举报
CREATE POLICY "reports_insert_own" ON public.reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);

-- 普通用户不能 SELECT 全部 reports（管理员通过 service role 查看）
-- 不创建 SELECT policy → 默认拒绝

-- ========================
-- Auth → Profile 自动创建 trigger
-- ========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, onboarding_completed)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', '新乐迷'),
    false
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auth_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================
-- 索引
-- ========================

-- artists
CREATE INDEX idx_artists_name ON public.artists (name);
CREATE INDEX idx_artists_city ON public.artists (city);

-- shows
CREATE INDEX idx_shows_date_time ON public.shows (date_time);
CREATE INDEX idx_shows_city ON public.shows (city);
CREATE INDEX idx_shows_status ON public.shows (status);

-- show_artists
CREATE INDEX idx_show_artists_show_id ON public.show_artists (show_id);
CREATE INDEX idx_show_artists_artist_id ON public.show_artists (artist_id);

-- room_memberships
CREATE INDEX idx_room_memberships_user_id ON public.room_memberships (user_id);
CREATE INDEX idx_room_memberships_room_id ON public.room_memberships (room_id);

-- user_artist_follows
CREATE INDEX idx_user_artist_follows_user_id ON public.user_artist_follows (user_id);
CREATE INDEX idx_user_artist_follows_artist_id ON public.user_artist_follows (artist_id);

-- user_show_statuses
CREATE INDEX idx_user_show_statuses_user_id ON public.user_show_statuses (user_id);
CREATE INDEX idx_user_show_statuses_show_id ON public.user_show_statuses (show_id);

-- discussion_messages
CREATE INDEX idx_discussion_messages_room_created ON public.discussion_messages (room_id, created_at);

-- buddy_posts
CREATE INDEX idx_buddy_posts_show_created ON public.buddy_posts (show_id, created_at);

-- ticket_posts
CREATE INDEX idx_ticket_posts_show_created ON public.ticket_posts (show_id, created_at);

-- live_posts
CREATE INDEX idx_live_posts_show_created ON public.live_posts (show_id, created_at);

-- notifications
CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at);
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, is_read);

-- reports
CREATE INDEX idx_reports_reporter_id ON public.reports (reporter_id);
CREATE INDEX idx_reports_target ON public.reports (target_type, target_id);
