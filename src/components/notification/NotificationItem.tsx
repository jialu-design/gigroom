"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  HelpCircle,
  MessageSquare,
  Users,
  Heart,
  Send,
  Image as ImageIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { NotificationType } from "@/lib/types";
import type { Notification } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils/format";
import { cn } from "@/lib/utils";
import {
  markNotificationRead,
  answerAttendedCheckYes,
  answerAttendedCheckNo,
} from "@/lib/api/notifications";

interface NotificationItemProps {
  notification: Notification;
}

const TYPE_ICON = {
  [NotificationType.NEW_SHOW]: Calendar,
  [NotificationType.ATTENDED_CHECK]: HelpCircle,
  [NotificationType.DISCUSSION_REPLY]: MessageSquare,
  [NotificationType.BUDDY_REPLY]: Users,
  [NotificationType.BUDDY_INTERACTION]: Users,
  [NotificationType.TICKET_FAVORITE]: Heart,
  [NotificationType.TICKET_MESSAGE]: Send,
  [NotificationType.LIVE_INTERACTION]: ImageIcon,
} as const;

const TYPE_LABEL = {
  [NotificationType.NEW_SHOW]: "新演出",
  [NotificationType.ATTENDED_CHECK]: "现场确认",
  [NotificationType.DISCUSSION_REPLY]: "讨论回复",
  [NotificationType.BUDDY_REPLY]: "搭子回复",
  [NotificationType.BUDDY_INTERACTION]: "搭子互动",
  [NotificationType.TICKET_FAVORITE]: "出收票收藏",
  [NotificationType.TICKET_MESSAGE]: "交易消息",
  [NotificationType.LIVE_INTERACTION]: "现场互动",
} as const;

/**
 * 深链落点高亮：在 target_url 上附加 hl=<related_content_id>（P1-8）。
 * url 可能带 hash（…?tab=ticket#room），参数必须插在 # 之前。
 */
function withHighlightParam(url: string, contentId?: string): string {
  if (!contentId) return url;
  const [pathAndQuery, hash] = url.split("#");
  const sep = pathAndQuery.includes("?") ? "&" : "?";
  return `${pathAndQuery}${sep}hl=${encodeURIComponent(contentId)}${
    hash ? `#${hash}` : ""
  }`;
}

/**
 * NotificationItem
 *
 * 三类基础通知 + P3 互动通知（讨论回复/找搭子/出收票/现场）。
 * 未读：标题加粗 + 左侧暗红竖线；已读：正常展示。
 * 内容已删除：标题置灰 + "内容已失效"标签，点击不跳转。
 *
 * 交互：
 * - attended_check：专用按钮回答，不直接跳转
 * - 其他：点击 → 标记已读 → 跳转 target_url（优先）或 related_show_id；
 *   落点内容短暂高亮定位（hl 参数）
 */
export function NotificationItem({ notification: n }: NotificationItemProps) {
  const router = useRouter();
  const Icon = TYPE_ICON[n.type] ?? HelpCircle;
  const unread = !n.is_read;
  const deleted = !!n.is_content_deleted;

  const handleClick = React.useCallback(() => {
    // attended_check 不直接跳转（有专用按钮）
    if (n.type === NotificationType.ATTENDED_CHECK) return;
    // 已删除内容不跳转
    if (deleted) return;
    // 标记已读
    void markNotificationRead(n.id);
    // 深链 URL：优先 target_url，否则按类型回退；统一附加 hl 高亮参数
    let url: string | null = n.target_url ?? null;
    if (!url && n.related_show_id) {
      if (n.type === NotificationType.TICKET_FAVORITE || n.type === NotificationType.TICKET_MESSAGE) {
        url = `/show/${n.related_show_id}?tab=ticket#room`;
      } else if (n.type === NotificationType.DISCUSSION_REPLY) {
        url = `/show/${n.related_show_id}?tab=discussion#room`;
      } else if (n.type === NotificationType.BUDDY_REPLY || n.type === NotificationType.BUDDY_INTERACTION) {
        url = `/show/${n.related_show_id}?tab=buddy#room`;
      } else if (n.type === NotificationType.LIVE_INTERACTION) {
        url = `/show/${n.related_show_id}?tab=live#room`;
      } else {
        url = `/show/${n.related_show_id}`;
      }
    }
    if (url) {
      router.push(withHighlightParam(url, n.related_content_id));
    }
  }, [n, router, deleted]);

  const handleYes = React.useCallback(() => {
    answerAttendedCheckYes(n.id);
  }, [n.id]);

  const handleNo = React.useCallback(() => {
    answerAttendedCheckNo(n.id);
  }, [n.id]);

  // attended_check 已读后不再显示按钮（已回答过）
  const showAttendedButtons =
    n.type === NotificationType.ATTENDED_CHECK && !n.is_read;
  // attended_check 不响应整行点击；已删除内容也不响应
  const clickable = n.type !== NotificationType.ATTENDED_CHECK && !deleted;

  return (
    <div
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onClick={clickable ? handleClick : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
          : undefined
      }
      className={cn(
        "relative flex gap-3 px-4 py-3.5 border-b border-border transition-colors",
        clickable && "cursor-pointer hover:bg-bg-secondary",
        unread && "bg-bg-secondary/50",
        deleted && "opacity-50"
      )}
    >
      {/* 未读竖线 */}
      {unread && (
        <span
          className="absolute left-0 top-0 bottom-0 w-[3px] bg-accent-lime"
          aria-hidden
        />
      )}

      {/* 类型图标 */}
      <div className="shrink-0 mt-0.5">
        <Icon
          size={18}
          className={cn(
            "text-text-tertiary",
            unread && n.type === NotificationType.ATTENDED_CHECK && "text-accent-yellow"
          )}
          aria-hidden
        />
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            {/* 类型标签 */}
            <span className="text-[11px] text-text-tertiary uppercase tracking-wide">
              {TYPE_LABEL[n.type]}
            </span>
            {/* 标题 */}
            <p
              className={cn(
                "mt-0.5 text-sm text-text-primary line-clamp-2",
                unread && !deleted && "font-semibold",
                deleted && "text-text-tertiary line-through"
              )}
            >
              {n.title}
            </p>
            {/* 失效提示 */}
            {deleted && (
              <p className="mt-1 text-xs text-text-tertiary">内容已失效</p>
            )}
          </div>
          {/* 时间 */}
          <span className="shrink-0 text-[11px] text-text-tertiary whitespace-nowrap">
            {formatRelativeTime(n.created_at)}
          </span>
        </div>

        {/* attended_check 专属按钮 */}
        {showAttendedButtons && (
          <div className="mt-3 flex gap-2">
            <Button variant="primary" size="sm" onClick={handleYes}>
              是的，我去了
            </Button>
            <Button variant="secondary" size="sm" onClick={handleNo}>
              没去成
            </Button>
          </div>
        )}

        {/* attended_check 已回答提示 */}
        {n.type === NotificationType.ATTENDED_CHECK && n.is_read && (
          <p className="mt-1.5 text-xs text-text-tertiary">已回答</p>
        )}
      </div>
    </div>
  );
}
