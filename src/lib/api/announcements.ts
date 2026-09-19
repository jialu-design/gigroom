/**
 * API 抽象层 - 公告模块（P10.2-A 接入 Supabase 公共读）
 *
 * 数据来源：
 * - Supabase 已配置：走真实 Database public.announcements
 * - Supabase 未配置：fallback 到原 mock 数据（保证本地开发/测试）
 *
 * UI 不感知 Supabase：API 签名与原版完全一致。
 */
import type { Announcement } from "@/lib/types";
import { mockAnnouncements } from "@/mocks/announcements";
import {
  announcementsFrom,
  announcementRowToAnnouncement,
  isPublicDataSupabaseEnabled,
  warnSupabaseNotConfigured,
} from "@/lib/supabase/publicData";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ============
// Supabase 路径
// ============

/** 从 Supabase 按 show_id 拉取 announcements */
async function fetchAnnouncementsByShowFromSupabase(showId: string): Promise<Announcement[]> {
  const { data, error } = await announcementsFrom()
    .select("*")
    .eq("show_id", showId)
    .order("created_at", { ascending: false });
  if (error || !data) {
    throw error ?? new Error("fetch announcements failed");
  }
  return data.map(announcementRowToAnnouncement);
}

/** 从 Supabase 按 id 拉取单个 announcement */
async function fetchAnnouncementByIdFromSupabase(id: string): Promise<Announcement | null> {
  const { data, error } = await announcementsFrom()
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) {
    throw error ?? new Error("fetch announcement by id failed");
  }
  return announcementRowToAnnouncement(data);
}

// ============
// 公共 API（保持原签名）
// ============

/** 获取演出的公告列表 */
export async function getAnnouncementsByShow(showId: string): Promise<Announcement[]> {
  if (isPublicDataSupabaseEnabled()) {
    try {
      return await fetchAnnouncementsByShowFromSupabase(showId);
    } catch {
      warnSupabaseNotConfigured("announcements");
    }
  } else {
    warnSupabaseNotConfigured("announcements");
  }

  const result = mockAnnouncements
    .filter((a) => a.show_id === showId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)); // 最新优先
  return delay(result);
}

/** 根据 ID 获取公告 */
export async function getAnnouncementById(id: string): Promise<Announcement | null> {
  if (isPublicDataSupabaseEnabled()) {
    try {
      return await fetchAnnouncementByIdFromSupabase(id);
    } catch {
      warnSupabaseNotConfigured("announcements");
    }
  } else {
    warnSupabaseNotConfigured("announcements");
  }

  const ann = mockAnnouncements.find((a) => a.id === id);
  return delay(ann ?? null);
}
