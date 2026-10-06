"use client";

import { Suspense, useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getRoomByShow, joinRoom, syncRoomMemberships } from "@/lib/api/rooms";
import { trackEvent } from "@/lib/api/events";
import { EventType, TargetType } from "@/lib/types";
import type { Show, ShowRoom, UserShowStatus } from "@/lib/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/components/ui/Toast";
import { ShowHero } from "@/components/show/ShowHero";
import { ShowRoomFrame } from "@/components/show/ShowRoomFrame";

const ROOM_TAB_KEYS = ["discussion", "buddy", "ticket", "live"] as const;
type RoomTabKey = (typeof ROOM_TAB_KEYS)[number];

/**
 * 演出详情 client 内核。
 * show 由 server 外壳（app/show/[id]/page.tsx）预取：不存在时由 server 端 notFound()
 * 返回真正的 404；本组件只处理已存在演出的交互。
 */
function ShowDetailClientInner({
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
  // P1-8: hl=<contentId> 深链落点高亮（通知/交易消息跳入时定位具体内容）
  const highlightId = searchParams.get("hl") ?? undefined;

  const handleTabChange = useCallback(
    (key: string) => {
      // Tab 与 URL 同步：支持深链直达、刷新保持、浏览器前进后退
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

  // membership 单一来源：store.roomMemberships 派生（乐观更新/刷新持久化都走 store），
  // 不再用异步 DB 查询结果覆盖，避免"已加入又变未加入"的竞态与页面上下不一致。
  const isMember = useMemo(
    () => (room ? roomMemberships.some((m) => m.room_id === room.id) : false),
    [room, roomMemberships]
  );

  // Room 数据 + 浏览事件。show 已由 server 预取，这里只依赖 showId。
  useEffect(() => {
    let cancelled = false;
    async function load() {
      const roomData = await getRoomByShow(showId);
      if (cancelled) return;
      setRoom(roomData);

      // P10.5: 记录演出浏览事件（仅登录用户，fire-and-forget）
      const currentUser = useUserStore.getState().user;
      if (currentUser) {
        void trackEvent(currentUser.id, EventType.SHOW_VIEW, TargetType.SHOW, showId);
        // 与 DB 核对成员身份：结果写入 store（单一来源），由上方 useMemo 派生 UI。
        // mock 模式下此调用为 no-op，membership 由 store 持久化数据提供。
        void syncRoomMemberships(currentUser.id);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [showId]);

  // 同步 store 变化
  useEffect(() => {
    const status = showStatuses[showId];
    setUserStatus(status ?? undefined);
  }, [showStatuses, showId]);

  const handleStatusChange = useCallback(
    (newStatus: UserShowStatus) => {
      // P7.1：通过 useRequireAuth 统一登录拦截。
      // 已登录：立即 setShowStatus；未登录：保存 pending action →
      // 打开 LoginModal → 登录成功后自动执行 setShowStatus。
      requireAuth(() => {
        // 再次点击当前已激活的状态 = 取消（切换）；
        // interested / going 是互斥单值，going 覆盖 interested。
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
    // P7.3：Join Room 统一走 useRequireAuth（登录 + onboarding 完成后自动加入）
    // P10.2-D：改走 API 层（写 Supabase/mock + sync store），userId 从 getState 取避免闭包陈旧
    // V1：加入房间只创建 RoomMembership，无票务验证门槛
    // 乐观更新由 joinRoom 内部的 store.joinRoom 即时完成，UI 从 store 派生，无需本地 state
    requireAuth(() => {
      const currentUser = useUserStore.getState().user;
      if (room && currentUser) {
        void joinRoom(showId, currentUser.id).catch(() => {
          showToast("加入观演小屋失败，请稍后重试", "error");
        });
      }
    });
  }, [requireAuth, room, showId, showToast]);

  return (
    <main className="container-gigroom py-8 md:py-12">
      {/* 返回链接 */}
      <Link
        href="/shows"
        className="inline-flex items-center gap-1 text-sm text-text-tertiary hover:text-text-primary mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        返回演出列表
      </Link>

      {/* Hero */}
      <ShowHero
        show={show}
        userShowStatus={userStatus}
        onStatusChange={handleStatusChange}
        className="mb-12"
      />

      {/* 观演小屋（?tab= 深链直达 discussion/buddy/ticket/live；?hl= 落点高亮） */}
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
    </main>
  );
}

/**
 * useSearchParams 需要 Suspense 边界（Next 14 静态生成约束）。
 * 由 server 外壳用 notFound() 兜住不存在的演出。
 */
export function ShowDetailClient({ initialShow }: { initialShow: Show }) {
  return (
    <Suspense
      fallback={
        <main className="container-gigroom py-8 md:py-12">
          <div className="animate-pulse space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-[55%_1fr] gap-12">
              <div className="aspect-[4/5] bg-bg-secondary rounded-md" />
              <div className="space-y-4 pt-8">
                <div className="h-12 w-3/4 bg-bg-secondary rounded" />
                <div className="h-6 w-1/2 bg-bg-secondary rounded" />
              </div>
            </div>
          </div>
        </main>
      }
    >
      <ShowDetailClientInner initialShow={initialShow} />
    </Suspense>
  );
}
