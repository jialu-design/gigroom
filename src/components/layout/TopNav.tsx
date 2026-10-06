"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MapPin, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import type { User } from "@/lib/types";

// 一级导航配置（通用）
export const PRIMARY_NAV = [
  { key: "discover", href: "/", label: "发现" },
  { key: "shows", href: "/shows", label: "演出" },
  { key: "rooms", href: "/rooms", label: "小屋" },
  { key: "profile", href: "/profile", label: "我的" },
];

/** 根据pathname判断激活的nav key */
export function getActiveNavKey(pathname: string): string {
  if (pathname === "/" || pathname === "") return "discover";
  if (pathname.startsWith("/shows") || pathname.startsWith("/show/")) return "shows";
  if (pathname.startsWith("/rooms")) return "rooms";
  if (pathname.startsWith("/profile")) return "profile";
  if (pathname.startsWith("/artists") || pathname.startsWith("/artist/")) return "discover";
  if (pathname.startsWith("/notifications")) return "discover";
  return "discover";
}

interface TopNavProps {
  /** 当前城市 */
  currentCity?: string;
  /** 未读数 */
  unreadNotificationCount?: number;
  /** 是否登录（来自 useUserStore，唯一 source） */
  isLoggedIn?: boolean;
  /** Auth 初始化 loading（避免刷新瞬间显示「未登录」一闪） */
  authLoading?: boolean;
  /** 当前用户详情（用于显示头像+fallbackName） */
  user?: User;
  /** 点击城市选择器 */
  onCityClick?: () => void;
  /** 点击通知 */
  onNotificationClick?: () => void;
  /** 点击登录按钮 */
  onLoginClick?: () => void;
  /** 点击头像（当前 mock 为登出） */
  onAvatarClick?: () => void;
}

/**
 * 桌面端顶部导航栏
 * 左侧Logo，中间四导航链接，右侧城市/通知/用户区
 *
 * P7.2：isLoggedIn / user 来自上层 AppLayout（接 useUserStore），
 * 登录后立即显示用户头像，logout 后立即恢复登录按钮；无第二套本地状态。
 */
export function TopNav({
  currentCity = "上海",
  unreadNotificationCount = 0,
  isLoggedIn = false,
  authLoading = false,
  user,
  onCityClick,
  onNotificationClick,
  onLoginClick,
  onAvatarClick,
}: TopNavProps) {
  const pathname = usePathname();
  const activeKey = getActiveNavKey(pathname);

  return (
    <header
      className="hidden lg:flex sticky top-0 z-40 w-full border-b border-border bg-bg-primary"
      role="banner"
    >
      <div className="container-gigroom flex h-16 items-center justify-between gap-6">
        {/* 左侧：Logo */}
        <Link href="/" className="shrink-0 flex items-center gap-2 group">
          <span className="font-condensed text-xl font-bold tracking-widest text-text-primary group-hover:text-accent-lime transition-colors">
            GIGROOM
          </span>
        </Link>

        {/* 中间：导航链接 */}
        <nav className="flex items-center gap-1" aria-label="主导航">
          {PRIMARY_NAV.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "relative h-16 flex items-center px-4 text-body transition-colors duration-150",
                  isActive
                    ? "text-accent-lime font-semibold"
                    : "text-text-secondary hover:text-text-primary"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
                <span
                  className={cn(
                    "absolute left-3 right-3 bottom-0 h-[2px] bg-accent-lime transition-all duration-200",
                    isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
                  )}
                  aria-hidden
                />
              </Link>
            );
          })}
        </nav>

        {/* 右侧：功能区 */}
        <div className="shrink-0 flex items-center gap-2">
          {/* 城市选择器 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onCityClick}
            className="text-text-secondary"
            aria-label={`当前城市：${currentCity}，点击切换`}
          >
            <MapPin size={16} />
            <span>{currentCity}</span>
          </Button>

          {/* 通知入口 */}
          <Link
            href="/notifications"
            onClick={onNotificationClick}
            className="relative w-10 h-10 flex items-center justify-center rounded-sm text-text-secondary hover:text-text-primary hover:bg-bg-tertiary transition-colors"
            aria-label={`通知${unreadNotificationCount > 0 ? `，${unreadNotificationCount}条未读` : ""}`}
          >
            <Bell size={19} />
            {unreadNotificationCount > 0 && (
              <span
                className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-accent-lime text-[10px] font-semibold text-bg-primary px-1"
                aria-hidden
              >
                {unreadNotificationCount > 99 ? "99+" : unreadNotificationCount}
              </span>
            )}
          </Link>

          {/* 用户区：头像 or 登录按钮（单一登录态 source）
           * authLoading 时渲染占位，避免刷新瞬间「未登录」一闪后跳到头像 */}
          {authLoading ? (
            <div
              className="ml-1 w-8 h-8 rounded-full bg-bg-tertiary animate-pulse"
              aria-label="加载中"
              aria-hidden
            />
          ) : isLoggedIn ? (
            <button
              onClick={onAvatarClick}
              className="ml-1 shrink-0 rounded-full focus-visible:outline-accent-lime outline-offset-2"
              aria-label={`已登录为${user?.display_name ?? "乐迷"}，点击登出`}
            >
              <Avatar
                size="sm"
                fallbackName={user?.display_name ?? "乐迷"}
                src={user?.avatar_url ?? null}
              />
            </button>
          ) : (
            <Button variant="primary" size="sm" onClick={onLoginClick}>
              登录
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
