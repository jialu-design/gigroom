"use client";

import * as React from "react";
import { Check, MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ContentActions } from "@/components/shared/ContentActions";
import type { TicketPost } from "@/lib/types";
import { TicketPostStatus, TicketPostType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface TicketPostCardProps {
  post: TicketPost;
  currentUserId?: string;
  onMarkComplete?: (post: TicketPost) => void;
  onDelete?: (post: TicketPost) => void;
  onReport?: (post: TicketPost) => void;
  onReplyToggle?: (post: TicketPost) => void;
  children?: React.ReactNode;
}

export function TicketPostCard({
  post,
  currentUserId,
  onMarkComplete,
  onDelete,
  onReport,
  onReplyToggle,
  children,
}: TicketPostCardProps) {
  const isOwner = currentUserId === post.user_id;
  const isCompleted = post.status === TicketPostStatus.COMPLETED;
  const isSelling = post.type === TicketPostType.SELLING;
  const userName = post.user?.display_name ?? "未知用户";

  return (
    <div
      className={cn(
        "rounded-sm border border-border bg-bg-secondary/50 p-4",
        isCompleted && "opacity-50"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar
          src={post.user?.avatar_url}
          fallbackName={userName}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-primary">
                {userName}
              </span>
              <Badge variant={isSelling ? "lime" : "green"} size="sm">
                {isSelling ? "出票" : "收票"}
              </Badge>
              <Badge variant={isCompleted ? "grey" : "default"} size="sm">
                {isCompleted
                  ? isSelling
                    ? "已出"
                    : "已收到"
                  : "进行中"}
              </Badge>
            </div>
            <ContentActions
              isOwner={isOwner}
              onDelete={onDelete ? () => onDelete(post) : undefined}
              onReport={onReport ? () => onReport(post) : undefined}
            />
          </div>

          {/* 票务信息 */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="text-text-secondary">
              数量：<span className="text-text-primary font-medium">{post.quantity}</span>
            </span>
            {isSelling && post.face_value !== undefined && (
              <span className="text-text-secondary">
                票面价：<span className="text-text-primary font-medium">¥{post.face_value}</span>
              </span>
            )}
            {isSelling && post.price !== undefined && (
              <span className="text-text-secondary">
                转让价：<span className="text-text-primary font-medium">¥{post.price}</span>
              </span>
            )}
            {!isSelling && post.price !== undefined && (
              <span className="text-text-secondary">
                预算：<span className="text-text-primary font-medium">¥{post.price}</span>
              </span>
            )}
          </div>

          {post.note && (
            <p className="mt-2 text-sm text-text-secondary leading-relaxed break-words">
              {post.note}
            </p>
          )}

          <p className="mt-1 text-xs text-text-tertiary">
            {format(new Date(post.created_at), "MM-dd HH:mm", { locale: zhCN })}
          </p>

          {/* 操作行 */}
          <div className="mt-2 flex items-center gap-3">
            {onReplyToggle && (
              <button
                type="button"
                onClick={() => onReplyToggle(post)}
                className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary"
              >
                <MessageSquare size={12} />
                {post.comment_count ?? 0} 回复
              </button>
            )}
            {isOwner && !isCompleted && onMarkComplete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkComplete(post)}
                className="h-7 px-2 text-xs"
              >
                <Check size={12} />
                标记{isSelling ? "已出" : "已收到"}
              </Button>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
