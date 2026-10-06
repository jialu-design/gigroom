"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, ArrowRight } from "lucide-react";
import { TabBar, TabItem } from "@/components/ui/TabBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { getShowLookupMap } from "@/lib/api/shows";
import { getRoomsByUser } from "@/lib/api/rooms";
import type { Show, ShowRoom } from "@/lib/types";
import { deriveMemberRooms } from "@/lib/utils/showState";
import type { MemberRoomItem } from "@/lib/utils/showState";
import { formatShowDate, getShowPosterFallback } from "@/lib/utils/format";

type RoomsTab = "upcoming" | "past";

const ROOMS_TABS: (active: RoomsTab, counts: { upcoming: number; past: number }) => TabItem[] =
  (_, counts) => [
    { key: "upcoming", label: `即将到来 ${counts.upcoming > 0 ? `(${counts.upcoming})` : ""}` },
    { key: "past", label: `过往 ${counts.past > 0 ? `(${counts.past})` : ""}` },
  ];

/** RoomCard（Rooms 页面） - 即将到来样式 */
function RoomCardUpcoming({ item }: { item: MemberRoomItem }) {
  return (
    <Link
      href={`/show/${item.show.id}?tab=discussion#room`}
      className="group flex gap-4 p-4 rounded-md border border-border bg-bg-secondary hover:border-border-light transition-colors"
    >
      {/* 海报缩略图 */}
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary poster-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.show.poster_url || getShowPosterFallback(item.show.id)}
          alt={item.artistName}
          className="w-full h-full object-cover"
        />
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-lime line-clamp-1 transition-colors">
          {item.artistName}
        </h3>
        <p className="mt-1 text-sm text-text-secondary line-clamp-1">
          {formatShowDate(item.show.date_time)}
        </p>
        <p className="mt-0.5 text-xs text-text-tertiary line-clamp-1">
          {[item.show.city, item.show.venue?.name].filter(Boolean).join(" · ")}
        </p>

        {/* 活跃数据 */}
        <div className="mt-auto pt-3 flex items-center gap-4 text-xs text-text-tertiary">
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={12} />
            {item.room.member_count ?? 0} 人
          </span>
          <span>{item.activityCount} 条内容</span>
        </div>
      </div>

      {/* 入口 */}
      <div className="shrink-0 self-center flex items-center gap-1 text-sm text-accent-lime">
        <span className="hidden sm:inline">进入观演小屋</span>
        <ArrowRight size={16} />
      </div>
    </Link>
  );
}

/** RoomCard（Rooms 页面） - 过往样式 */
function RoomCardPast({ item }: { item: MemberRoomItem }) {
  return (
    <Link
      href={`/show/${item.show.id}?tab=discussion#room`}
      className="group flex gap-4 p-4 rounded-md border border-border bg-bg-secondary hover:border-border-light transition-colors"
    >
      {/* 海报（偏灰） */}
      <div className="relative h-28 w-20 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary poster-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.show.poster_url || getShowPosterFallback(item.show.id)}
          alt={item.artistName}
          className="w-full h-full object-cover opacity-70 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-lime line-clamp-1 transition-colors">
          {item.artistName}
        </h3>
        <p className="mt-1 text-sm text-text-secondary line-clamp-1">
          {formatShowDate(item.show.date_time)} · {item.show.city}
        </p>

        {/* 过往房间的活跃信息 */}
        <div className="mt-auto pt-3 flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-text-tertiary">
          {(item.room.live_post_count ?? 0) > 0 && (
            <span>{item.room.live_post_count} 条现场内容</span>
          )}
          <span>
            最近活跃：
            {formatShowDate(
              item.joinedAt > item.room.created_at
                ? item.joinedAt
                : item.room.created_at
            )}
          </span>
        </div>
      </div>

      <div className="shrink-0 self-center flex items-center gap-1 text-sm text-accent-lime">
        <span className="hidden sm:inline">回到观演小屋</span>
        <ArrowRight size={16} />
      </div>
    </Link>
  );
}

export default function RoomsPage() {
  const router = useRouter();
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const user = useUserStore((s) => s.user);
  const roomMemberships = useUserStore((s) => s.roomMemberships);
  const openLoginModal = useUIStore((s) => s.openLoginModal);

  const [tab, setTab] = React.useState<RoomsTab>("upcoming");

  // P10.3: 通过 API 层获取查找表（替代直接 import mock）
  const [showMap, setShowMap] = React.useState<Map<string, Show>>(new Map());
  const [userRooms, setUserRooms] = React.useState<ShowRoom[]>([]);

  React.useEffect(() => {
    if (!isLoggedIn || !user) return;
    let cancelled = false;
    Promise.all([
      getShowLookupMap(),
      getRoomsByUser(user.id),
    ]).then(([sMap, rooms]) => {
      if (cancelled) return;
      setShowMap(sMap);
      setUserRooms(rooms);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user]);

  const { current: upcoming, past } = React.useMemo(
    () => deriveMemberRooms(roomMemberships, userRooms, showMap),
    [roomMemberships, userRooms, showMap]
  );
  const counts = { upcoming: upcoming.length, past: past.length };

  // 未登录态
  if (!isLoggedIn) {
    return (
      <main className="container-gigroom py-8 md:py-12">
        <h1 className="text-h1 mb-8 text-text-primary">我的小屋</h1>
        <EmptyState
          icon={<MessageCircle size={48} />}
          title="登录后查看你的观演小屋"
          action={{
            label: "登录",
            variant: "primary",
            onClick: openLoginModal,
          }}
          className="py-16"
        />
      </main>
    );
  }

  return (
    <main className="container-gigroom py-8 md:py-12">
      <h1 className="text-h1 mb-6 text-text-primary">我的小屋</h1>

      <TabBar
        tabs={ROOMS_TABS(tab, counts)}
        activeKey={tab}
        onChange={(k) => setTab(k as RoomsTab)}
      />

      <div className="mt-6">
        {tab === "upcoming" && (
          upcoming.length === 0 ? (
            <EmptyState
              title="你还没有加入即将到来的观演小屋"
              action={{
                label: "去发现演出",
                variant: "secondary",
                onClick: () => router.push("/shows"),
              }}
            />
          ) : (
            <div className="flex flex-col gap-3">
              {upcoming.map((r) => (
                <RoomCardUpcoming key={r.room.id} item={r} />
              ))}
            </div>
          )
        )}

        {tab === "past" && (
          past.length === 0 ? (
            <EmptyState
              title="还没有过往小屋记录"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {past.map((r) => (
                <RoomCardPast key={r.room.id} item={r} />
              ))}
            </div>
          )
        )}
      </div>
    </main>
  );
}
