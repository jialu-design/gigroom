/**
 * API 抽象层 - 演出模块（P10.2-A 接入 Supabase 公共读）
 *
 * 数据来源：
 * - Supabase 已配置：走真实 Database public.shows / show_artists / venues
 * - Supabase 未配置：fallback 到原 mock 数据（保证本地开发/测试）
 *
 * 关联扩展（venue / artists）通过 Supabase join 一次性获取；fallback 时使用 mock 内嵌。
 *
 * UI 不感知 Supabase：API 签名与 P4 完全一致。
 */
import type { Show, ShowFilters, PaginatedResult, Venue, ShowArtist } from "@/lib/types";
import { ShowStatus } from "@/lib/types";
import { mockShows, showMap } from "@/mocks/shows";
import { getNearbyCities } from "@/lib/utils/cityNeighbors";
import { getShowBucket } from "@/lib/utils/showState";
import {
  showsFrom,
  showRowToShow,
  venueRowToVenue,
  showArtistRowToShowArtist,
  artistRowToArtist,
  isPublicDataSupabaseEnabled,
  warnSupabaseNotConfigured,
  createTtlFetcher,
} from "@/lib/supabase/publicData";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ============
// Supabase 路径
// ============

/** ShowRow + venue + artists 的 join 结果类型 */
interface ShowJoinRow {
  // show 主表字段
  id: string;
  title: string | null;
  venue_id: string | null;
  city: string;
  date_time: string;
  poster_url: string | null;
  price_presale: number | null;
  price_door: number | null;
  price_text: string | null;
  ticket_platform: string | null;
  ticket_url: string | null;
  ticket_status: string | null;
  status: string;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  // join: venue
  venues: { id: string; name: string; city: string; address: string | null; created_at: string } | null;
  // join: show_artists → artists
  show_artists: Array<{
    id: string;
    show_id: string;
    artist_id: string;
    role: string;
    billing_order: number;
    artists: {
      id: string;
      name: string;
      cover_url: string | null;
      city: string | null;
      country: string | null;
      genres: string[];
      bio: string | null;
      external_links: Record<string, string> | null;
      created_at: string;
    } | null;
  }> | null;
}

/** 把 join 结果转换为前端 Show（含 venue + artists 嵌套） */
function showJoinRowToShow(row: ShowJoinRow): Show {
  const show = showRowToShow({
    id: row.id,
    title: row.title,
    venue_id: row.venue_id,
    city: row.city,
    date_time: row.date_time,
    poster_url: row.poster_url,
    price_presale: row.price_presale,
    price_door: row.price_door,
    price_text: row.price_text,
    ticket_platform: row.ticket_platform,
    ticket_url: row.ticket_url,
    ticket_status: row.ticket_status,
    status: row.status,
    is_demo: row.is_demo,
    created_at: row.created_at,
    updated_at: row.updated_at,
  });

  // venue
  let venue: Venue | undefined;
  if (row.venues) {
    venue = venueRowToVenue(row.venues);
  }
  show.venue = venue;

  // artists
  if (row.show_artists && row.show_artists.length > 0) {
    const artists: ShowArtist[] = row.show_artists.map((sa) => {
      const showArtist = showArtistRowToShowArtist({
        id: sa.id,
        show_id: sa.show_id,
        artist_id: sa.artist_id,
        role: sa.role,
        billing_order: sa.billing_order,
      });
      if (sa.artists) {
        showArtist.artist = artistRowToArtist(sa.artists);
      }
      return showArtist;
    });
    show.artists = artists;
  }

  return show;
}

/** Supabase 路径：拉取全部 shows（含 venue + artists）—— 未缓存原始实现 */
async function fetchShowsFromSupabaseUncached(): Promise<Show[]> {
  const { data, error } = await showsFrom()
    .select(
      `
      *,
      venues:venue_id ( id, name, city, address, created_at ),
      show_artists (
        id, show_id, artist_id, role, billing_order,
        artists:artist_id ( id, name, cover_url, city, country, genres, bio, external_links, created_at )
      )
      `
    )
    .order("date_time", { ascending: true });

  if (error || !data) {
    throw error ?? new Error("fetch shows failed");
  }
  return (data as unknown as ShowJoinRow[]).map(showJoinRowToShow);
}

/**
 * Supabase 路径：拉取全部 shows（含 venue + artists）
 * 加 in-flight 去重 + 短 TTL 缓存，避免首屏 StrictMode/persist 重跑重复打网络。
 */
const fetchShowsFromSupabase = createTtlFetcher(fetchShowsFromSupabaseUncached);

/** Supabase 路径：按 id 拉取单个 show */
async function fetchShowByIdFromSupabase(id: string): Promise<Show | null> {
  const { data, error } = await showsFrom()
    .select(
      `
      *,
      venues:venue_id ( id, name, city, address, created_at ),
      show_artists (
        id, show_id, artist_id, role, billing_order,
        artists:artist_id ( id, name, cover_url, city, country, genres, bio, external_links, created_at )
      )
      `
    )
    .eq("id", id)
    .single();

  if (error || !data) {
    throw error ?? new Error("fetch show by id failed");
  }
  return showJoinRowToShow(data as unknown as ShowJoinRow);
}

/** Supabase 路径：按 artist_id 拉取 shows（复用去重缓存的全量列表，再按 artist 过滤） */
async function fetchShowsByArtistFromSupabase(artistId: string): Promise<Show[]> {
  // 全量列表已内嵌 show_artists + artists，直接 filter，避免额外查询
  const all = await fetchShowsFromSupabase();
  return all.filter((s) =>
    s.artists?.some((sa) => sa.artist_id === artistId)
  );
}

// ============
// 公共 API（保持原签名）
// ============

/** 获取演出列表（支持筛选） */
export async function getShows(filters?: ShowFilters): Promise<PaginatedResult<Show>> {
  let all: Show[];
  if (isPublicDataSupabaseEnabled()) {
    try {
      all = await fetchShowsFromSupabase();
    } catch {
      warnSupabaseNotConfigured("shows");
      all = [...mockShows];
    }
  } else {
    warnSupabaseNotConfigured("shows");
    all = [...mockShows];
  }

  let result = all;
  if (filters?.city) {
    result = result.filter((s) => s.city === filters.city);
  }
  if (filters?.status) {
    // 四态归一过滤：与首页/列表/详情共用 getShowBucket 唯一口径
    const bucketMap: Partial<Record<ShowStatus, ReturnType<typeof getShowBucket>>> = {
      [ShowStatus.UPCOMING]: "upcoming",
      [ShowStatus.ENDED]: "ended",
      [ShowStatus.POSTPONED]: "postponed",
      [ShowStatus.CANCELLED]: "cancelled",
    };
    const bucket = bucketMap[filters.status];
    result = bucket
      ? result.filter((s) => getShowBucket(s) === bucket)
      : result.filter((s) => s.status === filters.status);
  }
  if (filters?.ticket_status) {
    result = result.filter((s) => s.ticket_status === filters.ticket_status);
  }
  if (filters?.artist_id) {
    result = result.filter((s) =>
      s.artists?.some((sa) => sa.artist_id === filters.artist_id)
    );
  }
  if (filters?.date_from) {
    result = result.filter((s) => s.date_time >= filters.date_from!);
  }
  if (filters?.date_to) {
    result = result.filter((s) => s.date_time <= filters.date_to!);
  }
  if (filters?.genre) {
    result = result.filter((s) =>
      s.artists?.some((sa) => sa.artist?.genres.includes(filters.genre!))
    );
  }

  // 按日期排序
  result.sort((a, b) => a.date_time.localeCompare(b.date_time));

  // 分页
  const offset = filters?.offset ?? 0;
  const limit = filters?.limit ?? 50;
  const paginated = result.slice(offset, offset + limit);

  return {
    data: paginated,
    total: result.length,
    has_more: offset + limit < result.length,
  };
}

/** 根据 ID 获取单个演出（含 venue + artists） */
export async function getShowById(id: string): Promise<Show | null> {
  if (isPublicDataSupabaseEnabled()) {
    try {
      return await fetchShowByIdFromSupabase(id);
    } catch {
      warnSupabaseNotConfigured("shows");
      return showMap.get(id) ?? null;
    }
  }
  warnSupabaseNotConfigured("shows");
  return showMap.get(id) ?? null;
}

/** 获取某乐队的所有演出 */
export async function getShowsByArtist(artistId: string): Promise<Show[]> {
  if (isPublicDataSupabaseEnabled()) {
    try {
      return await fetchShowsByArtistFromSupabase(artistId);
    } catch {
      warnSupabaseNotConfigured("shows");
    }
  }
  warnSupabaseNotConfigured("shows");
  const shows = mockShows.filter((s) =>
    s.artists?.some((sa) => sa.artist_id === artistId)
  );
  return delay(shows);
}

/**
 * 获取推荐演出（mock: 返回所有未来 upcoming 演出，按日期排序）
 * 售票状态（coming_soon/on_sale/sold_out）不决定推荐资格，
 * 仅影响 UI 标签和 CTA。sold_out 演出仍需可被发现以查看详情、加入 Room、找搭子、发布收票。
 */
export async function getRecommendedShows(city?: string, limit = 10): Promise<Show[]> {
  let all: Show[];
  if (isPublicDataSupabaseEnabled()) {
    try {
      all = await fetchShowsFromSupabase();
    } catch {
      warnSupabaseNotConfigured("shows");
      all = [...mockShows];
    }
  } else {
    warnSupabaseNotConfigured("shows");
    all = [...mockShows];
  }

  // 即将上演 = 统一口径的 upcoming 分组（演出当天仍算 upcoming；延期/取消/已过排除）
  let result = all.filter((s) => getShowBucket(s) === "upcoming");
  if (city) {
    result = result.filter((s) => s.city === city);
  }
  result.sort((a, b) => a.date_time.localeCompare(b.date_time));
  return result.slice(0, limit);
}

/**
 * 获取各城市 upcoming 演出数量（P0-4：城市数量唯一数据源）。
 *
 * 规则：
 * - 与 getRecommendedShows/getShows 同一真值源与同一口径（getShowBucket upcoming）
 * - 禁止 UI 层 hardcode 城市场次；"N场"数字必须来自本函数
 * - 只返回数量 > 0 的城市
 */
export async function getUpcomingCountsByCity(): Promise<Record<string, number>> {
  let all: Show[];
  if (isPublicDataSupabaseEnabled()) {
    try {
      all = await fetchShowsFromSupabase();
    } catch {
      warnSupabaseNotConfigured("shows");
      all = [...mockShows];
    }
  } else {
    warnSupabaseNotConfigured("shows");
    all = [...mockShows];
  }

  const counts: Record<string, number> = {};
  for (const s of all) {
    if (getShowBucket(s) !== "upcoming") continue;
    counts[s.city] = (counts[s.city] ?? 0) + 1;
  }
  return counts;
}

/**
 * 获取周边城市的 upcoming 演出（首页"本城无演出"兜底推荐）。
 *
 * 规则：
 * - 邻近关系 DEMO 阶段写死（utils/cityNeighbors），严格按距离近→远的城市顺序拉取
 * - 只返回各周边城市真实已存在的演出；某个城市无演出自动跳过，不注入演示数据
 * - 城市内沿用 getShows 的日期升序
 * - 所有周边城市都没有演出时返回空数组，由 UI 回退到原空状态
 */
export async function getNearbyUpcomingShows(
  city: string,
  limit = 8
): Promise<Show[]> {
  const neighbors = getNearbyCities(city);
  const result: Show[] = [];

  for (const neighborCity of neighbors) {
    if (result.length >= limit) break;
    const page = await getShows({
      city: neighborCity,
      status: ShowStatus.UPCOMING,
      limit: limit - result.length,
    });
    result.push(...page.data);
  }

  return result;
}

/**
 * 获取 Show 查找表（P10.2-D：供 Profile 页面替代直接 import mock）
 * - Supabase 配置：fetchShowsFromSupabase → Map
 * - 未配置：fallback showMap (mock)
 */
export async function getShowLookupMap(): Promise<Map<string, Show>> {
  let all: Show[];
  if (isPublicDataSupabaseEnabled()) {
    try {
      all = await fetchShowsFromSupabase();
    } catch {
      warnSupabaseNotConfigured("shows");
      all = [...mockShows];
    }
  } else {
    warnSupabaseNotConfigured("shows");
    all = [...mockShows];
  }
  return new Map(all.map((s) => [s.id, s]));
}
