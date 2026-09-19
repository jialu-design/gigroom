/**
 * API 抽象层 - 找搭子请求模块（P10.6.3）
 *
 * 产品目标：
 * 解决一个人看演出缺少陪伴、拼车、拼酒店、拼双人优惠票的需求。
 *
 * 设计原则：
 * - Supabase 配置时走 companion_requests 表；未配置时 fallback 内存 mock
 * - 创建请求时记录 COMPANION_MATCH 事件（fire-and-forget）
 * - user 字段通过 hydrateUsers 回填（与 posts/messages 一致）
 * - UI 不直接访问 Supabase
 *
 * 数据流：
 *   UI → companions API → Supabase companion_requests / fallback mock
 *                       → events API（trackEvent）
 */
import type { CompanionRequest } from "@/lib/types";
import { CompanionType, CompanionStatus, EventType, TargetType } from "@/lib/types";
import {
  companionRequestsFrom,
  companionRequestRowToCompanionRequest,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";
import { hydrateUsers } from "@/lib/api/profile";
import { trackEvent } from "@/lib/api/events";
import { updateReputation } from "@/lib/api/reputation";
import { ReputationEventType } from "@/lib/types";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ============
// Mock 内存态（fallback 用）
// ============
let mockCompanionRequests: CompanionRequest[] = [
  {
    id: "cr-1",
    user_id: "user-2",
    show_id: "show-4",
    type: CompanionType.COMPANION,
    content: "第一次看 Chinese Football，求搭子一起！",
    status: CompanionStatus.OPEN,
    created_at: "2026-08-10T10:00:00Z",
  },
  {
    id: "cr-2",
    user_id: "user-3",
    show_id: "show-4",
    type: CompanionType.CARPOOL,
    content: "从五角场出发，有偿拼车，3缺1",
    status: CompanionStatus.OPEN,
    created_at: "2026-08-12T10:00:00Z",
  },
];

// ============
// 读取
// ============

/**
 * 获取某场演出的找搭子请求列表
 * - Supabase 配置：查 companion_requests 表
 * - 未配置：fallback mock
 * - 按 created_at 降序（最新优先）
 * - 可按 type 筛选
 * - 回填 user 字段
 */
export async function getCompanionRequests(
  showId: string,
  type?: CompanionType
): Promise<CompanionRequest[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      let query = companionRequestsFrom()
        .select("*")
        .eq("show_id", showId);
      if (type) {
        query = query.eq("type", type);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error || !data) {
        throw error ?? new Error("fetch companion_requests failed");
      }
      const result = (data as unknown as Parameters<typeof companionRequestRowToCompanionRequest>[0][])
        .map(companionRequestRowToCompanionRequest);
      // 回填 user
      await hydrateUsers(result);
      return result;
    } catch {
      warnSupabaseNotConfigured("companion_requests");
      return getMockCompanionRequests(showId, type);
    }
  }
  warnSupabaseNotConfigured("companion_requests");
  return getMockCompanionRequests(showId, type);
}

/** 从 mock 获取找搭子请求 */
function getMockCompanionRequests(
  showId: string,
  type: CompanionType | undefined
): Promise<CompanionRequest[]> {
  let result = mockCompanionRequests
    .filter((r) => r.show_id === showId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  if (type) {
    result = result.filter((r) => r.type === type);
  }
  // 回填 user（从 mock users）
  return delay(result);
}

// ============
// 创建
// ============

/**
 * 创建找搭子请求
 * - Supabase 配置：insert companion_requests
 * - 未配置：fallback mock
 * - 创建后记录 COMPANION_MATCH 事件（fire-and-forget）
 * - 回填 user 字段
 *
 * @param userId   用户 ID
 * @param showId   演出 ID
 * @param type     请求类型
 * @param content  请求内容
 * @returns 创建的 CompanionRequest
 */
export async function createCompanionRequest(
  userId: string,
  showId: string,
  type: CompanionType,
  content: string
): Promise<CompanionRequest> {
  if (!content.trim()) throw new Error("Content is empty");

  if (isBehaviorSupabaseEnabled()) {
    try {
      const insertPayload = {
        user_id: userId,
        show_id: showId,
        type,
        content,
        status: CompanionStatus.OPEN,
      };
      const { data, error } = await companionRequestsFrom()
        .insert(insertPayload)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("create companion_request failed");
      }
      const created = companionRequestRowToCompanionRequest(
        data as unknown as Parameters<typeof companionRequestRowToCompanionRequest>[0]
      );
      // 回填 user
      await hydrateUsers([created]);
      // P10.5: 记录用户行为事件（fire-and-forget）
      void trackEvent(userId, EventType.COMPANION_MATCH, TargetType.POST, created.id, { show_id: showId, companion_type: type });
      return created;
    } catch {
      warnSupabaseNotConfigured("companion_requests");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("companion_requests");
  }

  // fallback 路径
  const created: CompanionRequest = {
    id: `cr-${Date.now()}`,
    user_id: userId,
    show_id: showId,
    type,
    content,
    status: CompanionStatus.OPEN,
    created_at: new Date().toISOString(),
  };
  mockCompanionRequests.unshift(created);
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(userId, EventType.COMPANION_MATCH, TargetType.POST, created.id, { show_id: showId, companion_type: type });
  return delay(created);
}

// ============
// 关闭
// ============

/**
 * 关闭找搭子请求（仅本人）
 * - Supabase 配置：update companion_requests status=closed
 * - 未配置：fallback mock
 * - 幂等：已关闭的不报错
 *
 * @param requestId 请求 ID
 * @param userId    用户 ID（用于权限校验，只能关闭自己的）
 * @returns 更新后的 CompanionRequest
 */
export async function closeCompanionRequest(
  requestId: string,
  userId: string
): Promise<CompanionRequest> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await companionRequestsFrom()
        .update({ status: CompanionStatus.CLOSED })
        .eq("id", requestId)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("close companion_request failed");
      }
      const closed = companionRequestRowToCompanionRequest(
        data as unknown as Parameters<typeof companionRequestRowToCompanionRequest>[0]
      );
      // P10.7: 更新用户信用（fire-and-forget）
      void updateReputation(userId, ReputationEventType.COMPANION_MATCHED, closed.id, "完成搭子匹配");
      return closed;
    } catch {
      warnSupabaseNotConfigured("companion_requests");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("companion_requests");
  }

  // fallback 路径：校验所有权
  const record = mockCompanionRequests.find(
    (r) => r.id === requestId && r.user_id === userId
  );
  if (!record) throw new Error("Companion request not found or not owned");
  record.status = CompanionStatus.CLOSED;
  // P10.7: 更新用户信用（fire-and-forget）
  void updateReputation(userId, ReputationEventType.COMPANION_MATCHED, record.id, "完成搭子匹配");
  return delay(record);
}

// ============
// 测试辅助（仅供测试文件重置 mock 用）
// ============

/** 重置内存找搭子请求（测试用） */
export function __resetMockCompanionRequests(): void {
  mockCompanionRequests = [
    {
      id: "cr-1",
      user_id: "user-2",
      show_id: "show-4",
      type: CompanionType.COMPANION,
      content: "第一次看 Chinese Football，求搭子一起！",
      status: CompanionStatus.OPEN,
      created_at: "2026-08-10T10:00:00Z",
    },
    {
      id: "cr-2",
      user_id: "user-3",
      show_id: "show-4",
      type: CompanionType.CARPOOL,
      content: "从五角场出发，有偿拼车，3缺1",
      status: CompanionStatus.OPEN,
      created_at: "2026-08-12T10:00:00Z",
    },
  ];
}
