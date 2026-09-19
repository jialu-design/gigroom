"use client";

import * as React from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { getSession } from "@/lib/api/auth";
import { getProfile } from "@/lib/api/profile";
import { syncFollowedArtists } from "@/lib/api/follows";
import { syncRoomMemberships } from "@/lib/api/rooms";
import { createClient } from "@/lib/supabase/client";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

/**
 * AuthProvider（P10.1）
 *
 * 统一的 Supabase Auth 监听入口。整个 App 只挂载一个。
 *
 * 职责：
 * 1. App 启动：getSession() 恢复登录状态 → setAuthUser
 * 2. onAuthStateChange：SIGNED_IN / SIGNED_OUT / TOKEN_REFRESHED / USER_UPDATED
 * 3. 初始化完成后 setAuthLoading(false)，避免 TopNav 闪「未登录」
 * 4. P10.2-B：登录/session 恢复后同步用户关注列表到 store（数据来自 DB）
 *
 * 如果 Supabase 环境变量未配置（Mock 阶段 / CI），安全降级为 authLoading=false。
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const setAuthUser = useUserStore((s) => s.setAuthUser);
  const setAuthLoading = useUserStore((s) => s.setAuthLoading);
  const clearAuth = useUserStore((s) => s.clearAuth);
  const initialized = React.useRef(false);

  // 启动时恢复 session
  React.useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    let unsubscribe: (() => void) | null = null;

    (async () => {
      try {
        // 尝试恢复 session
        const { user } = await getSession();
        if (user) {
          setAuthUser(user);
          // P10.2-B: 从 DB 同步关注列表（Supabase 未配置时 no-op）
          void syncFollowedArtists(user.id);
          // P10.2-D: 从 DB 同步房间成员列表（Supabase 未配置时 no-op）
          void syncRoomMemberships(user.id);
        } else {
          setAuthLoading(false);
        }

        // 监听 auth 状态变化
        const supabase = createClient();
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event: AuthChangeEvent, session: Session | null) => {
            if (event === "SIGNED_OUT" || !session) {
              clearAuth();
              return;
            }

            // SIGNED_IN / TOKEN_REFRESHED / USER_UPDATED
            if (session.user) {
              try {
                const profile = await getProfile(session.user.id);
                setAuthUser(profile);
                // P10.2-B: 登录后从 DB 同步关注列表
                void syncFollowedArtists(profile.id);
                // P10.2-D: 登录后从 DB 同步房间成员列表
                void syncRoomMemberships(profile.id);
              } catch {
                // profile 加载失败不阻塞，保留已有状态
              }
            }
          }
        );
        unsubscribe = () => authListener.subscription.unsubscribe();
      } catch {
        // 环境变量未配置（Mock 阶段 / CI），安全降级
        setAuthLoading(false);
      }
    })();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [setAuthUser, setAuthLoading, clearAuth]);

  return React.createElement(React.Fragment, null, children);
}
