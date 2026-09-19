"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Users, MessageSquare, Home, ArrowRight } from "lucide-react";
import type { Show } from "@/lib/types";
import { ArtistRole, ShowStatus } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  getTicketStatusLabel,
  getTicketStatusBadgeVariant,
  isShowInactive,
  getShowPosterFallback,
  getShowStatusLabel,
  getShowStatusBadgeVariant,
} from "@/lib/utils/format";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface ShowListCardProps {
  show: Show;
  className?: string;
}

/**
 * 基于 show.id 派生稳定的小屋统计（DEMO mock 用，避免 N+1 请求）
 */
function deriveRoomStats(showId: string) {
  let hash = 0;
  for (let i = 0; i < showId.length; i++) {
    hash = (hash * 31 + showId.charCodeAt(i)) >>> 0;
  }
  const members = 24 + (hash % 480); // 24 ~ 503
  const discussions = 6 + (hash % 120); // 6 ~ 125
  return { members, discussions };
}

/**
 * 演出列表行（演出列表页用）
 * 左侧日期块 | 中间海报缩略图+信息+小屋统计 | 右侧进入小屋
 */
export function ShowListCard({ show, className }: ShowListCardProps) {
  const router = useRouter();
  const headliner = show.artists?.find(
    (a) => a.role === ArtistRole.HEADLINER
  );
  const displayName = headliner?.artist?.name ?? show.title ?? "未命名演出";
  const supportArtists = show.artists?.filter(
    (a) => a.role !== ArtistRole.HEADLINER
  );
  const venueName = show.venue?.name ?? "";
  const inactive = isShowInactive(show.status);
  // 日期驱动生命周期：status 滞后但日期已过 → 按"已结束"显示，不再展示票务标签
  const lifecycle = getShowLifecycle(show);
  const statusOverride =
    lifecycle.hasEnded || show.status !== ShowStatus.UPCOMING;
  const effectiveStatus =
    lifecycle.hasEnded && show.status === ShowStatus.UPCOMING
      ? ShowStatus.ENDED
      : show.status;
  const ticketLabel = statusOverride
    ? null
    : getTicketStatusLabel(show.ticket_status);
  const ticketVariant = getTicketStatusBadgeVariant(show.ticket_status);
  const showStatusLabel = getShowStatusLabel(effectiveStatus);
  const showStatusVariant = getShowStatusBadgeVariant(effectiveStatus);

  const dateObj = new Date(show.date_time);
  const { members, discussions } = deriveRoomStats(show.id);
  const posterSrc = show.poster_url || getShowPosterFallback(show.id);

  const goRoom = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`/show/${show.id}#room`);
  };

  return (
    <div
      className={cn(
        "group flex items-stretch gap-3 sm:gap-4 py-3 border-b border-border hover:bg-bg-secondary/50 transition-colors -mx-2 px-2 rounded-sm",
        className
      )}
    >
      {/* 左侧日期块 */}
      <Link
        href={`/show/${show.id}`}
        className="flex w-12 sm:w-14 shrink-0 flex-col items-center justify-center text-center"
      >
        <span className="text-[10px] text-text-tertiary">
          {format(dateObj, "M月", { locale: zhCN })}
        </span>
        <span className="text-xl sm:text-2xl font-bold text-text-primary leading-none">
          {format(dateObj, "d")}
        </span>
      </Link>

      {/* 中间海报缩略图 + 信息 */}
      <Link
        href={`/show/${show.id}`}
        className="relative h-16 w-12 sm:h-20 sm:w-15 shrink-0 overflow-hidden rounded-sm bg-bg-secondary poster-border"
      >
        <Image
          src={posterSrc}
          alt={displayName}
          fill
          sizes="60px"
          className={cn("object-cover", inactive && "opacity-50 grayscale")}
        />
      </Link>

      <Link
        href={`/show/${show.id}`}
        className="flex min-w-0 flex-1 flex-col justify-center"
      >
        <h3 className="text-sm sm:text-body font-semibold text-text-primary group-hover:text-accent-lime transition-colors line-clamp-1">
          {displayName}
        </h3>
        {supportArtists && supportArtists.length > 0 && (
          <p className="mt-0.5 text-xs text-text-tertiary line-clamp-1">
            {supportArtists.map((sa) => sa.artist?.name).filter(Boolean).join(" + ")}
          </p>
        )}
        <p className="mt-0.5 text-xs sm:text-sm text-text-secondary line-clamp-1">
          {show.city}
          {venueName && ` · ${venueName}`}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {statusOverride ? (
            <Badge variant={showStatusVariant} size="sm">
              {showStatusLabel}
            </Badge>
          ) : (
            ticketLabel && (
              <Badge variant={ticketVariant} size="sm">
                {ticketLabel}
              </Badge>
            )
          )}
          {show.is_demo && (
            <span className="text-[10px] text-accent-yellow/70 font-mono">DEMO</span>
          )}
        </div>
        {/* 轻量小屋信息 */}
        <div className="mt-1 flex items-center gap-3 text-[11px] text-text-tertiary">
          <span className="inline-flex items-center gap-1">
            <Home size={11} strokeWidth={1.5} />
            {members} 人在小屋
          </span>
          <span className="inline-flex items-center gap-1">
            <MessageSquare size={11} strokeWidth={1.5} />
            {discussions} 条讨论
          </span>
        </div>
      </Link>

      {/* 右侧：要去人数 + 进入小屋 */}
      <div className="flex shrink-0 flex-col items-end justify-center gap-1.5">
        <span className="inline-flex items-center gap-1 text-xs text-text-tertiary">
          <Users size={12} /> {show.going_count ?? 0}
        </span>
        <button
          type="button"
          onClick={goRoom}
          className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-accent-lime transition-colors"
        >
          进入小屋
          <ArrowRight size={12} />
        </button>
      </div>
    </div>
  );
}
