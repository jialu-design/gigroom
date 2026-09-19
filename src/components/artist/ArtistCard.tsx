"use client";

import Link from "next/link";
import Image from "next/image";
import type { Artist } from "@/lib/types";
import { Tag } from "@/components/ui/Badge";
import { FollowButton } from "./FollowButton";
import { cn } from "@/lib/utils";

interface ArtistCardProps {
  artist: Artist;
  className?: string;
}

/**
 * 乐队卡片（/artists 列表用）
 *
 * 结构：内容区 Link（封面+名+城市+风格）+ FollowButton 独立区域，
 * 避免嵌套交互元素。关注状态来自 FollowButton 内部读取的统一 store。
 */
export function ArtistCard({ artist, className }: ArtistCardProps) {
  return (
    <div
      className={cn(
        "group flex flex-col rounded-md border border-border bg-bg-secondary p-3 transition-colors hover:border-border-light",
        className
      )}
    >
      <Link href={`/artist/${artist.id}`} className="block flex-1">
        {/* 方形封面 */}
        <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-bg-tertiary poster-border">
          {artist.cover_url ? (
            <Image
              src={artist.cover_url}
              alt={artist.name}
              fill
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-text-tertiary text-2xl font-bold">
              {artist.name.charAt(0)}
            </div>
          )}
        </div>

        {/* 乐队名 */}
        <h3 className="mt-3 text-base font-semibold text-text-primary line-clamp-1 group-hover:text-accent-lime transition-colors">
          {artist.name}
        </h3>

        {/* 城市 / 国家 */}
        {(artist.city || artist.country) && (
          <p className="mt-1 text-xs text-text-tertiary line-clamp-1">
            {[artist.city, artist.country].filter(Boolean).join(" · ")}
          </p>
        )}

        {/* 风格标签 */}
        {artist.genres.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {artist.genres.slice(0, 3).map((g) => (
              <Tag key={g} size="sm">
                {g}
              </Tag>
            ))}
          </div>
        )}
      </Link>

      {/* FollowButton 独立区域（不嵌套在 Link 内） */}
      <div className="mt-3">
        <FollowButton
          artistId={artist.id}
          artistName={artist.name}
          size="sm"
          className="w-full"
        />
      </div>
    </div>
  );
}
