"use client";

import * as React from "react";
import { Share2, Link2, MessageCircle, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface LiveShareMenuProps {
  /** 分享目标 URL（站内深链，/show/{id}?tab=live#room） */
  url: string;
  className?: string;
}

/** 尝试复制文本，返回是否成功（不伪造成功） */
export async function tryCopy(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 继续走 execCommand fallback
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * 现场帖分享菜单（P5）
 * - 复制链接：真实复制，失败时诚实提示
 * - 微信好友 / 朋友圈：Web 无法直接调起微信，统一降级为「复制链接 + 明确引导」，不伪造成功
 */
export function LiveShareMenu({ url, className }: LiveShareMenuProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

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

  const absoluteUrl = () => `${window.location.origin}${url}`;

  const handleCopyLink = async () => {
    setOpen(false);
    const ok = await tryCopy(absoluteUrl());
    if (ok) {
      showToast("链接已复制", "success");
    } else {
      showToast(`复制失败，请手动复制：${url}`, "error");
    }
  };

  const handleWechat = async () => {
    setOpen(false);
    const ok = await tryCopy(absoluteUrl());
    if (ok) {
      showToast("链接已复制，请打开微信发送给好友", "success");
    } else {
      showToast("Web 端无法直接分享到微信，请手动复制链接发送", "warning");
    }
  };

  const handleMoments = async () => {
    setOpen(false);
    const ok = await tryCopy(absoluteUrl());
    if (ok) {
      showToast("链接已复制，请打开微信朋友圈粘贴分享", "success");
    } else {
      showToast("Web 端无法直接分享到朋友圈，请手动复制链接分享", "warning");
    }
  };

  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-sm text-text-secondary hover:bg-bg-tertiary transition-colors";

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="分享"
        className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
      >
        <Share2 size={14} />
        分享
      </button>
      {open && (
        <div className="absolute left-0 bottom-6 z-20 w-32 rounded-md border border-border bg-bg-elevated shadow-lg py-1">
          <button type="button" onClick={handleCopyLink} className={itemClass}>
            <Link2 size={14} />
            复制链接
          </button>
          <button type="button" onClick={handleWechat} className={itemClass}>
            <MessageCircle size={14} />
            微信好友
          </button>
          <button type="button" onClick={handleMoments} className={itemClass}>
            <ImageIcon size={14} />
            朋友圈
          </button>
        </div>
      )}
    </div>
  );
}
