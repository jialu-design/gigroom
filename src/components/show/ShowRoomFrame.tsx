"use client";

import * as React from "react";
import { LogIn } from "lucide-react";
import { TabBar, TabItem } from "@/components/ui/TabBar";
import { Button } from "@/components/ui/Button";
import type { Show, ShowRoom } from "@/lib/types";
import { ShowStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DiscussionTab } from "@/components/room/DiscussionTab";
import { BuddyTab } from "@/components/room/BuddyTab";
import { TicketTab } from "@/components/room/TicketTab";
import { LiveTab } from "@/components/room/LiveTab";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";

interface ShowRoomFrameProps {
  show: Show;
  room?: ShowRoom | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isRoomMember?: boolean;
  isLoggedIn?: boolean;
  onJoinRoom?: () => void;
  className?: string;
}

const ROOM_TABS: TabItem[] = [
  { key: "discussion", label: "讨论" },
  { key: "buddy", label: "找搭子" },
  { key: "ticket", label: "出收票" },
  { key: "live", label: "现场" },
];

/**
 * ShowRoom 框架组件
 * 保留：Room 标题、四 Tab、统计数据、游客浏览逻辑、sticky Tab
 * P5：替换占位为真实 Tab 组件
 */
export function ShowRoomFrame({
  show,
  room,
  activeTab = "discussion",
  onTabChange,
  isRoomMember,
  isLoggedIn,
  onJoinRoom,
  className,
}: ShowRoomFrameProps) {
  const [internalTab, setInternalTab] = React.useState(activeTab);
  const currentTab = onTabChange ? activeTab : internalTab;
  // 各功能独立判定发布状态，不一刀切：
  // 讨论/回复有 7 天宽限期；找搭子/票务结束即关；现场保持自有 canPostLive 规则
  const lifecycle = React.useMemo(() => getShowLifecycle(show), [show]);
  // 演出已结束（含状态滞后、日期已过）或取消/延期：停止新用户加入，已加入成员仍可查看历史
  const joinClosed =
    lifecycle.hasEnded ||
    show.status === ShowStatus.CANCELLED ||
    show.status === ShowStatus.POSTPONED;

  const handleTabChange = (key: string) => {
    if (onTabChange) {
      onTabChange(key);
    } else {
      setInternalTab(key);
    }
  };

  return (
    <section id="room" className={cn("scroll-mt-20", className)}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-text-primary tracking-tight flex items-center gap-2">
          <span className="w-1 h-4 bg-accent-lime rounded-sm inline-block" />
          观演小屋
        </h2>
        <div className="flex items-center gap-3 text-xs">
          {room && (
            <span className="text-text-secondary">
              <span className="font-bold text-text-primary">{room.member_count ?? 0}</span> 已加入
            </span>
          )}
          {isRoomMember ? (
            <span className="text-accent-green">✓ 已加入</span>
          ) : (
            <span className="text-text-tertiary">游客可浏览</span>
          )}
        </div>
      </div>

      {/* Tab 导航 */}
      <div className="sticky top-0 z-10 bg-bg-primary/95 border-b border-border mb-4">
        <TabBar
          tabs={ROOM_TABS}
          activeKey={currentTab}
          onChange={handleTabChange}
        />
      </div>

      {/* 未加入 Room 提示（已结束/取消/延期的演出不再提供加入入口） */}
      {!isRoomMember && (
        joinClosed ? (
          <div className="mb-3 rounded-sm border border-border bg-bg-secondary px-3 py-2 text-center">
            <p className="text-xs text-text-tertiary">
              演出已结束，无法加入观演小屋；曾加入的成员可在「我的 → 小屋 →
              过往观演小屋」查看历史记录
            </p>
          </div>
        ) : (
          <div className="mb-3 rounded-sm border border-dashed border-accent-lime/40 bg-accent-lime/5 px-3 py-2 text-center">
            <p className="text-xs text-text-secondary mb-2">
              游客可浏览小屋内容，加入后可参与互动
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={onJoinRoom}
              className="mx-auto"
            >
              <LogIn size={14} />
              {isLoggedIn ? "加入观演小屋" : "登录并加入小屋"}
            </Button>
          </div>
        )
      )}

      {/* Tab 内容 */}
      <div>
        {currentTab === "discussion" && (
          <DiscussionTab showId={show.id} roomId={room?.id} isMember={!!isRoomMember} locked={!lifecycle.canDiscuss} />
        )}
        {currentTab === "buddy" && (
          <BuddyTab
            showId={show.id}
            roomId={room?.id}
            isMember={!!isRoomMember}
            createLocked={!lifecycle.canPostBuddyTicket}
            replyLocked={!lifecycle.canDiscuss}
          />
        )}
        {currentTab === "ticket" && (
          <TicketTab
            showId={show.id}
            roomId={room?.id}
            isMember={!!isRoomMember}
            createLocked={!lifecycle.canPostBuddyTicket}
            replyLocked={!lifecycle.canDiscuss}
          />
        )}
        {currentTab === "live" && (
          <LiveTab show={show} roomId={room?.id} isMember={!!isRoomMember} />
        )}
      </div>
    </section>
  );
}
