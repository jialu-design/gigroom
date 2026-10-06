/**
 * API 抽象层 - 通知模块（P9）
 *
 * 设计原则：
 * - 通知数据单一来源：useUserStore.notifications（Zustand persist）
 * - unreadCount = notifications.filter(n => !n.is_read).length（派生，不另存）
 * - 所有 mutation 委托 store actions，保证响应式 + 持久化
 * - 生成函数幂等：同 type + related_show_id/related_content_id 不重复
 * - P10 替换为 Supabase 后，UI 层无需改动
 */
import type { Notification } from "@/lib/types";
import { NotificationType, UserShowStatus } from "@/lib/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { showMap } from "@/mocks/shows";
import { userMap } from "@/mocks/users";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";
import { ArtistRole } from "@/lib/types";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

/** 获取用户通知列表（按 created_at 倒序） */
export async function getNotifications(userId: string): Promise<Notification[]> {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) {
    return delay([]);
  }
  const result = [...state.notifications].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
  return delay(result);
}

/** 获取未读通知数（派生，不另存状态） */
export async function getUnreadNotificationCount(userId: string): Promise<number> {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) {
    return delay(0);
  }
  return delay(state.notifications.filter((n) => !n.is_read).length);
}

/** 标记单条通知已读（委托 store） */
export async function markNotificationRead(notificationId: string): Promise<void> {
  useUserStore.getState().markNotificationRead(notificationId);
  return delay(undefined);
}

/** 全部标记已读（委托 store） */
export async function markAllNotificationsRead(userId: string): Promise<void> {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) return delay(undefined);
  useUserStore.getState().markAllNotificationsRead();
  return delay(undefined);
}

/**
 * P4 收口：关联内容被删除时，批量把对应通知置为失效。
 * 匹配 related_content_id（消息/帖子/会话 id）；失效通知同时清除未读，
 * 避免用户永远无法消费一个指向已删除内容的未读红点。
 */
export function markNotificationsContentDeleted(contentIds: string[]): void {
  useUserStore.getState().markNotificationsContentDeleted(contentIds);
}

// ========================
// 通知生成函数（幂等）
// ========================

/** 生成 new_show 通知（关注乐队 + 同城市 → 不重复） */
export function generateNewShowNotification(
  userId: string,
  showId: string
): Notification | null {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) return null;

  const show = showMap.get(showId);
  if (!show) return null;

  // 条件：用户已关注该演出的乐队 AND show.city === user.city
  const showArtistIds = show.artists?.map((sa) => sa.artist_id) ?? [];
  const followsRelatedArtist = showArtistIds.some((id) =>
    state.followedArtistIds.includes(id)
  );
  if (!followsRelatedArtist) return null;
  if (!state.user.city || show.city !== state.user.city) return null;

  // 防重复：同 type + related_show_id 已存在则跳过
  const exists = state.notifications.some(
    (n) => n.type === NotificationType.NEW_SHOW && n.related_show_id === showId
  );
  if (exists) return null;

  const headliner = show.artists?.find((a) => a.role === ArtistRole.HEADLINER);
  const artistName = headliner?.artist?.name ?? show.title ?? "演出";
  const notification: Notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: userId,
    type: NotificationType.NEW_SHOW,
    title: `${artistName} 在${show.city}有新演出`,
    related_show_id: showId,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  useUserStore.getState().addNotification(notification);
  return notification;
}

/** 生成 attended_check 通知（going + ended + 未生成过 → 幂等） */
export function generateAttendedCheckNotification(
  userId: string,
  showId: string
): Notification | null {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) return null;

  const show = showMap.get(showId);
  if (!show) return null;

  // 条件：show 已结束 AND user status === going
  const lifecycle = getShowLifecycle(show);
  if (!lifecycle.hasEnded) return null;

  const showStatus = state.showStatuses[showId];
  if (showStatus !== UserShowStatus.GOING) return null;

  // 防重复：同 type + related_show_id 已存在则跳过
  const exists = state.notifications.some(
    (n) =>
      n.type === NotificationType.ATTENDED_CHECK && n.related_show_id === showId
  );
  if (exists) return null;

  const headliner = show.artists?.find((a) => a.role === ArtistRole.HEADLINER);
  const artistName = headliner?.artist?.name ?? show.title ?? "演出";
  const notification: Notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: userId,
    type: NotificationType.ATTENDED_CHECK,
    title: `你去了 ${artistName} ${show.city}场吗？`,
    related_show_id: showId,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  useUserStore.getState().addNotification(notification);
  return notification;
}

/** 批量扫描已结束的 going 演出，生成 attended_check（幂等） */
export function checkAndGenerateAttendedNotifications(userId: string): Notification[] {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) return [];

  const generated: Notification[] = [];
  for (const [showId, status] of Object.entries(state.showStatuses)) {
    if (status !== UserShowStatus.GOING) continue;
    const show = showMap.get(showId);
    if (!show) continue;
    const lifecycle = getShowLifecycle(show);
    if (!lifecycle.hasEnded) continue;
    const notif = generateAttendedCheckNotification(userId, showId);
    if (notif) generated.push(notif);
  }
  return generated;
}

// ========================
// P3 互动通知生成器（幂等）
// ========================

/** 生成 ticket_favorite 通知（有人收藏了你的出收票帖） */
export function generateTicketFavoriteNotification(
  recipientId: string,
  postId: string,
  fromUserId: string,
  showId: string
): Notification | null {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== recipientId) return null;

  const fromUser = userMap.get(fromUserId);
  if (!fromUser) return null;

  // 幂等：同 type + recipient + postId 已存在则跳过
  const exists = state.notifications.some(
    (n) =>
      n.type === NotificationType.TICKET_FAVORITE &&
      n.related_content_id === postId &&
      n.from_user_id === fromUserId
  );
  if (exists) return null;

  const notif: Notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: recipientId,
    type: NotificationType.TICKET_FAVORITE,
    title: `${fromUser.display_name} 收藏了你的出收票帖`,
    related_show_id: showId,
    related_content_id: postId,
    from_user_id: fromUserId,
    target_url: `/show/${showId}?tab=ticket#room`,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  useUserStore.getState().addNotification(notif);
  return notif;
}

/** 生成 ticket_message 通知（收到新交易消息） */
export function generateTicketMessageNotification(
  recipientId: string,
  conversationId: string,
  fromUserId: string,
  showId: string
): Notification | null {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== recipientId) return null;

  const fromUser = userMap.get(fromUserId);
  if (!fromUser) return null;

  // 幂等：同 type + conversationId（最近 30 秒内不重复轰炸）
  const recently = state.notifications.some(
    (n) =>
      n.type === NotificationType.TICKET_MESSAGE &&
      n.related_content_id === conversationId &&
      new Date().getTime() - new Date(n.created_at).getTime() < 30_000
  );
  if (recently) return null;

  const notif: Notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: recipientId,
    type: NotificationType.TICKET_MESSAGE,
    title: `${fromUser.display_name} 给你发了一条交易消息`,
    related_show_id: showId,
    related_content_id: conversationId,
    from_user_id: fromUserId,
    target_url: `/show/${showId}?tab=ticket#room`,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  useUserStore.getState().addNotification(notif);
  return notif;
}

/** 通用互动通知（讨论回复/搭子/现场），幂等按 related_content_id */
function generateInteractionNotification(
  recipientId: string,
  fromUserId: string,
  type: NotificationType,
  title: string,
  showId: string,
  contentId: string,
  tab: string
): Notification | null {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== recipientId) return null;
  if (recipientId === fromUserId) return null;

  // 幂等键：类型 + 内容 + 来源用户（不同用户对同一内容的点赞/评论分别通知，
  // 同一用户对同一内容的重复触发只通知一次）
  const exists = state.notifications.some(
    (n) =>
      n.type === type &&
      n.related_content_id === contentId &&
      n.from_user_id === fromUserId
  );
  if (exists) return null;

  const notif: Notification = {
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    user_id: recipientId,
    type,
    title,
    related_show_id: showId,
    related_content_id: contentId,
    from_user_id: fromUserId,
    target_url: `/show/${showId}?tab=${tab}#room`,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  useUserStore.getState().addNotification(notif);
  return notif;
}

/** 讨论回复通知 */
export function generateDiscussionReplyNotification(
  recipientId: string,
  fromUserId: string,
  showId: string,
  messageId: string
): Notification | null {
  const fromUser = userMap.get(fromUserId);
  return generateInteractionNotification(
    recipientId,
    fromUserId,
    NotificationType.DISCUSSION_REPLY,
    `${fromUser?.display_name ?? "有人"} 回复了你的讨论`,
    showId,
    messageId,
    "discussion"
  );
}

/** 找搭子回复通知 */
export function generateBuddyReplyNotification(
  recipientId: string,
  fromUserId: string,
  showId: string,
  postId: string
): Notification | null {
  const fromUser = userMap.get(fromUserId);
  return generateInteractionNotification(
    recipientId,
    fromUserId,
    NotificationType.BUDDY_REPLY,
    `${fromUser?.display_name ?? "有人"} 回复了你的找搭子帖`,
    showId,
    postId,
    "buddy"
  );
}

/** 现场互动通知（点赞/评论） */
export function generateLiveInteractionNotification(
  recipientId: string,
  fromUserId: string,
  showId: string,
  livePostId: string,
  action: "like" | "comment"
): Notification | null {
  const fromUser = userMap.get(fromUserId);
  const actionText = action === "like" ? "点赞" : "评论";
  return generateInteractionNotification(
    recipientId,
    fromUserId,
    NotificationType.LIVE_INTERACTION,
    `${fromUser?.display_name ?? "有人"} ${actionText}了你的现场分享`,
    showId,
    livePostId,
    "live"
  );
}

// ========================
// attended_check 回答处理
// ========================

/** attended_check 回答"是的，我去了"：设置 attended + 标记已读 */
export function answerAttendedCheckYes(notificationId: string): void {
  const state = useUserStore.getState();
  const notif = state.notifications.find((n) => n.id === notificationId);
  if (!notif || notif.type !== NotificationType.ATTENDED_CHECK) return;
  if (notif.related_show_id) {
    useUserStore.getState().setShowStatus(notif.related_show_id, UserShowStatus.ATTENDED);
  }
  useUserStore.getState().markNotificationRead(notificationId);
}

/** attended_check 回答"没去成"：清除 going（如有）+ 标记已读，不删除 RoomMembership */
export function answerAttendedCheckNo(notificationId: string): void {
  const state = useUserStore.getState();
  const notif = state.notifications.find((n) => n.id === notificationId);
  if (!notif || notif.type !== NotificationType.ATTENDED_CHECK) return;
  if (notif.related_show_id) {
    const currentStatus = state.showStatuses[notif.related_show_id];
    if (currentStatus === UserShowStatus.GOING) {
      useUserStore.getState().removeShowStatus(notif.related_show_id);
    }
  }
  useUserStore.getState().markNotificationRead(notificationId);
}
