/**
 * P10.2-B 行为测试 — 用户关注艺人迁移到 Supabase
 *
 * 覆盖：
 * A. 未登录 Follow 拦截（requireCurrentUserId 抛错）
 * B. 登录后 pending Follow 自动执行（API 层验证）
 * C. Supabase follow 成功（mock supabase client）
 * D. Supabase unfollow 成功（mock supabase client）
 * E. fallback mock 路径正常（env 未配置时走 store）
 * F. 重复 follow 不产生重复记录（幂等性）
 * G. UI 不直接访问 Supabase（静态 import 检查）
 * H. syncFollowedArtists 同步机制
 * I. database.types.ts 覆盖 user_artist_follows
 *
 * 全程 Mock Supabase client，不连真实网络。
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { useUserStore } from "@/lib/stores/useUserStore";

const ROOT = resolve(__dirname, "../../..");

function read(p: string) {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

// ============================================================
// Mock Supabase client（确保不连真实网络）
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
  single: Mock;
  upsert: Mock;
  delete: Mock;
  data: unknown;
  error: unknown;
}

interface SupabaseFake {
  from: Mock;
}

function makeChain(result: { data: unknown; error: unknown }): Chain {
  const chain = {} as Chain;
  chain.data = result.data;
  chain.error = result.error;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({ data: result.data, error: result.error }));
  chain.upsert = vi.fn(() => chain);
  chain.delete = vi.fn(() => chain);
  return chain;
}

function makeSupabaseFake(
  result: { data: unknown; error: unknown } = { data: null, error: null }
): SupabaseFake {
  const chain = makeChain(result);
  return {
    from: vi.fn(() => chain),
  };
}

// ============
// 构造 DB Row 测试数据
// ============

function followRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "uaf-1",
    user_id: "user-1",
    artist_id: "artist-15",
    created_at: "2026-08-17T10:00:00Z",
    ...overrides,
  };
}

// ============================================================
// 公共：store 重置
// ============================================================
beforeEach(() => {
  useUserStore.getState().logout();
  localStorage.clear();
  supabaseMock.current = null as unknown as SupabaseFake;
});

// ============================================================
// A. 未登录 Follow 拦截
// ============================================================
describe("P10.2-B A — 未登录 Follow 拦截", () => {
  it("followArtist 未登录时抛错", async () => {
    const { followArtist } = await import("@/lib/api/follows");
    await expect(followArtist("user-1", "artist-15")).rejects.toThrow();
  });

  it("unfollowArtist 未登录时抛错", async () => {
    const { unfollowArtist } = await import("@/lib/api/follows");
    await expect(unfollowArtist("user-1", "artist-1")).rejects.toThrow();
  });

  it("isFollowingArtist 未登录时返回 false", async () => {
    const { isFollowingArtist } = await import("@/lib/api/follows");
    const result = await isFollowingArtist("user-1", "artist-1");
    expect(result).toBe(false);
  });

  it("followArtist userId 不匹配时抛错", async () => {
    useUserStore.getState().mockLogin(); // 当前用户 user-1
    const { followArtist } = await import("@/lib/api/follows");
    await expect(followArtist("user-2", "artist-15")).rejects.toThrow();
  });
});

// ============================================================
// B. 登录后 pending Follow 自动执行（API 层验证）
// ============================================================
describe("P10.2-B B — 登录后 Follow 执行", () => {
  it("mockLogin 后 followArtist 成功并同步 store", async () => {
    useUserStore.getState().mockLogin();

    const { followArtist } = await import("@/lib/api/follows");
    const follow = await followArtist("user-1", "artist-15");

    expect(follow.user_id).toBe("user-1");
    expect(follow.artist_id).toBe("artist-15");
    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");
  });

  it("mockLogin 后 unfollowArtist 成功并同步 store", async () => {
    useUserStore.getState().mockLogin();
    // artist-1 在 MOCK_FOLLOWED 中
    expect(useUserStore.getState().followedArtistIds).toContain("artist-1");

    const { unfollowArtist } = await import("@/lib/api/follows");
    await unfollowArtist("user-1", "artist-1");

    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-1");
  });

  it("isFollowingArtist 登录后读取 store 正确", async () => {
    useUserStore.getState().mockLogin();

    const { isFollowingArtist } = await import("@/lib/api/follows");
    // artist-1 在 MOCK_FOLLOWED 中
    expect(await isFollowingArtist("user-1", "artist-1")).toBe(true);
    // artist-15 不在
    expect(await isFollowingArtist("user-1", "artist-15")).toBe(false);
  });
});

// ============================================================
// C. Supabase follow 成功
// ============================================================
describe("P10.2-B C — Supabase follow 成功", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    useUserStore.getState().mockLogin();
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    supabaseMock.current = null as unknown as SupabaseFake;
  });

  it("followArtist 调用 supabase.from('user_artist_follows').upsert(...)", async () => {
    const fake = makeSupabaseFake({ data: followRow(), error: null });
    supabaseMock.current = fake;

    const { followArtist } = await import("@/lib/api/follows");
    const follow = await followArtist("user-1", "artist-15");

    expect(fake.from).toHaveBeenCalledWith("user_artist_follows");
    const chain = fake.from();
    expect(chain.upsert).toHaveBeenCalled();
    expect(follow.user_id).toBe("user-1");
    expect(follow.artist_id).toBe("artist-15");
  });

  it("followArtist 成功后同步 store", async () => {
    const fake = makeSupabaseFake({ data: followRow(), error: null });
    supabaseMock.current = fake;

    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");

    const { followArtist } = await import("@/lib/api/follows");
    await followArtist("user-1", "artist-15");

    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");
  });

  it("followArtist 返回 UserArtistFollow 形状", async () => {
    const fake = makeSupabaseFake({ data: followRow(), error: null });
    supabaseMock.current = fake;

    const { followArtist } = await import("@/lib/api/follows");
    const follow = await followArtist("user-1", "artist-15");

    expect(follow).toHaveProperty("id");
    expect(follow).toHaveProperty("user_id");
    expect(follow).toHaveProperty("artist_id");
    expect(follow).toHaveProperty("created_at");
  });
});

// ============================================================
// D. Supabase unfollow 成功
// ============================================================
describe("P10.2-B D — Supabase unfollow 成功", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    useUserStore.getState().mockLogin();
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    supabaseMock.current = null as unknown as SupabaseFake;
  });

  it("unfollowArtist 调用 supabase.from('user_artist_follows').delete().eq(...)", async () => {
    const fake = makeSupabaseFake({ data: null, error: null });
    supabaseMock.current = fake;

    const { unfollowArtist } = await import("@/lib/api/follows");
    await unfollowArtist("user-1", "artist-1");

    expect(fake.from).toHaveBeenCalledWith("user_artist_follows");
    const chain = fake.from();
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.eq).toHaveBeenCalledWith("artist_id", "artist-1");
  });

  it("unfollowArtist 成功后同步 store", async () => {
    const fake = makeSupabaseFake({ data: null, error: null });
    supabaseMock.current = fake;

    expect(useUserStore.getState().followedArtistIds).toContain("artist-1");

    const { unfollowArtist } = await import("@/lib/api/follows");
    await unfollowArtist("user-1", "artist-1");

    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-1");
  });

  it("unfollowArtist 未关注的 artist 不报错（幂等）", async () => {
    const fake = makeSupabaseFake({ data: null, error: null });
    supabaseMock.current = fake;

    const { unfollowArtist } = await import("@/lib/api/follows");
    await expect(unfollowArtist("user-1", "artist-99")).resolves.toBeUndefined();
  });
});

// ============================================================
// E. fallback mock 路径正常
// ============================================================
describe("P10.2-B E — fallback mock 路径", () => {
  // 不设置 Supabase 环境变量 → isSupabaseConfigured() = false

  it("followArtist fallback 更新 store 并返回 UserArtistFollow", async () => {
    useUserStore.getState().mockLogin();

    const { followArtist } = await import("@/lib/api/follows");
    const follow = await followArtist("user-1", "artist-15");

    expect(follow.user_id).toBe("user-1");
    expect(follow.artist_id).toBe("artist-15");
    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");
  });

  it("unfollowArtist fallback 更新 store", async () => {
    useUserStore.getState().mockLogin();

    const { unfollowArtist } = await import("@/lib/api/follows");
    await unfollowArtist("user-1", "artist-1");

    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-1");
  });

  it("isFollowingArtist fallback 读取 store", async () => {
    useUserStore.getState().mockLogin();

    const { isFollowingArtist } = await import("@/lib/api/follows");
    expect(await isFollowingArtist("user-1", "artist-1")).toBe(true);
    expect(await isFollowingArtist("user-1", "artist-99")).toBe(false);
  });

  it("getFollowedArtists fallback 解析 store IDs 为 Artist[]", async () => {
    useUserStore.getState().mockLogin();

    const { getFollowedArtists } = await import("@/lib/api/follows");
    const followed = await getFollowedArtists("user-1");

    // MOCK_FOLLOWED = artist-1, artist-4, artist-7, artist-11
    expect(followed.length).toBe(4);
    expect(followed.map((a) => a.id).sort()).toEqual(
      ["artist-1", "artist-4", "artist-7", "artist-11"].sort()
    );
  });

  it("getFollowedArtists 其他 userId 返回空", async () => {
    useUserStore.getState().mockLogin();

    const { getFollowedArtists } = await import("@/lib/api/follows");
    const followed = await getFollowedArtists("user-2");
    expect(followed).toEqual([]);
  });
});

// ============================================================
// F. 重复 follow 不产生重复记录（幂等性）
// ============================================================
describe("P10.2-B F — 重复 follow 幂等", () => {
  it("fallback 路径：重复 follow store 不重复添加", async () => {
    useUserStore.getState().mockLogin();
    const before = useUserStore.getState().followedArtistIds.length;

    const { followArtist } = await import("@/lib/api/follows");
    await followArtist("user-1", "artist-15");
    await followArtist("user-1", "artist-15");
    await followArtist("user-1", "artist-15");

    const after = useUserStore.getState().followedArtistIds.length;
    expect(after).toBe(before + 1);
    expect(
      useUserStore.getState().followedArtistIds.filter((id) => id === "artist-15").length
    ).toBe(1);
  });

  it("Supabase 路径：upsert 处理 unique 约束不报错", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    const fake = makeSupabaseFake({ data: followRow(), error: null });
    supabaseMock.current = fake;
    useUserStore.getState().mockLogin();

    const { followArtist } = await import("@/lib/api/follows");
    // 连续 3 次 follow 同一 artist
    await followArtist("user-1", "artist-15");
    await followArtist("user-1", "artist-15");
    await followArtist("user-1", "artist-15");

    // upsert 被调用 3 次，但 store 只增加 1 个
    const chain = fake.from();
    expect(chain.upsert).toHaveBeenCalledTimes(3);
    expect(
      useUserStore.getState().followedArtistIds.filter((id) => id === "artist-15").length
    ).toBe(1);

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("Supabase 路径：重复 unfollow 不报错", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    const fake = makeSupabaseFake({ data: null, error: null });
    supabaseMock.current = fake;
    useUserStore.getState().mockLogin();

    const { unfollowArtist } = await import("@/lib/api/follows");
    await expect(unfollowArtist("user-1", "artist-99")).resolves.toBeUndefined();
    await expect(unfollowArtist("user-1", "artist-99")).resolves.toBeUndefined();

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });
});

// ============================================================
// G. UI 不直接访问 Supabase
// ============================================================
describe("P10.2-B G — UI 不直接访问 Supabase", () => {
  it("FollowButton.tsx 不 import @/lib/supabase/client", () => {
    const content = read("src/components/artist/FollowButton.tsx");
    expect(content).not.toMatch(/from\s+["']@\/lib\/supabase\/client["']/);
    expect(content).not.toMatch(/from\s+["']@\/lib\/supabase\/server["']/);
  });

  it("FollowButton.tsx import followArtist/unfollowArtist from @/lib/api/follows", () => {
    const content = read("src/components/artist/FollowButton.tsx");
    expect(content).toMatch(/from\s+["']@\/lib\/api\/follows["']/);
  });

  it("follows.ts 是 API 层（import supabase 合法）", () => {
    const content = read("src/lib/api/follows.ts");
    expect(content).toMatch(/from\s+["']@\/lib\/supabase\/publicData["']/);
  });

  it("useUserStore.ts 不 import supabase", () => {
    const content = read("src/lib/stores/useUserStore.ts");
    expect(content).not.toMatch(/from\s+["']@\/lib\/supabase/);
  });
});

// ============================================================
// H. syncFollowedArtists 同步机制
// ============================================================
describe("P10.2-B H — syncFollowedArtists 同步机制", () => {
  it("Supabase 未配置时 syncFollowedArtists 为 no-op", async () => {
    useUserStore.getState().mockLogin();
    const before = [...useUserStore.getState().followedArtistIds];

    const { syncFollowedArtists } = await import("@/lib/api/follows");
    await syncFollowedArtists("user-1");

    // 未配置时 store 不变
    expect(useUserStore.getState().followedArtistIds).toEqual(before);
  });

  it("Supabase 配置时 syncFollowedArtists 从 DB 读取并覆盖 store", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    // DB 返回 artist-2, artist-3（与 MOCK_FOLLOWED 不同）
    const fake = makeSupabaseFake({
      data: [{ artist_id: "artist-2" }, { artist_id: "artist-3" }],
      error: null,
    });
    supabaseMock.current = fake;
    useUserStore.getState().mockLogin();

    const { syncFollowedArtists } = await import("@/lib/api/follows");
    await syncFollowedArtists("user-1");

    // store 被 DB 数据覆盖
    expect(useUserStore.getState().followedArtistIds).toEqual(["artist-2", "artist-3"]);

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("syncFollowedArtists 调用 supabase.from('user_artist_follows').select('artist_id').eq('user_id', ...)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    const fake = makeSupabaseFake({ data: [], error: null });
    supabaseMock.current = fake;

    const { syncFollowedArtists } = await import("@/lib/api/follows");
    await syncFollowedArtists("user-1");

    expect(fake.from).toHaveBeenCalledWith("user_artist_follows");
    const chain = fake.from();
    expect(chain.select).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");

    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("setFollowedArtistIds store action 覆盖 followedArtistIds", async () => {
    useUserStore.getState().mockLogin();
    expect(useUserStore.getState().followedArtistIds.length).toBe(4);

    useUserStore.getState().setFollowedArtistIds(["artist-2", "artist-3"]);
    expect(useUserStore.getState().followedArtistIds).toEqual(["artist-2", "artist-3"]);
  });
});

// ============================================================
// I. database.types.ts 覆盖 user_artist_follows
// ============================================================
describe("P10.2-B I — database.types.ts 覆盖", () => {
  it("database.types.ts 包含 user_artist_follows 表定义", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("user_artist_follows");
  });

  it("user_artist_follows Row 包含 id / user_id / artist_id / created_at", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toMatch(/user_artist_follows[\s\S]*?Row:[\s\S]*?id:\s*string/);
    expect(content).toMatch(/user_artist_follows[\s\S]*?user_id:\s*string/);
    expect(content).toMatch(/user_artist_follows[\s\S]*?artist_id:\s*string/);
    expect(content).toMatch(/user_artist_follows[\s\S]*?created_at:\s*string/);
  });

  it("publicData.ts 导出 userArtistFollowsFrom + followRowToFollow", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("userArtistFollowsFrom");
    expect(content).toContain("followRowToFollow");
  });

  it("migration SQL 包含 user_artist_follows 表 + RLS + UNIQUE", () => {
    const sql = read("supabase/migrations/001_init.sql");
    expect(sql).toContain("CREATE TABLE public.user_artist_follows");
    expect(sql).toContain("ALTER TABLE public.user_artist_follows ENABLE ROW LEVEL SECURITY");
    expect(sql).toMatch(/UNIQUE\s*\(user_id,\s*artist_id\)/);
  });
});
