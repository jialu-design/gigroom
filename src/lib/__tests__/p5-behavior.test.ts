/**
 * P5 行为测试 - 观演小屋 四 Tab 核心逻辑
 * 覆盖 Discussion / Buddy / Ticket / Live / Room 权限 / 游客可读不可写
 *
 * 测试策略：
 * - API 层统一使用 showId + 显式 userId，不内部 fallback 到 mockCurrentUser
 * - 所有 mutation API 模块维护内存态，使用 vi.resetModules() + 动态 import
 *   保证每个用例拿到全新的内存态，互不污染
 * - UI 层规则（加入 Room 才能发消息、10 秒 cooldown、游客不可写）由组件强制，
 *   本文件验证其底层契约：isRoomMember 维度、MESSAGE_COOLDOWN_MS 常量、
 *   mutation 必须显式 userId 且作者鉴权在 API 层兜底
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

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

// ========================
// 工具：每个用例重置模块 + 清空 localStorage，拿到全新内存态
// ========================
beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
});

async function fresh() {
  const types = await import("@/lib/types");
  const messages = await import("@/lib/api/messages");
  const buddyPosts = await import("@/lib/api/posts/buddyPosts");
  const ticketPosts = await import("@/lib/api/posts/ticketPosts");
  const livePosts = await import("@/lib/api/posts/livePosts");
  const rooms = await import("@/lib/api/rooms");
  const lifecycle = await import("@/lib/utils/showLifecycle");
  const constants = await import("@/lib/constants");
  const store = await import("@/lib/stores/useUserStore");
  return {
    types,
    messages,
    buddyPosts,
    ticketPosts,
    livePosts,
    rooms,
    lifecycle,
    constants,
    store,
  };
}

// 上海时区日期构造（用于生命周期用例，避免依赖固定系统时钟）
function shanghaiNow(): Date {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + 8 * 60 * 60 * 1000);
}
function pad(n: number): string {
  return String(n).padStart(2, "0");
}
function shanghaiISO(daysOffset: number, hour = 20): string {
  const s = shanghaiNow();
  s.setDate(s.getDate() + daysOffset);
  return `${s.getFullYear()}-${pad(s.getMonth() + 1)}-${pad(s.getDate())}T${pad(hour)}:00:00+08:00`;
}

// ========================
// 1. Discussion 讨论
// ========================
describe("P5 Discussion", () => {
  it("未加入 Room 的用户在权限维度上不是成员（UI 据此拦截发送）", async () => {
    const { rooms } = await fresh();
    // user-3 未加入 show-4 的 room
    const isMember = await rooms.isRoomMember("show-4", "user-3");
    expect(isMember).toBe(false);
    // user-1 已加入 show-4
    const isMemberAuthor = await rooms.isRoomMember("show-4", "user-1");
    expect(isMemberAuthor).toBe(true);
  });

  it("游客（无 userId）不是任何 Room 成员", async () => {
    const { rooms } = await fresh();
    const isMember = await rooms.isRoomMember("show-4");
    expect(isMember).toBe(false);
  });

  it("已加入用户可以发送消息，发送后列表新增", async () => {
    const { messages } = await fresh();
    // show-12（2026-09-20）是未来演出，room-12 可正常发言
    const before = await messages.getMessages("show-12");
    expect(before.length).toBe(0);

    const msg = await messages.sendMessage(
      "show-12",
      "user-1",
      "P5 测试消息"
    );
    expect(msg.content).toBe("P5 测试消息");
    expect(msg.user_id).toBe("user-1");
    expect(msg.room_id).toBe("room-12");

    const after = await messages.getMessages("show-12");
    expect(after.length).toBe(1);
    expect(after.find((m) => m.id === msg.id)).toBeDefined();
  });

  it("回复关系正确：reply_to_id 与 reply_to_user 指向被回复消息", async () => {
    const { messages } = await fresh();
    // show-12 无种子消息，先发一条作为被回复目标
    const target = await messages.sendMessage("show-12", "user-1", "目标消息");
    const reply = await messages.sendMessage(
      "show-12",
      "user-3",
      "回复你",
      target.id
    );
    expect(reply.reply_to_id).toBe(target.id);
    expect(reply.reply_to_user?.id).toBe(target.user_id);
  });

  it("10 秒 cooldown 常量正确（UI 层强制）", async () => {
    const { constants } = await fresh();
    expect(constants.MESSAGE_COOLDOWN_MS).toBe(10_000);
  });

  it("作者可以删除自己的消息", async () => {
    const { messages } = await fresh();
    const before = await messages.getMessages("show-4");
    const mine = before.find((m) => m.user_id === "user-1");
    expect(mine).toBeDefined();

    await messages.deleteMessage(mine!.id, "user-1");
    const after = await messages.getMessages("show-4");
    expect(after.length).toBe(before.length - 1);
    expect(after.find((m) => m.id === mine!.id)).toBeUndefined();
  });

  it("非作者不能删除他人消息", async () => {
    const { messages } = await fresh();
    const list = await messages.getMessages("show-4");
    const others = list.find((m) => m.user_id !== "user-3");
    expect(others).toBeDefined();
    await expect(
      messages.deleteMessage(others!.id, "user-3")
    ).rejects.toThrow();
  });

  it("不存在的演出（无 room 映射）发送消息应失败", async () => {
    const { messages } = await fresh();
    await expect(
      messages.sendMessage("show-999", "user-1", "x")
    ).rejects.toThrow();
  });
});

// ========================
// 2. Buddy 找搭子
// ========================
describe("P5 Buddy", () => {
  it("showId 过滤正确：只返回该演出的帖子", async () => {
    const { buddyPosts } = await fresh();
    const list = await buddyPosts.getBuddyPosts("show-4");
    expect(list.length).toBe(3);
    list.forEach((p) => expect(p.show_id).toBe("show-4"));
  });

  it("新帖子成功创建，字段正确", async () => {
    const { buddyPosts } = await fresh();
    const before = await buddyPosts.getBuddyPosts("show-4");
    const post = await buddyPosts.createBuddyPost("show-4", "user-2", {
      content: "P5 找搭子测试",
      tags: ["一起看演出"],
    });
    expect(post.show_id).toBe("show-4");
    expect(post.user_id).toBe("user-2");
    expect(post.content).toBe("P5 找搭子测试");
    expect(post.comment_count).toBe(0);

    const after = await buddyPosts.getBuddyPosts("show-4");
    expect(after.length).toBe(before.length + 1);
  });

  it("标签多选保存正确", async () => {
    const { buddyPosts } = await fresh();
    const tags = ["一起看演出", "排队", "吃饭", "拼车"];
    const post = await buddyPosts.createBuddyPost("show-4", "user-1", {
      content: "多标签",
      tags,
    });
    expect(post.tags).toEqual(tags);
  });

  it("回复成功，comment_count 递增", async () => {
    const { buddyPosts } = await fresh();
    const list = await buddyPosts.getBuddyPosts("show-4");
    const target = list[0];
    const beforeCount = target.comment_count ?? 0;

    const comment = await buddyPosts.replyBuddyPost(
      target.id,
      "user-3",
      "P5 回复"
    );
    expect(comment.buddy_post_id).toBe(target.id);
    expect(comment.user_id).toBe("user-3");

    const comments = await buddyPosts.getBuddyPostComments(target.id);
    expect(comments.some((c) => c.id === comment.id)).toBe(true);

    const after = await buddyPosts.getBuddyPosts("show-4");
    const updated = after.find((p) => p.id === target.id);
    expect(updated!.comment_count).toBe(beforeCount + 1);
  });

  it("作者删除权限正确：作者可删，非作者不可删", async () => {
    const { buddyPosts } = await fresh();
    const list = await buddyPosts.getBuddyPosts("show-4");
    const mine = list.find((p) => p.user_id === "user-1");
    const others = list.find((p) => p.user_id !== "user-3");
    expect(mine).toBeDefined();
    expect(others).toBeDefined();

    // 非作者删除失败
    await expect(
      buddyPosts.deleteBuddyPost(others!.id, "user-3")
    ).rejects.toThrow();

    // 作者删除成功
    await buddyPosts.deleteBuddyPost(mine!.id, "user-1");
    const after = await buddyPosts.getBuddyPosts("show-4");
    expect(after.find((p) => p.id === mine!.id)).toBeUndefined();
  });

  it("空内容不允许发布", async () => {
    const { buddyPosts } = await fresh();
    await expect(
      buddyPosts.createBuddyPost("show-4", "user-1", {
        content: "   ",
        tags: [],
      })
    ).rejects.toThrow();
  });
});

// ========================
// 3. Ticket 出收票
// ========================
describe("P5 Ticket", () => {
  it("sell/buy 过滤正确", async () => {
    const { ticketPosts, types } = await fresh();
    const selling = await ticketPosts.getTicketPosts(
      "show-4",
      types.TicketPostType.SELLING
    );
    const buying = await ticketPosts.getTicketPosts(
      "show-4",
      types.TicketPostType.BUYING
    );
    selling.forEach((p) => expect(p.type).toBe(types.TicketPostType.SELLING));
    buying.forEach((p) => expect(p.type).toBe(types.TicketPostType.BUYING));
    // show-4 只有出票帖
    expect(selling.length).toBeGreaterThan(0);
    expect(buying.length).toBe(0);
  });

  it("askingPrice <= faceValue：低于或等于原价允许发布", async () => {
    const { ticketPosts, types } = await fresh();
    const post = await ticketPosts.createTicketPost("show-4", "user-1", {
      type: types.TicketPostType.SELLING,
      quantity: 1,
      faceValue: 100,
      price: 100,
      note: "原价转",
    });
    expect(post.price).toBeLessThanOrEqual(post.face_value!);
  });

  it("高于原价禁止发布（出票）", async () => {
    const { ticketPosts, types } = await fresh();
    await expect(
      ticketPosts.createTicketPost("show-4", "user-1", {
        type: types.TicketPostType.SELLING,
        quantity: 1,
        faceValue: 100,
        price: 150,
        note: "加价转",
      })
    ).rejects.toThrow();
  });

  it("作者可以标记 completed", async () => {
    const { ticketPosts, types } = await fresh();
    const post = await ticketPosts.createTicketPost("show-4", "user-1", {
      type: types.TicketPostType.SELLING,
      quantity: 1,
      faceValue: 100,
      price: 100,
    });
    expect(post.status).toBe(types.TicketPostStatus.ACTIVE);

    const updated = await ticketPosts.updateTicketPostStatus(
      post.id,
      "user-1",
      types.TicketPostStatus.COMPLETED
    );
    expect(updated.status).toBe(types.TicketPostStatus.COMPLETED);
    expect(updated.updated_at).toBeDefined();
  });

  it("非作者不能修改状态", async () => {
    const { ticketPosts, types } = await fresh();
    const post = await ticketPosts.createTicketPost("show-4", "user-1", {
      type: types.TicketPostType.SELLING,
      quantity: 1,
      faceValue: 100,
      price: 100,
    });
    await expect(
      ticketPosts.updateTicketPostStatus(
        post.id,
        "user-3",
        types.TicketPostStatus.COMPLETED
      )
    ).rejects.toThrow();
  });

  it("数量为 0 禁止发布", async () => {
    const { ticketPosts, types } = await fresh();
    await expect(
      ticketPosts.createTicketPost("show-4", "user-1", {
        type: types.TicketPostType.SELLING,
        quantity: 0,
        faceValue: 100,
        price: 100,
      })
    ).rejects.toThrow();
  });
});

// ========================
// 4. Live 现场
// ========================
describe("P5 Live", () => {
  it("演出日前不能发布（canPostLive=false）", async () => {
    const { lifecycle, types } = await fresh();
    const futureShow = {
      id: "syn-future",
      venue_id: "v",
      city: "上海",
      date_time: shanghaiISO(10, 20),
      status: types.ShowStatus.UPCOMING,
      created_at: "2026-01-01T00:00:00Z",
    };
    const lc = lifecycle.getShowLifecycle(futureShow as never);
    expect(lc.isToday).toBe(false);
    expect(lc.canPostLive).toBe(false);
  });

  it("演出当天可以发布（canPostLive=true）", async () => {
    const { lifecycle, types } = await fresh();
    const todayShow = {
      id: "syn-today",
      venue_id: "v",
      city: "上海",
      date_time: shanghaiISO(0, 20),
      status: types.ShowStatus.UPCOMING,
      created_at: "2026-01-01T00:00:00Z",
    };
    const lc = lifecycle.getShowLifecycle(todayShow as never);
    expect(lc.isToday).toBe(true);
    expect(lc.canPostLive).toBe(true);
  });

  it("已结束演出仍然允许发布/保留内容（canPostLive=true）", async () => {
    const { lifecycle, types, livePosts } = await fresh();
    const endedShow = {
      id: "syn-ended",
      venue_id: "v",
      city: "上海",
      date_time: shanghaiISO(-20, 20),
      status: types.ShowStatus.ENDED,
      created_at: "2026-01-01T00:00:00Z",
    };
    const lc = lifecycle.getShowLifecycle(endedShow as never);
    expect(lc.hasEnded).toBe(true);
    expect(lc.canPostLive).toBe(true);

    // 保留内容：show-1（已结束）现场帖仍可读取
    const retained = await livePosts.getLivePosts("show-1");
    expect(retained.length).toBeGreaterThan(0);
  });

  it("图片数组结构正确", async () => {
    const { livePosts } = await fresh();
    const imgs = [
      "https://picsum.photos/seed/a/600",
      "https://picsum.photos/seed/b/600",
    ];
    const post = await livePosts.createLivePost("show-1", "user-1", {
      content: "图集测试",
      imageUrls: imgs,
    });
    expect(Array.isArray(post.image_urls)).toBe(true);
    expect(post.image_urls).toEqual(imgs);
    expect(post.image_urls.length).toBe(2);
  });

  it("外部视频平台识别正确", async () => {
    const { livePosts, types } = await fresh();
    expect(livePosts.detectVideoPlatform("https://www.bilibili.com/video/BVxxx")).toBe(
      types.VideoPlatform.BILIBILI
    );
    expect(livePosts.detectVideoPlatform("https://b23.tv/abc")).toBe(
      types.VideoPlatform.BILIBILI
    );
    expect(livePosts.detectVideoPlatform("https://www.xiaohongshu.com/x")).toBe(
      types.VideoPlatform.XIAOHONGSHU
    );
    expect(livePosts.detectVideoPlatform("https://www.douyin.com/x")).toBe(
      types.VideoPlatform.DOUYIN
    );
    expect(livePosts.detectVideoPlatform("https://www.youtube.com/watch?v=x")).toBe(
      types.VideoPlatform.YOUTUBE
    );
    expect(livePosts.detectVideoPlatform("https://example.com/unknown")).toBe(
      undefined
    );
  });

  it("showId 过滤正确 + 作者删除权限", async () => {
    const { livePosts } = await fresh();
    const list = await livePosts.getLivePosts("show-1");
    list.forEach((p) => expect(p.show_id).toBe("show-1"));

    const mine = list.find((p) => p.user_id === "user-1");
    const others = list.find((p) => p.user_id !== "user-3");
    expect(mine).toBeDefined();
    expect(others).toBeDefined();

    await expect(livePosts.deleteLivePost(others!.id, "user-3")).rejects.toThrow();
    await livePosts.deleteLivePost(mine!.id, "user-1");
    const after = await livePosts.getLivePosts("show-1");
    expect(after.find((p) => p.id === mine!.id)).toBeUndefined();
  });
});

// ========================
// 5. Room 权限
// ========================
describe("P5 Room 权限", () => {
  it("Interested 不等于 Joined Room", async () => {
    const { store } = await fresh();
    store.useUserStore.getState().mockLogin();
    const state = store.useUserStore.getState();
    // show-7 = interested，但未加入 room-7
    expect(state.showStatuses["show-7"]).toBe("interested");
    const joinedRoom7 = state.roomMemberships.some((m) => m.room_id === "room-7");
    expect(joinedRoom7).toBe(false);
  });

  it("Going 不等于 Joined Room", async () => {
    const { store } = await fresh();
    store.useUserStore.getState().mockLogin();
    const state = store.useUserStore.getState();
    // show-15 = going，但未加入 room-15
    expect(state.showStatuses["show-15"]).toBe("going");
    const joinedRoom15 = state.roomMemberships.some(
      (m) => m.room_id === "room-15"
    );
    expect(joinedRoom15).toBe(false);
  });

  it("Joined Room 不自动改变 UserShowStatus", async () => {
    const { store } = await fresh();
    store.useUserStore.getState().mockLogin();
    const before = { ...store.useUserStore.getState().showStatuses };
    const beforeCount = store.useUserStore.getState().roomMemberships.length;

    // 加入一个新 room（room-3 对应 show-3，原本无 status）
    store.useUserStore.getState().joinRoom("room-3");

    expect(store.useUserStore.getState().roomMemberships.length).toBe(
      beforeCount + 1
    );
    // showStatuses 不应改变
    expect(store.useUserStore.getState().showStatuses).toEqual(before);
    // show-3 不应因 join room 自动获得 status
    expect(store.useUserStore.getState().showStatuses["show-3"]).toBeUndefined();
  });

  it("joinRoom 幂等：重复加入不会增加成员记录", async () => {
    const { store } = await fresh();
    store.useUserStore.getState().mockLogin();
    const before = store.useUserStore.getState().roomMemberships.length;
    store.useUserStore.getState().joinRoom("room-3");
    store.useUserStore.getState().joinRoom("room-3");
    store.useUserStore.getState().joinRoom("room-3");
    expect(store.useUserStore.getState().roomMemberships.length).toBe(before + 1);
  });

  it("isRoomMember API 独立于 UserShowStatus", async () => {
    const { rooms } = await fresh();
    // user-1 是 room-4 成员（预置），与 showStatus 无关
    expect(await rooms.isRoomMember("show-4", "user-1")).toBe(true);
    // user-3 不是 room-4 成员
    expect(await rooms.isRoomMember("show-4", "user-3")).toBe(false);
    // 游客不是成员
    expect(await rooms.isRoomMember("show-4")).toBe(false);
  });
});

// ========================
// 6. 游客可读不可写
// ========================
describe("P5 游客可读不可写", () => {
  it("游客可以读所有四个 Tab 的内容", async () => {
    const { messages, buddyPosts, ticketPosts, livePosts, store } = await fresh();
    // 确保是游客状态
    store.useUserStore.getState().logout();
    expect(store.useUserStore.getState().isLoggedIn).toBe(false);

    const msgs = await messages.getMessages("show-4");
    const buddies = await buddyPosts.getBuddyPosts("show-4");
    const tickets = await ticketPosts.getTicketPosts("show-4");
    const lives = await livePosts.getLivePosts("show-1");

    expect(msgs.length).toBeGreaterThan(0);
    expect(buddies.length).toBeGreaterThan(0);
    expect(tickets.length).toBeGreaterThan(0);
    expect(lives.length).toBeGreaterThan(0);
  });

  it("游客不可写：mutation 必须显式 userId，未知 userId 被拒绝", async () => {
    const { messages, buddyPosts, ticketPosts, livePosts, types } = await fresh();
    const ghost = "ghost-nonexistent";

    await expect(messages.sendMessage("show-4", ghost, "x")).rejects.toThrow();
    await expect(
      buddyPosts.createBuddyPost("show-4", ghost, { content: "x", tags: [] })
    ).rejects.toThrow();
    await expect(
      ticketPosts.createTicketPost("show-4", ghost, {
        type: types.TicketPostType.SELLING,
        quantity: 1,
        faceValue: 100,
        price: 100,
      })
    ).rejects.toThrow();
    await expect(
      livePosts.createLivePost("show-4", ghost, { content: "x", imageUrls: [] })
    ).rejects.toThrow();
  });

  it("游客删除/修改状态被拒绝（作者鉴权在 API 层兜底）", async () => {
    const { messages, buddyPosts, ticketPosts, livePosts, types } = await fresh();
    const ghost = "ghost-nonexistent";

    const msgList = await messages.getMessages("show-4");
    await expect(messages.deleteMessage(msgList[0].id, ghost)).rejects.toThrow();

    const buddyList = await buddyPosts.getBuddyPosts("show-4");
    await expect(buddyPosts.deleteBuddyPost(buddyList[0].id, ghost)).rejects.toThrow();

    const ticketList = await ticketPosts.getTicketPosts("show-4");
    await expect(
      ticketPosts.updateTicketPostStatus(
        ticketList[0].id,
        ghost,
        types.TicketPostStatus.COMPLETED
      )
    ).rejects.toThrow();

    const liveList = await livePosts.getLivePosts("show-1");
    await expect(livePosts.deleteLivePost(liveList[0].id, ghost)).rejects.toThrow();
  });
});
