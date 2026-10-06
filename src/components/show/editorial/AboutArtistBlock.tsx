"use client";

import type { ArtistEditorial, Show } from "@/lib/types";
import { ArtistRole } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AboutArtistBlockProps {
  show: Show;
  /** artist_id → 内容资产包（仅含已配置样本） */
  editorials: Map<string, ArtistEditorial>;
  className?: string;
}

/**
 * ④ ABOUT ARTIST — editorial 内容层
 * 主艺人：eyebrow + 80–150 字 bio_long + 官方账号/事实来源；
 * 嘉宾有 editorial 时收进「关于嘉宾」折叠行。
 * 主艺人与嘉宾均无 editorial 时整节不渲染，绝不显示 registry demo 占位 bio。
 */
export function AboutArtistBlock({
  show,
  editorials,
  className,
}: AboutArtistBlockProps) {
  const artists = show.artists ?? [];
  const headliner = artists.find((a) => a.role === ArtistRole.HEADLINER);
  const supports = artists
    .filter((a) => a.role !== ArtistRole.HEADLINER)
    .sort((a, b) => a.billing_order - b.billing_order);

  const headlinerEditorial = headliner
    ? editorials.get(headliner.artist_id)
    : undefined;
  const supportEditorials = supports
    .map((sa) => ({ showArtist: sa, editorial: editorials.get(sa.artist_id) }))
    .filter((x) => x.editorial != null);

  if (!headlinerEditorial && supportEditorials.length === 0) return null;

  return (
    <section className={cn("", className)} aria-label="关于艺人">
      {headlinerEditorial && (
        <>
          <p className="text-[10px] font-mono tracking-[0.25em] text-text-tertiary mb-4">
            关于艺人
          </p>
          <p className="text-base leading-relaxed text-text-secondary">
            {headlinerEditorial.bio_long}
          </p>
          {/* 官方账号 / 事实来源 */}
          <div className="mt-4 pt-3 border-t border-border space-y-1.5">
            {headlinerEditorial.official_sources.map((src) => (
              <p key={src.url} className="text-xs text-text-tertiary">
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent-lime transition-colors"
                >
                  {src.account}
                </a>
                {src.verified && (
                  <span className="ml-2 text-accent-lime text-[10px] font-mono">
                    官方
                  </span>
                )}
              </p>
            ))}
            {headlinerEditorial.bio_sources.length > 0 && (
              <p className="text-[11px] text-text-tertiary/80">
                简介事实来源：
                {headlinerEditorial.bio_sources.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-accent-lime transition-colors"
                  >
                    [{i + 1}]{" "}
                  </a>
                ))}
              </p>
            )}
          </div>
        </>
      )}

      {/* 关于嘉宾（有 editorial 时折叠展示） */}
      {supportEditorials.map(({ showArtist, editorial }) => (
        <details
          key={showArtist.id}
          className={cn(
            "border-t border-border",
            headlinerEditorial ? "mt-5 pt-4" : "pt-4"
          )}
        >
          <summary className="cursor-pointer text-sm font-bold text-text-primary hover:text-accent-lime transition-colors">
            关于嘉宾 · {showArtist.artist?.name ?? "未命名艺人"}
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-text-secondary">
            {editorial!.bio_long}
          </p>
        </details>
      ))}
    </section>
  );
}
