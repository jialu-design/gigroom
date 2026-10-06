"use client";

import * as React from "react";
import { Plus, Lock } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReportModal } from "@/components/shared/ReportModal";
import { useToast } from "@/components/ui/Toast";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useRequireRoomMembership } from "@/hooks/useRequireRoomMembership";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getLivePosts, createLivePost, deleteLivePost } from "@/lib/api/posts/livePosts";
import { getLiveInteractionSummaries } from "@/lib/api/liveInteractions";
import { getEffectiveShowState } from "@/lib/utils/showState";
import type { Show, LivePost } from "@/lib/types";
import { LivePostCard } from "./LivePostCard";
import { LivePostModal } from "./LivePostModal";

interface LiveTabProps {
  show: Show;
  roomId?: string;
  isMember: boolean;
}

export function LiveTab({ show, roomId, isMember }: LiveTabProps) {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const user = useUserStore((s) => s.user);
  const requireRoomMembership = useRequireRoomMembership();
  const requireAuth = useRequireAuth();
  const { showToast } = useToast();

  const [posts, setPosts] = React.useState<LivePost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<LivePost | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);

  // 统一状态口径：现场仅演出当天可发布；结束后只读保留现场记录
  const state = React.useMemo(() => getEffectiveShowState(show), [show]);
  const canPostLive = state.canPostLive;

  const load = React.useCallback(async () => {
    setLoading(true);
    const data = await getLivePosts(show.id);
    // P5: 合并互动汇总（点赞数/评论数/我是否已赞）
    const summaries = await getLiveInteractionSummaries(
      data.map((p) => p.id),
      user?.id
    );
    setPosts(
      data.map((p) => ({
        ...p,
        like_count: summaries[p.id]?.likeCount ?? 0,
        comment_count: summaries[p.id]?.commentCount ?? 0,
        liked_by_me: summaries[p.id]?.likedByMe ?? false,
      }))
    );
    setLoading(false);
  }, [show.id, user?.id]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async (input: {
    content?: string;
    imageUrls: string[];
    videoUrl?: string;
  }) => {
    // 时间锁优先（安全检查，UI 已通过 canPostLive 控制按钮显示）
    if (!canPostLive) {
      showToast("演出当天才能发布现场内容", "warning");
      return;
    }
    // 登录 + membership 已在点击发布按钮时通过 useRequireRoomMembership 检查
    if (!user) return;
    try {
      // 识别视频平台
      let videoPlatform;
      if (input.videoUrl) {
        const { detectVideoPlatform } = await import("@/lib/api/posts/livePosts");
        videoPlatform = detectVideoPlatform(input.videoUrl);
      }
      const post = await createLivePost(show.id, user.id, {
        content: input.content,
        imageUrls: input.imageUrls,
        videoUrl: input.videoUrl,
        videoPlatform,
      });
      setPosts((prev) => [post, ...prev]);
      showToast("发布成功", "success");
    } catch {
      showToast("发布失败", "error");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    // 删除：登录 + 作者本人（ContentActions 已通过 isOwner 控制显示）
    try {
      await deleteLivePost(deleteTarget.id, user.id);
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      showToast("已删除", "success");
    } catch {
      showToast("删除失败", "error");
    }
    setDeleteTarget(null);
  };

  return (
    <div>
      {/* 锁定/预告提示：
          - 取消/延期：关闭现场分享（canPostLive=false）
          - 未到演出当天：预告（演出当天起可发，结束后仍可补发，历史永久保留）
          - 当天/已结束：不显示提示，直接给发布入口 */}
      {!canPostLive && (
        <div className="mb-4 rounded-sm border border-border bg-bg-secondary p-4 text-center">
          <Lock size={24} className="mx-auto text-text-tertiary mb-2" />
          {state.bucket === "cancelled" ? (
            <p className="text-sm text-text-secondary">演出已取消，无现场记录</p>
          ) : state.bucket === "postponed" ? (
            <p className="text-sm text-text-secondary">演出已延期，现场分享暂未开放</p>
          ) : (
            <>
              <p className="text-sm text-text-secondary">
                演出当天可以在这里分享现场
              </p>
              <p className="text-xs text-text-tertiary mt-1">
                演出结束后，这里会留下属于这一晚的现场记录
              </p>
            </>
          )}
        </div>
      )}

      {/* 发布按钮 */}
      {canPostLive && (
        <div className="mb-4">
          <Button
            variant="primary"
            size="sm"
            onClick={() => requireRoomMembership(roomId ?? "", () => setModalOpen(true))}
          >
            <Plus size={14} />
            分享现场
          </Button>
        </div>
      )}

      {/* 帖子列表 */}
      {loading ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-sm bg-bg-tertiary" />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-6 text-text-tertiary text-sm">
          {canPostLive
            ? "还没有现场记录，来第一个分享的人吧"
            : "暂无现场记录"}
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} data-content-id={post.id}>
              <LivePostCard
                post={post}
                showId={show.id}
                roomId={roomId}
                currentUserId={user?.id}
                isMember={isMember}
                isLoggedIn={isLoggedIn}
                onDelete={setDeleteTarget}
                onReport={() => requireAuth(() => setReportOpen(true))}
              />
            </div>
          ))}
        </div>
      )}

      <LivePostModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除现场帖"
        description="确定删除这条现场记录吗？删除后无法恢复。"
        confirmText="删除"
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={() => showToast("已收到举报，感谢反馈", "success")}
      />
    </div>
  );
}
