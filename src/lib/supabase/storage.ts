/**
 * Supabase Storage 上传（P0 修复：现场帖图片）
 *
 * 背景：LivePostModal 此前用 URL.createObjectURL 把 blob: 临时 URL 直接写入
 * live_posts.image_urls，刷新/他人访问即破图。本模块负责把图片文件真正上传到
 * Storage 的 live-posts bucket，返回持久化的公开 URL。
 *
 * bucket（live-posts）与 storage.objects RLS 策略见
 * supabase/migrations/003_live_post_storage.sql（需在 Supabase Dashboard 执行）：
 * - SELECT：public（公开读）
 * - INSERT：authenticated，仅限自己的目录 ${userId}/...
 * - DELETE：authenticated，仅限自己的目录
 */
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/publicData";

export const LIVE_POST_BUCKET = "live-posts";

/** 图片上传大小上限（与 bucket file_size_limit 一致：10MB） */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Supabase 是否可用（决定 UI 走真实上传还是 mock blob 预览） */
export function isStorageConfigured(): boolean {
  return isSupabaseConfigured();
}

/**
 * 上传单张现场帖图片，返回公开访问 URL
 * - 存储路径：${userId}/${timestamp}-${random}.${ext}（与 RLS"仅本人目录"策略对应）
 * - 超出大小上限 / 上传失败时抛出真实错误，由调用方决定如何提示
 */
export async function uploadLivePostImage(
  file: File,
  userId: string
): Promise<string> {
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error("图片超过 10MB 上限");
  }

  const supabase = createClient();
  const ext = file.name.includes(".")
    ? file.name.split(".").pop()!.toLowerCase()
    : "jpg";
  const path = `${userId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(LIVE_POST_BUCKET).upload(path, file, {
    contentType: file.type || "image/jpeg",
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(LIVE_POST_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
