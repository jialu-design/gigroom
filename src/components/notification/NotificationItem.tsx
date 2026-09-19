"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, Megaphone, HelpCircle } from "lucide-react";
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
  [NotificationType.ANNOUNCEMENT]: Megaphone,
  [NotificationType.ATTENDED_CHECK]: HelpCircle,
} as const;

const TYPE_LABEL = {
  [NotificationType.NEW_SHOW]: "新演出",
  [NotificationType.ANNOUNCEMENT]: "公告",
  [NotificationType.ATTENDED_CHECK]: "现场确认",
} as const;

/**
 * NotificationItem（P9）
 *
 * 三类通知视觉略有区别（图标不同），保持 GigRoom zine/editorial 暗色风格。
 * 未读：标题加粗 + 左侧暗红竖线
 * 已读：正常展示
 *
 * 交互：
 * - new_show / announcement：点击 → 标记已读 → 跳转演出详情
 * - attended_check：两个按钮 → 回答后标记已读 + 修改 UserShowStatus
 */
export function NotificationItem({ notification: n }: NotificationItemProps) {
  const router = useRouter();
  const Icon = TYPE_ICON[n.type] ?? HelpCircle;
  const unread = !n.is_read;

  const handleClick = React.useCallback(() => {
    // attended_check 不直接跳转（有专用按钮）
    if (n.type === NotificationType.ATTENDED_CHECK) return;
    // 标记已读
    void markNotificationRead(n.id);
    // 跳转
    if (n.related_show_id) {
      if (n.type === NotificationType.ANNOUNCEMENT) {
        router.push(`/show/${n.related_show_id}#announcements`);
      } else {
        router.push(`/show/${n.related_show_id}`);
      }
    }
  }, [n, router]);

  const handleYes = React.useCallback(() => {
    answerAttendedCheckYes(n.id);
  }, [n.id]);

  const handleNo = React.useCallback(() => {
    answerAttendedCheckNo(n.id);
  }, [n.id]);

  // attended_check 已读后不再显示按钮（已回答过）
  const showAttendedButtons =
    n.type === NotificationType.ATTENDED_CHECK && !n.is_read;

  return (
    <div
      role={n.type === NotificationType.ATTENDED_CHECK ? undefined : "button"}
      tabIndex={n.type === NotificationType.ATTENDED_CHECK ? undefined : 0}
      onClick={n.type === NotificationType.ATTENDED_CHECK ? undefined : handleClick}
      onKeyDown={
        n.type === NotificationType.ATTENDED_CHECK
          ? undefined
          : (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                handleClick();
              }
            }
      }
      className={cn(
        "relative flex gap-3 px-4 py-3.5 border-b border-border transition-colors",
        n.type !== NotificationType.ATTENDED_CHECK &&
          "cursor-pointer hover:bg-bg-secondary",
        unread && "bg-bg-secondary/50"
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
                unread && "font-semibold"
              )}
            >
              {n.title}
            </p>
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
