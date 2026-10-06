"use client";

import type { Show } from "@/lib/types";
import { ShowTicketStatus } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { getEffectiveShowState } from "@/lib/utils/showState";

interface MobileTicketBarProps {
  show: Show;
  /** 由编排层按滚动位置计算：到达票务区后出现，进入小屋区后隐藏 */
  visible: boolean;
}

/**
 * Mobile sticky 购票底栏（md:hidden）
 * 仅 on_sale 且演出未结束的场次出现；纯黑底 + 顶边 1px lime，无渐变。
 */
export function MobileTicketBar({ show, visible }: MobileTicketBarProps) {
  const state = getEffectiveShowState(show);
  if (!visible) return null;
  if (state.bucket !== "upcoming") return null;
  if (show.ticket_status !== ShowTicketStatus.ON_SALE) return null;

  const price = show.price_presale ?? show.price_door;
  const ctaLabel = show.ticket_platform ? `去${show.ticket_platform}购票` : "去购票";

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden border-t border-accent-lime bg-bg-primary">
      <div className="container-gigroom flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <p className="text-[10px] font-mono tracking-[0.25em] text-text-tertiary">
            票务
          </p>
          {price != null && (
            <p className="text-lg font-extrabold tabular-nums text-text-primary leading-tight">
              ¥{price}
              {show.price_presale != null && show.price_door != null ? " 起" : ""}
            </p>
          )}
        </div>
        {show.ticket_url ? (
          <a href={show.ticket_url} target="_blank" rel="noopener noreferrer">
            <Button variant="primary" size="md">
              {ctaLabel}
            </Button>
          </a>
        ) : (
          <Button variant="primary" size="md">
            购票
          </Button>
        )}
      </div>
    </div>
  );
}
