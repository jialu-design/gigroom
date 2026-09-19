"use client";

import { useCallback } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { signOut } from "@/lib/api/auth";

/**
 * useLogout（P10.1）
 *
 * 生产路径登出：
 * 1. 调用 supabase.auth.signOut()（真实清除 Supabase session）
 * 2. clearAuth() 立即清理本地 auth snapshot + pending action + 业务 mock 数据
 *    → TopNav 立即切换未登录状态（不等网络）
 *
 * signOut 失败（如环境变量未配置 / 网络错误）不阻塞本地清理：
 * 本地状态仍立即清除，避免用户卡在「已登录」无法登出。
 * 真实 Supabase 未配置时 signOut 会抛错，此处 catch 后继续 clearAuth。
 */
export function useLogout() {
  const clearAuth = useUserStore((s) => s.clearAuth);

  return useCallback(async () => {
    // 先清理本地，保证 TopNav 立即响应
    clearAuth();
    // 再调用 Supabase signOut（best effort）
    try {
      await signOut();
    } catch {
      // 环境未配置 / 网络错误：本地已清理，不阻塞
    }
  }, [clearAuth]);
}
