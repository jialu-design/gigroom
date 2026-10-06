"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReportModal } from "@/components/shared/ReportModal";
import { useToast } from "@/components/ui/Toast";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useRequireRoomMembership } from "@/hooks/useRequireRoomMembership";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import {
  getTicketPosts,
  createTicketPost,
  updateTicketPostStatus,
  deleteTicketPost,
} from "@/lib/api/posts/ticketPosts";
import type { TicketPost, TicketPostType, TicketConversation } from "@/lib/types";
import { TicketPostStatus, TicketPostType as TPT } from "@/lib/types";
import { TicketRuleNotice } from "./TicketRuleNotice";
import { TicketPostCard } from "./TicketPostCard";
import { TicketPostModal } from "./TicketPostModal";
import { TicketChatModal } from "./TicketChatModal";
import { PostReplies } from "./PostReplies";
import { getTicketPostComments, replyTicketPost } from "@/lib/api/posts/ticketPosts";
import type { TicketPostComment } from "@/lib/types";

interface TicketTabProps {
  showId: string;
  roomId?: string;
  isMember: boolean;
  /** 演出已结束：禁止新帖 */
  createLocked?: boolean;
  /** 讨论宽限期结束：禁止回复 */
  replyLocked?: boolean;
  /** 该 Show 的最高已知票价（max(price_presale, price_door)），无则 undefined，用于锁票面价 */
  maxKnownPrice?: number;
}

type SubTab = "all" | TPT;

export function TicketTab({ showId, roomId, isMember, createLocked = false, replyLocked = false, maxKnownPrice }: TicketTabProps) {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const user = useUserStore((s) => s.user);
  const requireRoomMembership = useRequireRoomMembership();
  const requireAuth = useRequireAuth();
  const { showToast } = useToast();

  const [subTab, setSubTab] = React.useState<SubTab>("all");
  const [posts, setPosts] = React.useState<TicketPost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<TicketPost | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [expandedPost, setExpandedPost] = React.useState<string | null>(null);
  const [commentsMap, setCommentsMap] = React.useState<Record<string, TicketPostComment[]>>({});
  const [chatConversation, setChatConversation] = React.useState<TicketConversation | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const filterType = subTab === "all" ? undefined : subTab;
    const data = await getTicketPosts(showId, filterType);
    setPosts(data);
    setLoading(false);
  }, [showId, subTab]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleCreate = (input: {
    type: TicketPostType;
    quantity: number;
    faceValue?: number;
    price?: number;
    note?: string;
  }) => {
    if (createLocked) return;
    // P7.3：发布票务统一走 useRequireRoomMembership
    requireRoomMembership(roomId ?? "", () => {
      if (!user) return;
      void (async () => {
        try {
          const post = await createTicketPost(showId, user.id, input);
          setPosts((prev) => [post, ...prev]);
          showToast("发布成功", "success");
        } catch (err) {
          showToast(err instanceof Error ? err.message : "发布失败", "error");
        }
      })();
    });
  };

  const handleMarkComplete = (post: TicketPost) => {
    // P7.3：标记完成统一走 useRequireRoomMembership（仅作者可见，ContentActions 已限制）
    requireRoomMembership(roomId ?? "", () => {
      if (!user) return;
      void (async () => {
        try {
          await updateTicketPostStatus(post.id, user.id, TicketPostStatus.COMPLETED);
          setPosts((prev) =>
            prev.map((p) =>
              p.id === post.id ? { ...p, status: TicketPostStatus.COMPLETED } : p
            )
          );
          showToast("已标记完成", "success");
        } catch (err) {
          showToast(err instanceof Error ? err.message : "操作失败", "error");
        }
      })();
    });
  };

  const handleReopen = (post: TicketPost) => {
    // P1-9：撤销"已出/已收到"标记 → 回到进行中（同样仅作者可见）
    requireRoomMembership(roomId ?? "", () => {
      if (!user) return;
      void (async () => {
        try {
          await updateTicketPostStatus(post.id, user.id, TicketPostStatus.ACTIVE);
          setPosts((prev) =>
            prev.map((p) =>
              p.id === post.id ? { ...p, status: TicketPostStatus.ACTIVE } : p
            )
          );
          showToast("已撤销标记，帖子恢复进行中", "success");
        } catch (err) {
          showToast(err instanceof Error ? err.message : "操作失败", "error");
        }
      })();
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    // 删除：登录 + 作者本人（ContentActions 已通过 isOwner 控制显示）
    try {
      await deleteTicketPost(deleteTarget.id, user.id);
      setPosts((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      showToast("已删除", "success");
    } catch {
      showToast("删除失败", "error");
    }
    setDeleteTarget(null);
  };

  const handleToggleReplies = async (post: TicketPost) => {
    if (expandedPost === post.id) {
      setExpandedPost(null);
      return;
    }
    setExpandedPost(post.id);
    if (!commentsMap[post.id]) {
      const comments = await getTicketPostComments(post.id);
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
          await replyTicketPost(postId, user.id, content);
          const comments = await getTicketPostComments(postId);
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

  const subTabs: { key: SubTab; label: string }[] = [
    { key: "all", label: "全部" },
    { key: TPT.SELLING, label: "出票" },
    { key: TPT.BUYING, label: "收票" },
  ];

  return (
    <div>
      <TicketRuleNotice />

      {/* 子 Tab */}
      <div className="mb-4 flex gap-2">
        {subTabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setSubTab(t.key)}
            className={
              subTab === t.key
                ? "h-8 px-3 text-sm rounded-sm border border-accent-lime bg-accent-lime/10 text-accent-lime"
                : "h-8 px-3 text-sm rounded-sm border border-border bg-bg-tertiary text-text-secondary hover:border-border-light"
            }
          >
            {t.label}
          </button>
        ))}
      </div>

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
            发布出收票
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
          暂时没有{subTab === "selling" ? "出票" : subTab === "buying" ? "收票" : ""}帖子
        </div>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <div key={post.id} data-content-id={post.id}>
              <TicketPostCard
                post={post}
                currentUserId={user?.id}
                interactionLocked={createLocked}
                onMarkComplete={handleMarkComplete}
                onReopen={handleReopen}
                onDelete={setDeleteTarget}
                onReport={() => requireAuth(() => setReportOpen(true))}
                onReplyToggle={handleToggleReplies}
                onChatStarted={(conv) => setChatConversation(conv)}
              >
                {expandedPost === post.id && commentsMap[post.id] && (
                  <PostReplies
                    comments={commentsMap[post.id]}
                    isLoggedIn={isLoggedIn}
                    isMember={isMember && !replyLocked}
                    onReply={(content) => handleReply(post.id, content)}
                  />
                )}
              </TicketPostCard>
            </div>
          ))}
        </div>
      )}

      <TicketPostModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        maxKnownPrice={maxKnownPrice}
      />
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除帖子"
        description="确定删除这条票务帖子吗？删除后无法恢复。"
        confirmText="删除"
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={() => showToast("已收到举报，感谢反馈", "success")}
      />
      <TicketChatModal
        conversation={chatConversation}
        onClose={() => setChatConversation(null)}
      />
    </div>
  );
}
