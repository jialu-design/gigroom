"use client";

import * as React from "react";
import { Check, Undo2, MessageSquare, Heart, Send } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ContentActions } from "@/components/shared/ContentActions";
import { useToast } from "@/components/ui/Toast";
import type { TicketPost, TicketConversation } from "@/lib/types";
import { TicketPostStatus, TicketPostType } from "@/lib/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toggleFavorite, isFavorited } from "@/lib/api/ticketFavorites";
import { getOrCreateConversation } from "@/lib/api/ticketMessages";

interface TicketPostCardProps {
  post: TicketPost;
  currentUserId?: string;
  /** 演出已结束：禁止新增互动（收藏/私聊），历史内容保留 */
  interactionLocked?: boolean;
  onMarkComplete?: (post: TicketPost) => void;
  /** 撤销"已出/已收到"标记（P1-9：支持误标撤销） */
  onReopen?: (post: TicketPost) => void;
  onDelete?: (post: TicketPost) => void;
  onReport?: (post: TicketPost) => void;
  onReplyToggle?: (post: TicketPost) => void;
  /** 点击私聊后（会话已建立/复用）打开聊天 */
  onChatStarted?: (conversation: TicketConversation) => void;
  children?: React.ReactNode;
}

export function TicketPostCard({
  post,
  currentUserId,
  interactionLocked = false,
  onMarkComplete,
  onReopen,
  onDelete,
  onReport,
  onReplyToggle,
  onChatStarted,
  children,
}: TicketPostCardProps) {
  const { showToast } = useToast();
  const isOwner = currentUserId === post.user_id;
  const isCompleted = post.status === TicketPostStatus.COMPLETED;
  const isSelling = post.type === TicketPostType.SELLING;
  const userName = post.user?.display_name ?? "未知用户";

  const [favorited, setFavorited] = React.useState(false);
  const [favoriteLoading, setFavoriteLoading] = React.useState(false);
  const [chatLoading, setChatLoading] = React.useState(false);

  // 收藏状态：本地查询（mock）
  React.useEffect(() => {
    if (!currentUserId || isOwner) return;
    isFavorited(currentUserId, post.id).then(setFavorited).catch(() => {});
  }, [currentUserId, post.id, isOwner]);

  const handleFavorite = async () => {
    if (!currentUserId || favoriteLoading) return;
    setFavoriteLoading(true);
    try {
      const { favorited: next } = await toggleFavorite(currentUserId, post.id);
      setFavorited(next);
      showToast(next ? "已收藏" : "已取消收藏", "success");
    } catch {
      showToast("操作失败", "error");
    } finally {
      setFavoriteLoading(false);
    }
  };

  const handleChat = async () => {
    if (!currentUserId || chatLoading) return;
    // 防自发：UI 层已隐藏，这里是保险
    if (isOwner) {
      showToast("不能和自己发布的帖子聊天", "warning");
      return;
    }
    setChatLoading(true);
    try {
      const { conversation } = await getOrCreateConversation(
        post.id,
        post.show_id,
        currentUserId,
        post.user_id
      );
      onChatStarted?.(conversation);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "发起聊天失败",
        "error"
      );
    } finally {
      setChatLoading(false);
    }
  };

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

            {/* 非作者：收藏 + 私聊 */}
            {!isOwner && currentUserId && !interactionLocked && (
              <>
                <button
                  type="button"
                  onClick={handleFavorite}
                  disabled={favoriteLoading}
                  className={cn(
                    "inline-flex items-center gap-1 text-xs transition-colors",
                    favorited
                      ? "text-accent-lime hover:text-accent-lime-hover"
                      : "text-text-tertiary hover:text-text-primary"
                  )}
                >
                  <Heart
                    size={12}
                    fill={favorited ? "currentColor" : "none"}
                  />
                  {favorited ? "已收藏" : "收藏"}
                </button>
                <button
                  type="button"
                  onClick={handleChat}
                  disabled={chatLoading}
                  className="inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-accent-lime transition-colors"
                >
                  <Send size={12} />
                  {chatLoading ? "…" : "私聊"}
                </button>
              </>
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

            {/* P1-9：误标撤销——已完成状态可回到进行中 */}
            {isOwner && isCompleted && onReopen && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onReopen(post)}
                className="h-7 px-2 text-xs"
              >
                <Undo2 size={12} />
                撤销{isSelling ? "已出" : "已收到"}标记
              </Button>
            )}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
