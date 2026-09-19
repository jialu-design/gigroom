"use client";

import * as React from "react";
import { Flag } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";

interface ReportModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: (reason: string) => void;
}

const REPORT_REASONS = [
  "垃圾信息",
  "黄牛",
  "不当内容",
  "骚扰",
  "其他",
];

/**
 * 举报弹窗
 * 复用组件，所有 Tab 使用
 */
export function ReportModal({ open, onClose, onSubmit }: ReportModalProps) {
  const [reason, setReason] = React.useState("");
  const [detail, setDetail] = React.useState("");

  const handleSubmit = () => {
    if (!reason) return;
    onSubmit?.(`${reason}${detail ? `：${detail}` : ""}`);
    setReason("");
    setDetail("");
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="举报内容">
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-text-secondary">
          <Flag size={18} className="text-accent-lime" />
          <p className="text-sm">请选择举报原因，我们会尽快处理</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {REPORT_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setReason(r)}
              className={
                reason === r
                  ? "h-8 px-3 text-sm rounded-sm border border-accent-lime bg-accent-lime/10 text-accent-lime"
                  : "h-8 px-3 text-sm rounded-sm border border-border bg-bg-tertiary text-text-secondary hover:border-border-light"
              }
            >
              {r}
            </button>
          ))}
        </div>

        <Textarea
          placeholder="补充说明（选填）"
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={3}
        />

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button
            variant="danger"
            onClick={handleSubmit}
            disabled={!reason}
          >
            提交举报
          </Button>
        </div>
      </div>
    </Modal>
  );
}
