"use client";

import * as React from "react";
import type { Show } from "@/lib/types";
import { classifyShows } from "@/lib/utils/showState";
import { ShowCardCompact } from "@/components/show/ShowCardCompact";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/utils";

interface ArtistShowsProps {
  shows: Show[];
}

type Tab = "upcoming" | "past";

/**
 * 乐队演出列表（即将演出 / 过往演出 二级 Tab）
 *
 * 分类唯一口径：utils/showState.classifyShows，禁止散落 new Date() 判断。
 * - 即将演出：仅 upcoming 分组，日期升序
 * - 过往演出：已结束 + 已取消 + 已延期（延期/取消不进"即将"），日期倒序
 * 列表项复用 ShowCardCompact，点击进入 /show/[id]。
 */
export function ArtistShows({ shows }: ArtistShowsProps) {
  const { upcoming, past } = React.useMemo(() => {
    const c = classifyShows(shows);
    return {
      upcoming: c.upcoming,
      past: [...c.ended, ...c.postponed, ...c.cancelled],
    };
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
        <EmptyState
          title={
            tab === "upcoming"
              ? "暂时没有即将到来的演出"
              : "暂时没有过往演出记录"
          }
        />
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
