"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import type { TicketPostType } from "@/lib/types";
import { TicketPostType as TPT } from "@/lib/types";

interface TicketPostModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: {
    type: TicketPostType;
    quantity: number;
    faceValue?: number;
    price?: number;
    note?: string;
  }) => void;
}

export function TicketPostModal({ open, onClose, onSubmit }: TicketPostModalProps) {
  const [type, setType] = React.useState<TicketPostType>(TPT.SELLING);
  const [quantity, setQuantity] = React.useState(1);
  const [faceValue, setFaceValue] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState("");

  const isSelling = type === TPT.SELLING;

  const reset = () => {
    setType(TPT.SELLING);
    setQuantity(1);
    setFaceValue("");
    setPrice("");
    setNote("");
    setError("");
  };

  const handleSubmit = () => {
    setError("");
    const qty = Number(quantity);
    if (!qty || qty <= 0) {
      setError("数量必须大于0");
      return;
    }
    const fv = faceValue ? Number(faceValue) : undefined;
    const pr = price ? Number(price) : undefined;

    if (isSelling) {
      if (!fv || fv <= 0) {
        setError("票面价必须大于0");
        return;
      }
      if (pr !== undefined && pr > fv) {
        setError("转让价不得高于票面原价");
        return;
      }
    }

    onSubmit({
      type,
      quantity: qty,
      faceValue: isSelling ? fv : undefined,
      price: pr,
      note: note.trim() || undefined,
    });
    reset();
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="发布出收票">
      <div className="space-y-5">
        {/* 类型选择 */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setType(TPT.SELLING)}
            className={
              isSelling
                ? "flex-1 h-10 rounded-sm border border-accent-lime bg-accent-lime/10 text-accent-lime text-sm font-medium"
                : "flex-1 h-10 rounded-sm border border-border bg-bg-tertiary text-text-secondary text-sm"
            }
          >
            出票
          </button>
          <button
            type="button"
            onClick={() => setType(TPT.BUYING)}
            className={
              !isSelling
                ? "flex-1 h-10 rounded-sm border border-accent-green bg-accent-green/10 text-accent-green-hover text-sm font-medium"
                : "flex-1 h-10 rounded-sm border border-border bg-bg-tertiary text-text-secondary text-sm"
            }
          >
            收票
          </button>
        </div>

        {/* 数量 */}
        <div>
          <label className="block text-sm text-text-secondary mb-1.5">数量</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            className="w-24 rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:border-accent-lime"
          />
        </div>

        {/* 出票：票面价 + 转让价 */}
        {isSelling && (
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-sm text-text-secondary mb-1.5">
                票面价 ¥
              </label>
              <input
                type="number"
                min={0}
                value={faceValue}
                onChange={(e) => setFaceValue(e.target.value)}
                placeholder="如 120"
                className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent-lime"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm text-text-secondary mb-1.5">
                转让价 ¥
              </label>
              <input
                type="number"
                min={0}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="如 100"
                className="w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent-lime"
              />
            </div>
          </div>
        )}

        {/* 收票：预算 */}
        {!isSelling && (
          <div>
            <label className="block text-sm text-text-secondary mb-1.5">
              预算 ¥（选填）
            </label>
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="如 100"
              className="w-32 rounded-md border border-border bg-bg-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus-visible:outline-none focus-visible:border-accent-lime"
            />
          </div>
        )}

        {/* 备注 */}
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="备注信息，如：座位区域、联系方式等"
          rows={3}
        />

        {error && (
          <p className="text-sm text-accent-red">{error}</p>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" onClick={onClose}>
            取消
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            发布
          </Button>
        </div>
      </div>
    </Modal>
  );
}
