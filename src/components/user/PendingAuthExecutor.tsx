"use client";

import { useEffect, useRef } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";

/**
 * PendingAuthExecutor
 *
 * 全局挂载的不可见组件，监听状态转换：
 * - 已登录 + onboarding_completed 从 false→true 的「就绪转换」 + 有 pendingAction
 *   → 执行一次并清空 pending action
 * - 仅在新「就绪」时执行，避免用户中途 rerender 重复执行
 * - 已登录但 onboarding 未完成 → 自动打开 OnboardingModal（不丢 pending）
 * - pending 在登录+onboarding 成功路径由本组件清空；用户取消 / 登出 / LoginModal
 *   关闭路径分别由 cancelLoginModal / logout / cancelLoginModal 清空
 *
 * 通过 prevReady ref 识别「就绪转换」，保证每个 pending action 只执行一次，
 * StrictMode 双调用安全（先 clear 再 run + 转换标记）。
 *
 * 需在应用根布局（AppLayout）挂载一次。
 */
export function PendingAuthExecutor() {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn);
  const user = useUserStore((s) => s.user);
  const pendingAction = useUIStore((s) => s.pendingAuthAction);
  const clearPendingAuthAction = useUIStore((s) => s.clearPendingAuthAction);
  const openOnboardingModal = useUIStore((s) => s.openOnboardingModal);
  const isOnboardingOpen = useUIStore((s) => s.isOnboardingModalOpen);

  const prevReady = useRef(false);
  const onboardingOpenedRef = useRef(false);

  useEffect(() => {
    const onboardingCompleted = !!user?.onboarding_completed;
    const ready = isLoggedIn && onboardingCompleted;
    const wasReady = prevReady.current;

    // (a) 就绪转换 + pending → 执行一次（先清空再执行，防重复）
    if (ready && !wasReady && pendingAction) {
      const action = pendingAction;
      clearPendingAuthAction();
      try {
        action();
      } catch {
        // action 内部应自行处理错误；此处兜底避免抛出打断渲染
      }
    }

    // (b) 已登录但未 onboard → 自动打开 OnboardingModal 一次，不丢 pending
    if (
      isLoggedIn &&
      !onboardingCompleted &&
      pendingAction &&
      !isOnboardingOpen &&
      !onboardingOpenedRef.current
    ) {
      onboardingOpenedRef.current = true;
      openOnboardingModal();
    }

    // (c) 状态正常：回到可再次开 onboard 的初始标记
    if (!isLoggedIn || onboardingCompleted) {
      onboardingOpenedRef.current = false;
    }

    prevReady.current = ready;
  }, [
    isLoggedIn,
    user?.onboarding_completed,
    pendingAction,
    isOnboardingOpen,
    clearPendingAuthAction,
    openOnboardingModal,
  ]);

  return null;
}
