/**
 * P10.7 行为测试 — 用户信用体系
 *
 * 覆盖：
 * A. 类型与架构
 * B. getUserReputation — 初始值与查询
 * C. updateReputation — 信用变动
 * D. getReputationHistory — 历史记录
 * E. TicketTransfer 完成接入信用
 * F. Companion 关闭接入信用
 * G. Show Attend 接入信用
 * H. API 契约
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ReputationEventType, UserShowStatus } from "@/lib/types";

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
  select: Mock; eq: Mock; in: Mock; order: Mock; limit: Mock;
  single: Mock; maybeSingle: Mock; insert: Mock; update: Mock;
  delete: Mock; upsert: Mock; data: unknown; error: unknown;
}

interface SupabaseFake { from: Mock; }

function makeChain(data: unknown, error: unknown = null): Chain {
  const state: { data: unknown } = { data };
  const chain: Partial<Chain> = {};
  chain.select = vi.fn(() => chain as Chain);
  chain.eq = vi.fn(() => chain as Chain);
  chain.in = vi.fn(() => chain as Chain);
  chain.order = vi.fn(() => chain as Chain);
  chain.limit = vi.fn(() => chain as Chain);
  chain.insert = vi.fn((newData?: unknown) => { if (newData !== undefined) state.data = newData; return chain as Chain; });
  chain.update = vi.fn((newData?: unknown) => { if (newData !== undefined) state.data = newData; return chain as Chain; });
  chain.delete = vi.fn(() => chain as Chain);
  chain.upsert = vi.fn((newData?: unknown) => { if (newData !== undefined) state.data = newData; return chain as Chain; });
  chain.single = vi.fn(() => ({ data: state.data, error }));
  chain.maybeSingle = vi.fn(() => ({ data: state.data, error }));
  Object.defineProperty(chain, "data", { get: () => state.data, set: (v: unknown) => { state.data = v; }, configurable: true });
  Object.defineProperty(chain, "error", { get: () => error, configurable: true });
  return chain as Chain;
}

const ENV_URL = "NEXT_PUBLIC_SUPABASE_URL";
const ENV_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";
const originalUrl = process.env[ENV_URL];
const originalKey = process.env[ENV_KEY];

function resetStores() {
  useUserStore.setState({
    isLoggedIn: false, user: null, followedArtistIds: [],
    showStatuses: {}, roomMemberships: [], notifications: [],
  });
}

function mockLoggedIn(userId: string) {
  useUserStore.setState({
    isLoggedIn: true,
    user: { id: userId, display_name: "测试", avatar_url: undefined, city: "上海", bio: "", onboarding_completed: true, created_at: "2026-01-01T00:00:00Z" },
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
  const { __resetMockReputation } = await import("@/lib/api/reputation");
  __resetMockReputation();
  const { __resetMockTicketTransfers } = await import("@/lib/api/ticketTransfers");
  __resetMockTicketTransfers();
  const { __resetMockTicketOwnerships } = await import("@/lib/api/tickets");
  __resetMockTicketOwnerships();
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
  it("reputation.ts 存在", () => {
    expect(existsSync(resolve(SRC, "lib/api/reputation.ts"))).toBe(true);
  });

  it("ReputationEventType 枚举包含所有类型", () => {
    expect(ReputationEventType.TICKET_TRANSFER_COMPLETED).toBe("ticket_transfer_completed");
    expect(ReputationEventType.COMPANION_MATCHED).toBe("companion_matched");
    expect(ReputationEventType.SHOW_ATTENDED).toBe("show_attended");
    expect(ReputationEventType.POST_CREATED).toBe("post_created");
    expect(ReputationEventType.ROOM_JOINED).toBe("room_joined");
    expect(ReputationEventType.MANUAL_ADJUSTMENT).toBe("manual_adjustment");
  });

  it("database.types.ts 包含 user_reputations 和 reputation_events", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("user_reputations");
    expect(content).toContain("reputation_events");
    expect(content).toContain("total_score");
    expect(content).toContain("score_delta");
  });

  it("publicData.ts 包含 adapter", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("userReputationsFrom");
    expect(content).toContain("reputationEventsFrom");
    expect(content).toContain("userReputationRowToUserReputation");
    expect(content).toContain("reputationEventRowToReputationEvent");
  });

  it("reputation.ts 不包含 'as any'", () => {
    const content = read("src/lib/api/reputation.ts");
    expect(content).not.toContain("as any");
  });
});

// ============================================================
// B. getUserReputation
// ============================================================
describe("B. getUserReputation", () => {
  it("新用户初始信用分为 0", async () => {
    const { getUserReputation } = await import("@/lib/api/reputation");
    const rep = await getUserReputation("user-new");
    expect(rep.total_score).toBe(0);
    expect(rep.transfer_count).toBe(0);
    expect(rep.companion_count).toBe(0);
    expect(rep.attended_count).toBe(0);
  });

  it("信用变动后可查到更新值", async () => {
    const { getUserReputation, updateReputation } = await import("@/lib/api/reputation");
    await updateReputation("user-1", ReputationEventType.SHOW_ATTENDED, "show-1", "参加演出");
    const rep = await getUserReputation("user-1");
    expect(rep.total_score).toBe(8);
    expect(rep.attended_count).toBe(1);
  });
});

// ============================================================
// C. updateReputation
// ============================================================
describe("C. updateReputation", () => {
  it("TICKET_TRANSFER_COMPLETED 加 10 分", async () => {
    const { updateReputation, getUserReputation } = await import("@/lib/api/reputation");
    await updateReputation("user-1", ReputationEventType.TICKET_TRANSFER_COMPLETED, "tt-1", "完成转票");
    const rep = await getUserReputation("user-1");
    expect(rep.total_score).toBe(10);
    expect(rep.transfer_count).toBe(1);
  });

  it("COMPANION_MATCHED 加 5 分", async () => {
    const { updateReputation, getUserReputation } = await import("@/lib/api/reputation");
    await updateReputation("user-1", ReputationEventType.COMPANION_MATCHED, "cr-1", "搭子匹配");
    const rep = await getUserReputation("user-1");
    expect(rep.total_score).toBe(5);
    expect(rep.companion_count).toBe(1);
  });

  it("多次更新累加", async () => {
    const { updateReputation, getUserReputation } = await import("@/lib/api/reputation");
    await updateReputation("user-1", ReputationEventType.TICKET_TRANSFER_COMPLETED, "tt-1", "转票1");
    await updateReputation("user-1", ReputationEventType.SHOW_ATTENDED, "show-1", "看演出");
    await updateReputation("user-1", ReputationEventType.COMPANION_MATCHED, "cr-1", "搭子");
    const rep = await getUserReputation("user-1");
    expect(rep.total_score).toBe(23); // 10 + 8 + 5
    expect(rep.transfer_count).toBe(1);
    expect(rep.attended_count).toBe(1);
    expect(rep.companion_count).toBe(1);
  });
});

// ============================================================
// D. getReputationHistory
// ============================================================
describe("D. getReputationHistory", () => {
  it("返回按时间降序的信用变动记录", async () => {
    const { updateReputation, getReputationHistory } = await import("@/lib/api/reputation");
    await updateReputation("user-1", ReputationEventType.TICKET_TRANSFER_COMPLETED, "tt-1", "转票1");
    await updateReputation("user-1", ReputationEventType.SHOW_ATTENDED, "show-1", "看演出");

    const history = await getReputationHistory("user-1");
    expect(history.length).toBe(2);
    // 最新优先
    expect(history[0].event_type).toBe(ReputationEventType.SHOW_ATTENDED);
    expect(history[1].event_type).toBe(ReputationEventType.TICKET_TRANSFER_COMPLETED);
  });

  it("记录包含 score_delta 和 description", async () => {
    const { updateReputation, getReputationHistory } = await import("@/lib/api/reputation");
    await updateReputation("user-1", ReputationEventType.TICKET_TRANSFER_COMPLETED, "tt-1", "完成转票");

    const history = await getReputationHistory("user-1");
    expect(history[0].score_delta).toBe(10);
    expect(history[0].description).toBe("完成转票");
    expect(history[0].related_id).toBe("tt-1");
  });
});

// ============================================================
// E. TicketTransfer 完成接入信用
// ============================================================
describe("E. TicketTransfer 接入信用", () => {
  it("completeTicketTransfer 后卖家信用增加", async () => {
    mockLoggedIn("user-1");

    const { createTicketTransfer, completeTicketTransfer } = await import("@/lib/api/ticketTransfers");
    const { getUserReputation } = await import("@/lib/api/reputation");
    const created = await createTicketTransfer("user-1", "ticket-001", 200, 150);
    await completeTicketTransfer(created.id, "user-2", "user-1");

    const rep = await getUserReputation("user-1");
    expect(rep.total_score).toBe(10);
    expect(rep.transfer_count).toBe(1);
  });
});

// ============================================================
// F. Companion 关闭接入信用
// ============================================================
describe("F. Companion 接入信用", () => {
  it("closeCompanionRequest 后用户信用增加", async () => {
    mockLoggedIn("user-2");

    const { closeCompanionRequest } = await import("@/lib/api/companions");
    const { getUserReputation } = await import("@/lib/api/reputation");
    // cr-1 属于 user-2
    await closeCompanionRequest("cr-1", "user-2");

    const rep = await getUserReputation("user-2");
    expect(rep.total_score).toBe(5);
    expect(rep.companion_count).toBe(1);
  });
});

// ============================================================
// G. Show Attend 接入信用
// ============================================================
describe("G. Show Attend 接入信用", () => {
  it("setShowStatus(attended) 后信用增加", async () => {
    mockLoggedIn("user-1");

    const { setShowStatus } = await import("@/lib/api/user");
    const { getUserReputation } = await import("@/lib/api/reputation");
    await setShowStatus("user-1", "show-4", UserShowStatus.ATTENDED);

    const rep = await getUserReputation("user-1");
    expect(rep.total_score).toBe(8);
    expect(rep.attended_count).toBe(1);
  });

  it("setShowStatus(interested) 不增加信用", async () => {
    mockLoggedIn("user-1");

    const { setShowStatus } = await import("@/lib/api/user");
    const { getUserReputation } = await import("@/lib/api/reputation");
    await setShowStatus("user-1", "show-4", UserShowStatus.INTERESTED);

    const rep = await getUserReputation("user-1");
    expect(rep.total_score).toBe(0);
    expect(rep.attended_count).toBe(0);
  });
});

// ============================================================
// H. API 契约
// ============================================================
describe("H. API 契约", () => {
  it("getUserReputation 签名：(userId) => Promise<UserReputation>", async () => {
    const { getUserReputation } = await import("@/lib/api/reputation");
    expect(typeof getUserReputation).toBe("function");
    const rep = await getUserReputation("user-contract");
    expect(rep).toHaveProperty("user_id");
    expect(rep).toHaveProperty("total_score");
  });

  it("updateReputation 签名：(userId, eventType, relatedId, description) => Promise<UserReputation>", async () => {
    const { updateReputation } = await import("@/lib/api/reputation");
    expect(typeof updateReputation).toBe("function");
  });

  it("getReputationHistory 签名：(userId) => Promise<ReputationEvent[]>", async () => {
    const { getReputationHistory } = await import("@/lib/api/reputation");
    expect(typeof getReputationHistory).toBe("function");
    const history = await getReputationHistory("user-contract");
    expect(Array.isArray(history)).toBe(true);
  });
});
