/**
 * 演出核心状态统一真相层（全站唯一）
 *
 * 三个独立维度，禁止在页面/组件里自行 new Date() 或重解释 status：
 * 1. 演出生命周期：UPCOMING / ENDED / CANCELLED / POSTPONED（四态严格互斥）
 *    - status 字段滞后（UPCOMING 但日期已过）时，展示口径统一归入 ENDED
 *    - CANCELLED / POSTPONED 不看日期，永远独立成组（不混入即将上演/已结束）
 * 2. 用户-演出关系：interested / going / attended（事实来源 useUserStore.showStatuses）
 * 3. Room 成员关系：仅以 roomMemberships 为准；未加入的演出不出现在"我的小屋"
 *
 * 时间判断引擎复用 showLifecycle.ts（Asia/Shanghai），本文件只做状态归一与派生。
 */
import type {
  Show,
  ShowRoom,
  RoomMembership,
  UserShowStatus,
} from "@/lib/types";
import {
  ShowStatus,
  UserShowStatus as UserShowStatusEnum,
  ArtistRole,
  RoomStatus,
} from "@/lib/types";
import { SHOW_STATUS_LABEL } from "@/lib/constants";
import {
  getShowStatusBadgeVariant,
  type StatusBadgeVariant,
} from "@/lib/utils/format";
import { getShowLifecycle, isShowDatePassed } from "@/lib/utils/showLifecycle";

// 重新导出时间门禁，页面只从本模块取状态即可
export { getShowLifecycle, isShowDatePassed };

/** 演出严格互斥展示分组 */
export type ShowBucket = "upcoming" | "ended" | "postponed" | "cancelled";

/** 归一后的演出状态（含标签/视觉降权/Room 状态/互动门禁） */
export interface EffectiveShowState {
  /** 原始 status 字段 */
  rawStatus: ShowStatus;
  /** 严格互斥分组 */
  bucket: ShowBucket;
  /** 有效状态：status 滞后时归一为 ENDED */
  effectiveStatus: ShowStatus;
  /** 统一中文标签 */
  label: string;
  /** 统一 Badge 配色 */
  badgeVariant: StatusBadgeVariant;
  /** 视觉降权（灰度海报）：已结束 / 已取消 */
  isInactive: boolean;
  /** 是否展示票务状态 badge（仅未过期的 UPCOMING 展示） */
  showTicketBadge: boolean;
  /** Room 生命周期（同步推导，规则与 api/rooms.getRoomStatus 完全一致） */
  roomStatus: RoomStatus;
  /** 是否允许新成员加入（仅未过期 UPCOMING 可加入） */
  canJoinRoom: boolean;
  /** 互动门禁（引擎来自 showLifecycle） */
  canPostLive: boolean;
  canPostBuddyTicket: boolean;
  canDiscuss: boolean;
}

/**
 * 演出四态分组（唯一口径）
 * - cancelled/postponed：不看日期，独立成组
 * - ended：status=ENDED，或 status=UPCOMING 但日期已过（状态滞后）
 * - upcoming：status=UPCOMING 且演出当天或未来
 */
export function getShowBucket(show: Show): ShowBucket {
  if (show.status === ShowStatus.CANCELLED) return "cancelled";
  if (show.status === ShowStatus.POSTPONED) return "postponed";
  if (show.status === ShowStatus.ENDED) return "ended";
  return isShowDatePassed(show) ? "ended" : "upcoming";
}

/** 归一后的有效状态（日期与 status 冲突时，按已结束处理） */
export function getEffectiveShowStatus(show: Show): ShowStatus {
  switch (getShowBucket(show)) {
    case "upcoming":
      return ShowStatus.UPCOMING;
    case "ended":
      return ShowStatus.ENDED;
    case "postponed":
      return ShowStatus.POSTPONED;
    case "cancelled":
      return ShowStatus.CANCELLED;
  }
}

/** Room 状态同步推导（与 api/rooms.ts 的异步 getRoomStatus 同规则，禁止两处漂移） */
export function deriveRoomStatus(show: Show): RoomStatus {
  const bucket = getShowBucket(show);
  if (bucket === "cancelled" || bucket === "postponed") {
    return RoomStatus.ARCHIVED;
  }
  if (bucket === "ended") return RoomStatus.ENDED;
  return getShowLifecycle(show).isToday
    ? RoomStatus.ACTIVE
    : RoomStatus.UPCOMING;
}

/** 获取演出归一状态（全站所有页面/卡片的唯一消费入口） */
export function getEffectiveShowState(show: Show): EffectiveShowState {
  const bucket = getShowBucket(show);
  const effectiveStatus = getEffectiveShowStatus(show);
  const lifecycle = getShowLifecycle(show);
  const roomStatus = deriveRoomStatus(show);

  return {
    rawStatus: show.status,
    bucket,
    effectiveStatus,
    label: SHOW_STATUS_LABEL[effectiveStatus] ?? "",
    badgeVariant: getShowStatusBadgeVariant(effectiveStatus),
    // 延期保留色彩信息（黄色提示），不做灰度；结束/取消灰度降权
    isInactive: bucket === "ended" || bucket === "cancelled",
    showTicketBadge: bucket === "upcoming",
    roomStatus,
    canJoinRoom: bucket === "upcoming",
    // lifecycle 引擎内部已排除 cancelled/postponed
    canPostLive: lifecycle.canPostLive,
    canPostBuddyTicket: lifecycle.canPostBuddyTicket,
    canDiscuss: lifecycle.canDiscuss,
  };
}

export interface ClassifiedShows {
  /** 即将上演（日期升序） */
  upcoming: Show[];
  /** 已结束（日期倒序，含状态滞后） */
  ended: Show[];
  /** 已延期（日期倒序） */
  postponed: Show[];
  /** 已取消（日期倒序） */
  cancelled: Show[];
}

/** 列表分组：四态严格互斥 + 统一排序 */
export function classifyShows(shows: Show[]): ClassifiedShows {
  const result: ClassifiedShows = {
    upcoming: [],
    ended: [],
    postponed: [],
    cancelled: [],
  };
  for (const show of shows) {
    result[getShowBucket(show)].push(show);
  }
  result.upcoming.sort((a, b) => a.date_time.localeCompare(b.date_time));
  result.ended.sort((a, b) => b.date_time.localeCompare(a.date_time));
  result.postponed.sort((a, b) => b.date_time.localeCompare(a.date_time));
  result.cancelled.sort((a, b) => b.date_time.localeCompare(a.date_time));
  return result;
}

// ============================================================
// 用户-演出关系派生（事实来源：useUserStore.showStatuses）
// ============================================================

export interface MyShowLists {
  /** 我要去：仅未结束演出（日期升序） */
  going: Show[];
  /** 感兴趣：仅未结束演出（日期升序） */
  interested: Show[];
  /** 去过：记录级事实，不随演出状态变化被移除（日期倒序） */
  attended: Show[];
}

/**
 * 从 showStatuses 记录派生"我的演出"三个列表。
 * interested/going 是互斥单值；attended 是记录级状态（终态事实，永久保留）。
 * 不存在的 showId 自动过滤。
 */
export function deriveMyShows(
  showStatuses: Record<string, UserShowStatus>,
  showMap: Map<string, Show>
): MyShowLists {
  const going: Show[] = [];
  const interested: Show[] = [];
  const attended: Show[] = [];

  for (const [showId, status] of Object.entries(showStatuses)) {
    const show = showMap.get(showId);
    if (!show) continue;

    if (status === UserShowStatusEnum.GOING) {
      if (getShowBucket(show) === "upcoming") going.push(show);
    } else if (status === UserShowStatusEnum.INTERESTED) {
      if (getShowBucket(show) === "upcoming") interested.push(show);
    } else if (status === UserShowStatusEnum.ATTENDED) {
      attended.push(show);
    }
  }

  going.sort((a, b) => a.date_time.localeCompare(b.date_time));
  interested.sort((a, b) => a.date_time.localeCompare(b.date_time));
  attended.sort((a, b) => b.date_time.localeCompare(a.date_time));

  return { going, interested, attended };
}

// ============================================================
// Room 成员关系派生（事实来源：useUserStore.roomMemberships）
// ============================================================

export interface MemberRoomItem {
  room: ShowRoom;
  roomId: string;
  show: Show;
  joinedAt: string;
  artistName: string;
  activityCount: number;
}

export interface MemberRooms {
  /** 当前小屋：演出未结束（upcoming/active），日期升序 */
  current: MemberRoomItem[];
  /** 过往小屋：用户曾加入 且 演出已结束/取消/延期，日期倒序 */
  past: MemberRoomItem[];
}

function getHeadlinerName(show: Show): string {
  const headliner = show.artists?.find((a) => a.role === ArtistRole.HEADLINER);
  return headliner?.artist?.name ?? show.title ?? "未命名演出";
}

/**
 * 从 memberships 派生用户的小屋列表。
 * 严格依赖成员关系：Going/Interested 但未加入的演出绝不出现；
 * 非加入的演出不会出现在"过往小屋"。
 */
export function deriveMemberRooms(
  memberships: Pick<RoomMembership, "room_id" | "joined_at">[],
  userRooms: ShowRoom[],
  showMap: Map<string, Show>
): MemberRooms {
  const roomMap = new Map(userRooms.map((r) => [r.id, r]));
  const current: MemberRoomItem[] = [];
  const past: MemberRoomItem[] = [];

  for (const membership of memberships) {
    const room = roomMap.get(membership.room_id);
    if (!room) continue;
    const show = showMap.get(room.show_id);
    if (!show) continue;

    const activityCount =
      (room.message_count ?? 0) +
      (room.buddy_post_count ?? 0) +
      (room.ticket_post_count ?? 0) +
      (room.live_post_count ?? 0);

    const item: MemberRoomItem = {
      room,
      roomId: room.id,
      show,
      joinedAt: membership.joined_at,
      artistName: getHeadlinerName(show),
      activityCount,
    };

    // 仅 upcoming 分组算"当前"；ended/cancelled/postponed（含归档）一律"过往"
    if (getShowBucket(show) === "upcoming") {
      current.push(item);
    } else {
      past.push(item);
    }
  }

  current.sort((a, b) => a.show.date_time.localeCompare(b.show.date_time));
  past.sort((a, b) => b.show.date_time.localeCompare(a.show.date_time));

  return { current, past };
}
