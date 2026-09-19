"use client";

import * as React from "react";
import { Plus, Check } from "lucide-react";
import { followArtist, unfollowArtist } from "@/lib/api/follows";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { cn } from "@/lib/utils";

interface FollowButtonProps {
  artistId: string;
  artistName?: string;
  size?: "sm" | "md";
  className?: string;
  /** 停止冒泡（嵌入可点击卡片时使用，避免同时跳转详情） */
  stopPropagation?: boolean;
  /**
   * 跳过 useRequireAuth 鉴权门控，直接执行 toggle。
   * 仅用于用户已确定登录的场景（如 OnboardingModal 内：
   * 用户已登录但 onboarding_completed=false，此时不应再被
   * useRequireAuth 拦回去开 OnboardingModal）。
   */
  bypassAuthGate?: boolean;
}

/**
 * 乐队关注按钮（统一组件）
 *
 * 关注状态唯一来源：useUserStore.followedArtistIds。
 * ArtistCardSmall / ArtistCard / ArtistHeader 均使用本组件，避免三套本地状态。
 *
 * P7.1：通过 useRequireAuth 统一登录拦截。
 * - 已登录：立即 toggle
 * - 未登录：保存 pending action → 打开 LoginModal → 登录成功后自动执行 toggle
 *
 * pending action 内部通过 useUserStore.getState() 读取最新 user/isFollowed，
 * 避免闭包捕获到登录前的陈旧值（user=null）。
 */
export function FollowButton({
  artistId,
  artistName,
  size = "md",
  className,
  stopPropagation = true,
  bypassAuthGate = false,
}: FollowButtonProps) {
  const isFollowed = useUserStore((s) =>
    s.followedArtistIds.includes(artistId)
  );
  const requireAuth = useRequireAuth();
  const { showToast } = useToast();
  const [pending, setPending] = React.useState(false);

  const doToggle = React.useCallback(async () => {
    // 读取最新状态（pending action 可能在登录后才执行，避免陈旧闭包）
    const state = useUserStore.getState();
    const user = state.user;
    if (!user) return;
    const followed = state.followedArtistIds.includes(artistId);
    setPending(true);
    try {
      if (followed) {
        await unfollowArtist(user.id, artistId);
        showToast(`已取消关注${artistName ? ` ${artistName}` : ""}`, "info");
      } else {
        await followArtist(user.id, artistId);
        showToast(`已关注${artistName ? ` ${artistName}` : ""}`, "success");
      }
    } catch {
      showToast("操作失败，请重试", "error");
    } finally {
      setPending(false);
    }
  }, [artistId, artistName, showToast]);

  const handleClick = (e: React.MouseEvent) => {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (pending) return;
    // OnboardingModal 内：用户已登录，跳过 useRequireAuth 门控直接执行
    if (bypassAuthGate) {
      void doToggle();
      return;
    }
    requireAuth(() => {
      void doToggle();
    });
  };

  const isSm = size === "sm";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-pressed={isFollowed}
      aria-label={isFollowed ? `取消关注${artistName ?? ""}` : `关注${artistName ?? ""}`}
      className={cn(
        "inline-flex items-center justify-center gap-1 font-medium rounded-sm transition-colors duration-150 select-none whitespace-nowrap disabled:opacity-50",
        isSm
          ? "h-7 px-2.5 text-xs min-h-0"
          : "h-9 px-3 text-sm min-h-[44px]",
        isFollowed
          ? "border border-border bg-bg-tertiary text-text-secondary hover:border-border-light hover:text-text-primary"
          : "bg-accent-lime text-bg-primary hover:bg-accent-lime-hover",
        className
      )}
    >
      {isFollowed ? (
        <>
          <Check size={isSm ? 12 : 14} />
          已关注
        </>
      ) : (
        <>
          <Plus size={isSm ? 12 : 14} />
          关注
        </>
      )}
    </button>
  );
}
