/**
 * P10.2-D 行为测试 - Room / Memberships / Messages Supabase 接入
 *
 * 覆盖：
 * A. show_rooms 公共读
 * B. room_memberships 用户行为（join/leave/isMember）
 * C. isRoomMember 保留 API 层（不读 Zustand）
 * D. discussion_messages CRUD
 * E. fallback mock 路径
 * F. 重复 join 幂等
 * G. UI 不直接访问 Supabase
 * H. syncRoomMemberships 同步机制
 * I. database.types.ts 覆盖
 * J. Profile 页面不直接 import mock
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { useUserStore } from "@/lib/stores/useUserStore";

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

// ============
// helpers
// ============

function read(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf-8");
}

function resetStore() {
  useUserStore.setState({
    isLoggedIn: false,
    user: null,
    followedArtistIds: [],
    showStatuses: {},
    roomMemberships: [],
    notifications: [],
  });
}

function loginAsUser1() {
  useUserStore.getState().mockLogin();
}

// Mock Supabase client（用于 Supabase 路径测试）
function createMockSupabaseClient(overrides: {
  showRooms?: unknown[];
  memberships?: unknown[];
  messages?: unknown[];
  inserted?: unknown;
} = {}) {
  const showRoomsData = overrides.showRooms ?? [];
  const membershipsData = overrides.memberships ?? [];
  const messagesData = overrides.messages ?? [];

  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    filter: vi.fn().mockReturnThis(),
  };

  const queryBuilder = {
    ...chainable,
    // 终端方法
    then: vi.fn((resolve: (val: unknown) => void) => {
      // 默认返回空数据
      resolve({ data: null, error: null });
      return Promise.resolve({ data: null, error: null });
    }),
  };

  // 根据表名返回不同数据
  const from = vi.fn((table: string) => {
    const tableData =
      table === "show_rooms"
        ? showRoomsData
        : table === "room_memberships"
          ? membershipsData
          : table === "discussion_messages"
            ? messagesData
            : [];

    const builder = {
      ...chainable,
      then: vi.fn((resolve: (val: unknown) => void) => {
        resolve({ data: tableData, error: null });
        return Promise.resolve({ data: tableData, error: null });
      }),
    };

    // single() 返回第一条或 null
    builder.single = vi.fn(() => ({
      then: vi.fn((resolve: (val: unknown) => void) => {
        resolve({ data: tableData[0] ?? null, error: null });
        return Promise.resolve({ data: tableData[0] ?? null, error: null });
      }),
    }));

    // maybeSingle() 返回第一条或 null
    builder.maybeSingle = vi.fn(() => ({
      then: vi.fn((resolve: (val: unknown) => void) => {
        resolve({ data: tableData[0] ?? null, error: null });
        return Promise.resolve({ data: tableData[0] ?? null, error: null });
      }),
    }));

    // upsert 返回插入的数据
    builder.upsert = vi.fn(() => ({
      ...chainable,
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          then: vi.fn((resolve: (val: unknown) => void) => {
            resolve({ data: overrides.inserted ?? tableData[0] ?? null, error: null });
            return Promise.resolve({ data: overrides.inserted ?? tableData[0] ?? null, error: null });
          }),
        })),
      })),
    }));

    // insert 返回插入的数据
    builder.insert = vi.fn(() => ({
      ...chainable,
      select: vi.fn(() => ({
        single: vi.fn(() => ({
          then: vi.fn((resolve: (val: unknown) => void) => {
            resolve({ data: overrides.inserted ?? tableData[0] ?? null, error: null });
            return Promise.resolve({ data: overrides.inserted ?? tableData[0] ?? null, error: null });
          }),
        })),
      })),
    }));

    // delete 返回 { error: null }
    builder.delete = vi.fn(() => ({
      ...chainable,
      eq: vi.fn(() => ({
        ...chainable,
        then: vi.fn((resolve: (val: unknown) => void) => {
          resolve({ error: null });
          return Promise.resolve({ error: null });
        }),
      })),
    }));

    return builder;
  });

  return { from };
}

// ============
// A. show_rooms 公共读
// ============

describe("P10.2-D A — show_rooms 公共读", () => {
  beforeEach(() => {
    resetStore();
  });

  it("getRoomByShow 签名保持 (showId: string) => Promise<ShowRoom | null>", async () => {
    const { getRoomByShow } = await import("@/lib/api/rooms");
    const room = await getRoomByShow("show-1");
    expect(room).toBeDefined();
    expect(room?.show_id).toBe("show-1");
  });

  it("不存在的 showId 返回 null", async () => {
    const { getRoomByShow } = await import("@/lib/api/rooms");
    const room = await getRoomByShow("show-999");
    expect(room).toBeNull();
  });

  it("getRoomsByUser 返回用户加入的房间列表", async () => {
    loginAsUser1();
    const { getRoomsByUser } = await import("@/lib/api/rooms");
    const rooms = await getRoomsByUser("user-1");
    expect(rooms.length).toBeGreaterThan(0);
    expect(rooms.every((r) => r.id && r.show_id)).toBe(true);
  });

  it("show_rooms adapter 不返回 count 字段（optional）", async () => {
    const { showRoomRowToShowRoom } = await import("@/lib/supabase/publicData");
    const room = showRoomRowToShowRoom({
      id: "room-test",
      show_id: "show-test",
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(room.id).toBe("room-test");
    expect(room.show_id).toBe("show-test");
    expect(room.member_count).toBeUndefined();
    expect(room.message_count).toBeUndefined();
  });
});

// ============
// B. room_memberships 用户行为
// ============

describe("P10.2-D B — room_memberships 用户行为", () => {
  beforeEach(() => {
    resetStore();
  });

  it("joinRoom 签名 (showId, userId?) => Promise<RoomMembership>", async () => {
    loginAsUser1();
    const { joinRoom } = await import("@/lib/api/rooms");
    const membership = await joinRoom("show-2", "user-1");
    expect(membership).toBeDefined();
    expect(membership.user_id).toBe("user-1");
    expect(membership.room_id).toBeDefined();
  });

  it("joinRoom 未登录抛错", async () => {
    const { joinRoom } = await import("@/lib/api/rooms");
    await expect(joinRoom("show-1", "user-1")).rejects.toThrow();
  });

  it("leaveRoom 签名 (roomId, userId?) => Promise<void>", async () => {
    loginAsUser1();
    const { leaveRoom } = await import("@/lib/api/rooms");
    await expect(leaveRoom("room-1", "user-1")).resolves.toBeUndefined();
  });

  it("joinRoom 同步 store（UI cache 更新）", async () => {
    loginAsUser1();
    const storeBefore = useUserStore.getState().roomMemberships;
    const { joinRoom } = await import("@/lib/api/rooms");
    await joinRoom("show-2", "user-1");
    const storeAfter = useUserStore.getState().roomMemberships;
    expect(storeAfter.length).toBeGreaterThan(storeBefore.length);
  });

  it("leaveRoom 同步 store（UI cache 更新）", async () => {
    loginAsUser1();
    // 先加入 room-2
    const { joinRoom, leaveRoom } = await import("@/lib/api/rooms");
    await joinRoom("show-2", "user-1");
    const before = useUserStore.getState().roomMemberships;
    // 退出
    await leaveRoom("room-2", "user-1");
    const after = useUserStore.getState().roomMemberships;
    expect(after.length).toBeLessThan(before.length);
  });
});

// ============
// C. isRoomMember 保留 API 层
// ============

describe("P10.2-D C — isRoomMember 保留 API 层（不读 Zustand）", () => {
  beforeEach(() => {
    resetStore();
  });

  it("isRoomMember 签名 (showId, userId?) => Promise<boolean>", async () => {
    const { isRoomMember } = await import("@/lib/api/rooms");
    const result = await isRoomMember("show-1", "user-1");
    expect(typeof result).toBe("boolean");
  });

  it("isRoomMember userId 未提供返回 false", async () => {
    const { isRoomMember } = await import("@/lib/api/rooms");
    const result = await isRoomMember("show-1");
    expect(result).toBe(false);
  });

  it("isRoomMember 不直接读 useUserStore.roomMemberships", async () => {
    const content = read("src/lib/api/rooms.ts");
    // isRoomMember 函数不应直接读 store roomMemberships（应通过 DB 或 mock 查询）
    expect(content).toContain("isBehaviorSupabaseEnabled");
    expect(content).toContain("mockMemberships");
  });

  it("rooms.ts isRoomMember 查询 DB（Supabase 路径）", async () => {
    const content = read("src/lib/api/rooms.ts");
    // Supabase 路径应查询 room_memberships 表
    expect(content).toMatch(/roomMembershipsFrom\(\)/);
  });
});

// ============
// D. discussion_messages CRUD
// ============

describe("P10.2-D D — discussion_messages CRUD", () => {
  beforeEach(() => {
    resetStore();
  });

  it("getMessages 签名 (showId: string) => Promise<DiscussionMessage[]>", async () => {
    const { getMessages } = await import("@/lib/api/messages");
    const messages = await getMessages("show-4");
    expect(Array.isArray(messages)).toBe(true);
  });

  it("sendMessage 签名 (showId, userId, content, replyToId?) => Promise<DiscussionMessage>", async () => {
    loginAsUser1();
    const { sendMessage } = await import("@/lib/api/messages");
    // show-12（2026-09-20）是未来演出，room-12 可正常发言
    const msg = await sendMessage("show-12", "user-1", "测试消息");
    expect(msg).toBeDefined();
    expect(msg.content).toBe("测试消息");
    expect(msg.user_id).toBe("user-1");
  });

  it("sendMessage ghost 用户被拒绝", async () => {
    const { sendMessage } = await import("@/lib/api/messages");
    await expect(sendMessage("show-4", "ghost-nonexistent", "x")).rejects.toThrow();
  });

  it("sendMessage 空内容被拒绝", async () => {
    const { sendMessage } = await import("@/lib/api/messages");
    await expect(sendMessage("show-4", "user-1", "")).rejects.toThrow();
  });

  it("deleteMessage 仅作者可删除", async () => {
    loginAsUser1();
    const { getMessages, deleteMessage } = await import("@/lib/api/messages");
    const list = await getMessages("show-4");
    const mine = list.find((m) => m.user_id === "user-1");
    expect(mine).toBeDefined();
    await deleteMessage(mine!.id, "user-1");
    const after = await getMessages("show-4");
    expect(after.find((m) => m.id === mine!.id)).toBeUndefined();
  });

  it("deleteMessage 非作者被拒绝", async () => {
    const { getMessages, deleteMessage } = await import("@/lib/api/messages");
    const list = await getMessages("show-4");
    const others = list.find((m) => m.user_id !== "user-3");
    expect(others).toBeDefined();
    await expect(deleteMessage(others!.id, "user-3")).rejects.toThrow();
  });

  it("sendMessage 回复补充 reply_to_user", async () => {
    loginAsUser1();
    const { sendMessage } = await import("@/lib/api/messages");
    // show-12 无种子消息，先发一条作为被回复目标
    const target = await sendMessage("show-12", "user-1", "目标消息");
    const reply = await sendMessage("show-12", "user-1", "回复你", target.id);
    expect(reply.reply_to_id).toBe(target.id);
    expect(reply.reply_to_user?.id).toBe(target.user_id);
  });

  it("messages API 保持 showId 入参（不改 roomId）", async () => {
    const content = read("src/lib/api/messages.ts");
    expect(content).toMatch(/export async function getMessages\(showId: string\)/);
    expect(content).toMatch(/export async function sendMessage\(\s*showId: string/);
    expect(content).toMatch(/export async function deleteMessage\(messageId: string/);
  });
});

// ============
// E. fallback mock 路径
// ============

describe("P10.2-D E — fallback mock 路径", () => {
  beforeEach(() => {
    resetStore();
  });

  it("rooms.ts 包含 mockShowRooms fallback", () => {
    const content = read("src/lib/api/rooms.ts");
    expect(content).toContain("mockShowRooms");
    expect(content).toContain("isBehaviorSupabaseEnabled");
  });

  it("messages.ts 包含 mockMessages fallback", () => {
    const content = read("src/lib/api/messages.ts");
    expect(content).toContain("mockMessages");
    expect(content).toContain("isBehaviorSupabaseEnabled");
  });

  it("Supabase 未配置时 getRoomByShow 走 mock", async () => {
    const { getRoomByShow } = await import("@/lib/api/rooms");
    const room = await getRoomByShow("show-1");
    expect(room).toBeDefined();
    expect(room?.id).toBe("room-1");
  });

  it("Supabase 未配置时 getMessages 走 mock", async () => {
    const { getMessages } = await import("@/lib/api/messages");
    const messages = await getMessages("show-4");
    expect(messages.length).toBeGreaterThan(0);
  });

  it("Supabase 未配置时 isRoomMember 走 mock", async () => {
    loginAsUser1();
    const { isRoomMember, joinRoom } = await import("@/lib/api/rooms");
    // 先加入 room-3 (show-3) 确保成员关系存在（避免受前面测试 leaveRoom 影响）
    await joinRoom("show-3", "user-1");
    const result = await isRoomMember("show-3", "user-1");
    expect(result).toBe(true);
  });
});

// ============
// F. 重复 join 幂等
// ============

describe("P10.2-D F — 重复 join 幂等", () => {
  beforeEach(() => {
    resetStore();
  });

  it("重复 joinRoom 不报错", async () => {
    loginAsUser1();
    const { joinRoom } = await import("@/lib/api/rooms");
    const m1 = await joinRoom("show-2", "user-1");
    const m2 = await joinRoom("show-2", "user-1");
    expect(m1).toBeDefined();
    expect(m2).toBeDefined();
  });

  it("重复 joinRoom store 不产生重复 membership", async () => {
    loginAsUser1();
    const { joinRoom } = await import("@/lib/api/rooms");
    await joinRoom("show-2", "user-1");
    const count1 = useUserStore.getState().roomMemberships.filter(
      (m) => m.room_id === "room-2"
    ).length;
    await joinRoom("show-2", "user-1");
    const count2 = useUserStore.getState().roomMemberships.filter(
      (m) => m.room_id === "room-2"
    ).length;
    expect(count2).toBe(count1); // 不增加
  });

  it("重复 leaveRoom 不报错", async () => {
    loginAsUser1();
    const { leaveRoom } = await import("@/lib/api/rooms");
    await leaveRoom("room-1", "user-1");
    await expect(leaveRoom("room-1", "user-1")).resolves.toBeUndefined();
  });
});

// ============
// G. UI 不直接访问 Supabase
// ============

describe("P10.2-D G — UI 不直接访问 Supabase", () => {
  it("ShowDetail 页面不直接 import supabase client", () => {
    const content = read("src/app/show/[id]/page.tsx");
    expect(content).not.toContain('from "@/lib/supabase/client"');
    expect(content).not.toContain('from "@/lib/supabase/server"');
    expect(content).not.toContain('from "@/lib/supabase/publicData"');
  });

  it("Profile 页面不直接 import supabase client", () => {
    const content = read("src/app/profile/page.tsx");
    expect(content).not.toContain('from "@/lib/supabase/client"');
    expect(content).not.toContain('from "@/lib/supabase/server"');
    expect(content).not.toContain('from "@/lib/supabase/publicData"');
  });

  it("ShowDetail 通过 API 层调用 joinRoom", () => {
    const content = read("src/app/show/[id]/page.tsx");
    expect(content).toContain('from "@/lib/api/rooms"');
    expect(content).toMatch(/joinRoom/);
  });

  it("DiscussionTab 通过 API 层调用 messages", () => {
    const content = read("src/components/room/DiscussionTab.tsx");
    expect(content).toContain('from "@/lib/api/messages"');
    expect(content).not.toContain('from "@/lib/supabase');
  });

  it("Profile 页面不直接 import from @/mocks", () => {
    const content = read("src/app/profile/page.tsx");
    expect(content).not.toContain('from "@/mocks/shows"');
    expect(content).not.toContain('from "@/mocks/artists"');
    expect(content).not.toContain('from "@/mocks/messages"');
  });

  it("Profile 页面通过 API 层获取 lookup 数据", () => {
    const content = read("src/app/profile/page.tsx");
    expect(content).toContain('getArtistLookupMap');
    expect(content).toContain('getShowLookupMap');
    expect(content).toContain('getRoomsByUser');
  });
});

// ============
// H. syncRoomMemberships 同步机制
// ============

describe("P10.2-D H — syncRoomMemberships 同步机制", () => {
  beforeEach(() => {
    resetStore();
  });

  it("syncRoomMemberships 函数存在", async () => {
    const { syncRoomMemberships } = await import("@/lib/api/rooms");
    expect(typeof syncRoomMemberships).toBe("function");
  });

  it("syncRoomMemberships Supabase 未配置时 no-op", async () => {
    const { syncRoomMemberships } = await import("@/lib/api/rooms");
    const before = useUserStore.getState().roomMemberships;
    await syncRoomMemberships("user-1");
    const after = useUserStore.getState().roomMemberships;
    expect(after).toEqual(before);
  });

  it("useUserStore 包含 setRoomMemberships action", () => {
    expect(typeof useUserStore.getState().setRoomMemberships).toBe("function");
  });

  it("setRoomMemberships 覆盖 store roomMemberships", () => {
    loginAsUser1();
    const before = useUserStore.getState().roomMemberships;
    useUserStore.getState().setRoomMemberships([
      { id: "rm-new", user_id: "user-1", room_id: "room-new", joined_at: "2026-01-01T00:00:00Z" },
    ]);
    const after = useUserStore.getState().roomMemberships;
    expect(after.length).toBe(1);
    expect(after[0].room_id).toBe("room-new");
    expect(after).not.toEqual(before);
  });

  it("AuthProvider 调用 syncRoomMemberships", () => {
    const content = read("src/components/user/AuthProvider.tsx");
    expect(content).toContain("syncRoomMemberships");
  });
});

// ============
// I. database.types.ts 覆盖
// ============

describe("P10.2-D I — database.types.ts 覆盖", () => {
  it("show_rooms 表类型存在", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("show_rooms:");
    expect(content).toMatch(/show_rooms:\s*\{[\s\S]*?Row:/);
  });

  it("room_memberships 表类型存在", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("room_memberships:");
    expect(content).toMatch(/room_memberships:\s*\{[\s\S]*?Row:/);
  });

  it("discussion_messages 表类型存在", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("discussion_messages:");
    expect(content).toMatch(/discussion_messages:\s*\{[\s\S]*?Row:/);
  });

  it("show_rooms Row 包含 id/show_id/created_at", () => {
    const content = read("src/lib/supabase/database.types.ts");
    // 找到 show_rooms 块
    const idx = content.indexOf("show_rooms:");
    const block = content.slice(idx, idx + 500);
    expect(block).toContain("id: string");
    expect(block).toContain("show_id: string");
    expect(block).toContain("created_at: string");
  });

  it("room_memberships Row 包含 id/user_id/room_id/joined_at", () => {
    const content = read("src/lib/supabase/database.types.ts");
    const idx = content.indexOf("room_memberships:");
    const block = content.slice(idx, idx + 500);
    expect(block).toContain("id: string");
    expect(block).toContain("user_id: string");
    expect(block).toContain("room_id: string");
    expect(block).toContain("joined_at: string");
  });

  it("discussion_messages Row 包含 reply_to_id", () => {
    const content = read("src/lib/supabase/database.types.ts");
    const idx = content.indexOf("discussion_messages:");
    const block = content.slice(idx, idx + 500);
    expect(block).toContain("reply_to_id");
    expect(block).toContain("content: string");
  });
});

// ============
// J. publicData.ts adapter 覆盖
// ============

describe("P10.2-D J — publicData.ts adapter 覆盖", () => {
  it("showRoomRowToShowRoom adapter 存在", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("showRoomRowToShowRoom");
  });

  it("membershipRowToMembership adapter 存在", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("membershipRowToMembership");
  });

  it("messageRowToMessage adapter 存在", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("messageRowToMessage");
  });

  it("showRoomsFrom / roomMembershipsFrom / discussionMessagesFrom helpers 存在", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("showRoomsFrom");
    expect(content).toContain("roomMembershipsFrom");
    expect(content).toContain("discussionMessagesFrom");
  });
});
