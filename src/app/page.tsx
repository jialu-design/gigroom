"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { MapPin, ArrowRight } from "lucide-react";
import { getShows, getNearbyUpcomingShows, getUpcomingCountsByCity } from "@/lib/api/shows";
import { getArtists } from "@/lib/api/artists";
import { useCityStore } from "@/lib/stores/useCityStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { FeaturedShowHero } from "@/components/home/FeaturedShowHero";
import { ShowRoomEntry } from "@/components/home/ShowRoomEntry";
import { ShowCardHome } from "@/components/home/ShowCardHome";
import { UpcomingShowFeature } from "@/components/home/UpcomingShowFeature";
import { UpcomingShowRow } from "@/components/home/UpcomingShowRow";
import { ComingSoonCard, CITY_CODES } from "@/components/home/ComingSoonCard";
import { ArtistCardSmall } from "@/components/artist/ArtistCardSmall";
import { EmptyState } from "@/components/ui/EmptyState";
import { classifyShows } from "@/lib/utils/showState";
import { ShowTicketStatus } from "@/lib/types";
import type { Show, Artist, UserShowStatus } from "@/lib/types";

export default function DiscoverPage() {
  const city = useCityStore((s) => s.city);
  const setShowStatus = useUserStore((s) => s.setShowStatus);
  const removeShowStatus = useUserStore((s) => s.removeShowStatus);
  const showStatuses = useUserStore((s) => s.showStatuses);
  const requireAuth = useRequireAuth();

  // 本城全量演出（与演出列表页同查询、同分类口径，见 classifyShows）
  const [cityShows, setCityShows] = useState<Show[]>([]);
  const [nearbyShows, setNearbyShows] = useState<Show[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);

  // 基础数据：只随城市变化。
  // 关键一致性：查询条件（city + limit:100，不带 status）与 /shows 默认视图完全相同，
  // 再用唯一口径 classifyShows 取 upcoming，保证首页与列表的同城 upcoming 集合/数量一致。
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [cityResult, artistResult] = await Promise.all([
          getShows({ city, limit: 100 }),
          getArtists({ limit: 12 }),
        ]);
        if (cancelled) return;
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

  // 同城 upcoming（与列表页"即将上演"同源同序：日期升序）
  const cityUpcoming = useMemo(
    () => classifyShows(cityShows).upcoming,
    [cityShows]
  );

  // P1-6 信息层级（参考 Figma）：Hero → 3 张大卡 → 紧凑列表行
  const featuredBig = useMemo(() => cityUpcoming.slice(1, 4), [cityUpcoming]);
  const featureRows = useMemo(() => cityUpcoming.slice(4, 10), [cityUpcoming]);
  // 「即将开票」= upcoming 中 ticket_status 为 coming_soon 的演出（真实数据，无则不显示区块）
  const comingSoonShows = useMemo(
    () => cityUpcoming.filter((s) => s.ticket_status === ShowTicketStatus.COMING_SOON),
    [cityUpcoming]
  );

  // 本城是否有任何 upcoming 演出（单一数据源判断）
  const hasLocalShows = cityUpcoming.length > 0;

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

  // Featured Hero：本城第一场 → 周边兜底（与"即将上演"同源 nearbyShows）
  const featured: Show | undefined = cityUpcoming[0] ?? nearbyShows[0];

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
      <ShowRoomEntry showId={featured?.id} />

      {/* 即将上演 / UPCOMING SHOWS */}
      <section className="border-b border-border">
        <div className="container-gigroom py-10 md:py-14">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <p className="eyebrow">
                {isNearbyMode ? "周边演出" : "近期推荐"}
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] bg-bg-secondary animate-pulse rounded-sm"
                />
              ))}
            </div>
          ) : isNearbyMode ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {nearbyShows.slice(0, 8).map((show) => (
                <ShowCardHome key={show.id} show={show} />
              ))}
            </div>
          ) : featuredBig.length > 0 ? (
            <div className="space-y-6">
              {/* 大卡层：3 张主推 */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                {featuredBig.map((show) => (
                  <UpcomingShowFeature key={show.id} show={show} />
                ))}
              </div>
              {/* 紧凑列表层：日期块 + 缩略图行 */}
              {featureRows.length > 0 && (
                <div className="border-t border-border pt-2">
                  {featureRows.map((show) => (
                    <UpcomingShowRow key={show.id} show={show} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <EmptyState
              title={
                cityUpcoming.length === 0
                  ? `还没有${city}的即将上演演出`
                  : `${city}的演出都在上方推荐中了`
              }
              description="试试切换城市，或去演出列表查看全部历史演出"
            />
          )}
        </div>
      </section>

      {/* 即将开票 / PRESALE SOON（P1-6：upcoming 中 coming_soon 的演出，无则不渲染） */}
      {comingSoonShows.length > 0 && (
        <section className="border-b border-border">
          <div className="container-gigroom py-10 md:py-14">
            <div className="mb-8 flex items-end justify-between">
              <div>
                <p className="eyebrow">开票预告</p>
                <h2 className="text-h2 text-text-primary">即将开票</h2>
              </div>
              <Link
                href="/shows"
                className="text-sm text-text-secondary hover:text-accent-lime transition-colors"
              >
                查看全部 →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              {comingSoonShows.slice(0, 3).map((show) => (
                <ComingSoonCard key={show.id} show={show} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 你的城市 */}
      <SoundSceneCities />

      {/* 关注的艺人（保留 ArtistCardSmall） */}
      <section className="border-b border-border">
        <div className="container-gigroom py-10 md:py-14">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <p className="eyebrow">已关注</p>
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
        <div className="rounded-md border border-dashed border-border bg-bg-secondary p-8 md:p-12 text-center">
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

// ========== 你的城市 ==========
function SoundSceneCities() {
  const currentCity = useCityStore((s) => s.city);
  const setCity = useCityStore((s) => s.setCity);
  const openCitySelector = useUIStore((s) => s.openCitySelector);

  // P0-4: 城市数量由同一 Show 数据源实时计算，禁止 hardcode
  const [cities, setCities] = useState<{ code: string; name: string; shows: number }[]>([]);
  const [loadingCities, setLoadingCities] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoadingCities(true);
    getUpcomingCountsByCity()
      .then((counts) => {
        if (cancelled) return;
        const list = Object.entries(counts)
          .map(([name, shows]) => ({ code: CITY_CODES[name] ?? "GI", name, shows }))
          .filter((c) => c.shows > 0)
          .sort((a, b) => b.shows - a.shows)
          .slice(0, 5);
        setCities(list);
      })
      .catch(() => {
        if (!cancelled) setCities([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingCities(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="border-b border-border">
      <div className="container-gigroom py-10 md:py-14">
        <div className="mb-6">
          <h2 className="text-h2 text-text-primary">你的城市</h2>
          <p className="mt-2 text-text-secondary text-sm">
            城市的角落有事情发生。
          </p>
        </div>

        {loadingCities ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-0 border border-border rounded-sm overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-[68px] md:h-[76px] bg-bg-secondary animate-pulse" />
            ))}
          </div>
        ) : cities.length > 0 ? (
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
                  <span className="text-xs text-text-tertiary tabular-nums">
                    {c.shows}场
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

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
