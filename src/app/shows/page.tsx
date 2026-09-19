"use client";

import { useEffect, useState, useMemo } from "react";
import { getShows } from "@/lib/api/shows";
import { useCityStore } from "@/lib/stores/useCityStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { TabBar } from "@/components/ui/TabBar";
import { Select } from "@/components/ui/Select";
import { ShowListCard } from "@/components/show/ShowListCard";
import { CITIES, GENRES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ShowStatus, type Show } from "@/lib/types";
import { getMonthKey, getMonthLabel } from "@/lib/utils/format";
import { getShowLifecycle, isShowDatePassed } from "@/lib/utils/showLifecycle";

type TabKey = "all" | "following";

export default function ShowsPage() {
  const storeCity = useCityStore((s) => s.city);
  const setCity = useCityStore((s) => s.setCity);
  const followedArtistIds = useUserStore((s) => s.followedArtistIds);
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);

  const [tab, setTab] = useState<TabKey>("all");
  const [cityFilter, setCityFilter] = useState<string>(storeCity);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [shows, setShows] = useState<Show[]>([]);
  const [loading, setLoading] = useState(true);

  // 日期范围计算
  const dateRange = useMemo(() => {
    const now = new Date();
    switch (dateFilter) {
      case "this_month": {
        const from = new Date(now.getFullYear(), now.getMonth(), 1);
        const to = new Date(
          now.getFullYear(),
          now.getMonth() + 1,
          0,
          23,
          59,
          59
        );
        return { from: from.toISOString(), to: to.toISOString() };
      }
      case "next_month": {
        const from = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const to = new Date(
          now.getFullYear(),
          now.getMonth() + 2,
          0,
          23,
          59,
          59
        );
        return { from: from.toISOString(), to: to.toISOString() };
      }
      case "three_months": {
        const from = now;
        const to = new Date(
          now.getFullYear(),
          now.getMonth() + 3,
          now.getDate()
        );
        return { from: from.toISOString(), to: to.toISOString() };
      }
      default:
        return { from: undefined, to: undefined };
    }
  }, [dateFilter]);

  // 加载数据（城市 + 时间筛选在 API 层）
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const result = await getShows({
        city: cityFilter || undefined,
        date_from: dateRange.from,
        date_to: dateRange.to,
        limit: 100,
      });
      if (cancelled) return;
      setShows(result.data);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [cityFilter, dateRange.from, dateRange.to]);

  // 前端筛选：风格多选 + Tab
  const filteredShows = useMemo(() => {
    let result = [...shows];

    // 风格多选
    if (selectedGenres.length > 0) {
      result = result.filter((s) =>
        s.artists?.some((sa) =>
          sa.artist?.genres.some((g) => selectedGenres.includes(g))
        )
      );
    }

    // "我关注的" Tab
    if (tab === "following") {
      result = result.filter((s) =>
        s.artists?.some((sa) => followedArtistIds.includes(sa.artist_id))
      );
    }

    return result;
  }, [shows, selectedGenres, tab, followedArtistIds]);

  // 即将上演 / 已结束分组（日期驱动：status 滞后但日期已过的演出归入历史；
  // 已取消演出一律不进"即将上演"）
  const { upcomingShows, pastShows } = useMemo(() => {
    const upcoming: Show[] = [];
    const past: Show[] = [];
    filteredShows.forEach((show) => {
      const cancelled = show.status === ShowStatus.CANCELLED;
      const deadPostponed =
        show.status === ShowStatus.POSTPONED && isShowDatePassed(show);
      if (getShowLifecycle(show).hasEnded || cancelled || deadPostponed) {
        past.push(show);
      } else {
        upcoming.push(show);
      }
    });
    // 即将上演按日期升序（最近优先），已结束按日期倒序（最近结束在前）
    upcoming.sort((a, b) => a.date_time.localeCompare(b.date_time));
    past.sort((a, b) => b.date_time.localeCompare(a.date_time));
    return { upcomingShows: upcoming, pastShows: past };
  }, [filteredShows]);

  // 即将上演按月份分组
  const groupedShows = useMemo(() => {
    const groups: Record<string, Show[]> = {};
    upcomingShows.forEach((show) => {
      const key = getMonthKey(show.date_time);
      if (!groups[key]) groups[key] = [];
      groups[key].push(show);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [upcomingShows]);

  // 已结束按月份分组（倒序）
  const groupedPastShows = useMemo(() => {
    const groups: Record<string, Show[]> = {};
    pastShows.forEach((show) => {
      const key = getMonthKey(show.date_time);
      if (!groups[key]) groups[key] = [];
      groups[key].push(show);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [pastShows]);

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre)
        ? prev.filter((g) => g !== genre)
        : [...prev, genre]
    );
  };

  const handleCityChange = (value: string) => {
    setCityFilter(value);
    if (value) setCity(value);
  };

  const cityOptions = [
    { value: "", label: "全部城市" },
    ...CITIES.map((c) => ({ value: c, label: c })),
  ];

  const dateOptions = [
    { value: "all", label: "全部时间" },
    { value: "this_month", label: "本月" },
    { value: "next_month", label: "下月" },
    { value: "three_months", label: "未来三月" },
  ];

  const tabs = [
    { key: "all", label: "全部" },
    { key: "following", label: "我关注的" },
  ];

  return (
    <main className="container-gigroom py-8 md:py-12">
      <h1 className="text-h1 mb-6 text-text-primary">演出</h1>

      {/* Tab: 全部 / 我关注的 */}
      <TabBar
        tabs={tabs}
        activeKey={tab}
        onChange={(k) => setTab(k as TabKey)}
        className="mb-6"
      />

      {/* 筛选行 */}
      <div className="mb-8 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Select
            options={cityOptions}
            value={cityFilter}
            onChange={handleCityChange}
            className="sm:w-40"
          />
          <Select
            options={dateOptions}
            value={dateFilter}
            onChange={setDateFilter}
            className="sm:w-36"
          />
        </div>

        {/* 风格多选 */}
        <div className="flex flex-wrap gap-2">
          {GENRES.map((genre) => (
            <button
              key={genre}
              onClick={() => toggleGenre(genre)}
              className={cn(
                "h-7 px-3 text-sm rounded-sm border transition-colors duration-150",
                selectedGenres.includes(genre)
                  ? "bg-accent-lime/20 text-accent-lime border-accent-lime"
                  : "bg-bg-tertiary text-text-secondary border-border hover:border-border-light"
              )}
            >
              {genre}
            </button>
          ))}
        </div>
      </div>

      {/* 演出列表 */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="h-20 rounded-md bg-bg-secondary animate-pulse"
            />
          ))}
        </div>
      ) : tab === "following" && !isLoggedIn ? (
        <div className="rounded-md border border-dashed border-border p-12 text-center">
          <p className="text-text-tertiary text-sm">
            登录后可以查看你关注乐队的演出
          </p>
        </div>
      ) : groupedShows.length > 0 || groupedPastShows.length > 0 ? (
        <div className="space-y-10">
          {/* 即将上演（按月份升序） */}
          {groupedShows.length > 0 && (
            <div className="space-y-8">
              <h2 className="text-xl font-bold text-text-primary tracking-tight">
                即将上演
              </h2>
              {groupedShows.map(([monthKey, monthShows]) => (
                <div key={monthKey}>
                  <h3 className="mb-3 text-lg font-bold text-text-primary tracking-tight">
                    {getMonthLabel(monthShows[0].date_time)}
                  </h3>
                  <div>
                    {monthShows.map((show) => (
                      <ShowListCard key={show.id} show={show} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 已结束 / 历史（按月份倒序） */}
          {groupedPastShows.length > 0 && (
            <div className="space-y-8">
              <h2 className="text-xl font-bold text-text-primary tracking-tight">
                已结束
              </h2>
              {groupedPastShows.map(([monthKey, monthShows]) => (
                <div key={monthKey}>
                  <h3 className="mb-3 text-lg font-bold text-text-tertiary tracking-tight">
                    {getMonthLabel(monthShows[0].date_time)}
                  </h3>
                  <div>
                    {monthShows.map((show) => (
                      <ShowListCard key={show.id} show={show} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border p-12 text-center">
          <p className="text-text-tertiary text-sm">
            {tab === "following"
              ? "你关注的乐队暂时没有演出安排"
              : "没有符合条件的演出，试试调整筛选条件"}
          </p>
        </div>
      )}
    </main>
  );
}
