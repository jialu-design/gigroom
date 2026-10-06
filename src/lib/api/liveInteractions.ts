/**
 * API 抽象层 - 现场帖互动模块（P5 V1 mock）
 *
 * 数据来源：
 * - 点赞基数：mockLivePostLikes（其他用户种子数据）
 * - 当前用户点赞态：useUserStore.likedLivePostIds（Zustand persist，刷新保持一致）
 * - 评论：内存数组（与讨论/找搭子评论同一 V1 mock 口径，会话内有效）
 *
 * 规则：
 * - 互动需登录（UI 层 useRequireAuth 拦截；API 层校验 userMap ghost 拒绝）
 * - 点赞/评论他人帖子 → 生成 LIVE_INTERACTION 通知（自己的帖子不通知）
 */
import type { LivePostComment } from "@/lib/types";
import { EventType, TargetType } from "@/lib/types";
import { mockLivePostLikes, mockLivePostComments } from "@/mocks/liveInteractions";
import { useUserStore } from "@/lib/stores/useUserStore";
import { trackEvent } from "@/lib/api/events";
import { generateLiveInteractionNotification } from "@/lib/api/notifications";
import { resolveMockAuthor } from "@/lib/api/mockUser";
import { findLivePostById } from "@/lib/api/posts/livePosts";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// 评论：V1 mock 内存数组（刷新不持久，与讨论/找搭子一致）
let comments: LivePostComment[] = [...mockLivePostComments];

export interface LiveInteractionSummary {
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
}

/** 计算单个帖子的点赞数：其他用户种子赞 + 当前用户点赞态（store 持久化） */
function computeLikeCount(postId: string, userId?: string): number {
  const base = mockLivePostLikes.filter(
    (l) => l.live_post_id === postId && l.user_id !== userId
  ).length;
  const likedByMe = userId
    ? useUserStore.getState().likedLivePostIds.includes(postId)
    : false;
  return base + (likedByMe ? 1 : 0);
}

/** 批量获取互动汇总（列表渲染用） */
export async function getLiveInteractionSummaries(
  postIds: string[],
  userId?: string
): Promise<Record<string, LiveInteractionSummary>> {
  const result: Record<string, LiveInteractionSummary> = {};
  for (const postId of postIds) {
    result[postId] = {
      likeCount: computeLikeCount(postId, userId),
      commentCount: comments.filter((c) => c.live_post_id === postId).length,
      likedByMe: userId
        ? useUserStore.getState().likedLivePostIds.includes(postId)
        : false,
    };
  }
  return delay(result);
}

/** 点赞/取消点赞（toggle）。返回最新状态与计数。 */
export async function toggleLivePostLike(
  postId: string,
  userId: string
): Promise<{ liked: boolean; likeCount: number }> {
  const post = findLivePostById(postId);
  if (!post) throw new Error("Post not found");

  const store = useUserStore.getState();
  const wasLiked = store.likedLivePostIds.includes(postId);
  store.toggleLivePostLike(postId);

  if (!wasLiked) {
    // P5: 通知作者（非自己点赞时）
    if (post.user_id !== userId) {
      void generateLiveInteractionNotification(
        post.user_id,
        userId,
        post.show_id,
        postId,
        "like"
      );
    }
  }

  return delay({ liked: !wasLiked, likeCount: computeLikeCount(postId, userId) });
}

/** 获取现场帖评论（按时间正序） */
export async function getLivePostComments(
  postId: string
): Promise<LivePostComment[]> {
  const result = comments
    .filter((c) => c.live_post_id === postId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return delay(result);
}

/** 评论现场帖 */
export async function createLivePostComment(
  postId: string,
  userId: string,
  content: string
): Promise<LivePostComment> {
  if (!content.trim()) throw new Error("评论内容不能为空");

  const post = findLivePostById(postId);
  if (!post) throw new Error("Post not found");

  const user = resolveMockAuthor(userId);
  if (!user) throw new Error("User not found");

  const comment: LivePostComment = {
    id: `lc-${Date.now()}`,
    live_post_id: postId,
    user_id: userId,
    user,
    content: content.trim(),
    created_at: new Date().toISOString(),
  };
  comments.push(comment);

  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(userId, EventType.COMMENT_CREATE, TargetType.COMMENT, comment.id, {
    post_id: postId,
    post_type: "live",
  });
  // P5: 通知作者（非自己评论时）
  if (post.user_id !== userId) {
    void generateLiveInteractionNotification(
      post.user_id,
      userId,
      post.show_id,
      postId,
      "comment"
    );
  }

  return delay(comment);
}

/** 构建现场帖分享链接（深链到现场 Tab） */
export function buildLiveShareUrl(showId: string): string {
  return `/show/${showId}?tab=live#room`;
}
