"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { ContentActions } from "@/components/shared/ContentActions";
import type { DiscussionMessage } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface MessageItemProps {
  message: DiscussionMessage;
  currentUserId?: string;
  onReply?: (message: DiscussionMessage) => void;
  onDelete?: (message: DiscussionMessage) => void;
  onReport?: (message: DiscussionMessage) => void;
}

export function MessageItem({
  message,
  currentUserId,
  onReply,
  onDelete,
  onReport,
}: MessageItemProps) {
  const isOwner = currentUserId === message.user_id;
  const userName = message.user?.display_name ?? "未知用户";

  return (
    <div className="flex gap-3 group">
      <Avatar
        src={message.user?.avatar_url}
        fallbackName={userName}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text-primary">
            {userName}
          </span>
          <span className="text-xs text-text-tertiary">
            {format(new Date(message.created_at), "MM-dd HH:mm", {
              locale: zhCN,
            })}
          </span>
          {/* 回复关系 */}
          {message.reply_to_user && (
            <span className="text-xs text-text-tertiary">
              回复 @{message.reply_to_user.display_name}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-text-secondary leading-relaxed break-words">
          {message.content}
        </p>
        {/* 操作行 */}
        <div className="mt-1 flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
          {onReply && (
            <button
              type="button"
              onClick={() => onReply(message)}
              className="text-xs text-text-tertiary hover:text-text-primary"
            >
              回复
            </button>
          )}
          <ContentActions
            isOwner={isOwner}
            onDelete={onDelete ? () => onDelete(message) : undefined}
            onReport={onReport ? () => onReport(message) : undefined}
          />
        </div>
      </div>
    </div>
  );
}
