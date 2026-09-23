/**
 * P10.5 行为测试 — 用户行为数据体系与个性化推荐基础建设
 *
 * 覆盖：
 * A. 事件模型与架构分层
 * B. trackEvent — 事件追踪（mock 路径）
 * C. trackEvent — Supabase 路径
 * D. trackEvent — 失败不阻塞主流程
 * E. getUserEvents — 查询用户事件
 * F. 业务接入验证 — followArtist / joinRoom / createPost / sendMessage / setShowStatus
 * G. getUserInterestProfile — 兴趣画像计算
 * H. API 契约与 fallback 回归
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { useUserStore } from "@/lib/stores/useUserStore";
import { EventType, TargetType, UserShowStatus } from "@/lib/types";

// 固定"当前时间"：show-12 是测试锚定的未来演出（2026-09-20T20:00+08:00）。
// 仅替换全局 Date 时钟（不用 vi.useFakeTimers，避免影响 Promise/timer 行为），
// 使测试不随真实日期滚动而失效
const RealDate = Date;
const FIXED_NOW = new RealDate("2026-09-18T12:00:00+08:00").getTime();
class FixedDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) {
      super(FIXED_NOW);
    } else {
      super(...(args as unknown as ConstructorParameters<typeof RealDate>));
    }
  }
  static now(): number {
    return FIXED_NOW;
  }
}
beforeEach(() => {
  (globalThis as { Date: unknown }).Date = FixedDate;
});
afterEach(() => {
  (globalThis as { Date: unknown }).Date = RealDate;
});

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

  // 重置 mock 事件
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
// A. 事件模型与架构分层
// ============================================================
describe("A. 事件模型与架构分层", () => {
  it("events.ts 存在", () => {
    expect(existsSync(resolve(SRC, "lib/api/events.ts"))).toBe(true);
  });

  it("EventType 枚举包含所有核心事件类型", () => {
    expect(EventType.SHOW_VIEW).toBe("show_view");
    expect(EventType.SHOW_INTEREST).toBe("show_interest");
    expect(EventType.SHOW_ATTEND).toBe("show_attend");
    expect(EventType.ARTIST_FOLLOW).toBe("artist_follow");
    expect(EventType.ROOM_JOIN).toBe("room_join");
    expect(EventType.POST_CREATE).toBe("post_create");
    expect(EventType.COMMENT_CREATE).toBe("comment_create");
    expect(EventType.MESSAGE_SEND).toBe("message_send");
    // P10.5.1 新增
    expect(EventType.TICKET_PURCHASE).toBe("ticket_purchase");
    expect(EventType.TICKET_TRANSFER).toBe("ticket_transfer");
    expect(EventType.COMPANION_MATCH).toBe("companion_match");
  });

  it("TargetType 枚举包含所有目标类型", () => {
    expect(TargetType.SHOW).toBe("show");
    expect(TargetType.ARTIST).toBe("artist");
    expect(TargetType.ROOM).toBe("room");
    expect(TargetType.POST).toBe("post");
    expect(TargetType.COMMENT).toBe("comment");
    expect(TargetType.MESSAGE).toBe("message");
  });

  it("database.types.ts 包含 user_events 表定义", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("user_events");
    expect(content).toContain("event_type");
    expect(content).toContain("target_type");
    expect(content).toContain("target_id");
    expect(content).toContain("metadata");
  });

  it("publicData.ts 包含 userEventsFrom 和 adapter", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("userEventsFrom");
    expect(content).toContain("userEventRowToUserEvent");
  });

  it("events.ts 不包含 'as any'", () => {
    const content = read("src/lib/api/events.ts");
    expect(content).not.toContain("as any");
  });

  it("业务模块 import trackEvent", () => {
    expect(read("src/lib/api/follows.ts")).toContain("trackEvent");
    expect(read("src/lib/api/rooms.ts")).toContain("trackEvent");
    expect(read("src/lib/api/posts/buddyPosts.ts")).toContain("trackEvent");
    expect(read("src/lib/api/posts/ticketPosts.ts")).toContain("trackEvent");
    expect(read("src/lib/api/posts/livePosts.ts")).toContain("trackEvent");
    expect(read("src/lib/api/messages.ts")).toContain("trackEvent");
    expect(read("src/lib/api/user.ts")).toContain("trackEvent");
  });
});

// ============================================================
// B. trackEvent — mock 路径
// ============================================================
describe("B. trackEvent — mock 路径", () => {
  it("未配置 Supabase 时写入内存", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { trackEvent, __getMockEventCount } = await import("@/lib/api/events");
    await trackEvent("user-1", EventType.ARTIST_FOLLOW, TargetType.ARTIST, "artist-1");
    expect(__getMockEventCount()).toBe(1);
  });

  it("带 metadata 的事件正确存储", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { trackEvent, getUserEvents } = await import("@/lib/api/events");
    await trackEvent("user-1", EventType.POST_CREATE, TargetType.POST, "bp-1", {
      show_id: "show-4",
      post_type: "buddy",
    });
    const events = await getUserEvents("user-1");
    expect(events.length).toBe(1);
    expect(events[0].metadata).toEqual({ show_id: "show-4", post_type: "buddy" });
  });

  it("P10.5.1 新增事件类型可正常 track", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { trackEvent, getUserEvents } = await import("@/lib/api/events");
    await trackEvent("user-1", EventType.TICKET_PURCHASE, TargetType.SHOW, "show-4", { price: 120 });
    await trackEvent("user-1", EventType.TICKET_TRANSFER, TargetType.POST, "tp-1", { price: 90 });
    await trackEvent("user-1", EventType.COMPANION_MATCH, TargetType.POST, "bp-1", { matched_user: "user-2" });

    const events = await getUserEvents("user-1");
    expect(events.length).toBe(3);
    expect(events.some((e) => e.event_type === EventType.TICKET_PURCHASE)).toBe(true);
    expect(events.some((e) => e.event_type === EventType.TICKET_TRANSFER)).toBe(true);
    expect(events.some((e) => e.event_type === EventType.COMPANION_MATCH)).toBe(true);
  });
});

// ============================================================
// C. trackEvent — Supabase 路径
// ============================================================
describe("C. trackEvent — Supabase 路径", () => {
  it("配置 Supabase 时写入 user_events 表", async () => {
    let insertedPayload: Record<string, unknown> | null = null;
    supabaseMock.current = {
      from: vi.fn((name: string) => {
        if (name === "user_events") {
          const chain = makeChain(null);
          // 捕获 insert 参数
          const originalInsert = chain.insert;
          chain.insert = vi.fn((payload?: unknown) => {
            insertedPayload = payload as Record<string, unknown>;
            return originalInsert();
          });
          return chain;
        }
        return makeChain(null);
      }),
    };

    const { trackEvent } = await import("@/lib/api/events");
    await trackEvent("user-1", EventType.ROOM_JOIN, TargetType.ROOM, "room-1", { show_id: "show-4" });

    expect(insertedPayload).not.toBeNull();
    expect(insertedPayload!.user_id).toBe("user-1");
    expect(insertedPayload!.event_type).toBe(EventType.ROOM_JOIN);
    expect(insertedPayload!.target_type).toBe(TargetType.ROOM);
    expect(insertedPayload!.target_id).toBe("room-1");
  });
});

// ============================================================
// D. trackEvent — 失败不阻塞
// ============================================================
describe("D. trackEvent — 失败不阻塞", () => {
  it("Supabase insert 报错时不 throw", async () => {
    supabaseMock.current = {
      from: vi.fn(() => {
        const chain = makeChain(null, new Error("network error"));
        return chain;
      }),
    };

    const { trackEvent, __getMockEventCount } = await import("@/lib/api/events");
    // 不应 throw
    await expect(
      trackEvent("user-1", EventType.POST_CREATE, TargetType.POST, "bp-1")
    ).resolves.toBeUndefined();
    // 降级到内存
    expect(__getMockEventCount()).toBe(1);
  });
});

// ============================================================
// E. getUserEvents — 查询用户事件
// ============================================================
describe("E. getUserEvents", () => {
  it("Supabase 路径：返回用户事件列表", async () => {
    const eventRows = [
      { id: "evt-1", user_id: "user-1", event_type: "artist_follow", target_type: "artist", target_id: "artist-1", metadata: null, created_at: "2026-08-15T10:00:00Z" },
      { id: "evt-2", user_id: "user-1", event_type: "room_join", target_type: "room", target_id: "room-1", metadata: { show_id: "show-4" }, created_at: "2026-08-15T11:00:00Z" },
    ];
    supabaseMock.current = makeTableBasedFake({ user_events: () => eventRows });

    const { getUserEvents } = await import("@/lib/api/events");
    const events = await getUserEvents("user-1");
    expect(events.length).toBe(2);
    expect(events[0].event_type).toBe(EventType.ARTIST_FOLLOW);
    expect(events[1].event_type).toBe(EventType.ROOM_JOIN);
  });

  it("按 eventType 筛选", async () => {
    const eventRows = [
      { id: "evt-1", user_id: "user-1", event_type: "artist_follow", target_type: "artist", target_id: "artist-1", metadata: null, created_at: "2026-08-15T10:00:00Z" },
    ];
    supabaseMock.current = makeTableBasedFake({ user_events: () => eventRows });

    const { getUserEvents } = await import("@/lib/api/events");
    const events = await getUserEvents("user-1", EventType.ARTIST_FOLLOW);
    expect(events.length).toBe(1);
    expect(events[0].event_type).toBe(EventType.ARTIST_FOLLOW);
  });

  it("fallback 路径：从内存读取", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { trackEvent, getUserEvents } = await import("@/lib/api/events");
    await trackEvent("user-1", EventType.ARTIST_FOLLOW, TargetType.ARTIST, "artist-1");
    await trackEvent("user-1", EventType.POST_CREATE, TargetType.POST, "bp-1");
    await trackEvent("user-2", EventType.ROOM_JOIN, TargetType.ROOM, "room-1");

    const user1Events = await getUserEvents("user-1");
    expect(user1Events.length).toBe(2);

    const user2Events = await getUserEvents("user-2");
    expect(user2Events.length).toBe(1);
  });
});

// ============================================================
// F. 业务接入验证
// ============================================================
describe("F. 业务接入验证", () => {
  it("followArtist 成功后记录 artist_follow 事件", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { followArtist } = await import("@/lib/api/follows");
    const { getUserEvents } = await import("@/lib/api/events");
    await followArtist("user-1", "artist-1");

    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.ARTIST_FOLLOW && e.target_id === "artist-1")).toBe(true);
  });

  it("joinRoom 成功后记录 room_join 事件", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { joinRoom } = await import("@/lib/api/rooms");
    const { getUserEvents } = await import("@/lib/api/events");
    await joinRoom("show-1", "user-1");

    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.ROOM_JOIN)).toBe(true);
  });

  it("createBuddyPost 成功后记录 post_create 事件", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { createBuddyPost } = await import("@/lib/api/posts/buddyPosts");
    const { getUserEvents } = await import("@/lib/api/events");
    await createBuddyPost("show-4", "user-1", { content: "求搭子", tags: [] });

    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.POST_CREATE)).toBe(true);
  });

  it("createTicketPost 成功后记录 post_create 事件", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { createTicketPost } = await import("@/lib/api/posts/ticketPosts");
    const { getUserEvents } = await import("@/lib/api/events");
    const { TicketPostType } = await import("@/lib/types");
    await createTicketPost("show-4", "user-1", {
      type: TicketPostType.SELLING, quantity: 1, faceValue: 100, price: 90,
    });

    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.POST_CREATE)).toBe(true);
  });

  it("createLivePost 成功后记录 post_create 事件", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { createLivePost } = await import("@/lib/api/posts/livePosts");
    const { getUserEvents } = await import("@/lib/api/events");
    await createLivePost("show-4", "user-1", { content: "现场太棒了" });

    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.POST_CREATE)).toBe(true);
  });

  it("replyBuddyPost 成功后记录 comment_create 事件", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { replyBuddyPost } = await import("@/lib/api/posts/buddyPosts");
    const { getUserEvents } = await import("@/lib/api/events");
    await replyBuddyPost("bp-1", "user-1", "我也去！");

    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.COMMENT_CREATE)).toBe(true);
  });

  it("sendMessage 成功后记录 message_send 事件", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { sendMessage } = await import("@/lib/api/messages");
    const { getUserEvents } = await import("@/lib/api/events");
    // P10.6.2 + 日期驱动生命周期：使用未来演出（show-12，2026-09-20），
    // ENDED/日期已过演出已禁止发消息
    await sendMessage("show-12", "user-1", "大家好");

    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.MESSAGE_SEND)).toBe(true);
  });

  it("setShowStatus 成功后记录 show_interest / show_attend 事件", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { setShowStatus } = await import("@/lib/api/user");
    const { getUserEvents } = await import("@/lib/api/events");
    await setShowStatus("user-1", "show-10", UserShowStatus.INTERESTED);
    await setShowStatus("user-1", "show-11", UserShowStatus.ATTENDED);

    const events = await getUserEvents("user-1");
    expect(events.some((e) => e.event_type === EventType.SHOW_INTEREST && e.target_id === "show-10")).toBe(true);
    expect(events.some((e) => e.event_type === EventType.SHOW_ATTEND && e.target_id === "show-11")).toBe(true);
  });
});

// ============================================================
// G. getUserInterestProfile — 兴趣画像计算
// ============================================================
describe("G. getUserInterestProfile", () => {
  it("返回完整兴趣画像结构", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { getUserInterestProfile } = await import("@/lib/api/events");
    const profile = await getUserInterestProfile("user-1");

    expect(profile).toHaveProperty("favoriteArtists");
    expect(profile).toHaveProperty("favoriteGenres");
    expect(profile).toHaveProperty("attendedShows");
    expect(profile).toHaveProperty("activeCommunities");
    expect(profile).toHaveProperty("engagementScore");
    expect(Array.isArray(profile.favoriteArtists)).toBe(true);
    expect(Array.isArray(profile.favoriteGenres)).toBe(true);
    expect(Array.isArray(profile.attendedShows)).toBe(true);
    expect(Array.isArray(profile.activeCommunities)).toBe(true);
    expect(typeof profile.engagementScore).toBe("number");
  });

  it("engagementScore 在 0-100 范围内", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    const { trackEvent, getUserInterestProfile } = await import("@/lib/api/events");
    // 生成一些事件
    await trackEvent("user-1", EventType.ARTIST_FOLLOW, TargetType.ARTIST, "artist-1");
    await trackEvent("user-1", EventType.POST_CREATE, TargetType.POST, "bp-1");
    await trackEvent("user-1", EventType.ROOM_JOIN, TargetType.ROOM, "room-1");

    const profile = await getUserInterestProfile("user-1");
    expect(profile.engagementScore).toBeGreaterThanOrEqual(0);
    expect(profile.engagementScore).toBeLessThanOrEqual(100);
  });

  it("未登录用户返回空画像", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];

    const { getUserInterestProfile } = await import("@/lib/api/events");
    const profile = await getUserInterestProfile("user-xyz");
    expect(profile.favoriteArtists).toEqual([]);
    expect(profile.favoriteGenres).toEqual([]);
    expect(profile.engagementScore).toBeGreaterThanOrEqual(0);
  });
});

// ============================================================
// H. API 契约与 fallback 回归
// ============================================================
describe("H. API 契约与 fallback 回归", () => {
  it("trackEvent 签名：接受 5 个参数", async () => {
    const { trackEvent } = await import("@/lib/api/events");
    expect(typeof trackEvent).toBe("function");
    // 验证不会 throw
    await expect(
      trackEvent("user-1", EventType.SHOW_VIEW, TargetType.SHOW, "show-1", { source: "home" })
    ).resolves.toBeUndefined();
  });

  it("getUserEvents 签名：接受 userId + 可选参数", async () => {
    const { getUserEvents } = await import("@/lib/api/events");
    expect(typeof getUserEvents).toBe("function");
    const events = await getUserEvents("user-1");
    expect(Array.isArray(events)).toBe(true);
  });

  it("getUserInterestProfile 签名：接受 userId", async () => {
    const { getUserInterestProfile } = await import("@/lib/api/events");
    expect(typeof getUserInterestProfile).toBe("function");
    const profile = await getUserInterestProfile("user-1");
    expect(profile).toBeDefined();
  });

  it("事件追踪不影响主业务流程", async () => {
    delete process.env[ENV_URL];
    delete process.env[ENV_KEY];
    mockLoggedIn("user-1");

    // 即使 trackEvent 内部出错，followArtist 仍应成功
    const { followArtist } = await import("@/lib/api/follows");
    const result = await followArtist("user-1", "artist-1");
    expect(result).toBeDefined();
    expect(result.artist_id).toBe("artist-1");
  });
});
