"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  /** 强制使用某模式，不传则按屏幕宽度自适应 */
  forceMode?: "modal" | "sheet";
}

/**
 * 桌面：居中模态弹窗（背景遮罩+X关闭）
 * 移动：底部 Bottom Sheet（顶部拖动条+X关闭，从底部滑入）
 * 自适应：lg 断点以上 modal，以下 sheet
 */
export function Modal({ open, onClose, title, children, className, forceMode }: ModalProps) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const mode = forceMode ?? "modal";
  const isSheet = mode === "sheet";

  return (
    <div
      className="fixed inset-0 z-50 flex items-end lg:items-center justify-center animate-fade-in"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" aria-hidden />

      {/* 面板 */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative z-10 bg-bg-primary border border-border w-full",
          isSheet
            ? "max-h-[85vh] rounded-t-lg border-b-0 animate-slide-up lg:rounded-lg lg:max-w-lg lg:animate-fade-in lg:border-b"
            : "rounded-lg max-w-lg max-h-[85vh] animate-fade-in",
          className
        )}
      >
        {/* 顶部拖动条（仅sheet模式显示） */}
        <div
          className={cn(
            "hidden lg:hidden mx-auto mt-3 w-10 h-1 rounded-full bg-border-strong",
            isSheet && "block"
          )}
          aria-hidden
        />

        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border">
          {title ? (
            <h3 className="text-h3 text-text-primary">{title}</h3>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="shrink-0 w-9 h-9 flex items-center justify-center rounded-sm text-text-tertiary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 内容 */}
        <div className="overflow-y-auto max-h-[calc(85vh-64px)] px-5 py-5">
          {children}
        </div>
      </div>
    </div>
  );
}
