-- ============================================================================
-- GigRoom seed.sql — 最小种子数据
-- P10.0: 仅准备少量公开数据（artists / venues / shows / show_artists / announcements）
-- 用户相关 seed 暂缓（需配合 Supabase Auth，P10.x 再处理）
--
-- 幂等：所有 INSERT 带 ON CONFLICT DO NOTHING，可安全重复执行。
-- ============================================================================

-- ========================
-- Venues
-- ========================
INSERT INTO public.venues (id, name, city, address) VALUES
  ('a0000000-0000-4000-8000-000000000001', 'MAO Livehouse 上海', '上海', '上海市重庆中路308号'),
  ('a0000000-0000-4000-8000-000000000002', '鼓楼东大街 Livehouse', '北京', '北京市东城区鼓楼东大街111号'),
  ('a0000000-0000-4000-8000-000000000003', 'VOX Livehouse', '武汉', '武汉市武昌区鲁巷'),
  ('a0000000-0000-4000-8000-000000000004', '小酒馆空间', '成都', '成都市武侯区'),
  ('a0000000-0000-4000-8000-000000000005', '太空间', '广州', '广州市海珠区')
ON CONFLICT (id) DO NOTHING;

-- ========================
-- Artists
-- ========================
INSERT INTO public.artists (id, name, city, country, genres, bio) VALUES
  ('b0000000-0000-4000-8000-000000000001', 'Chinese Football', '武汉', '中国', ARRAY['emo', 'indie rock'], '武汉 Emo 乐队'),
  ('b0000000-0000-4000-8000-000000000002', 'Carsick Cars', '北京', '中国', ARRAY['noise rock', 'experimental'], '北京独立摇滚'),
  ('b0000000-0000-4000-8000-000000000003', '惘闻', '大连', '中国', ARRAY['post-rock'], '中国后摇代表'),
  ('b0000000-0000-4000-8000-000000000004', '海朋森', '成都', '中国', ARRAY['post-punk'], '成都后朋克'),
  ('b0000000-0000-4000-8000-000000000005', '万能青年旅店', '石家庄', '中国', ARRAY['indie rock', 'folk rock'], '石家庄独立摇滚')
ON CONFLICT (id) DO NOTHING;

-- ========================
-- Shows
-- ========================
INSERT INTO public.shows (id, title, venue_id, city, date_time, poster_url, price_presale, price_door, price_text, ticket_platform, ticket_url, ticket_status, status, is_demo, created_at) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'Chinese Football 武汉专场（DEMO）', 'a0000000-0000-4000-8000-000000000003', '武汉', '2026-07-25T20:00:00+08:00', NULL, 80, 100, '预售80 / 现场100（DEMO票价）', '秀动', 'https://demo.example.com/show-1', 'sold_out', 'ended', true, '2026-06-01T00:00:00Z'),
  ('c0000000-0000-4000-8000-000000000002', 'Chinese Football 上海专场（DEMO）', 'a0000000-0000-4000-8000-000000000001', '上海', '2026-09-20T20:00:00+08:00', NULL, 100, 120, '预售100 / 现场120（DEMO票价）', '秀动', 'https://demo.example.com/show-4', 'on_sale', 'upcoming', true, '2026-07-01T00:00:00Z'),
  ('c0000000-0000-4000-8000-000000000003', 'Carsick Cars 北京专场（DEMO）', 'a0000000-0000-4000-8000-000000000002', '北京', '2026-08-02T21:00:00+08:00', NULL, 120, 150, '预售120 / 现场150（DEMO票价）', '正在现场', 'https://demo.example.com/show-3', 'sold_out', 'ended', true, '2026-06-10T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- ========================
-- show_artists
-- ========================
INSERT INTO public.show_artists (show_id, artist_id, role, billing_order) VALUES
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'headliner', 1),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'headliner', 1),
  ('c0000000-0000-4000-8000-000000000003', 'b0000000-0000-4000-8000-000000000002', 'headliner', 1)
ON CONFLICT (show_id, artist_id) DO NOTHING;

-- show_rooms 由 trigger 自动创建，但确保幂等
INSERT INTO public.show_rooms (show_id) VALUES
  ('c0000000-0000-4000-8000-000000000001'),
  ('c0000000-0000-4000-8000-000000000002'),
  ('c0000000-0000-4000-8000-000000000003')
ON CONFLICT (show_id) DO NOTHING;

-- ========================
-- Announcements
-- ========================
INSERT INTO public.announcements (id, show_id, type, title, content, created_at) VALUES
  ('d0000000-0000-4000-8000-000000000001', 'c0000000-0000-4000-8000-000000000001', 'organizer_notice', '入场须知（DEMO）', '请提前30分钟入场，演出开始后停止入场。场内禁止录音录像。', '2026-07-20T10:00:00Z'),
  ('d0000000-0000-4000-8000-000000000002', 'c0000000-0000-4000-8000-000000000002', 'ticket_sale', '预售已开票（DEMO）', '本场演出预售票已在秀动开票，售完即止。', '2026-07-01T10:00:00Z'),
  ('d0000000-0000-4000-8000-000000000003', 'c0000000-0000-4000-8000-000000000003', 'sold_out', '售罄通知（DEMO）', '本场演出全票种已售罄，感谢支持。', '2026-07-15T12:00:00Z')
ON CONFLICT (id) DO NOTHING;
