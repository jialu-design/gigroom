/**
 * API 抽象层 - 用户信用体系（P10.7）
 *
 * 产品目标：
 * 建立用户信用基础层，记录用户在转票、找搭子、观演等场景的信用变化。
 *
 * 设计原则：
 * - Supabase 配置时走 user_reputations + reputation_events 表；未配置时 fallback 内存 mock
 * - updateReputation 同时写入 reputation_events 和更新 user_reputations 汇总
 * - 信用分变动是 fire-and-forget，不阻塞主业务流程
 * - UI 不直接访问 Supabase
 *
 * 信用分权重：
 * - TICKET_TRANSFER_COMPLETED: +10（完成一次官方转票）
 * - COMPANION_MATCHED: +5（成功匹配搭子）
 * - SHOW_ATTENDED: +8（参加演出）
 * - POST_CREATED: +2（发布帖子）
 * - ROOM_JOINED: +3（加入房间）
 */
import type { UserReputation, ReputationEvent } from "@/lib/types";
import { ReputationEventType } from "@/lib/types";
import {
  userReputationsFrom,
  reputationEventsFrom,
  userReputationRowToUserReputation,
  reputationEventRowToReputationEvent,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

/** 信用分权重映射 */
export const REPUTATION_SCORES: Record<ReputationEventType, number> = {
  [ReputationEventType.TICKET_TRANSFER_COMPLETED]: 10,
  [ReputationEventType.COMPANION_MATCHED]: 5,
  [ReputationEventType.SHOW_ATTENDED]: 8,
  [ReputationEventType.POST_CREATED]: 2,
  [ReputationEventType.ROOM_JOINED]: 3,
  [ReputationEventType.MANUAL_ADJUSTMENT]: 0,
};

// ============
// Mock 内存态
// ============
const mockReputations = new Map<string, UserReputation>();
let mockReputationEvents: ReputationEvent[] = [];

function getMockReputation(userId: string): UserReputation {
  let rep = mockReputations.get(userId);
  if (!rep) {
    rep = {
      user_id: userId,
      total_score: 0,
      transfer_count: 0,
      companion_count: 0,
      attended_count: 0,
      updated_at: new Date().toISOString(),
    };
    mockReputations.set(userId, rep);
  }
  return rep;
}

// ============
// 读取
// ============

/**
 * 获取用户信用汇总
 * - Supabase 配置：查 user_reputations 表
 * - 未配置：fallback mock
 * - 不存在记录时返回初始值（total_score=0）
 */
export async function getUserReputation(
  userId: string
): Promise<UserReputation> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await userReputationsFrom()
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        // 不存在记录，返回初始值
        return {
          user_id: userId,
          total_score: 0,
          transfer_count: 0,
          companion_count: 0,
          attended_count: 0,
          updated_at: new Date().toISOString(),
        };
      }
      return userReputationRowToUserReputation(
        data as unknown as Parameters<typeof userReputationRowToUserReputation>[0]
      );
    } catch {
      warnSupabaseNotConfigured("user_reputations");
      return delay(getMockReputation(userId));
    }
  }
  warnSupabaseNotConfigured("user_reputations");
  return delay(getMockReputation(userId));
}

/**
 * 获取用户信用变动历史
 * - 按 created_at 降序（最新优先）
 */
export async function getReputationHistory(
  userId: string
): Promise<ReputationEvent[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await reputationEventsFrom()
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error || !data) {
        throw error ?? new Error("fetch reputation_events failed");
      }
      return (data as unknown as Parameters<typeof reputationEventRowToReputationEvent>[0][])
        .map(reputationEventRowToReputationEvent);
    } catch {
      warnSupabaseNotConfigured("reputation_events");
      return delay(
        mockReputationEvents
          .filter((e) => e.user_id === userId)
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
      );
    }
  }
  warnSupabaseNotConfigured("reputation_events");
  return delay(
    mockReputationEvents
      .filter((e) => e.user_id === userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  );
}

// ============
// 更新信用
// ============

/**
 * 更新用户信用
 * - 写入 reputation_events 记录
 * - 更新 user_reputations 汇总（upsert）
 * - fire-and-forget 友好，不抛错（信用失败不阻塞业务）
 *
 * @param userId      用户 ID
 * @param eventType   信用事件类型
 * @param relatedId   关联 ID（如 transfer_id, companion_request_id, show_id）
 * @param description 描述
 * @returns 更新后的 UserReputation
 */
export async function updateReputation(
  userId: string,
  eventType: ReputationEventType,
  relatedId: string | null,
  description: string
): Promise<UserReputation> {
  const scoreDelta = REPUTATION_SCORES[eventType] ?? 0;

  if (isBehaviorSupabaseEnabled()) {
    try {
      // 1. 写入事件记录
      const eventPayload = {
        user_id: userId,
        event_type: eventType,
        score_delta: scoreDelta,
        description,
        related_id: relatedId,
      };
      const { error: eventError } = await reputationEventsFrom()
        .insert(eventPayload);
      if (eventError) throw eventError;

      // 2. 更新汇总（upsert）
      const current = await getUserReputation(userId);
      const updated = {
        user_id: userId,
        total_score: current.total_score + scoreDelta,
        transfer_count: current.transfer_count + (eventType === ReputationEventType.TICKET_TRANSFER_COMPLETED ? 1 : 0),
        companion_count: current.companion_count + (eventType === ReputationEventType.COMPANION_MATCHED ? 1 : 0),
        attended_count: current.attended_count + (eventType === ReputationEventType.SHOW_ATTENDED ? 1 : 0),
        updated_at: new Date().toISOString(),
      };
      const { data, error: repError } = await userReputationsFrom()
        .upsert(updated, { onConflict: "user_id" })
        .select("*")
        .single();
      if (repError || !data) throw repError ?? new Error("upsert reputation failed");
      return userReputationRowToUserReputation(
        data as unknown as Parameters<typeof userReputationRowToUserReputation>[0]
      );
    } catch {
      warnSupabaseNotConfigured("user_reputations");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("user_reputations");
  }

  // fallback 路径
  const rep = getMockReputation(userId);
  rep.total_score += scoreDelta;
  if (eventType === ReputationEventType.TICKET_TRANSFER_COMPLETED) rep.transfer_count += 1;
  if (eventType === ReputationEventType.COMPANION_MATCHED) rep.companion_count += 1;
  if (eventType === ReputationEventType.SHOW_ATTENDED) rep.attended_count += 1;
  rep.updated_at = new Date().toISOString();

  const event: ReputationEvent = {
    id: `re-${Date.now()}`,
    user_id: userId,
    event_type: eventType,
    score_delta: scoreDelta,
    description,
    related_id: relatedId,
    created_at: new Date().toISOString(),
  };
  mockReputationEvents.unshift(event);

  return delay(rep);
}

// ============
// 测试辅助
// ============

/** 重置内存信用数据（测试用） */
export function __resetMockReputation(): void {
  mockReputations.clear();
  mockReputationEvents = [];
}
