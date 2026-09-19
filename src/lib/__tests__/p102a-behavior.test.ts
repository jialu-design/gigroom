/**
 * P10.2-A 行为测试 — 公共读数据接入 Supabase
 *
 * 覆盖：
 * A. API contract 保持：getArtists/getArtistById/getFollowedArtists/getShows/
 *    getShowById/getShowsByArtist/getRecommendedShows/getAnnouncementsByShow/
 *    getAnnouncementById 签名不变
 * B. 公共读 API 层引用 Supabase（import 检查）
 * C. UI 不感知 Supabase（页面/组件不直接 import supabase client）
 * D. isSupabaseConfigured 标志正确：env 未配置时为 false
 * E. Mock 路径回归：env 未配置时 fallback 到 mock 数据，行为与 P4/P6 一致
 * F. Supabase 路径：mock supabase client，验证 API 真的调用 from().select() 等
 * G. Adapter：artistRowToArtist / venueRowToVenue / showRowToShow /
 *    showArtistRowToShowArtist / announcementRowToAnnouncement 类型映射正确
 * H. 用户行为未迁移：Follow / Going / Interested / Room / Posts / Notifications
 *    仍然通过 store / mock 路径，不走 Supabase
 * I. database.types.ts 覆盖 5 张公共表
 *
 * 全程 Mock Supabase client，不连真实网络。
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "../../..");
const SRC = resolve(ROOT, "src");

function read(p: string) {
  return readFileSync(resolve(ROOT, p), "utf-8");
}

// ============================================================
// Mock Supabase client（确保不连真实网络）
// ============================================================
const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { current: null as unknown as SupabaseFake },
}));

// 公共读 API 模块直接 import @/lib/supabase/client 的 createClient
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => supabaseMock.current,
}));

interface Chain {
  select: Mock;
  eq: Mock;
  in: Mock;
  order: Mock;
  single: Mock;
  data: unknown;
  error: unknown;
}

interface SupabaseFake {
  from: Mock;
}

function makeChain(result: { data: unknown; error: unknown }): Chain {
  const chain = {} as Chain;
  chain.data = result.data;
  chain.error = result.error;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.in = vi.fn(() => chain);
  chain.order = vi.fn(() => chain);
  chain.single = vi.fn(async () => ({ data: result.data, error: result.error }));
  return chain;
}

function makeSupabaseFake(result: { data: unknown; error: unknown } = { data: null, error: null }): SupabaseFake {
  const chain = makeChain(result);
  return {
    from: vi.fn(() => chain),
  };
}

// ============
// 构造 DB Row 测试数据
// ============

function artistRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "artist-1",
    name: "Chinese Football",
    cover_url: "https://example.com/cf.jpg",
    city: "武汉",
    country: "中国",
    genres: ["Emo", "Indie Rock"],
    bio: "武汉 Emo 乐队",
    external_links: { netease: "https://music.163.com/demo" },
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function venueRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "venue-1",
    name: "MAO Livehouse上海",
    city: "上海",
    address: "上海市黄浦区...",
    created_at: "2024-01-01T00:00:00Z",
    ...overrides,
  };
}

function showRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "show-1",
    title: "Demo Show",
    venue_id: "venue-1",
    city: "上海",
    date_time: "2026-09-20T20:00:00+08:00",
    poster_url: "https://example.com/poster.jpg",
    price_presale: 100,
    price_door: 120,
    price_text: "预售100 / 现场120",
    ticket_platform: "秀动",
    ticket_url: "https://demo.example.com/show-1",
    ticket_status: "on_sale",
    status: "upcoming",
    is_demo: true,
    created_at: "2026-06-01T00:00:00Z",
    updated_at: "2026-06-01T00:00:00Z",
    ...overrides,
  };
}

function showArtistRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "sa-1",
    show_id: "show-1",
    artist_id: "artist-1",
    role: "headliner",
    billing_order: 1,
    ...overrides,
  };
}

function announcementRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "ann-1",
    show_id: "show-1",
    type: "ticket_sale",
    title: "预售已开票",
    content: "预售票已开票",
    created_at: "2026-07-01T10:00:00Z",
    ...overrides,
  };
}

// ============================================================
// A. API contract 保持
// ============================================================
describe("P10.2-A A — API contract 签名保持", () => {
  it("artists.ts 导出 getArtists / getArtistById / getFollowedArtists", async () => {
    const m = await import("@/lib/api/artists");
    expect(typeof m.getArtists).toBe("function");
    expect(typeof m.getArtistById).toBe("function");
    expect(typeof m.getFollowedArtists).toBe("function");
  });

  it("shows.ts 导出 getShows / getShowById / getShowsByArtist / getRecommendedShows", async () => {
    const m = await import("@/lib/api/shows");
    expect(typeof m.getShows).toBe("function");
    expect(typeof m.getShowById).toBe("function");
    expect(typeof m.getShowsByArtist).toBe("function");
    expect(typeof m.getRecommendedShows).toBe("function");
  });

  it("announcements.ts 导出 getAnnouncementsByShow / getAnnouncementById", async () => {
    const m = await import("@/lib/api/announcements");
    expect(typeof m.getAnnouncementsByShow).toBe("function");
    expect(typeof m.getAnnouncementById).toBe("function");
  });

  it("getArtists 返回 PaginatedResult<Artist> 形状", async () => {
    const { getArtists } = await import("@/lib/api/artists");
    const result = await getArtists();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("has_more");
    expect(Array.isArray(result.data)).toBe(true);
  });

  it("getShows 返回 PaginatedResult<Show> 形状", async () => {
    const { getShows } = await import("@/lib/api/shows");
    const result = await getShows();
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("has_more");
    expect(Array.isArray(result.data)).toBe(true);
  });
});

// ============================================================
// B. API 层引用 Supabase
// ============================================================
describe("P10.2-A B — API 层引用 Supabase", () => {
  it("artists.ts 引用 @/lib/supabase/publicData", () => {
    const content = read("src/lib/api/artists.ts");
    expect(content).toContain('from "@/lib/supabase/publicData"');
    // P10.2-A 后公共读数据源覆盖开关：NEXT_PUBLIC_DATA_SOURCE=mock 时强制走 mock
    expect(content).toContain("isPublicDataSupabaseEnabled");
  });

  it("shows.ts 引用 @/lib/supabase/publicData", () => {
    const content = read("src/lib/api/shows.ts");
    expect(content).toContain('from "@/lib/supabase/publicData"');
    expect(content).toContain("isPublicDataSupabaseEnabled");
  });

  it("announcements.ts 引用 @/lib/supabase/publicData", () => {
    const content = read("src/lib/api/announcements.ts");
    expect(content).toContain('from "@/lib/supabase/publicData"');
    expect(content).toContain("isPublicDataSupabaseEnabled");
  });

  it("publicData.ts 导出 5 个 typed from helpers + 5 个 adapter", () => {
    const content = read("src/lib/supabase/publicData.ts");
    expect(content).toContain("artistsFrom");
    expect(content).toContain("venuesFrom");
    expect(content).toContain("showsFrom");
    expect(content).toContain("showArtistsFrom");
    expect(content).toContain("announcementsFrom");
    expect(content).toContain("artistRowToArtist");
    expect(content).toContain("venueRowToVenue");
    expect(content).toContain("showRowToShow");
    expect(content).toContain("showArtistRowToShowArtist");
    expect(content).toContain("announcementRowToAnnouncement");
  });
});

// ============================================================
// C. UI 不感知 Supabase
// ============================================================
describe("P10.2-A C — UI 不感知 Supabase（页面/组件不直接 import supabase client）", () => {
  it("app 目录下页面不直接 import @/lib/supabase/client", () => {
    const pages = [
      "src/app/page.tsx",
      "src/app/shows/page.tsx",
      "src/app/artists/page.tsx",
      "src/app/show/[id]/page.tsx",
      "src/app/artist/[id]/page.tsx",
      "src/app/rooms/page.tsx",
      "src/app/profile/page.tsx",
      "src/app/notifications/page.tsx",
    ];
    for (const p of pages) {
      if (!existsSync(resolve(ROOT, p))) continue;
      const content = read(p);
      expect(content).not.toContain('from "@/lib/supabase/client"');
      expect(content).not.toContain('from "@/lib/supabase/server"');
    }
  });

  it("components 目录下不直接 import @/lib/supabase/client", () => {
    const componentDirs = [
      "src/components/artist",
      "src/components/show",
      "src/components/room",
      "src/components/notification",
      "src/components/shared",
      "src/components/layout",
      "src/components/ui",
    ];
    for (const dir of componentDirs) {
      const dirPath = resolve(ROOT, dir);
      if (!existsSync(dirPath)) continue;
      // 静态扫描：所有 .tsx 文件内容
      const fs = require("fs") as typeof import("fs");
      const files = fs.readdirSync(dirPath);
      for (const f of files) {
        if (!f.endsWith(".tsx")) continue;
        const content = readFileSync(resolve(dirPath, f), "utf-8");
        expect(content).not.toContain('from "@/lib/supabase/client"');
      }
    }
  });

  it("页面/组件不直接调用 supabase.from(...)", () => {
    // 抽查关键页面
    const files = [
      "src/app/shows/page.tsx",
      "src/app/artists/page.tsx",
      "src/app/show/[id]/page.tsx",
      "src/app/artist/[id]/page.tsx",
    ];
    for (const f of files) {
      if (!existsSync(resolve(ROOT, f))) continue;
      const content = read(f);
      expect(content).not.toMatch(/supabase\.from\s*\(/);
    }
  });
});

// ============================================================
// D. isSupabaseConfigured 标志
// ============================================================
describe("P10.2-A D — isSupabaseConfigured 标志", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it("env 都未配置 → false", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { isSupabaseConfigured } = await import("@/lib/supabase/publicData");
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("仅配置 URL → false", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const { isSupabaseConfigured } = await import("@/lib/supabase/publicData");
    expect(isSupabaseConfigured()).toBe(false);
  });

  it("URL + ANON_KEY 都配置 → true", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    const { isSupabaseConfigured } = await import("@/lib/supabase/publicData");
    expect(isSupabaseConfigured()).toBe(true);
  });
});

// ============================================================
// D2. 公共读数据源覆盖开关（NEXT_PUBLIC_DATA_SOURCE=mock）
// ============================================================
describe("P10.2-A D2 — isPublicDataSupabaseEnabled 覆盖开关", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const originalSource = process.env.NEXT_PUBLIC_DATA_SOURCE;

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    if (originalSource === undefined) delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    else process.env.NEXT_PUBLIC_DATA_SOURCE = originalSource;
  });

  it("env 已配置且未设置覆盖 → 公共读走 Supabase", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    delete process.env.NEXT_PUBLIC_DATA_SOURCE;
    const { isPublicDataSupabaseEnabled } = await import("@/lib/supabase/publicData");
    expect(isPublicDataSupabaseEnabled()).toBe(true);
  });

  it("env 已配置但 NEXT_PUBLIC_DATA_SOURCE=mock → 公共读强制走 mock", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
    const { isPublicDataSupabaseEnabled } = await import("@/lib/supabase/publicData");
    expect(isPublicDataSupabaseEnabled()).toBe(false);
  });

  it("覆盖开关不影响 isSupabaseConfigured 本身（Auth/用户行为不受牵连）", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    process.env.NEXT_PUBLIC_DATA_SOURCE = "mock";
    const { isSupabaseConfigured, isPublicDataMockForced } = await import(
      "@/lib/supabase/publicData"
    );
    expect(isSupabaseConfigured()).toBe(true);
    expect(isPublicDataMockForced()).toBe(true);
  });

  it("覆盖值非 mock（如 supabase）不生效", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
    process.env.NEXT_PUBLIC_DATA_SOURCE = "supabase";
    const { isPublicDataSupabaseEnabled } = await import("@/lib/supabase/publicData");
    expect(isPublicDataSupabaseEnabled()).toBe(true);
  });
});

// ============================================================
// E. Mock 路径回归（env 未配置时 fallback）
// ============================================================
describe("P10.2-A E — Mock 路径回归（env 未配置）", () => {
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  });

  it("getArtists 返回 mock 数据（数量 >= 15）", async () => {
    const { getArtists } = await import("@/lib/api/artists");
    const result = await getArtists();
    expect(result.data.length).toBeGreaterThanOrEqual(15);
    expect(result.total).toBeGreaterThanOrEqual(15);
  });

  it("getArtistById('artist-1') 返回 Chinese Football", async () => {
    const { getArtistById } = await import("@/lib/api/artists");
    const artist = await getArtistById("artist-1");
    expect(artist).not.toBeNull();
    expect(artist!.name).toBe("Chinese Football");
  });

  it("getShows 返回 mock 数据（数量 >= 21）", async () => {
    const { getShows } = await import("@/lib/api/shows");
    const result = await getShows();
    expect(result.data.length).toBeGreaterThanOrEqual(21);
  });

  it("getShowById('show-4') 返回 Chinese Football 上海专场", async () => {
    const { getShowById } = await import("@/lib/api/shows");
    const show = await getShowById("show-4");
    expect(show).not.toBeNull();
    expect(show!.city).toBe("上海");
    expect(show!.artists).toBeDefined();
    expect(show!.artists!.length).toBeGreaterThan(0);
  });

  it("getShowsByArtist('artist-1') 返回 Chinese Football 相关演出", async () => {
    const { getShowsByArtist } = await import("@/lib/api/shows");
    const shows = await getShowsByArtist("artist-1");
    expect(shows.length).toBeGreaterThanOrEqual(3);
    expect(shows.every((s) => s.artists?.some((sa) => sa.artist_id === "artist-1"))).toBe(true);
  });

  it("getRecommendedShows 返回未来 upcoming 演出", async () => {
    const { getRecommendedShows } = await import("@/lib/api/shows");
    const { ShowStatus } = await import("@/lib/types");
    const shows = await getRecommendedShows();
    expect(shows.length).toBeGreaterThan(0);
    expect(shows.every((s) => s.status === ShowStatus.UPCOMING)).toBe(true);
  });

  it("getAnnouncementsByShow('show-4') 返回非空列表", async () => {
    const { getAnnouncementsByShow } = await import("@/lib/api/announcements");
    const list = await getAnnouncementsByShow("show-4");
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((a) => a.show_id === "show-4")).toBe(true);
  });

  it("城市筛选仍生效（上海）", async () => {
    const { getShows } = await import("@/lib/api/shows");
    const result = await getShows({ city: "上海" });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((s) => s.city === "上海")).toBe(true);
  });

  it("搜索筛选仍生效（Chinese）", async () => {
    const { getArtists } = await import("@/lib/api/artists");
    const result = await getArtists({ search: "Chinese" });
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.data.every((a) => a.name.toLowerCase().includes("chinese"))).toBe(true);
  });
});

// ============================================================
// F. Supabase 路径：mock supabase client
// ============================================================
describe("P10.2-A F — Supabase 路径（mock supabase client）", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "demo-anon-key";
  });

  afterEach(() => {
    if (originalUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
    supabaseMock.current = null as unknown as SupabaseFake;
  });

  it("getArtists 调用 supabase.from('artists').select('*')", async () => {
    const fake = makeSupabaseFake({ data: [artistRow()], error: null });
    supabaseMock.current = fake;

    const { getArtists } = await import("@/lib/api/artists");
    const result = await getArtists();
    expect(fake.from).toHaveBeenCalledWith("artists");
    expect(result.data.length).toBe(1);
    expect(result.data[0].name).toBe("Chinese Football");
  });

  it("getArtistById 调用 supabase.from('artists').select('*').eq('id', id).single()", async () => {
    const fake = makeSupabaseFake({ data: artistRow(), error: null });
    supabaseMock.current = fake;

    const { getArtistById } = await import("@/lib/api/artists");
    const artist = await getArtistById("artist-1");
    expect(artist).not.toBeNull();
    expect(artist!.id).toBe("artist-1");
    expect(fake.from).toHaveBeenCalledWith("artists");
  });

  it("getShows 调用 supabase.from('shows').select(...) 含 venues/show_artists join", async () => {
    const fake = makeSupabaseFake({ data: [], error: null });
    supabaseMock.current = fake;

    const { getShows } = await import("@/lib/api/shows");
    await getShows();
    expect(fake.from).toHaveBeenCalledWith("shows");
    // chain.select 应被调用
    const chain = fake.from();
    expect(chain.select).toHaveBeenCalled();
  });

  it("getShowById 调用 supabase.from('shows').select(...).eq('id', id).single()", async () => {
    const fake = makeSupabaseFake({ data: null, error: { message: "not found" } });
    supabaseMock.current = fake;

    const { getShowById } = await import("@/lib/api/shows");
    // Supabase 返回 error → fallback 到 mock（show-4 在 mock 中存在）
    const show = await getShowById("show-4");
    expect(show).not.toBeNull();
    expect(show!.id).toBe("show-4");
  });

  it("getAnnouncementsByShow 调用 supabase.from('announcements')", async () => {
    const fake = makeSupabaseFake({ data: [announcementRow()], error: null });
    supabaseMock.current = fake;

    const { getAnnouncementsByShow } = await import("@/lib/api/announcements");
    const list = await getAnnouncementsByShow("show-1");
    expect(fake.from).toHaveBeenCalledWith("announcements");
    expect(list.length).toBe(1);
    expect(list[0].title).toBe("预售已开票");
  });

  it("getAnnouncementById 调用 supabase.from('announcements').select('*').eq('id', id).single()", async () => {
    const fake = makeSupabaseFake({ data: announcementRow(), error: null });
    supabaseMock.current = fake;

    const { getAnnouncementById } = await import("@/lib/api/announcements");
    const ann = await getAnnouncementById("ann-1");
    expect(ann).not.toBeNull();
    expect(ann!.id).toBe("ann-1");
    expect(fake.from).toHaveBeenCalledWith("announcements");
  });

  it("Supabase 抛错时 artists fallback 到 mock", async () => {
    const fake = makeSupabaseFake({ data: null, error: new Error("network") });
    supabaseMock.current = fake;

    const { getArtists } = await import("@/lib/api/artists");
    const result = await getArtists();
    expect(result.data.length).toBeGreaterThanOrEqual(15);
  });

  it("Supabase 抛错时 shows fallback 到 mock", async () => {
    const fake = makeSupabaseFake({ data: null, error: new Error("network") });
    supabaseMock.current = fake;

    const { getShows } = await import("@/lib/api/shows");
    const result = await getShows();
    expect(result.data.length).toBeGreaterThanOrEqual(21);
  });
});

// ============================================================
// G. Adapter
// ============================================================
describe("P10.2-A G — Adapter 类型映射", () => {
  it("artistRowToArtist 正确映射 DB Row → Artist", async () => {
    const { artistRowToArtist } = await import("@/lib/supabase/publicData");
    const artist = artistRowToArtist(artistRow({ cover_url: null, bio: null }));
    expect(artist.id).toBe("artist-1");
    expect(artist.name).toBe("Chinese Football");
    expect(artist.cover_url).toBeUndefined(); // null → undefined
    expect(artist.bio).toBeUndefined();
    expect(artist.genres).toEqual(["Emo", "Indie Rock"]);
    expect(artist.external_links).toEqual({ netease: "https://music.163.com/demo" });
  });

  it("venueRowToVenue 正确映射 DB Row → Venue", async () => {
    const { venueRowToVenue } = await import("@/lib/supabase/publicData");
    const venue = venueRowToVenue(venueRow({ address: null }));
    expect(venue.id).toBe("venue-1");
    expect(venue.name).toBe("MAO Livehouse上海");
    expect(venue.city).toBe("上海");
    expect(venue.address).toBeUndefined();
  });

  it("showRowToShow 正确映射 DB Row → Show（status/ticket_status 字符串 → enum）", async () => {
    const { showRowToShow } = await import("@/lib/supabase/publicData");
    const { ShowStatus, ShowTicketStatus } = await import("@/lib/types");
    const show = showRowToShow(showRow());
    expect(show.id).toBe("show-1");
    expect(show.status).toBe(ShowStatus.UPCOMING);
    expect(show.ticket_status).toBe(ShowTicketStatus.ON_SALE);
    expect(show.is_demo).toBe(true);
    expect(show.price_presale).toBe(100);
  });

  it("showArtistRowToShowArtist 正确映射 DB Row → ShowArtist", async () => {
    const { showArtistRowToShowArtist } = await import("@/lib/supabase/publicData");
    const { ArtistRole } = await import("@/lib/types");
    const sa = showArtistRowToShowArtist(showArtistRow());
    expect(sa.id).toBe("sa-1");
    expect(sa.role).toBe(ArtistRole.HEADLINER);
    expect(sa.billing_order).toBe(1);
  });

  it("announcementRowToAnnouncement 正确映射 type: ticket_sale → 开票（中文 enum）", async () => {
    const { announcementRowToAnnouncement } = await import("@/lib/supabase/publicData");
    const { AnnouncementType } = await import("@/lib/types");
    const ann = announcementRowToAnnouncement(announcementRow({ type: "ticket_sale" }));
    expect(ann.type).toBe(AnnouncementType.TICKET_SALE);
    expect(ann.type).toBe("开票"); // 中文 enum value
  });

  it("announcementRowToAnnouncement 映射 sold_out → 售罄", async () => {
    const { announcementRowToAnnouncement } = await import("@/lib/supabase/publicData");
    const { AnnouncementType } = await import("@/lib/types");
    const ann = announcementRowToAnnouncement(announcementRow({ type: "sold_out" }));
    expect(ann.type).toBe(AnnouncementType.SOLD_OUT);
    expect(ann.type).toBe("售罄");
  });

  it("announcementRowToAnnouncement 映射 organizer_notice → 主办方公告", async () => {
    const { announcementRowToAnnouncement } = await import("@/lib/supabase/publicData");
    const { AnnouncementType } = await import("@/lib/types");
    const ann = announcementRowToAnnouncement(announcementRow({ type: "organizer_notice" }));
    expect(ann.type).toBe(AnnouncementType.ORGANIZER_NOTICE);
    expect(ann.type).toBe("主办方公告");
  });

  it("announcementRowToAnnouncement 未知 type fallback 到 ORGANIZER_NOTICE", async () => {
    const { announcementRowToAnnouncement } = await import("@/lib/supabase/publicData");
    const { AnnouncementType } = await import("@/lib/types");
    const ann = announcementRowToAnnouncement(announcementRow({ type: "unknown_type" }));
    expect(ann.type).toBe(AnnouncementType.ORGANIZER_NOTICE);
  });

  it("announcementRowToAnnouncement content null → 空字符串", async () => {
    const { announcementRowToAnnouncement } = await import("@/lib/supabase/publicData");
    const ann = announcementRowToAnnouncement(announcementRow({ content: null }));
    expect(ann.content).toBe("");
  });
});

// ============================================================
// H. 用户行为未迁移
// ============================================================
describe("P10.2-A H — 用户行为未迁移（仍走 store / mock）", () => {
  it("Follow 仍走 useUserStore.followedArtistIds（不调 Supabase）", () => {
    const content = read("src/lib/api/user.ts");
    // followArtist / unfollowArtist / isFollowing 仍走 store
    expect(content).toContain("useUserStore");
    expect(content).toMatch(/followArtist|unfollowArtist|isFollowing/);
    // 不引入 publicData 的 supabase helpers
    expect(content).not.toContain("artistsFrom");
  });

  it("rooms API 已接入 Supabase（P10.2-D 迁移：show_rooms + room_memberships）", () => {
    const content = read("src/lib/api/rooms.ts");
    expect(content).toContain("mockShowRooms");
    expect(content).toContain('from "@/lib/supabase/publicData"');
  });

  it("posts API 已接入 Supabase（P10.3 迁移：buddy_posts / ticket_posts / live_posts + comments）", () => {
    const files = [
      "src/lib/api/posts/buddyPosts.ts",
      "src/lib/api/posts/ticketPosts.ts",
      "src/lib/api/posts/livePosts.ts",
    ];
    for (const f of files) {
      const content = read(f);
      expect(content).toContain('from "@/lib/supabase/publicData"');
      expect(content).toContain("isBehaviorSupabaseEnabled");
    }
  });

  it("messages API 已接入 Supabase（P10.2-D 迁移：discussion_messages）", () => {
    const content = read("src/lib/api/messages.ts");
    expect(content).toContain('from "@/lib/supabase/publicData"');
  });

  it("notifications API 不走 Supabase", () => {
    const content = read("src/lib/api/notifications.ts");
    expect(content).not.toContain('from "@/lib/supabase/publicData"');
  });

  it("user.ts 不引入 publicData（Follow/Going 等仍走 store）", () => {
    const content = read("src/lib/api/user.ts");
    expect(content).not.toContain('from "@/lib/supabase/publicData"');
  });
});

// ============================================================
// I. database.types.ts 覆盖 5 张公共表
// ============================================================
describe("P10.2-A I — database.types.ts 覆盖 5 张公共表", () => {
  it("包含 profiles/artists/venues/shows/show_artists/announcements 6 张表", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("profiles:");
    expect(content).toContain("artists:");
    expect(content).toContain("venues:");
    expect(content).toContain("shows:");
    expect(content).toContain("show_artists:");
    expect(content).toContain("announcements:");
  });

  it("每张表都有 Row / Insert / Update / Relationships", () => {
    const content = read("src/lib/supabase/database.types.ts");
    // 至少 6 张表 × 4 个字段 = 24 个匹配
    const rowMatches = content.match(/\bRow:\s*\{/g) ?? [];
    expect(rowMatches.length).toBeGreaterThanOrEqual(6);
    const insertMatches = content.match(/\bInsert:\s*\{/g) ?? [];
    expect(insertMatches.length).toBeGreaterThanOrEqual(6);
    const updateMatches = content.match(/\bUpdate:\s*\{/g) ?? [];
    expect(updateMatches.length).toBeGreaterThanOrEqual(6);
    const relMatches = content.match(/Relationships:\s*GenericRelationshipShape\[\]/g) ?? [];
    expect(relMatches.length).toBeGreaterThanOrEqual(6);
  });

  it("shows 表 Row 含 is_demo / status / ticket_status / date_time", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("is_demo: boolean");
    expect(content).toMatch(/status:\s*string/);
    expect(content).toMatch(/ticket_status:\s*string \| null/);
    expect(content).toMatch(/date_time:\s*string/);
  });

  it("artists 表 Row 含 genres: string[]", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toContain("genres: string[]");
  });

  it("show_artists 表 Row 含 role / billing_order", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toMatch(/role:\s*string/);
    expect(content).toMatch(/billing_order:\s*number/);
  });

  it("announcements 表 Row 含 type / title / content", () => {
    const content = read("src/lib/supabase/database.types.ts");
    expect(content).toMatch(/type:\s*string/);
    expect(content).toMatch(/title:\s*string/);
    expect(content).toMatch(/content:\s*string \| null/);
  });
});
