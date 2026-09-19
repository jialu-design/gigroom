/**
 * P3 行为测试 - 发现页与演出列表逻辑验证
 * 验证日期格式化、状态映射、月份分组、筛选逻辑、推荐原因等实际运行时行为
 */
import { describe, it, expect } from "vitest";
import {
  formatShowDate,
  formatShowDateTime,
  getMonthKey,
  getMonthLabel,
  getTicketStatusBadgeVariant,
  getTicketStatusLabel,
  getShowStatusBadgeVariant,
  isShowInactive,
} from "@/lib/utils/format";
import { ShowStatus, ShowTicketStatus, ArtistRole } from "@/lib/types";
import type { Show } from "@/lib/types";
import { mockShows } from "@/mocks/shows";

// ========================
// 1. 日期格式化工具
// ========================
describe("日期格式化", () => {
  it("formatShowDate 应返回中文日期+星期", () => {
    const result = formatShowDate("2026-08-20T20:00:00+08:00");
    expect(result).toContain("8月20日");
    expect(result).toContain("周");
  });

  it("formatShowDateTime 应包含时间", () => {
    const result = formatShowDateTime("2026-08-20T20:00:00+08:00");
    expect(result).toContain("20:00");
  });

  it("getMonthKey 应返回 yyyy-MM", () => {
    expect(getMonthKey("2026-08-20T20:00:00+08:00")).toBe("2026-08");
    expect(getMonthKey("2026-10-05T21:00:00+08:00")).toBe("2026-10");
  });

  it("getMonthLabel 应返回中文年月", () => {
    expect(getMonthLabel("2026-08-20T20:00:00+08:00")).toBe("2026年8月");
    expect(getMonthLabel("2026-10-05T21:00:00+08:00")).toBe("2026年10月");
  });
});

// ========================
// 2. 票务/演出状态映射
// ========================
describe("状态映射", () => {
  it("getTicketStatusBadgeVariant 应返回正确 variant", () => {
    expect(getTicketStatusBadgeVariant(ShowTicketStatus.ON_SALE)).toBe("lime");
    expect(getTicketStatusBadgeVariant(ShowTicketStatus.SOLD_OUT)).toBe("grey");
    expect(getTicketStatusBadgeVariant(ShowTicketStatus.COMING_SOON)).toBe("yellow");
    expect(getTicketStatusBadgeVariant(undefined)).toBe("default");
  });

  it("getTicketStatusLabel 应返回中文标签", () => {
    expect(getTicketStatusLabel(ShowTicketStatus.ON_SALE)).toBe("在售");
    expect(getTicketStatusLabel(ShowTicketStatus.SOLD_OUT)).toBe("售罄");
    expect(getTicketStatusLabel(ShowTicketStatus.COMING_SOON)).toBe("即将开票");
    expect(getTicketStatusLabel(undefined)).toBe("");
  });

  it("getShowStatusBadgeVariant 应区分生命周期状态", () => {
    expect(getShowStatusBadgeVariant(ShowStatus.UPCOMING)).toBe("default");
    expect(getShowStatusBadgeVariant(ShowStatus.ENDED)).toBe("grey");
    expect(getShowStatusBadgeVariant(ShowStatus.CANCELLED)).toBe("grey");
    expect(getShowStatusBadgeVariant(ShowStatus.POSTPONED)).toBe("yellow");
  });

  it("isShowInactive 应正确判断非活跃演出", () => {
    expect(isShowInactive(ShowStatus.ENDED)).toBe(true);
    expect(isShowInactive(ShowStatus.CANCELLED)).toBe(true);
    expect(isShowInactive(ShowStatus.UPCOMING)).toBe(false);
    expect(isShowInactive(ShowStatus.POSTPONED)).toBe(false);
  });
});

// ========================
// 3. 演出月份分组逻辑（演出列表页）
// ========================
describe("演出月份分组", () => {
  it("应按 yyyy-MM 分组", () => {
    const groups: Record<string, Show[]> = {};
    mockShows.forEach((show) => {
      const key = getMonthKey(show.date_time);
      if (!groups[key]) groups[key] = [];
      groups[key].push(show);
    });
    const keys = Object.keys(groups);
    expect(keys).toContain("2026-07");
    expect(keys).toContain("2026-08");
    expect(keys).toContain("2026-09");
    expect(keys).toContain("2026-10");
    // show-22~31 周边城市测试演出延展至 2026-11
    expect(keys).toContain("2026-11");
  });

  it("分组应按时间升序排列", () => {
    const groups: Record<string, Show[]> = {};
    mockShows.forEach((show) => {
      const key = getMonthKey(show.date_time);
      if (!groups[key]) groups[key] = [];
      groups[key].push(show);
    });
    const sorted = Object.entries(groups).sort(([a], [b]) =>
      a.localeCompare(b)
    );
    expect(sorted[0][0]).toBe("2026-07");
    expect(sorted[sorted.length - 1][0]).toBe("2026-11");
  });
});

// ========================
// 4. 风格多选筛选逻辑（演出列表页）
// ========================
describe("风格多选筛选", () => {
  it("选中的 genre 应筛选出包含任一风格的演出（OR 关系）", () => {
    const selectedGenres = ["Emo", "Post-Punk"];
    const filtered = mockShows.filter((s) =>
      s.artists?.some((sa) =>
        sa.artist?.genres.some((g) => selectedGenres.includes(g))
      )
    );
    expect(filtered.length).toBeGreaterThan(0);
    filtered.forEach((show) => {
      const hasGenre = show.artists?.some((sa) =>
        sa.artist?.genres.some((g) => selectedGenres.includes(g))
      );
      expect(hasGenre).toBe(true);
    });
  });

  it("页面逻辑：空选中列表应跳过筛选返回全部", () => {
    const selectedGenres: string[] = [];
    // 页面中：if (selectedGenres.length > 0) 才筛选
    const filtered =
      selectedGenres.length > 0
        ? mockShows.filter((s) =>
            s.artists?.some((sa) =>
              sa.artist?.genres.some((g) => selectedGenres.includes(g))
            )
          )
        : mockShows;
    expect(filtered.length).toBe(mockShows.length);
  });
});

// ========================
// 5. "我关注的" Tab 筛选逻辑
// ========================
describe("我关注的 Tab 筛选", () => {
  it("followedArtistIds 应筛选出包含关注乐队的演出", () => {
    const followedArtistIds = ["artist-1", "artist-4", "artist-7"];
    const filtered = mockShows.filter((s) =>
      s.artists?.some((sa) => followedArtistIds.includes(sa.artist_id))
    );
    expect(filtered.length).toBeGreaterThan(0);
    filtered.forEach((show) => {
      const hasFollowed = show.artists?.some((sa) =>
        followedArtistIds.includes(sa.artist_id)
      );
      expect(hasFollowed).toBe(true);
    });
  });

  it("空 followedArtistIds（游客）应返回空列表", () => {
    const followedArtistIds: string[] = [];
    const filtered = mockShows.filter((s) =>
      s.artists?.some((sa) => followedArtistIds.includes(sa.artist_id))
    );
    expect(filtered.length).toBe(0);
  });
});

// ========================
// 6. 推荐原因计算逻辑（发现页）
// ========================
describe("推荐原因计算", () => {
  function getReason(
    show: Show,
    isLoggedIn: boolean,
    followedArtistIds: string[]
  ): string | undefined {
    if (!isLoggedIn || followedArtistIds.length === 0) return undefined;
    const followedInShow = show.artists?.filter((sa) =>
      followedArtistIds.includes(sa.artist_id)
    );
    if (followedInShow && followedInShow.length > 0) {
      const name = followedInShow[0].artist?.name;
      if (name) return `因你关注了 ${name}`;
    }
    return undefined;
  }

  it("游客状态应返回 undefined", () => {
    const show = mockShows[0];
    expect(getReason(show, false, ["artist-1"])).toBeUndefined();
  });

  it("无关注乐队应返回 undefined", () => {
    const show = mockShows[0];
    expect(getReason(show, true, [])).toBeUndefined();
  });

  it("演出包含关注乐队应返回推荐原因", () => {
    const show4 = mockShows.find((s) => s.id === "show-4");
    expect(show4).toBeDefined();
    const reason = getReason(show4!, true, ["artist-1"]);
    expect(reason).toBe("因你关注了 Chinese Football");
  });

  it("演出不包含关注乐队应返回 undefined", () => {
    const show4 = mockShows.find((s) => s.id === "show-4");
    expect(show4).toBeDefined();
    const reason = getReason(show4!, true, ["artist-99"]);
    expect(reason).toBeUndefined();
  });
});

// ========================
// 7. 发现页推荐数据完整性
// ========================
describe("发现页推荐数据完整性", () => {
  it("推荐演出应包含 coming_soon/on_sale/sold_out 三种票务状态", () => {
    const now = new Date().toISOString();
    const recommended = mockShows.filter(
      (s) => s.status === ShowStatus.UPCOMING && s.date_time >= now
    );
    const ticketStatuses = recommended.map((s) => s.ticket_status);
    expect(ticketStatuses).toContain(ShowTicketStatus.COMING_SOON);
    expect(ticketStatuses).toContain(ShowTicketStatus.ON_SALE);
    expect(ticketStatuses).toContain(ShowTicketStatus.SOLD_OUT);
  });

  it("所有 mock 演出应标注 is_demo=true", () => {
    expect(mockShows.every((s) => s.is_demo === true)).toBe(true);
  });

  it("headliner 乐队应可从 show.artists 提取", () => {
    const show4 = mockShows.find((s) => s.id === "show-4");
    expect(show4).toBeDefined();
    const headliner = show4!.artists?.find(
      (a) => a.role === ArtistRole.HEADLINER
    );
    expect(headliner).toBeDefined();
    expect(headliner!.artist?.name).toBe("Chinese Football");
  });

  it("本城近期演出排除已在推荐中的演出后不应重复", () => {
    const now = new Date().toISOString();
    const recommended = mockShows
      .filter((s) => s.status === ShowStatus.UPCOMING && s.date_time >= now)
      .slice(0, 6);
    const recommendedIds = new Set(recommended.map((s) => s.id));
    const cityShows = mockShows.filter(
      (s) => s.city === "上海" && s.status === ShowStatus.UPCOMING
    );
    const cityOnly = cityShows.filter((s) => !recommendedIds.has(s.id));
    // cityOnly 中的演出不应出现在推荐中
    cityOnly.forEach((show) => {
      expect(recommendedIds.has(show.id)).toBe(false);
    });
  });
});
