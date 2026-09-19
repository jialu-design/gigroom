-- P10.6 核心演出关系数据 migration
-- 包含：ticket_ownerships, companion_requests, ticket_transfers
--
-- 修复：所有引用 profiles.id / auth.users.id / shows.id 的字段
--   统一为 UUID（原为 TEXT，导致外键类型不匹配）。
--
-- 此文件可安全重复执行：先 DROP CASCADE 清理残留对象，再重建。

-- ============
-- 清理残留（失败执行可能留下的部分对象）
-- 顺序：先删有依赖的（ticket_transfers），再删被依赖的
-- ============
DROP TABLE IF EXISTS ticket_transfers CASCADE;
DROP TABLE IF EXISTS companion_requests CASCADE;
DROP TABLE IF EXISTS ticket_ownerships CASCADE;

-- ============
-- P10.6.1 票务持有
-- ============
CREATE TABLE IF NOT EXISTS ticket_ownerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  ticket_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'cancelled')),
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, show_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_ownerships_user_id ON ticket_ownerships(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_ownerships_show_id ON ticket_ownerships(show_id);
CREATE INDEX IF NOT EXISTS idx_ticket_ownerships_user_show ON ticket_ownerships(user_id, show_id);

-- RLS: 用户只能 INSERT/SELECT/UPDATE 自己的票务记录
ALTER TABLE ticket_ownerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can read own ticket ownerships"
  ON ticket_ownerships FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "users can insert own ticket ownerships"
  ON ticket_ownerships FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own ticket ownerships"
  ON ticket_ownerships FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============
-- P10.6.3 找搭子请求
-- ============
CREATE TABLE IF NOT EXISTS companion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('companion', 'carpool', 'hotel', 'ticket')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'matched', 'closed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_companion_requests_user_id ON companion_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_companion_requests_show_id ON companion_requests(show_id);
CREATE INDEX IF NOT EXISTS idx_companion_requests_show_type ON companion_requests(show_id, type);

-- RLS: 公共可读，用户只能 INSERT/UPDATE 自己的请求
ALTER TABLE companion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read companion requests"
  ON companion_requests FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "users can insert own companion requests"
  ON companion_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users can update own companion requests"
  ON companion_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============
-- P10.6.4 官方转票
-- ============
CREATE TABLE IF NOT EXISTS ticket_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id TEXT NOT NULL,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  original_price INTEGER NOT NULL CHECK (original_price >= 0),
  transfer_price INTEGER NOT NULL CHECK (transfer_price >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (transfer_price <= original_price)
);

CREATE INDEX IF NOT EXISTS idx_ticket_transfers_seller_id ON ticket_transfers(seller_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_ticket_id ON ticket_transfers(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_transfers_status ON ticket_transfers(status);

-- RLS: 公共可读，用户只能 INSERT/UPDATE 自己的转票记录
ALTER TABLE ticket_transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public can read ticket transfers"
  ON ticket_transfers FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "users can insert own ticket transfers"
  ON ticket_transfers FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "sellers can update own ticket transfers"
  ON ticket_transfers FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);
