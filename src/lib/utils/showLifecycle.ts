/**
 * 演出生命周期工具
 * 统一判断演出各阶段，P5/P8/P9 复用
 * 业务时区：Asia/Shanghai
 */
import type { Show } from "@/lib/types";
import { ShowStatus } from "@/lib/types";

/** Asia/Shanghai 时区偏移量（分钟），UTC+8 */
const SHANGHAI_OFFSET_MIN = 8 * 60;

/** 讨论区宽限期：演出开始后 7 天内仍可发言/回复，之后转只读 */
const DISCUSSION_GRACE_MS = 7 * 24 * 60 * 60 * 1000;

/** 获取上海时区当前时间 */
function nowInShanghai(): Date {
  const now = new Date();
  // 转换为上海时间（通过调整 UTC 偏移）
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + SHANGHAI_OFFSET_MIN * 60 * 1000);
}

/** 将 ISO 字符串转换为上海时区 Date */
function toShanghaiDate(iso: string): Date {
  const d = new Date(iso);
  const utcMs = d.getTime() + d.getTimezoneOffset() * 60 * 1000;
  return new Date(utcMs + SHANGHAI_OFFSET_MIN * 60 * 1000);
}

/** 判断两个日期是否同一天（上海时区） */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export interface ShowLifecycle {
  /** 是否即将到来（未结束/未取消/未延期） */
  isUpcoming: boolean;
  /** 是否是演出当天 */
  isToday: boolean;
  /** 演出是否已经开始 */
  hasStarted: boolean;
  /** 演出是否已经结束 */
  hasEnded: boolean;
  /** 是否可以发布现场内容（演出当天 00:00 起） */
  canPostLive: boolean;
  /** 是否可以发讨论消息/回复（演出结束后保留 7 天宽限期） */
  canDiscuss: boolean;
  /** 是否可以发找搭子/出收票新帖（演出日期过后立即关闭） */
  canPostBuddyTicket: boolean;
  /** 是否应该询问到场（演出结束后一段时间） */
  shouldAskAttendance: boolean;
}

/**
 * 获取演出生命周期状态
 * 基于演出状态 + 日期判断，统一所有 Tab 使用
 */
export function getShowLifecycle(show: Show): ShowLifecycle {
  const now = nowInShanghai();
  const showDate = toShanghaiDate(show.date_time);

  const isCancelled = show.status === ShowStatus.CANCELLED;
  const isPostponed = show.status === ShowStatus.POSTPONED;
  const isEnded = show.status === ShowStatus.ENDED;
  const isUpcoming = show.status === ShowStatus.UPCOMING;

  const isToday = isSameDay(now, showDate);
  // 演出当天 00:00 起视为 hasStarted
  const hasStarted = isToday || now > showDate;
  // 日期已过（非当天且当前时间晚于演出时间）——状态字段滞后（仍为 UPCOMING）时也按已结束处理
  const datePassed = !isToday && now > showDate;
  // 已结束：状态 ENDED，或（非取消/延期且）演出日期已过
  const hasEnded = isEnded || (!isCancelled && !isPostponed && datePassed);

  // 取消/延期的演出关闭一切新增互动
  const interactive = !isCancelled && !isPostponed;

  // 演出当天 00:00 起允许发布现场内容
  // 当天 or 已过（但未取消/未延期）都可以发布
  const canPostLive = interactive && (isToday || now > showDate);

  // 找搭子/出收票：演出当天及之前可发，演出日期过后立即关闭
  const canPostBuddyTicket = interactive && (isToday || now <= showDate);

  // 讨论消息/回复：演出结束后保留 7 天宽限期，之后转只读（历史永久保留）
  const canDiscuss =
    interactive && now.getTime() <= showDate.getTime() + DISCUSSION_GRACE_MS;

  // 演出结束后询问到场（演出次日或状态为 ended）
  const shouldAskAttendance = hasEnded && !isCancelled && !isPostponed;

  return {
    // 仅 status=UPCOMING 且未结束（含当天）；延期/取消永远不是 upcoming
    isUpcoming: !hasEnded && isUpcoming,
    isToday,
    hasStarted,
    hasEnded,
    canPostLive,
    canDiscuss,
    canPostBuddyTicket,
    shouldAskAttendance,
  };
}

/**
 * 演出日期是否已过（上海时区，按自然日粒度：非当天且当前时间已晚于演出时间）。
 * 供查询层做"即将上演 / 历史演出"分组过滤，替代组件里散落的 new Date() 判断。
 * 状态字段滞后（status=UPCOMING 但日期已过）的演出同样视为已过。
 */
export function isShowDatePassed(show: Show): boolean {
  const now = nowInShanghai();
  const showDate = toShanghaiDate(show.date_time);
  return !isSameDay(now, showDate) && now > showDate;
}
