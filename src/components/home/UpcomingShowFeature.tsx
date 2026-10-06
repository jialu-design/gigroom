"use client";

import Link from "next/link";
import Image from "next/image";
import { Users } from "lucide-react";
import type { Show } from "@/lib/types";
import { ArtistRole } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getShowPosterFallback } from "@/lib/utils/format";
import { getEffectiveShowState } from "@/lib/utils/showState";
import { getGenreLabel } from "@/lib/constants";

interface UpcomingShowFeatureProps {
  show: Show;
  className?: string;
}

/**
 * 首页「即将上演」大卡（P1-6，参考 Figma 信息层级）
 * 海报 + LIVE 圆点 + genre 角标 + 大号 condensed 日期锚点；
 * 下方信息区：艺人名 → 演出副题 → 场地/城市/时间 → 票价 + 要去人数。
 */
export function UpcomingShowFeature({ show, className }: UpcomingShowFeatureProps) {
  const headliner = show.artists?.find((a) => a.role === ArtistRole.HEADLINER);
  const displayName = headliner?.artist?.name ?? show.title ?? "未命名演出";
  const genreTag = headliner?.artist?.genres?.[0];
  const venueName = show.venue?.name ?? "";
  const state = getEffectiveShowState(show);

  const { monthShort, day, weekday, time } = decomposeDate(show.date_time);

  return (
    <Link href={`/show/${show.id}`} className={cn("group block", className)}>
      {/* 海报 3:4 */}
      <div className="relative aspect-[3/4] overflow-hidden bg-bg-secondary poster-border">
        <Image
          src={show.poster_url || getShowPosterFallback(show.id)}
          alt={displayName}
          fill
          sizes="(max-width: 768px) 90vw, 33vw"
          className={cn(
            "object-cover transition-transform duration-500 group-hover:scale-[1.03]",
            state.isInactive && "opacity-60 grayscale"
          )}
        />

        {/* LIVE 圆点（左上） */}
        <span className="absolute top-3 left-3 flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-accent-lime" aria-hidden />
          <span className="font-condensed text-[10px] font-semibold tracking-[0.2em] text-accent-lime uppercase">
            Live
          </span>
        </span>

        {/* genre 角标（右上） */}
        {genreTag && (
          <span className="absolute top-3 right-3 px-2 py-0.5 text-[10px] text-text-secondary border border-white/20 bg-bg-primary/60 backdrop-none">
            {getGenreLabel(genreTag)}
          </span>
        )}

        {/* 底部暗角 + 大日期（num-date 层级） */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg-primary via-bg-primary/30 to-transparent pointer-events-none" />
        <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
          <p className="leading-none">
            <span className="font-condensed text-accent-lime text-xs tracking-[0.2em] uppercase">
              {monthShort}
            </span>
            <span className="num-date ml-1.5 text-text-primary text-4xl md:text-5xl">
              {day}
            </span>
          </p>
          <p className="text-metadata mt-1.5">
            {weekday} · {time}
          </p>
        </div>
      </div>

      {/* 信息区 */}
      <div className="mt-3">
        <h3 className="text-base font-bold text-text-primary leading-snug group-hover:text-accent-lime transition-colors line-clamp-1">
          {displayName}
        </h3>
        {show.title && show.title !== displayName && (
          <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">
            {show.title}
          </p>
        )}

        <div className="mt-2.5 border-t border-border pt-2.5">
          <p className="text-metadata">
            {venueName || show.city}
            {venueName && ` · ${show.city}`}
          </p>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="num-date text-text-primary text-lg">
              ¥{show.price_presale ?? show.price_door ?? "—"}
            </span>
            {show.going_count !== undefined && (
              <span className="flex items-center gap-1 text-metadata">
                <Users size={12} />
                <span className="num-date text-sm text-text-primary">
                  {show.going_count.toLocaleString()}
                </span>
                要去
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

/** 日期拆解：SEP 26 / 周六 / 21:00 */
function decomposeDate(iso: string) {
  const d = new Date(iso);
  const zhDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return {
    monthShort: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()).padStart(2, "0"),
    weekday: zhDays[d.getDay()],
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}
