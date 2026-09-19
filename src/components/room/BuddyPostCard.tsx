"use client";

import * as React from "react";
import { MessageSquare } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { ContentActions } from "@/components/shared/ContentActions";
import type { BuddyPost } from "@/lib/types";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface BuddyPostCardProps {
  post: BuddyPost;
  currentUserId?: string;
  onReplyToggle?: (post: BuddyPost) => void;
  onDelete?: (post: BuddyPost) => void;
  onReport?: (post: BuddyPost) => void;
  children?: React.ReactNode;
}

export function BuddyPostCard({
  post,
  currentUserId,
  onReplyToggle,
  onDelete,
  onReport,
  children,
}: BuddyPostCardProps) {
  const isOwner = currentUserId === post.user_id;
  const userName = post.user?.display_name ?? "未知用户";

  return (
    <div className="rounded-sm border border-border bg-bg-secondary/50 p-4">
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
              <span className="text-xs text-text-tertiary">
                {format(new Date(post.created_at), "MM-dd HH:mm", {
                  locale: zhCN,
                })}
              </span>
            </div>
            <ContentActions
              isOwner={isOwner}
              onDelete={onDelete ? () => onDelete(post) : undefined}
              onReport={onReport ? () => onReport(post) : undefined}
            />
          </div>
          <p className="mt-2 text-sm text-text-secondary leading-relaxed break-words">
            {post.content}
          </p>
          {post.tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Badge key={tag} variant="default" size="sm">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
          {/* 回复入口 */}
          {onReplyToggle && (
            <button
              type="button"
              onClick={() => onReplyToggle(post)}
              className="mt-2 inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary"
            >
              <MessageSquare size={12} />
              {post.comment_count ?? 0} 回复
            </button>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
