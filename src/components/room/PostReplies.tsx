"use client";

import * as React from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { User } from "@/lib/types";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

/** 最小评论接口，兼容 BuddyPostComment / TicketPostComment */
interface MinimalComment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  user?: User;
}

interface PostRepliesProps<T extends MinimalComment> {
  comments: T[];
  isLoggedIn: boolean;
  isMember: boolean;
  onReply: (content: string) => void;
}

export function PostReplies<T extends MinimalComment>({
  comments,
  isLoggedIn,
  isMember,
  onReply,
}: PostRepliesProps<T>) {
  const [content, setContent] = React.useState("");

  const handleReply = () => {
    if (!content.trim()) return;
    onReply(content.trim());
    setContent("");
  };

  return (
    <div className="mt-3 ml-8 space-y-3 border-l border-border pl-4">
      {comments.map((c) => (
        <div key={c.id} className="flex gap-2">
          <Avatar
            src={c.user?.avatar_url}
            fallbackName={c.user?.display_name}
            size="xs"
          />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-text-primary">
                {c.user?.display_name ?? "未知用户"}
              </span>
              <span className="text-xs text-text-tertiary">
                {format(new Date(c.created_at), "MM-dd HH:mm", {
                  locale: zhCN,
                })}
              </span>
            </div>
            <p className="text-sm text-text-secondary">{c.content}</p>
          </div>
        </div>
      ))}
      {isLoggedIn && isMember ? (
        <div className="flex items-end gap-2">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="回复…"
            rows={1}
            className="text-sm py-2"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReply}
            disabled={!content.trim()}
          >
            回复
          </Button>
        </div>
      ) : null}
    </div>
  );
}
