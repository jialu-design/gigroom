"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Music2, ArrowRight } from "lucide-react";
import { TicketChatModal } from "@/components/room/TicketChatModal";
import { Avatar } from "@/components/ui/Avatar";
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
import { getFavoritesByUser } from "@/lib/api/ticketFavorites";
import { getConversationsByUser } from "@/lib/api/ticketMessages";
import { UserShowStatus, TicketPostType, TicketPostStatus } from "@/lib/types";
import type { Artist, Show, ShowRoom, BuddyPost, TicketPost, TicketFavorite, TicketConversation } from "@/lib/types";
import { deriveMyShows, deriveMemberRooms } from "@/lib/utils/showState";
import type { MemberRoomItem } from "@/lib/utils/showState";
import { formatShowDate, formatRelativeTime, getShowPosterFallback } from "@/lib/utils/format";

type ProfileTab = "artists" | "shows" | "rooms" | "buddy" | "ticket";
type ShowsSubTab = "going" | "interested" | "attended";
type RoomsSubTab = "current" | "past";
type TicketSubTab = "posts" | "messages";

// ========================
// 数据派生（用户-演出关系 / Room 成员关系统一走 utils/showState，页面不自行判断状态）
// ========================

/** 根据 followedArtistIds 从 artistMap 映射 Artist（不存在的 id 过滤） */
function deriveFollowedArtists(ids: string[], artistMap: Map<string, Artist>): Artist[] {
  return ids
    .map((id) => artistMap.get(id))
    .filter((a): a is Artist => !!a);
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
    { key: "attended", label: `去过的演出 ${counts.attended > 0 ? `(${counts.attended})` : ""}` },
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
  const [ticketSubTab, setTicketSubTab] = React.useState<TicketSubTab>("posts");

  // P10.2-D: 通过 API 层获取查找表（替代直接 import mock）
  const [artistMap, setArtistMap] = React.useState<Map<string, Artist>>(new Map());
  const [showMap, setShowMap] = React.useState<Map<string, Show>>(new Map());
  const [userRooms, setUserRooms] = React.useState<ShowRoom[]>([]);
  const [myBuddyPosts, setMyBuddyPosts] = React.useState<BuddyPost[]>([]);
  const [myTicketPosts, setMyTicketPosts] = React.useState<TicketPost[]>([]);
  const [myFavorites, setMyFavorites] = React.useState<TicketFavorite[]>([]);
  const [myConversations, setMyConversations] = React.useState<TicketConversation[]>([]);
  const [chatConversation, setChatConversation] = React.useState<TicketConversation | null>(null);

  React.useEffect(() => {
    if (!isLoggedIn || !user) return;
    let cancelled = false;
    Promise.all([
      getArtistLookupMap(),
      getShowLookupMap(),
      getRoomsByUser(user.id),
      getBuddyPostsByUser(user.id),
      getTicketPostsByUser(user.id),
      getFavoritesByUser(user.id),
      getConversationsByUser(user.id),
    ]).then(([aMap, sMap, rooms, buddyPosts, ticketPosts, favorites, conversations]) => {
      if (cancelled) return;
      setArtistMap(aMap);
      setShowMap(sMap);
      setUserRooms(rooms);
      setMyBuddyPosts(buddyPosts);
      setMyTicketPosts(ticketPosts);
      setMyFavorites(favorites);
      setMyConversations(conversations);
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
    () => deriveMyShows(showStatuses, showMap),
    [showStatuses, showMap]
  );
  // 小屋分组（唯一口径 deriveMemberRooms）：
  // 当前 = 演出未结束；过往 = 曾加入且演出已结束/取消/延期；未加入的演出绝不出现
  const { current: currentRooms, past: pastRooms } = React.useMemo(
    () => deriveMemberRooms(roomMemberships, userRooms, showMap),
    [roomMemberships, userRooms, showMap]
  );
  const attendedCount = React.useMemo(
    () =>
      Object.values(showStatuses).filter((s) => s === UserShowStatus.ATTENDED)
        .length,
    [showStatuses]
  );

  // ===== 未登录态 =====
  if (!isLoggedIn || !user) {
    return (
      <main className="container-gigroom py-8 md:py-12">
        <h1 className="text-h1 mb-8 text-text-primary">个人主页</h1>
        <EmptyState
          icon={<Music2 size={48} />}
          title="登录后查看你的记录"
          description="关注的乐队、计划中的演出、加入的小屋都在这里"
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

  // ===== 已登录态 =====
  const counts = { going: going.length, interested: interested.length, attended: attended.length };

  return (
    <main className="container-gigroom py-8 md:py-12">
      <h1 className="text-h1 mb-6 text-text-primary">个人主页</h1>

      {/* Desktop：ProfileHeader 与 Tab 内容 12 列 grid 分栏，充分利用横向空间 */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-12">
        {/* 左栏：ProfileHeader（Desktop 4 列） */}
        <div className="lg:col-span-4">
          <ProfileHeader
            user={user}
            followedCount={followedArtistIds.length}
            attendedCount={attendedCount}
          />
        </div>

        {/* 右栏：二级 Tab + 内容（Desktop 8 列） */}
        <div className="lg:col-span-8 mt-8 lg:mt-0">
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
                      title="暂无已去过的演出"
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
                    />
                  ) : (
                    <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                      {currentRooms.map((r) => (
                        <ProfileRoomRow key={r.roomId} item={r} />
                      ))}
                    </div>
                  )
                ) : (
                  pastRooms.length === 0 ? (
                    <EmptyState
                      title="参加过并加入过小屋的演出结束后，会出现在这里"
                    />
                  ) : (
                    <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                      {pastRooms.map((r) => (
                        <ProfileRoomRow key={r.roomId} item={r} past />
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
                />
              ) : (
                <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                  {myBuddyPosts.map((p) => (
                    <Link
                      key={p.id}
                      href={`/show/${p.show_id}?tab=buddy&hl=${p.id}#room`}
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

          {/* ====== 出收票 Tab（出收票 / 交易消息 子 Tab） ====== */}
          {tab === "ticket" && (
            <div>
              <TabBar
                tabs={[
                  { key: "posts", label: "出收票" },
                  { key: "messages", label: "交易消息" },
                ]}
                activeKey={ticketSubTab}
                onChange={(k) => setTicketSubTab(k as TicketSubTab)}
                compact
              />
              <div className="mt-4">
                {ticketSubTab === "posts" && (
                  <div>
                    {/* 我发布的 */}
                    <div className="flex items-baseline justify-between mb-4">
                      <h2 className="text-h3 text-text-primary">我的出收票</h2>
                    </div>
                    {myTicketPosts.length === 0 ? (
                      <EmptyState
                        title="还没有发布过出收票帖"
                        description="进入某场演出的观演小屋，发布出票或收票信息"
                      />
                    ) : (
                      <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                        {myTicketPosts.map((p) => (
                          <TicketPostRow key={p.id} post={p} showCity={showMap.get(p.show_id)?.city} />
                        ))}
                      </div>
                    )}

                    {/* 我收藏的 */}
                    <div className="mt-8">
                      <h3 className="text-h3 text-text-primary mb-4">我的收藏</h3>
                      {myFavorites.length === 0 ? (
                        <EmptyState
                          title="还没有收藏的出收票帖"
                          description="在出收票帖上点收藏，方便稍后回来查看"
                        />
                      ) : (
                        <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                          {myFavorites.map((f) =>
                            f.post ? (
                              <TicketPostRow
                                key={f.id}
                                post={f.post}
                                showCity={showMap.get(f.post.show_id)?.city}
                              />
                            ) : null
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {ticketSubTab === "messages" && (
                  <div>
                    <div className="flex items-baseline justify-between mb-4">
                      <h2 className="text-h3 text-text-primary">交易消息</h2>
                    </div>
                    {myConversations.length === 0 ? (
                      <EmptyState
                        title="还没有交易消息"
                        description="在出收票帖上点「私聊」即可开始沟通"
                      />
                    ) : (
                      <div className="flex flex-col divide-y divide-border border border-border rounded-md overflow-hidden">
                        {myConversations.map((conv) => (
                          <ConversationRow
                            key={conv.id}
                            conversation={conv}
                            currentUserId={user.id}
                            onClick={() => setChatConversation(conv)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* 交易消息聊天弹窗 */}
      <TicketChatModal
        conversation={chatConversation}
        onClose={() => {
          setChatConversation(null);
          // 关闭后刷新会话列表（未读数已清零）
          if (user) {
            void getConversationsByUser(user.id).then(setMyConversations);
          }
        }}
      />
    </main>
  );
}

/** 我的出收票 / 收藏 列表行 */
function TicketPostRow({ post, showCity }: { post: TicketPost; showCity?: string }) {
  return (
    <Link
      href={`/show/${post.show_id}?tab=ticket&hl=${post.id}#room`}
      className="flex items-center gap-3 p-3 md:p-4 hover:bg-bg-secondary transition-colors"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge variant="lime" size="sm">
            {post.type === TicketPostType.SELLING ? "出票" : "收票"}
          </Badge>
          {post.status === TicketPostStatus.COMPLETED && (
            <Badge variant="grey" size="sm">
              {post.type === TicketPostType.SELLING ? "已出" : "已收到"}
            </Badge>
          )}
        </div>
        <div className="mt-1 text-sm text-text-primary line-clamp-1">
          {post.note ||
            (post.price != null
              ? `¥${post.price}${post.face_value != null ? `（原价 ¥${post.face_value}）` : ""}`
              : "面议")}
        </div>
        <div className="mt-1 text-[11px] text-text-tertiary">
          {post.quantity} 张 · {formatShowDate(post.created_at)} 发布
          {showCity ? ` · ${showCity}` : ""}
        </div>
      </div>
      <span className="shrink-0 text-sm text-accent-lime flex items-center gap-1">
        查看
        <ArrowRight size={14} />
      </span>
    </Link>
  );
}

/** 交易消息会话列表行 */
function ConversationRow({
  conversation,
  currentUserId,
  onClick,
}: {
  conversation: TicketConversation;
  currentUserId: string;
  onClick: () => void;
}) {
  const peer =
    conversation.owner_user_id === currentUserId
      ? conversation.requester
      : conversation.owner;
  const unread = conversation.unread_count ?? 0;

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 p-3 md:p-4 hover:bg-bg-secondary transition-colors text-left"
    >
      <Avatar
        src={peer?.avatar_url}
        fallbackName={peer?.display_name ?? "?"}
        size="sm"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-medium text-text-primary truncate">
            {peer?.display_name ?? "未知用户"}
          </span>
          <span className="shrink-0 text-[11px] text-text-tertiary">
            {formatRelativeTime(conversation.updated_at)}
          </span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-xs text-text-tertiary truncate">
            {conversation.last_message_preview || "暂无消息"}
          </span>
          {unread > 0 && (
            <span className="shrink-0 flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-accent-lime text-bg-primary text-[10px] font-semibold px-1">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

/** 我的小屋列表行（当前/过往共用） */
function ProfileRoomRow({ item, past = false }: { item: MemberRoomItem; past?: boolean }) {
  return (
    <Link
      href={`/show/${item.show.id}#room`}
      className="flex items-center gap-3 p-3 md:p-4 hover:bg-bg-secondary transition-colors"
    >
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary poster-border">
        {/* eslint-disable-next-line @next/next/no-img-element -- 列表内小缩略图，避免 Next Image 额外复杂性 */}
        <img
          src={item.show.poster_url || getShowPosterFallback(item.show.id)}
          alt={item.artistName}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-text-primary line-clamp-1">
          {item.artistName}
        </div>
        <div className="mt-0.5 text-xs text-text-tertiary line-clamp-1">
          {formatShowDate(item.show.date_time)} · {item.show.city}
        </div>
        <div className="mt-1 text-[11px] text-text-tertiary">
          {past
            ? `${formatShowDate(item.show.date_time)} 演出 · 查看历史记录`
            : item.activityCount > 0
              ? `${item.activityCount} 条内容`
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
