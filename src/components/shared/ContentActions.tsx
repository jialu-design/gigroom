"use client";

import * as React from "react";
import { MoreHorizontal, Trash2, Flag } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContentActionsProps {
  /** 是否为作者本人（显示删除入口） */
  isOwner: boolean;
  onDelete?: () => void;
  onReport?: () => void;
  className?: string;
}

/**
 * 内容操作菜单（删除/举报）
 * 复用组件，所有 Tab 的帖子/消息使用
 * 只有作者看到删除入口，所有人看到举报入口
 */
export function ContentActions({
  isOwner,
  onDelete,
  onReport,
  className,
}: ContentActionsProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="更多操作"
        className="w-7 h-7 flex items-center justify-center rounded-sm text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-20 w-28 rounded-md border border-border bg-bg-elevated shadow-lg py-1">
          {isOwner && onDelete && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onDelete();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-accent-red hover:bg-accent-red/10 transition-colors"
            >
              <Trash2 size={14} />
              删除
            </button>
          )}
          {!isOwner && onReport && (
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onReport();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors"
            >
              <Flag size={14} />
              举报
            </button>
          )}
        </div>
      )}
    </div>
  );
}
