"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

const BUDDY_TAGS = ["一起看演出", "排队", "吃饭", "拼车"];

interface BuddyPostModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (content: string, tags: string[]) => void;
}

export function BuddyPostModal({ open, onClose, onSubmit }: BuddyPostModalProps) {
  const [content, setContent] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);

  const toggleTag = (tag: string) => {
    setTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = () => {
    if (!content.trim()) return;
    onSubmit(content.trim(), tags);
    setContent("");
    setTags([]);
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="发布找搭子">
      <div className="space-y-5">
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="描述你的需求，比如：有没有人一起去看演出？"
          rows={4}
        />
        <div>
          <p className="mb-2 text-sm text-text-secondary">标签（可多选）</p>
          <div className="flex flex-wrap gap-2">
            {BUDDY_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                className={
                  tags.includes(tag)
                    ? "h-8 px-3 text-sm rounded-sm border border-accent-lime bg-accent-lime/10 text-accent-lime"
                    : "h-8 px-3 text-sm rounded-sm border border-border bg-bg-tertiary text-text-secondary hover:border-border-light"
                }
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!content.trim()}
          >
            发布
          </Button>
        </div>
      </div>
    </Modal>
  );
}
