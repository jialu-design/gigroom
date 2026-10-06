"use client";

import type { FanImpression } from "@/lib/types";
import { cn } from "@/lib/utils";

interface FanImpressionsBlockProps {
  impressions: FanImpression[];
  className?: string;
}

/**
 * ⑥ 乐迷印象 — editorial 内容层
 * 引文式排版；全部为 DEMO 虚构短评（is_demo 恒 true），
 * 每条恒显 [DEMO 虚构] 标记；about=past_live 附「观演记录」小标。
 * 空数组整节不渲染。
 */
export function FanImpressionsBlock({
  impressions,
  className,
}: FanImpressionsBlockProps) {
  if (impressions.length === 0) return null;

  return (
    <section className={cn("", className)} aria-label="乐迷印象">
      <p className="text-[10px] font-mono tracking-[0.25em] text-text-tertiary mb-4">
        乐迷印象
      </p>

      <div className="space-y-6">
        {impressions.map((fi) => (
          <blockquote
            key={fi.id}
            className="border-l-2 border-accent-lime/60 pl-4"
          >
            <p className="text-base leading-relaxed text-text-primary">
              「{fi.content}」
            </p>
            <p className="mt-2 flex items-center gap-2 text-[11px] text-text-tertiary">
              {fi.about === "past_live" && <span>观演记录</span>}
              <span className="border border-accent-yellow/40 text-accent-yellow text-[10px] px-1 py-px font-mono">
                DEMO 虚构
              </span>
            </p>
          </blockquote>
        ))}
      </div>
    </section>
  );
}
