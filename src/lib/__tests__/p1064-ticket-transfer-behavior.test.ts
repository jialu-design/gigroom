/**
 * P10.6.4 行为测试 — 官方转票基础体系
 *
 * 覆盖：
 * A. 类型与架构
 * B. createTicketTransfer — 创建转票（含超价限制）
 * C. completeTicketTransfer — 完成转票（含事件记录）
 * D. cancelTicketTransfer — 取消转票
 * E. getTicketTransfersByTicket / BySeller — 查询
 * F. TICKET_PURCHASE 事件接入（verifyTicketOwnership）
 * G. migration SQL 结构
 * H. API 契约与 fallback 回归
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { useUserStore } from "@/lib/stores/useUserStore";
import { TicketTransferStatus, EventType, TargetType } from "@/lib/types";

const SRC = resolve(__dirname, "../../..", "src");

function read(relPath: string): string {
  return readFileSync(resolve(__dirname, "../../..", relPath), "utf-8");
}

// ============================================================
// Mock Supabase client
// ============================================================

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { current: null as unknown as SupabaseFake },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => supabaseMock.current,
}));

interface Chain {
  select: Mock;
  eq: Mock;
  in: Mock;
  order: Mock;
  limit: Mock;
  single: Mock;
  maybeSingle: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  upsert: Mock;
  data: unknown;
  error: unknown;
}

interface SupabaseFake {
  from: Mock;
}

function makeChain(data: unknown, error: unknown = null): Chain {
  const state: { data: unknown } = { data };
  const chain: Partial<Chain> = {};
  chain.select = vi.fn(() => chain as Chain);
  chain.eq = vi.fn(() => chain as Chain);
  chain.in = vi.fn(() => chain as Chain);
  chain.order = vi.fn(() => chain as Chain);
  chain.limit = vi.fn(() => chain as Chain);
  chain.insert = vi.fn((newData?: unknown) => {
    if (newData !== undefined) state.data = newData;
    return chain as Chain;
  });
  chain.update = vi.fn((newData?: unknown) => {
    if (newData !== undefined) state.data = newData;
    return chain as Chain;
  });
  chain.delete = vi.fn(() => chain as Chain);
  chain.upsert = vi.fn((newData?: unknown) => {
    if (newData !== undefined) state.data = newData;
    return chain as Chain;
  });
  chain.single = vi.fn(() => ({ data: state.data, error }));
  chain.maybeSingle = vi.fn(() => ({ data: state.data, error }));
  Object.defineProperty(chain, "data", {
    get: () => state.data,
    set: (v: unknown) => { state.data = v; },
    configurable: true,
  });
  Object.defineProperty(chain, "error", {
    get: () => error,
    configurable: true,
  });
  return chain as Chain;
}

const ENV_URL = "NEXT_PUBLIC_SUPABASE_URL";
const ENV_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

const originalUrl = process.env[ENV_URL];
const originalKey = process.env[ENV_KEY];

function resetStores() {
  useUserStore.setState({
    isLoggedIn: false,
    user: null,
    followedArtistIds: [],
    showStatuses: {},
    roomMemberships: [],
    notifications: [],
  });
}

function mockLoggedIn(userId: string, displayName = "测试用户") {
  useUserStore.setState({
    isLoggedIn: true,
    user: {
      id: userId,
      display_name: displayName,
      avatar_url: undefined,
      city: "上海",
      bio: "",
      onboarding_completed: true,
      created_at: "2026-01-01T00:00:00Z",
    },
    followedArtistIds: [],
  });
}

beforeEach(async () => {
  supabaseMock.current = { from: vi.fn(() => makeChain(null)) } as unknown as SupabaseFake;
  resetStores();
  delete process.env[ENV_URL];
  delete process.env[ENV_KEY];

  const { __resetMockEvents } = await import("@/lib/api/events");
  __resetMockEvents();
  const { __resetMockTicketTransfers } = await import("@/lib/api/ticketTransfers");
  __resetMockTicketTransfers();
  const { __resetMockTicketOwnerships } = await import("@/lib/api/tickets");
  __resetMockTicketOwnerships();
});

afterEach(() => {
  if (originalUrl === undefined) delete process.env[ENV_URL];
  else process.env[ENV_URL] = originalUrl;
  if (originalKey === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalKey;
  vi.restoreAllMocks();
});

// ============================================================
// A. 类型与架构
// ============================================================
describe("A. 类型与架构", () => {
  it("ticketTransfers.ts 存在", () => {
    expect(existsSync(resolve(SRC, "lib/api/ticketTransfers.ts"))).toBe(true);
  });

  it("TicketTransferStatus 枚举包含 pending/completed/cancelled", () => {
    expect(TicketTransferStatus.PENDING).toBe("pending");
    expect(TicketTransferStatus.COMPLETED).toBe("completed");
    expect(TicketTransferStatus.CANCELLED).toBe("cancelled");
  });

  it("database.types.ts 包含 ticket_transfers 表定义", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("ticket_transfers");
    expect(content).toContain("seller_id");
    expect(content).toContain("buyer_id");
    expect(content).toContain("original_price");
    expect(content).toContain("transfer_price");
  });

  it("publicData.ts 包含 ticketTransfersFrom 和 adapter", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("ticketTransfersFrom");
    expect(content).toContain("ticketTransferRowToTicketTransfer");
  });

  it("migration SQL 文件存在", () => {
    expect(existsSync(resolve(__dirname, "../../../supabase/migrations/002_p10_6_core_relations.sql"))).toBe(true);
  });

  it("migration SQL 包含三张表 + 索引 + RLS", () => {
    const sql = read("supabase/migrations/002_p10_6_core_relations.sql");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ticket_ownerships");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS companion_requests");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ticket_transfers");
    expect(sql).toContain("CHECK (transfer_price <= original_price)");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("idx_ticket_ownerships_user_id");
    expect(sql).toContain("idx_companion_requests_show_id");
    expect(sql).toContain("idx_ticket_transfers_seller_id");
  });

  it("ticketTransfers.ts 不包含 'as any'", () => {
    const content = read("src/lib/api/ticketTransfers.ts");
    expect(content).not.toContain("as any");
  });
});

// ============================================================
// B. createTicketTransfer — 创建转票
// ============================================================
describe("B. createTicketTransfer", () => {
  it("fallback 路径：创建 pending 转票记录", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer, getTicketTransfersByTicket } = await import("@/lib/api/ticketTransfers");
    const created = await createTicketTransfer("user-1", "ticket-001", 200, 150);
    expect(created.status).toBe(TicketTransferStatus.PENDING);
    expect(created.seller_id).toBe("user-1");
    expect(created.original_price).toBe(200);
    expect(created.transfer_price).toBe(150);
    expect(created.buyer_id).toBeNull();

    // 确认可查到
    const list = await getTicketTransfersByTicket("ticket-001");
    expect(list.some((t) => t.id === created.id)).toBe(true);
  });

  it("超价转票抛错（transfer_price > original_price）", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer } = await import("@/lib/api/ticketTransfers");
    await expect(
      createTicketTransfer("user-1", "ticket-001", 200, 250)
    ).rejects.toThrow("不能高于原价");
  });

  it("等价转票允许（transfer_price == original_price）", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer } = await import("@/lib/api/ticketTransfers");
    const created = await createTicketTransfer("user-1", "ticket-002", 200, 200);
    expect(created.transfer_price).toBe(200);
  });

  it("Supabase 路径：insert 并返回", async () => {
    process.env[ENV_URL] = "https://test.supabase.co";
    process.env[ENV_KEY] = "test-anon-key";
    const returnRow = {
      id: "tt-new", ticket_id: "ticket-003", seller_id: "user-1", buyer_id: null,
      original_price: 300, transfer_price: 280, status: "pending",
      created_at: "2026-08-16T10:00:00Z",
    };
    supabaseMock.current = {
      from: vi.fn((name: string) => {
        if (name === "ticket_transfers") {
          const chain = makeChain(returnRow);
          chain.insert = vi.fn(() => chain);
          return chain;
        }
        return makeChain(null);
      }),
    };

    const { createTicketTransfer } = await import("@/lib/api/ticketTransfers");
    const created = await createTicketTransfer("user-1", "ticket-003", 300, 280);
    expect(created.id).toBe("tt-new");
    expect(created.transfer_price).toBe(280);
  });
});

// ============================================================
// C. completeTicketTransfer — 完成转票
// ============================================================
describe("C. completeTicketTransfer", () => {
  it("fallback 路径：完成转票 + 记录 TICKET_TRANSFER 事件", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer, completeTicketTransfer } = await import("@/lib/api/ticketTransfers");
    const { getUserEvents } = await import("@/lib/api/events");
    // 先创建
    const created = await createTicketTransfer("user-1", "ticket-001", 200, 150);
    // 完成
    const completed = await completeTicketTransfer(created.id, "user-2", "user-1");
    expect(completed.status).toBe(TicketTransferStatus.COMPLETED);
    expect(completed.buyer_id).toBe("user-2");

    // 验证事件
    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.TICKET_TRANSFER)).toBe(true);
  });

  it("事件 metadata 包含 buyer_id 和 price", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer, completeTicketTransfer } = await import("@/lib/api/ticketTransfers");
    const { getUserEvents } = await import("@/lib/api/events");
    const created = await createTicketTransfer("user-1", "ticket-001", 200, 150);
    await completeTicketTransfer(created.id, "user-2", "user-1");

    const events = await getUserEvents("user-1");
    const transferEvent = events.find((e) => e.event_type === EventType.TICKET_TRANSFER);
    expect(transferEvent).toBeDefined();
    expect(transferEvent!.metadata).toHaveProperty("buyer_id", "user-2");
    expect(transferEvent!.metadata).toHaveProperty("price", 150);
  });

  it("非 seller 完成转票抛错", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer, completeTicketTransfer } = await import("@/lib/api/ticketTransfers");
    const created = await createTicketTransfer("user-1", "ticket-001", 200, 150);
    // user-2 尝试以 user-99 身份完成 → 不是 seller
    await expect(
      completeTicketTransfer(created.id, "user-2", "user-99")
    ).rejects.toThrow();
  });

  it("重复完成已完成的转票抛错", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer, completeTicketTransfer } = await import("@/lib/api/ticketTransfers");
    const created = await createTicketTransfer("user-1", "ticket-001", 200, 150);
    await completeTicketTransfer(created.id, "user-2", "user-1");
    // 再次完成
    await expect(
      completeTicketTransfer(created.id, "user-3", "user-1")
    ).rejects.toThrow();
  });
});

// ============================================================
// D. cancelTicketTransfer — 取消转票
// ============================================================
describe("D. cancelTicketTransfer", () => {
  it("fallback 路径：取消 pending 转票", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer, cancelTicketTransfer } = await import("@/lib/api/ticketTransfers");
    const created = await createTicketTransfer("user-1", "ticket-001", 200, 150);
    const cancelled = await cancelTicketTransfer(created.id, "user-1");
    expect(cancelled.status).toBe(TicketTransferStatus.CANCELLED);
  });

  it("非 seller 取消抛错", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer, cancelTicketTransfer } = await import("@/lib/api/ticketTransfers");
    const created = await createTicketTransfer("user-1", "ticket-001", 200, 150);
    await expect(cancelTicketTransfer(created.id, "user-99")).rejects.toThrow();
  });
});

// ============================================================
// E. 查询
// ============================================================
describe("E. 查询", () => {
  it("getTicketTransfersBySeller 返回卖家的转票记录", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer, getTicketTransfersBySeller } = await import("@/lib/api/ticketTransfers");
    await createTicketTransfer("user-1", "ticket-a", 200, 150);
    await createTicketTransfer("user-1", "ticket-b", 300, 280);

    const list = await getTicketTransfersBySeller("user-1");
    expect(list.length).toBe(2);
  });
});

// ============================================================
// F. TICKET_PURCHASE 事件接入
// ============================================================
describe("F. TICKET_PURCHASE 事件接入", () => {
  it("verifyTicketOwnership 成功后记录 TICKET_PURCHASE 事件", async () => {
    mockLoggedIn("user-1");

    // 先创建 pending 票务记录
    const { createTicketOwnership, verifyTicketOwnership } = await import("@/lib/api/tickets");
    const { getUserEvents } = await import("@/lib/api/events");
    await createTicketOwnership("user-1", "show-10", "ticket-test");

    // 验证
    await verifyTicketOwnership("user-1", "show-10");

    // 检查事件
    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.TICKET_PURCHASE)).toBe(true);
  });

  it("TICKET_PURCHASE 事件 metadata 包含 ticket_id", async () => {
    mockLoggedIn("user-1");

    const { createTicketOwnership, verifyTicketOwnership } = await import("@/lib/api/tickets");
    const { getUserEvents } = await import("@/lib/api/events");
    await createTicketOwnership("user-1", "show-10", "ticket-xyz");
    await verifyTicketOwnership("user-1", "show-10");

    const events = await getUserEvents("user-1");
    const purchaseEvent = events.find((e) => e.event_type === EventType.TICKET_PURCHASE);
    expect(purchaseEvent).toBeDefined();
    expect(purchaseEvent!.metadata).toHaveProperty("ticket_id", "ticket-xyz");
  });
});

// ============================================================
// G. API 契约与 fallback 回归
// ============================================================
describe("G. API 契约与 fallback 回归", () => {
  it("createTicketTransfer 签名：(sellerId, ticketId, originalPrice, transferPrice) => Promise<TicketTransfer>", async () => {
    const { createTicketTransfer } = await import("@/lib/api/ticketTransfers");
    expect(typeof createTicketTransfer).toBe("function");
  });

  it("completeTicketTransfer 签名：(transferId, buyerId, sellerId) => Promise<TicketTransfer>", async () => {
    const { completeTicketTransfer } = await import("@/lib/api/ticketTransfers");
    expect(typeof completeTicketTransfer).toBe("function");
  });

  it("cancelTicketTransfer 签名：(transferId, sellerId) => Promise<TicketTransfer>", async () => {
    const { cancelTicketTransfer } = await import("@/lib/api/ticketTransfers");
    expect(typeof cancelTicketTransfer).toBe("function");
  });

  it("TicketTransfer 接口包含所有必要字段", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer } = await import("@/lib/api/ticketTransfers");
    const created = await createTicketTransfer("user-1", "ticket-001", 200, 150);
    expect(created).toHaveProperty("id");
    expect(created).toHaveProperty("ticket_id");
    expect(created).toHaveProperty("seller_id");
    expect(created).toHaveProperty("buyer_id");
    expect(created).toHaveProperty("original_price");
    expect(created).toHaveProperty("transfer_price");
    expect(created).toHaveProperty("status");
    expect(created).toHaveProperty("created_at");
  });
});
