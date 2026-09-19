/**
 * API 抽象层 - 出收票帖模块（P10.3 接入 Supabase）
 *
 * 数据来源：
 * - ticket_posts：公共读 + 用户写
 * - ticket_post_comments：公共读 + 用户写
 *
 * 设计原则：
 * - Supabase 配置时优先走 DB；未配置或失败 fallback mock
 * - 用户写操作 fallback 路径必须校验 userMap（ghost 被拒绝）
 * - 不绕过 RLS：DELETE/UPDATE 必须显式 eq user_id
 * - 业务校验（quantity>0、price<=face_value）在写 DB 前由本层强制
 *
 * RLS：
 * - SELECT：public
 * - INSERT：需 authenticated + 是 Room 成员
 * - UPDATE/DELETE：仅作者
 */
import type {
  TicketPost,
  TicketPostComment,
  TicketPostType,
  TicketPostStatus,
} from "@/lib/types";
import { TicketPostStatus as TS, EventType, TargetType } from "@/lib/types";
import { mockTicketPosts } from "@/mocks/ticketPosts";
import { userMap } from "@/mocks/users";
import { hydrateUsers, hydrateUser } from "@/lib/api/profile";
import { trackEvent } from "@/lib/api/events";
import { resolveMockAuthor } from "@/lib/api/mockUser";
import {
  ticketPostsFrom,
  ticketPostCommentsFrom,
  ticketPostRowToTicketPost,
  ticketPostCommentRowToTicketPostComment,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

let posts = [...mockTicketPosts];

let comments: TicketPostComment[] = [
  { id: "tpc-1", ticket_post_id: "tp-1", user_id: "user-3", user: userMap.get("user-3"), content: "我有一张，私信你了", created_at: "2026-07-25T11:00:00Z" },
  { id: "tpc-2", ticket_post_id: "tp-4", user_id: "user-1", user: userMap.get("user-1"), content: "已私信，求转", created_at: "2026-08-16T11:00:00Z" },
  { id: "tpc-3", ticket_post_id: "tp-5", user_id: "user-3", user: userMap.get("user-3"), content: "已收，感谢", created_at: "2026-08-15T19:00:00Z" },
];

/** 获取演出的出收票帖 */
export async function getTicketPosts(
  showId: string,
  type?: TicketPostType
): Promise<TicketPost[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      let query = ticketPostsFrom()
        .select("*")
        .eq("show_id", showId);
      if (type) {
        query = query.eq("type", type);
      }
      const { data, error } = await query.order("created_at", { ascending: false });
      if (error || !data) {
        throw error ?? new Error("fetch ticket_posts failed");
      }
      const result = (data as unknown as Parameters<typeof ticketPostRowToTicketPost>[0][]).map(
        ticketPostRowToTicketPost
      );
      // active 优先排序（与 mock 路径一致）
      result.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === TS.ACTIVE ? -1 : 1;
        }
        return b.created_at.localeCompare(a.created_at);
      });
      // P10.4: 回填 user
      await hydrateUsers(result);
      return result;
    } catch {
      warnSupabaseNotConfigured("ticket_posts");
      return fetchTicketPostsFromMock(showId, type);
    }
  }
  warnSupabaseNotConfigured("ticket_posts");
  return fetchTicketPostsFromMock(showId, type);
}

/** fallback：从 mock 读取出收票帖 */
async function fetchTicketPostsFromMock(
  showId: string,
  type?: TicketPostType
): Promise<TicketPost[]> {
  let result = posts.filter((p) => p.show_id === showId);
  if (type) result = result.filter((p) => p.type === type);
  result.sort((a, b) => {
    if (a.status !== b.status) {
      return a.status === TS.ACTIVE ? -1 : 1;
    }
    return b.created_at.localeCompare(a.created_at);
  });
  return delay(result);
}

/** 发布出收票帖 */
export async function createTicketPost(
  showId: string,
  userId: string,
  input: {
    type: TicketPostType;
    quantity: number;
    faceValue?: number;
    price?: number;
    note?: string;
  }
): Promise<TicketPost> {
  if (input.quantity <= 0) throw new Error("数量必须大于0");
  if (input.faceValue !== undefined && input.faceValue <= 0)
    throw new Error("票面价必须大于0");
  // 出票：转让价不得高于票面价
  if (
    input.type === "selling" &&
    input.faceValue !== undefined &&
    input.price !== undefined &&
    input.price > input.faceValue
  ) {
    throw new Error("转让价不得高于票面原价");
  }

  if (isBehaviorSupabaseEnabled()) {
    try {
      const insertPayload = {
        show_id: showId,
        user_id: userId,
        type: input.type,
        quantity: input.quantity,
        face_value: input.faceValue ?? null,
        price: input.price ?? null,
        note: input.note ?? null,
        status: TS.ACTIVE,
      };
      const { data, error } = await ticketPostsFrom()
        .insert(insertPayload)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("create ticket_post failed");
      }
      const created = ticketPostRowToTicketPost(
        data as unknown as Parameters<typeof ticketPostRowToTicketPost>[0]
      );
      // P10.4: 回填 user
      await hydrateUser(created);
      // P10.5: 记录用户行为事件（fire-and-forget）
      void trackEvent(userId, EventType.POST_CREATE, TargetType.POST, created.id, { show_id: showId, post_type: "ticket" });
      return created;
    } catch {
      warnSupabaseNotConfigured("ticket_posts");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("ticket_posts");
  }

  // fallback 路径：校验用户存在性（ghost 被拒绝）
  const user = resolveMockAuthor(userId);
  if (!user) throw new Error("User not found");

  const post: TicketPost = {
    id: `tp-${Date.now()}`,
    show_id: showId,
    user_id: userId,
    user,
    type: input.type,
    quantity: input.quantity,
    face_value: input.faceValue,
    price: input.price,
    note: input.note,
    status: TS.ACTIVE,
    created_at: new Date().toISOString(),
    comment_count: 0,
  };
  posts.unshift(post);
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(userId, EventType.POST_CREATE, TargetType.POST, post.id, { show_id: showId, post_type: "ticket" });
  return delay(post);
}

/** 更新帖子状态（标记已出/已收），仅作者 */
export async function updateTicketPostStatus(
  postId: string,
  userId: string,
  status: TicketPostStatus
): Promise<TicketPost> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await ticketPostsFrom()
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", postId)
        .eq("user_id", userId)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("update ticket_post failed");
      }
      const updated = ticketPostRowToTicketPost(
        data as unknown as Parameters<typeof ticketPostRowToTicketPost>[0]
      );
      // P10.4: 回填 user
      await hydrateUser(updated);
      return updated;
    } catch {
      warnSupabaseNotConfigured("ticket_posts");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("ticket_posts");
  }

  // fallback 路径：校验作者身份
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error("Post not found");
  if (post.user_id !== userId) throw new Error("只能更新自己的帖子");
  if (post.status === status) throw new Error("状态未变化");
  post.status = status;
  post.updated_at = new Date().toISOString();
  return delay(post);
}

/** 删除出收票帖 */
export async function deleteTicketPost(
  postId: string,
  userId: string
): Promise<void> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { error } = await ticketPostsFrom()
        .delete()
        .eq("id", postId)
        .eq("user_id", userId);
      if (error) throw error;
      comments = comments.filter((c) => c.ticket_post_id !== postId);
      return;
    } catch {
      warnSupabaseNotConfigured("ticket_posts");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("ticket_posts");
  }

  // fallback 路径：校验作者身份
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error("Post not found");
  if (post.user_id !== userId) throw new Error("Cannot delete others' posts");
  posts = posts.filter((p) => p.id !== postId);
  comments = comments.filter((c) => c.ticket_post_id !== postId);
  return delay(undefined);
}

/** 获取帖子评论 */
export async function getTicketPostComments(
  postId: string
): Promise<TicketPostComment[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await ticketPostCommentsFrom()
        .select("*")
        .eq("ticket_post_id", postId)
        .order("created_at", { ascending: true });
      if (error || !data) {
        throw error ?? new Error("fetch ticket_post_comments failed");
      }
      const result = (
        data as unknown as Parameters<typeof ticketPostCommentRowToTicketPostComment>[0][]
      ).map(ticketPostCommentRowToTicketPostComment);
      // P10.4: 回填评论 user
      await hydrateUsers(result);
      return result;
    } catch {
      warnSupabaseNotConfigured("ticket_post_comments");
      return fetchTicketPostCommentsFromMock(postId);
    }
  }
  warnSupabaseNotConfigured("ticket_post_comments");
  return fetchTicketPostCommentsFromMock(postId);
}

/** fallback：从 mock 读取评论 */
async function fetchTicketPostCommentsFromMock(
  postId: string
): Promise<TicketPostComment[]> {
  const result = comments
    .filter((c) => c.ticket_post_id === postId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
  return delay(result);
}

/** 回复出收票帖 */
export async function replyTicketPost(
  postId: string,
  userId: string,
  content: string
): Promise<TicketPostComment> {
  if (!content.trim()) throw new Error("回复内容不能为空");

  if (isBehaviorSupabaseEnabled()) {
    try {
      const insertPayload = {
        ticket_post_id: postId,
        user_id: userId,
        content: content.trim(),
      };
      const { data, error } = await ticketPostCommentsFrom()
        .insert(insertPayload)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("create ticket_post_comment failed");
      }
      const created = ticketPostCommentRowToTicketPostComment(
        data as unknown as Parameters<typeof ticketPostCommentRowToTicketPostComment>[0]
      );
      // P10.4: 回填评论 user
      await hydrateUser(created);
      // P10.5: 记录用户行为事件（fire-and-forget）
      void trackEvent(userId, EventType.COMMENT_CREATE, TargetType.COMMENT, created.id, { post_id: postId, post_type: "ticket" });
      return created;
    } catch {
      warnSupabaseNotConfigured("ticket_post_comments");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("ticket_post_comments");
  }

  // fallback 路径：校验用户存在性
  const user = resolveMockAuthor(userId);
  if (!user) throw new Error("User not found");

  const comment: TicketPostComment = {
    id: `tpc-${Date.now()}`,
    ticket_post_id: postId,
    user_id: userId,
    user,
    content: content.trim(),
    created_at: new Date().toISOString(),
  };
  comments.push(comment);
  const post = posts.find((p) => p.id === postId);
  if (post) post.comment_count = (post.comment_count ?? 0) + 1;
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(userId, EventType.COMMENT_CREATE, TargetType.COMMENT, comment.id, { post_id: postId, post_type: "ticket" });
  return delay(comment);
}

/** 获取用户发布的全部出收票帖（我的页面，按时间倒序） */
export async function getTicketPostsByUser(userId: string): Promise<TicketPost[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await ticketPostsFrom()
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      if (error || !data) {
        throw error ?? new Error("fetch ticket_posts by user failed");
      }
      const result = (data as unknown as Parameters<typeof ticketPostRowToTicketPost>[0][]).map(
        ticketPostRowToTicketPost
      );
      await hydrateUsers(result);
      return result;
    } catch {
      warnSupabaseNotConfigured("ticket_posts");
      // fallback
    }
  }
  const result = posts
    .filter((p) => p.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay(result);
}
