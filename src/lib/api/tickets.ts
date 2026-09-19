/**
 * API 抽象层 - 票务持有身份模块（P10.6.1）
 *
 * 产品目标：
 * 建立用户 → TicketOwnership → Show → Room Permission 闭环。
 * 只有真实购票用户才能进入演出 Room，区别于微信群无法确认成员身份的问题。
 *
 * 设计原则：
 * - Supabase 配置时走 ticket_ownerships 表；未配置时 fallback 内存 mock
 * - canJoinShowRoom 采用「opt-in」策略：
 *   - 该演出有票务记录 → 需 verified 票务才能加入
 *   - 该演出无票务记录 → 允许加入（未开启票务验证，向后兼容）
 * - verifyTicketOwnership 用于人工/系统验证票务
 * - UI 不直接访问 Supabase，所有操作经过本文件
 *
 * 数据流：
 *   UI → tickets API → Supabase ticket_ownerships / fallback mock
 *                    → rooms API（joinRoom 前调用 canJoinShowRoom）
 */
import type { TicketOwnership } from "@/lib/types";
import { TicketOwnershipStatus, EventType, TargetType } from "@/lib/types";
import {
  ticketOwnershipsFrom,
  ticketOwnershipRowToTicketOwnership,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";
import { trackEvent } from "@/lib/api/events";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ============
// Mock 内存态（fallback 用）
// ============
let mockTicketOwnerships: TicketOwnership[] = [
  // user-1 已验证 show-1 的票
  {
    id: "to-1",
    user_id: "user-1",
    show_id: "show-1",
    ticket_id: "ticket-show1-user1",
    status: TicketOwnershipStatus.VERIFIED,
    verified_at: "2026-07-20T10:00:00Z",
    created_at: "2026-07-18T10:00:00Z",
  },
  // user-3 已验证 show-1 的票
  {
    id: "to-2",
    user_id: "user-3",
    show_id: "show-1",
    ticket_id: "ticket-show1-user3",
    status: TicketOwnershipStatus.VERIFIED,
    verified_at: "2026-07-21T10:00:00Z",
    created_at: "2026-07-19T10:00:00Z",
  },
  // user-1 已验证 show-4 的票
  {
    id: "to-3",
    user_id: "user-1",
    show_id: "show-4",
    ticket_id: "ticket-show4-user1",
    status: TicketOwnershipStatus.VERIFIED,
    verified_at: "2026-08-01T10:00:00Z",
    created_at: "2026-07-30T10:00:00Z",
  },
];

// ============
// 读取
// ============

/**
 * 获取用户对某场演出的票务持有记录
 * - Supabase 配置：查 ticket_ownerships 表
 * - 未配置：fallback mock
 * - 返回 null 表示无记录
 */
export async function getTicketOwnership(
  userId: string,
  showId: string
): Promise<TicketOwnership | null> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await ticketOwnershipsFrom()
        .select("*")
        .eq("user_id", userId)
        .eq("show_id", showId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return ticketOwnershipRowToTicketOwnership(
        data as unknown as Parameters<typeof ticketOwnershipRowToTicketOwnership>[0]
      );
    } catch {
      warnSupabaseNotConfigured("ticket_ownerships");
      return getMockTicketOwnership(userId, showId);
    }
  }
  warnSupabaseNotConfigured("ticket_ownerships");
  return getMockTicketOwnership(userId, showId);
}

/** 从 mock 获取票务记录 */
function getMockTicketOwnership(
  userId: string,
  showId: string
): Promise<TicketOwnership | null> {
  const record = mockTicketOwnerships.find(
    (t) => t.user_id === userId && t.show_id === showId
  );
  return delay(record ?? null);
}

/**
 * 获取某场演出的所有票务持有记录（用于判断该演出是否开启票务验证）
 * - Supabase 配置：查 ticket_ownerships 表
 * - 未配置：fallback mock
 */
async function getOwnershipsByShow(
  showId: string
): Promise<TicketOwnership[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await ticketOwnershipsFrom()
        .select("*")
        .eq("show_id", showId);
      if (error || !data) {
        throw error ?? new Error("fetch ticket_ownerships failed");
      }
      return (data as unknown as Parameters<typeof ticketOwnershipRowToTicketOwnership>[0][])
        .map(ticketOwnershipRowToTicketOwnership);
    } catch {
      warnSupabaseNotConfigured("ticket_ownerships");
      return mockTicketOwnerships.filter((t) => t.show_id === showId);
    }
  }
  warnSupabaseNotConfigured("ticket_ownerships");
  return delay(mockTicketOwnerships.filter((t) => t.show_id === showId));
}

// ============
// 验证
// ============

/**
 * 验证用户票务持有状态
 * - 将 pending 状态的票务记录更新为 verified
 * - 已 verified 的幂等返回
 * - 不存在记录时抛错
 *
 * @param userId  用户 ID
 * @param showId  演出 ID
 * @returns 更新后的 TicketOwnership
 */
export async function verifyTicketOwnership(
  userId: string,
  showId: string
): Promise<TicketOwnership> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await ticketOwnershipsFrom()
        .update({
          status: TicketOwnershipStatus.VERIFIED,
          verified_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("show_id", showId)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("verify ticket ownership failed");
      }
      const result = ticketOwnershipRowToTicketOwnership(
        data as unknown as Parameters<typeof ticketOwnershipRowToTicketOwnership>[0]
      );
      // P10.6.4: 验证成功后记录 TICKET_PURCHASE 事件（fire-and-forget）
      void trackEvent(userId, EventType.TICKET_PURCHASE, TargetType.SHOW, showId, {
        ticket_id: result.ticket_id,
      });
      return result;
    } catch {
      warnSupabaseNotConfigured("ticket_ownerships");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("ticket_ownerships");
  }

  // fallback 路径
  const record = mockTicketOwnerships.find(
    (t) => t.user_id === userId && t.show_id === showId
  );
  if (!record) throw new Error("Ticket ownership not found");
  record.status = TicketOwnershipStatus.VERIFIED;
  record.verified_at = new Date().toISOString();
  // P10.6.4: 验证成功后记录 TICKET_PURCHASE 事件（fire-and-forget）
  void trackEvent(userId, EventType.TICKET_PURCHASE, TargetType.SHOW, showId, {
    ticket_id: record.ticket_id,
  });
  return delay(record);
}

// ============
// 权限判断
// ============

/**
 * 判断用户是否可以加入某场演出的 Room
 *
 * 规则：
 * - 该演出有票务记录（开启了票务验证）→ 用户需有 verified 票务才能加入
 * - 该演出无票务记录（未开启票务验证）→ 允许加入（向后兼容）
 *
 * @param userId 用户 ID
 * @param showId 演出 ID
 * @returns true = 可以加入, false = 不可以
 */
export async function canJoinShowRoom(
  userId: string,
  showId: string
): Promise<boolean> {
  // 获取该演出的所有票务记录
  const showOwnerships = await getOwnershipsByShow(showId);

  // 无票务记录 → 未开启票务验证，允许加入
  if (showOwnerships.length === 0) {
    return true;
  }

  // 有票务记录 → 检查用户是否有 verified 票务
  const userOwnership = await getTicketOwnership(userId, showId);
  if (!userOwnership) {
    return false;
  }
  return userOwnership.status === TicketOwnershipStatus.VERIFIED;
}

// ============
// 创建票务记录
// ============

/**
 * 创建票务持有记录（用于购票后写入）
 * - Supabase 配置：insert ticket_ownerships
 * - 未配置：fallback mock
 *
 * @param userId    用户 ID
 * @param showId    演出 ID
 * @param ticketId  票务 ID（外部票务系统）
 * @param status    初始状态（默认 pending）
 * @returns 创建的 TicketOwnership
 */
export async function createTicketOwnership(
  userId: string,
  showId: string,
  ticketId: string,
  status: TicketOwnershipStatus = TicketOwnershipStatus.PENDING
): Promise<TicketOwnership> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const insertPayload = {
        user_id: userId,
        show_id: showId,
        ticket_id: ticketId,
        status,
        verified_at: status === TicketOwnershipStatus.VERIFIED
          ? new Date().toISOString()
          : null,
      };
      const { data, error } = await ticketOwnershipsFrom()
        .insert(insertPayload)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("create ticket ownership failed");
      }
      return ticketOwnershipRowToTicketOwnership(
        data as unknown as Parameters<typeof ticketOwnershipRowToTicketOwnership>[0]
      );
    } catch {
      warnSupabaseNotConfigured("ticket_ownerships");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("ticket_ownerships");
  }

  // fallback 路径
  const existing = mockTicketOwnerships.find(
    (t) => t.user_id === userId && t.show_id === showId
  );
  if (existing) {
    return delay(existing);
  }
  const record: TicketOwnership = {
    id: `to-${Date.now()}`,
    user_id: userId,
    show_id: showId,
    ticket_id: ticketId,
    status,
    verified_at: status === TicketOwnershipStatus.VERIFIED
      ? new Date().toISOString()
      : null,
    created_at: new Date().toISOString(),
  };
  mockTicketOwnerships.push(record);
  return delay(record);
}

// ============
// 测试辅助（仅供测试文件重置 mock 用）
// ============

/** 重置内存票务记录（测试用） */
export function __resetMockTicketOwnerships(): void {
  mockTicketOwnerships = [
    {
      id: "to-1",
      user_id: "user-1",
      show_id: "show-1",
      ticket_id: "ticket-show1-user1",
      status: TicketOwnershipStatus.VERIFIED,
      verified_at: "2026-07-20T10:00:00Z",
      created_at: "2026-07-18T10:00:00Z",
    },
    {
      id: "to-2",
      user_id: "user-3",
      show_id: "show-1",
      ticket_id: "ticket-show1-user3",
      status: TicketOwnershipStatus.VERIFIED,
      verified_at: "2026-07-21T10:00:00Z",
      created_at: "2026-07-19T10:00:00Z",
    },
    {
      id: "to-3",
      user_id: "user-1",
      show_id: "show-4",
      ticket_id: "ticket-show4-user1",
      status: TicketOwnershipStatus.VERIFIED,
      verified_at: "2026-08-01T10:00:00Z",
      created_at: "2026-07-30T10:00:00Z",
    },
  ];
}
