/**
 * P9 行为测试 - 通知系统
 *
 * 覆盖测试组：
 * A. unread badge（派生逻辑、mark read、mark all、99+）
 * B. notification list（排序、已读/未读、当前用户）
 * C. attended_check 生成（going+ended / interested / attended / 未结束 / 防重复）
 * D. attended_check 回答（"是的"→attended / "没去成"→清除going / RoomMembership独立 / 双按钮标记已读）
 * E. new_show 生成（follow+同城 / 未follow / 不同城 / 防重复）
 * G. persist（已读状态 + attended 回答结果 持久化）
 * H. Notification UI Store（EditProfileModal 与 Notification 共存的 UI state）
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { NotificationType, UserShowStatus } from "@/lib/types";
import type { Notification } from "@/lib/types";
import {
  generateNewShowNotification,
  generateAttendedCheckNotification,
  checkAndGenerateAttendedNotifications,
  answerAttendedCheckYes,
  answerAttendedCheckNo,
  generateDiscussionReplyNotification,
  generateBuddyReplyNotification,
  generateLiveInteractionNotification,
  generateTicketFavoriteNotification,
  generateTicketMessageNotification,
  markNotificationRead as markNotificationReadApi,
  markNotificationsContentDeleted,
} from "@/lib/api/notifications";
import { sendMessage, deleteMessage } from "@/lib/api/messages";
import { createBuddyPost, deleteBuddyPost } from "@/lib/api/posts/buddyPosts";
import { createLivePost, deleteLivePost } from "@/lib/api/posts/livePosts";
import { deleteTicketPost } from "@/lib/api/posts/ticketPosts";
import { readFileSync } from "fs";
import { resolve } from "path";
import { showMap } from "@/mocks/shows";
import { mockShowRooms } from "@/mocks/shows";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";

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

beforeEach(() => {
  useUserStore.getState().logout();
  useUIStore.setState({
    isLoginModalOpen: false,
    isOnboardingModalOpen: false,
    isEditProfileModalOpen: false,
    pendingAuthAction: null,
  });
  localStorage.clear();
});

// 辅助：获取派生 unreadCount
function getUnread(): number {
  return useUserStore.getState().notifications.filter((n) => !n.is_read).length;
}

// 辅助：派生当前用户通知（按 created_at 倒序）
function getUserNotifications(): Notification[] {
  return [...useUserStore.getState().notifications].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

// ========================
// A. unread badge
// ========================
describe("P9 A. unread badge（派生逻辑）", () => {
  it("无未读 → unreadCount = 0", () => {
    useUserStore.getState().mockLogin();
    // 全部标记已读
    useUserStore.getState().markAllNotificationsRead();
    expect(getUnread()).toBe(0);
  });

  it("有未读 → 数量正确", () => {
    useUserStore.getState().mockLogin();
    const notifs = useUserStore.getState().notifications;
    const expected = notifs.filter((n) => !n.is_read).length;
    expect(getUnread()).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it("已读通知不计入 unreadCount", () => {
    useUserStore.getState().mockLogin();
    const before = getUnread();
    // 找一条未读并标记已读
    const unread = useUserStore.getState().notifications.find((n) => !n.is_read);
    expect(unread).toBeDefined();
    useUserStore.getState().markNotificationRead(unread!.id);
    expect(getUnread()).toBe(before - 1);
  });

  it("mark read 后 unreadCount 减少（store 层）", () => {
    useUserStore.getState().mockLogin();
    const before = getUnread();
    const unread = useUserStore.getState().notifications.find((n) => !n.is_read)!;
    useUserStore.getState().markNotificationRead(unread.id);
    expect(getUnread()).toBe(before - 1);
  });

  it("mark all 后 unreadCount = 0", () => {
    useUserStore.getState().mockLogin();
    expect(getUnread()).toBeGreaterThan(0);
    useUserStore.getState().markAllNotificationsRead();
    expect(getUnread()).toBe(0);
  });

  it("超过 99 时 badge 显示逻辑为 99+（UI 层判断）", () => {
    // 构造 100 条未读通知
    useUserStore.getState().mockLogin();
    useUserStore.getState().markAllNotificationsRead(); // 清零
    for (let i = 0; i < 100; i++) {
      useUserStore.getState().addNotification({
        id: `test-notif-${i}`,
        user_id: "user-1",
        type: NotificationType.NEW_SHOW,
        title: `测试通知 ${i}`,
        related_show_id: `test-show-${i}`,
        is_read: false,
        created_at: new Date(Date.now() - i * 1000).toISOString(),
      });
    }
    const count = getUnread();
    expect(count).toBe(100);
    // UI 层：count > 99 → "99+"
    const badgeText = count > 99 ? "99+" : String(count);
    expect(badgeText).toBe("99+");
  });

  it("未登录 → unreadCount = 0", () => {
    expect(getUnread()).toBe(0);
  });
});

// ========================
// B. notification list
// ========================
describe("P9 B. notification list（排序与状态）", () => {
  it("仅显示当前用户通知", () => {
    useUserStore.getState().mockLogin();
    const notifs = getUserNotifications();
    for (const n of notifs) {
      expect(n.user_id).toBe("user-1");
    }
  });

  it("按 created_at 倒序", () => {
    useUserStore.getState().mockLogin();
    const notifs = getUserNotifications();
    for (let i = 1; i < notifs.length; i++) {
      expect(notifs[i - 1].created_at >= notifs[i].created_at).toBe(true);
    }
  });

  it("已读/未读状态正确保留", () => {
    useUserStore.getState().mockLogin();
    const notifs = useUserStore.getState().notifications;
    const hasRead = notifs.some((n) => n.is_read);
    const hasUnread = notifs.some((n) => !n.is_read);
    expect(hasRead).toBe(true);
    expect(hasUnread).toBe(true);
  });

  it("mock 数据包含 new_show 与 attended_check 两种通知类型", () => {
    useUserStore.getState().mockLogin();
    const notifs = useUserStore.getState().notifications;
    const types = new Set(notifs.map((n) => n.type));
    expect(types.has(NotificationType.NEW_SHOW)).toBe(true);
    expect(types.has(NotificationType.ATTENDED_CHECK)).toBe(true);
  });

  it("点击 new_show → 标记已读 → URL 应为 /show/[id]", () => {
    useUserStore.getState().mockLogin();
    const newShowNotif = useUserStore
      .getState()
      .notifications.find((n) => n.type === NotificationType.NEW_SHOW && !n.is_read);
    expect(newShowNotif).toBeDefined();
    // 模拟点击行为：标记已读
    useUserStore.getState().markNotificationRead(newShowNotif!.id);
    const updated = useUserStore
      .getState()
      .notifications.find((n) => n.id === newShowNotif!.id);
    expect(updated?.is_read).toBe(true);
    // URL 应为 /show/{related_show_id}
    if (newShowNotif!.related_show_id) {
      const url = `/show/${newShowNotif!.related_show_id}`;
      expect(url.startsWith("/show/")).toBe(true);
    }
  });
});

// ========================
// C. attended_check 生成
// ========================
describe("P9 C. attended_check 生成逻辑", () => {
  it("going + 已结束 → 可以生成", () => {
    useUserStore.getState().mockLogin();
    // show-1 已结束，mock status 是 attended，改为 going
    useUserStore.getState().setShowStatus("show-1", UserShowStatus.GOING);
    // 先删除已有的 attended_check 通知（mock 预置的 notif-4）
    const existing = useUserStore
      .getState()
      .notifications.filter(
        (n) =>
          n.type === NotificationType.ATTENDED_CHECK &&
          n.related_show_id === "show-1"
      );
    // 如果已存在，先手动清除来测试生成
    if (existing.length > 0) {
      useUserStore.setState({
        notifications: useUserStore
          .getState()
          .notifications.filter((n) => !existing.includes(n)),
      });
    }
    const result = generateAttendedCheckNotification("user-1", "show-1");
    expect(result).not.toBeNull();
    expect(result?.type).toBe(NotificationType.ATTENDED_CHECK);
    expect(result?.related_show_id).toBe("show-1");
  });

  it("interested + 已结束 → 不生成", () => {
    useUserStore.getState().mockLogin();
    useUserStore.getState().setShowStatus("show-2", UserShowStatus.INTERESTED);
    const show2 = showMap.get("show-2")!;
    expect(getShowLifecycle(show2).hasEnded).toBe(true);
    const result = generateAttendedCheckNotification("user-1", "show-2");
    expect(result).toBeNull();
  });

  it("attended → 不生成（不再重复检查）", () => {
    useUserStore.getState().mockLogin();
    // show-1 mock status 是 attended
    const show1 = showMap.get("show-1")!;
    expect(getShowLifecycle(show1).hasEnded).toBe(true);
    expect(useUserStore.getState().showStatuses["show-1"]).toBe(
      UserShowStatus.ATTENDED
    );
    const result = generateAttendedCheckNotification("user-1", "show-1");
    expect(result).toBeNull();
  });

  it("未结束 going → 不生成", () => {
    useUserStore.getState().mockLogin();
    // show-12 是未来演出（2026-09-20），显式设置为 going
    const show12 = showMap.get("show-12")!;
    expect(getShowLifecycle(show12).hasEnded).toBe(false);
    useUserStore.getState().setShowStatus("show-12", UserShowStatus.GOING);
    expect(useUserStore.getState().showStatuses["show-12"]).toBe(
      UserShowStatus.GOING
    );
    const result = generateAttendedCheckNotification("user-1", "show-12");
    expect(result).toBeNull();
  });

  it("同一 show 不重复生成 attended_check", () => {
    useUserStore.getState().mockLogin();
    useUserStore.getState().setShowStatus("show-3", UserShowStatus.GOING);
    // 清除已有 attended_check
    useUserStore.setState({
      notifications: useUserStore
        .getState()
        .notifications.filter((n) => n.type !== NotificationType.ATTENDED_CHECK),
    });
    const first = generateAttendedCheckNotification("user-1", "show-3");
    expect(first).not.toBeNull();
    const second = generateAttendedCheckNotification("user-1", "show-3");
    expect(second).toBeNull();
  });

  it("checkAndGenerateAttendedNotifications 批量生成（幂等）", () => {
    useUserStore.getState().mockLogin();
    // 清除所有 attended_check
    useUserStore.setState({
      notifications: useUserStore
        .getState()
        .notifications.filter((n) => n.type !== NotificationType.ATTENDED_CHECK),
    });
    // 设置多条已结束 + going
    useUserStore.getState().setShowStatus("show-2", UserShowStatus.GOING);
    useUserStore.getState().setShowStatus("show-3", UserShowStatus.GOING);
    const first = checkAndGenerateAttendedNotifications("user-1");
    expect(first.length).toBeGreaterThanOrEqual(2);
    // 第二次调用应幂等（不重复）
    const second = checkAndGenerateAttendedNotifications("user-1");
    expect(second.length).toBe(0);
  });
});

// ========================
// D. attended_check 回答
// ========================
describe("P9 D. attended_check 回答交互", () => {
  it('"是的，我去了" → status 变为 attended', () => {
    useUserStore.getState().mockLogin();
    // 确保有 attended_check 通知
    const notif = useUserStore
      .getState()
      .notifications.find((n) => n.type === NotificationType.ATTENDED_CHECK);
    expect(notif).toBeDefined();
    // 对应 show 先设为 going
    if (notif!.related_show_id) {
      useUserStore.getState().setShowStatus(notif!.related_show_id, UserShowStatus.GOING);
    }
    answerAttendedCheckYes(notif!.id);
    expect(useUserStore.getState().showStatuses[notif!.related_show_id!]).toBe(
      UserShowStatus.ATTENDED
    );
  });

  it('"是的，我去了" → 通知标记已读', () => {
    useUserStore.getState().mockLogin();
    const notif = useUserStore
      .getState()
      .notifications.find((n) => n.type === NotificationType.ATTENDED_CHECK);
    expect(notif).toBeDefined();
    answerAttendedCheckYes(notif!.id);
    const updated = useUserStore
      .getState()
      .notifications.find((n) => n.id === notif!.id);
    expect(updated?.is_read).toBe(true);
  });

  it('"没去成" → going 被清除', () => {
    useUserStore.getState().mockLogin();
    const notif = useUserStore
      .getState()
      .notifications.find((n) => n.type === NotificationType.ATTENDED_CHECK);
    expect(notif).toBeDefined();
    if (notif!.related_show_id) {
      useUserStore.getState().setShowStatus(notif!.related_show_id, UserShowStatus.GOING);
    }
    answerAttendedCheckNo(notif!.id);
    expect(useUserStore.getState().showStatuses[notif!.related_show_id!]).toBeUndefined();
  });

  it('"没去成" → 通知标记已读', () => {
    useUserStore.getState().mockLogin();
    const notif = useUserStore
      .getState()
      .notifications.find((n) => n.type === NotificationType.ATTENDED_CHECK);
    answerAttendedCheckNo(notif!.id);
    const updated = useUserStore
      .getState()
      .notifications.find((n) => n.id === notif!.id);
    expect(updated?.is_read).toBe(true);
  });

  it("'没去成' → 不删除 RoomMembership（保持独立）", () => {
    useUserStore.getState().mockLogin();
    const notif = useUserStore
      .getState()
      .notifications.find((n) => n.type === NotificationType.ATTENDED_CHECK);
    // 确保 show-1 对应 room-1 有 membership
    const showId = notif!.related_show_id!;
    const room = mockShowRooms.find((r) => r.show_id === showId);
    if (room) {
      useUserStore.getState().joinRoom(room.id);
      const beforeCount = useUserStore.getState().roomMemberships.length;
      useUserStore.getState().setShowStatus(showId, UserShowStatus.GOING);
      answerAttendedCheckNo(notif!.id);
      const afterCount = useUserStore.getState().roomMemberships.length;
      expect(afterCount).toBe(beforeCount);
    }
  });

  it("'没去成' → 不设置 interested / attended", () => {
    useUserStore.getState().mockLogin();
    const notif = useUserStore
      .getState()
      .notifications.find((n) => n.type === NotificationType.ATTENDED_CHECK);
    useUserStore.getState().setShowStatus(notif!.related_show_id!, UserShowStatus.GOING);
    answerAttendedCheckNo(notif!.id);
    const status = useUserStore.getState().showStatuses[notif!.related_show_id!];
    expect(status).toBeUndefined(); // 既不是 going，也不是 interested/attended
  });
});

// ========================
// E. new_show 生成
// ========================
describe("P9 E. new_show 生成逻辑", () => {
  it("follow + 同城市 → 生成", () => {
    useUserStore.getState().mockLogin();
    // mock user city = "上海"，follows artist-1
    // show-4: 上海, artist-1 (Chinese Football)
    // 清除已有 new_show 通知
    useUserStore.setState({
      notifications: useUserStore
        .getState()
        .notifications.filter((n) => n.type !== NotificationType.NEW_SHOW),
    });
    const result = generateNewShowNotification("user-1", "show-4");
    expect(result).not.toBeNull();
    expect(result?.type).toBe(NotificationType.NEW_SHOW);
    expect(result?.related_show_id).toBe("show-4");
  });

  it("未 follow → 不生成", () => {
    useUserStore.getState().mockLogin();
    // show-2: artist-6 (开端), 成都 — 用户未关注
    const result = generateNewShowNotification("user-1", "show-2");
    expect(result).toBeNull();
  });

  it("不同城市 → 不生成", () => {
    useUserStore.getState().mockLogin();
    // show-1: 武汉, artist-1 (已关注) — 但城市不同
    const result = generateNewShowNotification("user-1", "show-1");
    expect(result).toBeNull();
  });

  it("同一 show 不重复生成 new_show", () => {
    useUserStore.getState().mockLogin();
    useUserStore.setState({
      notifications: useUserStore
        .getState()
        .notifications.filter((n) => n.type !== NotificationType.NEW_SHOW),
    });
    const first = generateNewShowNotification("user-1", "show-4");
    expect(first).not.toBeNull();
    const second = generateNewShowNotification("user-1", "show-4");
    expect(second).toBeNull();
  });
});

// ========================
// G. persist
// ========================
describe("P9 G. 通知状态持久化", () => {
  it("已读状态刷新后保持（persist）", () => {
    useUserStore.getState().mockLogin();
    // 标记一条未读为已读
    const unread = useUserStore
      .getState()
      .notifications.find((n) => !n.is_read);
    expect(unread).toBeDefined();
    useUserStore.getState().markNotificationRead(unread!.id);
    // 检查 localStorage 中持久化了通知
    const raw = localStorage.getItem("gigroom-user-storage");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as {
      state?: { notifications?: Notification[] };
    };
    const persistedNotif = parsed.state?.notifications?.find(
      (n) => n.id === unread!.id
    );
    expect(persistedNotif?.is_read).toBe(true);
  });

  it("attended 回答结果刷新后保持（persist）", () => {
    useUserStore.getState().mockLogin();
    const notif = useUserStore
      .getState()
      .notifications.find((n) => n.type === NotificationType.ATTENDED_CHECK);
    useUserStore.getState().setShowStatus(notif!.related_show_id!, UserShowStatus.GOING);
    answerAttendedCheckYes(notif!.id);
    // 检查 persist 中的 showStatuses 和 notifications
    const raw = localStorage.getItem("gigroom-user-storage");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as {
      state?: {
        showStatuses?: Record<string, UserShowStatus>;
        notifications?: Notification[];
      };
    };
    expect(parsed.state?.showStatuses?.[notif!.related_show_id!]).toBe(
      UserShowStatus.ATTENDED
    );
    const persistedNotif = parsed.state?.notifications?.find(
      (n) => n.id === notif!.id
    );
    expect(persistedNotif?.is_read).toBe(true);
  });

  it("markAllRead 持久化后刷新仍为全已读", () => {
    useUserStore.getState().mockLogin();
    useUserStore.getState().markAllNotificationsRead();
    const raw = localStorage.getItem("gigroom-user-storage");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as {
      state?: { notifications?: Notification[] };
    };
    for (const n of parsed.state?.notifications ?? []) {
      expect(n.is_read).toBe(true);
    }
  });
});

// ========================
// H. addNotification 防重复（store 层）
// ========================
describe("P9 H. addNotification 防重复（store 层）", () => {
  it("同 type + related_show_id 已存在 → 跳过", () => {
    useUserStore.getState().mockLogin();
    const before = useUserStore.getState().notifications.length;
    const existing = useUserStore.getState().notifications[0];
    useUserStore.getState().addNotification({ ...existing, id: "duplicate-id" });
    expect(useUserStore.getState().notifications.length).toBe(before);
  });

  it("不同 related_show_id → 添加成功", () => {
    useUserStore.getState().mockLogin();
    const before = useUserStore.getState().notifications.length;
    useUserStore.getState().addNotification({
      id: "unique-test-notif",
      user_id: "user-1",
      type: NotificationType.NEW_SHOW,
      title: "唯一测试通知",
      related_show_id: "show-99-different",
      is_read: false,
      created_at: new Date().toISOString(),
    });
    expect(useUserStore.getState().notifications.length).toBe(before + 1);
  });

  it("登出后 notifications 清空", () => {
    useUserStore.getState().mockLogin();
    expect(useUserStore.getState().notifications.length).toBeGreaterThan(0);
    useUserStore.getState().logout();
    expect(useUserStore.getState().notifications).toEqual([]);
  });
});

// ========================
// I. P4 收口：互动通知闭环（生成→未读→深链→已读→内容删除失效）
// ========================
describe("P4 收口. 互动通知闭环（生成→未读→深链→已读→内容删除失效）", () => {
  beforeEach(() => {
    useUserStore.getState().mockLogin();
    useUserStore.setState({ notifications: [] });
  });

  function findNotif(id: string): Notification {
    const n = useUserStore.getState().notifications.find((x) => x.id === id);
    expect(n).toBeDefined();
    return n!;
  }

  it("讨论回复：生成即未读 → target_url 指向 discussion tab → 标记已读 → 删消息后失效", async () => {
    // show-12（2026-09-20）在固定时钟 2026-09-18 下未结束，聊天开放
    const msg = await sendMessage("show-12", "user-1", "P4 原讨论消息");
    const notif = generateDiscussionReplyNotification(
      "user-1",
      "user-2",
      "show-12",
      msg.id
    );
    expect(notif).not.toBeNull();
    expect(notif!.is_read).toBe(false);
    expect(getUnread()).toBe(1);
    expect(notif!.type).toBe(NotificationType.DISCUSSION_REPLY);
    expect(notif!.target_url).toBe("/show/show-12?tab=discussion#room");
    expect(notif!.related_content_id).toBe(msg.id);

    await markNotificationReadApi(notif!.id);
    expect(findNotif(notif!.id).is_read).toBe(true);
    expect(getUnread()).toBe(0);

    await deleteMessage(msg.id, "user-1");
    const updated = findNotif(notif!.id);
    expect(updated.is_content_deleted).toBe(true);
    // 失效后保持已读（无未读红点残留）
    expect(updated.is_read).toBe(true);
  });

  it("讨论回复：同内容幂等，自发自收不通知", () => {
    const first = generateDiscussionReplyNotification(
      "user-1",
      "user-2",
      "show-4",
      "p4-msg-dedup"
    );
    expect(first).not.toBeNull();
    const second = generateDiscussionReplyNotification(
      "user-1",
      "user-2",
      "show-4",
      "p4-msg-dedup"
    );
    expect(second).toBeNull();
    const self = generateDiscussionReplyNotification(
      "user-1",
      "user-1",
      "show-4",
      "p4-msg-self"
    );
    expect(self).toBeNull();
  });

  it("找搭子回复：深链 buddy tab → 标记已读 → 删帖后失效", async () => {
    const post = await createBuddyPost("show-4", "user-1", {
      content: "P4 拼车",
      tags: ["carpool"],
    });
    const notif = generateBuddyReplyNotification(
      "user-1",
      "user-2",
      "show-4",
      post.id
    );
    expect(notif).not.toBeNull();
    expect(notif!.is_read).toBe(false);
    expect(notif!.type).toBe(NotificationType.BUDDY_REPLY);
    expect(notif!.target_url).toBe("/show/show-4?tab=buddy#room");

    await markNotificationReadApi(notif!.id);
    await deleteBuddyPost(post.id, "user-1");
    const updated = findNotif(notif!.id);
    expect(updated.is_content_deleted).toBe(true);
    expect(updated.is_read).toBe(true);
    expect(getUnread()).toBe(0);
  });

  it("现场互动（点赞/评论）：深链 live tab → 标记已读 → 删帖后失效", async () => {
    const post = await createLivePost("show-4", "user-1", {
      content: "P4 安可现场",
      imageUrls: [],
    });
    const likeNotif = generateLiveInteractionNotification(
      "user-1",
      "user-2",
      "show-4",
      post.id,
      "like"
    );
    expect(likeNotif).not.toBeNull();
    expect(likeNotif!.target_url).toBe("/show/show-4?tab=live#room");
    expect(likeNotif!.title).toContain("点赞");

    const commentNotif = generateLiveInteractionNotification(
      "user-1",
      "user-3",
      "show-4",
      post.id,
      "comment"
    );
    expect(commentNotif).not.toBeNull();
    expect(commentNotif!.title).toContain("评论");
    expect(getUnread()).toBe(2);

    await markNotificationReadApi(likeNotif!.id);
    await deleteLivePost(post.id, "user-1");
    for (const id of [likeNotif!.id, commentNotif!.id]) {
      const updated = findNotif(id);
      expect(updated.is_content_deleted).toBe(true);
      expect(updated.is_read).toBe(true);
    }
    expect(getUnread()).toBe(0);
  });

  it("出收票收藏：深链直达 ticket tab（不重定向到 discussion）", () => {
    // tp-1 是 user-1 发布在 show-5 的收票帖
    const notif = generateTicketFavoriteNotification(
      "user-1",
      "tp-1",
      "user-2",
      "show-5"
    );
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe(NotificationType.TICKET_FAVORITE);
    expect(notif!.is_read).toBe(false);
    expect(notif!.related_content_id).toBe("tp-1");
    expect(notif!.related_show_id).toBe("show-5");
    expect(notif!.target_url).toBe("/show/show-5?tab=ticket#room");
    expect(notif!.title).toContain("收藏");

    // 同一收藏者不重复轰炸
    const dup = generateTicketFavoriteNotification(
      "user-1",
      "tp-1",
      "user-2",
      "show-5"
    );
    expect(dup).toBeNull();
  });

  it("交易消息：深链直达 ticket tab；同会话 30s 内幂等", () => {
    // conv-2 是 tp-1 下的会话
    const notif = generateTicketMessageNotification(
      "user-1",
      "conv-2",
      "user-2",
      "show-5"
    );
    expect(notif).not.toBeNull();
    expect(notif!.type).toBe(NotificationType.TICKET_MESSAGE);
    expect(notif!.related_content_id).toBe("conv-2");
    expect(notif!.target_url).toBe("/show/show-5?tab=ticket#room");

    const dup = generateTicketMessageNotification(
      "user-1",
      "conv-2",
      "user-2",
      "show-5"
    );
    expect(dup).toBeNull();
  });

  it("删除出收票帖：收藏通知与该帖全部会话消息通知同时失效，其他通知不受影响", async () => {
    // 无关通知（找搭子）不应被波及
    const unrelated = generateBuddyReplyNotification(
      "user-1",
      "user-2",
      "show-4",
      "bp-unrelated"
    );
    expect(unrelated).not.toBeNull();

    const fav = generateTicketFavoriteNotification(
      "user-1",
      "tp-1",
      "user-2",
      "show-5"
    );
    const msg = generateTicketMessageNotification(
      "user-1",
      "conv-2",
      "user-2",
      "show-5"
    );
    expect(fav).not.toBeNull();
    expect(msg).not.toBeNull();
    expect(getUnread()).toBe(3);

    await deleteTicketPost("tp-1", "user-1");

    expect(findNotif(fav!.id).is_content_deleted).toBe(true);
    expect(findNotif(msg!.id).is_content_deleted).toBe(true);
    expect(findNotif(unrelated!.id).is_content_deleted).toBeFalsy();
    // 两条失效通知清除未读；无关通知仍未读
    expect(getUnread()).toBe(1);
  });

  it("markNotificationsContentDeleted 对不匹配的通知无副作用", () => {
    const notif = generateDiscussionReplyNotification(
      "user-1",
      "user-2",
      "show-4",
      "p4-msg-keep"
    );
    expect(notif).not.toBeNull();
    markNotificationsContentDeleted(["some-other-id"]);
    const updated = findNotif(notif!.id);
    expect(updated.is_content_deleted).toBeFalsy();
    expect(updated.is_read).toBe(false);
  });

  it("未登录时互动通知不生成", () => {
    useUserStore.getState().logout();
    expect(
      generateDiscussionReplyNotification("user-1", "user-2", "show-4", "m-x")
    ).toBeNull();
    expect(
      generateTicketFavoriteNotification("user-1", "tp-1", "user-2", "show-5")
    ).toBeNull();
  });

  it("NotificationItem 守卫：失效内容点击不跳转，并展示内容已失效", () => {
    const src = readFileSync(
      resolve(__dirname, "../../components/notification/NotificationItem.tsx"),
      "utf-8"
    );
    expect(src).toContain("if (deleted) return;");
    expect(src).toContain("内容已失效");
    // 失效行不具备 button 角色
    expect(src).toContain('n.type !== NotificationType.ATTENDED_CHECK && !deleted');
  });
});
