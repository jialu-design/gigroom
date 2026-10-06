/**
 * API 抽象层 - 乐队模块（P10.2-A 接入 Supabase 公共读）
 *
 * 数据来源：
 * - Supabase 已配置：走真实 Database public.artists
 * - Supabase 未配置：fallback 到原 mock 数据（保证本地开发/测试）
 *
 * P10.2-B: getFollowedArtists 迁移到 @/lib/api/follows（关注关系由 follows.ts 管理）
 * 此处保留 re-export 维持向后兼容（现有 import 路径不变）。
 *
 * UI 不感知 Supabase：API 签名与 P6 完全一致。
 */
import type { Artist, ArtistFilters, PaginatedResult } from "@/lib/types";
import { mockArtists, artistMap } from "@/mocks/artists";
import {
  artistsFrom,
  artistRowToArtist,
  isPublicDataSupabaseEnabled,
  warnSupabaseNotConfigured,
  createTtlFetcher,
} from "@/lib/supabase/publicData";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

/** 内存 mock 索引（仅用于 Supabase 未配置时 fallback） */
const mockArtistMap = artistMap;

// ============
// Supabase 路径
// ============

/** 从 Supabase 拉取全部 artists（一次拉取，前端筛选）—— 未缓存原始实现 */
async function fetchArtistsFromSupabaseUncached(): Promise<Artist[]> {
  const { data, error } = await artistsFrom()
    .select("*")
    .order("name", { ascending: true });
  if (error || !data) {
    throw error ?? new Error("fetch artists failed");
  }
  return data.map(artistRowToArtist);
}

/**
 * 从 Supabase 拉取全部 artists（一次拉取，前端筛选）
 * 加 in-flight 去重 + 短 TTL 缓存，避免首屏重复打网络。
 */
const fetchArtistsFromSupabase = createTtlFetcher(fetchArtistsFromSupabaseUncached);

/** 从 Supabase 按 id 拉取单个 artist */
async function fetchArtistByIdFromSupabase(id: string): Promise<Artist | null> {
  const { data, error } = await artistsFrom()
    .select("*")
    .eq("id", id)
    .single();
  if (error || !data) {
    throw error ?? new Error("fetch artist by id failed");
  }
  return artistRowToArtist(data);
}

// ============
// 公共 API（保持原签名）
// ============

/** 获取乐队列表（支持搜索 + 多风格 OR 筛选） */
export async function getArtists(
  filters?: ArtistFilters
): Promise<PaginatedResult<Artist>> {
  // Supabase 已配置 → 走真实 DB；否则 fallback mock
  let all: Artist[];
  if (isPublicDataSupabaseEnabled()) {
    try {
      all = await fetchArtistsFromSupabase();
    } catch {
      warnSupabaseNotConfigured("artists");
      all = [...mockArtists];
    }
  } else {
    warnSupabaseNotConfigured("artists");
    all = [...mockArtists];
  }

  // 统一筛选逻辑（与 P6 行为一致）
  let result = all;
  if (filters?.city) {
    result = result.filter((a) => a.city === filters.city);
  }
  // 单风格（向后兼容）
  if (filters?.genre) {
    result = result.filter((a) => a.genres.includes(filters.genre!));
  }
  // 多风格 OR：命中任意一个已选风格即显示
  if (filters?.genres && filters.genres.length > 0) {
    const selected = filters.genres;
    result = result.filter((a) => a.genres.some((g) => selected.includes(g)));
  }
  if (filters?.search) {
    const q = filters.search.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.genres.some((g) => g.toLowerCase().includes(q))
      );
    }
  }

  const offset = filters?.offset ?? 0;
  const limit = filters?.limit ?? 50;
  const paginated = result.slice(offset, offset + limit);

  return {
    data: paginated,
    total: result.length,
    has_more: offset + limit < result.length,
  };
}

/** 根据 ID 获取乐队 */
export async function getArtistById(id: string): Promise<Artist | null> {
  if (isPublicDataSupabaseEnabled()) {
    try {
      return await fetchArtistByIdFromSupabase(id);
    } catch {
      warnSupabaseNotConfigured("artists");
      return mockArtistMap.get(id) ?? null;
    }
  }
  warnSupabaseNotConfigured("artists");
  return mockArtistMap.get(id) ?? null;
}

/**
 * 获取用户关注的乐队列表
 * P10.2-B: 迁移到 @/lib/api/follows，此处 re-export 保持向后兼容。
 * follows.ts 读取 store followedArtistIds（由 syncFollowedArtists 同步自 DB），解析为 Artist 对象。
 */
export { getFollowedArtists } from "@/lib/api/follows";

/**
 * 获取 Artist 查找表（P10.2-D：供 Profile 页面替代直接 import mock）
 * - Supabase 配置：fetchArtistsFromSupabase → Map
 * - 未配置：fallback mockArtistMap
 */
export async function getArtistLookupMap(): Promise<Map<string, Artist>> {
  if (isPublicDataSupabaseEnabled()) {
    try {
      const all = await fetchArtistsFromSupabase();
      return new Map(all.map((a) => [a.id, a]));
    } catch {
      warnSupabaseNotConfigured("artists");
      return new Map(mockArtistMap);
    }
  }
  warnSupabaseNotConfigured("artists");
  return new Map(mockArtistMap);
}

/**
 * 获取有效 genre 标签列表（P1-5：从 Canonical Artist Registry 派生）。
 *
 * 规则：
 * - 只统计 registry 中真实存在的 genres（UNVERIFIED Artist genres 为空，不产生标签）
 * - 按拥有的乐队数量降序 → 同数量按字母序
 * - 用于筛选 chips，替代硬编码 GENRES 常量，保证"有数据的 tag 才显示"
 */
export async function getAvailableGenres(): Promise<string[]> {
  let all: Artist[];
  if (isPublicDataSupabaseEnabled()) {
    try {
      all = await fetchArtistsFromSupabase();
    } catch {
      warnSupabaseNotConfigured("artists");
      all = [...mockArtists];
    }
  } else {
    warnSupabaseNotConfigured("artists");
    all = [...mockArtists];
  }

  const counts = new Map<string, number>();
  for (const a of all) {
    for (const g of a.genres ?? []) {
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]))
    .map(([g]) => g);
}
