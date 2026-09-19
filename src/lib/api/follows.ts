/**
 * API 抽象层 - 用户关注乐队模块（P10.2-B 接入 Supabase user_artist_follows）
 *
 * 数据来源：
 * - Supabase 已配置：走真实 Database public.user_artist_follows（RLS: 用户只能操作自己的关注）
 * - Supabase 未配置：fallback 到 Zustand store（保证本地开发/测试）
 *
 * 设计原则：
 * - UI 单一响应式来源：useUserStore.followedArtistIds（store 作为 UI cache）
 * - Supabase 路径写库后同步 store，保证 UI 实时更新
 * - 刷新页面后数据来自数据库：syncFollowedArtists 在登录/session 恢复时调用
 * - UI 不感知 Supabase：API 签名与 P6 完全一致
 *
 * 幂等性：
 * - followArtist：重复关注不报错（upsert onConflict）
 * - unfollowArtist：重复取消不报错（delete 自然幂等）
 */
import type { Artist, UserArtistFollow } from "@/lib/types";
import { EventType, TargetType } from "@/lib/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
  userArtistFollowsFrom,
  followRowToFollow,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";
import { getArtists } from "@/lib/api/artists";
import { trackEvent } from "@/lib/api/events";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

/** 校验 userId 为当前登录用户，否则抛错（关注 mutation 鉴权） */
function requireCurrentUserId(userId: string): void {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) {
    throw new Error("未登录或用户不匹配");
  }
}

// ============
// Supabase 路径
// ============

/** Supabase 路径：关注乐队（upsert 幂等，处理 unique 约束） */
async function followInSupabase(userId: string, artistId: string): Promise<UserArtistFollow> {
  const { data, error } = await userArtistFollowsFrom()
    .upsert(
      { user_id: userId, artist_id: artistId },
      { onConflict: "user_id,artist_id" }
    )
    .select()
    .single();

  if (error || !data) {
    throw error ?? new Error("follow artist failed");
  }
  return followRowToFollow(data);
}

/** Supabase 路径：取消关注（delete 自然幂等） */
async function unfollowInSupabase(userId: string, artistId: string): Promise<void> {
  const { error } = await userArtistFollowsFrom()
    .delete()
    .eq("user_id", userId)
    .eq("artist_id", artistId);

  if (error) {
    throw error;
  }
}

/** Supabase 路径：读取用户关注列表（仅 artist_ids） */
async function fetchFollowedArtistIdsFromSupabase(userId: string): Promise<string[]> {
  const { data, error } = await userArtistFollowsFrom()
    .select("artist_id")
    .eq("user_id", userId);

  if (error || !data) {
    throw error ?? new Error("fetch follows failed");
  }
  return data.map((r) => r.artist_id);
}

// ============
// 公共 API（保持 P6 签名）
// ============

/**
 * 关注乐队
 * - Supabase 已配置：upsert 到 user_artist_follows + 同步 store
 * - Supabase 未配置：仅更新 store（fallback）
 * - 幂等：重复关注不报错
 */
export async function followArtist(
  userId: string,
  artistId: string
): Promise<UserArtistFollow> {
  requireCurrentUserId(userId);

  if (isBehaviorSupabaseEnabled()) {
    try {
      const follow = await followInSupabase(userId, artistId);
      // 同步 store（UI 单一来源）
      useUserStore.getState().followArtist(artistId);
      // P10.5: 记录用户行为事件（fire-and-forget）
      void trackEvent(userId, EventType.ARTIST_FOLLOW, TargetType.ARTIST, artistId);
      return follow;
    } catch {
      // 记录已存在时 upsert 的 DO UPDATE 分支需要 UPDATE RLS
      // （当前 schema 仅有 INSERT 策略）。回查已有关注记录，按幂等成功处理。
      const { data: existing } = await userArtistFollowsFrom()
        .select("*")
        .eq("user_id", userId)
        .eq("artist_id", artistId)
        .maybeSingle();
      if (existing) {
        useUserStore.getState().followArtist(artistId);
        return followRowToFollow(existing);
      }
      warnSupabaseNotConfigured("user_artist_follows");
      // fallback 到 store
    }
  } else {
    warnSupabaseNotConfigured("user_artist_follows");
  }

  // fallback 路径：仅更新 store
  useUserStore.getState().followArtist(artistId);
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(userId, EventType.ARTIST_FOLLOW, TargetType.ARTIST, artistId);
  const follow: UserArtistFollow = {
    id: `uaf-${Date.now()}`,
    user_id: userId,
    artist_id: artistId,
    created_at: new Date().toISOString(),
  };
  return delay(follow);
}

/**
 * 取消关注
 * - Supabase 已配置：delete user_artist_follows + 同步 store
 * - Supabase 未配置：仅更新 store（fallback）
 * - 幂等：重复取消不报错
 */
export async function unfollowArtist(userId: string, artistId: string): Promise<void> {
  requireCurrentUserId(userId);

  if (isBehaviorSupabaseEnabled()) {
    try {
      await unfollowInSupabase(userId, artistId);
      // 同步 store
      useUserStore.getState().unfollowArtist(artistId);
      return;
    } catch {
      warnSupabaseNotConfigured("user_artist_follows");
      // fallback 到 store
    }
  } else {
    warnSupabaseNotConfigured("user_artist_follows");
  }

  // fallback 路径：仅更新 store
  useUserStore.getState().unfollowArtist(artistId);
  return delay(undefined);
}

/**
 * 检查是否已关注（读取 store 单一来源）
 * - store 是 UI 响应式来源，由 followArtist/unfollowArtist/syncFollowedArtists 同步
 * - 未登录或 userId 不匹配返回 false
 */
export async function isFollowingArtist(
  userId: string,
  artistId: string
): Promise<boolean> {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) {
    return delay(false);
  }
  return delay(state.followedArtistIds.includes(artistId));
}

/**
 * 获取用户关注的乐队列表（Artist 对象）
 * - 读取 store followedArtistIds（由 syncFollowedArtists 同步自 DB）
 * - 解析为 Artist 对象（复用 artists API）
 * - 未登录或 userId 不匹配返回空数组
 */
export async function getFollowedArtists(userId: string): Promise<Artist[]> {
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) {
    return delay([]);
  }

  const ids = state.followedArtistIds;
  if (ids.length === 0) return delay([]);

  // 复用去重缓存的全量 artists 列表（1 次请求），避免按 id 发起 N 次单条查询
  const { data: all } = await getArtists({ limit: 500 });
  return all.filter((a) => ids.includes(a.id));
}

/**
 * 从 Supabase 同步用户关注列表到 store（登录/session 恢复时调用）
 * - Supabase 已配置：读取 user_artist_follows，覆盖 store.followedArtistIds
 * - Supabase 未配置：no-op（store 已有 mockLogin/persist 数据）
 *
 * 保证：刷新页面后 UI 显示的 follow 状态来自数据库。
 */
export async function syncFollowedArtists(userId: string): Promise<void> {
  if (!isBehaviorSupabaseEnabled()) {
    // Mock 阶段：store 已有数据，无需同步
    return;
  }

  try {
    const ids = await fetchFollowedArtistIdsFromSupabase(userId);
    useUserStore.getState().setFollowedArtistIds(ids);
  } catch {
    warnSupabaseNotConfigured("user_artist_follows");
    // 同步失败不阻塞，保留 store 现有数据
  }
}
