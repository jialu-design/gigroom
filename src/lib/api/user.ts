/**
 * API 抽象层 - 用户模块
 *
 * P10.4 统一用户数据层：
 * - getCurrentUser / getUser / updateUser 改为走 profiles（Supabase 路径）
 * - Supabase 未配置时 fallback 到 mocks/users
 * - 关注相关函数 re-export 自 follows.ts（P10.2-B）
 *
 * 历史：
 * - P10.2-B: followArtist / unfollowArtist / isFollowing 迁移到 follows.ts
 * - P10.4:   用户展示数据统一走 profiles；帖子/消息等模块通过
 *             hydrateUsers / hydrateMessageUsers 回填 user 字段
 */
import type { User, UserShowStatusRecord, UserArtistFollow } from "@/lib/types";
import { UserShowStatus, EventType, TargetType, ReputationEventType } from "@/lib/types";
import { getProfile, getCurrentUserProfile, updateProfile } from "@/lib/api/profile";
import { useUserStore } from "@/lib/stores/useUserStore";
import { trackEvent } from "@/lib/api/events";
import { updateReputation } from "@/lib/api/reputation";

// P10.2-B: follow 相关函数迁移到 follows.ts，此处 re-export 保持向后兼容
export {
  followArtist,
  unfollowArtist,
  isFollowingArtist as isFollowing,
} from "@/lib/api/follows";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// Mock 内存态
let mockUserShowStatuses: UserShowStatusRecord[] = [
  { id: "uss-1", user_id: "user-1", show_id: "show-1", status: UserShowStatus.ATTENDED, created_at: "2026-07-01T00:00:00Z", updated_at: "2026-07-25T20:00:00Z" },
  { id: "uss-2", user_id: "user-1", show_id: "show-4", status: UserShowStatus.GOING, created_at: "2026-07-02T00:00:00Z", updated_at: "2026-07-02T00:00:00Z" },
  { id: "uss-3", user_id: "user-1", show_id: "show-7", status: UserShowStatus.INTERESTED, created_at: "2026-07-15T00:00:00Z", updated_at: "2026-07-15T00:00:00Z" },
  { id: "uss-4", user_id: "user-1", show_id: "show-15", status: UserShowStatus.GOING, created_at: "2026-08-12T00:00:00Z", updated_at: "2026-08-12T00:00:00Z" },
];

/** 获取当前用户 */
export async function getCurrentUser(): Promise<User | null> {
  // 优先用 store 中的当前登录用户 id（真实 Supabase 环境下，useUserStore 已缓存了用户）
  const state = useUserStore.getState();
  if (state.isLoggedIn && state.user?.id) {
    return getProfile(state.user.id);
  }
  return getCurrentUserProfile();
}

/** 根据 ID 获取用户（走 profiles，未配置时 fallback mock） */
export async function getUser(userId: string): Promise<User | null> {
  try {
    const u = await getProfile(userId);
    // 占位 User（仅含 id）且 userMap 也不存在 → 视为未找到
    const { userMap } = await import("@/mocks/users");
    if (!userMap.has(userId) && (u.display_name === "" || u.onboarding_completed === false)) {
      // 进一步校验：确实不是有效 profile（fallback mock 也找不到）
      if (u.onboarding_completed === false && u.bio === undefined && u.display_name === "") {
        return null;
      }
    }
    return u;
  } catch {
    return null;
  }
}

/** 更新用户资料 */
export async function updateUser(
  userId: string,
  updates: Partial<Pick<User, "display_name" | "avatar_url" | "city" | "bio">>
): Promise<User> {
  return updateProfile(userId, updates);
}

/** 设置用户对演出的状态 */
export async function setShowStatus(
  userId: string,
  showId: string,
  status: UserShowStatus
): Promise<UserShowStatusRecord> {
  const existing = mockUserShowStatuses.find(
    (s) => s.user_id === userId && s.show_id === showId
  );
  if (existing) {
    existing.status = status;
    existing.updated_at = new Date().toISOString();
    // P10.5: 记录用户行为事件（fire-and-forget）
    void trackEvent(
      userId,
      status === UserShowStatus.ATTENDED ? EventType.SHOW_ATTEND : EventType.SHOW_INTEREST,
      TargetType.SHOW,
      showId,
      { status }
    );
    // P10.7: 参加演出更新信用（fire-and-forget）
    if (status === UserShowStatus.ATTENDED) {
      void updateReputation(userId, ReputationEventType.SHOW_ATTENDED, showId, "参加演出");
    }
    return delay(existing);
  }
  const record: UserShowStatusRecord = {
    id: `uss-${Date.now()}`,
    user_id: userId,
    show_id: showId,
    status,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockUserShowStatuses.push(record);
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(
    userId,
    status === UserShowStatus.ATTENDED ? EventType.SHOW_ATTEND : EventType.SHOW_INTEREST,
    TargetType.SHOW,
    showId,
    { status }
  );
  // P10.7: 参加演出更新信用（fire-and-forget）
  if (status === UserShowStatus.ATTENDED) {
    void updateReputation(userId, ReputationEventType.SHOW_ATTENDED, showId, "参加演出");
  }
  return delay(record);
}

/** 获取用户对演出的状态 */
export async function getUserShowStatus(userId: string, showId: string): Promise<UserShowStatusRecord | null> {
  const record = mockUserShowStatuses.find(
    (s) => s.user_id === userId && s.show_id === showId
  );
  return delay(record ?? null);
}

/** 获取用户所有演出状态 */
export async function getUserShowStatuses(userId: string): Promise<UserShowStatusRecord[]> {
  return delay(mockUserShowStatuses.filter((s) => s.user_id === userId));
}
