/**
 * P10.6.2 行为测试 — Room 生命周期升级
 *
 * 覆盖：
 * A. 类型与架构
 * B. getRoomStatus — 状态推导
 * C. canSendMessage — 消息权限
 * D. canCreatePost — 发帖权限
 * E. isRoomArchived — 归档判断
 * F. sendMessage 集成 — 生命周期校验
 * G. getRoomByShow 返回 room_status
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { useUserStore } from "@/lib/stores/useUserStore";
import { RoomStatus, ShowStatus } from "@/lib/types";

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
  // 使用 fallback 路径（mock 数据）
  delete process.env[ENV_URL];
  delete process.env[ENV_KEY];

  const { __resetMockEvents } = await import("@/lib/api/events");
  __resetMockEvents();
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
  it("RoomStatus 枚举包含 upcoming/active/ended/archived", () => {
    expect(RoomStatus.UPCOMING).toBe("upcoming");
    expect(RoomStatus.ACTIVE).toBe("active");
    expect(RoomStatus.ENDED).toBe("ended");
    expect(RoomStatus.ARCHIVED).toBe("archived");
  });

  it("ShowRoom 接口包含 room_status 字段", () => {
    const content = read("src/lib/types/index.ts");
    expect(content).toContain("room_status");
    expect(content).toContain("RoomStatus");
  });

  it("rooms.ts 导出 getRoomStatus / canSendMessage / canCreatePost / isRoomArchived", () => {
    const content = read("src/lib/api/rooms.ts");
    expect(content).toContain("export async function getRoomStatus");
    expect(content).toContain("export async function canSendMessage");
    expect(content).toContain("export async function canCreatePost");
    expect(content).toContain("export async function isRoomArchived");
  });

  it("messages.ts import canSendMessage", () => {
    const content = read("src/lib/api/messages.ts");
    expect(content).toContain("canSendMessage");
  });
});

// ============================================================
// B. getRoomStatus — 状态推导
// ============================================================
describe("B. getRoomStatus", () => {
  it("ENDED 演出 → RoomStatus.ENDED", async () => {
    const { getRoomStatus } = await import("@/lib/api/rooms");
    // show-1, show-2, show-3 是 ENDED
    const status = await getRoomStatus("show-1");
    expect(status).toBe(RoomStatus.ENDED);
  });

  it("UPCOMING 演出（非当天）→ RoomStatus.UPCOMING", async () => {
    const { getRoomStatus } = await import("@/lib/api/rooms");
    // show-12 是 UPCOMING，日期 2026-09-20（未来）
    const status = await getRoomStatus("show-12");
    expect(status).toBe(RoomStatus.UPCOMING);
  });

  it("UPCOMING 但日期已过的演出 → RoomStatus.ENDED（结合 date_time 判断）", async () => {
    const { getRoomStatus } = await import("@/lib/api/rooms");
    // show-4 mock status 仍是 UPCOMING，但日期 2026-08-20 已过 → 视为已结束
    const status = await getRoomStatus("show-4");
    expect(status).toBe(RoomStatus.ENDED);
  });

  it("CANCELLED 演出 → RoomStatus.ARCHIVED", async () => {
    const { getRoomStatus } = await import("@/lib/api/rooms");
    // show-21 是 CANCELLED
    const status = await getRoomStatus("show-21");
    expect(status).toBe(RoomStatus.ARCHIVED);
  });

  it("POSTPONED 演出 → RoomStatus.ARCHIVED", async () => {
    const { getRoomStatus } = await import("@/lib/api/rooms");
    // show-19 是 POSTPONED
    const status = await getRoomStatus("show-19");
    expect(status).toBe(RoomStatus.ARCHIVED);
  });

  it("不存在的演出 → RoomStatus.ARCHIVED", async () => {
    const { getRoomStatus } = await import("@/lib/api/rooms");
    const status = await getRoomStatus("show-nonexistent");
    expect(status).toBe(RoomStatus.ARCHIVED);
  });
});

// ============================================================
// C. canSendMessage — 消息权限
// ============================================================
describe("C. canSendMessage", () => {
  it("UPCOMING 演出：允许发消息", async () => {
    const { canSendMessage } = await import("@/lib/api/rooms");
    const result = await canSendMessage("show-12");
    expect(result).toBe(true);
  });

  it("UPCOMING 但日期已过：禁止发消息", async () => {
    const { canSendMessage } = await import("@/lib/api/rooms");
    const result = await canSendMessage("show-4");
    expect(result).toBe(false);
  });

  it("ENDED 演出：禁止发消息", async () => {
    const { canSendMessage } = await import("@/lib/api/rooms");
    const result = await canSendMessage("show-1");
    expect(result).toBe(false);
  });

  it("不存在的演出：禁止发消息", async () => {
    const { canSendMessage } = await import("@/lib/api/rooms");
    const result = await canSendMessage("show-nonexistent");
    expect(result).toBe(false);
  });

  it("CANCELLED 演出：禁止发消息", async () => {
    const { canSendMessage } = await import("@/lib/api/rooms");
    const result = await canSendMessage("show-21");
    expect(result).toBe(false);
  });
});

// ============================================================
// D. canCreatePost — 发帖权限
// ============================================================
describe("D. canCreatePost", () => {
  it("UPCOMING 演出：允许发帖", async () => {
    const { canCreatePost } = await import("@/lib/api/rooms");
    const result = await canCreatePost("show-12");
    expect(result).toBe(true);
  });

  it("ENDED 演出：禁止发帖", async () => {
    const { canCreatePost } = await import("@/lib/api/rooms");
    const result = await canCreatePost("show-1");
    expect(result).toBe(false);
  });
});

// ============================================================
// E. isRoomArchived — 归档判断
// ============================================================
describe("E. isRoomArchived", () => {
  it("ENDED 演出：已归档", async () => {
    const { isRoomArchived } = await import("@/lib/api/rooms");
    const result = await isRoomArchived("show-1");
    expect(result).toBe(true);
  });

  it("UPCOMING 演出：未归档", async () => {
    const { isRoomArchived } = await import("@/lib/api/rooms");
    const result = await isRoomArchived("show-12");
    expect(result).toBe(false);
  });

  it("CANCELLED 演出：已归档", async () => {
    const { isRoomArchived } = await import("@/lib/api/rooms");
    const result = await isRoomArchived("show-21");
    expect(result).toBe(true);
  });
});

// ============================================================
// F. sendMessage 集成 — 生命周期校验
// ============================================================
describe("F. sendMessage 集成", () => {
  it("ENDED 演出发消息被拒绝", async () => {
    mockLoggedIn("user-1");

    const { sendMessage } = await import("@/lib/api/messages");
    // show-1 是 ENDED
    await expect(sendMessage("show-1", "user-1", "测试")).rejects.toThrow("演出已结束");
  });

  it("UPCOMING 演出发消息成功", async () => {
    mockLoggedIn("user-1");

    const { sendMessage } = await import("@/lib/api/messages");
    // show-12 是 UPCOMING（2026-09-20 未来日期）
    const msg = await sendMessage("show-12", "user-1", "测试消息");
    expect(msg).toBeDefined();
    expect(msg.content).toBe("测试消息");
  });
});

// ============================================================
// G. getRoomByShow 返回 room_status
// ============================================================
describe("G. getRoomByShow 返回 room_status", () => {
  it("返回的 ShowRoom 包含 room_status 字段", async () => {
    const { getRoomByShow } = await import("@/lib/api/rooms");
    const room = await getRoomByShow("show-4");
    expect(room).not.toBeNull();
    expect(room!.room_status).toBeDefined();
    expect(Object.values(RoomStatus)).toContain(room!.room_status);
  });

  it("ENDED 演出的 room_status 为 ENDED", async () => {
    const { getRoomByShow } = await import("@/lib/api/rooms");
    const room = await getRoomByShow("show-1");
    expect(room).not.toBeNull();
    expect(room!.room_status).toBe(RoomStatus.ENDED);
  });

  it("UPCOMING 演出的 room_status 为 UPCOMING", async () => {
    const { getRoomByShow } = await import("@/lib/api/rooms");
    const room = await getRoomByShow("show-12");
    expect(room).not.toBeNull();
    expect(room!.room_status).toBe(RoomStatus.UPCOMING);
  });
});
