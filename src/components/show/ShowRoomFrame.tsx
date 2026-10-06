"use client";

import * as React from "react";
import { LogIn } from "lucide-react";
import { TabBar, TabItem } from "@/components/ui/TabBar";
import { Button } from "@/components/ui/Button";
import type { Show, ShowRoom } from "@/lib/types";
import { cn } from "@/lib/utils";
import { DiscussionTab } from "@/components/room/DiscussionTab";
import { BuddyTab } from "@/components/room/BuddyTab";
import { TicketTab } from "@/components/room/TicketTab";
import { LiveTab } from "@/components/room/LiveTab";
import { getEffectiveShowState } from "@/lib/utils/showState";

interface ShowRoomFrameProps {
  show: Show;
  room?: ShowRoom | null;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isRoomMember?: boolean;
  isLoggedIn?: boolean;
  onJoinRoom?: () => void;
  /** P1-8: 深链 hl=<contentId>，定位并短暂高亮对应内容 */
  highlightId?: string;
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
  highlightId,
  className,
}: ShowRoomFrameProps) {
  const [internalTab, setInternalTab] = React.useState(activeTab);
  // 受控/非受控均需响应外部 activeTab 变化（?tab= 深链、浏览器前进后退）
  React.useEffect(() => {
    if (!onTabChange) setInternalTab(activeTab);
  }, [activeTab, onTabChange]);
  const currentTab = onTabChange ? activeTab : internalTab;
  // 统一状态口径（唯一真相 utils/showState）：
  // 各功能独立判定，不一刀切：讨论有 7 天宽限期；找搭子/票务结束即关；现场保持自有规则
  const state = React.useMemo(() => getEffectiveShowState(show), [show]);
  // 演出已结束（含状态滞后、日期已过）或取消/延期：停止新用户加入，已加入成员仍可查看历史
  const joinClosed = !state.canJoinRoom;

  const sectionRef = React.useRef<HTMLElement>(null);

  // P1-8: 深链落点定位。内容为异步加载，轮询等待元素出现（最多 ~3s），
  // 命中后滚动到视口中央并短暂高亮（.content-flash，2s）。
  React.useEffect(() => {
    if (!highlightId) return;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = () => {
      tries += 1;
      const el = sectionRef.current?.querySelector<HTMLElement>(
        `[data-content-id="${CSS.escape(highlightId)}"]`
      );
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("content-flash");
        setTimeout(() => el.classList.remove("content-flash"), 2000);
        return;
      }
      if (tries < 15) timer = setTimeout(poll, 200);
    };
    timer = setTimeout(poll, 200);
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [highlightId, currentTab]);

  const handleTabChange = (key: string) => {
    if (onTabChange) {
      onTabChange(key);
    } else {
      setInternalTab(key);
    }
  };

  return (
    <section id="room" ref={sectionRef} className={cn("scroll-mt-20", className)}>
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

      {/* Tab 导航：top-16 避开 TopNav（h-16 z-40） */}
      <div className="sticky top-16 z-30 bg-bg-primary/95 border-b border-border mb-4">
        <TabBar
          tabs={ROOM_TABS}
          activeKey={currentTab}
          onChange={handleTabChange}
        />
      </div>

      {/* 已加入成员 + 演出已结束：详情页直接浏览历史记录，无需跳转「我的演出」。
          各 Tab 按各自门禁自动转只读（讨论 7 天宽限期、现场仍可补发为既定规则）。 */}
      {isRoomMember && joinClosed && (
        <div className="mb-3 rounded-sm border border-border bg-bg-secondary px-3 py-2 text-center">
          <p className="text-xs text-text-tertiary">
            {state.bucket === "cancelled"
              ? "演出已取消，以下为小屋历史记录"
              : state.bucket === "postponed"
                ? "演出已延期，新内容暂已关闭"
                : "演出已结束，这里保留小屋的历史记录"}
          </p>
        </div>
      )}

      {/* 未加入 Room 提示（已结束/取消/延期的演出不再提供加入入口） */}
      {!isRoomMember && (
        joinClosed ? (
          <div className="mb-3 rounded-sm border border-border bg-bg-secondary px-3 py-2 text-center">
            <p className="text-xs text-text-tertiary">
              {state.bucket === "cancelled"
                ? "演出已取消，小屋未开放加入"
                : state.bucket === "postponed"
                  ? "演出已延期，小屋暂不开放加入"
                  : "演出已结束，无法加入观演小屋"}
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
              {isLoggedIn ? "加入观演小屋" : "登录并加入观演小屋"}
            </Button>
          </div>
        )
      )}

      {/* Tab 内容（阅读区限宽 max-w-3xl） */}
      <div className="max-w-3xl">
        {currentTab === "discussion" && (
          <DiscussionTab showId={show.id} roomId={room?.id} isMember={!!isRoomMember} locked={!state.canDiscuss} />
        )}
        {currentTab === "buddy" && (
          <BuddyTab
            showId={show.id}
            roomId={room?.id}
            isMember={!!isRoomMember}
            createLocked={!state.canPostBuddyTicket}
            replyLocked={!state.canDiscuss}
          />
        )}
        {currentTab === "ticket" && (
          <TicketTab
            showId={show.id}
            roomId={room?.id}
            isMember={!!isRoomMember}
            createLocked={!state.canPostBuddyTicket}
            replyLocked={!state.canDiscuss}
            maxKnownPrice={(() => {
              const prices = [show.price_presale, show.price_door].filter(
                (p): p is number => typeof p === "number"
              );
              return prices.length > 0 ? Math.max(...prices) : undefined;
            })()}
          />
        )}
        {currentTab === "live" && (
          <LiveTab show={show} roomId={room?.id} isMember={!!isRoomMember} />
        )}
      </div>
    </section>
  );
}
