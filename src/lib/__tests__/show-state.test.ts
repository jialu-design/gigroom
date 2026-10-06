/**
 * 核心状态收敛回归测试 — utils/showState（全站唯一状态真相）
 *
 * 覆盖：
 * A. getShowBucket 四态严格互斥（含 status 滞后日期已过 → ended 归一；当天算 upcoming）
 * B. getEffectiveShowState 门禁/标签/Room 状态
 * C. classifyShows 分组与排序
 * D. deriveMyShows：interested/going 仅 upcoming；attended 永久保留
 * E. deriveMemberRooms：严格 membership 驱动，未加入不出现，当前/过往分组与排序
 *
 * 时钟：FixedDate 模式（仅替换全局 Date，不用 vi.useFakeTimers，避免 Promise/timer 级联失败）
 * 固定现在时间：2026-09-28 12:00 Asia/Shanghai（演出当天 = upcoming/ACTIVE）
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  ShowStatus,
  UserShowStatus,
  ArtistRole,
  RoomStatus,
} from "@/lib/types";
import type { Show, ShowRoom } from "@/lib/types";
import {
  getShowBucket,
  getEffectiveShowState,
  classifyShows,
  deriveMyShows,
  deriveMemberRooms,
} from "@/lib/utils/showState";

const RealDate = Date;
const FIXED_NOW = new RealDate("2026-09-28T12:00:00+08:00").getTime();
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

// ============================================================
// 工厂
// ============================================================

function makeShow(
  id: string,
  status: ShowStatus,
  dateTime: string,
  overrides: Partial<Show> = {}
): Show {
  return {
    id,
    venue_id: `venue-${id}`,
    city: "北京",
    date_time: dateTime,
    status,
    created_at: "2026-01-01T00:00:00+08:00",
    ...overrides,
  };
}

function makeRoom(
  id: string,
  showId: string,
  counts: Partial<{
    message_count: number;
    buddy_post_count: number;
    ticket_post_count: number;
    live_post_count: number;
    member_count: number;
  }> = {}
): ShowRoom {
  return {
    id,
    show_id: showId,
    created_at: "2026-06-01T00:00:00+08:00",
    ...counts,
  } as ShowRoom;
}

const FUTURE = "2026-10-12T20:00:00+08:00";
const TODAY_EVENING = "2026-09-28T20:00:00+08:00";
const YESTERDAY = "2026-09-27T20:00:00+08:00";
const THREE_DAYS_AGO = "2026-09-25T20:00:00+08:00";
const TEN_DAYS_AGO = "2026-09-18T20:00:00+08:00";

// ============================================================
// A. getShowBucket — 四态严格互斥
// ============================================================

describe("getShowBucket 四态互斥", () => {
  it("UPCOMING 且日期未到 → upcoming", () => {
    expect(getShowBucket(makeShow("s1", ShowStatus.UPCOMING, FUTURE))).toBe(
      "upcoming"
    );
  });

  it("UPCOMING 演出当天（未到散场时间）仍 → upcoming", () => {
    expect(
      getShowBucket(makeShow("s2", ShowStatus.UPCOMING, TODAY_EVENING))
    ).toBe("upcoming");
  });

  it("status 滞后：UPCOMING 但日期已过 → ended（禁止矛盾展示）", () => {
    expect(
      getShowBucket(makeShow("s3", ShowStatus.UPCOMING, YESTERDAY))
    ).toBe("ended");
  });

  it("status=ENDED → ended", () => {
    expect(getShowBucket(makeShow("s4", ShowStatus.ENDED, TEN_DAYS_AGO))).toBe(
      "ended"
    );
  });

  it("CANCELLED 不看日期，未来/过去都 → cancelled", () => {
    expect(
      getShowBucket(makeShow("s5", ShowStatus.CANCELLED, FUTURE))
    ).toBe("cancelled");
    expect(
      getShowBucket(makeShow("s6", ShowStatus.CANCELLED, YESTERDAY))
    ).toBe("cancelled");
  });

  it("POSTPONED 不看日期，未来/过去都 → postponed", () => {
    expect(
      getShowBucket(makeShow("s7", ShowStatus.POSTPONED, FUTURE))
    ).toBe("postponed");
    expect(
      getShowBucket(makeShow("s8", ShowStatus.POSTPONED, YESTERDAY))
    ).toBe("postponed");
  });
});

// ============================================================
// B. getEffectiveShowState — 归一标签 / 门禁 / Room 状态
// ============================================================

describe("getEffectiveShowState 统一状态", () => {
  it("未来 upcoming：展示票务 badge、可加入、Room UPCOMING、不可发现场", () => {
    const state = getEffectiveShowState(
      makeShow("s1", ShowStatus.UPCOMING, FUTURE)
    );
    expect(state.bucket).toBe("upcoming");
    expect(state.effectiveStatus).toBe(ShowStatus.UPCOMING);
    expect(state.isInactive).toBe(false);
    expect(state.showTicketBadge).toBe(true);
    expect(state.canJoinRoom).toBe(true);
    expect(state.roomStatus).toBe(RoomStatus.UPCOMING);
    expect(state.canPostLive).toBe(false);
    expect(state.canPostBuddyTicket).toBe(true);
    expect(state.canDiscuss).toBe(true);
  });

  it("演出当天：Room ACTIVE，现场/搭子/票务/讨论全部可发", () => {
    const state = getEffectiveShowState(
      makeShow("s2", ShowStatus.UPCOMING, TODAY_EVENING)
    );
    expect(state.roomStatus).toBe(RoomStatus.ACTIVE);
    expect(state.canJoinRoom).toBe(true);
    expect(state.canPostLive).toBe(true);
    expect(state.canPostBuddyTicket).toBe(true);
    expect(state.canDiscuss).toBe(true);
  });

  it("滞后结束：归一 ENDED，无票务 badge、不可加入、搭子/票务关闭，Room ENDED", () => {
    const state = getEffectiveShowState(
      makeShow("s3", ShowStatus.UPCOMING, YESTERDAY)
    );
    expect(state.effectiveStatus).toBe(ShowStatus.ENDED);
    expect(state.bucket).toBe("ended");
    expect(state.isInactive).toBe(true);
    expect(state.showTicketBadge).toBe(false);
    expect(state.canJoinRoom).toBe(false);
    expect(state.canPostBuddyTicket).toBe(false);
    expect(state.roomStatus).toBe(RoomStatus.ENDED);
  });

  it("结束 3 天内：讨论仍可发言（7 天宽限）；结束 10 天后：讨论只读", () => {
    expect(
      getEffectiveShowState(makeShow("s4a", ShowStatus.ENDED, THREE_DAYS_AGO))
        .canDiscuss
    ).toBe(true);
    expect(
      getEffectiveShowState(makeShow("s4b", ShowStatus.ENDED, TEN_DAYS_AGO))
        .canDiscuss
    ).toBe(false);
  });

  it("CANCELLED：灰度、Room ARCHIVED、一切新增互动关闭", () => {
    const state = getEffectiveShowState(
      makeShow("s5", ShowStatus.CANCELLED, FUTURE)
    );
    expect(state.isInactive).toBe(true);
    expect(state.canJoinRoom).toBe(false);
    expect(state.canPostLive).toBe(false);
    expect(state.canPostBuddyTicket).toBe(false);
    expect(state.canDiscuss).toBe(false);
    expect(state.roomStatus).toBe(RoomStatus.ARCHIVED);
  });

  it("POSTPONED：不灰度但 Room ARCHIVED、新增互动全关", () => {
    const state = getEffectiveShowState(
      makeShow("s7", ShowStatus.POSTPONED, FUTURE)
    );
    expect(state.isInactive).toBe(false);
    expect(state.canJoinRoom).toBe(false);
    expect(state.canPostLive).toBe(false);
    expect(state.canPostBuddyTicket).toBe(false);
    expect(state.canDiscuss).toBe(false);
    expect(state.roomStatus).toBe(RoomStatus.ARCHIVED);
  });
});

// ============================================================
// C. classifyShows — 互斥分组 + 排序
// ============================================================

describe("classifyShows 分组", () => {
  it("每场演出恰好进入一个分组（总数守恒，严格互斥）", () => {
    const shows = [
      makeShow("u1", ShowStatus.UPCOMING, "2026-10-01T20:00:00+08:00"),
      makeShow("u2", ShowStatus.UPCOMING, "2026-11-01T20:00:00+08:00"),
      makeShow("lag", ShowStatus.UPCOMING, YESTERDAY),
      makeShow("e1", ShowStatus.ENDED, "2026-08-01T20:00:00+08:00"),
      makeShow("p1", ShowStatus.POSTPONED, FUTURE),
      makeShow("c1", ShowStatus.CANCELLED, YESTERDAY),
    ];
    const c = classifyShows(shows);
    const total =
      c.upcoming.length +
      c.ended.length +
      c.postponed.length +
      c.cancelled.length;
    expect(total).toBe(shows.length);
    expect(c.upcoming.map((s) => s.id)).toEqual(["u1", "u2"]);
    expect(c.ended.map((s) => s.id).sort()).toEqual(["e1", "lag"]);
    expect(c.postponed.map((s) => s.id)).toEqual(["p1"]);
    expect(c.cancelled.map((s) => s.id)).toEqual(["c1"]);
  });

  it("upcoming 日期升序；ended/postponed/cancelled 日期倒序", () => {
    const c = classifyShows([
      makeShow("u-late", ShowStatus.UPCOMING, "2026-12-01T20:00:00+08:00"),
      makeShow("u-early", ShowStatus.UPCOMING, "2026-10-01T20:00:00+08:00"),
      makeShow("e-old", ShowStatus.ENDED, "2026-07-01T20:00:00+08:00"),
      makeShow("e-new", ShowStatus.ENDED, "2026-09-01T20:00:00+08:00"),
    ]);
    expect(c.upcoming.map((s) => s.id)).toEqual(["u-early", "u-late"]);
    expect(c.ended.map((s) => s.id)).toEqual(["e-new", "e-old"]);
  });
});

// ============================================================
// D. deriveMyShows — 用户-演出关系
// ============================================================

describe("deriveMyShows 我的演出", () => {
  const shows = [
    makeShow("going-future", ShowStatus.UPCOMING, FUTURE),
    makeShow("interested-future", ShowStatus.UPCOMING, "2026-10-20T20:00:00+08:00"),
    makeShow("going-ended", ShowStatus.UPCOMING, YESTERDAY), // 滞后结束
    makeShow("attended-old", ShowStatus.ENDED, "2026-08-01T20:00:00+08:00"),
    makeShow("attended-future", ShowStatus.UPCOMING, FUTURE),
  ];
  const showMap = new Map(shows.map((s) => [s.id, s]));

  it("going/interested 仅收纳 upcoming；演出结束自动从两个列表移除", () => {
    const result = deriveMyShows(
      {
        "going-future": UserShowStatus.GOING,
        "interested-future": UserShowStatus.INTERESTED,
        "going-ended": UserShowStatus.GOING, // 结束后不再出现在"我要去"
      },
      showMap
    );
    expect(result.going.map((s) => s.id)).toEqual(["going-future"]);
    expect(result.interested.map((s) => s.id)).toEqual([
      "interested-future",
    ]);
    expect(result.attended).toEqual([]);
  });

  it("attended 是记录级事实：演出结束后永久保留，日期倒序", () => {
    const result = deriveMyShows(
      {
        "attended-old": UserShowStatus.ATTENDED,
        "attended-future": UserShowStatus.ATTENDED,
      },
      showMap
    );
    expect(result.attended.map((s) => s.id)).toEqual([
      "attended-future",
      "attended-old",
    ]);
    expect(result.going).toEqual([]);
    expect(result.interested).toEqual([]);
  });

  it("showMap 中不存在的 showId 自动过滤", () => {
    const result = deriveMyShows(
      { ghost: UserShowStatus.GOING },
      showMap
    );
    expect(result.going).toEqual([]);
  });
});

// ============================================================
// E. deriveMemberRooms — Room 成员关系（严格 membership 驱动）
// ============================================================

describe("deriveMemberRooms 我的小屋", () => {
  const shows: Show[] = [
    makeShow("show-up", ShowStatus.UPCOMING, FUTURE, {
      artists: [
        {
          id: "sa-1",
          show_id: "show-up",
          artist_id: "artist-1",
          role: ArtistRole.HEADLINER,
          billing_order: 1,
          artist: {
            id: "artist-1",
            name: "Headliner 乐队",
            city: "北京",
            genres: [],
            created_at: "",
          },
        },
      ],
    }),
    makeShow("show-ended", ShowStatus.ENDED, TEN_DAYS_AGO),
    makeShow("show-cancelled", ShowStatus.CANCELLED, FUTURE),
    makeShow("show-nomember", ShowStatus.UPCOMING, "2026-11-01T20:00:00+08:00"),
  ];
  const showMap = new Map(shows.map((s) => [s.id, s]));

  const rooms: ShowRoom[] = [
    makeRoom("room-up", "show-up", {
      message_count: 2,
      buddy_post_count: 1,
      ticket_post_count: 0,
      live_post_count: 3,
      member_count: 5,
    }),
    makeRoom("room-ended", "show-ended", { live_post_count: 1 }),
    makeRoom("room-cancelled", "show-cancelled"),
    makeRoom("room-nomember", "show-nomember"),
    makeRoom("room-orphan", "show-ghost"),
  ];

  const memberships = [
    { room_id: "room-up", joined_at: "2026-09-01T00:00:00+08:00" },
    { room_id: "room-ended", joined_at: "2026-09-01T00:00:00+08:00" },
    { room_id: "room-cancelled", joined_at: "2026-09-01T00:00:00+08:00" },
    { room_id: "room-orphan", joined_at: "2026-09-01T00:00:00+08:00" },
    { room_id: "room-missing", joined_at: "2026-09-01T00:00:00+08:00" },
  ];

  it("未加入的演出绝不出现（含 Going/Interested 但无 membership）", () => {
    const { current, past } = deriveMemberRooms(memberships, rooms, showMap);
    const allIds = [...current, ...past].map((i) => i.roomId);
    expect(allIds).not.toContain("room-nomember");
  });

  it("upcoming → 当前；ended/cancelled/postponed → 过往", () => {
    const { current, past } = deriveMemberRooms(memberships, rooms, showMap);
    expect(current.map((i) => i.roomId)).toEqual(["room-up"]);
    expect(past.map((i) => i.roomId).sort()).toEqual([
      "room-cancelled",
      "room-ended",
    ]);
  });

  it("孤立 membership（room 或 show 不存在）被跳过", () => {
    const { current, past } = deriveMemberRooms(memberships, rooms, showMap);
    const allIds = [...current, ...past].map((i) => i.roomId);
    expect(allIds).not.toContain("room-orphan");
    expect(allIds).not.toContain("room-missing");
  });

  it("item 派生字段：artistName 取 headliner，activityCount 为四类内容之和", () => {
    const { current } = deriveMemberRooms(memberships, rooms, showMap);
    const item = current[0];
    expect(item.artistName).toBe("Headliner 乐队");
    expect(item.activityCount).toBe(6);
    expect(item.joinedAt).toBe("2026-09-01T00:00:00+08:00");
    expect(item.show.id).toBe("show-up");
  });

  it("当前按演出日期升序、过往按日期倒序", () => {
    const moreRooms: ShowRoom[] = [
      makeRoom("r-a", "s-a"),
      makeRoom("r-b", "s-b"),
      makeRoom("r-p1", "s-p1"),
      makeRoom("r-p2", "s-p2"),
    ];
    const moreShows = [
      makeShow("s-a", ShowStatus.UPCOMING, "2026-11-01T20:00:00+08:00"),
      makeShow("s-b", ShowStatus.UPCOMING, "2026-10-01T20:00:00+08:00"),
      makeShow("s-p1", ShowStatus.ENDED, "2026-08-01T20:00:00+08:00"),
      makeShow("s-p2", ShowStatus.ENDED, "2026-09-01T20:00:00+08:00"),
    ];
    const map = new Map(moreShows.map((s) => [s.id, s]));
    const ms = [
      { room_id: "r-a", joined_at: "" },
      { room_id: "r-b", joined_at: "" },
      { room_id: "r-p1", joined_at: "" },
      { room_id: "r-p2", joined_at: "" },
    ];
    const { current, past } = deriveMemberRooms(ms, moreRooms, map);
    expect(current.map((i) => i.roomId)).toEqual(["r-b", "r-a"]);
    expect(past.map((i) => i.roomId)).toEqual(["r-p2", "r-p1"]);
  });
});
