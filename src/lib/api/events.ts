/**
 * API 抽象层 - 用户行为事件模块（P10.5）
 *
 * 职责：
 * 1. trackEvent — 记录用户行为事件（fire-and-forget，不阻塞主业务流程）
 * 2. getUserEvents — 查询用户历史事件
 * 3. getUserInterestProfile — 聚合计算用户兴趣画像（AI 推荐基础输入）
 *
 * 设计原则：
 * - 事件追踪失败绝不阻塞用户操作：trackEvent 内部 catch 所有异常
 * - Supabase 配置时写入 user_events 表；未配置时 fallback 内存数组
 * - UI 不感知事件追踪：业务 API 在操作成功后调用 trackEvent
 * - getUserInterestProfile 聚合多数据源：user_events + follows + show_statuses
 *
 * 数据流：
 *   UI → 业务 API（followArtist / joinRoom / createPost ...）
 *              ↓ 成功后
 *        trackEvent(event_type, target_type, target_id, metadata)
 *              ↓
 *        Supabase user_events / fallback 内存
 *              ↓
 *        getUserInterestProfile → AI 推荐输入
 */
import type { UserEvent, UserInterestProfile } from "@/lib/types";
import { EventType, TargetType, UserShowStatus } from "@/lib/types";
import {
  userEventsFrom,
  userEventRowToUserEvent,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";
import { getFollowedArtists } from "@/lib/api/follows";
import { getUserShowStatuses } from "@/lib/api/user";
import { getRoomsByUser } from "@/lib/api/rooms";
import { getArtistById } from "@/lib/api/artists";

const delay = <T>(data: T, ms = 50): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ============
// Mock 内存态（fallback 用）
// ============
let mockEvents: UserEvent[] = [];

// ============
// trackEvent — 记录用户行为事件
// ============

/**
 * 记录用户行为事件（fire-and-forget）
 *
 * 重要：本函数永远不会 throw。事件追踪失败只记录警告，不影响主业务流程。
 * 调用方无需 await（但可以 await 以确保事件写入完成）。
 *
 * @param userId    用户 ID
 * @param eventType 事件类型
 * @param targetType 目标类型
 * @param targetId  目标 ID
 * @param metadata  额外信息（如 post 类型、show 标题等）
 */
export async function trackEvent(
  userId: string,
  eventType: EventType,
  targetType: TargetType,
  targetId: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    if (isBehaviorSupabaseEnabled()) {
      const insertPayload = {
        user_id: userId,
        event_type: eventType,
        target_type: targetType,
        target_id: targetId,
        metadata: metadata ?? null,
      };
      const { error } = await userEventsFrom().insert(insertPayload);
      if (error) throw error;
      return;
    }
    // fallback：写入内存
    warnSupabaseNotConfigured("user_events");
    mockEvents.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: userId,
      event_type: eventType,
      target_type: targetType,
      target_id: targetId,
      metadata: metadata ?? null,
      created_at: new Date().toISOString(),
    });
  } catch {
    // 事件追踪失败不阻塞主流程，静默降级到内存
    mockEvents.push({
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user_id: userId,
      event_type: eventType,
      target_type: targetType,
      target_id: targetId,
      metadata: metadata ?? null,
      created_at: new Date().toISOString(),
    });
  }
}

// ============
// getUserEvents — 查询用户历史事件
// ============

/**
 * 查询用户行为事件列表
 * - Supabase 配置：从 user_events 表读取
 * - 未配置：从内存 mock 读取
 * - 按 created_at 降序（最新优先）
 *
 * @param userId    用户 ID
 * @param eventType 可选：按事件类型筛选
 * @param limit     可选：返回条数上限（默认 100）
 */
export async function getUserEvents(
  userId: string,
  eventType?: EventType,
  limit = 100
): Promise<UserEvent[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      let query = userEventsFrom()
        .select("*")
        .eq("user_id", userId);
      if (eventType) {
        query = query.eq("event_type", eventType);
      }
      const { data, error } = await query
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error || !data) {
        throw error ?? new Error("fetch user_events failed");
      }
      return (data as unknown as Parameters<typeof userEventRowToUserEvent>[0][])
        .map(userEventRowToUserEvent);
    } catch {
      warnSupabaseNotConfigured("user_events");
      return getMockEvents(userId, eventType, limit);
    }
  }
  warnSupabaseNotConfigured("user_events");
  return getMockEvents(userId, eventType, limit);
}

/** 从内存 mock 读取事件 */
function getMockEvents(
  userId: string,
  eventType: EventType | undefined,
  limit: number
): Promise<UserEvent[]> {
  let result = mockEvents
    .filter((e) => e.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (eventType) {
    result = result.filter((e) => e.event_type === eventType);
  }
  return delay(result.slice(0, limit));
}

// ============
// getUserInterestProfile — 用户兴趣画像（AI 推荐基础输入）
// ============

/**
 * 聚合计算用户兴趣画像
 *
 * 数据来源：
 * - favoriteArtists：从 follows 获取已关注艺人 ID 列表
 * - favoriteGenres：从关注艺人的 genres 聚合，按频次排序取 Top 5
 * - attendedShows：从 user_show_statuses 中 status=attended 的演出 ID
 * - activeCommunities：从 room_memberships 获取已加入房间对应的 show ID
 * - engagementScore：根据事件数量 + 关注数 + 帖子/评论数计算（0-100）
 *
 * 任何子查询失败时返回部分结果，不抛出异常。
 */
export async function getUserInterestProfile(
  userId: string
): Promise<UserInterestProfile> {
  // 并行查询所有数据源
  const [followedArtists, showStatuses, rooms, events] = await Promise.all([
    getFollowedArtists(userId).catch(() => []),
    getUserShowStatuses(userId).catch(() => []),
    getRoomsByUser(userId).catch(() => []),
    getUserEvents(userId).catch(() => []),
  ]);

  // favoriteArtists：关注艺人 ID 列表
  const favoriteArtists = followedArtists.map((a) => a.id);

  // favoriteGenres：从关注艺人聚合 genres，按频次排序取 Top 5
  const genreCount = new Map<string, number>();
  for (const artist of followedArtists) {
    for (const genre of artist.genres) {
      genreCount.set(genre, (genreCount.get(genre) ?? 0) + 1);
    }
  }
  const favoriteGenres = Array.from(genreCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([genre]) => genre);

  // attendedShows：status=attended 的演出 ID
  const attendedShows = showStatuses
    .filter((s) => s.status === UserShowStatus.ATTENDED)
    .map((s) => s.show_id);

  // activeCommunities：已加入房间对应的 show ID
  const activeCommunities = rooms.map((r) => r.show_id);

  // engagementScore：基于用户行为事件计算（0-100）
  // 权重：artist_follow=2, room_join=3, post_create=5, comment_create=3,
  //       message_send=2, show_interest=2, show_attend=5, show_view=1,
  //       ticket_purchase=6, ticket_transfer=4, companion_match=4
  const WEIGHTS: Record<EventType, number> = {
    [EventType.ARTIST_FOLLOW]: 2,
    [EventType.ROOM_JOIN]: 3,
    [EventType.POST_CREATE]: 5,
    [EventType.COMMENT_CREATE]: 3,
    [EventType.MESSAGE_SEND]: 2,
    [EventType.SHOW_INTEREST]: 2,
    [EventType.SHOW_ATTEND]: 5,
    [EventType.SHOW_VIEW]: 1,
    [EventType.TICKET_PURCHASE]: 6,
    [EventType.TICKET_TRANSFER]: 4,
    [EventType.COMPANION_MATCH]: 4,
  };
  let rawScore = 0;
  for (const evt of events) {
    rawScore += WEIGHTS[evt.event_type] ?? 1;
  }
  // 归一化到 0-100（sqrt 压缩，避免重度用户爆表）
  const engagementScore = Math.min(100, Math.round(Math.sqrt(rawScore) * 10));

  return {
    favoriteArtists,
    favoriteGenres,
    attendedShows,
    activeCommunities,
    engagementScore,
  };
}

// ============
// 测试辅助（仅供测试文件重置 mock 用）
// ============

/** 重置内存事件（测试用） */
export function __resetMockEvents(): void {
  mockEvents = [];
}

/** 获取内存事件数（测试用） */
export function __getMockEventCount(): number {
  return mockEvents.length;
}
