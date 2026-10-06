import Link from "next/link";
import Image from "next/image";
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

interface ShowCardCompactProps {
  show: Show;
  className?: string;
}

/**
 * 紧凑版演出卡片（横向布局，用于 Profile / Rooms 侧边栏）
 * 小海报缩略图 + 乐队名 + 日期 + 城市
 */
export function ShowCardCompact({ show, className }: ShowCardCompactProps) {
  const headliner = show.artists?.find(
    (a) => a.role === ArtistRole.HEADLINER
  );
  const displayName = headliner?.artist?.name ?? show.title ?? "未命名演出";
  // 我的演出中含已结束（去过）：统一状态口径，已结束展示演出状态而非票务标签
  const state = getEffectiveShowState(show);
  const ticketLabel = state.showTicketBadge
    ? getTicketStatusLabel(show.ticket_status)
    : "";
  const ticketVariant = getTicketStatusBadgeVariant(show.ticket_status);

  return (
    <Link
      href={`/show/${show.id}`}
      className={cn(
        "group flex gap-3 p-2 rounded-md hover:bg-bg-secondary transition-colors",
        className
      )}
    >
      {/* 海报缩略图 */}
      <div className="relative h-20 w-15 shrink-0 overflow-hidden rounded-sm bg-bg-secondary poster-border">
        <Image
          src={show.poster_url || getShowPosterFallback(show.id)}
          alt={displayName}
          fill
          sizes="60px"
          className={cn("object-cover", state.isInactive && "opacity-50 grayscale")}
        />
      </div>

      {/* 信息 */}
      <div className="flex min-w-0 flex-col justify-center">
        <h4 className="text-sm font-semibold text-text-primary group-hover:text-accent-lime transition-colors line-clamp-1">
          {displayName}
        </h4>
        <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">
          {formatShowDate(show.date_time)} · {show.city}
        </p>
        <div className="mt-1 flex items-center gap-1.5">
          {state.bucket === "upcoming" ? (
            ticketLabel && (
              <Badge variant={ticketVariant} size="sm">
                {ticketLabel}
              </Badge>
            )
          ) : (
            <Badge variant={state.badgeVariant} size="sm">
              {state.label}
            </Badge>
          )}
          {show.is_demo && (
            <span className="text-[10px] text-accent-yellow/70 font-mono">DEMO</span>
          )}
        </div>
      </div>
    </Link>
  );
}
