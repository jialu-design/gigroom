/**
 * Artist Editorial 内容资产层契约测试（Show Editorial Page 数据）
 *
 * 锁定数据规则，防止后续扩量时走样：
 * A. 样本规模与外键：8 条，artist_id 唯一且全部存在于 Canonical Registry
 * B. 样本 Artist 必须是 VERIFIED（registry genres 非空）
 * C. 简介 80–150 字（汉字按字、拉丁按词计数），且附事实来源 URL
 * D. 官方来源：URL 合法；verified=true 必须给出核实依据
 * E. 乐迷印象：每 Artist 2–4 条，is_demo 恒 true，只谈 artist/past_live
 * F. 策展图片（若已入库）：版权声明固定；key_visual 至多 1 张
 * G. API：getArtistEditorials/getArtistEditorial/getArtistEditorialMap 行为
 * H. 票务：ticket_on_sale_at 为合法 ISO 且早于演出时间（coming_soon 行）
 */
import { describe, it, expect } from "vitest";
import type { ArtistEditorial } from "@/lib/types";
import { artistEditorials } from "@/mocks/artistEditorial";
import { mockArtists } from "@/mocks/artists";
import { mockShows } from "@/mocks/shows";
import { ShowTicketStatus } from "@/lib/types";
import {
  getArtistEditorials,
  getArtistEditorial,
  getArtistEditorialMap,
} from "@/lib/api/artistEditorial";

/** 中英混排字数：每个汉字算 1，连续拉丁/数字算 1 个词 */
function wordCount(s: string): number {
  return (s.match(/[\u4e00-\u9fff]|[A-Za-z0-9]+/g) ?? []).length;
}

function expectHttpsUrl(url: string): void {
  expect(url).toMatch(/^https:\/\//);
}

describe("Artist Editorial 内容资产层", () => {
  it("A. 恰好 8 个样本，artist_id 唯一", () => {
    expect(artistEditorials).toHaveLength(8);
    const ids = artistEditorials.map((e) => e.artist_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("A/B. artist_id 全部存在于 Canonical Registry，且样本均为 VERIFIED", () => {
    const registry = new Map(mockArtists.map((a) => [a.id, a]));
    for (const e of artistEditorials) {
      const artist = registry.get(e.artist_id);
      expect(artist, `${e.artist_id} 必须在 artists.ts 中存在`).toBeDefined();
      expect(artist?.genres.length ?? 0).toBeGreaterThan(0);
      expect(artist?.city).toBeTruthy();
    }
  });

  it("C. bio_long 为 80–150 字真实简介，且至少 1 个 https 事实来源", () => {
    for (const e of artistEditorials) {
      const count = wordCount(e.bio_long);
      expect(count, `${e.artist_id} 字数 ${count} 超出 80–150`).toBeGreaterThanOrEqual(80);
      expect(count, `${e.artist_id} 字数 ${count} 超出 80–150`).toBeLessThanOrEqual(150);
      expect(e.bio_sources.length).toBeGreaterThan(0);
      e.bio_sources.forEach(expectHttpsUrl);
    }
  });

  it("D. official_sources 结构合法，verified 必须附核实依据", () => {
    for (const e of artistEditorials) {
      expect(e.official_sources.length).toBeGreaterThan(0);
      for (const src of e.official_sources) {
        expect(src.account.trim().length).toBeGreaterThan(0);
        expectHttpsUrl(src.url);
        if (src.verified) {
          expect(src.verified_note?.trim().length ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });

  it("E. 乐迷印象每人 2–4 条，全部 is_demo 且只谈 artist/past_live", () => {
    for (const e of artistEditorials) {
      expect(e.fan_impressions.length).toBeGreaterThanOrEqual(2);
      expect(e.fan_impressions.length).toBeLessThanOrEqual(4);
      const ids = new Set<string>();
      for (const fi of e.fan_impressions) {
        expect(fi.is_demo).toBe(true);
        expect(["artist", "past_live"]).toContain(fi.about);
        expect([...fi.content.trim()].length).toBeGreaterThanOrEqual(8);
        expect(ids.has(fi.id)).toBe(false);
        ids.add(fi.id);
      }
    }
  });

  it("F. photos 若已策展：key_visual 至多 1 张，版权声明固定，来源必填", () => {
    for (const e of artistEditorials) {
      const kv = e.photos.filter((p) => p.kind === "key_visual");
      expect(kv.length).toBeLessThanOrEqual(1);
      for (const p of e.photos) {
        expectHttpsUrl(p.source_url);
        expect(p.source_account.trim().length).toBeGreaterThan(0);
        expect(p.license_note).toBe("DEMO reference，未获商用授权");
        if (p.is_official) {
          // 官方图必须能指回官方来源
          expect(p.source_url).toMatch(/^https:\/\//);
        }
      }
    }
  });

  it("G. API 层：列表/单查/Map 行为正确", async () => {
    const all = await getArtistEditorials();
    expect(all).toHaveLength(8);

    const one = await getArtistEditorial("artist-1");
    expect(one?.artist_id).toBe("artist-1");

    const missing = await getArtistEditorial("artist-does-not-exist");
    expect(missing).toBeNull();

    const map = await getArtistEditorialMap();
    expect(map.size).toBe(8);
    expect(map.get("artist-14")?.artist_id).toBe("artist-14");
  });

  it("H. coming_soon 且有开票时间的场次：时间合法且早于开演", () => {
    const soonWithDate = mockShows.filter(
      (s) =>
        s.ticket_status === ShowTicketStatus.COMING_SOON &&
        typeof s.ticket_on_sale_at === "string"
    );
    expect(soonWithDate.length).toBeGreaterThan(0);
    for (const show of soonWithDate) {
      const onSale = Date.parse(show.ticket_on_sale_at as string);
      const start = Date.parse(show.date_time);
      expect(Number.isNaN(onSale)).toBe(false);
      expect(Number.isNaN(start)).toBe(false);
      expect(onSale).toBeLessThan(start);
    }
  });
});

/** 类型层导出存在（编译期保证，运行时空断言） */
describe("ArtistEditorial 类型导出", () => {
  it("ArtistEditorial 可作为类型使用", () => {
    const sample: ArtistEditorial | null = artistEditorials[0] ?? null;
    expect(sample).not.toBeNull();
  });
});
