"use client";

import { AlertTriangle } from "lucide-react";

/** 固定规则提示，始终显示在票务 Tab 顶部 */
export function TicketRuleNotice() {
  return (
    <div className="mb-4 rounded-sm border border-accent-yellow/30 bg-accent-yellow/10 p-3">
      <div className="flex items-center gap-2">
        <AlertTriangle size={16} className="text-accent-yellow shrink-0" />
        <div>
          <p className="text-sm font-semibold text-accent-yellow">
            原价及以下友好转让
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            平台不参与资金交易，请注意交易风险。
          </p>
        </div>
      </div>
    </div>
  );
}
