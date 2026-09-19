"use client";

import * as React from "react";
import { TopNav } from "./TopNav";
import { BottomTabNav } from "./BottomTabNav";
import { CitySelectorModal } from "./CitySelectorModal";
import { LoginModal } from "@/components/user/LoginModal";
import { OnboardingModal } from "@/components/user/OnboardingModal";
import { EditProfileModal } from "@/components/user/EditProfileModal";
import { PendingAuthExecutor } from "@/components/user/PendingAuthExecutor";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCityStore } from "@/lib/stores/useCityStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useLogout } from "@/hooks/useLogout";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * 应用级布局：
 * - 桌面（lg+）：顶部TopNav固定，内容有最大宽度容器
 * - 移动（lg-）：底部BottomTabNav固定，内容padding-bottom让出Tab高度
 *
 * P7.2：登录态统一接 useUserStore（唯一 source），城市接 useCityStore，
 * 移除 P0 遗留的本地 useState isLoggedIn 与独立城市状态。
 * TopNav 上不直接暴露 onLoginClick——统一走全局 useUIStore.openLoginModal，
 * 确保登录入口路径一致。avatar/logout 的 logout 直接委托 store。
 */
export function AppLayout({ children, className }: AppLayoutProps) {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const authLoading = useUserStore((s) => s.authLoading);
  const user = useUserStore((s) => s.user);
  const handleLogout = useLogout();
  const city = useCityStore((s) => s.city);
  const setCity = useCityStore((s) => s.setCity);
  const openLoginModal = useUIStore((s) => s.openLoginModal);
  const router = useRouter();

  // P9：unreadCount 从 notifications 派生（单一来源，不另存 badge state）
  const unreadCount = useUserStore(
    (s) => s.notifications.filter((n) => !n.is_read).length
  );

  // V1 mock交互：循环切换北上广深做城市切换演示
  const handleCityClick = () => {
    const cities = ["上海", "北京", "广州", "深圳", "成都", "杭州"];
    const i = cities.indexOf(city);
    setCity(cities[(i + 1) % cities.length]);
  };

  const handleLoginClick = () => openLoginModal();
  // 点击头像：进入个人主页（P8），登出由 Profile 页面处理
  const handleAvatarClick = () => {
    if (isLoggedIn) {
      router.push("/profile");
    } else {
      void handleLogout();
    }
  };
  // 通知点击仅跳转（不再手动清零，badge 由 store 派生实时响应）
  const handleNotifClick = () => {};

  return (
    <div className="min-h-screen flex flex-col bg-bg-primary text-text-primary">
      <TopNav
        currentCity={city}
        unreadNotificationCount={unreadCount}
        isLoggedIn={isLoggedIn}
        authLoading={authLoading}
        user={user ?? undefined}
        onCityClick={handleCityClick}
        onLoginClick={handleLoginClick}
        onAvatarClick={handleAvatarClick}
        onNotificationClick={handleNotifClick}
      />

      <main
        className={cn(
          "flex-1 flex flex-col",
          // 移动端底部Tab栏占位
          "pb-20 lg:pb-0",
          className
        )}
      >
        {children}
      </main>

      <BottomTabNav
        unreadNotificationCount={unreadCount}
        onNotificationClick={handleNotifClick}
      />

      {/* P7：全局拦截基础设施 */}
      <PendingAuthExecutor />
      <LoginModal />
      <OnboardingModal />
      <EditProfileModal />
      <CitySelectorModal />
    </div>
  );
}
