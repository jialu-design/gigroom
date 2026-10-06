/**
 * API 抽象层 - 交易消息模块（P3 V1 mock，无支付/订单）
 *
 * 闭环：出收票帖 → 收藏 → 私聊（建立会话）→ 交易消息
 *
 * 规则：
 * - 禁止与自己发帖建立会话（防自发）
 * - 演出结束后禁止新会话/新消息，历史会话与消息保留只读
 * - 通知：收到新消息时给对方发 TICKET_MESSAGE 通知（幂等按会话）
 */
import type { TicketConversation, TicketMessage } from "@/lib/types";
import {
  mockTicketConversations,
  mockTicketMessages,
} from "@/mocks/ticketMessages";
import { userMap } from "@/mocks/users";
import { showMap } from "@/mocks/shows";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";
import { generateTicketMessageNotification } from "@/lib/api/notifications";

const delay = <T>(data: T, ms = 80): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

let conversations = [...mockTicketConversations];
let messages = [...mockTicketMessages];

function hydrateConversation(c: TicketConversation): TicketConversation {
  return {
    ...c,
    owner: userMap.get(c.owner_user_id),
    requester: userMap.get(c.requester_user_id),
    show: showMap.get(c.show_id),
  };
}

/** 获取某帖的会话（按发起用户），不存在返回 null */
export async function getConversationByPost(
  postId: string,
  requesterId: string,
  postOwnerId: string
): Promise<TicketConversation | null> {
  // 防自发：自己跟自己聊直接返回 null
  if (requesterId === postOwnerId) return delay(null);
  const found = conversations.find(
    (c) => c.ticket_post_id === postId && c.requester_user_id === requesterId
  );
  return delay(found ? hydrateConversation(found) : null);
}

/** 内部：列出某出收票帖下的全部会话 id（帖子删除时联动失效交易消息通知） */
export function getConversationIdsByPost(postId: string): string[] {
  return conversations
    .filter((c) => c.ticket_post_id === postId)
    .map((c) => c.id);
}

/** 建立或复用会话（私聊入口）。返回会话与是否新建 */
export async function getOrCreateConversation(
  postId: string,
  showId: string,
  requesterId: string,
  postOwnerId: string
): Promise<{ conversation: TicketConversation; created: boolean }> {
  if (requesterId === postOwnerId) {
    throw new Error("不能和自己发布的帖子聊天");
  }
  const existing = conversations.find(
    (c) => c.ticket_post_id === postId && c.requester_user_id === requesterId
  );
  if (existing) return delay({ conversation: hydrateConversation(existing), created: false });

  // 演出结束后禁止新会话（历史保留）
  const show = showMap.get(showId);
  if (show && getShowLifecycle(show).hasEnded) {
    throw new Error("演出已结束，无法发起新的交易沟通");
  }

  const conv: TicketConversation = {
    id: `conv-${Date.now()}`,
    ticket_post_id: postId,
    show_id: showId,
    owner_user_id: postOwnerId,
    requester_user_id: requesterId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  conversations.unshift(conv);
  return delay({ conversation: hydrateConversation(conv), created: true });
}

/** 获取用户参与的全部会话（含最后消息预览与未读数） */
export async function getConversationsByUser(
  userId: string
): Promise<TicketConversation[]> {
  const mine = conversations.filter(
    (c) => c.owner_user_id === userId || c.requester_user_id === userId
  );
  const hydrated = mine.map((c) => {
    const convMessages = messages
      .filter((m) => m.conversation_id === c.id)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const last = convMessages[convMessages.length - 1];
    const unread = convMessages.filter(
      (m) => !m.is_read && m.from_user_id !== userId
    ).length;
    return {
      ...hydrateConversation(c),
      unread_count: unread,
      last_message_preview: last?.content ?? "",
      updated_at: last?.created_at ?? c.updated_at,
    };
  });
  hydrated.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  return delay(hydrated);
}

/** 获取会话消息（升序） */
export async function getTicketMessages(
  conversationId: string
): Promise<TicketMessage[]> {
  const result = messages
    .filter((m) => m.conversation_id === conversationId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((m) => ({ ...m, from_user: userMap.get(m.from_user_id) }));
  return delay(result);
}

/** 发送交易消息 */
export async function sendTicketMessage(
  conversationId: string,
  fromUserId: string,
  content: string
): Promise<TicketMessage> {
  const trimmed = content.trim();
  if (!trimmed) throw new Error("消息不能为空");

  const conv = conversations.find((c) => c.id === conversationId);
  if (!conv) throw new Error("会话不存在");
  if (conv.owner_user_id !== fromUserId && conv.requester_user_id !== fromUserId) {
    throw new Error("不是会话参与者");
  }

  // 演出结束后禁止新消息（历史保留只读）
  const show = showMap.get(conv.show_id);
  if (show && getShowLifecycle(show).hasEnded) {
    throw new Error("演出已结束，交易沟通已关闭");
  }

  const msg: TicketMessage = {
    id: `tm-${Date.now()}`,
    conversation_id: conversationId,
    from_user_id: fromUserId,
    from_user: userMap.get(fromUserId),
    content: trimmed,
    is_read: false,
    created_at: new Date().toISOString(),
  };
  messages.push(msg);
  conv.updated_at = msg.created_at;

  // 通知对方（fire-and-forget）
  const toUserId =
    conv.owner_user_id === fromUserId ? conv.requester_user_id : conv.owner_user_id;
  void generateTicketMessageNotification(toUserId, conversationId, fromUserId, conv.show_id);

  return delay({ ...msg });
}

/** 标记会话内对方消息全部已读 */
export async function markConversationRead(
  conversationId: string,
  readerId: string
): Promise<void> {
  messages = messages.map((m) =>
    m.conversation_id === conversationId && m.from_user_id !== readerId
      ? { ...m, is_read: true }
      : m
  );
  return delay(undefined);
}
