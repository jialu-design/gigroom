"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Users, Calendar, MapPin, ExternalLink } from "lucide-react";
import type { Show, UserShowStatus } from "@/lib/types";
import { ShowTicketStatus, ArtistRole, UserShowStatus as UserShowStatusEnum } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { getEffectiveShowState } from "@/lib/utils/showState";
import {
  formatShowDateTime,
  getTicketStatusLabel,
  getTicketStatusBadgeVariant,
  getShowPosterFallback,
} from "@/lib/utils/format";

interface ShowHeroProps {
  show: Show;
  userShowStatus?: UserShowStatus;
  onStatusChange?: (status: UserShowStatus) => void;
  className?: string;
}

/**
 * ShowDetail Hero 区
 * 1. 大幅演出海报（居中/偏左，宽55-65%，有白边）
 * 2. 乐队名/演出名（hero 字体）
 * 3. 日期时间、城市·Venue
 * 4. 票价
 * 5. 状态Badge
 * 6. 人数统计
 * 7. 状态按钮（感兴趣/我要去）
 * 8. 购票按钮（根据 ticket_status 变化）
 *
 * 注意：观演小屋入口统一在下方 ShowRoomFrame（id="room"），此处不再重复提供。
 */
export function ShowHero({
  show,
  userShowStatus,
  onStatusChange,
  className,
}: ShowHeroProps) {
  const state = React.useMemo(() => getEffectiveShowState(show), [show]);
  const headliner = show.artists?.find(
    (a) => a.role === ArtistRole.HEADLINER
  );
  const supportArtists = show.artists?.filter(
    (a) => a.role !== ArtistRole.HEADLINER
  );
  const displayName = headliner?.artist?.name ?? show.title ?? "未命名演出";

  const ticketLabel = getTicketStatusLabel(show.ticket_status);
  const ticketVariant = getTicketStatusBadgeVariant(show.ticket_status);

  const interested = userShowStatus === "interested";
  const going = userShowStatus === "going";

  // P7.1：状态按钮（感兴趣/我要去）统一交给上层 onStatusChange 处理，
  // 由页面通过 useRequireAuth 做登录拦截 + pending action。
  const handleStatusClick = (targetStatus: UserShowStatus) => {
    onStatusChange?.(targetStatus);
  };

  /** 根据状态决定购票按钮（四态互斥，口径来自 state.bucket） */
  const renderTicketButton = () => {
    if (state.bucket === "cancelled") {
      return (
        <div className="w-full rounded-md border border-border bg-bg-secondary p-4 text-center text-text-secondary">
          <span className="text-sm">本场演出已取消</span>
        </div>
      );
    }
    if (state.bucket === "postponed") {
      return (
        <div className="w-full rounded-md border border-accent-yellow/40 bg-accent-yellow/10 p-4 text-center">
          <span className="text-sm text-accent-yellow">
            演出延期，具体时间另行通知
          </span>
        </div>
      );
    }
    // 已结束（含状态字段滞后、日期已过的演出）：不提供购票
    if (state.bucket === "ended") {
      return (
        <div className="w-full rounded-md border border-border bg-bg-secondary p-4 text-center text-text-tertiary">
          <span className="text-sm">演出已结束，感谢到场的每一位</span>
        </div>
      );
    }

    // UPCOMING
    if (show.ticket_status === ShowTicketStatus.SOLD_OUT) {
      return (
        <div className="w-full rounded-md border border-border bg-bg-secondary p-4 text-center">
          <span className="text-sm text-text-secondary">
            全票售罄 · 可进入观演小屋找搭子或查看是否有转票
          </span>
        </div>
      );
    }
    if (show.ticket_status === ShowTicketStatus.COMING_SOON) {
      return (
        <Button
          variant="secondary"
          size="lg"
          className="w-full justify-center"
          disabled
        >
          {show.ticket_platform
            ? `即将开票 · 购票平台：${show.ticket_platform}`
            : "即将开票"}
        </Button>
      );
    }
    // ON_SALE
    if (show.ticket_url) {
      return (
        <a
          href={show.ticket_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full"
        >
          <Button variant="primary" size="lg" className="w-full justify-center">
            {show.ticket_platform
              ? `去${show.ticket_platform}购票`
              : "去购票"}
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
    <div className={cn("grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-8 lg:gap-12", className)}>
      {/* 左侧海报 */}
      <div className="lg:w-[55%] xl:w-[58%] 2xl:w-[62%]">
        <div className="relative w-full aspect-[3/4] lg:aspect-[4/5] overflow-hidden rounded-md bg-bg-secondary poster-border shadow-lg">
          <Image
            src={show.poster_url || getShowPosterFallback(show.id)}
            alt={displayName}
            fill
            sizes="(max-width: 1024px) 100vw, 60vw"
            className={cn("object-cover", state.isInactive && "opacity-60 grayscale")}
            priority
          />
          {/* DEMO 角标 */}
          {show.is_demo && (
            <span className="absolute top-3 right-3 bg-bg-primary/80 text-accent-yellow text-xs px-2 py-1 rounded-sm border border-accent-yellow/40 font-mono tracking-wider">
              DEMO
            </span>
          )}
          {/* 状态 Badge 叠加在海报下方 */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-bg-primary/90 to-transparent p-4">
            <div className="flex flex-wrap items-center gap-2">
              {ticketLabel && (
                <Badge variant={ticketVariant} size="md">
                  {ticketLabel}
                </Badge>
              )}
              {/* 非 upcoming 一律展示归一后的状态标签（含状态滞后→已结束） */}
              {state.bucket !== "upcoming" && (
                <Badge variant={state.badgeVariant} size="md">
                  {state.label}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 右侧信息 */}
      <div className="flex flex-col">
        {/* 标题区 */}
        <div className="mb-6">
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight tracking-tight text-text-primary mb-3">
            {headliner?.artist ? (
              <Link
                href={`/artist/${headliner.artist_id}`}
                className="hover:text-accent-lime transition-colors"
              >
                {displayName}
              </Link>
            ) : (
              displayName
            )}
          </h1>
          {supportArtists && supportArtists.length > 0 && (
            <p className="text-lg text-text-secondary">
              {supportArtists
                .map((sa) =>
                  sa.artist ? (
                    <Link
                      key={sa.artist_id}
                      href={`/artist/${sa.artist_id}`}
                      className="hover:text-accent-lime transition-colors"
                    >
                      {sa.artist.name}
                    </Link>
                  ) : null
                )
                .filter(Boolean)
                .reduce<React.ReactNode[]>((acc, el, i) => {
                  if (i > 0) acc.push(" + ");
                  acc.push(el);
                  return acc;
                }, [])}
            </p>
          )}
        </div>

        {/* 日期/地点 */}
        <div className="mb-6 space-y-3 text-text-primary">
          <div className="flex items-center gap-2 text-lg">
            <Calendar size={20} className="text-text-tertiary" />
            <span>{formatShowDateTime(show.date_time)}</span>
          </div>
          <div className="flex items-center gap-2 text-lg">
            <MapPin size={20} className="text-text-tertiary" />
            <span>
              {show.city}
              {show.venue?.name && ` · ${show.venue.name}`}
            </span>
          </div>
        </div>

        {/* 票价 */}
        {show.price_text && (
          <div className="mb-6 border-l-2 border-accent-lime/40 pl-4 py-2">
            <p className="text-xl font-semibold text-text-primary">
              {show.price_text}
            </p>
          </div>
        )}

        {/* 人数统计 */}
        <div className="mb-8 flex items-center gap-6 text-text-tertiary">
          <span className="inline-flex items-center gap-1.5 text-body">
            <Heart size={16} />
            <span className="text-text-primary font-medium">
              {show.interested_count ?? 0}
            </span>
            <span className="text-sm">感兴趣</span>
          </span>
          <span className="inline-flex items-center gap-1.5 text-body">
            <Users size={16} />
            <span className="text-text-primary font-medium">
              {show.going_count ?? 0}
            </span>
            <span className="text-sm">要去</span>
          </span>
        </div>

        {/* 状态按钮（interested + going） */}
        <div className="mb-6 flex gap-3">
          <Button
            variant={interested ? "lime" : "secondary"}
            size="md"
            onClick={() => handleStatusClick(UserShowStatusEnum.INTERESTED)}
            className="flex-1"
          >
            <Heart size={16} className={interested ? "fill-current" : ""} />
            {interested ? "已感兴趣" : "感兴趣"}
          </Button>
          <Button
            variant={going ? "primary" : "secondary"}
            size="md"
            onClick={() => handleStatusClick(UserShowStatusEnum.GOING)}
            className="flex-1"
          >
            <Users size={16} />
            {going ? "我要去" : "我要去"}
          </Button>
        </div>

        {/* 购票按钮 */}
        <div className="mb-8">{renderTicketButton()}</div>
      </div>
    </div>
  );
}
