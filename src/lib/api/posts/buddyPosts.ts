/**
 * API 抽象层 - 找搭子帖模块（P10.3 接入 Supabase）
 *
 * 数据来源：
 * - buddy_posts：公共读（anon 可浏览） + 用户写（需 auth）
 * - buddy_post_comments：公共读 + 用户写（需 auth）
 *
 * 设计原则：
 * - Supabase 配置时优先走 DB；未配置或失败 fallback mock
 * - 用户写操作 fallback 路径必须校验 userMap（ghost 被拒绝），保持 P5 行为契约
 * - user/comment_count 由 fallback 路径补充（Supabase 路径暂不复杂化 profiles join）
 * - 不绕过 RLS：DELETE 必须显式 eq user_id
 *
 * RLS：
 * - SELECT：public（anon 可读）
 * - INSERT：需 authenticated + 是 Room 成员
 * - UPDATE/DELETE：仅作者
 */
import type { BuddyPost, BuddyPostComment } from "@/lib/types";
import { EventType, TargetType } from "@/lib/types";
import { mockBuddyPosts } from "@/mocks/buddyPosts";
import { userMap } from "@/mocks/users";
import { hydrateUsers, hydrateUser } from "@/lib/api/profile";
import { trackEvent } from "@/lib/api/events";
import {
  generateBuddyReplyNotification,
  markNotificationsContentDeleted,
} from "@/lib/api/notifications";
import { resolveMockAuthor } from "@/lib/api/mockUser";
import {
  buddyPostsFrom,
  buddyPostCommentsFrom,
  buddyPostRowToBuddyPost,
  buddyPostCommentRowToBuddyPostComment,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

let posts = [...mockBuddyPosts];

// Mock 评论
let comments: BuddyPostComment[] = [
  { id: "bpc-1", buddy_post_id: "bp-1", user_id: "user-3", user: userMap.get("user-3"), content: "我也住浦东！一起", created_at: "2026-08-15T10:30:00Z" },
  { id: "bpc-2", buddy_post_id: "bp-1", user_id: "user-2", user: userMap.get("user-2"), content: "羡慕上海的朋友们", created_at: "2026-08-15T11:00:00Z" },
  { id: "bpc-3", buddy_post_id: "bp-7", user_id: "user-1", user: userMap.get("user-1"), content: "武汉VOX冲冲冲", created_at: "2026-08-18T16:00:00Z" },
];

/** 获取演出的找搭子帖（按时间倒序） */
export async function getBuddyPosts(showId: string): Promise<BuddyPost[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await buddyPostsFrom()
        .select("*")
        .eq("show_id", showId)
        .order("created_at", { ascending: false });
      if (error || !data) {
        throw error ?? new Error("fetch buddy_posts failed");
      }
      const result = (data as unknown as Parameters<typeof buddyPostRowToBuddyPost>[0][]).map(
        buddyPostRowToBuddyPost
      );
      // P10.4: 统一通过 profiles 回填 user（Supabase 路径此前 user 字段缺失）
      await hydrateUsers(result);
      return result;
    } catch {
      warnSupabaseNotConfigured("buddy_posts");
      return fetchBuddyPostsFromMock(showId);
    }
  }
  warnSupabaseNotConfigured("buddy_posts");
  return fetchBuddyPostsFromMock(showId);
}

/** fallback：从 mock 读取找搭子帖 */
async function fetchBuddyPostsFromMock(showId: string): Promise<BuddyPost[]> {
  const result = posts
    .filter((p) => p.show_id === showId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay(result);
}

/** 发布找搭子帖 */
export async function createBuddyPost(
  showId: string,
  userId: string,
  input: { content: string; tags: string[] }
): Promise<BuddyPost> {
  if (!input.content.trim()) throw new Error("内容不能为空");

  if (isBehaviorSupabaseEnabled()) {
    try {
      const insertPayload = {
        show_id: showId,
        user_id: userId,
        content: input.content.trim(),
        tags: input.tags,
      };
      const { data, error } = await buddyPostsFrom()
        .insert(insertPayload)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("create buddy_post failed");
      }
      const created = buddyPostRowToBuddyPost(
        data as unknown as Parameters<typeof buddyPostRowToBuddyPost>[0]
      );
      // P10.4: 回填 user 字段，保证 Supabase 路径与 mock 路径行为一致
      await hydrateUser(created);
      // P10.5: 记录用户行为事件（fire-and-forget）
      void trackEvent(userId, EventType.POST_CREATE, TargetType.POST, created.id, { show_id: showId, post_type: "buddy" });
      return created;
    } catch {
      warnSupabaseNotConfigured("buddy_posts");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("buddy_posts");
  }

  // fallback 路径：校验用户存在性（ghost 被拒绝，与 P5 行为一致）
  const user = resolveMockAuthor(userId);
  if (!user) throw new Error("User not found");

  const post: BuddyPost = {
    id: `bp-${Date.now()}`,
    show_id: showId,
    user_id: userId,
    user,
    content: input.content.trim(),
    tags: input.tags,
    created_at: new Date().toISOString(),
    comment_count: 0,
  };
  posts.unshift(post);
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(userId, EventType.POST_CREATE, TargetType.POST, post.id, { show_id: showId, post_type: "buddy" });
  return delay(post);
}

/** 删除找搭子帖（仅本人） */
export async function deleteBuddyPost(
  postId: string,
  userId: string
): Promise<void> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { error } = await buddyPostsFrom()
        .delete()
        .eq("id", postId)
        .eq("user_id", userId);
      if (error) throw error;
      // 同步删除关联评论（DB 由外键 CASCADE 自动处理，mock 路径需手动）
      comments = comments.filter((c) => c.buddy_post_id !== postId);
      // 帖子删除 → 回复通知失效
      markNotificationsContentDeleted([postId]);
      return;
    } catch {
      warnSupabaseNotConfigured("buddy_posts");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("buddy_posts");
  }

  // fallback 路径：校验作者身份（非作者/ghost 被拒绝）
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error("Post not found");
  if (post.user_id !== userId) throw new Error("Cannot delete others' posts");
  posts = posts.filter((p) => p.id !== postId);
  comments = comments.filter((c) => c.buddy_post_id !== postId);
  // 帖子删除 → 回复通知失效
  markNotificationsContentDeleted([postId]);
  return delay(undefined);
}

/** 获取帖子评论 */
export async function getBuddyPostComments(
  postId: string
): Promise<BuddyPostComment[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await buddyPostCommentsFrom()
        .select("*")
        .eq("buddy_post_id", postId)
        .order("created_at", { ascending: true });
      if (error || !data) {
        throw error ?? new Error("fetch buddy_post_comments failed");
      }
      const result = (
        data as unknown as Parameters<typeof buddyPostCommentRowToBuddyPostComment>[0][]
      ).map(buddyPostCommentRowToBuddyPostComment);
      // P10.4: 回填评论 user
      await hydrateUsers(result);
      return result;
    } catch {
      warnSupabaseNotConfigured("buddy_post_comments");
      return fetchBuddyPostCommentsFromMock(postId);
    }
  }
  warnSupabaseNotConfigured("buddy_post_comments");
  return fetchBuddyPostCommentsFromMock(postId);
}

/** fallback：从 mock 读取评论 */
async function fetchBuddyPostCommentsFromMock(
  postId: string
): Promise<BuddyPostComment[]> {
  const result = comments
    .filter((c) => c.buddy_post_id === postId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return delay(result);
}

/** 回复找搭子帖 */
export async function replyBuddyPost(
  postId: string,
  userId: string,
  content: string
): Promise<BuddyPostComment> {
  if (!content.trim()) throw new Error("回复内容不能为空");

  if (isBehaviorSupabaseEnabled()) {
    try {
      const insertPayload = {
        buddy_post_id: postId,
        user_id: userId,
        content: content.trim(),
      };
      const { data, error } = await buddyPostCommentsFrom()
        .insert(insertPayload)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("create buddy_post_comment failed");
      }
      const created = buddyPostCommentRowToBuddyPostComment(
        data as unknown as Parameters<typeof buddyPostCommentRowToBuddyPostComment>[0]
      );
      // P10.4: 回填评论 user
      await hydrateUser(created);
      // P10.5: 记录用户行为事件（fire-and-forget）
      void trackEvent(userId, EventType.COMMENT_CREATE, TargetType.COMMENT, created.id, { post_id: postId, post_type: "buddy" });
      return created;
    } catch {
      warnSupabaseNotConfigured("buddy_post_comments");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("buddy_post_comments");
  }

  // fallback 路径：校验用户存在性（ghost 被拒绝）
  const user = resolveMockAuthor(userId);
  if (!user) throw new Error("User not found");

  const comment: BuddyPostComment = {
    id: `bpc-${Date.now()}`,
    buddy_post_id: postId,
    user_id: userId,
    user,
    content: content.trim(),
    created_at: new Date().toISOString(),
  };
  comments.push(comment);
  const post = posts.find((p) => p.id === postId);
  if (post) post.comment_count = (post.comment_count ?? 0) + 1;
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(userId, EventType.COMMENT_CREATE, TargetType.COMMENT, comment.id, { post_id: postId, post_type: "buddy" });
  // P3: 通知帖主（非自己回复时）
  if (post && post.user_id !== userId) {
    void generateBuddyReplyNotification(post.user_id, userId, post.show_id, postId);
  }
  return delay(comment);
}

/** 获取用户发布的全部找搭子帖（我的页面，按时间倒序） */
export async function getBuddyPostsByUser(userId: string): Promise<BuddyPost[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await buddyPostsFrom()
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error || !data) {
        throw error ?? new Error("fetch buddy_posts by user failed");
      }
      const result = (data as unknown as Parameters<typeof buddyPostRowToBuddyPost>[0][]).map(
        buddyPostRowToBuddyPost
      );
      await hydrateUsers(result);
      return result;
    } catch {
      warnSupabaseNotConfigured("buddy_posts");
      // fallback
    }
  }
  const result = posts
    .filter((p) => p.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay(result);
}
