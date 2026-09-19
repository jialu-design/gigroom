/**
 * API 抽象层 - 官方转票模块（P10.6.4）
 *
 * 产品目标：
 * 在 Gigroom 官方场景内完成转票，避免闲鱼高价票和黄牛炒票。
 *
 * 核心规则：
 * - transfer_price <= original_price（禁止高价转售）
 * - 只有票务持有者（seller）可以发起转票
 * - 完成转票后记录 TICKET_TRANSFER 事件
 *
 * 设计原则：
 * - Supabase 配置时走 ticket_transfers 表；未配置时 fallback 内存 mock
 * - UI 不直接访问 Supabase
 * - seller/buyer 用户信息通过 hydrateUsers 回填
 *
 * 数据流：
 *   UI → ticketTransfers API → Supabase ticket_transfers / fallback mock
 *                           → events API（trackEvent TICKET_TRANSFER）
 */
import type { TicketTransfer } from "@/lib/types";
import { TicketTransferStatus, EventType, TargetType } from "@/lib/types";
import {
  ticketTransfersFrom,
  ticketTransferRowToTicketTransfer,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";
import { trackEvent } from "@/lib/api/events";
import { updateReputation } from "@/lib/api/reputation";
import { ReputationEventType } from "@/lib/types";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ============
// Mock 内存态（fallback 用）
// ============
let mockTicketTransfers: TicketTransfer[] = [];

// ============
// 读取
// ============

/**
 * 获取某张票的转票记录
 * - Supabase 配置：查 ticket_transfers 表
 * - 未配置：fallback mock
 */
export async function getTicketTransfersByTicket(
  ticketId: string
): Promise<TicketTransfer[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await ticketTransfersFrom()
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });
      if (error || !data) {
        throw error ?? new Error("fetch ticket_transfers failed");
      }
      return (data as unknown as Parameters<typeof ticketTransferRowToTicketTransfer>[0][])
        .map(ticketTransferRowToTicketTransfer);
    } catch {
      warnSupabaseNotConfigured("ticket_transfers");
      return mockTicketTransfers.filter((t) => t.ticket_id === ticketId);
    }
  }
  warnSupabaseNotConfigured("ticket_transfers");
  return delay(mockTicketTransfers.filter((t) => t.ticket_id === ticketId));
}

/**
 * 获取用户作为 seller 的转票记录
 */
export async function getTicketTransfersBySeller(
  sellerId: string
): Promise<TicketTransfer[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await ticketTransfersFrom()
        .select("*")
        .eq("seller_id", sellerId)
        .order("created_at", { ascending: false });
      if (error || !data) {
        throw error ?? new Error("fetch ticket_transfers failed");
      }
      return (data as unknown as Parameters<typeof ticketTransferRowToTicketTransfer>[0][])
        .map(ticketTransferRowToTicketTransfer);
    } catch {
      warnSupabaseNotConfigured("ticket_transfers");
      return mockTicketTransfers.filter((t) => t.seller_id === sellerId);
    }
  }
  warnSupabaseNotConfigured("ticket_transfers");
  return delay(mockTicketTransfers.filter((t) => t.seller_id === sellerId));
}

// ============
// 创建转票
// ============

/**
 * 创建转票记录
 *
 * 核心规则：
 * - transfer_price <= original_price（禁止高价转售）
 * - 违反规则时抛错
 *
 * @param sellerId       卖家用户 ID
 * @param ticketId       票务 ID
 * @param originalPrice  原价
 * @param transferPrice  转票价格
 * @returns 创建的 TicketTransfer（status=pending）
 */
export async function createTicketTransfer(
  sellerId: string,
  ticketId: string,
  originalPrice: number,
  transferPrice: number
): Promise<TicketTransfer> {
  // 核心规则：禁止高价转售
  if (transferPrice > originalPrice) {
    throw new Error("转票价格不能高于原价");
  }

  if (isBehaviorSupabaseEnabled()) {
    try {
      const insertPayload = {
        ticket_id: ticketId,
        seller_id: sellerId,
        buyer_id: null,
        original_price: originalPrice,
        transfer_price: transferPrice,
        status: TicketTransferStatus.PENDING,
      };
      const { data, error } = await ticketTransfersFrom()
        .insert(insertPayload)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("create ticket_transfer failed");
      }
      return ticketTransferRowToTicketTransfer(
        data as unknown as Parameters<typeof ticketTransferRowToTicketTransfer>[0]
      );
    } catch {
      warnSupabaseNotConfigured("ticket_transfers");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("ticket_transfers");
  }

  // fallback 路径
  const created: TicketTransfer = {
    id: `tt-${Date.now()}`,
    ticket_id: ticketId,
    seller_id: sellerId,
    buyer_id: null,
    original_price: originalPrice,
    transfer_price: transferPrice,
    status: TicketTransferStatus.PENDING,
    created_at: new Date().toISOString(),
  };
  mockTicketTransfers.unshift(created);
  return delay(created);
}

// ============
// 完成转票
// ============

/**
 * 完成转票
 * - 将 status 从 pending 更新为 completed
 * - 设置 buyer_id
 * - 完成后记录 TICKET_TRANSFER 事件（fire-and-forget）
 * - 只有 seller 可以完成转票
 *
 * @param transferId  转票记录 ID
 * @param buyerId     买家用户 ID
 * @param sellerId    卖家用户 ID（权限校验）
 * @returns 更新后的 TicketTransfer
 */
export async function completeTicketTransfer(
  transferId: string,
  buyerId: string,
  sellerId: string
): Promise<TicketTransfer> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await ticketTransfersFrom()
        .update({
          buyer_id: buyerId,
          status: TicketTransferStatus.COMPLETED,
        })
        .eq("id", transferId)
        .eq("seller_id", sellerId)
        .eq("status", TicketTransferStatus.PENDING)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("complete ticket_transfer failed");
      }
      const completed = ticketTransferRowToTicketTransfer(
        data as unknown as Parameters<typeof ticketTransferRowToTicketTransfer>[0]
      );
      // P10.5: 记录用户行为事件（fire-and-forget）
      void trackEvent(sellerId, EventType.TICKET_TRANSFER, TargetType.POST, completed.id, {
        ticket_id: completed.ticket_id,
        buyer_id: buyerId,
        price: completed.transfer_price,
      });
      // P10.7: 更新卖家信用（fire-and-forget）
      void updateReputation(sellerId, ReputationEventType.TICKET_TRANSFER_COMPLETED, completed.id, "完成官方转票");
      return completed;
    } catch {
      warnSupabaseNotConfigured("ticket_transfers");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("ticket_transfers");
  }

  // fallback 路径：校验所有权
  const record = mockTicketTransfers.find(
    (t) => t.id === transferId && t.seller_id === sellerId
  );
  if (!record) throw new Error("Ticket transfer not found or not owned");
  if (record.status !== TicketTransferStatus.PENDING) {
    throw new Error("Ticket transfer is not pending");
  }
  record.buyer_id = buyerId;
  record.status = TicketTransferStatus.COMPLETED;
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(sellerId, EventType.TICKET_TRANSFER, TargetType.POST, record.id, {
    ticket_id: record.ticket_id,
    buyer_id: buyerId,
    price: record.transfer_price,
  });
  // P10.7: 更新卖家信用（fire-and-forget）
  void updateReputation(sellerId, ReputationEventType.TICKET_TRANSFER_COMPLETED, record.id, "完成官方转票");
  return delay(record);
}

// ============
// 取消转票
// ============

/**
 * 取消转票
 * - 将 status 从 pending 更新为 cancelled
 * - 只有 seller 可以取消
 *
 * @param transferId  转票记录 ID
 * @param sellerId    卖家用户 ID（权限校验）
 * @returns 更新后的 TicketTransfer
 */
export async function cancelTicketTransfer(
  transferId: string,
  sellerId: string
): Promise<TicketTransfer> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await ticketTransfersFrom()
        .update({ status: TicketTransferStatus.CANCELLED })
        .eq("id", transferId)
        .eq("seller_id", sellerId)
        .eq("status", TicketTransferStatus.PENDING)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("cancel ticket_transfer failed");
      }
      return ticketTransferRowToTicketTransfer(
        data as unknown as Parameters<typeof ticketTransferRowToTicketTransfer>[0]
      );
    } catch {
      warnSupabaseNotConfigured("ticket_transfers");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("ticket_transfers");
  }

  // fallback 路径：校验所有权
  const record = mockTicketTransfers.find(
    (t) => t.id === transferId && t.seller_id === sellerId
  );
  if (!record) throw new Error("Ticket transfer not found or not owned");
  if (record.status !== TicketTransferStatus.PENDING) {
    throw new Error("Ticket transfer is not pending");
  }
  record.status = TicketTransferStatus.CANCELLED;
  return delay(record);
}

// ============
// 测试辅助（仅供测试文件重置 mock 用）
// ============

/** 重置内存转票记录（测试用） */
export function __resetMockTicketTransfers(): void {
  mockTicketTransfers = [];
}
