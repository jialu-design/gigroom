/**
 * P10.6.1 行为测试 — Ticket Holder 身份体系
 *
 * 覆盖：
 * A. 数据模型与架构分层
 * B. getTicketOwnership — 查询票务记录
 * C. createTicketOwnership — 创建票务记录
 * D. verifyTicketOwnership — 验证票务
 * E. canJoinShowRoom — 权限判断（opt-in 策略）
 * F. joinRoom 集成 — 票务校验接入
 * G. fallback 回归
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { useUserStore } from "@/lib/stores/useUserStore";
import { TicketOwnershipStatus } from "@/lib/types";

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

function makeTableBasedFake(routes: Record<string, () => unknown>): SupabaseFake {
  return {
    from: vi.fn((name: string) => {
      const fn = routes[name];
      const data = fn ? fn() : null;
      return makeChain(data);
    }),
  };
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
  supabaseMock.current = makeTableBasedFake({});
  resetStores();
  process.env[ENV_URL] = "https://test.supabase.co";
  process.env[ENV_KEY] = "test-anon-key";

  // 重置 mock 数据
  const { __resetMockTicketOwnerships } = await import("@/lib/api/tickets");
  __resetMockTicketOwnerships();
  const { __resetMockEvents } = await import("@/lib/api/events");
  __resetMockEvents();
});

afterEach(() => {
  if (originalUrl === undefined) delete process.env[ENV_URL];
  else process.env[ENV_URL] = originalUrl;
  if (originalKey === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalKey;
  vi.restoreAllMocks();
});

// ============================================================
// A. 数据模型与架构分层
// ============================================================
describe("A. 数据模型与架构分层", () => {
  it("tickets.ts 存在", () => {
    expect(existsSync(resolve(SRC, "lib/api/tickets.ts"))).toBe(true);
  });

  it("TicketOwnershipStatus 枚举包含 pending/verified/cancelled", () => {
    expect(TicketOwnershipStatus.PENDING).toBe("pending");
    expect(TicketOwnershipStatus.VERIFIED).toBe("verified");
    expect(TicketOwnershipStatus.CANCELLED).toBe("cancelled");
  });

  it("database.types.ts 包含 ticket_ownerships 表定义", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("ticket_ownerships");
    expect(content).toContain("ticket_id");
    expect(content).toContain("verified_at");
  });

  it("publicData.ts 包含 ticketOwnershipsFrom 和 adapter", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("ticketOwnershipsFrom");
    expect(content).toContain("ticketOwnershipRowToTicketOwnership");
  });

  it("V1：rooms.ts joinRoom 不做票务门槛校验", () => {
    const content = read("src/lib/api/rooms.ts");
    expect(content).not.toContain("canJoinShowRoom");
    expect(content).not.toContain("需要购票验证");
  });

  it("tickets.ts 不包含 'as any'", () => {
    const content = read("src/lib/api/tickets.ts");
    expect(content).not.toContain("as any");
  });
});

// ============================================================
// B. getTicketOwnership — 查询票务记录
// ============================================================
describe("B. getTicketOwnership", () => {
  it("Supabase 路径：返回用户票务记录", async () => {
    const row = {
      id: "to-1", user_id: "user-1", show_id: "show-1",
      ticket_id: "t-1", status: "verified",
      verified_at: "2026-07-20T10:00:00Z", created_at: "2026-07-18T10:00:00Z",
    };
    supabaseMock.current = makeTableBasedFake({ ticket_ownerships: () => row });

    const { getTicketOwnership } = await import("@/lib/api/tickets");
    const result = await getTicketOwnership("user-1", "show-1");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(TicketOwnershipStatus.VERIFIED);
    expect(result!.ticket_id).toBe("t-1");
  });

  it("无记录时返回 null", async () => {
    supabaseMock.current = makeTableBasedFake({ ticket_ownerships: () => null });

    const { getTicketOwnership } = await import("@/lib/api/tickets");
    const result = await getTicketOwnership("user-xyz", "show-1");
    expect(result).toBeNull();
  });

  it("fallback 路径：从 mock 读取", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { getTicketOwnership } = await import("@/lib/api/tickets");
    const result = await getTicketOwnership("user-1", "show-1");
    expect(result).not.toBeNull();
    expect(result!.status).toBe(TicketOwnershipStatus.VERIFIED);
  });
});

// ============================================================
// C. createTicketOwnership — 创建票务记录
// ============================================================
describe("C. createTicketOwnership", () => {
  it("fallback 路径：创建 pending 票务记录", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { createTicketOwnership, getTicketOwnership } = await import("@/lib/api/tickets");
    const created = await createTicketOwnership("user-2", "show-10", "ticket-xyz");
    expect(created.status).toBe(TicketOwnershipStatus.PENDING);
    expect(created.ticket_id).toBe("ticket-xyz");
    expect(created.verified_at).toBeNull();

    // 确认可查到
    const fetched = await getTicketOwnership("user-2", "show-10");
    expect(fetched).not.toBeNull();
  });

  it("创建 verified 票务记录时自动设置 verified_at", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { createTicketOwnership } = await import("@/lib/api/tickets");
    const created = await createTicketOwnership(
      "user-4", "show-11", "ticket-abc",
      TicketOwnershipStatus.VERIFIED
    );
    expect(created.status).toBe(TicketOwnershipStatus.VERIFIED);
    expect(created.verified_at).not.toBeNull();
  });
});

// ============================================================
// D. verifyTicketOwnership — 验证票务
// ============================================================
describe("D. verifyTicketOwnership", () => {
  it("fallback 路径：将 pending 更新为 verified", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { createTicketOwnership, verifyTicketOwnership } = await import("@/lib/api/tickets");
    // 先创建 pending 记录
    await createTicketOwnership("user-2", "show-10", "ticket-pending");
    // 验证
    const verified = await verifyTicketOwnership("user-2", "show-10");
    expect(verified.status).toBe(TicketOwnershipStatus.VERIFIED);
    expect(verified.verified_at).not.toBeNull();
  });

  it("不存在的记录抛错", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { verifyTicketOwnership } = await import("@/lib/api/tickets");
    await expect(verifyTicketOwnership("user-xyz", "show-xyz")).rejects.toThrow();
  });

  it("已 verified 的记录幂等返回", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { verifyTicketOwnership } = await import("@/lib/api/tickets");
    // user-1 show-1 已是 verified
    const result = await verifyTicketOwnership("user-1", "show-1");
    expect(result.status).toBe(TicketOwnershipStatus.VERIFIED);
  });
});

// ============================================================
// E. canJoinShowRoom — 权限判断
// ============================================================
describe("E. canJoinShowRoom", () => {
  it("无票务记录的演出：允许加入（opt-in 策略）", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { canJoinShowRoom } = await import("@/lib/api/tickets");
    // show-10 无票务记录
    const result = await canJoinShowRoom("user-1", "show-10");
    expect(result).toBe(true);
  });

  it("有票务记录的演出 + 用户有 verified 票务：允许加入", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { canJoinShowRoom } = await import("@/lib/api/tickets");
    // show-1 有票务记录，user-1 有 verified
    const result = await canJoinShowRoom("user-1", "show-1");
    expect(result).toBe(true);
  });

  it("有票务记录的演出 + 用户无票务：禁止加入", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { canJoinShowRoom } = await import("@/lib/api/tickets");
    // show-1 有票务记录，user-2 无票务
    const result = await canJoinShowRoom("user-2", "show-1");
    expect(result).toBe(false);
  });

  it("有票务记录的演出 + 用户有 pending 票务：禁止加入", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { createTicketOwnership, canJoinShowRoom } = await import("@/lib/api/tickets");
    // show-1 已有票务记录，为 user-2 创建 pending
    await createTicketOwnership("user-2", "show-1", "ticket-pending-user2");
    const result = await canJoinShowRoom("user-2", "show-1");
    expect(result).toBe(false);
  });

  it("有票务记录的演出 + 用户有 cancelled 票务：禁止加入", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { createTicketOwnership, canJoinShowRoom } = await import("@/lib/api/tickets");
    await createTicketOwnership("user-2", "show-1", "ticket-cancelled", TicketOwnershipStatus.CANCELLED);
    const result = await canJoinShowRoom("user-2", "show-1");
    expect(result).toBe(false);
  });
});

// ============================================================
// F. joinRoom 集成 — 票务校验接入
// ============================================================
describe("F. joinRoom 集成", () => {
  it("无票务记录的演出：joinRoom 成功（向后兼容）", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { joinRoom } = await import("@/lib/api/rooms");
    // show-2 无票务记录
    const membership = await joinRoom("show-2", "user-1");
    expect(membership).toBeDefined();
  });

  it("有票务记录的演出 + 用户有 verified 票务：joinRoom 成功", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { joinRoom } = await import("@/lib/api/rooms");
    // show-1 有票务记录，user-1 有 verified
    const membership = await joinRoom("show-1", "user-1");
    expect(membership).toBeDefined();
  });

  it("V1：有票务记录的演出 + 用户无票务：joinRoom 同样成功（加入房间不要求买票）", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-2");

    const { joinRoom } = await import("@/lib/api/rooms");
    // show-1 有票务记录，user-2 无票务 — V1 无票务平台身份验证，加入房间只创建 RoomMembership
    const membership = await joinRoom("show-1", "user-2");
    expect(membership).toBeDefined();
    expect(membership.room_id).toBe("room-1");
  });
});

// ============================================================
// G. fallback 回归
// ============================================================
describe("G. fallback 回归", () => {
  it("getTicketOwnership 签名：(userId, showId) => Promise<TicketOwnership | null>", async () => {
    const { getTicketOwnership } = await import("@/lib/api/tickets");
    expect(typeof getTicketOwnership).toBe("function");
    const result = await getTicketOwnership("user-1", "show-1");
    expect(result).toBeDefined();
  });

  it("verifyTicketOwnership 签名：(userId, showId) => Promise<TicketOwnership>", async () => {
    const { verifyTicketOwnership } = await import("@/lib/api/tickets");
    expect(typeof verifyTicketOwnership).toBe("function");
  });

  it("canJoinShowRoom 签名：(userId, showId) => Promise<boolean>", async () => {
    const { canJoinShowRoom } = await import("@/lib/api/tickets");
    expect(typeof canJoinShowRoom).toBe("function");
    const result = await canJoinShowRoom("user-1", "show-10");
    expect(typeof result).toBe("boolean");
  });

  it("createTicketOwnership 签名：(userId, showId, ticketId, status?) => Promise<TicketOwnership>", async () => {
    const { createTicketOwnership } = await import("@/lib/api/tickets");
    expect(typeof createTicketOwnership).toBe("function");
  });
});
