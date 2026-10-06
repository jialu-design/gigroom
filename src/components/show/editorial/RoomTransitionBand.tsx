"use client";

import type { Show, ShowRoom } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { getEffectiveShowState } from "@/lib/utils/showState";

interface RoomTransitionBandProps {
  show: Show;
  room?: ShowRoom | null;
  isMember?: boolean;
  onJoinRoom?: () => void;
  className?: string;
}

/**
 * ⑧ Show → Community 转场带
 * 标题层级：小 eyebrow「GIGROOM」+ 大标题「观演小屋」（不合并成长标题）。
 * CTA 口径：「进入观演小屋」/「加入观演小屋」；已结束/取消/延期不提供加入。
 * 下方紧接既有 ShowRoomFrame（四 Tab 零改动）。
 */
export function RoomTransitionBand({
  show,
  room,
  isMember,
  onJoinRoom,
  className,
}: RoomTransitionBandProps) {
  const state = getEffectiveShowState(show);
  const activityCount =
    (room?.message_count ?? 0) +
    (room?.buddy_post_count ?? 0) +
    (room?.ticket_post_count ?? 0) +
    (room?.live_post_count ?? 0);

  return (
    <section
      className={cn("mt-16 border-t border-accent-lime bg-bg-secondary", className)}
      aria-label="观演小屋转场"
    >
      <div className="p-6 lg:p-10">
        <p className="text-[10px] font-mono tracking-[0.35em] text-text-tertiary mb-2">
          GIGROOM
        </p>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-text-primary">
              观演小屋
            </h2>
            <p className="mt-2 text-sm text-text-secondary">
              演出前集合，演出后留念
              {room && (
                <span className="text-text-tertiary">
                  {" "}
                  · 成员 <span className="font-bold text-text-primary tabular-nums">{room.member_count ?? 0}</span>
                  {" "}
                  · 活跃 <span className="font-bold text-text-primary tabular-nums">{activityCount}</span>
                </span>
              )}
            </p>
          </div>

          {!state.canJoinRoom ? null : isMember ? (
            <a href="#room" className="text-accent-green text-sm font-bold inline-flex items-center gap-1">
              ✓ 已加入观演小屋
            </a>
          ) : (
            <Button variant="primary" size="lg" onClick={onJoinRoom}>
              加入观演小屋
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
