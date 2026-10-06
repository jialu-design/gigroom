import Link from "next/link";
import Image from "next/image";
import { Users } from "lucide-react";
import type { Show } from "@/lib/types";
import { ArtistRole } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  formatShowDateTime,
  getTicketStatusLabel,
  getTicketStatusBadgeVariant,
  getShowPosterFallback,
} from "@/lib/utils/format";
import { getEffectiveShowState } from "@/lib/utils/showState";

interface ShowCardHomeProps {
  show: Show;
  className?: string;
}

/**
 * 首页即将上演卡片
 * 4:5 比例，大号 condensed 日期作为视觉锚点
 */
export function ShowCardHome({ show, className }: ShowCardHomeProps) {
  const headliner = show.artists?.find(
    (a) => a.role === ArtistRole.HEADLINER
  );
  const displayName = headliner?.artist?.name ?? show.title ?? "未命名演出";
  const venueName = show.venue?.name ?? "";

  // 首页数据虽已按 upcoming 预过滤，状态口径仍与全站统一（防滞后数据串入）
  const state = getEffectiveShowState(show);
  const ticketLabel = state.showTicketBadge
    ? getTicketStatusLabel(show.ticket_status)
    : "";
  const ticketVariant = getTicketStatusBadgeVariant(show.ticket_status);

  const monthShort = formatMonthShort(show.date_time);
  const day = formatDay(show.date_time);
  const weekday = formatWeekday(show.date_time);

  return (
    <Link
      href={`/show/${show.id}`}
      className={cn("group block", className)}
    >
      {/* 海报 4:5 */}
      <div className="relative aspect-[4/5] overflow-hidden bg-bg-secondary poster-border">
        <Image
          src={show.poster_url || getShowPosterFallback(show.id)}
          alt={displayName}
          fill
          sizes="(max-width: 768px) 46vw, (max-width: 1024px) 30vw, 23vw"
          className={cn(
            "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
            state.isInactive && "opacity-60 grayscale"
          )}
        />

        {/* 票务状态 badge（仅 upcoming） */}
        {ticketLabel && (
          <span className="absolute top-3 left-3">
            <Badge variant={ticketVariant} size="sm">
              {ticketLabel}
            </Badge>
          </span>
        )}

        {/* 非 upcoming 状态 badge（已结束/已取消/已延期） */}
        {state.bucket !== "upcoming" && (
          <span className="absolute top-3 right-3">
            <Badge variant={state.badgeVariant} size="sm">
              {state.label}
            </Badge>
          </span>
        )}

        {/* 底部暗角渐变 + condensed 日期大字 */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/30 to-transparent pointer-events-none" />
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between pointer-events-none">
          <div>
            <p className="font-condensed leading-none">
              <span className="text-accent-lime text-[11px] tracking-[0.15em] uppercase">
                {monthShort}
              </span>
              <span className="ml-1.5 text-text-primary text-[32px] md:text-[36px] font-bold tracking-tight">
                {day}
              </span>
            </p>
            <p className="font-condensed text-text-tertiary text-[10px] tracking-wide uppercase mt-1">
              {weekday}
            </p>
          </div>
        </div>
      </div>

      {/* 信息区 */}
      <div className="mt-3">
        <h3 className="font-semibold text-text-primary text-body leading-snug group-hover:text-accent-lime transition-colors line-clamp-2">
          {displayName}
        </h3>

        <p className="mt-1.5 text-xs text-text-secondary">
          {venueName || show.city}
          {venueName && ` · ${show.city}`}
        </p>

        <p className="mt-0.5 text-xs text-text-tertiary">
          {formatShowDateTime(show.date_time)}
        </p>

        {/* 要去人数 */}
        {show.going_count !== undefined && (
          <div className="mt-2 flex items-center gap-1 text-text-tertiary text-xs">
            <Users size={12} />
            <span className="font-condensed text-text-primary text-sm tracking-wide">
              {show.going_count.toLocaleString()}
            </span>
            <span className="text-text-tertiary">要去</span>
          </div>
        )}
      </div>
    </Link>
  );
}

function formatMonthShort(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short" }).toUpperCase();
}
function formatDay(iso: string): string {
  return String(new Date(iso).getDate()).padStart(2, "0");
}
function formatWeekday(iso: string): string {
  const zhDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return zhDays[new Date(iso).getDay()];
}
