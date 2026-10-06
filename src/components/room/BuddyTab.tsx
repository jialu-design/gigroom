"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReportModal } from "@/components/shared/ReportModal";
import { useToast } from "@/components/ui/Toast";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useRequireRoomMembership } from "@/hooks/useRequireRoomMembership";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  getBuddyPosts,
  createBuddyPost,
  deleteBuddyPost,
  getBuddyPostComments,
  replyBuddyPost,
} from "@/lib/api/posts/buddyPosts";
import type { BuddyPost, BuddyPostComment } from "@/lib/types";
import { BuddyPostCard } from "./BuddyPostCard";
import { BuddyPostModal } from "./BuddyPostModal";
import { PostReplies } from "./PostReplies";

interface BuddyTabProps {
  showId: string;
  roomId?: string;
  isMember: boolean;
  /** 演出已结束：禁止新帖 */
  createLocked?: boolean;
  /** 讨论宽限期结束：禁止回复 */
  replyLocked?: boolean;
}

export function BuddyTab({ showId, roomId, isMember, createLocked = false, replyLocked = false }: BuddyTabProps) {
  const router = useRouter();
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const user = useUserStore((s) => s.user);
  const requireRoomMembership = useRequireRoomMembership();
  const requireAuth = useRequireAuth();
  const { showToast } = useToast();

  const [posts, setPosts] = React.useState<BuddyPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<BuddyPost | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [expandedPost, setExpandedPost] = React.useState<string | null>(null);
  const [commentsMap, setCommentsMap] = React.useState<Record<string, BuddyPostComment[]>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    const data = await getBuddyPosts(showId);
    setPosts(data);
    setLoading(false);
  }, [showId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleCreate = (content: string, tags: string[]) => {
    if (createLocked) return;
    // P7.3：发布找搭子统一走 useRequireRoomMembership
    requireRoomMembership(roomId ?? "", () => {
      if (!user) return;
      void (async () => {
        try {
          const post = await createBuddyPost(showId, user.id, { content, tags });
          setPosts((prev) => [post, ...prev]);
          showToast("发布成功", "success");
        } catch {
          showToast("发布失败", "error");
        }
      })();
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    // 删除：登录 + 作者本人（ContentActions 已通过 isOwner 控制显示）
    try {
      await deleteBuddyPost(deleteTarget.id, user.id);
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      showToast("已删除", "success");
    } catch {
      showToast("删除失败", "error");
    }
    setDeleteTarget(null);
  };

  const handleToggleReplies = async (post: BuddyPost) => {
    if (expandedPost === post.id) {
      setExpandedPost(null);
      return;
    }
    setExpandedPost(post.id);
    if (!commentsMap[post.id]) {
      const comments = await getBuddyPostComments(post.id);
      setCommentsMap((prev) => ({ ...prev, [post.id]: comments }));
    }
  };

  const handleReply = (postId: string, content: string) => {
    if (replyLocked) return;
    // P7.3：回复统一走 useRequireRoomMembership
    requireRoomMembership(roomId ?? "", () => {
      if (!user) return;
      void (async () => {
        try {
          await replyBuddyPost(postId, user.id, content);
          const comments = await getBuddyPostComments(postId);
          setCommentsMap((prev) => ({ ...prev, [postId]: comments }));
          setPosts((prev) =>
            prev.map((p) =>
              p.id === postId
                ? { ...p, comment_count: (p.comment_count ?? 0) + 1 }
                : p
            )
          );
        } catch {
          showToast("回复失败", "error");
        }
      })();
    });
  };

  return (
    <div>
      {/* 发布按钮 */}
      {createLocked ? (
        <div className="mb-4 rounded-sm border border-border bg-bg-secondary px-3 py-2 text-xs text-text-tertiary text-center">
          演出已结束，不再接受新帖，历史内容仍可查看
        </div>
      ) : (
        <div className="mb-4">
          <Button
            variant="primary"
            size="sm"
            onClick={() => requireRoomMembership(roomId ?? "", () => setModalOpen(true))}
          >
            <Plus size={14} />
            发布找搭子
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
          还没有找搭子帖，来第一个发布的人吧
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} data-content-id={post.id}>
              <BuddyPostCard
                post={post}
                currentUserId={user?.id}
                onReplyToggle={handleToggleReplies}
                onDelete={setDeleteTarget}
                onReport={() => requireAuth(() => setReportOpen(true))}
                onMessage={(userId) => router.push(`/u/${userId}`)}
              >
                {expandedPost === post.id && commentsMap[post.id] && (
                  <PostReplies
                    comments={commentsMap[post.id]}
                    isLoggedIn={isLoggedIn}
                    isMember={isMember && !replyLocked}
                    onReply={(content) => handleReply(post.id, content)}
                  />
                )}
              </BuddyPostCard>
            </div>
          ))}
        </div>
      )}

      <BuddyPostModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除帖子"
        description="确定删除这条找搭子帖吗？删除后无法恢复。"
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
