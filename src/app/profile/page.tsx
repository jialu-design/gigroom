"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Music2, ArrowRight } from "lucide-react";
import { TabBar, TabItem } from "@/components/ui/TabBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { ArtistCard } from "@/components/artist/ArtistCard";
import { ShowCardCompact } from "@/components/show/ShowCardCompact";
import { ProfileHeader } from "@/components/user/ProfileHeader";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { getArtistLookupMap } from "@/lib/api/artists";
import { getShowLookupMap } from "@/lib/api/shows";
import { getRoomsByUser } from "@/lib/api/rooms";
import { getBuddyPostsByUser } from "@/lib/api/posts/buddyPosts";
import { getTicketPostsByUser } from "@/lib/api/posts/ticketPosts";
import { UserShowStatus, ArtistRole, TicketPostType, TicketPostStatus } from "@/lib/types";
import type { Artist, Show, ShowRoom, BuddyPost, TicketPost } from "@/lib/types";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";
import { formatShowDate, getShowPosterFallback } from "@/lib/utils/format";

type ProfileTab = "artists" | "shows" | "rooms" | "buddy" | "ticket";
type ShowsSubTab = "going" | "interested" | "attended";
type RoomsSubTab = "current" | "past";

// ========================
// 数据派生工具（严格使用现有状态计算，不创建第二份）
// ========================

/** 根据 followedArtistIds 从 artistMap 映射 Artist（不存在的 id 过滤） */
function deriveFollowedArtists(ids: string[], artistMap: Map<string, Artist>): Artist[] {
  return ids
    .map((id) => artistMap.get(id))
    .filter((a): a is Artist => !!a);
}

/** 根据 showStatuses 派生三类演出列表（严格按规则） */
function deriveProfileShows(
  showStatuses: Record<string, UserShowStatus>,
  showMap: Map<string, Show>
): { going: Show[]; interested: Show[]; attended: Show[] } {
  const going: Show[] = [];
  const interested: Show[] = [];
  const attended: Show[] = [];

  for (const [showId, status] of Object.entries(showStatuses)) {
    const show = showMap.get(showId);
    if (!show) continue;
    const lifecycle = getShowLifecycle(show);

    if (status === UserShowStatus.GOING) {
      // Going：只显示未来演出
      if (!lifecycle.hasEnded) going.push(show);
    } else if (status === UserShowStatus.INTERESTED) {
      // Interested：只显示未来演出
      if (!lifecycle.hasEnded) interested.push(show);
    } else if (status === UserShowStatus.ATTENDED) {
      // Attended：不区分未来/过去，只要 status 是 attended 即可
      attended.push(show);
    }
  }

  // Going / Interested 日期升序
  going.sort((a, b) => a.date_time.localeCompare(b.date_time));
  interested.sort((a, b) => a.date_time.localeCompare(b.date_time));
  // Attended 日期倒序
  attended.sort((a, b) => b.date_time.localeCompare(a.date_time));

  return { going, interested, attended };
}

interface ProfileRoomItem {
  membership_joined_at: string;
  room_id: string;
  show: Show;
  room?: ShowRoom;
  artist_name: string;
  activity_count: number;
}

/** 根据 roomMemberships 派生用户加入的房间列表（严格依赖 membership，Going/Interested 不自动出现） */
function deriveRooms(
  memberships: { room_id: string; joined_at: string }[],
  userRooms: ShowRoom[],
  showMap: Map<string, Show>
): ProfileRoomItem[] {
  const roomMap = new Map(userRooms.map((r) => [r.id, r]));
  const roomToShow = new Map<string, Show>();
  for (const room of userRooms) {
    const show = showMap.get(room.show_id);
    if (show) roomToShow.set(room.id, show);
  }

  const items: ProfileRoomItem[] = [];
  for (const m of memberships) {
    const show = roomToShow.get(m.room_id);
    if (!show) continue;
    const headliner = show.artists?.find((a) => a.role === ArtistRole.HEADLINER);
    const room = roomMap.get(m.room_id);
    const activity_count =
      (room?.message_count ?? 0) +
      (room?.buddy_post_count ?? 0) +
      (room?.ticket_post_count ?? 0) +
      (room?.live_post_count ?? 0);
    items.push({
      membership_joined_at: m.joined_at,
      room_id: m.room_id,
      show,
      room,
      artist_name: headliner?.artist?.name ?? show.title ?? "未命名演出",
      activity_count,
    });
  }

  // 按 joined_at 倒序
  items.sort((a, b) => b.membership_joined_at.localeCompare(a.membership_joined_at));
  return items;
}

// ========================
// 页面主体
// ========================

const PROFILE_TABS: TabItem[] = [
  { key: "artists", label: "乐队" },
  { key: "shows", label: "演出" },
  { key: "rooms", label: "小屋" },
  { key: "buddy", label: "找搭子" },
  { key: "ticket", label: "出收票" },
];

const ROOMS_SUBTABS: (tab: RoomsSubTab, counts: { current: number; past: number }) => TabItem[] =
  (_, counts) => [
    { key: "current", label: `当前观演小屋 ${counts.current > 0 ? `(${counts.current})` : ""}` },
    { key: "past", label: `过往观演小屋 ${counts.past > 0 ? `(${counts.past})` : ""}` },
  ];

const SHOWS_SUBTABS: (tab: ShowsSubTab, counts: { going: number; interested: number; attended: number }) => TabItem[] =
  (_, counts) => [
    { key: "going", label: `我要去 ${counts.going > 0 ? `(${counts.going})` : ""}` },
    { key: "interested", label: `感兴趣 ${counts.interested > 0 ? `(${counts.interested})` : ""}` },
    { key: "attended", label: `去过 ${counts.attended > 0 ? `(${counts.attended})` : ""}` },
  ];

export default function ProfilePage() {
  const router = useRouter();
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const user = useUserStore((s) => s.user);
  const followedArtistIds = useUserStore((s) => s.followedArtistIds);
  const showStatuses = useUserStore((s) => s.showStatuses);
  const roomMemberships = useUserStore((s) => s.roomMemberships);
  const openLoginModal = useUIStore((s) => s.openLoginModal);

  const [tab, setTab] = React.useState<ProfileTab>("artists");
  const [showsSubTab, setShowsSubTab] = React.useState<ShowsSubTab>("going");
  const [roomsSubTab, setRoomsSubTab] = React.useState<RoomsSubTab>("current");

  // P10.2-D: 通过 API 层获取查找表（替代直接 import mock）
  const [artistMap, setArtistMap] = React.useState<Map<string, Artist>>(new Map());
  const [showMap, setShowMap] = React.useState<Map<string, Show>>(new Map());
  const [userRooms, setUserRooms] = React.useState<ShowRoom[]>([]);
  const [myBuddyPosts, setMyBuddyPosts] = React.useState<BuddyPost[]>([]);
  const [myTicketPosts, setMyTicketPosts] = React.useState<TicketPost[]>([]);

  React.useEffect(() => {
    if (!isLoggedIn || !user) return;
    let cancelled = false;
    Promise.all([
      getArtistLookupMap(),
      getShowLookupMap(),
      getRoomsByUser(user.id),
      getBuddyPostsByUser(user.id),
      getTicketPostsByUser(user.id),
    ]).then(([aMap, sMap, rooms, buddyPosts, ticketPosts]) => {
      if (cancelled) return;
      setArtistMap(aMap);
      setShowMap(sMap);
      setUserRooms(rooms);
      setMyBuddyPosts(buddyPosts);
      setMyTicketPosts(ticketPosts);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user]);

  // 派生数据（全部从现有状态计算）
  const followedArtists = React.useMemo(
    () => deriveFollowedArtists(followedArtistIds, artistMap),
    [followedArtistIds, artistMap]
  );
  const { going, interested, attended } = React.useMemo(
    () => deriveProfileShows(showStatuses, showMap),
    [showStatuses, showMap]
  );
  const allRooms = React.useMemo(
    () => deriveRooms(roomMemberships, userRooms, showMap),
    [roomMemberships, userRooms, showMap]
  );
  // 小屋分组：当前 = 演出未结束；过往 = 用户曾加入且演出已结束（查看历史聊天/现场记录）
  const { currentRooms, pastRooms } = React.useMemo(() => {
    const current: ProfileRoomItem[] = [];
    const past: ProfileRoomItem[] = [];
    for (const item of allRooms) {
      if (getShowLifecycle(item.show).hasEnded) {
        past.push(item);
      } else {
        current.push(item);
      }
    }
    return { currentRooms: current, pastRooms: past };
  }, [allRooms]);
  const attendedCount = React.useMemo(
    () =>
      Object.values(showStatuses).filter((s) => s === UserShowStatus.ATTENDED)
        .length,
    [showStatuses]
  );

  // ===== 未登录态 =====
  if (!isLoggedIn || !user) {
    return (
      <main className="container-gigroom py-12">
        <h1 className="text-h1 mb-8 text-text-primary">个人主页</h1>
        <EmptyState
          icon={<Music2 size={48} />}
          title="登录后查看你的声场记录"
          description="关注的乐队、计划中的演出、加入的小屋都在这里"
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

  // ===== 已登录态 =====
  const counts = { going: going.length, interested: interested.length, attended: attended.length };

  return (
    <main className="container-gigroom py-8 md:py-12">
      <h1 className="text-h1 mb-6 text-text-primary">个人主页</h1>

      {/* ProfileHeader */}
      <ProfileHeader
        user={user}
        followedCount={followedArtistIds.length}
        attendedCount={attendedCount}
      />

      {/* 二级 Tab */}
      <div className="mt-8">
        <TabBar tabs={PROFILE_TABS} activeKey={tab} onChange={(k) => setTab(k as ProfileTab)} />

        <div className="mt-6">
          {/* ====== 乐队 Tab ====== */}
          {tab === "artists" && (
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-h3 text-text-primary">我喜欢的乐队</h2>
                <Link
                  href="/artists"
                  className="text-sm text-accent-lime hover:underline"
                >
                  发现乐队 →
                </Link>
              </div>
              {followedArtists.length === 0 ? (
                <EmptyState
                  title="还没有关注乐队，去发现页看看吧"
                  action={{
                    label: "发现乐队",
                    variant: "secondary",
                    onClick: () => router.push("/artists"),
                  }}
                  className="border border-border rounded-md bg-bg-secondary py-14"
                />
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                  {followedArtists.map((a) => (
                    <ArtistCard key={a.id} artist={a} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ====== 演出 Tab ====== */}
          {tab === "shows" && (
            <div>
              <TabBar
                tabs={SHOWS_SUBTABS(showsSubTab, counts)}
                activeKey={showsSubTab}
                onChange={(k) => setShowsSubTab(k as ShowsSubTab)}
                compact
              />
              <div className="mt-4">
                {showsSubTab === "going" && (
                  going.length === 0 ? (
                    <EmptyState
                      title="暂时没有计划中的演出"
                      className="border border-border rounded-md bg-bg-secondary py-14"
                    />
                  ) : (
                    <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                      {going.map((s) => (
                        <ShowCardCompact key={s.id} show={s} />
                      ))}
                    </div>
                  )
                )}
                {showsSubTab === "interested" && (
                  interested.length === 0 ? (
                    <EmptyState
                      title="还没有感兴趣的演出"
                      className="border border-border rounded-md bg-bg-secondary py-14"
                    />
                  ) : (
                    <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                      {interested.map((s) => (
                        <ShowCardCompact key={s.id} show={s} />
                      ))}
                    </div>
                  )
                )}
                {showsSubTab === "attended" && (
                  attended.length === 0 ? (
                    <EmptyState
                      title="还没有记录过现场"
                      className="border border-border rounded-md bg-bg-secondary py-14"
                    />
                  ) : (
                    <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                      {attended.map((s) => (
                        <ShowCardCompact key={s.id} show={s} />
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* ====== 房间 Tab（当前 / 过往） ====== */}
          {tab === "rooms" && (
            <div>
              <TabBar
                tabs={ROOMS_SUBTABS(roomsSubTab, {
                  current: currentRooms.length,
                  past: pastRooms.length,
                })}
                activeKey={roomsSubTab}
                onChange={(k) => setRoomsSubTab(k as RoomsSubTab)}
                compact
              />
              <div className="mt-4">
                {roomsSubTab === "current" ? (
                  currentRooms.length === 0 ? (
                    <EmptyState
                      title="还没有加入观演小屋"
                      className="border border-border rounded-md bg-bg-secondary py-14"
                    />
                  ) : (
                    <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                      {currentRooms.map((r) => (
                        <ProfileRoomRow key={r.room_id} item={r} />
                      ))}
                    </div>
                  )
                ) : (
                  pastRooms.length === 0 ? (
                    <EmptyState
                      title="参加过并加入过小屋的演出结束后，会出现在这里"
                      className="border border-border rounded-md bg-bg-secondary py-14"
                    />
                  ) : (
                    <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                      {pastRooms.map((r) => (
                        <ProfileRoomRow key={r.room_id} item={r} past />
                      ))}
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* ====== 找搭子 Tab ====== */}
          {tab === "buddy" && (
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-h3 text-text-primary">我发布的找搭子</h2>
              </div>
              {myBuddyPosts.length === 0 ? (
                <EmptyState
                  title="还没有发布过找搭子帖"
                  description="进入某场演出的观演小屋，发布你的第一个找搭子帖"
                  className="border border-border rounded-md bg-bg-secondary py-14"
                />
              ) : (
                <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                  {myBuddyPosts.map((p) => (
                    <Link
                      key={p.id}
                      href={`/show/${p.show_id}?tab=buddy#room`}
                      className="flex items-center gap-3 p-3 md:p-4 hover:bg-bg-secondary transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-text-primary line-clamp-2">
                          {p.content}
                        </div>
                        <div className="mt-1 text-[11px] text-text-tertiary">
                          {formatShowDate(p.created_at)} 发布
                          {showMap.get(p.show_id)
                            ? ` · ${showMap.get(p.show_id)!.city}`
                            : ""}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm text-accent-lime flex items-center gap-1">
                        查看
                        <ArrowRight size={14} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ====== 出收票 Tab ====== */}
          {tab === "ticket" && (
            <div>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-h3 text-text-primary">我的出收票</h2>
              </div>
              {myTicketPosts.length === 0 ? (
                <EmptyState
                  title="还没有发布过出收票帖"
                  description="进入某场演出的观演小屋，发布出票或收票信息"
                  className="border border-border rounded-md bg-bg-secondary py-14"
                />
              ) : (
                <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                  {myTicketPosts.map((p) => (
                    <Link
                      key={p.id}
                      href={`/show/${p.show_id}?tab=ticket#room`}
                      className="flex items-center gap-3 p-3 md:p-4 hover:bg-bg-secondary transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="lime"
                            size="sm"
                          >
                            {p.type === TicketPostType.SELLING ? "出票" : "收票"}
                          </Badge>
                          {p.status === TicketPostStatus.COMPLETED && (
                            <Badge variant="grey" size="sm">
                              已完成
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1 text-sm text-text-primary line-clamp-1">
                          {p.note ||
                            (p.price != null
                              ? `¥${p.price}${p.face_value != null ? `（原价 ¥${p.face_value}）` : ""}`
                              : "面议")}
                        </div>
                        <div className="mt-1 text-[11px] text-text-tertiary">
                          {p.quantity} 张 · {formatShowDate(p.created_at)} 发布
                          {showMap.get(p.show_id)
                            ? ` · ${showMap.get(p.show_id)!.city}`
                            : ""}
                        </div>
                      </div>
                      <span className="shrink-0 text-sm text-accent-lime flex items-center gap-1">
                        查看
                        <ArrowRight size={14} />
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/** 我的小屋列表行（当前/过往共用） */
function ProfileRoomRow({ item, past = false }: { item: ProfileRoomItem; past?: boolean }) {
  return (
    <Link
      href={`/show/${item.show.id}?tab=discussion#room`}
      className="flex items-center gap-3 p-3 md:p-4 hover:bg-bg-secondary transition-colors"
    >
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary poster-border">
        {/* eslint-disable-next-line @next/next/no-img-element -- 列表内小缩略图，避免 Next Image 额外复杂性 */}
        <img
          src={item.show.poster_url || getShowPosterFallback(item.show.id)}
          alt={item.artist_name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary line-clamp-1">
          {item.artist_name}
        </div>
        <div className="mt-0.5 text-xs text-text-tertiary line-clamp-1">
          {formatShowDate(item.show.date_time)} · {item.show.city}
        </div>
        <div className="mt-1 text-[11px] text-text-tertiary">
          {past
            ? `${formatShowDate(item.show.date_time)} 演出 · 查看历史记录`
            : item.activity_count > 0
              ? `${item.activity_count} 条内容`
              : "暂无内容"}
        </div>
      </div>
      <span className="shrink-0 text-sm text-accent-lime flex items-center gap-1">
        进入
        <ArrowRight size={14} />
      </span>
    </Link>
  );
}
