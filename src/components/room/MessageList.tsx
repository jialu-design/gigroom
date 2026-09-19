"use client";

import * as React from "react";
import { MessageItem } from "./MessageItem";
import type { DiscussionMessage } from "@/lib/types";

interface MessageListProps {
  messages: DiscussionMessage[];
  currentUserId?: string;
  onReply?: (message: DiscussionMessage) => void;
  onDelete?: (message: DiscussionMessage) => void;
  onReport?: (message: DiscussionMessage) => void;
}

export function MessageList({
  messages,
  currentUserId,
  onReply,
  onDelete,
  onReport,
}: MessageListProps) {
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // 首次加载滚动到底部
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <div className="text-center py-6 text-text-tertiary text-sm">
          还没有讨论消息，来说点什么吧
        </div>
      ) : (
        messages.map((msg) => (
          <MessageItem
            key={msg.id}
            message={msg}
            currentUserId={currentUserId}
            onReply={onReply}
            onDelete={onDelete}
            onReport={onReport}
          />
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
}
