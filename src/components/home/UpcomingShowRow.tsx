import Link from "next/link";
import type { Show } from "@/lib/types";
import { ArtistRole } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import {
  getShowPosterFallback,
  getTicketStatusLabel,
  getTicketStatusBadgeVariant,
} from "@/lib/utils/format";
import { getEffectiveShowState } from "@/lib/utils/showState";

interface UpcomingShowRowProps {
  show: Show;
  className?: string;
}

/**
 * 首页「即将上演」紧凑列表行（P1-6，参考 Figma 密度）
 * 日期块 → 缩略图 → 艺人 + 票务状态 → 场地·城市·时间 → genre/票价/要去。
 */
export function UpcomingShowRow({ show, className }: UpcomingShowRowProps) {
  const headliner = show.artists?.find((a) => a.role === ArtistRole.HEADLINER);
  const displayName = headliner?.artist?.name ?? show.title ?? "未命名演出";
  const genreTag = headliner?.artist?.genres?.[0];
  const venueName = show.venue?.name ?? "";
  const state = getEffectiveShowState(show);
  const ticketLabel =
    state.bucket === "upcoming" && state.showTicketBadge
      ? getTicketStatusLabel(show.ticket_status)
      : "";

  const d = new Date(show.date_time);
  const zhDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  return (
    <Link
      href={`/show/${show.id}`}
      className={cn(
        "group flex items-center gap-3 md:gap-4 py-3 px-1 hover:bg-bg-secondary/60 transition-colors",
        className
      )}
    >
      {/* 日期块 */}
      <div className="w-12 md:w-14 shrink-0 text-center">
        <p className="num-date text-xl md:text-2xl text-text-primary leading-none">
          {String(d.getDate()).padStart(2, "0")}
        </p>
        <p className="text-[10px] text-text-tertiary mt-1">{zhDays[d.getDay()]}</p>
      </div>

      {/* 缩略图 */}
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary poster-border">
        {/* eslint-disable-next-line @next/next/no-img-element -- 列表内小缩略图，避免 Next Image 额外复杂性 */}
        <img
          src={show.poster_url || getShowPosterFallback(show.id)}
          alt={displayName}
          className="w-full h-full object-cover"
        />
      </div>

      {/* 主信息 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text-primary truncate group-hover:text-accent-lime transition-colors">
            {displayName}
          </span>
          {ticketLabel && (
            <Badge variant={getTicketStatusBadgeVariant(show.ticket_status)} size="sm">
              {ticketLabel}
            </Badge>
          )}
        </div>
        <p className="text-metadata mt-0.5 truncate">
          {venueName || show.city} · {show.city} · {time}
        </p>
      </div>

      {/* 右侧：genre / 票价 / 要去 */}
      <div className="shrink-0 flex items-center gap-3 md:gap-4">
        {genreTag && (
          <span className="hidden md:inline text-[10px] px-2 py-0.5 border border-border text-text-tertiary">
            {genreTag}
          </span>
        )}
        {show.price_presale !== undefined && (
          <span className="num-date text-sm text-text-primary">
            ¥{show.price_presale}
          </span>
        )}
        {show.going_count !== undefined && (
          <span className="hidden sm:inline text-metadata">
            <span className="num-date text-text-primary">{show.going_count.toLocaleString()}</span>{" "}
            要去
          </span>
        )}
      </div>
    </Link>
  );
}
