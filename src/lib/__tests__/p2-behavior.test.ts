/**
 * P2 行为测试 - 关键数据逻辑验证
 * 不验证类型编译（typecheck 已做），只验证实际运行时逻辑
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ShowStatus, ShowTicketStatus, TicketPostType, TicketPostStatus, UserShowStatus, ArtistRole } from "@/lib/types";
import { getShows, getShowsByArtist, getRecommendedShows } from "@/lib/api/shows";
import { getTicketPosts } from "@/lib/api/posts/ticketPosts";
import { mockShows, mockShowArtists } from "@/mocks/shows";
import { mockTicketPosts } from "@/mocks/ticketPosts";
import { useUserStore } from "@/lib/stores/useUserStore";

// 固定"当前时间"：mock 演出锚定在 2026 年 8-11 月（如 show-12 = 2026-09-20）。
// 仅替换全局 Date 时钟（不用 vi.useFakeTimers，避免影响 Promise/timer 行为），
// 使推荐/生命周期相关断言不随真实日期滚动而失效。
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

// ========================
// 1. 演出城市筛选
// ========================
describe("演出城市筛选", () => {
  it("按上海筛选应返回所有上海演出", async () => {
    const result = await getShows({ city: "上海" });
    const shanghaiShows = mockShows.filter((s) => s.city === "上海");
    expect(result.data.length).toBe(shanghaiShows.length);
    expect(result.data.every((s) => s.city === "上海")).toBe(true);
  });

  it("按北京筛选应返回所有北京演出", async () => {
    const result = await getShows({ city: "北京" });
    const beijingShows = mockShows.filter((s) => s.city === "北京");
    expect(result.data.length).toBe(beijingShows.length);
    expect(result.data.every((s) => s.city === "北京")).toBe(true);
  });

  it("不传筛选应返回全部演出", async () => {
    const result = await getShows();
    expect(result.data.length).toBe(mockShows.length);
    expect(result.total).toBe(mockShows.length);
  });
});

// ========================
// 2. ShowArtist 乐队演出关联
// ========================
describe("ShowArtist 乐队演出关联", () => {
  it("Chinese Football (artist-1) 应关联多场演出", async () => {
    const shows = await getShowsByArtist("artist-1");
    expect(shows.length).toBeGreaterThanOrEqual(3);
    expect(shows.every((s) => s.artists?.some((sa) => sa.artist_id === "artist-1"))).toBe(true);
  });

  it("每场演出的 artists 数组应包含正确的 ShowArtist 关联", () => {
    const show4 = mockShows.find((s) => s.id === "show-4");
    expect(show4).toBeDefined();
    expect(show4!.artists).toBeDefined();
    expect(show4!.artists!.length).toBe(2);

    const headliner = show4!.artists!.find((sa) => sa.role === ArtistRole.HEADLINER || sa.billing_order === 1);
    expect(headliner).toBeDefined();
    expect(headliner!.artist_id).toBe("artist-1"); // Chinese Football
  });

  it("mockShowArtists 的 show_id 应与对应演出匹配", () => {
    const show1Artists = mockShowArtists.filter((sa) => sa.show_id === "show-1");
    expect(show1Artists.length).toBe(2); // CF + 鼠鼠鼠
    expect(show1Artists.some((sa) => sa.artist_id === "artist-1")).toBe(true);
    expect(show1Artists.some((sa) => sa.artist_id === "artist-2")).toBe(true);
  });
});

// ========================
// 3. 演出状态模型验证（双维度独立）
// ========================
describe("演出状态模型", () => {
  it("ShowStatus 和 ShowTicketStatus 应是独立维度", () => {
    // 已结束演出：status=ended, ticket_status=sold_out
    const endedShow = mockShows.find((s) => s.status === ShowStatus.ENDED);
    expect(endedShow).toBeDefined();
    expect(endedShow!.ticket_status).toBe(ShowTicketStatus.SOLD_OUT);

    // 即将到来的在售演出：status=upcoming, ticket_status=on_sale
    const upcomingOnSale = mockShows.find(
      (s) => s.status === ShowStatus.UPCOMING && s.ticket_status === ShowTicketStatus.ON_SALE
    );
    expect(upcomingOnSale).toBeDefined();

    // 即将到来的售罄演出：status=upcoming, ticket_status=sold_out
    const upcomingSoldOut = mockShows.find(
      (s) => s.status === ShowStatus.UPCOMING && s.ticket_status === ShowTicketStatus.SOLD_OUT
    );
    expect(upcomingSoldOut).toBeDefined();

    // 即将到来的未开票演出：status=upcoming, ticket_status=coming_soon
    const upcomingComingSoon = mockShows.find(
      (s) => s.status === ShowStatus.UPCOMING && s.ticket_status === ShowTicketStatus.COMING_SOON
    );
    expect(upcomingComingSoon).toBeDefined();
  });

  it("延期演出 status 应为 postponed，不应有 ticket_status", () => {
    const postponed = mockShows.find((s) => s.status === ShowStatus.POSTPONED);
    expect(postponed).toBeDefined();
    expect(postponed!.ticket_status).toBeUndefined();
  });

  it("所有 mock 演出应标注 is_demo=true", () => {
    expect(mockShows.every((s) => s.is_demo === true)).toBe(true);
  });
});

// ========================
// 4. 推荐演出逻辑
// ========================
describe("推荐演出逻辑", () => {
  it("推荐演出应全部是 upcoming（售票状态不决定推荐资格）", async () => {
    const recommended = await getRecommendedShows();
    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended.every((s) => s.status === ShowStatus.UPCOMING)).toBe(true);
  });

  it("coming_soon / on_sale / sold_out 三种 upcoming 演出均应可被推荐", async () => {
    const recommended = await getRecommendedShows();
    const ticketStatuses = recommended.map((s) => s.ticket_status);

    expect(ticketStatuses).toContain(ShowTicketStatus.COMING_SOON);
    expect(ticketStatuses).toContain(ShowTicketStatus.ON_SALE);
    expect(ticketStatuses).toContain(ShowTicketStatus.SOLD_OUT);
  });

  it("按城市筛选推荐演出", async () => {
    const recommended = await getRecommendedShows("上海");
    expect(recommended.every((s) => s.city === "上海")).toBe(true);
  });
});

// ========================
// 5. 出收票帖类型筛选
// ========================
describe("出收票帖类型筛选", () => {
  it("筛选 selling 类型应只返回出票帖", async () => {
    const posts = await getTicketPosts("show-4", TicketPostType.SELLING);
    expect(posts.every((p) => p.type === TicketPostType.SELLING)).toBe(true);
  });

  it("筛选 buying 类型应只返回收票帖", async () => {
    const posts = await getTicketPosts("show-5", TicketPostType.BUYING);
    expect(posts.every((p) => p.type === TicketPostType.BUYING)).toBe(true);
  });

  it("不传类型应返回该演出的所有票帖", async () => {
    const allPosts = mockTicketPosts.filter((p) => p.show_id === "show-4");
    const posts = await getTicketPosts("show-4");
    expect(posts.length).toBe(allPosts.length);
  });

  it("active 帖子应排在 completed 之前", async () => {
    const posts = await getTicketPosts("show-1");
    const activeIndex = posts.findIndex((p) => p.status === TicketPostStatus.ACTIVE);
    const completedIndex = posts.findIndex((p) => p.status === TicketPostStatus.COMPLETED);
    if (activeIndex !== -1 && completedIndex !== -1) {
      expect(activeIndex).toBeLessThan(completedIndex);
    }
  });
});

// ========================
// 6. Zustand Store 行为测试（follow/unfollow/status/room）
// ========================
describe("Zustand Store 行为", () => {
  beforeEach(() => {
    // 每次测试前重置为游客状态
    useUserStore.getState().logout();
    localStorage.clear();
  });

  it("默认应为游客状态（user=null）", () => {
    const state = useUserStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoggedIn).toBe(false);
    expect(state.followedArtistIds).toEqual([]);
  });

  it("mockLogin 应设置 mock 用户和预置数据", () => {
    useUserStore.getState().mockLogin();
    const state = useUserStore.getState();
    expect(state.user).not.toBeNull();
    expect(state.isLoggedIn).toBe(true);
    expect(state.followedArtistIds.length).toBe(4);
    expect(state.followedArtistIds).toContain("artist-1");
  });

  it("followArtist / unfollowArtist 应正确增减关注列表", () => {
    useUserStore.getState().mockLogin();
    const initialCount = useUserStore.getState().followedArtistIds.length;

    // 关注一个新乐队
    useUserStore.getState().followArtist("artist-15");
    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");
    expect(useUserStore.getState().followedArtistIds.length).toBe(initialCount + 1);

    // 重复关注不应重复添加
    useUserStore.getState().followArtist("artist-15");
    expect(useUserStore.getState().followedArtistIds.length).toBe(initialCount + 1);

    // 取消关注
    useUserStore.getState().unfollowArtist("artist-15");
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");
    expect(useUserStore.getState().followedArtistIds.length).toBe(initialCount);
  });

  it("setShowStatus 应支持 interested → going 切换", () => {
    useUserStore.getState().mockLogin();

    // show-7 初始状态是 interested
    expect(useUserStore.getState().showStatuses["show-7"]).toBe(UserShowStatus.INTERESTED);

    // 切换为 going
    useUserStore.getState().setShowStatus("show-7", UserShowStatus.GOING);
    expect(useUserStore.getState().showStatuses["show-7"]).toBe(UserShowStatus.GOING);

    // 切换为 attended
    useUserStore.getState().setShowStatus("show-7", UserShowStatus.ATTENDED);
    expect(useUserStore.getState().showStatuses["show-7"]).toBe(UserShowStatus.ATTENDED);
  });

  it("joinRoom / leaveRoom 应正确管理房间成员", () => {
    useUserStore.getState().mockLogin();
    const initialCount = useUserStore.getState().roomMemberships.length;

    // 加入新房间
    useUserStore.getState().joinRoom("room-10");
    expect(useUserStore.getState().roomMemberships.some((m) => m.room_id === "room-10")).toBe(true);
    expect(useUserStore.getState().roomMemberships.length).toBe(initialCount + 1);

    // 重复加入不应重复添加
    useUserStore.getState().joinRoom("room-10");
    expect(useUserStore.getState().roomMemberships.length).toBe(initialCount + 1);

    // 退出房间
    useUserStore.getState().leaveRoom("room-10");
    expect(useUserStore.getState().roomMemberships.some((m) => m.room_id === "room-10")).toBe(false);
    expect(useUserStore.getState().roomMemberships.length).toBe(initialCount);
  });

  it("logout 应清空所有用户数据回到游客状态", () => {
    useUserStore.getState().mockLogin();
    expect(useUserStore.getState().isLoggedIn).toBe(true);

    useUserStore.getState().logout();
    const state = useUserStore.getState();
    expect(state.user).toBeNull();
    expect(state.isLoggedIn).toBe(false);
    expect(state.followedArtistIds).toEqual([]);
    expect(state.showStatuses).toEqual({});
    expect(state.roomMemberships).toEqual([]);
  });
});
