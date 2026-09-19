/**
 * P10.8 行为测试 — 推荐与同好匹配基础系统
 *
 * 覆盖：
 * A. 类型与架构
 * B. calculateRecommendationScore — 评分计算
 * C. getRecommendedShows — 演出推荐
 * D. getRecommendedCompanions — 同好匹配
 * E. getRecommendedCommunities — 社区推荐
 * F. 空数据与容错
 * G. API 契约
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { useUserStore } from "@/lib/stores/useUserStore";

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
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  upsert: ReturnType<typeof vi.fn>;
  data: unknown;
  error: unknown;
}

interface SupabaseFake { from: ReturnType<typeof vi.fn>; }

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

function mockLoggedIn(userId: string, city?: string) {
  useUserStore.setState({
    isLoggedIn: true,
    user: { id: userId, display_name: "测试", avatar_url: undefined, city: city ?? "上海", bio: "", onboarding_completed: true, created_at: "2026-01-01T00:00:00Z" },
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
  it("recommendation.ts 存在", () => {
    expect(existsSync(resolve(SRC, "lib/api/recommendation.ts"))).toBe(true);
  });

  it("types/index.ts 包含推荐类型", () => {
    const content = read("src/lib/types/index.ts");
    expect(content).toContain("RecommendedShow");
    expect(content).toContain("RecommendedCompanion");
    expect(content).toContain("RecommendedCommunity");
    expect(content).toContain("RecommendationScoreBreakdown");
  });

  it("recommendation.ts 导出 4 个核心函数", () => {
    const content = read("src/lib/api/recommendation.ts");
    expect(content).toContain("export function calculateRecommendationScore");
    expect(content).toContain("export async function getRecommendedShows");
    expect(content).toContain("export async function getRecommendedCompanions");
    expect(content).toContain("export async function getRecommendedCommunities");
  });

  it("评分权重为 40/25/15/10/10", () => {
    const content = read("src/lib/api/recommendation.ts");
    expect(content).toContain("0.40");
    expect(content).toContain("0.25");
    expect(content).toContain("0.15");
    expect(content).toContain("0.10");
  });

  it("recommendation.ts 不包含 'as any'", () => {
    const content = read("src/lib/api/recommendation.ts");
    expect(content).not.toContain("as any");
  });

  it("recommendation.ts 不直接 import Supabase client", () => {
    const content = read("src/lib/api/recommendation.ts");
    expect(content).not.toContain("from '@/lib/supabase/client'");
    expect(content).not.toContain("createClient");
  });
});

// ============================================================
// B. calculateRecommendationScore — 评分计算
// ============================================================
describe("B. calculateRecommendationScore", () => {
  it("全 100 分时总分为 100", async () => {
    const { calculateRecommendationScore } = await import("@/lib/api/recommendation");
    const result = calculateRecommendationScore(100, 100, 100, 100, 100);
    expect(result.total).toBe(100);
  });

  it("全 0 分时总分为 0", async () => {
    const { calculateRecommendationScore } = await import("@/lib/api/recommendation");
    const result = calculateRecommendationScore(0, 0, 0, 0, 0);
    expect(result.total).toBe(0);
  });

  it("权重正确：40+25+15+10+10 = 100%", async () => {
    const { calculateRecommendationScore } = await import("@/lib/api/recommendation");
    const result = calculateRecommendationScore(100, 0, 0, 0, 0);
    expect(result.total).toBe(40);
  });

  it("只给历史行为 100 分", async () => {
    const { calculateRecommendationScore } = await import("@/lib/api/recommendation");
    const result = calculateRecommendationScore(0, 100, 0, 0, 0);
    expect(result.total).toBe(25);
  });

  it("只给距离匹配 100 分", async () => {
    const { calculateRecommendationScore } = await import("@/lib/api/recommendation");
    const result = calculateRecommendationScore(0, 0, 100, 0, 0);
    expect(result.total).toBe(15);
  });

  it("只给社区活跃 100 分", async () => {
    const { calculateRecommendationScore } = await import("@/lib/api/recommendation");
    const result = calculateRecommendationScore(0, 0, 0, 100, 0);
    expect(result.total).toBe(10);
  });

  it("只给信誉分 100 分", async () => {
    const { calculateRecommendationScore } = await import("@/lib/api/recommendation");
    const result = calculateRecommendationScore(0, 0, 0, 0, 100);
    expect(result.total).toBe(10);
  });

  it("返回明细包含各维度子分", async () => {
    const { calculateRecommendationScore } = await import("@/lib/api/recommendation");
    const result = calculateRecommendationScore(80, 60, 40, 50, 70);
    expect(result).toHaveProperty("musicInterest");
    expect(result).toHaveProperty("historicalBehavior");
    expect(result).toHaveProperty("distanceMatch");
    expect(result).toHaveProperty("communityActivity");
    expect(result).toHaveProperty("reputation");
    expect(result).toHaveProperty("total");
  });
});

// ============================================================
// C. getRecommendedShows — 演出推荐
// ============================================================
describe("C. getRecommendedShows", () => {
  it("返回数组且按评分降序排列", async () => {
    mockLoggedIn("user-1", "上海");

    const { getRecommendedShows } = await import("@/lib/api/recommendation");
    const results = await getRecommendedShows("user-1", 5);

    expect(Array.isArray(results)).toBe(true);
    // 验证降序
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it("每个推荐包含 show, score, reasons", async () => {
    mockLoggedIn("user-1");

    const { getRecommendedShows } = await import("@/lib/api/recommendation");
    const results = await getRecommendedShows("user-1", 3);

    for (const rec of results) {
      expect(rec).toHaveProperty("show");
      expect(rec).toHaveProperty("score");
      expect(rec).toHaveProperty("reasons");
      expect(Array.isArray(rec.reasons)).toBe(true);
    }
  });

  it("limit 参数生效", async () => {
    mockLoggedIn("user-1");

    const { getRecommendedShows } = await import("@/lib/api/recommendation");
    const results = await getRecommendedShows("user-1", 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });
});

// ============================================================
// D. getRecommendedCompanions — 同好匹配
// ============================================================
describe("D. getRecommendedCompanions", () => {
  it("返回数组且按评分降序排列", async () => {
    mockLoggedIn("user-1");

    const { getRecommendedCompanions } = await import("@/lib/api/recommendation");
    const results = await getRecommendedCompanions("user-1", "show-4", 5);

    expect(Array.isArray(results)).toBe(true);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it("每个推荐包含 user, score, reasons, reputation", async () => {
    mockLoggedIn("user-1");

    const { getRecommendedCompanions } = await import("@/lib/api/recommendation");
    const results = await getRecommendedCompanions("user-1", "show-4", 3);

    for (const rec of results) {
      expect(rec).toHaveProperty("user");
      expect(rec).toHaveProperty("score");
      expect(rec).toHaveProperty("reasons");
      expect(rec).toHaveProperty("reputation");
    }
  });
});

// ============================================================
// E. getRecommendedCommunities — 社区推荐
// ============================================================
describe("E. getRecommendedCommunities", () => {
  it("返回数组且按评分降序排列", async () => {
    mockLoggedIn("user-1", "上海");

    const { getRecommendedCommunities } = await import("@/lib/api/recommendation");
    const results = await getRecommendedCommunities("user-1", 5);

    expect(Array.isArray(results)).toBe(true);
    for (let i = 1; i < results.length; i++) {
      expect(results[i].score).toBeLessThanOrEqual(results[i - 1].score);
    }
  });

  it("每个推荐包含 room, show, score, reasons", async () => {
    mockLoggedIn("user-1");

    const { getRecommendedCommunities } = await import("@/lib/api/recommendation");
    const results = await getRecommendedCommunities("user-1", 3);

    for (const rec of results) {
      expect(rec).toHaveProperty("room");
      expect(rec).toHaveProperty("show");
      expect(rec).toHaveProperty("score");
      expect(rec).toHaveProperty("reasons");
    }
  });
});

// ============================================================
// F. 空数据与容错
// ============================================================
describe("F. 空数据与容错", () => {
  it("未登录用户也能返回结果（不抛错）", async () => {
    resetStores();

    const { getRecommendedShows } = await import("@/lib/api/recommendation");
    const results = await getRecommendedShows("user-anonymous", 5);
    expect(Array.isArray(results)).toBe(true);
  });

  it("不存在的演出 ID 查同好不抛错", async () => {
    mockLoggedIn("user-1");

    const { getRecommendedCompanions } = await import("@/lib/api/recommendation");
    const results = await getRecommendedCompanions("user-1", "show-nonexistent", 5);
    expect(Array.isArray(results)).toBe(true);
  });

  it("评分函数接受任意 0-100 值不抛错", async () => {
    const { calculateRecommendationScore } = await import("@/lib/api/recommendation");
    expect(() => calculateRecommendationScore(0, 0, 0, 0, 0)).not.toThrow();
    expect(() => calculateRecommendationScore(50, 50, 50, 50, 50)).not.toThrow();
  });
});

// ============================================================
// G. API 契约
// ============================================================
describe("G. API 契约", () => {
  it("getRecommendedShows 签名：(userId, limit?) => Promise<RecommendedShow[]>", async () => {
    const { getRecommendedShows } = await import("@/lib/api/recommendation");
    expect(typeof getRecommendedShows).toBe("function");
    const result = await getRecommendedShows("user-1");
    expect(Array.isArray(result)).toBe(true);
  });

  it("getRecommendedCompanions 签名：(userId, showId, limit?) => Promise<RecommendedCompanion[]>", async () => {
    const { getRecommendedCompanions } = await import("@/lib/api/recommendation");
    expect(typeof getRecommendedCompanions).toBe("function");
  });

  it("getRecommendedCommunities 签名：(userId, limit?) => Promise<RecommendedCommunity[]>", async () => {
    const { getRecommendedCommunities } = await import("@/lib/api/recommendation");
    expect(typeof getRecommendedCommunities).toBe("function");
  });

  it("calculateRecommendationScore 签名：(5 numbers) => RecommendationScoreBreakdown", async () => {
    const { calculateRecommendationScore } = await import("@/lib/api/recommendation");
    expect(typeof calculateRecommendationScore).toBe("function");
    const result = calculateRecommendationScore(10, 20, 30, 40, 50);
    expect(result).toHaveProperty("total");
  });
});
