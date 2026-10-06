/**
 * 周边城市推荐测试
 * - 写死的城市邻近关系（顺序 = 距离近→远）
 * - getNearbyUpcomingShows 只返回周边城市真实已存在的 upcoming 演出
 * - 周边城市全部无演出时返回空数组（由 UI 回退空状态，不注入演示数据）
 * - mock 含 show-22~31 周边城市测试演出（杭州3/苏州2/南京2/天津1/深圳1/重庆1）
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getNearbyCities, NEARBY_CITY_MAP } from "@/lib/utils/cityNeighbors";
import { getNearbyUpcomingShows } from "@/lib/api/shows";
import { ShowStatus } from "@/lib/types";
import { mockShows } from "@/mocks/shows";
import { CITIES } from "@/lib/constants";

// 固定"当前时间"：周边测试锚定 show-13（杭州 2026-09-25）为未来演出，
// 同时保证 show-11（2026-09-15）已过被过滤。
// 仅替换全局 Date 时钟（不用 vi.useFakeTimers，避免影响 Promise/timer 行为）。
const RealDate = Date;
const FIXED_NOW = new RealDate("2026-09-18T12:00:00+08:00").getTime();
class FixedDate extends RealDate {
  constructor(...args: unknown[]) {
    if (args.length === 0) {
      super(FIXED_NOW);
    } else {
      super(...(args as unknown as ConstructorParameters<typeof RealDate>));
    }
  }
  static now(): number {
    return FIXED_NOW;
  }
}
beforeEach(() => {
  (globalThis as { Date: unknown }).Date = FixedDate;
});
afterEach(() => {
  (globalThis as { Date: unknown }).Date = RealDate;
});

describe("城市邻近关系（写死）", () => {
  it("核心城市的邻近城市及顺序符合需求（近 → 远）", () => {
    expect(getNearbyCities("上海")).toEqual(["杭州", "苏州", "南京"]);
    expect(getNearbyCities("北京")).toEqual(["天津", "石家庄"]);
    expect(getNearbyCities("广州")).toEqual(["深圳", "佛山"]);
    expect(getNearbyCities("成都")).toEqual(["重庆"]);
  });

  it("测试城市无锡：周边指向 上海/苏州/南京", () => {
    expect(getNearbyCities("无锡")).toEqual(["上海", "苏州", "南京"]);
    // 无锡无本地演出
    expect(mockShows.filter((s) => s.city === "无锡")).toEqual([]);
  });

  it("无锡已加入可选城市列表（城市选择入口可见）", () => {
    expect(CITIES).toContain("无锡");
  });

  it("未配置邻近关系的城市返回空数组", () => {
    expect(getNearbyCities("武汉")).toEqual([]);
    expect(getNearbyCities("不存在的城市")).toEqual([]);
  });

  it("返回的是副本，调用方修改不影响原始映射表", () => {
    const a = getNearbyCities("上海");
    a.push("篡改城市");
    const b = getNearbyCities("上海");
    expect(b).toEqual(NEARBY_CITY_MAP["上海"]);
    expect(b).not.toContain("篡改城市");
  });
});

describe("getNearbyUpcomingShows 周边演出推荐", () => {
  it("上海：按 杭州→苏州→南京 顺序返回真实演出，城市内按日期升序", async () => {
    const list = await getNearbyUpcomingShows("上海");
    const cities = list.map((s) => s.city);

    // 杭州4场 + 苏州2场 + 南京2场（show-11 日期 2026-09-15 已过被过滤，show-28 顶上）
    expect(cities).toEqual([
      "杭州", "杭州", "杭州", "杭州",
      "苏州", "苏州",
      "南京", "南京",
    ]);

    // 城市分组顺序严格遵循邻近顺序（近 → 远）
    const rank: Record<string, number> = { 杭州: 0, 苏州: 1, 南京: 2 };
    const ranks = cities.map((c) => rank[c]);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
    }

    // 同城内按日期升序
    expect(list.map((s) => s.id)).toEqual([
      "show-13", "show-22", "show-23", "show-24", // 杭州 09-25 → 11-01
      "show-25", "show-26",                        // 苏州 10-18 → 11-08
      "show-27", "show-28",                        // 南京 10-20 → 11-15（show-11 已过期被过滤）
    ]);

    // 全部为 upcoming 演出
    expect(list.every((s) => s.status === ShowStatus.UPCOMING)).toBe(true);
  });

  it("广州：返回深圳的全部真实 upcoming 演出", async () => {
    const list = await getNearbyUpcomingShows("广州");
    expect(list.map((s) => s.city)).toEqual(["深圳", "深圳"]);
    expect(list.map((s) => s.id)).toEqual(["show-14", "show-30"]);
    expect(list.every((s) => s.status === ShowStatus.UPCOMING)).toBe(true);
  });

  it("北京：返回天津的真实演出，石家庄无演出自动跳过", async () => {
    const list = await getNearbyUpcomingShows("北京");
    expect(list.map((s) => s.city)).toEqual(["天津"]);
    expect(list.map((s) => s.id)).toEqual(["show-29"]);
  });

  it("成都：返回重庆的真实演出", async () => {
    const list = await getNearbyUpcomingShows("成都");
    expect(list.map((s) => s.city)).toEqual(["重庆"]);
    expect(list.map((s) => s.id)).toEqual(["show-31"]);
  });

  it("无锡（测试城市）：按 上海→苏州→南京 顺序返回周边演出", async () => {
    const list = await getNearbyUpcomingShows("无锡");
    const cities = list.map((s) => s.city);

    // 上海2场（show-15/show-17，其余上海演出日期已过被过滤）
    // + 苏州2场 + 南京2场（show-27/show-28；show-11 已过期被过滤）
    expect(cities).toEqual([
      "上海", "上海",
      "苏州", "苏州",
      "南京", "南京",
    ]);
    expect(list.map((s) => s.id)).toEqual([
      "show-15", "show-17", // 上海 10-02 → 10-08
      "show-25", "show-26", // 苏州 10-18 → 11-08
      "show-27", "show-28", // 南京 10-20 → 11-15
    ]);

    // 城市分组顺序：上海(0) → 苏州(1) → 南京(2)
    const rank: Record<string, number> = { 上海: 0, 苏州: 1, 南京: 2 };
    const ranks = cities.map((c) => rank[c]);
    for (let i = 1; i < ranks.length; i++) {
      expect(ranks[i]).toBeGreaterThanOrEqual(ranks[i - 1]);
    }

    // Hero 兜底取第一场：应为上海最早日期的 upcoming 演出
    expect(cities[0]).toBe("上海");
    expect(list[0].city).toBe("上海");
  });

  it("未配置邻近关系的城市返回空数组", async () => {
    const list = await getNearbyUpcomingShows("武汉");
    expect(list).toEqual([]);
  });

  it("limit 生效：截断但保留最近城市优先", async () => {
    const list = await getNearbyUpcomingShows("上海", 1);
    expect(list).toHaveLength(1);
    expect(list[0].city).toBe("杭州");
    expect(list[0].id).toBe("show-13"); // 杭州最早日期
  });

  it("不会返回任何非周边城市的演出", async () => {
    const allowed = new Set(NEARBY_CITY_MAP["上海"]);
    const list = await getNearbyUpcomingShows("上海");
    expect(list.every((s) => allowed.has(s.city))).toBe(true);
  });

  it("结果均来自现有 mock 数据源中的真实演出记录", async () => {
    const mockIds = new Set(mockShows.map((s) => s.id));
    const list = await getNearbyUpcomingShows("无锡");
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((s) => mockIds.has(s.id))).toBe(true);
  });

  it("新增 mock 演出数据完整性：show-22~31 均为 UPCOMING + is_demo + 字段齐全", () => {
    const newShows = mockShows.filter((s) =>
      ["show-22", "show-23", "show-24", "show-25", "show-26",
        "show-27", "show-28", "show-29", "show-30", "show-31"].includes(s.id)
    );
    expect(newShows).toHaveLength(10);

    for (const s of newShows) {
      expect(s.status).toBe(ShowStatus.UPCOMING);
      expect(s.is_demo).toBe(true);
      expect(s.title).toContain("DEMO");
      expect(s.price_text).toContain("DEMO");
      expect(s.poster_url).toMatch(/^\/images\/shows\/show-0[1-6]\.jpg$/);
      expect(s.venue).toBeDefined();
      expect(s.venue?.city).toBe(s.city);
      expect(s.artists?.length).toBeGreaterThan(0);
      expect(s.artists?.every((sa) => sa.artist !== undefined)).toBe(true);
    }

    // 城市分布：杭州3 / 苏州2 / 南京2 / 天津1 / 深圳1 / 重庆1
    const cityCount: Record<string, number> = {};
    for (const s of newShows) cityCount[s.city] = (cityCount[s.city] ?? 0) + 1;
    expect(cityCount).toEqual({ 杭州: 3, 苏州: 2, 南京: 2, 天津: 1, 深圳: 1, 重庆: 1 });
  });
});
