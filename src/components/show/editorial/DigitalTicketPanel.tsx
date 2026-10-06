"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Show } from "@/lib/types";
import { ShowTicketStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { getEffectiveShowState } from "@/lib/utils/showState";
import { getTicketStatusLabel, getTicketStatusBadgeVariant } from "@/lib/utils/format";

interface DigitalTicketPanelProps {
  show: Show;
  className?: string;
}

/**
 * ⑦ DIGITAL TICKET — 独立票务信息面板
 * GigRoom Digital Ticket 语言：硬边 1px hairline + metadata 行 + 状态 + 价格数字 + 平台外链。
 * 不做撕齿票根/纸质票根造型；四态购票口径与旧 Hero 完全一致（含售罄转小屋出收票）。
 */
export function DigitalTicketPanel({ show, className }: DigitalTicketPanelProps) {
  const state = React.useMemo(() => getEffectiveShowState(show), [show]);
  const ticketLabel = getTicketStatusLabel(show.ticket_status);
  const ticketVariant = getTicketStatusBadgeVariant(show.ticket_status);

  const onSaleAt = show.ticket_on_sale_at
    ? new Date(show.ticket_on_sale_at)
    : null;

  /** 四态购票区（口径复制自 ShowHero.renderTicketButton，仅换容器样式） */
  const renderCta = () => {
    if (state.bucket === "cancelled") {
      return (
        <div className="border border-border px-4 py-3 text-center text-sm text-text-secondary">
          本场演出已取消
        </div>
      );
    }
    if (state.bucket === "postponed") {
      return (
        <div className="border border-accent-yellow/40 bg-accent-yellow/10 px-4 py-3 text-center text-sm text-accent-yellow">
          演出延期，具体时间另行通知
        </div>
      );
    }
    if (state.bucket === "ended") {
      return (
        <div className="border border-border px-4 py-3 text-center text-sm text-text-tertiary">
          演出已结束，感谢到场的每一位
        </div>
      );
    }

    if (show.ticket_status === ShowTicketStatus.SOLD_OUT) {
      return (
        <div className="border border-border px-4 py-3 text-center">
          <p className="text-sm text-text-secondary">全票售罄</p>
          <Link
            href={`/show/${show.id}?tab=ticket`}
            className="mt-1 inline-block text-sm text-accent-lime hover:underline"
          >
            去观演小屋看出收票 →
          </Link>
        </div>
      );
    }
    if (show.ticket_status === ShowTicketStatus.COMING_SOON) {
      return (
        <Button variant="secondary" size="lg" className="w-full justify-center" disabled>
          {show.ticket_platform
            ? `即将开票 · 购票平台：${show.ticket_platform}`
            : "即将开票"}
        </Button>
      );
    }
    // ON_SALE
    if (show.ticket_url) {
      return (
        <a href={show.ticket_url} target="_blank" rel="noopener noreferrer" className="block">
          <Button variant="primary" size="lg" className="w-full justify-center">
            {show.ticket_platform ? `去${show.ticket_platform}购票` : "去购票"}
            <ExternalLink size={16} />
          </Button>
        </a>
      );
    }
    return (
      <Button variant="primary" size="lg" className="w-full justify-center">
        购票
      </Button>
    );
  };

  return (
    <section
      aria-label="票务信息"
      className={cn("border border-border bg-bg-secondary", className)}
    >
      {/* 面板头 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <p className="text-[10px] font-mono tracking-[0.25em] text-text-tertiary">
          票务
        </p>
        {show.is_demo && (
          <span className="border border-accent-yellow/40 text-accent-yellow text-[10px] px-1 py-px font-mono">
            DEMO 票
          </span>
        )}
      </div>

      {/* metadata 行 */}
      <div className="px-4 py-4 space-y-4">
        {/* 状态 */}
        <div className="flex flex-wrap items-center gap-2">
          {ticketLabel && <Badge variant={ticketVariant} size="md">{ticketLabel}</Badge>}
          {state.bucket !== "upcoming" && (
            <Badge variant={state.badgeVariant} size="md">{state.label}</Badge>
          )}
        </div>

        {/* 开票时间 */}
        {onSaleAt && (
          <div className="flex items-baseline justify-between gap-3 border-b border-border pb-3">
            <span className="text-xs text-text-tertiary">开票时间</span>
            <span className="text-sm font-bold text-text-primary tabular-nums">
              {show.ticket_status === ShowTicketStatus.COMING_SOON
                ? `${onSaleAt.getMonth() + 1}月${onSaleAt.getDate()}日 ${String(onSaleAt.getHours()).padStart(2, "0")}:${String(onSaleAt.getMinutes()).padStart(2, "0")} 开票`
                : `${onSaleAt.getMonth() + 1}月${onSaleAt.getDate()}日 已开票`}
            </span>
          </div>
        )}

        {/* 价格数字 */}
        {(show.price_presale != null || show.price_door != null) && (
          <div className="grid grid-cols-2 divide-x divide-border border-b border-border pb-4">
            <div className="pr-3">
              <p className="text-[10px] font-mono tracking-[0.25em] text-text-tertiary">
                预售
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-text-primary">
                {show.price_presale != null ? `¥${show.price_presale}` : ""}
              </p>
            </div>
            <div className="pl-4">
              <p className="text-[10px] font-mono tracking-[0.25em] text-text-tertiary">
                现场
              </p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-text-primary">
                {show.price_door != null ? `¥${show.price_door}` : ""}
              </p>
            </div>
          </div>
        )}
        {show.price_presale == null && show.price_door == null && show.price_text && (
          <div className="border-b border-border pb-3">
            <p className="text-[10px] font-mono tracking-[0.25em] text-text-tertiary">票价</p>
            <p className="mt-1 text-lg font-bold text-text-primary">{show.price_text}</p>
          </div>
        )}

        {/* 平台 */}
        {show.ticket_platform && (
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <span className="text-xs text-text-tertiary">购票平台</span>
            <span className="text-sm font-bold text-text-primary">
              {show.ticket_platform}
            </span>
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="px-4 pb-4">{renderCta()}</div>
    </section>
  );
}
