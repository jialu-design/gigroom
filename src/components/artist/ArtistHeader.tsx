"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Artist } from "@/lib/types";
import { Tag } from "@/components/ui/Badge";
import { getGenreLabel } from "@/lib/constants";
import { FollowButton } from "./FollowButton";

interface ArtistHeaderProps {
  artist: Artist;
}

/**
 * 乐队详情 Hero
 * 大幅封面（带轻微渐变）→ 名称 → 城市/国家 → 风格 → 简介 → Actions
 * Actions：FollowButton（统一关注状态）+ 网易云外链（无则隐藏，不渲染空按钮）
 */
export function ArtistHeader({ artist }: ArtistHeaderProps) {
  const netease = artist.external_links?.netease;

  return (
    <header>
      {/* 返回（历史只能右滑返回，补上显式入口） */}
      <Link
        href="/artists"
        className="inline-flex items-center gap-1.5 mb-4 text-sm text-text-tertiary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={15} />
        返回艺人列表
      </Link>

      {/* 大幅封面 */}
      <div className="relative w-full h-[240px] sm:h-[300px] md:h-[380px] rounded-md overflow-hidden bg-bg-secondary poster-border">
        {artist.cover_url ? (
          <Image
            src={artist.cover_url}
            alt={artist.name}
            fill
            sizes="100vw"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full items-center justify-center text-text-tertiary text-5xl font-bold">
            {artist.name.charAt(0)}
          </div>
        )}
        {/* 轻微暗色渐变，不遮挡整图 */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>

      {/* 名称 */}
      <h1 className="mt-6 text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight text-text-primary">
        {artist.name}
      </h1>

      {/* 城市 / 国家 */}
      {(artist.city || artist.country) && (
        <p className="mt-2 text-text-secondary text-body">
          {[artist.city, artist.country].filter(Boolean).join(" · ")}
        </p>
      )}

      {/* Genres */}
      {artist.genres.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {artist.genres.map((g) => (
            <Tag key={g} size="md">
              {getGenreLabel(g)}
            </Tag>
          ))}
        </div>
      )}

      {/* Bio */}
      {artist.bio && (
        <p className="mt-5 text-text-secondary text-body leading-relaxed max-w-2xl">
          {artist.bio}
        </p>
      )}

      {/* Actions */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <FollowButton artistId={artist.id} artistName={artist.name} size="md" />
        {netease && (
          <a
            href={netease}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-4 rounded-sm border border-border bg-bg-tertiary text-text-secondary text-sm hover:border-border-light hover:text-text-primary transition-colors"
          >
            在网易云音乐听
            <ExternalLink size={14} />
          </a>
        )}
      </div>
    </header>
  );
}
