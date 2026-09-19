"use client";

import Link from "next/link";
import Image from "next/image";
import type { Artist } from "@/lib/types";
import { FollowButton } from "./FollowButton";
import { cn } from "@/lib/utils";

interface ArtistCardSmallProps {
  artist: Artist;
  className?: string;
}

/**
 * 乐队小卡片（首页「发现乐队」横向滚动用）
 * 小方形封面 + 乐队名 + 小型 FollowButton。
 * 关注状态与 ArtistCard / ArtistHeader 共用 FollowButton → 同一 store 来源。
 */
export function ArtistCardSmall({ artist, className }: ArtistCardSmallProps) {
  return (
    <div
      className={cn(
        "group flex w-24 shrink-0 flex-col items-center text-center",
        className
      )}
    >
      <Link href={`/artist/${artist.id}`} className="block w-full">
        <div className="relative h-24 w-24 overflow-hidden rounded-full bg-bg-secondary poster-border">
          {artist.cover_url ? (
            <Image
              src={artist.cover_url}
              alt={artist.name}
              fill
              sizes="96px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-text-tertiary text-lg font-bold">
              {artist.name.charAt(0)}
            </div>
          )}
        </div>
        <h4 className="mt-2 text-sm font-medium text-text-primary group-hover:text-accent-lime transition-colors line-clamp-1 w-full">
          {artist.name}
        </h4>
        {artist.city && (
          <p className="mt-0.5 text-xs text-text-tertiary line-clamp-1">
            {artist.city}
          </p>
        )}
      </Link>

      <FollowButton
        artistId={artist.id}
        artistName={artist.name}
        size="sm"
        className="mt-2 w-full"
      />
    </div>
  );
}
