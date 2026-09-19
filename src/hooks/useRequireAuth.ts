"use client";

import { useCallback } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";

/**
 * useRequireAuth（P7.2：onboarding 统一判断）
 *
 * 所有需要登录的互动统一通过此入口触发，避免散落 if (!user/!onboarding) 判断。
 *
 * 规则：
 * - 未登录：保存 action + 打开 LoginModal
 * - 已登录但 onboarding 未完成：保存 action + 打开 OnboardingModal
 *   （如果用户在 Login→注册/未 onboard 后再次触发，也会直接走此路径）
 * - 已登录且 onboarding 已完成：立即执行 action
 *
 * 注意：传入的 action 应为同步触发目标 mutation 的闭包
 * （如 () => followArtist(...)）。action 内部的异步错误由调用方自行处理。
 */
export function useRequireAuth() {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const user = useUserStore((s) => s.user);
  const setPendingAuthAction = useUIStore((s) => s.setPendingAuthAction);
  const openLoginModal = useUIStore((s) => s.openLoginModal);
  const openOnboardingModal = useUIStore((s) => s.openOnboardingModal);

  return useCallback(
    (action: () => void) => {
      if (isLoggedIn && user?.onboarding_completed) {
        action();
        return;
      }
      setPendingAuthAction(action);
      if (!isLoggedIn) {
        openLoginModal();
      } else {
        // 已登录但 onboarding 未完成
        openOnboardingModal();
      }
    },
    [
      isLoggedIn,
      user?.onboarding_completed,
      setPendingAuthAction,
      openLoginModal,
      openOnboardingModal,
    ]
  );
}
