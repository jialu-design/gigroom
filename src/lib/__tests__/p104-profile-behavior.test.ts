/**
 * P10.4 行为测试 — 用户画像与 Profiles 基础层建设
 *
 * 覆盖：
 * A. 用户数据架构分层检查
 * B. profiles adapter — profileRowToUser
 * C. user lookup — getProfile / getUser / getCurrentUser / updateUser
 * D. getProfilesByIds — 批量用户查询
 * E. hydrateUsers / hydrateMessageUsers
 * F. Post user enrichment
 * G. Comment user enrichment
 * H. Message user enrichment + reply_to_user
 * I. User API 对外契约
 * J. database.types.ts profiles 预留画像字段
 * K. 回归 — mock 路径不受影响
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { User } from "@/lib/types";

const ROOT = resolve(__dirname, "../../..");
const SRC = resolve(ROOT, "src");

function read(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
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
  single: Mock;
  update: Mock;
  insert: Mock;
  delete: Mock;
  data: unknown;
  error: unknown;
}

interface SupabaseFake {
  from: Mock;
  __table: string;
}

function makeChainWith(data: unknown, error: unknown = null): Chain {
  const state: { data: unknown } = { data };
  const chain: Partial<Chain> = {};
  chain.select = vi.fn(() => chain as Chain);
  chain.eq = vi.fn(() => chain as Chain);
  chain.in = vi.fn(() => chain as Chain);
  chain.order = vi.fn(() => chain as Chain);
  chain.update = vi.fn((newData?: unknown) => {
    if (newData !== undefined) state.data = newData;
    return chain as Chain;
  });
  chain.insert = vi.fn((newData?: unknown) => {
    if (newData !== undefined) state.data = newData;
    return chain as Chain;
  });
  chain.delete = vi.fn(() => chain as Chain);
  chain.single = vi.fn(() => ({ data: state.data, error }));
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
      return makeChainWith(data);
    }),
    __table: "",
  };
}

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
  });
}

function profileRow(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: "user-1",
    display_name: "阿明",
    avatar_url: "https://picsum.photos/seed/u1/100/100",
    city: "上海",
    bio: "Shoegaze 爱好者",
    onboarding_completed: true,
    created_at: "2025-01-15T08:00:00Z",
    updated_at: "2025-01-15T08:00:00Z",
    music_preferences: null,
    favorite_artists: null,
    favorite_genres: null,
    attendance_history: null,
    interaction_tags: null,
    ...overrides,
  };
}

// Use the env var names matching publicData.ts isSupabaseConfigured()
const ENV_URL = "NEXT_PUBLIC_SUPABASE_URL";
const ENV_KEY = "NEXT_PUBLIC_SUPABASE_ANON_KEY";

const originalUrl = process.env[ENV_URL];
const originalKey = process.env[ENV_KEY];

beforeEach(() => {
  supabaseMock.current = makeTableBasedFake({});
  resetStores();
  process.env[ENV_URL] = "https://test.supabase.co";
  process.env[ENV_KEY] = "test-anon-key";
});

afterEach(() => {
  if (originalUrl === undefined) delete process.env[ENV_URL];
  else process.env[ENV_URL] = originalUrl;
  if (originalKey === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = originalKey;
  vi.restoreAllMocks();
});

// ============================================================
// A. 用户数据架构分层
// ============================================================
describe("A. 用户数据架构分层", () => {
  it("profile.ts 存在，作为用户数据层核心", () => {
    expect(existsSync(resolve(SRC, "lib/api/profile.ts"))).toBe(true);
  });

  it("user.ts 存在，作为对外 facade", () => {
    expect(existsSync(resolve(SRC, "lib/api/user.ts"))).toBe(true);
  });

  it("profile.ts 不包含 'as any'", () => {
    const content = read("src/lib/api/profile.ts");
    expect(content).not.toContain("as any");
  });

  it("posts/messages API 通过 hydrateUsers 回填 user", () => {
    const buddy = read("src/lib/api/posts/buddyPosts.ts");
    expect(buddy).toContain("hydrateUsers");
    expect(buddy).toContain("hydrateUser");
    const msgs = read("src/lib/api/messages.ts");
    expect(msgs).toContain("hydrateUsers");
    expect(msgs).toContain("hydrateMessageUsers");
  });

  it("UI 组件不直接 import mocks/users", () => {
    const msgItem = read("src/components/room/MessageItem.tsx");
    expect(msgItem).not.toContain("@/mocks/users");
    expect(msgItem).not.toContain("userMap");
  });
});

// ============================================================
// B. profiles adapter
// ============================================================
describe("B. profiles adapter", () => {
  it("profileRowToUser 完整映射字段", async () => {
    const { profileRowToUser } = await import("@/lib/api/profile");
    const row = profileRow();
    const u = profileRowToUser(row as never);
    expect(u.id).toBe("user-1");
    expect(u.display_name).toBe("阿明");
    expect(u.avatar_url).toBe("https://picsum.photos/seed/u1/100/100");
    expect(u.city).toBe("上海");
    expect(u.bio).toBe("Shoegaze 爱好者");
    expect(u.onboarding_completed).toBe(true);
    expect(u.created_at).toBe("2025-01-15T08:00:00Z");
  });

  it("profileRowToUser 处理 null 字段 → undefined", async () => {
    const { profileRowToUser } = await import("@/lib/api/profile");
    const row = profileRow({ avatar_url: null, city: null, bio: null });
    const u = profileRowToUser(row as never);
    expect(u.avatar_url).toBeUndefined();
    expect(u.city).toBeUndefined();
    expect(u.bio).toBeUndefined();
  });
});

// ============================================================
// C. user lookup
// ============================================================
describe("C. user lookup", () => {
  it("getProfile 读取 profiles（Supabase 路径）", async () => {
    const row = profileRow({ display_name: "用户张三" });
    supabaseMock.current = makeTableBasedFake({ profiles: () => row });

    const { getProfile } = await import("@/lib/api/profile");
    const user = await getProfile("user-1");
    expect(user.id).toBe("user-1");
    expect(user.display_name).toBe("用户张三");
  });

  it("getProfile profile 不存在 → fallback 到 mock", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { getProfile } = await import("@/lib/api/profile");
    const user = await getProfile("user-1");
    expect(user.id).toBe("user-1");
    expect(user.display_name).toBeDefined();
  });

  it("user.ts getUser 签名保持", async () => {
    const { getUser } = await import("@/lib/api/user");
    const user = await getUser("user-1");
    expect(user?.id).toBe("user-1");
  });

  it("user.ts getCurrentUser 已登录时走 profiles", async () => {
    mockLoggedIn("user-1", "阿明");
    const row = profileRow({ id: "user-1", display_name: "阿明" });
    supabaseMock.current = makeTableBasedFake({ profiles: () => row });

    const { getCurrentUser } = await import("@/lib/api/user");
    const user = await getCurrentUser();
    expect(user?.id).toBe("user-1");
    expect(user?.display_name).toBe("阿明");
  });

  it("user.ts updateUser 转发到 updateProfile", async () => {
    const row = profileRow({ display_name: "新名字" });
    supabaseMock.current = makeTableBasedFake({ profiles: () => row });

    const { updateUser } = await import("@/lib/api/user");
    const u = await updateUser("user-1", { display_name: "新名字" });
    expect(u.display_name).toBe("新名字");
  });
});

// ============================================================
// D. getProfilesByIds 批量查询
// ============================================================
describe("D. getProfilesByIds 批量查询", () => {
  it("空数组 → 返回空 Map", async () => {
    const { getProfilesByIds } = await import("@/lib/api/profile");
    const map = await getProfilesByIds([]);
    expect(map.size).toBe(0);
  });

  it("Supabase 路径：批量读取多个用户", async () => {
    const rows = [
      profileRow({ id: "user-1", display_name: "用户1" }),
      profileRow({ id: "user-2", display_name: "用户2" }),
    ];
    supabaseMock.current = makeTableBasedFake({ profiles: () => rows });

    const { getProfilesByIds } = await import("@/lib/api/profile");
    const map = await getProfilesByIds(["user-1", "user-2"]);
    expect(map.size).toBe(2);
    expect(map.get("user-1")?.display_name).toBe("用户1");
    expect(map.get("user-2")?.display_name).toBe("用户2");
  });

  it("fallback 路径：Supabase 未配置时从 userMap 读取", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { getProfilesByIds } = await import("@/lib/api/profile");
    const map = await getProfilesByIds(["user-1", "user-2", "unknown"]);
    expect(map.size).toBe(2);
    expect(map.get("user-1")?.id).toBe("user-1");
    expect(map.get("user-2")?.id).toBe("user-2");
    expect(map.has("unknown")).toBe(false);
  });
});

// ============================================================
// E. hydrate 工具
// ============================================================
describe("E. hydrate 工具", () => {
  it("hydrateUsers 回填 user 字段", async () => {
    const rows = [profileRow({ id: "user-1", display_name: "回填用户" })];
    supabaseMock.current = makeTableBasedFake({ profiles: () => rows });

    const { hydrateUsers } = await import("@/lib/api/profile");
    const items = [{ id: "x", user_id: "user-1" }] as Array<{ id: string; user_id: string; user?: User }>;
    await hydrateUsers(items);
    expect(items[0].user?.display_name).toBe("回填用户");
  });

  it("hydrateUsers 不覆盖已有 user", async () => {
    supabaseMock.current = makeTableBasedFake({ profiles: () => [] });

    const { hydrateUsers } = await import("@/lib/api/profile");
    const existingUser: User = {
      id: "user-1", display_name: "Mock用户", avatar_url: undefined,
      city: undefined, bio: undefined, onboarding_completed: true, created_at: "",
    };
    const items = [{ id: "x", user_id: "user-1", user: existingUser }];
    await hydrateUsers(items);
    expect(items[0].user?.display_name).toBe("Mock用户");
  });

  it("hydrateMessageUsers 回填 reply_to_user", async () => {
    const userRows = [
      profileRow({ id: "user-1", display_name: "作者" }),
      profileRow({ id: "user-2", display_name: "被回复者" }),
    ];
    supabaseMock.current = makeTableBasedFake({ profiles: () => userRows });

    const { hydrateMessageUsers } = await import("@/lib/api/profile");
    const msg: {
      id: string; user_id: string; user?: User; reply_to_id?: string; reply_to_user?: User;
    } = { id: "msg-2", user_id: "user-2", reply_to_id: "msg-1" };
    const all = [{ id: "msg-1", user_id: "user-1" }, { id: "msg-2", user_id: "user-2" }];
    await hydrateMessageUsers(msg, all as never);
    expect(msg.user?.display_name).toBeDefined();
    expect(msg.reply_to_user?.display_name).toBeDefined();
  });
});

// ============================================================
// F. Post user enrichment
// ============================================================
describe("F. Post user enrichment", () => {
  it("buddyPosts Supabase 路径：返回的帖子已带 user", async () => {
    const userRows = [profileRow({ id: "user-1", display_name: "楼主用户" })];
    supabaseMock.current = makeTableBasedFake({
      buddy_posts: () => [{
        id: "bp-1", show_id: "show-4", user_id: "user-1",
        content: "求带", tags: ["一起看演出"],
        created_at: "2026-08-15T10:00:00Z",
      }],
      profiles: () => userRows,
    });

    const { getBuddyPosts } = await import("@/lib/api/posts/buddyPosts");
    const list = await getBuddyPosts("show-4");
    expect(list.length).toBe(1);
    expect(list[0].user?.display_name).toBe("楼主用户");
  });

  it("livePosts Supabase 路径：已带 user", async () => {
    const userRows = [profileRow({ id: "user-3", display_name: "现场用户" })];
    supabaseMock.current = makeTableBasedFake({
      live_posts: () => [{
        id: "lp-1", show_id: "show-4", user_id: "user-3",
        content: "现场太棒了", image_urls: [], video_url: null, video_platform: null,
        created_at: "2026-08-15T10:00:00Z",
      }],
      profiles: () => userRows,
    });

    const { getLivePosts } = await import("@/lib/api/posts/livePosts");
    const list = await getLivePosts("show-4");
    expect(list[0].user?.display_name).toBe("现场用户");
  });

  it("ticketPosts createSupabase 路径：返回的帖子已带 user", async () => {
    const userRows = [profileRow({ id: "user-1", display_name: "出票人" })];
    supabaseMock.current = makeTableBasedFake({
      ticket_posts: () => ({
        id: "tp-new", show_id: "show-4", user_id: "user-1",
        type: "selling", quantity: 1, face_value: 100, price: 90,
        note: "", status: "active",
        created_at: "2026-08-15T10:00:00Z", updated_at: "2026-08-15T10:00:00Z",
      }),
      profiles: () => userRows,
    });

    const { createTicketPost } = await import("@/lib/api/posts/ticketPosts");
    const { TicketPostType } = await import("@/lib/types");
    const post = await createTicketPost("show-4", "user-1", {
      type: TicketPostType.SELLING, quantity: 1, faceValue: 100, price: 90,
    });
    expect(post.user?.display_name).toBe("出票人");
  });
});

// ============================================================
// G. Comment user enrichment
// ============================================================
describe("G. Comment user enrichment", () => {
  it("buddyPostComments Supabase 路径：评论已带 user", async () => {
    const userRows = [profileRow({ id: "user-3", display_name: "评论人" })];
    supabaseMock.current = makeTableBasedFake({
      buddy_post_comments: () => [{
        id: "bpc-1", buddy_post_id: "bp-1", user_id: "user-3",
        content: "我也住浦东", created_at: "2026-08-15T10:30:00Z",
      }],
      profiles: () => userRows,
    });

    const { getBuddyPostComments } = await import("@/lib/api/posts/buddyPosts");
    const list = await getBuddyPostComments("bp-1");
    expect(list[0].user?.display_name).toBe("评论人");
  });
});

// ============================================================
// H. Message user enrichment
// ============================================================
describe("H. Message user enrichment", () => {
  it("messages Supabase 路径：已带 user + reply_to_user", async () => {
    const userRows = [
      profileRow({ id: "user-1", display_name: "回复目标" }),
      profileRow({ id: "user-2", display_name: "回复者" }),
    ];
    supabaseMock.current = makeTableBasedFake({
      discussion_messages: () => [
        { id: "msg-1", room_id: "room-1", user_id: "user-1", content: "原消息", reply_to_id: null, created_at: "2026-08-15T10:00:00Z" },
        { id: "msg-2", room_id: "room-1", user_id: "user-2", content: "回复", reply_to_id: "msg-1", created_at: "2026-08-15T10:05:00Z" },
      ],
      profiles: () => userRows,
      show_rooms: () => ({ id: "room-1", show_id: "show-4", created_at: "2026-08-15T10:00:00Z" }),
    });

    const { getMessages } = await import("@/lib/api/messages");
    const list = await getMessages("show-4");
    expect(list.length).toBe(2);
    expect(list[0].user?.display_name).toBe("回复目标");
    expect(list[1].user?.display_name).toBe("回复者");
    expect(list[1].reply_to_user?.display_name).toBe("回复目标");
  });
});

// ============================================================
// I. User API 对外契约
// ============================================================
describe("I. user.ts 对外契约", () => {
  it("re-exports followArtist / unfollowArtist / isFollowing", async () => {
    const userApi = await import("@/lib/api/user");
    expect(typeof userApi.followArtist).toBe("function");
    expect(typeof userApi.unfollowArtist).toBe("function");
    expect(typeof userApi.isFollowing).toBe("function");
  });

  it("getUser 兼容 mock 路径", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    const { getUser } = await import("@/lib/api/user");
    const user = await getUser("user-1");
    expect(user?.id).toBe("user-1");
    expect(user?.display_name).toBeDefined();
  });
});

// ============================================================
// J. database.types.ts profiles 预留画像字段
// ============================================================
describe("J. database.types.ts profiles 预留画像字段", () => {
  it("profiles.Row 包含 AI 推荐预留字段", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("music_preferences");
    expect(content).toContain("favorite_artists");
    expect(content).toContain("favorite_genres");
    expect(content).toContain("attendance_history");
    expect(content).toContain("interaction_tags");
  });

  it("profiles.Insert / Update 同样包含预留字段", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("favorite_artists?: string[]");
    expect(content).toContain("favorite_genres?: string[]");
  });
});

// ============================================================
// K. 回归 — mock 数据路径不受影响
// ============================================================
describe("K. 回归 — mock 数据路径不受影响", () => {
  it("getUser 未命中时返回 null", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    const { getUser } = await import("@/lib/api/user");
    const user = await getUser("non-existing-user-xyz");
    expect(user).toBeNull();
  });

  it("buddyPosts fallback 路径返回 mock 数据", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    const { getBuddyPosts } = await import("@/lib/api/posts/buddyPosts");
    const list = await getBuddyPosts("show-4");
    expect(Array.isArray(list)).toBe(true);
    if (list.length > 0) expect(list[0].user).toBeDefined();
  });

  it("messages fallback 路径正常返回消息", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    const { getMessages } = await import("@/lib/api/messages");
    const list = await getMessages("show-4");
    expect(Array.isArray(list)).toBe(true);
    for (const m of list) {
      expect(m.user).toBeDefined();
      expect(m.user?.id).toBeDefined();
    }
  });
});
