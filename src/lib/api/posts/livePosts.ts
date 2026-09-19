/**
 * API 抽象层 - 现场帖模块（P10.3 接入 Supabase）
 *
 * 数据来源：
 * - live_posts：公共读 + 用户写
 *
 * 设计原则：
 * - Supabase 配置时优先走 DB；未配置或失败 fallback mock
 * - 用户写操作 fallback 路径必须校验 userMap（ghost 被拒绝）
 * - 不绕过 RLS：DELETE 必须显式 eq user_id
 *
 * RLS：
 * - SELECT：public
 * - INSERT：需 authenticated + 是 Room 成员
 * - UPDATE/DELETE：仅作者
 */
import type { LivePost } from "@/lib/types";
import { VideoPlatform, EventType, TargetType } from "@/lib/types";
import { mockLivePosts } from "@/mocks/livePosts";
import { hydrateUsers, hydrateUser } from "@/lib/api/profile";
import { trackEvent } from "@/lib/api/events";
import { resolveMockAuthor } from "@/lib/api/mockUser";
import {
  livePostsFrom,
  livePostRowToLivePost,
  isBehaviorSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

let posts = [...mockLivePosts];

/** 获取演出的现场帖（按时间倒序） */
export async function getLivePosts(showId: string): Promise<LivePost[]> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { data, error } = await livePostsFrom()
        .select("*")
        .eq("show_id", showId)
        .order("created_at", { ascending: false });
      if (error || !data) {
        throw error ?? new Error("fetch live_posts failed");
      }
      const result = (data as unknown as Parameters<typeof livePostRowToLivePost>[0][]).map(
        livePostRowToLivePost
      );
      // P10.4: 回填 user
      await hydrateUsers(result);
      return result;
    } catch {
      warnSupabaseNotConfigured("live_posts");
      return fetchLivePostsFromMock(showId);
    }
  }
  warnSupabaseNotConfigured("live_posts");
  return fetchLivePostsFromMock(showId);
}

/** fallback：从 mock 读取现场帖 */
async function fetchLivePostsFromMock(showId: string): Promise<LivePost[]> {
  const result = posts
    .filter((p) => p.show_id === showId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return delay(result);
}

/** 发布现场帖 */
export async function createLivePost(
  showId: string,
  userId: string,
  input: {
    content?: string;
    imageUrls?: string[];
    videoUrl?: string;
    videoPlatform?: VideoPlatform;
  }
): Promise<LivePost> {
  // 护栏：blob: 是会话内临时 URL，入库后刷新即破图，禁止持久化
  const imageUrls = (input.imageUrls ?? []).filter((u) => !u.startsWith("blob:"));

  if (!input.content?.trim() && imageUrls.length === 0 && !input.videoUrl) {
    throw new Error("内容不能为空");
  }

  if (isBehaviorSupabaseEnabled()) {
    try {
      const insertPayload = {
        show_id: showId,
        user_id: userId,
        content: input.content?.trim() || null,
        image_urls: imageUrls,
        video_url: input.videoUrl ?? null,
        video_platform: input.videoPlatform ?? null,
      };
      const { data, error } = await livePostsFrom()
        .insert(insertPayload)
        .select("*")
        .single();
      if (error || !data) {
        throw error ?? new Error("create live_post failed");
      }
      const created = livePostRowToLivePost(
        data as unknown as Parameters<typeof livePostRowToLivePost>[0]
      );
      // P10.4: 回填 user
      await hydrateUser(created);
      // P10.5: 记录用户行为事件（fire-and-forget）
      void trackEvent(userId, EventType.POST_CREATE, TargetType.POST, created.id, { show_id: showId, post_type: "live" });
      return created;
    } catch {
      warnSupabaseNotConfigured("live_posts");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("live_posts");
  }

  // fallback 路径：校验用户存在性
  const user = resolveMockAuthor(userId);
  if (!user) throw new Error("User not found");

  const post: LivePost = {
    id: `lp-${Date.now()}`,
    show_id: showId,
    user_id: userId,
    user,
    content: input.content?.trim() || undefined,
    image_urls: imageUrls,
    video_url: input.videoUrl,
    video_platform: input.videoPlatform,
    created_at: new Date().toISOString(),
  };
  posts.unshift(post);
  // P10.5: 记录用户行为事件（fire-and-forget）
  void trackEvent(userId, EventType.POST_CREATE, TargetType.POST, post.id, { show_id: showId, post_type: "live" });
  return delay(post);
}

/** 删除现场帖 */
export async function deleteLivePost(
  postId: string,
  userId: string
): Promise<void> {
  if (isBehaviorSupabaseEnabled()) {
    try {
      const { error } = await livePostsFrom()
        .delete()
        .eq("id", postId)
        .eq("user_id", userId);
      if (error) throw error;
      return;
    } catch {
      warnSupabaseNotConfigured("live_posts");
      // fallback
    }
  } else {
    warnSupabaseNotConfigured("live_posts");
  }

  // fallback 路径：校验作者身份
  const post = posts.find((p) => p.id === postId);
  if (!post) throw new Error("Post not found");
  if (post.user_id !== userId) throw new Error("Cannot delete others' posts");
  posts = posts.filter((p) => p.id !== postId);
  return delay(undefined);
}

/** 识别视频平台 */
export function detectVideoPlatform(
  url: string
): VideoPlatform | undefined {
  const lower = url.toLowerCase();
  if (lower.includes("bilibili.com") || lower.includes("b23.tv")) {
    return VideoPlatform.BILIBILI;
  }
  if (lower.includes("xiaohongshu.com") || lower.includes("xhslink.com")) {
    return VideoPlatform.XIAOHONGSHU;
  }
  if (lower.includes("douyin.com") || lower.includes("iesdouyin.com")) {
    return VideoPlatform.DOUYIN;
  }
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) {
    return VideoPlatform.YOUTUBE;
  }
  return undefined;
}

/** 视频平台中文名 */
export function getVideoPlatformLabel(platform?: VideoPlatform): string {
  switch (platform) {
    case VideoPlatform.BILIBILI:
      return "B站";
    case VideoPlatform.XIAOHONGSHU:
      return "小红书";
    case VideoPlatform.DOUYIN:
      return "抖音";
    case VideoPlatform.YOUTUBE:
      return "YouTube";
    default:
      return "外部链接";
  }
}
