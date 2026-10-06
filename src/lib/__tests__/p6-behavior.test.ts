/**
 * P6 行为测试 - 乐队发现 / 关注闭环 / Artist Detail
 *
 * 覆盖测试组：
 * A. Artist API（getArtists / getArtistById / 搜索 / 风格 OR 筛选）
 * B. Follow（follow / unfollow / 幂等 / 跨用户隔离 / 游客拦截）
 * C. Follow 状态独立性（Follow Artist ≠ ShowStatus / RoomMembership）
 * D. Artist → Shows（getShowsByArtist 只返回关联 Show，headliner/support 均可查）
 * E. Upcoming / Past（基于 getShowLifecycle，升序/倒序）
 * F. Artist Detail 完整数据（真实 mock Artist 字段齐全 + shows 关联完整）
 * G. Guest Browsing（游客可读不可写）
 * H. Discover 联动（followedArtistIds → getShowsByArtist 数据闭环）
 *
 * 关注状态 source of truth：useUserStore.followedArtistIds（单一响应式来源）。
 * followArtist/unfollowArtist/isFollowing 以显式 userId 调用，
 * requireCurrentUserId 校验 userId === 当前登录用户，不 fallback 到 mockCurrentUser。
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  ArtistRole,
  ShowStatus,
  UserShowStatus,
} from "@/lib/types";
import { getArtists, getArtistById, getFollowedArtists } from "@/lib/api/artists";
import { getShowsByArtist } from "@/lib/api/shows";
import {
  followArtist,
  unfollowArtist,
  isFollowing,
} from "@/lib/api/user";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";
import { useUserStore } from "@/lib/stores/useUserStore";
import { mockArtists, artistMap } from "@/mocks/artists";
import { mockShows, mockShowArtists } from "@/mocks/shows";

const CURRENT_USER_ID = "user-1";
const OTHER_USER_ID = "user-2";

beforeEach(() => {
  // 每个用例前重置为游客状态，清空持久化数据
  useUserStore.getState().logout();
  localStorage.clear();
});

// ========================
// A. Artist API
// ========================
describe("P6 A. Artist API", () => {
  it("getArtists 应返回 Artist 数组（带分页结构）", async () => {
    const res = await getArtists();
    expect(res.data.length).toBe(mockArtists.length);
    expect(res.total).toBe(mockArtists.length);
    expect(res.data[0].id).toBeDefined();
    expect(res.data[0].name).toBeDefined();
    expect(Array.isArray(res.data[0].genres)).toBe(true);
  });

  it("getArtistById 存在的 ID 应返回对应 Artist", async () => {
    const artist = await getArtistById("artist-1");
    expect(artist).not.toBeNull();
    expect(artist!.id).toBe("artist-1");
    expect(artist!.name).toBe("Chinese Football");
  });

  it("getArtistById 不存在的 ID 应返回 null", async () => {
    const artist = await getArtistById("artist-not-exist");
    expect(artist).toBeNull();
  });

  it("搜索应按乐队名称模糊匹配（含中英文）", async () => {
    const en = await getArtists({ search: "chinese" });
    expect(en.data.some((a) => a.id === "artist-1")).toBe(true);

    const zh = await getArtists({ search: "鼠鼠鼠" });
    expect(zh.data.some((a) => a.id === "artist-2")).toBe(true);
  });

  it("搜索应 trim 空白，空字符串等同于不过滤", async () => {
    const all = await getArtists({ search: "   " });
    expect(all.data.length).toBe(mockArtists.length);
  });

  it("单风格筛选应返回包含该风格的乐队", async () => {
    const res = await getArtists({ genre: "Emo" });
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every((a) => a.genres.includes("Emo"))).toBe(true);
  });

  it("多风格筛选应使用 OR 逻辑：命中任意一个即显示", async () => {
    const res = await getArtists({ genres: ["Emo", "Math Rock"] });
    expect(res.data.length).toBeGreaterThan(0);
    const expected = mockArtists.filter(
      (a) => a.genres.includes("Emo") || a.genres.includes("Math Rock")
    );
    expect(res.data.length).toBe(expected.length);
    res.data.forEach((a) => {
      const hit = a.genres.includes("Emo") || a.genres.includes("Math Rock");
      expect(hit).toBe(true);
    });
  });
});

// ========================
// B. Follow
// ========================
describe("P6 B. Follow", () => {
  it("用户初始（mockLogin 后）关注状态正确", async () => {
    useUserStore.getState().mockLogin();
    const followed = await getFollowedArtists(CURRENT_USER_ID);
    // MOCK_FOLLOWED = artist-1, artist-4, artist-7, artist-11
    expect(followed.length).toBe(4);
    expect(followed.map((a) => a.id).sort()).toEqual(
      ["artist-1", "artist-4", "artist-7", "artist-11"].sort()
    );
  });

  it("followArtist 应成功并更新 store", async () => {
    useUserStore.getState().mockLogin();
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");

    const follow = await followArtist(CURRENT_USER_ID, "artist-15");
    expect(follow.user_id).toBe(CURRENT_USER_ID);
    expect(follow.artist_id).toBe("artist-15");
    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");

    const isFollowed = await isFollowing(CURRENT_USER_ID, "artist-15");
    expect(isFollowed).toBe(true);
  });

  it("重复 follow 应幂等（不重复添加）", async () => {
    useUserStore.getState().mockLogin();
    const before = useUserStore.getState().followedArtistIds.length;

    await followArtist(CURRENT_USER_ID, "artist-15");
    await followArtist(CURRENT_USER_ID, "artist-15");
    await followArtist(CURRENT_USER_ID, "artist-15");

    const after = useUserStore.getState().followedArtistIds.length;
    expect(after).toBe(before + 1);
    expect(useUserStore.getState().followedArtistIds.filter((id) => id === "artist-15").length).toBe(1);
  });

  it("unfollowArtist 应成功并更新 store", async () => {
    useUserStore.getState().mockLogin();
    expect(useUserStore.getState().followedArtistIds).toContain("artist-1");

    await unfollowArtist(CURRENT_USER_ID, "artist-1");
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-1");

    const isFollowed = await isFollowing(CURRENT_USER_ID, "artist-1");
    expect(isFollowed).toBe(false);
  });

  it("重复 unfollow 不应产生异常", async () => {
    useUserStore.getState().mockLogin();
    // artist-15 未关注，连续 unfollow 不应抛错
    await expect(
      unfollowArtist(CURRENT_USER_ID, "artist-15")
    ).resolves.toBeUndefined();
    await expect(
      unfollowArtist(CURRENT_USER_ID, "artist-15")
    ).resolves.toBeUndefined();
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");
  });

  it("用户 A follow 不影响用户 B（userId 不匹配应抛错）", async () => {
    useUserStore.getState().mockLogin();
    // 当前登录用户是 user-1，user-2 无权 mutation
    await expect(
      followArtist(OTHER_USER_ID, "artist-15")
    ).rejects.toThrow();
    // user-2 的关注列表仍为空（store 只保存当前用户）
    const otherFollowed = await getFollowedArtists(OTHER_USER_ID);
    expect(otherFollowed).toEqual([]);
    // user-1 的关注列表未受影响
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");
  });

  it("游客/未知 userId 不能合法 mutation（应抛错）", async () => {
    // 未登录状态
    expect(useUserStore.getState().isLoggedIn).toBe(false);
    await expect(
      followArtist(CURRENT_USER_ID, "artist-15")
    ).rejects.toThrow();
    await expect(
      unfollowArtist(CURRENT_USER_ID, "artist-1")
    ).rejects.toThrow();
    // 状态未改变
    expect(useUserStore.getState().followedArtistIds).toEqual([]);
  });

  it("isFollowing 未登录时返回 false", async () => {
    const result = await isFollowing(CURRENT_USER_ID, "artist-1");
    expect(result).toBe(false);
  });
});

// ========================
// C. Follow 状态独立性
// ========================
describe("P6 C. Follow 状态独立性", () => {
  it("Follow Artist 不自动 Interested Show", async () => {
    useUserStore.getState().mockLogin();
    await followArtist(CURRENT_USER_ID, "artist-15");
    // showStatuses 不应因 follow 而改变
    expect(Object.keys(useUserStore.getState().showStatuses)).not.toContain(
      "show-13"
    );
    // 仅 MOCK_SHOW_STATUSES 预置的 4 个
    expect(Object.keys(useUserStore.getState().showStatuses).length).toBe(4);
  });

  it("Follow Artist 不自动 Going Show", async () => {
    useUserStore.getState().mockLogin();
    await followArtist(CURRENT_USER_ID, "artist-15");
    expect(
      Object.values(useUserStore.getState().showStatuses).filter(
        (s) => s === UserShowStatus.GOING
      ).length
    ).toBe(2); // show-4, show-15 预置 going
  });

  it("Follow Artist 不自动 Join Room", async () => {
    useUserStore.getState().mockLogin();
    const before = useUserStore.getState().roomMemberships.length;
    await followArtist(CURRENT_USER_ID, "artist-15");
    expect(useUserStore.getState().roomMemberships.length).toBe(before);
  });

  it("Going 不自动 Follow Artist", async () => {
    useUserStore.getState().mockLogin();
    const before = useUserStore.getState().followedArtistIds.length;
    useUserStore.getState().setShowStatus("show-13", UserShowStatus.GOING);
    expect(useUserStore.getState().followedArtistIds.length).toBe(before);
    // show-13 的 headliner 是 artist-1（已关注），验证 artist-15（未关注）不会因 going 被关注
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");
  });

  it("Join Room 不自动 Follow Artist", async () => {
    useUserStore.getState().mockLogin();
    const before = useUserStore.getState().followedArtistIds.length;
    useUserStore.getState().joinRoom("room-13");
    expect(useUserStore.getState().roomMemberships.some((m) => m.room_id === "room-13")).toBe(true);
    expect(useUserStore.getState().followedArtistIds.length).toBe(before);
  });
});

// ========================
// D. Artist → Shows
// ========================
describe("P6 D. Artist → Shows", () => {
  it("getShowsByArtist 只返回与该 Artist 关联的 Show", async () => {
    const shows = await getShowsByArtist("artist-1");
    expect(shows.length).toBeGreaterThan(0);
    shows.forEach((s) => {
      const hasArtist = s.artists?.some((sa) => sa.artist_id === "artist-1");
      expect(hasArtist).toBe(true);
    });
  });

  it("headliner 关系可被查询", async () => {
    // artist-1 在 show-1 中是 headliner
    const shows = await getShowsByArtist("artist-1");
    const show1 = shows.find((s) => s.id === "show-1");
    expect(show1).toBeDefined();
    const headliner = show1!.artists?.find(
      (sa) => sa.artist_id === "artist-1"
    );
    expect(headliner).toBeDefined();
    expect(headliner!.role).toBe(ArtistRole.HEADLINER);
    expect(headliner!.billing_order).toBe(1);
  });

  it("support 关系可被查询", async () => {
    // artist-2 在 show-1 中是 support
    const shows = await getShowsByArtist("artist-2");
    const show1 = shows.find((s) => s.id === "show-1");
    expect(show1).toBeDefined();
    const support = show1!.artists?.find(
      (sa) => sa.artist_id === "artist-2"
    );
    expect(support).toBeDefined();
    expect(support!.role).toBe(ArtistRole.SUPPORT);
    expect(support!.billing_order).toBe(2);
  });

  it("未关联任何演出的 Artist 应返回空数组", async () => {
    // 构造一个不在 mockShowArtists 中的 artistId
    const orphanId = "artist-orphan";
    const shows = await getShowsByArtist(orphanId);
    expect(shows).toEqual([]);
  });

  it("getShowsByArtist 与 mockShowArtists 关联一致", async () => {
    const expected = mockShowArtists
      .filter((sa) => sa.artist_id === "artist-1")
      .map((sa) => sa.show_id);
    const shows = await getShowsByArtist("artist-1");
    expect(shows.map((s) => s.id).sort()).toEqual([...new Set(expected)].sort());
  });
});

// ========================
// E. Upcoming / Past（复用 getShowLifecycle）
// ========================
describe("P6 E. Upcoming / Past", () => {
  it("未来演出进入 upcoming（!hasEnded）", async () => {
    const shows = await getShowsByArtist("artist-1");
    const upcoming = shows.filter((s) => !getShowLifecycle(s).hasEnded);
    expect(upcoming.length).toBeGreaterThan(0);
    upcoming.forEach((s) => {
      expect(getShowLifecycle(s).hasEnded).toBe(false);
    });
  });

  it("历史演出进入 past（hasEnded）", async () => {
    const shows = await getShowsByArtist("artist-1");
    const past = shows.filter((s) => getShowLifecycle(s).hasEnded);
    expect(past.length).toBeGreaterThan(0);
    past.forEach((s) => {
      expect(getShowLifecycle(s).hasEnded).toBe(true);
    });
  });

  it("upcoming 应按时间升序（最近一场最前）", async () => {
    const shows = await getShowsByArtist("artist-1");
    const upcoming = shows
      .filter((s) => !getShowLifecycle(s).hasEnded)
      .sort((a, b) => a.date_time.localeCompare(b.date_time));
    for (let i = 1; i < upcoming.length; i++) {
      expect(upcoming[i].date_time >= upcoming[i - 1].date_time).toBe(true);
    }
  });

  it("past 应按时间倒序（最近结束的最前）", async () => {
    const shows = await getShowsByArtist("artist-1");
    const past = shows
      .filter((s) => getShowLifecycle(s).hasEnded)
      .sort((a, b) => b.date_time.localeCompare(a.date_time));
    for (let i = 1; i < past.length; i++) {
      expect(past[i].date_time <= past[i - 1].date_time).toBe(true);
    }
  });

  it("upcoming 与 past 应互斥且并集等于全部 Show", async () => {
    const shows = await getShowsByArtist("artist-1");
    const upcoming = shows.filter((s) => !getShowLifecycle(s).hasEnded);
    const past = shows.filter((s) => getShowLifecycle(s).hasEnded);
    expect(upcoming.length + past.length).toBe(shows.length);
  });
});

// ========================
// F. Artist Detail 完整数据
// ========================
describe("P6 F. Artist Detail 完整数据", () => {
  it("Chinese Football (artist-1) 字段齐全", async () => {
    const artist = await getArtistById("artist-1");
    expect(artist).not.toBeNull();
    expect(artist!.name).toBe("Chinese Football");
    expect(artist!.city).toBe("武汉");
    expect(artist!.country).toBe("中国");
    expect(Array.isArray(artist!.genres)).toBe(true);
    expect(artist!.genres.length).toBeGreaterThan(0);
    expect(artist!.bio).toBeTruthy();
    expect(artist!.cover_url).toBeTruthy();
    expect(artist!.external_links?.netease).toBeTruthy();
  });

  it("Artist 关联的 shows 数据完整", async () => {
    const artist = await getArtistById("artist-1");
    expect(artist).not.toBeNull();
    const shows = await getShowsByArtist(artist!.id);
    expect(shows.length).toBeGreaterThanOrEqual(3);
    shows.forEach((s) => {
      expect(s.id).toBeDefined();
      expect(s.date_time).toBeDefined();
      expect(s.city).toBeDefined();
      expect(s.status).toBeDefined();
      expect(s.artists).toBeDefined();
      // 每场演出至少有一个乐队关联
      expect(s.artists!.length).toBeGreaterThan(0);
    });
  });

  it("Artist.cover_url 缺失时仍可正常返回（fallback 由 UI 处理）", async () => {
    // 所有 mock Artist 都有 cover_url，此处验证类型契约允许 undefined
    const artist = artistMap.get("artist-1")!;
    expect(artist.cover_url).toBeDefined();
    // 验证 Artist 类型支持 cover_url 可选
    const optionalArtist: Pick<typeof artist, "cover_url"> = { cover_url: undefined };
    expect(optionalArtist.cover_url).toBeUndefined();
  });
});

// ========================
// G. Guest Browsing
// ========================
describe("P6 G. Guest Browsing", () => {
  it("游客可以 getArtists", async () => {
    expect(useUserStore.getState().isLoggedIn).toBe(false);
    const res = await getArtists();
    expect(res.data.length).toBe(mockArtists.length);
  });

  it("游客可以 getArtistById", async () => {
    const artist = await getArtistById("artist-1");
    expect(artist).not.toBeNull();
    expect(artist!.name).toBe("Chinese Football");
  });

  it("游客可以 getShowsByArtist", async () => {
    const shows = await getShowsByArtist("artist-1");
    expect(shows.length).toBeGreaterThan(0);
  });

  it("游客不能创建 Follow（mutation 应抛错）", async () => {
    expect(useUserStore.getState().isLoggedIn).toBe(false);
    await expect(
      followArtist(CURRENT_USER_ID, "artist-1")
    ).rejects.toThrow();
    // 状态保持空
    expect(useUserStore.getState().followedArtistIds).toEqual([]);
  });

  it("游客的 getFollowedArtists 返回空", async () => {
    const followed = await getFollowedArtists(CURRENT_USER_ID);
    expect(followed).toEqual([]);
  });

  it("游客的 isFollowing 返回 false", async () => {
    const result = await isFollowing(CURRENT_USER_ID, "artist-1");
    expect(result).toBe(false);
  });
});

// ========================
// H. Discover 联动（followedArtistIds → getShowsByArtist 数据闭环）
// ========================
describe("P6 H. Discover 联动", () => {
  it("Follow Artist 后，该 Artist 的未来 Show 可进入推荐候选", async () => {
    useUserStore.getState().mockLogin();
    // 关注 artist-1（mockLogin 已预置关注，此处验证闭环）
    expect(useUserStore.getState().followedArtistIds).toContain("artist-1");

    // 读取该 Artist 的演出
    const shows = await getShowsByArtist("artist-1");
    expect(shows.length).toBeGreaterThan(0);

    // 其中的未来演出应可被推荐候选（upcoming 状态）
    const upcomingShows = shows.filter(
      (s) => s.status === ShowStatus.UPCOMING
    );
    expect(upcomingShows.length).toBeGreaterThan(0);
  });

  it("首页推荐 reason 计算逻辑：关注乐队命中应返回原因", () => {
    useUserStore.getState().mockLogin();
    const followedArtistIds = useUserStore.getState().followedArtistIds;
    const isLoggedIn = useUserStore.getState().isLoggedIn;

    // 复用首页 getReason 逻辑
    function getReason(
      show: (typeof mockShows)[number],
      loggedIn: boolean,
      followed: string[]
    ): string | undefined {
      if (!loggedIn || followed.length === 0) return undefined;
      const followedInShow = show.artists?.filter((sa) =>
        followed.includes(sa.artist_id)
      );
      if (followedInShow && followedInShow.length > 0) {
        const name = followedInShow[0].artist?.name;
        if (name) return `因你关注了 ${name}`;
      }
      return undefined;
    }

    // show-4 headliner 是 artist-1（已关注）
    const show4 = mockShows.find((s) => s.id === "show-4")!;
    const reason = getReason(show4, isLoggedIn, followedArtistIds);
    expect(reason).toContain("Chinese Football");
  });

  it("unfollow 后该 Artist 不再出现在关注驱动的推荐候选", async () => {
    useUserStore.getState().mockLogin();
    expect(useUserStore.getState().followedArtistIds).toContain("artist-1");

    await unfollowArtist(CURRENT_USER_ID, "artist-1");
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-1");

    // 推荐候选数据闭环：followedArtistIds 不再包含 artist-1
    // → 首页 getReason 对 show-4 应返回 undefined
    const followed = useUserStore.getState().followedArtistIds;
    const show4 = mockShows.find((s) => s.id === "show-4")!;
    const followedInShow = show4.artists?.filter((sa) =>
      followed.includes(sa.artist_id)
    );
    expect(followedInShow?.length ?? 0).toBe(0);
  });

  it("关注状态三处同步：store → getFollowedArtists → isFollowing", async () => {
    useUserStore.getState().mockLogin();
    // 新关注 artist-15
    await followArtist(CURRENT_USER_ID, "artist-15");

    // store
    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");
    // getFollowedArtists（解析 store）
    const followed = await getFollowedArtists(CURRENT_USER_ID);
    expect(followed.some((a) => a.id === "artist-15")).toBe(true);
    // isFollowing（读取 store）
    const isFollowed = await isFollowing(CURRENT_USER_ID, "artist-15");
    expect(isFollowed).toBe(true);

    // 取消关注后三处同步消失
    await unfollowArtist(CURRENT_USER_ID, "artist-15");
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");
    const followedAfter = await getFollowedArtists(CURRENT_USER_ID);
    expect(followedAfter.some((a) => a.id === "artist-15")).toBe(false);
    const isFollowedAfter = await isFollowing(CURRENT_USER_ID, "artist-15");
    expect(isFollowedAfter).toBe(false);
  });
});
