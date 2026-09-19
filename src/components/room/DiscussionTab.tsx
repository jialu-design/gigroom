"use client";

import * as React from "react";
import { getMessages, sendMessage, deleteMessage } from "@/lib/api/messages";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useToast } from "@/components/ui/Toast";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { ReportModal } from "@/components/shared/ReportModal";
import { useRequireRoomMembership } from "@/hooks/useRequireRoomMembership";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import type { DiscussionMessage } from "@/lib/types";

interface DiscussionTabProps {
  showId: string;
  roomId?: string;
  isMember: boolean;
  /** 讨论区已关闭（演出结束超过 7 天 / 取消 / 延期），只读 */
  locked?: boolean;
}

export function DiscussionTab({ showId, roomId, isMember, locked = false }: DiscussionTabProps) {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const user = useUserStore((s) => s.user);
  const requireRoomMembership = useRequireRoomMembership();
  const requireAuth = useRequireAuth();
  const { showToast } = useToast();

  const [messages, setMessages] = React.useState<DiscussionMessage[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [replyTo, setReplyTo] = React.useState<DiscussionMessage | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<DiscussionMessage | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  // 加载消息
  const load = React.useCallback(async () => {
    setLoading(true);
    const data = await getMessages(showId);
    setMessages(data);
    setLoading(false);
  }, [showId]);

  React.useEffect(() => {
    load();
  }, [load]);

  const handleSend = (content: string, replyToId?: string) => {
    // 安全护栏：讨论区关闭后不允许发送（UI 已隐藏输入框）
    if (locked) return;
    // P7.3：发送/回复消息统一走 useRequireRoomMembership
    // 未登录 → LoginModal/Onboarding；已登录未加入 → toast；已加入 → 发送
    requireRoomMembership(roomId ?? "", () => {
      // getState 取最新用户，避免闭包陈旧
      const currentUser = useUserStore.getState().user;
      if (!currentUser) return;

      // 乐观更新：立即把消息插到列表底部，不等远程写入，不刷新整页
      const tempId = `temp-${Date.now()}`;
      const replyTarget = replyToId
        ? messages.find((m) => m.id === replyToId)
        : undefined;
      const tempMessage: DiscussionMessage = {
        id: tempId,
        room_id: roomId ?? "",
        user_id: currentUser.id,
        user: currentUser,
        content,
        reply_to_id: replyToId,
        reply_to_user: replyTarget?.user,
        created_at: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMessage]);
      setReplyTo(null);
      setSending(true);

      void (async () => {
        try {
          const msg = await sendMessage(showId, currentUser.id, content, replyToId);
          setMessages((prev) => prev.map((m) => (m.id === tempId ? msg : m)));
        } catch (err) {
          setMessages((prev) => prev.filter((m) => m.id !== tempId));
          // 输出真实错误（Supabase error / RLS / 网络等），toast 同步展示原因
          console.error("[sendMessage] 发送失败:", err);
          showToast(
            err instanceof Error && err.message
              ? `发送失败：${err.message}`
              : "发送失败，请重试",
            "error"
          );
        } finally {
          setSending(false);
        }
      })();
    });
  };

  const handleDelete = async () => {
    if (!deleteTarget || !user) return;
    // 删除：登录 + 作者本人（ContentActions 已通过 isOwner 控制显示）
    try {
      await deleteMessage(deleteTarget.id, user.id);
      setMessages((prev) => prev.filter((m) => m.id !== deleteTarget.id));
      showToast("已删除", "success");
    } catch {
      showToast("删除失败", "error");
    }
    setDeleteTarget(null);
  };

  const handleReport = () => {
    // 举报：只需登录，不要求 membership
    requireAuth(() => {
      setReportOpen(true);
    });
  };

  const handleReportSubmit = () => {
    showToast("已收到举报，感谢反馈", "success");
  };

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-bg-tertiary" />
            <div className="flex-1 space-y-2">
              <div className="h-3 w-20 bg-bg-tertiary rounded" />
              <div className="h-4 w-3/4 bg-bg-tertiary rounded" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <MessageList
        messages={messages}
        currentUserId={user?.id}
        onReply={setReplyTo}
        onDelete={setDeleteTarget}
        onReport={handleReport}
      />
      {locked ? (
        <div className="mt-4 rounded-sm border border-border bg-bg-secondary px-3 py-2 text-xs text-text-tertiary text-center">
          讨论区已关闭，历史消息仍可查看
        </div>
      ) : (
        <div className="mt-4">
          <MessageInput
            isMember={isMember}
            isLoggedIn={isLoggedIn}
            replyTo={replyTo}
            onCancelReply={() => setReplyTo(null)}
            onSend={handleSend}
            sending={sending}
          />
        </div>
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="删除消息"
        description="确定删除这条消息吗？删除后无法恢复。"
        confirmText="删除"
      />
      <ReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={handleReportSubmit}
      />
    </div>
  );
}
