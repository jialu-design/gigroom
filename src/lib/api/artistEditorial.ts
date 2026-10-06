/**
 * API 抽象层 - Artist Editorial 内容资产模块（Show Editorial Page）
 *
 * 当前数据来源：mock（src/mocks/artistEditorial.ts，仅 8 个样本 Artist）。
 * 后续接入 Supabase 时，签名保持不变，内部切换数据源即可（参照 api/artists.ts 模式）。
 *
 * 页面/组件只允许通过本模块读取 Editorial 数据，禁止直接 import mocks。
 */
import type { ArtistEditorial } from "@/lib/types";
import {
  artistEditorials,
  artistEditorialMap,
} from "@/mocks/artistEditorial";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

/** 获取全部 Artist Editorial 内容资产包 */
export async function getArtistEditorials(): Promise<ArtistEditorial[]> {
  return delay(artistEditorials);
}

/** 按 artist_id 获取内容资产包；未配置的 Artist 返回 null */
export async function getArtistEditorial(
  artistId: string
): Promise<ArtistEditorial | null> {
  return delay(artistEditorialMap.get(artistId) ?? null);
}

/** 获取 artist_id → ArtistEditorial 查找表 */
export async function getArtistEditorialMap(): Promise<
  Map<string, ArtistEditorial>
> {
  return delay(new Map(artistEditorialMap));
}
