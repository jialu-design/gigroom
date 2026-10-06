"use client";

import Link from "next/link";
import type { Show } from "@/lib/types";
import { ArtistRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface LineupBlockProps {
  show: Show;
  className?: string;
}

/**
 * ③ LINEUP — 主艺人 / 嘉宾 分级行式列表
 * 角色口径：HEADLINER = 主艺人；SUPPORT = 嘉宾 / SUPPORT。
 * 不使用「主唱」——Artist 可能是乐队、个人或器乐团体。
 */
export function LineupBlock({ show, className }: LineupBlockProps) {
  const artists = show.artists ?? [];
  const headliners = artists.filter((a) => a.role === ArtistRole.HEADLINER);
  const supports = artists
    .filter((a) => a.role !== ArtistRole.HEADLINER)
    .sort((a, b) => a.billing_order - b.billing_order);

  const meta = (artistId: string) => {
    const artist = artists.find((a) => a.artist_id === artistId)?.artist;
    if (!artist) return null;
    const parts = [artist.city, artist.genres.join(" / ")].filter(Boolean);
    return parts.join(" · ") || null;
  };

  return (
    <section className={cn("", className)} aria-label="演出阵容">
      <p className="text-[10px] font-mono tracking-[0.25em] text-text-tertiary mb-4">
        演出阵容
      </p>

      {/* 主艺人 */}
      {headliners.map((a) => (
        <div key={a.id}>
          <span className="inline-block bg-accent-lime text-bg-primary text-[10px] font-bold px-1.5 py-0.5 tracking-widest mb-2">
            主艺人
          </span>
          <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
            <Link
              href={`/artist/${a.artist_id}`}
              className="hover:text-accent-lime transition-colors"
            >
              {a.artist?.name ?? "未命名艺人"}
            </Link>
          </h2>
          {meta(a.artist_id) && (
            <p className="mt-2 text-sm text-text-tertiary">{meta(a.artist_id)}</p>
          )}
        </div>
      ))}

      {/* 嘉宾 / SUPPORT */}
      {supports.length > 0 && (
        <div className="mt-8 space-y-5">
          {supports.map((a) => (
            <div key={a.id}>
              <span className="inline-block border border-border text-text-tertiary text-[10px] font-mono px-1.5 py-0.5 tracking-widest mb-1.5">
                嘉宾 / SUPPORT
              </span>
              <p className="text-lg font-bold">
                <Link
                  href={`/artist/${a.artist_id}`}
                  className="hover:text-accent-lime transition-colors"
                >
                  {a.artist?.name ?? "未命名艺人"}
                </Link>
              </p>
              {meta(a.artist_id) && (
                <p className="text-xs text-text-tertiary mt-0.5">{meta(a.artist_id)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
