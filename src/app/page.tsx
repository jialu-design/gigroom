"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { getRecommendedShows, getShows, getNearbyUpcomingShows } from "@/lib/api/shows";
import { getArtists } from "@/lib/api/artists";
import { useCityStore } from "@/lib/stores/useCityStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { FeaturedShowHero } from "@/components/home/FeaturedShowHero";
import { ShowRoomEntry } from "@/components/home/ShowRoomEntry";
import { ShowCardHome } from "@/components/home/ShowCardHome";
import { ArtistCardSmall } from "@/components/artist/ArtistCardSmall";
import type { Show, Artist, UserShowStatus } from "@/lib/types";
import { ShowStatus } from "@/lib/types";

export default function DiscoverPage() {
  const city = useCityStore((s) => s.city);
  const followedArtistIds = useUserStore((s) => s.followedArtistIds);
  const setShowStatus = useUserStore((s) => s.setShowStatus);
  const removeShowStatus = useUserStore((s) => s.removeShowStatus);
  const showStatuses = useUserStore((s) => s.showStatuses);
  const requireAuth = useRequireAuth();

  const [recommended, setRecommended] = useState<Show[]>([]);
  const [cityShows, setCityShows] = useState<Show[]>([]);
  const [nearbyShows, setNearbyShows] = useState<Show[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  // 基础数据：只随城市变化
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [rec, cityResult, artistResult] = await Promise.all([
          getRecommendedShows(city, 6),
          getShows({ city, status: ShowStatus.UPCOMING, limit: 12 }),
          getArtists({ limit: 12 }),
        ]);
        if (cancelled) return;
        setRecommended(rec);
        setCityShows(cityResult.data);
        setArtists(artistResult.data);
      } catch (err) {
        // 任何失败都不能让页面一直显示 Skeleton
        // API 层已对 Supabase 失败做了 mock fallback，这里兜底确保 loading 结束
        console.error("[home] load failed:", err);
      } finally {
        // 无论成功/失败，都必须结束 loading
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [city]);

  // 关注变化后静默刷新推荐（不触发整页 loading 闪烁）
  useEffect(() => {
    let cancelled = false;
    void getRecommendedShows(city, 6)
      .then((rec) => {
        if (!cancelled) setRecommended(rec);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [city, followedArtistIds]);

  // 本城近期演出：排除已在推荐中的
  const recommendedIds = new Set(recommended.map((s) => s.id));
  const upcomingShows = cityShows.filter((s) => !recommendedIds.has(s.id));

  // 本城是否有任何 upcoming 演出（推荐位 + 本城列表两个数据源都为空才算无）
  const hasLocalShows = recommended.length > 0 || cityShows.length > 0;

  // 本城完全没有 upcoming 演出时，兜底拉取周边城市的真实演出。
  // Hero（featured）与下方"即将上演"共用同一份 nearbyShows，保证两边结果一致。
  // - 按邻近顺序返回（近 → 远），只展示真实已有演出
  // - 本城/周边全部无演出时 nearbyShows 为空，UI 才显示空状态
  useEffect(() => {
    if (loading || hasLocalShows) {
      setNearbyShows([]);
      setNearbyLoading(false);
      return;
    }
    let cancelled = false;
    setNearbyLoading(true);
    getNearbyUpcomingShows(city, 8)
      .then((list) => {
        if (!cancelled) setNearbyShows(list);
      })
      .catch(() => {
        if (!cancelled) setNearbyShows([]);
      })
      .finally(() => {
        if (!cancelled) setNearbyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [city, loading, hasLocalShows]);

  // 周边推荐模式：本城无演出、且周边城市有真实演出
  const isNearbyMode = !loading && !hasLocalShows && nearbyShows.length > 0;

  // Featured Hero：本城推荐 → 本城列表 → 周边兜底（与"即将上演"同源 nearbyShows）
  const featured: Show | undefined =
    recommended[0] ?? cityShows[0] ?? nearbyShows[0];

  /**
   * 感兴趣/要去 状态切换
   * - 已登录 → 直接 setShowStatus（同一状态再点 = 取消）
   * - 未登录 → useRequireAuth 拦截（打开 LoginModal，登录后自动执行）
   */
  const handleFeaturedStatusChange = useCallback(
    (target: UserShowStatus) => {
      if (!featured) return;
      requireAuth(() => {
        const current = useUserStore.getState().showStatuses[featured.id];
        if (current === target) {
          removeShowStatus(featured.id);
        } else {
          setShowStatus(featured.id, target);
        }
      });
    },
    [featured, requireAuth, setShowStatus, removeShowStatus]
  );

  const featuredUserStatus = featured ? showStatuses[featured.id] : undefined;

  return (
    <main className="flex flex-col">
      {/* Featured Show Hero */}
      {featured ? (
        <FeaturedShowHero
          show={featured}
          userStatus={featuredUserStatus}
          onStatusChange={handleFeaturedStatusChange}
          nearbyLabel={
            isNearbyMode ? `${city}周边推荐 · ${featured.city}` : undefined
          }
        />
      ) : loading || nearbyLoading ? (
        <HeroSkeleton />
      ) : (
        <NoFeaturedShow />
      )}

      {/* 观演小屋 社区入口 */}
      <ShowRoomEntry />

      {/* 即将上演 / UPCOMING SHOWS */}
      <section className="border-b border-border">
        <div className="container-gigroom py-10 md:py-14">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="font-condensed text-xs tracking-[0.25em] text-accent-lime uppercase mb-2">
                {isNearbyMode ? "NEARBY SHOWS" : "UPCOMING SHOWS"}
              </p>
              <h2 className="text-h2 text-text-primary">
                {isNearbyMode ? "大家还在看" : "即将上演"}
              </h2>
              {isNearbyMode && (
                <p className="mt-2 text-text-secondary text-sm">
                  {city}周边的演出
                </p>
              )}
            </div>
            <Link
              href="/shows"
              className="text-sm text-text-secondary hover:text-accent-lime transition-colors"
            >
              查看全部 →
            </Link>
          </div>

          {loading || nearbyLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[4/5] bg-bg-secondary animate-pulse rounded-sm"
                />
              ))}
            </div>
          ) : upcomingShows.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {upcomingShows.slice(0, 8).map((show) => (
                <ShowCardHome key={show.id} show={show} />
              ))}
            </div>
          ) : isNearbyMode ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {nearbyShows.slice(0, 8).map((show) => (
                <ShowCardHome key={show.id} show={show} />
              ))}
            </div>
          ) : (
            <div className="rounded-sm border border-dashed border-border p-10 text-center">
              <p className="text-text-tertiary text-sm mb-2">
                {cityShows.length === 0
                  ? `还没有${city}的即将上演演出`
                  : `${city}的演出都在上方推荐中了`}
              </p>
              <p className="text-text-tertiary text-xs">
                试试切换城市，或去演出列表查看全部历史演出
              </p>
            </div>
          )}
        </div>
      </section>

      {/* 声场城市 */}
      <SoundSceneCities />

      {/* 关注的艺人（保留 ArtistCardSmall） */}
      <section className="border-b border-border">
        <div className="container-gigroom py-10 md:py-14">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="font-condensed text-xs tracking-[0.25em] text-accent-lime uppercase mb-2">
                ARTISTS
              </p>
              <h2 className="text-h2 text-text-primary">关注的艺人</h2>
            </div>
            <Link
              href="/artists"
              className="text-sm text-text-secondary hover:text-accent-lime transition-colors whitespace-nowrap"
            >
              查看全部 →
            </Link>
          </div>

          {artists.length > 0 && (
            <div className="flex gap-4 md:gap-5 overflow-x-auto scrollbar-hide pb-2">
              {artists.map((artist) => (
                <ArtistCardSmall key={artist.id} artist={artist} />
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

// ========== Featured Hero 加载骨架 ==========
function HeroSkeleton() {
  return (
    <section className="border-b border-border bg-bg-secondary">
      <div className="container-gigroom grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-10 py-10 md:py-14">
        <div className="md:col-span-2 flex flex-col gap-4">
          <div className="h-3 w-32 bg-bg-tertiary animate-pulse rounded-sm" />
          <div className="h-14 w-3/4 bg-bg-tertiary animate-pulse rounded-sm" />
          <div className="h-4 w-1/2 bg-bg-tertiary animate-pulse rounded-sm" />
          <div className="h-4 w-2/3 bg-bg-tertiary animate-pulse rounded-sm" />
          <div className="mt-2 flex gap-3">
            <div className="h-11 w-28 bg-bg-tertiary animate-pulse rounded-md" />
            <div className="h-11 w-28 bg-bg-tertiary animate-pulse rounded-md" />
          </div>
        </div>
        <div className="md:col-span-3">
          <div className="aspect-[4/5] md:aspect-[5/4] w-full bg-bg-tertiary animate-pulse rounded-sm" />
        </div>
      </div>
    </section>
  );
}

// ========== 无 Featured Show 时的占位（loading 已结束） ==========
function NoFeaturedShow() {
  return (
    <section className="border-b border-border">
      <div className="container-gigroom py-10 md:py-14">
        <div className="rounded-sm border border-dashed border-border p-8 md:p-12 text-center">
          <p className="font-condensed text-xs tracking-[0.25em] text-accent-lime uppercase mb-3">
            GIGROOM
          </p>
          <h2 className="text-h2 text-text-primary mb-2">暂无推荐演出</h2>
          <p className="text-text-secondary text-sm">
            当前城市还没有即将上演的演出，试试切换城市或查看全部演出列表。
          </p>
        </div>
      </div>
    </section>
  );
}

// ========== 声场城市 ==========
function SoundSceneCities() {
  const currentCity = useCityStore((s) => s.city);
  const setCity = useCityStore((s) => s.setCity);
  const openCitySelector = useUIStore((s) => s.openCitySelector);

  const cities = [
    { code: "BJ", name: "北京", shows: 24 },
    { code: "SH", name: "上海", shows: 31 },
    { code: "CD", name: "成都", shows: 18 },
    { code: "WH", name: "武汉", shows: 9 },
    { code: "GZ", name: "广州", shows: 12 },
  ];

  return (
    <section className="border-b border-border">
      <div className="container-gigroom py-10 md:py-14">
        <div className="mb-6">
          <p className="font-condensed text-xs tracking-[0.25em] text-accent-lime uppercase mb-2">
            SOUND SCENE CITIES
          </p>
          <h2 className="text-h2 text-text-primary">声场城市</h2>
          <p className="mt-2 text-text-secondary text-sm">
            中国独立音乐现场正在每一座城市蔓延，找到你城市的声音。
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-0 border border-border rounded-sm overflow-hidden">
          {cities.map((c) => {
            const isActive = c.name === currentCity;
            return (
              <button
                key={c.code}
                onClick={() => setCity(c.name)}
                className={
                  "group flex items-center gap-2.5 border border-border border-b-0 border-r-0 last:border-r-0 sm:[&:nth-child(3n)]:border-r-0 md:[&:nth-child(5n)]:border-r-0 first:border-t-0 first:border-l-0 md:[&:nth-child(-n+5)]:border-t-0 " +
                  "p-4 md:p-5 text-left transition-colors " +
                  (isActive
                    ? "bg-accent-lime/10 text-text-primary"
                    : "hover:bg-bg-secondary text-text-primary")
                }
              >
                <MapPin
                  size={14}
                  className={isActive ? "text-accent-lime" : "text-text-tertiary"}
                />
                <span className="font-condensed text-[10px] tracking-[0.15em] text-text-tertiary uppercase">
                  {c.code}
                </span>
                <span className="text-sm font-medium ml-auto">{c.name}</span>
                <span className="text-xs text-text-tertiary">
                  {c.shows}场
                </span>
              </button>
            );
          })}
        </div>

        {/* 探索更多城市：文字链接，非大按钮；点击打开城市选择弹窗 */}
        <button
          type="button"
          onClick={openCitySelector}
          className="group mt-4 inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-accent-lime transition-colors"
        >
          探索更多城市
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
          />
        </button>
      </div>
    </section>
  );
}
