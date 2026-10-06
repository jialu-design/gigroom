/**
 * API 抽象层 - 出收票收藏（P3 V1 mock）
 *
 * 规则：
 * - 收藏/取消收藏是幂等开关
 * - 收藏他人帖子 → 给帖主发 TICKET_FAVORITE 通知
 * - 自己的帖子可以收藏（不通知自己）
 */
import type { TicketFavorite } from "@/lib/types";
import { mockTicketFavorites } from "@/mocks/ticketMessages";
import { findTicketPostById } from "@/lib/api/posts/ticketPosts";
import { generateTicketFavoriteNotification } from "@/lib/api/notifications";

const delay = <T>(data: T, ms = 80): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// P0-1: 收藏为 mock-only 状态，持久化到 localStorage，避免刷新/重新登录后丢失
const FAVORITES_STORAGE_KEY = "gigroom-ticket-favorites";

function loadFavorites(): TicketFavorite[] {
  if (typeof window === "undefined") return [...mockTicketFavorites];
  try {
    const raw = window.localStorage.getItem(FAVORITES_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as TicketFavorite[];
  } catch {
    // 解析失败回退种子数据
  }
  return [...mockTicketFavorites];
}

function persistFavorites() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favorites));
  } catch {
    // 存储不可用时静默降级
  }
}

let favorites = loadFavorites();

/** 获取用户收藏的帖子 ID 列表 */
export async function getFavoritePostIds(userId: string): Promise<string[]> {
  return delay(
    favorites.filter((f) => f.user_id === userId).map((f) => f.ticket_post_id)
  );
}

/** 是否已收藏 */
export async function isFavorited(
  userId: string,
  postId: string
): Promise<boolean> {
  return delay(
    favorites.some((f) => f.user_id === userId && f.ticket_post_id === postId)
  );
}

/** 切换收藏。返回新状态 */
export async function toggleFavorite(
  userId: string,
  postId: string
): Promise<{ favorited: boolean }> {
  const idx = favorites.findIndex(
    (f) => f.user_id === userId && f.ticket_post_id === postId
  );
  if (idx >= 0) {
    favorites.splice(idx, 1);
    persistFavorites();
    return delay({ favorited: false });
  }
  const fav: TicketFavorite = {
    id: `fav-${Date.now()}`,
    ticket_post_id: postId,
    user_id: userId,
    created_at: new Date().toISOString(),
  };
  favorites.push(fav);
  persistFavorites();
  // 通知帖主（非自己时）
  const post = findTicketPostById(postId);
  if (post && post.user_id !== userId) {
    void generateTicketFavoriteNotification(post.user_id, postId, userId, post.show_id);
  }
  return delay({ favorited: true });
}

/** 获取用户收藏的完整帖子列表（关联 post） */
export async function getFavoritesByUser(
  userId: string
): Promise<TicketFavorite[]> {
  const mine = favorites
    .filter((f) => f.user_id === userId)
    .map((f) => ({
      ...f,
      post: findTicketPostById(f.ticket_post_id),
    }))
    .filter((f) => !!f.post);
  mine.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay(mine);
}
