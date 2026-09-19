"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Users, ArrowRight, Calendar, MapPin, Home } from "lucide-react";
import type { Show } from "@/lib/types";
import { ArtistRole, UserShowStatus } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { formatShowDateTime, getTicketStatusLabel } from "@/lib/utils/format";

interface FeaturedShowHeroProps {
  show: Show;
  /** 当前用户对此场演出的状态（interested/going/undefined） */
  userStatus?: UserShowStatus;
  /** 点击感兴趣/要去（由上层用 useRequireAuth 做登录拦截） */
  onStatusChange?: (target: UserShowStatus) => void;
  /** 周边兜底推荐时的小字标识，如「上海周边推荐 · 杭州」 */
  nearbyLabel?: string;
  className?: string;
}

/**
 * 首页 Featured Show Hero
 * 左 40% 信息 + 右 60% 演出摄影/海报
 *
 * 视觉语言：
 * - GR · BJ · SEP26 · 001 这类 Show ID metadata（condensed + lime）
 * - 中文名约 60px，英文 condensed 辅助
 * - 主 CTA「要去」lime，「感兴趣」ghost
 * - 票务入口降为次级文字链接
 */
export function FeaturedShowHero({
  show,
  userStatus,
  onStatusChange,
  nearbyLabel,
  className,
}: FeaturedShowHeroProps) {
  const headliner = show.artists?.find(
    (a) => a.role === ArtistRole.HEADLINER
  );
  const supportArtists = show.artists?.filter(
    (a) => a.role !== ArtistRole.HEADLINER
  );
  const artistCn = headliner?.artist?.name ?? show.title ?? "未命名演出";
  const venueName = show.venue?.name ?? "";
  const ticketLabel = getTicketStatusLabel(show.ticket_status);

  // Show ID metadata: GR · BJ · SEP26 · 001
  const metaCode = buildMetaCode(show);

  const interested = userStatus === "interested";
  const going = userStatus === "going";

  // 票务链接：如果 show 有 ticket_url 就用它，否则跳 /shows
  const ticketHref = show.ticket_url || `/shows`;

  return (
    <section
      className={cn(
        "relative overflow-hidden border-b border-border",
        className
      )}
    >
      <div className="container-gigroom py-10 md:py-14 lg:py-16">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10 items-stretch">
          {/* 左侧：演出信息（约 40% — col-span-2） */}
          <div className="lg:col-span-2 flex flex-col justify-center">
            {/* Show ID metadata */}
            <p className="font-condensed text-sm tracking-[0.2em] text-accent-lime uppercase mb-5 select-none">
              {metaCode}
            </p>

            {/* 周边兜底推荐小字标识 */}
            {nearbyLabel && (
              <p className="mb-4 inline-flex w-fit items-center gap-1.5 rounded-sm border border-accent-lime/30 bg-accent-lime/5 px-2 py-1 text-xs text-text-secondary">
                <MapPin size={12} className="text-accent-lime" />
                {nearbyLabel}
              </p>
            )}

            {/* 中文名 */}
            <h1 className="font-bold text-text-primary leading-[0.95] tracking-tight text-[52px] md:text-[60px] lg:text-[64px] mb-1">
              {artistCn}
            </h1>

            {/* 演出标题 / 副标题 */}
            {show.title && show.title !== artistCn && (
              <p className="text-text-secondary text-body md:text-lg mb-6 line-clamp-1">
                {show.title}
              </p>
            )}

            {/* 日期 · 场地 · 城市 */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-text-secondary text-sm md:text-base mb-7">
              <span className="inline-flex items-center gap-1.5 font-condensed text-text-primary text-lg tracking-wide">
                <Calendar size={15} className="text-text-tertiary" />
                {formatShowDateTime(show.date_time)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} className="text-text-tertiary" />
                {venueName || show.city}
                {venueName && ` · ${show.city}`}
              </span>
              {show.going_count !== undefined && (
                <span className="inline-flex items-center gap-1.5 text-text-tertiary">
                  <Users size={14} />
                  <span className="font-condensed text-text-primary text-base tracking-wide">
                    {show.going_count.toLocaleString()}
                  </span>
                  要去
                </span>
              )}
            </div>

            {/* 支持乐队（紧凑） */}
            {supportArtists && supportArtists.length > 0 && (
              <p className="text-text-tertiary text-xs mb-6 line-clamp-1">
                {supportArtists
                  .map((sa) => sa.artist?.name)
                  .filter(Boolean)
                  .join(" + ")}
              </p>
            )}

            {/* 主 CTA：两个并列按钮，加大字体、减小留白 */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href={`/show/${show.id}#room`}
                className="inline-flex items-center gap-2 bg-accent-lime text-bg-primary hover:bg-accent-lime-hover transition-colors px-5 h-11 text-base font-medium rounded-sm"
              >
                <Home size={17} strokeWidth={1.5} />
                进入观演小屋
              </Link>
              <Link
                href="/shows"
                className="inline-flex items-center gap-1.5 border border-border text-text-primary hover:border-accent-lime hover:text-accent-lime transition-colors px-5 h-11 text-base font-medium rounded-sm"
              >
                发现更多演出
                <ArrowRight size={16} />
              </Link>
            </div>

            {/* 状态操作：要去 / 感兴趣 — 降为次级，不抢主 CTA 视觉 */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => onStatusChange?.(UserShowStatus.GOING)}
                className={cn(
                  "h-8 px-3 rounded-sm text-xs font-medium transition-colors",
                  going
                    ? "border border-accent-lime text-accent-lime bg-accent-lime/10"
                    : "border border-border text-text-secondary hover:text-text-primary hover:border-border-light"
                )}
              >
                {going ? "✓ 已要去" : "要去"}
              </button>
              <button
                type="button"
                onClick={() => onStatusChange?.(UserShowStatus.INTERESTED)}
                className={cn(
                  "h-8 px-3 rounded-sm text-xs font-medium transition-colors inline-flex items-center gap-1.5",
                  interested
                    ? "border border-accent-lime text-accent-lime bg-accent-lime/10"
                    : "border border-border text-text-secondary hover:text-text-primary hover:border-border-light"
                )}
              >
                <Heart size={13} className={interested ? "fill-accent-lime text-accent-lime" : ""} />
                {interested ? "已感兴趣" : "感兴趣"}
              </button>

              {/* 票务次级链接 */}
              {ticketLabel && (
                <Link
                  href={ticketHref}
                  target={show.ticket_url ? "_blank" : undefined}
                  rel={show.ticket_url ? "noopener noreferrer" : undefined}
                  className="ml-1 text-xs text-text-tertiary hover:text-text-secondary transition-colors underline-offset-4 hover:underline"
                >
                  查看票务 · {ticketLabel}
                </Link>
              )}
            </div>
          </div>

          {/* 右侧：演出摄影 / 海报（约 60% — col-span-3） */}
          <div className="lg:col-span-3 relative">
            <Link
              href={`/show/${show.id}`}
              className="block group relative aspect-[4/3] lg:aspect-[5/4] overflow-hidden rounded-sm bg-bg-secondary"
            >
              {/* Hero 使用专门的横版演出摄影，卡片用竖版 show-{01..06}.jpg */}
              <Image
                src="/images/shows/hero-01.jpg"
                alt={`${artistCn} 演出海报`}
                fill
                sizes="(max-width: 768px) 92vw, 60vw"
                priority
                className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              />
              {/* 暗角渐变，让底部能看清 metadata */}
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-bg-primary/70 via-bg-primary/20 to-transparent" />

              {/* 角标：演出日期 condensed */}
              <div className="absolute bottom-4 right-5 text-right">
                <p className="font-condensed text-xs text-text-tertiary tracking-[0.25em] uppercase">
                  {formatDateMeta(show.date_time)}
                </p>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

/**
 * 构造 Show ID metadata：GR · BJ · SEP26 · 001
 * 城市代码：取中文名首字拼音首字母（fallback 到前两位）
 */
function buildMetaCode(show: Show): string {
  const d = new Date(show.date_time);
  const monthShort = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  const day = String(d.getDate()).padStart(2, "0");

  // 城市缩写：取中文城市名的前 2 字拼音首字母——简单 fallback 用首字 + 尾字
  const cityShort = show.city.slice(0, 2); // 北京、上海、成都

  // 序号占位：基于月份 hash
  const num = String((d.getMonth() + 1) * 17 + d.getDate()).padStart(3, "0").slice(-3);

  return `GR · ${cityShort} · ${monthShort}${day} · ${num}`;
}

/** 图片角标用：SEP 26 / 2026 */
function formatDateMeta(dateTime: string): string {
  const d = new Date(dateTime);
  const monthShort = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  return `${monthShort} ${d.getDate()} · ${d.getFullYear()}`;
}
