/**
 * API 抽象层 - 用户关注乐队模块
 *
 * 数据来源（V1 HR Demo）：
 * - Mock 乐队（字符串 ID，如 artist-1）→ public.user_mock_artist_follows
 *   （artist_id text，不依赖 public.artists）
 * - 真实 Artist（uuid）→ public.user_artist_follows
 *
 * 持久化开关：
 * - 关注关系使用独立的 isFollowPersistenceEnabled()：只要配置了 Supabase
 *   Auth（NEXT_PUBLIC_SUPABASE_URL / ANON_KEY）即写库，不受
 *   NEXT_PUBLIC_DATA_SOURCE=mock 影响（该开关只控制公共读与其他行为数据）。
 * - 完全未配置 Supabase（本地开发 / CI）时回退 Zustand store。
 *
 * 失败语义：
 * - Supabase 写库失败 → 抛错，不更新 store、不返回伪造成功（UI 提示失败）。
 *
 * 幂等性：
 * - follow：upsert(..., ignoreDuplicates: true) → ON CONFLICT DO NOTHING，
 *   只依赖 INSERT RLS，不需要缺失的 UPDATE RLS 策略；冲突后回查既有记录。
 * - unfollow：delete 自然幂等。
 *
 * 同步：
 * - syncFollowedArtists 登录 / session 恢复时合并读取两张表，
 *   带账号校验、按用户版本号与三方合并，防止异步竞争覆盖。
 *
 * UI 单一响应式来源：useUserStore.followedArtistIds（store 作为 UI cache）。
 */
import type { Artist, UserArtistFollow } from "@/lib/types";
import { EventType, TargetType } from "@/lib/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import {
  userArtistFollowsFrom,
  userMockArtistFollowsFrom,
  followRowToFollow,
  mockFollowRowToFollow,
  isFollowPersistenceEnabled,
  isMockArtistId,
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
// Supabase 路径（按 artistId 类型路由两张表）
// ============

const CONFLICT_TARGET = "user_id,artist_id" as const;

/** 关注 Mock 乐队（artist_id text → user_mock_artist_follows） */
async function followMockArtistInSupabase(
  userId: string,
  artistId: string
): Promise<UserArtistFollow> {
  const { data, error } = await userMockArtistFollowsFrom()
    .upsert(
      { user_id: userId, artist_id: artistId },
      { onConflict: CONFLICT_TARGET, ignoreDuplicates: true }
    )
    .select()
    .maybeSingle();

  if (error) throw error;
  if (data) return mockFollowRowToFollow(data);

  // ON CONFLICT DO NOTHING 未返回行（重复关注）→ 回查规范记录
  const { data: existing, error: selectError } = await userMockArtistFollowsFrom()
    .select("*")
    .eq("user_id", userId)
    .eq("artist_id", artistId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return mockFollowRowToFollow(existing);
  throw new Error("关注失败，请重试");
}

/** 关注真实 Artist（uuid → user_artist_follows） */
async function followRealArtistInSupabase(
  userId: string,
  artistId: string
): Promise<UserArtistFollow> {
  const { data, error } = await userArtistFollowsFrom()
    .upsert(
      { user_id: userId, artist_id: artistId },
      { onConflict: CONFLICT_TARGET, ignoreDuplicates: true }
    )
    .select()
    .maybeSingle();

  if (error) throw error;
  if (data) return followRowToFollow(data);

  const { data: existing, error: selectError } = await userArtistFollowsFrom()
    .select("*")
    .eq("user_id", userId)
    .eq("artist_id", artistId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return followRowToFollow(existing);
  throw new Error("关注失败，请重试");
}

/** 取消关注（按 ID 类型路由；delete 自然幂等） */
async function unfollowInSupabase(
  userId: string,
  artistId: string
): Promise<void> {
  const table = isMockArtistId(artistId)
    ? userMockArtistFollowsFrom()
    : userArtistFollowsFrom();
  const { error } = await table
    .delete()
    .eq("user_id", userId)
    .eq("artist_id", artistId);
  if (error) throw error;
}

/** 读取用户在 Mock 关注表中的 artist_id 列表 */
async function fetchMockFollowedIds(userId: string): Promise<string[]> {
  const { data, error } = await userMockArtistFollowsFrom()
    .select("artist_id")
    .eq("user_id", userId);
  if (error || !data) throw error ?? new Error("fetch mock follows failed");
  return data.map((r) => r.artist_id);
}

/** 读取用户在真实关注表中的 artist_id 列表 */
async function fetchRealFollowedIds(userId: string): Promise<string[]> {
  const { data, error } = await userArtistFollowsFrom()
    .select("artist_id")
    .eq("user_id", userId);
  if (error || !data) throw error ?? new Error("fetch follows failed");
  return data.map((r) => r.artist_id);
}

// ============
// 同步：三方合并，防止异步竞争 / 账号切换覆盖
// ============

/** 每个用户在途同步的单调版本号；过期同步不得写 store */
const syncVersions: Record<string, number> = {};

/**
 * 三方合并关注列表：
 * - base：同步发起时的 store 快照
 * - current：同步返回时的 store（可能含用户刚完成的关注/取消）
 * - remote：DB 最新结果
 * 规则：id 在 base→current 间发生变化视为本地 mutation，本地优先；
 * 其余以 remote 为准。避免旧同步结果覆盖用户刚完成的操作。
 */
export function reconcileFollowIds(
  base: string[],
  current: string[],
  remote: string[]
): string[] {
  const baseSet = new Set(base);
  const curSet = new Set(current);
  const result: string[] = [];
  const seen = new Set<string>();

  for (const id of remote) {
    if (seen.has(id)) continue;
    seen.add(id);
    const locallyChanged = baseSet.has(id) !== curSet.has(id);
    if (!locallyChanged || curSet.has(id)) {
      result.push(id);
    }
  }
  for (const id of current) {
    if (seen.has(id)) continue;
    // 本地新增（base 没有、current 有）但远端读取尚未包含 → 保留
    if (!baseSet.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

function sameStringSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b);
  for (const id of a) if (!setB.has(id)) return false;
  return true;
}

// ============
// 公共 API
// ============

/**
 * 关注乐队
 * - Supabase 已配置：写库（mock ID → user_mock_artist_follows；uuid → user_artist_follows），
 *   成功后才同步 store；写库失败抛错，不回退、不伪装成功
 * - Supabase 未配置：仅更新 store（本地开发 / 测试 fallback）
 * - 幂等：重复关注不报错（ON CONFLICT DO NOTHING）
 */
export async function followArtist(
  userId: string,
  artistId: string
): Promise<UserArtistFollow> {
  requireCurrentUserId(userId);

  if (isFollowPersistenceEnabled()) {
    const follow = isMockArtistId(artistId)
      ? await followMockArtistInSupabase(userId, artistId)
      : await followRealArtistInSupabase(userId, artistId);
    // 写库成功后才更新 store（UI 单一来源）
    useUserStore.getState().followArtist(artistId);
    void trackEvent(userId, EventType.ARTIST_FOLLOW, TargetType.ARTIST, artistId);
    return follow;
  }

  // 本地 fallback：未配置 Supabase
  warnSupabaseNotConfigured("follows");
  useUserStore.getState().followArtist(artistId);
  void trackEvent(userId, EventType.ARTIST_FOLLOW, TargetType.ARTIST, artistId);
  const follow: UserArtistFollow = {
    id: `${userId}:${artistId}`,
    user_id: userId,
    artist_id: artistId,
    created_at: new Date().toISOString(),
  };
  return delay(follow);
}

/**
 * 取消关注
 * - Supabase 已配置：删库成功后才同步 store；失败抛错
 * - Supabase 未配置：仅更新 store（fallback）
 * - 幂等：重复取消不报错
 */
export async function unfollowArtist(
  userId: string,
  artistId: string
): Promise<void> {
  requireCurrentUserId(userId);

  if (isFollowPersistenceEnabled()) {
    await unfollowInSupabase(userId, artistId);
    useUserStore.getState().unfollowArtist(artistId);
    return;
  }

  warnSupabaseNotConfigured("follows");
  useUserStore.getState().unfollowArtist(artistId);
  return delay(undefined);
}

/**
 * 检查是否已关注（读取 store 单一来源）
 * 未登录或 userId 不匹配返回 false
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
 * 从 Supabase 同步用户关注列表到 store（登录 / session 恢复时调用）。
 *
 * - 合并读取 user_mock_artist_follows（Mock 乐队）与 user_artist_follows（真实）。
 * - 未配置 Supabase：no-op（store 已有 mockLogin / persist 数据）。
 * - 账号切换保护：应用前校验当前登录用户仍是 userId。
 * - 异步竞争保护：同一用户只有最新一次同步可写 store；
 *   同步期间用户完成的关注 / 取消通过三方合并保留，不被旧结果覆盖。
 * - 读取失败不阻塞登录（保留本地 store）。
 */
export async function syncFollowedArtists(userId: string): Promise<void> {
  if (!isFollowPersistenceEnabled()) {
    return;
  }

  const myVersion = (syncVersions[userId] ?? 0) + 1;
  syncVersions[userId] = myVersion;
  const base = [...useUserStore.getState().followedArtistIds];

  const [mockResult, realResult] = await Promise.allSettled([
    fetchMockFollowedIds(userId),
    fetchRealFollowedIds(userId),
  ]);

  // 应用前守卫：账号切换 / 登出后丢弃结果
  const state = useUserStore.getState();
  if (!state.isLoggedIn || !state.user || state.user.id !== userId) return;
  // 已有更新的同步发起：让位，防止先发后至的旧响应覆盖
  if (syncVersions[userId] !== myVersion) return;

  const remoteIds: string[] = [];
  if (mockResult.status === "fulfilled") remoteIds.push(...mockResult.value);
  if (realResult.status === "fulfilled") remoteIds.push(...realResult.value);
  if (mockResult.status === "rejected" && realResult.status === "rejected") {
    warnSupabaseNotConfigured("follows");
    return;
  }

  const merged = reconcileFollowIds(base, state.followedArtistIds, remoteIds);
  if (!sameStringSet(merged, state.followedArtistIds)) {
    state.setFollowedArtistIds(merged);
  }
}
