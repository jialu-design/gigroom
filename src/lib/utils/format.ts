/**
 * 演出/乐队相关的格式化与状态映射工具
 */
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { ShowStatus, ShowTicketStatus } from "@/lib/types";
import { SHOW_STATUS_LABEL, SHOW_TICKET_STATUS_LABEL } from "@/lib/constants";

/**
 * 演出海报 fallback：当 show.poster_url 为空时，按 show.id 哈希循环使用本地 mock 图
 * /public/images/shows/show-01.jpg ~ show-06.jpg
 */
export function getShowPosterFallback(showId: string): string {
  let n = 0;
  for (let i = 0; i < showId.length; i++) n = (n + showId.charCodeAt(i)) % 6;
  return `/images/shows/show-${String(n + 1).padStart(2, "0")}.jpg`;
}

/** Badge variant 字面量（与 Badge 组件的 variant 对齐） */
export type StatusBadgeVariant =
  | "default"
  | "red"
  | "green"
  | "blue"
  | "yellow"
  | "grey"
  | "lime";

/** 格式化演出日期："8月20日 周四" */
export function formatShowDate(dateTime: string): string {
  return format(new Date(dateTime), "M月d日 EEE", { locale: zhCN });
}

/** 格式化演出日期+时间："8月20日 周四 · 20:00" */
export function formatShowDateTime(dateTime: string): string {
  return format(new Date(dateTime), "M月d日 EEE · HH:mm", { locale: zhCN });
}

/** 月份分组 key："2026-08" */
export function getMonthKey(dateTime: string): string {
  return format(new Date(dateTime), "yyyy-MM");
}

/** 月份分组标签："2026年8月" */
export function getMonthLabel(dateTime: string): string {
  return format(new Date(dateTime), "yyyy年M月", { locale: zhCN });
}

/** 票务状态 → Badge variant */
export function getTicketStatusBadgeVariant(
  ticketStatus?: ShowTicketStatus
): StatusBadgeVariant {
  switch (ticketStatus) {
    case ShowTicketStatus.ON_SALE:
      // 在售统一使用 Electric Lime（#B7F34A），红色仅保留给 error/danger
      return "lime";
    case ShowTicketStatus.SOLD_OUT:
      return "grey";
    case ShowTicketStatus.COMING_SOON:
      return "yellow";
    default:
      return "default";
  }
}

/** 票务状态 → 中文标签 */
export function getTicketStatusLabel(
  ticketStatus?: ShowTicketStatus
): string {
  if (!ticketStatus) return "";
  return SHOW_TICKET_STATUS_LABEL[ticketStatus] ?? "";
}

/** 演出生命周期状态 → Badge variant */
export function getShowStatusBadgeVariant(
  status: ShowStatus
): StatusBadgeVariant {
  switch (status) {
    case ShowStatus.UPCOMING:
      return "default";
    case ShowStatus.ENDED:
      return "grey";
    case ShowStatus.CANCELLED:
      return "grey";
    case ShowStatus.POSTPONED:
      return "yellow";
    default:
      return "default";
  }
}

/** 演出生命周期状态 → 中文标签 */
export function getShowStatusLabel(status: ShowStatus): string {
  return SHOW_STATUS_LABEL[status] ?? "";
}

/** 演出是否已结束/取消（用于 UI 降权显示） */
export function isShowInactive(status: ShowStatus): boolean {
  return (
    status === ShowStatus.ENDED || status === ShowStatus.CANCELLED
  );
}

/**
 * 相对时间格式化（P9 通知用）
 * 刚刚 / N分钟前 / N小时前 / 昨天 / M月D日
 */
export function formatRelativeTime(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "刚刚";
  if (diffMin < 60) return `${diffMin}分钟前`;
  if (diffHour < 24) return `${diffHour}小时前`;
  if (diffDay === 1) return "昨天";
  // 超过2天，显示 M月D日
  return format(date, "M月d日", { locale: zhCN });
}
