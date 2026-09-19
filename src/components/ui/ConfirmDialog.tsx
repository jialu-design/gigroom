"use client";

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "./Button";
import { Modal } from "./Modal";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** 是否危险操作（删除等），confirm按钮用danger variant */
  danger?: boolean;
  /** 确认中的loading态 */
  confirming?: boolean;
}

/**
 * 二次确认对话框（删除、退出等破坏性动作使用）
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = "确认",
  cancelText = "取消",
  danger = true,
  confirming = false,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-4">
          <div
            className={
              danger
                ? "shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-accent-red-muted/30 text-accent-red"
                : "shrink-0 w-11 h-11 rounded-full flex items-center justify-center bg-accent-blue/20 text-accent-blue-hover"
            }
            aria-hidden
          >
            <AlertTriangle size={22} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-lg font-semibold text-text-primary mb-1">
              {title}
            </h4>
            {description && (
              <p className="text-text-secondary text-body leading-relaxed">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={confirming}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            onClick={onConfirm}
            disabled={confirming}
          >
            {confirming ? "处理中…" : confirmText}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
