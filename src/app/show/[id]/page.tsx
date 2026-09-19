"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getShowById } from "@/lib/api/shows";
import { getRoomByShow, joinRoom, syncRoomMemberships } from "@/lib/api/rooms";
import { getAnnouncementsByShow } from "@/lib/api/announcements";
import { trackEvent } from "@/lib/api/events";
import { EventType, TargetType } from "@/lib/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useToast } from "@/components/ui/Toast";
import { ShowHero } from "@/components/show/ShowHero";
import { AnnouncementList } from "@/components/show/AnnouncementList";
import { ShowRoomFrame } from "@/components/show/ShowRoomFrame";
import type { Show, ShowRoom, UserShowStatus, Announcement } from "@/lib/types";

export default function ShowDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const showId = params.id;

  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const showStatuses = useUserStore((s) => s.showStatuses);
  const roomMemberships = useUserStore((s) => s.roomMemberships);
  const setShowStatus = useUserStore((s) => s.setShowStatus);
  const removeShowStatus = useUserStore((s) => s.removeShowStatus);
  const requireAuth = useRequireAuth();
  const { showToast } = useToast();

  const [show, setShow] = useState<Show | null>(null);
  const [room, setRoom] = useState<ShowRoom | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [userStatus, setUserStatus] = useState<UserShowStatus | undefined>();
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // membership 单一来源：store.roomMemberships 派生（乐观更新/刷新持久化都走 store），
  // 不再用异步 DB 查询结果覆盖，避免"已加入又变未加入"的竞态与页面上下不一致。
  const isMember = useMemo(
    () => (room ? roomMemberships.some((m) => m.room_id === room.id) : false),
    [room, roomMemberships]
  );

  // 加载基础数据 —— 只依赖 showId。
  // 注意：不能把 user/showStatuses/roomMemberships 放入依赖，
  // 否则点击「感兴趣/我要去/加入房间」会触发整页 setLoading(true) 重新加载（闪退/闪烁）。
  // 用户状态与 membership 的 UI 同步由 store 派生值负责。
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const [showData, roomData, annData] = await Promise.all([
        getShowById(showId),
        getRoomByShow(showId),
        getAnnouncementsByShow(showId),
      ]);
      if (cancelled) return;

      if (!showData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setShow(showData);
      setRoom(roomData);
      setAnnouncements(annData);

      // P10.5: 记录演出浏览事件（仅登录用户，fire-and-forget）
      const currentUser = useUserStore.getState().user;
      if (currentUser) {
        void trackEvent(currentUser.id, EventType.SHOW_VIEW, TargetType.SHOW, showId);
        // 与 DB 核对成员身份：结果写入 store（单一来源），由上方 useMemo 派生 UI。
        // mock 模式下此调用为 no-op，membership 由 store 持久化数据提供。
        void syncRoomMemberships(currentUser.id);
      }

      setLoading(false);
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
          showToast("加入小屋失败，请稍后重试", "error");
        });
      }
    });
  }, [requireAuth, room, showId, showToast]);

  // Loading 状态
  if (loading) {
    return (
      <main className="container-gigroom py-8 md:py-12">
        <div className="animate-pulse space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-[55%_1fr] gap-12">
            <div className="aspect-[4/5] bg-bg-secondary rounded-md" />
            <div className="space-y-4 pt-8">
              <div className="h-12 w-3/4 bg-bg-secondary rounded" />
              <div className="h-6 w-1/2 bg-bg-secondary rounded" />
              <div className="h-5 w-2/3 bg-bg-secondary rounded" />
              <div className="h-5 w-1/3 bg-bg-secondary rounded" />
              <div className="h-16 w-full bg-bg-secondary rounded mt-8" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Not Found
  if (notFound || !show) {
    return (
      <main className="container-gigroom py-12 md:py-16">
        <div className="text-center py-20">
          <h1 className="text-6xl font-bold text-text-primary mb-4">404</h1>
          <p className="text-xl text-text-secondary mb-2">
            这场演出可能已经结束了
          </p>
          <p className="text-sm text-text-tertiary mb-8">
            你访问的演出页面不存在或已被移除
          </p>
          <Link
            href="/shows"
            className="inline-flex items-center gap-2 text-accent-lime hover:text-accent-lime-hover font-medium"
          >
            <ArrowLeft size={16} />
            返回演出列表
          </Link>
        </div>
      </main>
    );
  }

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
        className="mb-16"
      />

      {/* 官方公告 */}
      {announcements.length > 0 && (
        <AnnouncementList
          announcements={announcements}
          className="mb-16"
        />
      )}

      {/* 观演小屋 */}
      <ShowRoomFrame
        show={show}
        room={room}
        isRoomMember={isMember}
        isLoggedIn={isLoggedIn}
        onJoinRoom={handleJoinRoom}
      />
    </main>
  );
}
