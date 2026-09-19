"use client";

import * as React from "react";
import { X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ContentActions } from "@/components/shared/ContentActions";
import { VideoLinkCard } from "./VideoLinkCard";
import type { LivePost } from "@/lib/types";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface LivePostCardProps {
  post: LivePost;
  currentUserId?: string;
  onDelete?: (post: LivePost) => void;
  onReport?: (post: LivePost) => void;
}

export function LivePostCard({
  post,
  currentUserId,
  onDelete,
  onReport,
}: LivePostCardProps) {
  const isOwner = currentUserId === post.user_id;
  const userName = post.user?.display_name ?? "未知用户";
  // 当前放大查看的图片 URL；null 表示 lightbox 关闭
  const [lightboxUrl, setLightboxUrl] = React.useState<string | null>(null);

  // Esc 关闭 + 打开时锁定背景滚动（移动端友好）
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

          {post.content && (
            <p className="mt-2 text-sm text-text-secondary leading-relaxed break-words">
              {post.content}
            </p>
          )}

          {/* 图片网格 */}
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

          {/* 视频链接 */}
          {post.video_url && (
            <div className="mt-3">
              <VideoLinkCard url={post.video_url} />
            </div>
          )}
        </div>
      </div>

      {/* 全屏图片预览：点遮罩 / 右上角 X / Esc 关闭；大图 contain 不裁切 */}
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
