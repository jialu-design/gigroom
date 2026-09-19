"use client";

import * as React from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { DiscussionMessage } from "@/lib/types";

interface MessageInputProps {
  /** 是否已加入 Room */
  isMember: boolean;
  /** 是否登录 */
  isLoggedIn: boolean;
  /** 回复目标 */
  replyTo?: DiscussionMessage | null;
  onCancelReply?: () => void;
  onSend: (content: string, replyToId?: string) => void;
  /** 发送请求进行中 */
  sending?: boolean;
}

export function MessageInput({
  isMember,
  isLoggedIn,
  replyTo,
  onCancelReply,
  onSend,
  sending = false,
}: MessageInputProps) {
  const [content, setContent] = React.useState("");

  const disabled = !isLoggedIn || !isMember || sending;
  const placeholder = !isLoggedIn
    ? "登录后参与讨论"
    : !isMember
    ? "加入观演小屋后参与讨论"
    : sending
    ? "发送中…"
    : "说点什么…";

  const handleSend = () => {
    if (!content.trim() || disabled) return;
    onSend(content.trim(), replyTo?.id);
    setContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-border pt-3">
      {/* 回复提示 */}
      {replyTo && (
        <div className="mb-2 flex items-center gap-2 text-xs text-text-tertiary">
          <span>
            回复 @{replyTo.user?.display_name ?? "用户"}
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="text-accent-lime hover:text-accent-lime-hover"
          >
            取消
          </button>
        </div>
      )}
      <div className="flex items-end gap-2">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-sm border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent-lime disabled:opacity-50 disabled:cursor-not-allowed max-h-24"
        />
        <Button
          variant="primary"
          size="sm"
          onClick={handleSend}
          disabled={disabled || !content.trim()}
        >
          <Send size={14} />
          发送
        </Button>
      </div>
    </div>
  );
}
