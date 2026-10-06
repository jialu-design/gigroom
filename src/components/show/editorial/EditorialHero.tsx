"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Users } from "lucide-react";
import type { EditorialPhoto, Show } from "@/lib/types";
import { ArtistRole } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { getEffectiveShowState } from "@/lib/utils/showState";
import {
  getTicketStatusLabel,
  getTicketStatusBadgeVariant,
  getShowPosterFallback,
  getArtistShortName,
  formatShowDateTime,
} from "@/lib/utils/format";

interface EditorialHeroProps {
  show: Show;
  /** 已策展主视觉（url 非空）；缺省回退 show 海报 */
  keyVisual?: EditorialPhoto;
  className?: string;
}

/**
 * ① SHOW HERO — Show Editorial Page 首屏
 * Desktop：左 8 列 16:9 摄影硬拼右 4 列纯黑信息板（无圆角/无阴影/无渐变）；
 * Mobile：摄影在上、信息板在下。
 * H1 为 Show 展示标题：拼盘场「短名 × 短名」，双方 Artist 均可点；嘉宾层级交给 LINEUP。
 */
export function EditorialHero({ show, keyVisual, className }: EditorialHeroProps) {
  const state = React.useMemo(() => getEffectiveShowState(show), [show]);

  // 主艺人在前、嘉宾在后，去重后用于组合标题
  const titleEntries = React.useMemo(() => {
    const entries = show.artists ?? [];
    const headliners = entries.filter((a) => a.role === ArtistRole.HEADLINER);
    const supports = entries.filter((a) => a.role !== ArtistRole.HEADLINER);
    const seen = new Set<string>();
    return [...headliners, ...supports].filter((a) => {
      if (!a.artist || seen.has(a.artist_id)) return false;
      seen.add(a.artist_id);
      return true;
    });
  }, [show.artists]);

  const displayName =
    titleEntries.length > 0
      ? titleEntries
          .slice(0, 3)
          .map((a) => getArtistShortName(a.artist!.name))
          .join(" × ")
      : show.title ?? "未命名演出";

  const heroSrc = keyVisual?.url ?? show.poster_url ?? getShowPosterFallback(show.id);
  const ticketLabel = getTicketStatusLabel(show.ticket_status);
  const ticketVariant = getTicketStatusBadgeVariant(show.ticket_status);

  return (
    <section className={cn("grid grid-cols-1 lg:grid-cols-12", className)}>
      {/* 左：Editorial 摄影（硬裁切，无圆角） */}
      <div className="relative aspect-[16/10] lg:aspect-[16/9] lg:col-span-8 overflow-hidden bg-bg-secondary">
        <Image
          src={heroSrc}
          alt={displayName}
          fill
          sizes="(max-width: 1024px) 100vw, 66vw"
          className={cn("object-cover", state.isInactive && "opacity-60 grayscale")}
          priority
        />
        {show.is_demo && (
          <span className="absolute top-3 right-3 bg-bg-primary/80 text-accent-yellow text-xs px-2 py-1 border border-accent-yellow/40 font-mono tracking-wider">
            DEMO
          </span>
        )}
        {keyVisual && (
          <span className="absolute bottom-0 left-0 bg-bg-primary/85 text-text-tertiary text-[10px] font-mono px-2 py-1">
            {keyVisual.source_account}
            {keyVisual.photographer ? ` · 摄影 ${keyVisual.photographer}` : ""}
          </span>
        )}
      </div>

      {/* 右：黑板信息板（硬边拼接） */}
      <div className="lg:col-span-4 bg-bg-secondary flex flex-col justify-between gap-8 p-6 lg:p-8">
        {/* 状态 chips */}
        <div className="flex flex-wrap items-center gap-2">
          {ticketLabel && <Badge variant={ticketVariant} size="md">{ticketLabel}</Badge>}
          {state.bucket !== "upcoming" && (
            <Badge variant={state.badgeVariant} size="md">{state.label}</Badge>
          )}
        </div>

        {/* 标题区：组合展示标题，每个艺人名可点进主页；嘉宾层级在 LINEUP 呈现 */}
        <div>
          <h1 className="text-4xl lg:text-[2.5rem] xl:text-[2.75rem] font-extrabold leading-tight tracking-tight text-text-primary">
            {titleEntries.length > 0
              ? titleEntries.slice(0, 3).map((entry, i) => (
                  <React.Fragment key={entry.artist_id}>
                    {i > 0 && (
                      <span className="text-text-tertiary font-bold mx-1" aria-hidden>
                        ×
                      </span>
                    )}
                    <Link
                      href={`/artist/${entry.artist_id}`}
                      className="hover:text-accent-lime transition-colors"
                    >
                      {getArtistShortName(entry.artist!.name)}
                    </Link>
                  </React.Fragment>
                ))
              : displayName}
          </h1>
        </div>

        {/* 日期 / 场地 / 人数 */}
        <div className="space-y-2 text-sm">
          <p className="text-text-primary font-medium">{formatShowDateTime(show.date_time)}</p>
          <p className="text-text-secondary">
            {show.city}
            {show.venue?.name ? ` · ${show.venue.name}` : ""}
          </p>
          <p className="flex items-center gap-4 text-text-tertiary pt-1">
            <span className="inline-flex items-center gap-1.5">
              <Heart size={14} />
              <span className="text-text-primary font-bold tabular-nums">{show.interested_count ?? 0}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users size={14} />
              <span className="text-text-primary font-bold tabular-nums">{show.going_count ?? 0}</span>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
