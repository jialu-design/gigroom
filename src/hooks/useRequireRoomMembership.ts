"use client";

import { useCallback } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";

/**
 * useRequireRoomMembership（P7.3：统一房间互动权限）
 *
 * 所有观演小屋内需要"登录 + 已加入"才能执行的操作统一通过此入口触发，
 * 避免散落 if (!isLoggedIn) / if (!isMember) 判断。
 *
 * 规则：
 * - 未登录 / 已登录但 onboarding 未完成：
 *     走 useRequireAuth（保存 action + 打开 LoginModal / OnboardingModal）
 *     登录/Onboarding 完成后，PendingAuthExecutor 自动执行 wrappedAction，
 *     wrappedAction 会再次检查 membership（新用户登录后默认未加入房间 → toast 提示）
 * - 已登录且 onboarding 已完成但未加入房间：
 *     不执行 action，toast 提示"加入观演小屋后才能参与互动"
 * - 已登录且 onboarding 已完成且已加入房间：执行 action
 *
 * 用法：
 *   const requireRoomMembership = useRequireRoomMembership();
 *   requireRoomMembership(roomId, () => { sendMessage(...); });
 *
 * 注意：举报等只需登录、不需要 membership 的操作请直接使用 useRequireAuth。
 * Join Room 本身也直接使用 useRequireAuth（因为它就是加入房间的动作）。
 */
export function useRequireRoomMembership() {
  const requireAuth = useRequireAuth();
  const { showToast } = useToast();

  return useCallback(
    (roomId: string, action: () => void) => {
      // 包装一层 membership 检查：登录恢复后也会重新读取最新 membership
      const wrappedAction = () => {
        const isMember = useUserStore
          .getState()
          .roomMemberships.some((m) => m.room_id === roomId);
        if (!isMember) {
          showToast("加入观演小屋后才能参与互动", "warning");
          return;
        }
        action();
      };
      requireAuth(wrappedAction);
    },
    [requireAuth, showToast]
  );
}
