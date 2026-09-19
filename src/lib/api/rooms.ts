/**
 * API 抽象层 - 房间模块（P10.2-D 接入 Supabase）
 *
 * 数据来源：
 * - show_rooms：公共读（Supabase public read / fallback mock）
 * - room_memberships：用户行为（Supabase 为事实来源 + Zustand 为 UI cache）
 *
 * 设计原则：
 * - isRoomMember 保留 API 层：Supabase 配置时查询真实 DB（权限事实来源）；
 *   未配置时 fallback mock。不改读 Zustand。
 * - joinRoom/leaveRoom：写 Supabase + sync store（UI 单一响应式来源）
 * - show_rooms count 字段保留 optional，Supabase 路径不返回 count
 *
 * 幂等性：
 * - joinRoom：upsert onConflict 'user_id,room_id'
 * - leaveRoom：delete 自然幂等
 */
import type { ShowRoom, RoomMembership } from "@/lib/types";
import { EventType, TargetType, RoomStatus, ShowStatus } from "@/lib/types";
import { mockShowRooms } from "@/mocks/shows";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
  showRoomsFrom,
  roomMembershipsFrom,
  showRoomRowToShowRoom,
  membershipRowToMembership,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";
import { trackEvent } from "@/lib/api/events";
import { getShowById } from "@/lib/api/shows";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// Mock 内存态：用户已加入的房间（fallback 用，与 store 独立）
let mockMemberships: RoomMembership[] = [
  { id: "rm-1", user_id: "user-1", room_id: "room-1", joined_at: "2026-07-20T10:00:00Z" },
  { id: "rm-4", user_id: "user-1", room_id: "room-4", joined_at: "2026-08-01T10:00:00Z" },
];

/**
 * Mock 模式下按用户查房间：种子 membership ∪ store membership（单一事实来源）。
 * 真实登录用户（Supabase UUID）的 membership 只存在于 store，必须合并才能查到。
 */
function getMockRoomsByUser(userId: string): ShowRoom[] {
  const storeRoomIds = useUserStore
    .getState()
    .roomMemberships.filter((m) => m.user_id === userId)
    .map((m) => m.room_id);
  const seedRoomIds = mockMemberships
    .filter((m) => m.user_id === userId)
    .map((m) => m.room_id);
  const ids = new Set([...storeRoomIds, ...seedRoomIds]);
  return mockShowRooms.filter((r) => ids.has(r.id));
}

/** 校验 userId 为当前登录用户 */
function requireCurrentUserId(userId: string): void {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) {
    throw new Error("未登录或用户不匹配");
  }
}

// ============
// show_rooms 公共读
// ============

/** 根据 showId 获取房间信息（含 room_status） */
export async function getRoomByShow(showId: string): Promise<ShowRoom | null> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await showRoomsFrom()
        .select("*")
        .eq("show_id", showId)
        .single();
      if (error || !data) {
        throw error ?? new Error("fetch room failed");
      }
      const room = showRoomRowToShowRoom(data);
      // P10.6.2: 填充 room_status
      room.room_status = await getRoomStatus(showId);
      return room;
    } catch {
      warnSupabaseNotConfigured("show_rooms");
      const room = mockShowRooms.find((r) => r.show_id === showId);
      if (!room) return delay(null);
      const result: ShowRoom = { ...room };
      result.room_status = await getRoomStatus(showId);
      return delay(result);
    }
  }
  warnSupabaseNotConfigured("show_rooms");
  const room = mockShowRooms.find((r) => r.show_id === showId);
  if (!room) return delay(null);
  const result: ShowRoom = { ...room };
  result.room_status = await getRoomStatus(showId);
  return delay(result);
}

// ============
// room_memberships 用户行为
// ============

/**
 * 获取用户加入的所有房间
 * - Supabase 配置：查 DB room_memberships + join show_rooms
 * - 未配置：fallback mock
 */
export async function getRoomsByUser(userId: string): Promise<ShowRoom[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      // 拆成两次简单查询，避免 PostgREST embed 关系推断失败导致整页空数据
      const { data: memberships, error: mError } = await roomMembershipsFrom()
        .select("room_id")
        .eq("user_id", userId);
      if (mError) throw mError;
      const roomIds = (memberships ?? []).map((m) => m.room_id);
      if (roomIds.length === 0) return [];

      const { data: roomRows, error: rError } = await showRoomsFrom()
        .select("*")
        .in("id", roomIds);
      if (rError || !roomRows) {
        throw rError ?? new Error("fetch rooms failed");
      }
      return roomRows.map(showRoomRowToShowRoom);
    } catch {
      warnSupabaseNotConfigured("room_memberships");
      return getMockRoomsByUser(userId);
    }
  }
  warnSupabaseNotConfigured("room_memberships");
  return getMockRoomsByUser(userId);
}

/**
 * 加入房间
 * - Supabase 配置：upsert room_memberships + sync store
 * - 未配置：fallback mock + sync store
 * - 幂等：重复加入不报错
 */
export async function joinRoom(showId: string, userId?: string): Promise<RoomMembership> {
  if (!userId) throw new Error("Not logged in");
  requireCurrentUserId(userId);

  // 获取 roomId
  const room = await getRoomByShow(showId);
  if (!room) throw new Error("Room not found");

  // V1：加入房间只创建 RoomMembership，不做票务平台身份验证（PRD V1）

  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await roomMembershipsFrom()
        .upsert(
          { user_id: userId, room_id: room.id },
          { onConflict: "user_id,room_id" }
        )
        .select()
        .single();
      if (error || !data) {
        throw error ?? new Error("join room failed");
      }
      const membership = membershipRowToMembership(data);
      // sync store
      useUserStore.getState().joinRoom(room.id);
      // P10.5: 记录用户行为事件（fire-and-forget）
      void trackEvent(userId, EventType.ROOM_JOIN, TargetType.ROOM, room.id, { show_id: showId });
      return membership;
    } catch {
      // 记录已存在时 upsert 的 ON CONFLICT DO UPDATE 分支需要 UPDATE RLS
      // （当前 schema 仅有 INSERT 策略）。回查已有成员记录，按幂等成功处理。
      const { data: existingMembership } = await roomMembershipsFrom()
        .select("*")
        .eq("user_id", userId)
        .eq("room_id", room.id)
        .maybeSingle();
      if (existingMembership) {
        useUserStore.getState().joinRoom(room.id);
        return membershipRowToMembership(existingMembership);
      }
      warnSupabaseNotConfigured("room_memberships");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("room_memberships");
  }

  // fallback 路径
  const existing = mockMemberships.find(
    (m) => m.room_id === room.id && m.user_id === userId
  );
  if (existing) {
    useUserStore.getState().joinRoom(room.id);
    // P10.5: 记录用户行为事件（fire-and-forget）
    void trackEvent(userId, EventType.ROOM_JOIN, TargetType.ROOM, room.id, { show_id: showId });
    return delay(existing);
  }
  const membership: RoomMembership = {
    id: `rm-${Date.now()}`,
    user_id: userId,
    room_id: room.id,
    joined_at: new Date().toISOString(),
  };
  mockMemberships.push(membership);
  useUserStore.getState().joinRoom(room.id);
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(userId, EventType.ROOM_JOIN, TargetType.ROOM, room.id, { show_id: showId });
  return delay(membership);
}

/**
 * 退出房间
 * - Supabase 配置：delete room_memberships + sync store
 * - 未配置：fallback mock + sync store
 * - 幂等：重复退出不报错
 */
export async function leaveRoom(roomId: string, userId?: string): Promise<void> {
  if (!userId) throw new Error("Not logged in");
  requireCurrentUserId(userId);

  if (isBehaviorSupabaseEnabled()) {
    try {
      const { error } = await roomMembershipsFrom()
        .delete()
        .eq("user_id", userId)
        .eq("room_id", roomId);
      if (error) throw error;
      useUserStore.getState().leaveRoom(roomId);
      return;
    } catch {
      warnSupabaseNotConfigured("room_memberships");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("room_memberships");
  }

  // fallback 路径
  mockMemberships = mockMemberships.filter(
    (m) => !(m.room_id === roomId && m.user_id === userId)
  );
  useUserStore.getState().leaveRoom(roomId);
  return delay(undefined);
}

/**
 * 检查用户是否已加入某 show 的房间
 * - 保留 API 层：Supabase 配置时查询真实 DB（权限事实来源）
 * - 未配置：fallback mock
 * - userId 未提供返回 false
 */
export async function isRoomMember(showId: string, userId?: string): Promise<boolean> {
  if (!userId) return delay(false);

  if (isBehaviorSupabaseEnabled()) {
    try {
      const room = await getRoomByShow(showId);
      if (!room) return false;
      const { data, error } = await roomMembershipsFrom()
        .select("id")
        .eq("user_id", userId)
        .eq("room_id", room.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    } catch {
      warnSupabaseNotConfigured("room_memberships");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("room_memberships");
  }

  // fallback 路径
  const room = mockShowRooms.find((r) => r.show_id === showId);
  if (!room) return delay(false);
  return delay(mockMemberships.some((m) => m.room_id === room.id && m.user_id === userId));
}

/**
 * 从 Supabase 同步用户房间成员列表到 store（登录/session 恢复时调用）
 * - Supabase 配置：读取 room_memberships，覆盖 store.roomMemberships
 * - 未配置：no-op（store 已有 mockLogin/persist 数据）
 */
export async function syncRoomMemberships(userId: string): Promise<void> {
  if (!isBehaviorSupabaseEnabled()) {
    return;
  }

  try {
    const { data, error } = await roomMembershipsFrom()
      .select("id, user_id, room_id, joined_at")
      .eq("user_id", userId);
    if (error || !data) {
      throw error ?? new Error("sync memberships failed");
    }
    const memberships = data.map(membershipRowToMembership);
    useUserStore.getState().setRoomMemberships(memberships);
  } catch {
    warnSupabaseNotConfigured("room_memberships");
    // 同步失败不阻塞，保留 store 现有数据
  }
}

// ============
// P10.6.2 Room 生命周期
// ============

/**
 * 根据 Show 状态和时间推导 Room 生命周期状态
 *
 * 规则：
 * - show.status = CANCELLED / POSTPONED → ARCHIVED
 * - show.status = ENDED → ENDED
 * - show.status = UPCOMING + 演出当天 → ACTIVE
 * - show.status = UPCOMING + 演出前 → UPCOMING
 * - 演出已过且状态仍为 UPCOMING（过期未更新）→ ENDED
 */
export async function getRoomStatus(showId: string): Promise<RoomStatus> {
  try {
    const show = await getShowById(showId);
    if (!show) return RoomStatus.ARCHIVED;

    // 取消/延期的演出 → Room 归档
    if (show.status === ShowStatus.CANCELLED || show.status === ShowStatus.POSTPONED) {
      return RoomStatus.ARCHIVED;
    }

    // 已结束的演出 → Room 结束
    if (show.status === ShowStatus.ENDED) {
      return RoomStatus.ENDED;
    }

    // 使用 showLifecycle 判断当前时间状态
    const lifecycle = getShowLifecycle(show);
    if (lifecycle.hasEnded) {
      return RoomStatus.ENDED;
    }
    if (lifecycle.isToday) {
      return RoomStatus.ACTIVE;
    }
    return RoomStatus.UPCOMING;
  } catch {
    // 获取演出失败时默认 UPCOMING，不阻塞业务
    return RoomStatus.UPCOMING;
  }
}

/**
 * 判断 Room 是否允许发送消息
 *
 * 规则：
 * - UPCOMING: 允许（演出前交流）
 * - ACTIVE: 允许（现场互动）
 * - ENDED: 禁止（聊天关闭，历史归档）
 * - ARCHIVED: 禁止
 */
export async function canSendMessage(showId: string): Promise<boolean> {
  const status = await getRoomStatus(showId);
  return status === RoomStatus.UPCOMING || status === RoomStatus.ACTIVE;
}

/**
 * 判断 Room 是否允许发帖（找搭子/出收票/现场帖）
 *
 * 规则：
 * - UPCOMING: 允许（演出前找搭子、收票）
 * - ACTIVE: 允许（现场帖）
 * - ENDED: 禁止
 * - ARCHIVED: 禁止
 */
export async function canCreatePost(showId: string): Promise<boolean> {
  const status = await getRoomStatus(showId);
  return status === RoomStatus.UPCOMING || status === RoomStatus.ACTIVE;
}

/**
 * 判断 Room 是否已归档（只读模式）
 */
export async function isRoomArchived(showId: string): Promise<boolean> {
  const status = await getRoomStatus(showId);
  return status === RoomStatus.ENDED || status === RoomStatus.ARCHIVED;
}
