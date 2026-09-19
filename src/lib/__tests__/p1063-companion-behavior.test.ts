/**
 * P10.6.3 行为测试 — Companion 找搭子基础体系
 *
 * 覆盖：
 * A. 类型与架构
 * B. getCompanionRequests — 查询列表
 * C. createCompanionRequest — 创建请求
 * D. closeCompanionRequest — 关闭请求
 * E. 事件记录
 * F. Supabase 路径
 * G. API 契约与 fallback 回归
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { useUserStore } from "@/lib/stores/useUserStore";
import { CompanionType, CompanionStatus, EventType, TargetType } from "@/lib/types";

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
  delete process.env[ENV_URL];
  delete process.env[ENV_KEY];

  const { __resetMockEvents } = await import("@/lib/api/events");
  __resetMockEvents();
  const { __resetMockCompanionRequests } = await import("@/lib/api/companions");
  __resetMockCompanionRequests();
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
  it("companions.ts 存在", () => {
    expect(existsSync(resolve(SRC, "lib/api/companions.ts"))).toBe(true);
  });

  it("CompanionType 枚举包含 companion/carpool/hotel/ticket", () => {
    expect(CompanionType.COMPANION).toBe("companion");
    expect(CompanionType.CARPOOL).toBe("carpool");
    expect(CompanionType.HOTEL).toBe("hotel");
    expect(CompanionType.TICKET).toBe("ticket");
  });

  it("CompanionStatus 枚举包含 open/matched/closed", () => {
    expect(CompanionStatus.OPEN).toBe("open");
    expect(CompanionStatus.MATCHED).toBe("matched");
    expect(CompanionStatus.CLOSED).toBe("closed");
  });

  it("database.types.ts 包含 companion_requests 表定义", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("companion_requests");
    expect(content).toContain("type");
    expect(content).toContain("content");
    expect(content).toContain("status");
  });

  it("publicData.ts 包含 companionRequestsFrom 和 adapter", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("companionRequestsFrom");
    expect(content).toContain("companionRequestRowToCompanionRequest");
  });

  it("companions.ts 不包含 'as any'", () => {
    const content = read("src/lib/api/companions.ts");
    expect(content).not.toContain("as any");
  });
});

// ============================================================
// B. getCompanionRequests — 查询列表
// ============================================================
describe("B. getCompanionRequests", () => {
  it("fallback 路径：返回演出关联的找搭子请求", async () => {
    const { getCompanionRequests } = await import("@/lib/api/companions");
    const list = await getCompanionRequests("show-4");
    expect(list.length).toBe(2);
    expect(list.some((r) => r.type === CompanionType.COMPANION)).toBe(true);
    expect(list.some((r) => r.type === CompanionType.CARPOOL)).toBe(true);
  });

  it("按 type 筛选", async () => {
    const { getCompanionRequests } = await import("@/lib/api/companions");
    const list = await getCompanionRequests("show-4", CompanionType.CARPOOL);
    expect(list.length).toBe(1);
    expect(list[0].type).toBe(CompanionType.CARPOOL);
  });

  it("无请求的演出返回空数组", async () => {
    const { getCompanionRequests } = await import("@/lib/api/companions");
    const list = await getCompanionRequests("show-10");
    expect(list).toEqual([]);
  });

  it("Supabase 路径：返回列表并按 created_at 降序", async () => {
    process.env[ENV_URL] = "https://test.supabase.co";
    process.env[ENV_KEY] = "test-anon-key";
    const rows = [
      { id: "cr-a", user_id: "user-1", show_id: "show-4", type: "companion", content: "求搭子", status: "open", created_at: "2026-08-15T10:00:00Z" },
      { id: "cr-b", user_id: "user-2", show_id: "show-4", type: "carpool", content: "拼车", status: "open", created_at: "2026-08-14T10:00:00Z" },
    ];
    supabaseMock.current = makeTableBasedFake({ companion_requests: () => rows });

    const { getCompanionRequests } = await import("@/lib/api/companions");
    const list = await getCompanionRequests("show-4");
    expect(list.length).toBe(2);
    expect(list[0].id).toBe("cr-a");
    expect(list[1].id).toBe("cr-b");
  });
});

// ============================================================
// C. createCompanionRequest — 创建请求
// ============================================================
describe("C. createCompanionRequest", () => {
  it("fallback 路径：创建找搭子请求", async () => {
    mockLoggedIn("user-1");

    const { createCompanionRequest, getCompanionRequests } = await import("@/lib/api/companions");
    const created = await createCompanionRequest(
      "user-1", "show-4", CompanionType.HOTEL, "求拼酒店，经济型即可"
    );
    expect(created.type).toBe(CompanionType.HOTEL);
    expect(created.content).toBe("求拼酒店，经济型即可");
    expect(created.status).toBe(CompanionStatus.OPEN);
    expect(created.user_id).toBe("user-1");

    // 确认出现在列表中
    const list = await getCompanionRequests("show-4");
    expect(list.some((r) => r.id === created.id)).toBe(true);
  });

  it("空内容抛错", async () => {
    mockLoggedIn("user-1");

    const { createCompanionRequest } = await import("@/lib/api/companions");
    await expect(
      createCompanionRequest("user-1", "show-4", CompanionType.COMPANION, "")
    ).rejects.toThrow();
  });

  it("Supabase 路径：insert 并返回创建的请求", async () => {
    process.env[ENV_URL] = "https://test.supabase.co";
    process.env[ENV_KEY] = "test-anon-key";
    const returnRow = {
      id: "cr-new", user_id: "user-1", show_id: "show-4",
      type: "ticket", content: "求拼双人优惠票", status: "open",
      created_at: "2026-08-16T10:00:00Z",
    };
    // insert 路径需要返回 DB 生成的行，不是 insert payload
    supabaseMock.current = {
      from: vi.fn((name: string) => {
        if (name === "companion_requests") {
          const chain = makeChain(returnRow);
          // insert 后 select("*").single() 应返回 returnRow
          chain.insert = vi.fn(() => chain);
          return chain;
        }
        return makeChain(null);
      }),
    };

    const { createCompanionRequest } = await import("@/lib/api/companions");
    const created = await createCompanionRequest(
      "user-1", "show-4", CompanionType.TICKET, "求拼双人优惠票"
    );
    expect(created.id).toBe("cr-new");
    expect(created.type).toBe(CompanionType.TICKET);
  });
});

// ============================================================
// D. closeCompanionRequest — 关闭请求
// ============================================================
describe("D. closeCompanionRequest", () => {
  it("fallback 路径：关闭自己的请求", async () => {
    mockLoggedIn("user-2");

    const { closeCompanionRequest, getCompanionRequests } = await import("@/lib/api/companions");
    // cr-1 属于 user-2
    const closed = await closeCompanionRequest("cr-1", "user-2");
    expect(closed.status).toBe(CompanionStatus.CLOSED);

    // 确认列表中状态已更新
    const list = await getCompanionRequests("show-4");
    const item = list.find((r) => r.id === "cr-1");
    expect(item?.status).toBe(CompanionStatus.CLOSED);
  });

  it("关闭他人的请求抛错", async () => {
    mockLoggedIn("user-1");

    const { closeCompanionRequest } = await import("@/lib/api/companions");
    // cr-1 属于 user-2，user-1 不能关闭
    await expect(closeCompanionRequest("cr-1", "user-1")).rejects.toThrow();
  });

  it("Supabase 路径：update 并返回", async () => {
    process.env[ENV_URL] = "https://test.supabase.co";
    process.env[ENV_KEY] = "test-anon-key";
    const returnRow = {
      id: "cr-1", user_id: "user-2", show_id: "show-4",
      type: "companion", content: "已找到搭子", status: "closed",
      created_at: "2026-08-10T10:00:00Z",
    };
    supabaseMock.current = {
      from: vi.fn((name: string) => {
        if (name === "companion_requests") {
          const chain = makeChain(returnRow);
          chain.update = vi.fn(() => chain);
          return chain;
        }
        return makeChain(null);
      }),
    };

    const { closeCompanionRequest } = await import("@/lib/api/companions");
    const closed = await closeCompanionRequest("cr-1", "user-2");
    expect(closed.status).toBe(CompanionStatus.CLOSED);
  });
});

// ============================================================
// E. 事件记录
// ============================================================
describe("E. 事件记录", () => {
  it("createCompanionRequest 成功后记录 COMPANION_MATCH 事件", async () => {
    mockLoggedIn("user-1");

    const { createCompanionRequest } = await import("@/lib/api/companions");
    const { getUserEvents } = await import("@/lib/api/events");
    await createCompanionRequest("user-1", "show-4", CompanionType.COMPANION, "求搭子");

    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.COMPANION_MATCH)).toBe(true);
  });

  it("事件 metadata 包含 companion_type", async () => {
    mockLoggedIn("user-1");

    const { createCompanionRequest } = await import("@/lib/api/companions");
    const { getUserEvents } = await import("@/lib/api/events");
    await createCompanionRequest("user-1", "show-4", CompanionType.CARPOOL, "拼车");

    const events = await getUserEvents("user-1");
    const matchEvent = events.find((e) => e.event_type === EventType.COMPANION_MATCH);
    expect(matchEvent).toBeDefined();
    expect(matchEvent!.metadata).toHaveProperty("companion_type", CompanionType.CARPOOL);
  });
});

// ============================================================
// F. API 契约与 fallback 回归
// ============================================================
describe("F. API 契约与 fallback 回归", () => {
  it("getCompanionRequests 签名：(showId, type?) => Promise<CompanionRequest[]>", async () => {
    const { getCompanionRequests } = await import("@/lib/api/companions");
    expect(typeof getCompanionRequests).toBe("function");
    const list = await getCompanionRequests("show-4");
    expect(Array.isArray(list)).toBe(true);
  });

  it("createCompanionRequest 签名：(userId, showId, type, content) => Promise<CompanionRequest>", async () => {
    const { createCompanionRequest } = await import("@/lib/api/companions");
    expect(typeof createCompanionRequest).toBe("function");
  });

  it("closeCompanionRequest 签名：(requestId, userId) => Promise<CompanionRequest>", async () => {
    const { closeCompanionRequest } = await import("@/lib/api/companions");
    expect(typeof closeCompanionRequest).toBe("function");
  });

  it("CompanionRequest 接口包含所有必要字段", async () => {
    mockLoggedIn("user-1");

    const { createCompanionRequest } = await import("@/lib/api/companions");
    const created = await createCompanionRequest("user-1", "show-4", CompanionType.HOTEL, "测试");
    expect(created).toHaveProperty("id");
    expect(created).toHaveProperty("user_id");
    expect(created).toHaveProperty("show_id");
    expect(created).toHaveProperty("type");
    expect(created).toHaveProperty("content");
    expect(created).toHaveProperty("status");
    expect(created).toHaveProperty("created_at");
  });
});
