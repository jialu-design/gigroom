/**
 * API 抽象层 - 讨论消息模块（P10.2-D 接入 Supabase）
 *
 * 数据来源：
 * - discussion_messages：公共读（anon 可浏览） + 用户写（需 auth + membership）
 *
 * 设计原则：
 * - 业务 API 保持 showId 入参（内部：showId → show_rooms → room_id → discussion_messages）
 * - user/reply_to_user 展示信息暂不复杂化 profiles join，继续用现有 profile 逻辑
 * - Supabase 未配置时 fallback mock
 *
 * RLS：
 * - SELECT：public（anon 可读）
 * - INSERT：需 authenticated + 是 Room 成员
 * - UPDATE/DELETE：仅作者
 *
 * fallback 验证（与 P5 行为一致）：
 * - sendMessage：用户必须是 Room 成员（ghost 被拒绝）
 * - deleteMessage：用户必须是消息作者（非作者被拒绝）
 * - reply_to_user：发送回复时从 mock 数据查找被回复消息的 user
 */
import type { DiscussionMessage } from "@/lib/types";
import { EventType, TargetType } from "@/lib/types";
import { mockMessages } from "@/mocks/messages";
import { getRoomByShow } from "@/lib/api/rooms";
import { canSendMessage } from "@/lib/api/rooms";
import { hydrateUsers, hydrateMessageUsers } from "@/lib/api/profile";
import { trackEvent } from "@/lib/api/events";
import { resolveMockAuthor } from "@/lib/api/mockUser";
import {
  discussionMessagesFrom,
  messageRowToMessage,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

/**
 * 从未知错误中提取人类可读信息。
 * 不同版本/层级的 Supabase SDK 错误形态不一致：
 * - PostgrestError 普通对象：{ code, message, hint, details }
 * - Error 实例（supabase-js fetch 层对 401/403/5xx 会 new Error(响应体原文)），
 *   此时 message 是整个 JSON 字符串，需要二次 parse 取内层 message
 */
function extractErrorMessage(err: unknown, fallback: string): string {
  const raw = (err as { message?: unknown } | null)?.message;
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as { message?: unknown };
      if (typeof parsed.message === "string" && parsed.message.trim()) {
        return parsed.message;
      }
    } catch {
      // 非 JSON 文本，原样使用
    }
    return raw;
  }
  return fallback;
}

/** 通过 showId 获取 roomId（内部 helper，Supabase 路径必经） */
const roomIdCache = new Map<string, string | null>();
async function getRoomIdByShow(showId: string): Promise<string | null> {
  // show → room 映射不可变，进程内缓存，避免每次发消息多一次远程往返
  const cached = roomIdCache.get(showId);
  if (cached !== undefined) return cached;
  const room = await getRoomByShow(showId);
  const roomId = room?.id ?? null;
  // 只缓存命中结果：查询瞬时失败返回 null 时不缓存，下次发送/读取会重试，
  // 避免"一次失败 → 后续所有 sendMessage 永远 Room not found"
  if (roomId) roomIdCache.set(showId, roomId);
  return roomId;
}

// ============
// 读取
// ============

/** 获取指定 show 的讨论消息列表（按 created_at 升序） */
export async function getMessages(showId: string): Promise<DiscussionMessage[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const roomId = await getRoomIdByShow(showId);
      if (!roomId) return delay([]);

      const { data, error } = await discussionMessagesFrom()
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (error || !data) {
        throw error ?? new Error("fetch messages failed");
      }
      const messages = (data as unknown as Parameters<typeof messageRowToMessage>[0][]).map(
        messageRowToMessage
      );
      // P10.4: 通过 profiles 回填 user / reply_to_user，与 mock 路径行为一致
      await hydrateUsers(messages);
      // 并发回填，避免 N 条消息串行 N 次 profiles 请求造成房间打开卡顿
      await Promise.all(messages.map((m) => hydrateMessageUsers(m, messages)));
      return messages;
    } catch {
      warnSupabaseNotConfigured("discussion_messages");
      return fetchMessagesFromMock(showId);
    }
  }
  warnSupabaseNotConfigured("discussion_messages");
  return fetchMessagesFromMock(showId);
}

/** fallback：从 mock 数据读取消息列表 */
async function fetchMessagesFromMock(showId: string): Promise<DiscussionMessage[]> {
  const roomId = await getRoomIdByShow(showId);
  const result = roomId
    ? mockMessages
        .filter((m) => m.room_id === roomId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at))
    : [];
  return delay(result);
}

// ============
// 写入
// ============

/**
 * 发送讨论消息
 * - Supabase 配置：insert discussion_messages（RLS 需 auth + membership）
 * - 未配置：fallback mock（需通过 isRoomMember 校验成员身份）
 * - 返回新消息（fallback 路径补充 reply_to_user）
 */
export async function sendMessage(
  showId: string,
  userId: string,
  content: string,
  replyToId?: string
): Promise<DiscussionMessage> {
  if (!content.trim()) throw new Error("Content is empty");

  // P10.6.2: Room 生命周期校验 — 演出结束后禁止发送消息
  const canSend = await canSendMessage(showId);
  if (!canSend) {
    throw new Error("演出已结束，房间聊天已关闭");
  }

  if (isBehaviorSupabaseEnabled()) {
    try {
      const roomId = await getRoomIdByShow(showId);
      if (!roomId) throw new Error("Room not found");

      const insertPayload: {
        room_id: string;
        user_id: string;
        content: string;
        reply_to_id?: string | null;
      } = {
        room_id: roomId,
        user_id: userId,
        content: content.trim(),
      };
      if (replyToId) {
        insertPayload.reply_to_id = replyToId;
      }

      const { data, error } = await discussionMessagesFrom()
        .insert(insertPayload)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("send message failed");
      }
      const created = messageRowToMessage(data as unknown as Parameters<typeof messageRowToMessage>[0]);
      // P10.4: 回填 user + reply_to_user
      const all = [created];
      await hydrateUsers(all);
      await hydrateMessageUsers(created, all);
      // P10.5: 记录用户行为事件（fire-and-forget）
      void trackEvent(userId, EventType.MESSAGE_SEND, TargetType.MESSAGE, created.id, { show_id: showId, room_id: roomId });
      return created;
    } catch (err) {
      // Supabase 已配置时写入失败（RLS 拒绝 / 网络错误等）必须抛出真实错误，
      // 不能静默降级到 mock：真实用户不在 mock userMap，会报误导性的 "User not found"，
      // 且消息实际并未持久化。UI 据此提示发送失败并回滚乐观消息。
      // 注意：PostgrestError 是普通对象（含 message/hint/code），不是 Error 实例，
      // 需要手动透传 message，否则用户只能看到笼统的 "send message failed"。
      // 统一提取可读 message（兼容 Error 实例 / PostgrestError 对象 /
      // message 为整段 JSON 文本的 fetch 层错误）
      throw new Error(extractErrorMessage(err, "send message failed"));
    }
  }
  warnSupabaseNotConfigured("discussion_messages");

  // fallback 路径：校验用户存在性（ghost 被拒绝，与 buddyPosts 等一致）
  const user = resolveMockAuthor(userId);
  if (!user) {
    throw new Error("User not found");
  }

  const roomId = await getRoomIdByShow(showId);
  if (!roomId) throw new Error("Room not found");

  // 查找被回复消息（用于补充 reply_to_user）
  let replyToUser: DiscussionMessage["reply_to_user"] | undefined;
  if (replyToId) {
    const target = mockMessages.find((m) => m.id === replyToId);
    if (target) {
      replyToUser = target.user;
    }
  }

  const message: DiscussionMessage = {
    id: `msg-${Date.now()}`,
    room_id: roomId,
    user_id: userId,
    user,
    content: content.trim(),
    reply_to_id: replyToId,
    created_at: new Date().toISOString(),
    reply_to_user: replyToUser,
  };
  mockMessages.push(message);
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(userId, EventType.MESSAGE_SEND, TargetType.MESSAGE, message.id, { show_id: showId, room_id: roomId });
  return delay(message);
}

/**
 * 删除讨论消息
 * - Supabase 配置：delete discussion_messages（RLS 限制作者）
 * - 未配置：fallback mock（校验作者身份，非作者被拒绝）
 */
export async function deleteMessage(messageId: string, userId: string): Promise<void> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { error } = await discussionMessagesFrom()
        .delete()
        .eq("id", messageId)
        .eq("user_id", userId);
      if (error) throw error;
      return;
    } catch {
      warnSupabaseNotConfigured("discussion_messages");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("discussion_messages");
  }

  // fallback 路径：校验作者身份（非作者/ghost 被拒绝）
  const index = mockMessages.findIndex((m) => m.id === messageId);
  if (index < 0) {
    throw new Error("Message not found");
  }
  if (mockMessages[index].user_id !== userId) {
    throw new Error("Not the author");
  }
  mockMessages.splice(index, 1);
  return delay(undefined);
}
