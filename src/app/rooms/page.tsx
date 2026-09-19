"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircle, ArrowRight, LogIn } from "lucide-react";
import { TabBar, TabItem } from "@/components/ui/TabBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { getShowLookupMap } from "@/lib/api/shows";
import { getRoomsByUser } from "@/lib/api/rooms";
import { ArtistRole, type Show, type ShowRoom } from "@/lib/types";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";
import { formatShowDate, getShowPosterFallback } from "@/lib/utils/format";
import { cn } from "@/lib/utils";

type RoomsTab = "upcoming" | "past";

interface RoomsRoomItem {
  show: Show;
  room: ShowRoom;
  artist_name: string;
  venue_name: string;
  member_count: number;
  total_activity: number;
  /** 过往房：最近活跃时间（简化用 joined_at 或 room 的 max） */
  live_post_count: number;
  last_active_at: string;
}

/**
 * 派生 Rooms 页面数据：
 * 严格依赖 roomMemberships（已加入房间），Going/Interested 未加入的不自动出现
 */
function deriveRoomsData(
  memberships: { room_id: string; joined_at: string }[],
  userRooms: ShowRoom[],
  showMap: Map<string, Show>
): { upcoming: RoomsRoomItem[]; past: RoomsRoomItem[] } {
  const roomMap = new Map(userRooms.map((r) => [r.id, r]));
  const roomShowMap = new Map<string, Show>();
  for (const room of userRooms) {
    const show = showMap.get(room.show_id);
    if (show) roomShowMap.set(room.id, show);
  }

  const upcoming: RoomsRoomItem[] = [];
  const past: RoomsRoomItem[] = [];

  for (const m of memberships) {
    const room = roomMap.get(m.room_id);
    const show = roomShowMap.get(m.room_id);
    if (!room || !show) continue;
    const lifecycle = getShowLifecycle(show);

    const headliner = show.artists?.find((a) => a.role === ArtistRole.HEADLINER);
    const artist_name = headliner?.artist?.name ?? show.title ?? "未命名演出";
    const venue_name = show.venue?.name ?? "";
    const member_count = room.member_count ?? 0;
    const total_activity =
      (room.message_count ?? 0) +
      (room.buddy_post_count ?? 0) +
      (room.ticket_post_count ?? 0) +
      (room.live_post_count ?? 0);
    const live_post_count = room.live_post_count ?? 0;
    // 最近活跃：简化取 room.create_time/ joined_at 中较新的
    const last_active_at = m.joined_at > room.created_at ? m.joined_at : room.created_at;

    const item: RoomsRoomItem = {
      show,
      room,
      artist_name,
      venue_name,
      member_count,
      total_activity,
      live_post_count,
      last_active_at,
    };

    if (!lifecycle.hasEnded) {
      upcoming.push(item);
    } else {
      past.push(item);
    }
  }

  // 即将到来：日期升序
  upcoming.sort((a, b) => a.show.date_time.localeCompare(b.show.date_time));
  // 过往：日期倒序
  past.sort((a, b) => b.show.date_time.localeCompare(a.show.date_time));

  return { upcoming, past };
}

const ROOMS_TABS: (active: RoomsTab, counts: { upcoming: number; past: number }) => TabItem[] =
  (_, counts) => [
    { key: "upcoming", label: `即将到来 ${counts.upcoming > 0 ? `(${counts.upcoming})` : ""}` },
    { key: "past", label: `过往 ${counts.past > 0 ? `(${counts.past})` : ""}` },
  ];

/** RoomCard（Rooms 页面） - 即将到来样式 */
function RoomCardUpcoming({ item }: { item: RoomsRoomItem }) {
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
          alt={item.artist_name}
          className="w-full h-full object-cover"
        />
      </div>

      {/* 信息 */}
      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-lime line-clamp-1 transition-colors">
          {item.artist_name}
        </h3>
        <p className="mt-1 text-sm text-text-secondary line-clamp-1">
          {formatShowDate(item.show.date_time)}
        </p>
        <p className="mt-0.5 text-xs text-text-tertiary line-clamp-1">
          {[item.show.city, item.venue_name].filter(Boolean).join(" · ")}
        </p>

        {/* 活跃数据 */}
        <div className="mt-auto pt-3 flex items-center gap-4 text-xs text-text-tertiary">
          <span className="inline-flex items-center gap-1">
            <MessageCircle size={12} />
            {item.member_count} 人
          </span>
          <span>{item.total_activity} 条内容</span>
        </div>
      </div>

      {/* 入口 */}
      <div className="shrink-0 self-center flex items-center gap-1 text-sm text-accent-lime">
        <span className="hidden sm:inline">进入小屋</span>
        <ArrowRight size={16} />
      </div>
    </Link>
  );
}

/** RoomCard（Rooms 页面） - 过往样式 */
function RoomCardPast({ item }: { item: RoomsRoomItem }) {
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
          alt={item.artist_name}
          className="w-full h-full object-cover opacity-70 grayscale group-hover:grayscale-0 group-hover:opacity-100 transition-all"
        />
      </div>

      <div className="flex-1 min-w-0 flex flex-col">
        <h3 className="text-base font-semibold text-text-primary group-hover:text-accent-lime line-clamp-1 transition-colors">
          {item.artist_name}
        </h3>
        <p className="mt-1 text-sm text-text-secondary line-clamp-1">
          {formatShowDate(item.show.date_time)} · {item.show.city}
        </p>

        {/* 过往房间的活跃信息 */}
        <div className="mt-auto pt-3 flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-text-tertiary">
          {item.live_post_count > 0 && (
            <span>{item.live_post_count} 条现场内容</span>
          )}
          <span>
            最近活跃：{formatShowDate(item.last_active_at)}
          </span>
        </div>
      </div>

      <div className="shrink-0 self-center flex items-center gap-1 text-sm text-accent-lime">
        <span className="hidden sm:inline">回到小屋</span>
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

  const { upcoming, past } = React.useMemo(
    () => deriveRoomsData(roomMemberships, userRooms, showMap),
    [roomMemberships, userRooms, showMap]
  );
  const counts = { upcoming: upcoming.length, past: past.length };

  // 未登录态
  if (!isLoggedIn) {
    return (
      <main className="container-gigroom py-12">
        <h1 className="text-h1 mb-8 text-text-primary">我的小屋</h1>
        <EmptyState
          icon={<MessageCircle size={48} />}
          title="登录后查看你的观演小屋"
          action={{
            label: "登录",
            variant: "primary",
            onClick: openLoginModal,
          }}
          className="border border-border rounded-md bg-bg-secondary py-16"
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
              className="border border-border rounded-md bg-bg-secondary py-16"
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
              className="border border-border rounded-md bg-bg-secondary py-16"
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
