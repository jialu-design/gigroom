"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { Compass, Music2, MessageCircleHeart, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getActiveNavKey, PRIMARY_NAV } from "./TopNav";

interface BottomTabNavProps {
  unreadNotificationCount?: number;
  onNotificationClick?: () => void;
}

const tabIcons: Record<string, LucideIcon> = {
  discover: Compass,
  shows: Music2,
  rooms: MessageCircleHeart,
  profile: User,
};

/**
 * 移动端底部Tab栏（lg以下显示）
 * 4个一级Tab + 右上角通知入口（悬浮在最后一个Tab上方）
 */
export function BottomTabNav({
  unreadNotificationCount = 0,
  onNotificationClick,
}: BottomTabNavProps) {
  const pathname = usePathname();
  const activeKey = getActiveNavKey(pathname);

  return (
    <nav
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-bg-primary/95 backdrop-blur"
      role="navigation"
      aria-label="移动端主导航"
    >
      <ul className="flex items-stretch justify-around h-16 safe-area-pb">
        {PRIMARY_NAV.map((item) => {
          const Icon = tabIcons[item.key] ?? Compass;
          const isActive = item.key === activeKey;
          // "我的" tab 位置显示通知badge（P9接入，为了视觉对称：通知入口在我的tab右上角叠加）
          const showBadgeOnProfile =
            item.key === "profile" && unreadNotificationCount > 0;

          return (
            <li key={item.key} className="flex-1 relative">
              <Link
                href={item.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 h-full min-h-[56px] transition-colors duration-150",
                  isActive ? "text-accent-lime" : "text-text-tertiary hover:text-text-secondary"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={22} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>

              {/* 通知入口叠加在"我的"tab右上角（P9） */}
              {showBadgeOnProfile && (
                <Link
                  href="/notifications"
                  onClick={onNotificationClick}
                  className="absolute top-2 right-[calc(50%-34px)] z-10"
                  aria-label={`${unreadNotificationCount}条未读通知`}
                >
                  <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent-lime text-[10px] font-semibold text-bg-primary px-1 border-2 border-bg-primary">
                    {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
                  </span>
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
