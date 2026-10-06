"use client";

import * as React from "react";
import { X, Heart, MessageCircle } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ContentActions } from "@/components/shared/ContentActions";
import { PostReplies } from "./PostReplies";
import { LiveShareMenu } from "./LiveShareMenu";
import { VideoLinkCard } from "./VideoLinkCard";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useRequireRoomMembership } from "@/hooks/useRequireRoomMembership";
import { useUserStore } from "@/lib/stores/useUserStore";
import { toggleLivePostLike, getLivePostComments, createLivePostComment } from "@/lib/api/liveInteractions";
import type { LivePost, LivePostComment } from "@/lib/types";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface LivePostCardProps {
  post: LivePost;
  showId: string;
  roomId?: string;
  currentUserId?: string;
  isMember: boolean;
  isLoggedIn: boolean;
  onDelete?: (post: LivePost) => void;
  onReport?: (post: LivePost) => void;
}

export function LivePostCard({
  post,
  showId,
  roomId,
  currentUserId,
  isMember,
  isLoggedIn,
  onDelete,
  onReport,
}: LivePostCardProps) {
  const isOwner = currentUserId === post.user_id;
  const userName = post.user?.display_name ?? "未知用户";

  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);
  const [commentsExpanded, setCommentsExpanded] = React.useState(false);
  const [comments, setComments] = React.useState<LivePostComment[]>([]);
  const [likeCount, setLikeCount] = React.useState(post.like_count ?? 0);
  const [liked, setLiked] = React.useState(post.liked_by_me ?? false);
  const [commentCount, setCommentCount] = React.useState(post.comment_count ?? 0);

  const { showToast } = useToast();
  const requireAuth = useRequireAuth();
  const requireRoomMembership = useRequireRoomMembership();

  // Esc 关闭 lightbox + 锁定滚动
  React.useEffect(() => {
    if (!lightboxUrl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxUrl(null);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [lightboxUrl]);

  // 展开评论时加载
  React.useEffect(() => {
    if (!commentsExpanded) return;
    void (async () => {
      const data = await getLivePostComments(post.id);
      setComments(data);
    })();
  }, [commentsExpanded, post.id]);

  // 点赞（未登录 → 登录拦截；登录后自动执行 pending action）
  const doLike = React.useCallback(async (uid: string) => {
    try {
      const result = await toggleLivePostLike(post.id, uid);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch {
      showToast("操作失败", "error");
    }
  }, [post.id, showToast]);

  const handleLike = () => {
    const uid = useUserStore.getState().user?.id;
    if (!uid) {
      requireAuth(() => {
        const uid2 = useUserStore.getState().user?.id;
        if (uid2) void doLike(uid2);
      });
      return;
    }
    void doLike(uid);
  };

  // 评论（需登录 + Room 成员，与找搭子回复同一口径）
  const handleComment = (content: string) => {
    requireRoomMembership(roomId ?? "", () => {
      const uid = useUserStore.getState().user?.id;
      if (!uid) return;
      void (async () => {
        try {
          const comment = await createLivePostComment(post.id, uid, content);
          setComments((prev) => [...prev, comment]);
          setCommentCount((c) => c + 1);
        } catch {
          showToast("评论失败", "error");
        }
      })();
    });
  };

  return (
    <div className="rounded-sm border border-border bg-bg-secondary/50 p-4">
      <div className="flex items-start gap-3">
        <Avatar
          src={post.user?.avatar_url}
          fallbackName={userName}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          {/* 头部 */}
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

          {/* 内容 */}
          {post.content && (
            <p className="mt-2 text-sm text-text-secondary leading-relaxed break-words">
              {post.content}
            </p>
          )}

          {/* 图片 */}
          {post.image_urls.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {post.image_urls.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label="放大查看图片"
                  onClick={() => setLightboxUrl(url)}
                  className="block aspect-square w-full cursor-zoom-in"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt={`现场照片 ${i + 1}`}
                    className="h-full w-full object-cover rounded-sm border border-border"
                  />
                </button>
              ))}
            </div>
          )}

          {/* 视频 */}
          {post.video_url && (
            <div className="mt-3">
              <VideoLinkCard url={post.video_url} />
            </div>
          )}

          {/* 互动栏（P5） */}
          <div className="mt-3 flex items-center gap-4 pt-3 border-t border-border/50">
            <button
              type="button"
              onClick={handleLike}
              aria-label={liked ? "取消点赞" : "点赞"}
              className={`flex items-center gap-1 text-xs transition-colors ${
                liked
                  ? "text-accent-lime"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              <Heart size={14} fill={liked ? "currentColor" : "none"} />
              {likeCount > 0 ? likeCount : "赞"}
            </button>

            <button
              type="button"
              onClick={() => setCommentsExpanded((v) => !v)}
              aria-label="评论"
              className={`flex items-center gap-1 text-xs transition-colors ${
                commentsExpanded
                  ? "text-accent-lime"
                  : "text-text-tertiary hover:text-text-primary"
              }`}
            >
              <MessageCircle size={14} />
              {commentCount > 0 ? commentCount : "评论"}
            </button>

            <LiveShareMenu url={`/show/${showId}?tab=live#room`} />
          </div>

          {/* 评论展开区 */}
          {commentsExpanded && (
            <PostReplies
              comments={comments}
              isLoggedIn={isLoggedIn}
              isMember={isMember}
              onReply={handleComment}
            />
          )}
        </div>
      </div>

      {/* 全屏图片预览 */}
      {lightboxUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="图片预览"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            type="button"
            aria-label="关闭预览"
            onClick={() => setLightboxUrl(null)}
            className="absolute right-2 top-2 flex h-10 w-10 items-center justify-center rounded-sm text-white/80 hover:bg-white/10 hover:text-white"
          >
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="现场照片大图"
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] max-w-[92vw] object-contain"
          />
        </div>
      )}
    </div>
  );
}
