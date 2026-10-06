import Link from "next/link";
import Image from "next/image";
import { Heart, Users } from "lucide-react";
import type { Show } from "@/lib/types";
import { ArtistRole } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  formatShowDate,
  getTicketStatusLabel,
  getTicketStatusBadgeVariant,
  getShowPosterFallback,
} from "@/lib/utils/format";
import { getEffectiveShowState } from "@/lib/utils/showState";

interface ShowCardProps {
  show: Show;
  /** 推荐原因（小字，蓝色），如"因你关注了 Chinese Football" */
  reason?: string;
  className?: string;
}

/**
 * 演出卡片（发现页/演出列表页网格用）
 * 海报优先，zine 风格，直角/小圆角，hover 轻微变亮
 */
export function ShowCard({ show, reason, className }: ShowCardProps) {
  const headliner = show.artists?.find(
    (a) => a.role === ArtistRole.HEADLINER
  );
  const displayName = headliner?.artist?.name ?? show.title ?? "未命名演出";
  const supportArtists = show.artists?.filter(
    (a) => a.role !== ArtistRole.HEADLINER
  );
  const venueName = show.venue?.name ?? "";

  // 统一状态口径：status 滞后但日期已过 → 按"已结束"显示，不再展示票务标签
  const state = getEffectiveShowState(show);
  const statusOverride = state.bucket !== "upcoming";
  const ticketLabel = statusOverride
    ? null
    : getTicketStatusLabel(show.ticket_status);
  const ticketVariant = getTicketStatusBadgeVariant(show.ticket_status);

  return (
    <Link href={`/show/${show.id}`} className={cn("group block", className)}>
      {/* 海报 */}
      <div className="relative aspect-[3/4] overflow-hidden rounded-md bg-bg-secondary poster-border">
        <Image
          src={show.poster_url || getShowPosterFallback(show.id)}
          alt={displayName}
          fill
          sizes="(max-width: 768px) 92vw, (max-width: 1200px) 46vw, 30vw"
          className={cn(
            "object-cover transition-transform duration-300 group-hover:scale-[1.03]",
            state.isInactive && "opacity-50 grayscale"
          )}
        />

        {/* DEMO 角标 */}
        {show.is_demo && (
          <span className="absolute top-2 right-2 bg-bg-primary/80 text-accent-yellow text-[10px] px-1.5 py-0.5 rounded-sm border border-accent-yellow/40 font-mono tracking-wider">
            DEMO
          </span>
        )}

        {/* 票务状态 badge（演出已结束/取消时改显生命周期状态） */}
        {statusOverride ? (
          <span className="absolute top-2 left-2">
            <Badge variant={state.badgeVariant} size="sm">
              {state.label}
            </Badge>
          </span>
        ) : (
          ticketLabel && (
            <span className="absolute top-2 left-2">
              <Badge variant={ticketVariant} size="sm">
                {ticketLabel}
              </Badge>
            </span>
          )
        )}
      </div>

      {/* 信息区 */}
      <div className="mt-3">
        <h3 className="font-bold text-text-primary text-body leading-snug group-hover:text-accent-lime transition-colors line-clamp-2">
          {displayName}
        </h3>

        {supportArtists && supportArtists.length > 0 && (
          <p className="mt-0.5 text-xs text-text-tertiary line-clamp-1">
            {supportArtists.map((sa) => sa.artist?.name).filter(Boolean).join(" + ")}
          </p>
        )}

        <p className="mt-1 text-sm text-text-secondary">
          {formatShowDate(show.date_time)}
          {venueName && ` · ${show.city} · ${venueName}`}
          {!venueName && ` · ${show.city}`}
        </p>

        {/* 非正常生命周期状态 */}
        {statusOverride && (
          <div className="mt-1.5">
            <Badge variant={state.badgeVariant} size="sm">
              {state.label}
            </Badge>
          </div>
        )}

        {/* 推荐原因 */}
        {reason && (
          <p className="mt-1.5 text-xs text-accent-blue">{reason}</p>
        )}

        {/* 人数统计 */}
        <div className="mt-2 flex items-center gap-3 text-xs text-text-tertiary">
          <span className="inline-flex items-center gap-1">
            <Heart size={12} /> {show.interested_count ?? 0}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users size={12} /> {show.going_count ?? 0}
          </span>
        </div>
      </div>
    </Link>
  );
}
