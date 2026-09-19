"use client";

import * as React from "react";
import type { Show } from "@/lib/types";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";
import { ShowCardCompact } from "@/components/show/ShowCardCompact";
import { cn } from "@/lib/utils";

interface ArtistShowsProps {
  shows: Show[];
}

type Tab = "upcoming" | "past";

/**
 * 乐队演出列表（即将演出 / 过往演出 二级 Tab）
 *
 * 分类必须基于 getShowLifecycle，禁止散落 new Date() 判断。
 * - 即将演出：!hasEnded（含 upcoming/postponed/cancelled，cancelled 仍展示）
 *   按时间升序，最近一场最前
 * - 过往演出：hasEnded，按时间倒序，最近结束的最前
 * 列表项复用 ShowCardCompact，点击进入 /show/[id]。
 */
export function ArtistShows({ shows }: ArtistShowsProps) {
  const { upcoming, past } = React.useMemo(() => {
    const up: Show[] = [];
    const pa: Show[] = [];
    for (const show of shows) {
      const lc = getShowLifecycle(show);
      if (lc.hasEnded) pa.push(show);
      else up.push(show);
    }
    up.sort((a, b) => a.date_time.localeCompare(b.date_time));
    pa.sort((a, b) => b.date_time.localeCompare(a.date_time));
    return { upcoming: up, past: pa };
  }, [shows]);

  const [tab, setTab] = React.useState<Tab>("upcoming");

  // 若没有即将演出，默认切到过往，避免空屏
  React.useEffect(() => {
    if (tab === "upcoming" && upcoming.length === 0 && past.length > 0) {
      setTab("past");
    }
  }, [tab, upcoming.length, past.length]);

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "upcoming", label: "即将演出", count: upcoming.length },
    { key: "past", label: "过往演出", count: past.length },
  ];

  const list = tab === "upcoming" ? upcoming : past;

  return (
    <section className="mt-12">
      <div className="mb-6 flex gap-6 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "relative pb-3 text-sm font-medium transition-colors",
              tab === t.key
                ? "text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            )}
          >
            {t.label}
            <span className="ml-1.5 text-xs text-text-tertiary">
              {t.count}
            </span>
            {tab === t.key && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent-lime" />
            )}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-10 text-center">
          <p className="text-text-tertiary text-sm">
            {tab === "upcoming"
              ? "暂时没有即将到来的演出"
              : "暂时没有过往演出记录"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {list.map((show) => (
            <ShowCardCompact key={show.id} show={show} />
          ))}
        </div>
      )}
    </section>
  );
}
