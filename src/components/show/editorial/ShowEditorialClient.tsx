"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRoomByShow, joinRoom, syncRoomMemberships } from "@/lib/api/rooms";
import { trackEvent } from "@/lib/api/events";
import { getArtistEditorial } from "@/lib/api/artistEditorial";
import { EventType, TargetType } from "@/lib/types";
import type {
  ArtistEditorial,
  EditorialPhoto,
  Show,
  ShowRoom,
  UserShowStatus,
} from "@/lib/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/components/ui/Toast";
import { ShowRoomFrame } from "@/components/show/ShowRoomFrame";
import { EditorialHero } from "./EditorialHero";
import { FactsStrip } from "./FactsStrip";
import { LineupBlock } from "./LineupBlock";
import { AboutArtistBlock } from "./AboutArtistBlock";
import { PastPhotosBlock } from "./PastPhotosBlock";
import { FanImpressionsBlock } from "./FanImpressionsBlock";
import { DigitalTicketPanel } from "./DigitalTicketPanel";
import { RoomTransitionBand } from "./RoomTransitionBand";
import { MobileTicketBar } from "./MobileTicketBar";

const ROOM_TAB_KEYS = ["discussion", "buddy", "ticket", "live"] as const;
type RoomTabKey = (typeof ROOM_TAB_KEYS)[number];

/**
 * Show Editorial Page client 内核（Show Detail redesign）。
 * 叙事：HERO → FACTS → LINEUP → ABOUT ARTIST → PAST LIVE PHOTOS →
 *        乐迷印象 → TICKET → GIGROOM · 观演小屋。
 * 交互逻辑（Room 加载/成员派生/Interested/Going/Join）与旧 ShowDetailClient
 * 完全一致；show 由 server 外壳预取，不存在时 server 端 notFound()。
 */
function ShowEditorialClientInner({
  initialShow,
}: {
  initialShow: Show;
}) {
  const show = initialShow;
  const showId = show.id;

  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab: RoomTabKey = ROOM_TAB_KEYS.includes(tabParam as RoomTabKey)
    ? (tabParam as RoomTabKey)
    : "discussion";
  // P1-8: hl=<contentId> 深链落点高亮
  const highlightId = searchParams.get("hl") ?? undefined;

  const handleTabChange = useCallback(
    (key: string) => {
      router.replace(`/show/${showId}?tab=${key}`, { scroll: false });
    },
    [router, showId]
  );

  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const showStatuses = useUserStore((s) => s.showStatuses);
  const roomMemberships = useUserStore((s) => s.roomMemberships);
  const setShowStatus = useUserStore((s) => s.setShowStatus);
  const removeShowStatus = useUserStore((s) => s.removeShowStatus);
  const requireAuth = useRequireAuth();
  const { showToast } = useToast();

  const [room, setRoom] = useState<ShowRoom | null>(null);
  const [userStatus, setUserStatus] = useState<UserShowStatus | undefined>();
  const [editorials, setEditorials] = useState<Map<string, ArtistEditorial>>(
    () => new Map()
  );

  const isMember = useMemo(
    () => (room ? roomMemberships.some((m) => m.room_id === room.id) : false),
    [room, roomMemberships]
  );

  // Room 数据 + 浏览事件（与旧内核一致）
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const roomData = await getRoomByShow(showId);
      if (cancelled) return;
      setRoom(roomData);

      const currentUser = useUserStore.getState().user;
      if (currentUser) {
        void trackEvent(currentUser.id, EventType.SHOW_VIEW, TargetType.SHOW, showId);
        void syncRoomMemberships(currentUser.id);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [showId]);

  useEffect(() => {
    const status = showStatuses[showId];
    setUserStatus(status ?? undefined);
  }, [showStatuses, showId]);

  // Artist Editorial 内容资产（仅 8 个样本有数据；经 api 层读取）
  const artistIdsKey = useMemo(
    () => (show.artists ?? []).map((a) => a.artist_id).join(","),
    [show.artists]
  );
  useEffect(() => {
    let cancelled = false;
    const ids = artistIdsKey.split(",").filter(Boolean);
    if (ids.length === 0) return;
    Promise.all(ids.map((id) => getArtistEditorial(id))).then((results) => {
      if (cancelled) return;
      const map = new Map<string, ArtistEditorial>();
      ids.forEach((id, i) => {
        const e = results[i];
        if (e) map.set(id, e);
      });
      setEditorials(map);
    });
    return () => {
      cancelled = true;
    };
  }, [artistIdsKey]);

  const handleStatusChange = useCallback(
    (newStatus: UserShowStatus) => {
      requireAuth(() => {
        const current = useUserStore.getState().showStatuses[showId];
        if (current === newStatus) {
          removeShowStatus(showId);
        } else {
          setShowStatus(showId, newStatus);
        }
      });
    },
    [requireAuth, setShowStatus, removeShowStatus, showId]
  );

  const handleJoinRoom = useCallback(() => {
    requireAuth(() => {
      const currentUser = useUserStore.getState().user;
      if (room && currentUser) {
        void joinRoom(showId, currentUser.id).catch(() => {
          showToast("加入观演小屋失败，请稍后重试", "error");
        });
      }
    });
  }, [requireAuth, room, showId, showToast]);

  // ---- Editorial 派生数据（headliner 为主） ----
  const headliner = useMemo(
    () => (show.artists ?? []).find((a) => a.role === "headliner"),
    [show.artists]
  );
  const headlinerEditorial = headliner
    ? editorials.get(headliner.artist_id)
    : undefined;
  const keyVisual = headlinerEditorial?.photos.find(
    (p): p is EditorialPhoto & { url: string } =>
      p.kind === "key_visual" && p.url !== null
  );
  const livePhotos = useMemo(
    () =>
      (headlinerEditorial?.photos ?? []).filter(
        (p): p is EditorialPhoto & { url: string } =>
          p.kind === "live" && p.url !== null
      ),
    [headlinerEditorial]
  );
  const impressions = headlinerEditorial?.fan_impressions ?? [];

  // ---- Mobile sticky 购票底栏可见性 ----
  const [ticketSeen, setTicketSeen] = useState(false);
  const [roomVisible, setRoomVisible] = useState(false);
  useEffect(() => {
    const ticketEl = document.getElementById("ed-ticket");
    const roomEl = document.getElementById("room");
    if (!ticketEl || !roomEl) return;
    const ticketObserver = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setTicketSeen(true);
      },
      { threshold: 0.1 }
    );
    const roomObserver = new IntersectionObserver(
      ([entry]) => setRoomVisible(entry.isIntersecting),
      { threshold: 0.05 }
    );
    ticketObserver.observe(ticketEl);
    roomObserver.observe(roomEl);
    return () => {
      ticketObserver.disconnect();
      roomObserver.disconnect();
    };
  }, []);
  const showMobileTicketBar = ticketSeen && !roomVisible;

  return (
    <main className="container-gigroom py-8 md:py-12">
      <Link
        href="/shows"
        className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        返回演出列表
      </Link>

      {/* ① SHOW HERO：左摄影 + 右黑板 */}
      <EditorialHero show={show} keyVisual={keyVisual} />

      {/* ② SHOW FACTS：数字锚点条 */}
      <FactsStrip
        show={show}
        userShowStatus={userStatus}
        onStatusChange={handleStatusChange}
        className="mt-8 lg:mt-10"
      />

      {/* ③—⑦ 叙事主体：Desktop 12 列（正文 8 列 + TICKET 右栏 4 列 sticky），
          Mobile 单列按叙事顺序；TICKET 在 DOM 中位于乐迷印象之后 */}
      <div className="lg:grid lg:grid-cols-12 lg:gap-x-12">
        <div className="lg:col-span-8">
          <LineupBlock show={show} className="mt-12 lg:mt-14" />
          {headlinerEditorial && (
            <AboutArtistBlock
              show={show}
              editorials={editorials}
              className="mt-12 lg:mt-14"
            />
          )}
          {livePhotos.length > 0 && (
            <PastPhotosBlock photos={livePhotos} className="mt-12 lg:mt-14" />
          )}
          {impressions.length > 0 && (
            <FanImpressionsBlock impressions={impressions} className="mt-12 lg:mt-14" />
          )}
        </div>

        {/* ⑦ TICKET：DOM 在乐迷印象之后；lg 经网格定位落右栏 sticky */}
        <aside
          id="ed-ticket"
          className="mt-12 lg:mt-14 lg:col-start-9 lg:col-span-4 lg:row-start-1 lg:row-span-4"
        >
          <div className="lg:sticky lg:top-20">
            <DigitalTicketPanel show={show} />
          </div>
        </aside>
      </div>

      {/* ⑧ Show → Community 转场带 + 既有观演小屋（四 Tab 零改动） */}
      <RoomTransitionBand
        show={show}
        room={room}
        isMember={isMember}
        onJoinRoom={handleJoinRoom}
      />
      <div className="mt-6">
        <ShowRoomFrame
          show={show}
          room={room}
          activeTab={activeTab}
          onTabChange={handleTabChange}
          isRoomMember={isMember}
          isLoggedIn={isLoggedIn}
          onJoinRoom={handleJoinRoom}
          highlightId={highlightId}
        />
      </div>

      {/* Mobile sticky 购票底栏 */}
      <MobileTicketBar show={show} visible={showMobileTicketBar} />
    </main>
  );
}

/**
 * useSearchParams 需要 Suspense 边界（Next 14 静态生成约束）。
 * 由 server 外壳用 notFound() 兜住不存在的演出。
 */
export function ShowEditorialClient({ initialShow }: { initialShow: Show }) {
  return (
    <Suspense
      fallback={
        <main className="container-gigroom py-8 md:py-12">
          <div className="animate-pulse space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="aspect-[16/10] lg:aspect-[16/9] lg:col-span-8 bg-bg-secondary" />
              <div className="lg:col-span-4 bg-bg-secondary p-8 space-y-4">
                <div className="h-6 w-1/3 bg-bg-primary rounded" />
                <div className="h-12 w-3/4 bg-bg-primary rounded" />
                <div className="h-4 w-1/2 bg-bg-primary rounded" />
              </div>
            </div>
            <div className="h-24 border-y border-border" />
          </div>
        </main>
      }
    >
      <ShowEditorialClientInner initialShow={initialShow} />
    </Suspense>
  );
}
