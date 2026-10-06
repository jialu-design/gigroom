"use client";

import Image from "next/image";
import type { EditorialPhoto } from "@/lib/types";
import { cn } from "@/lib/utils";

export type CuratedPhoto = EditorialPhoto & { url: string };

interface PastPhotosBlockProps {
  /** 已策展现场照（url 非空的 live 图） */
  photos: CuratedPhoto[];
  className?: string;
}

/**
 * ⑤ PAST LIVE PHOTOS — 过往现场摄影
 * Desktop：2 列网格（首张跨列）；Mobile：横向 snap 滑动条。
 * 每张下沿署名（账号/摄影师），节尾统一 DEMO reference 声明。
 * photos 为空时整节不渲染（不做空盒骨架）。
 */
export function PastPhotosBlock({ photos, className }: PastPhotosBlockProps) {
  if (photos.length === 0) return null;

  return (
    <section className={cn("", className)} aria-label="过往现场摄影">
      <p className="text-[10px] font-mono tracking-[0.25em] text-text-tertiary mb-4">
        过往现场
      </p>

      <div className="flex gap-4 overflow-x-auto snap-x snap-mandatory pb-2 -mx-4 px-4 lg:mx-0 lg:px-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:pb-0">
        {photos.map((p, i) => (
          <figure
            key={p.id}
            className={cn(
              "snap-start shrink-0 w-[78%] lg:w-auto lg:shrink",
              i === 0 && "lg:col-span-2"
            )}
          >
            <div className="relative aspect-[3/2] overflow-hidden bg-bg-secondary">
              <Image
                src={p.url}
                alt={p.caption ?? "过往现场摄影"}
                fill
                sizes="(max-width: 1024px) 78vw, 40vw"
                className="object-cover"
              />
            </div>
            <figcaption className="mt-2 text-[11px] font-mono text-text-tertiary">
              {p.source_account}
              {p.photographer ? ` · 摄影 ${p.photographer}` : ""}
              {p.caption ? ` · ${p.caption}` : ""}
            </figcaption>
          </figure>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-text-tertiary/80">
        图片为 DEMO reference，未获商用授权
      </p>
    </section>
  );
}
