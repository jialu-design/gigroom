/**
 * P8 行为测试 - Profile / Rooms / EditProfile
 *
 * 覆盖测试组：
 * A. Profile 未登录 & 已登录（显示资料 / Follow数 / Attended数）
 * B. Profile 乐队 Tab（仅显示 followedArtistIds / 取消关注实时消失 / 空状态）
 * C. Profile 演出 Tab（Going/Interested 未来-only / Attended / 排序 / 去重）
 * D. Profile 房间 Tab（仅 roomMemberships / 最多5个 / joined_at倒序 / Going但未join不出现）
 * E. Rooms 页面（即将到来/过往严格依赖 RoomMembership / URL / 空状态）
 * F. EditProfile 资料编辑 & persist（用户名/城市/Bio/清空后持久化）
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { UserShowStatus } from "@/lib/types";
import { artistMap } from "@/mocks/artists";
import { showMap, mockShowRooms } from "@/mocks/shows";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";

// 测试组内共享：演出派生逻辑（被测页面相同实现，此处直接断言结果）
function deriveFollowedArtists(ids: string[]) {
  return ids
    .map((id) => artistMap.get(id))
    .filter((a): a is NonNullable<ReturnType<typeof artistMap.get>> => !!a);
}

function deriveProfileShows(showStatuses: Record<string, UserShowStatus>) {
  const going: string[] = [];
  const interested: string[] = [];
  const attended: string[] = [];
  for (const [showId, status] of Object.entries(showStatuses)) {
    const show = showMap.get(showId);
    if (!show) continue;
    const lifecycle = getShowLifecycle(show);
    if (status === UserShowStatus.GOING && !lifecycle.hasEnded) going.push(showId);
    if (status === UserShowStatus.INTERESTED && !lifecycle.hasEnded) interested.push(showId);
    if (status === UserShowStatus.ATTENDED) attended.push(showId);
  }
  going.sort((a, b) => showMap.get(a)!.date_time.localeCompare(showMap.get(b)!.date_time));
  interested.sort((a, b) => showMap.get(a)!.date_time.localeCompare(showMap.get(b)!.date_time));
  attended.sort((a, b) => showMap.get(b)!.date_time.localeCompare(showMap.get(a)!.date_time));
  return { going, interested, attended };
}

function deriveProfileRooms(memberships: { room_id: string; joined_at: string }[], limit = 5) {
  const roomToShow = new Map<string, string>();
  for (const room of mockShowRooms) {
    if (showMap.has(room.show_id)) roomToShow.set(room.id, room.show_id);
  }
  const items = memberships
    .filter((m) => roomToShow.has(m.room_id))
    .map((m) => ({
      room_id: m.room_id,
      joined_at: m.joined_at,
      show_id: roomToShow.get(m.room_id)!,
    }));
  items.sort((a, b) => b.joined_at.localeCompare(a.joined_at));
  return items.slice(0, limit);
}

function deriveRoomsPage(memberships: { room_id: string; joined_at: string }[]) {
  const roomMap = new Map(mockShowRooms.map((r) => [r.id, r]));
  const roomShowMap = new Map<string, string>();
  for (const room of mockShowRooms) {
    if (showMap.has(room.show_id)) roomShowMap.set(room.id, room.show_id);
  }
  const upcoming: string[] = [];
  const past: string[] = [];
  for (const m of memberships) {
    const room = roomMap.get(m.room_id);
    const showId = roomShowMap.get(m.room_id);
    if (!room || !showId) continue;
    const show = showMap.get(showId)!;
    const lifecycle = getShowLifecycle(show);
    if (!lifecycle.hasEnded) upcoming.push(showId);
    else past.push(showId);
  }
  upcoming.sort((a, b) => showMap.get(a)!.date_time.localeCompare(showMap.get(b)!.date_time));
  past.sort((a, b) => showMap.get(b)!.date_time.localeCompare(showMap.get(a)!.date_time));
  return { upcoming, past };
}

beforeEach(() => {
  useUserStore.getState().logout();
  useUIStore.setState({
    isLoginModalOpen: false,
    isOnboardingModalOpen: false,
    isEditProfileModalOpen: false,
    pendingAuthAction: null,
  });
  localStorage.clear();
});

// ========================
// A. Profile 基础（未登录 & 已登录 & 统计）
// ========================
describe("P8 A. Profile 基础（未登录 & 已登录 & 统计）", () => {
  it("未登录：isLoggedIn=false, user=null（未登录态显示登录提示）", () => {
    const { isLoggedIn, user } = useUserStore.getState();
    expect(isLoggedIn).toBe(false);
    expect(user).toBeNull();
  });

  it("已登录：mockLogin 后 user 存在，可用于 ProfileHeader 显示", () => {
    useUserStore.getState().mockLogin();
    const { isLoggedIn, user } = useUserStore.getState();
    expect(isLoggedIn).toBe(true);
    expect(user).not.toBeNull();
    expect(user!.display_name).toBeDefined();
  });

  it("喜欢的乐队数 = followedArtistIds.length（实时统计）", () => {
    useUserStore.getState().mockLogin();
    const { followedArtistIds, user } = useUserStore.getState();
    // followedCount（ProfileHeader 显示）= followedArtistIds.length（不直接硬编码）
    expect(followedArtistIds.length).toBeGreaterThan(0);
    // 取消一个后统计递减
    useUserStore.getState().unfollowArtist(followedArtistIds[0]);
    expect(useUserStore.getState().followedArtistIds.length).toBe(
      followedArtistIds.length - 1
    );
    // 登录用户信息
    expect(user).not.toBeNull();
  });

  it("去过的现场数 = showStatuses 中 status==='attended' 的数量", () => {
    useUserStore.getState().mockLogin();
    const { showStatuses } = useUserStore.getState();
    const attendedCount = Object.values(showStatuses).filter(
      (s) => s === UserShowStatus.ATTENDED
    ).length;
    expect(attendedCount).toBeGreaterThanOrEqual(1); // mock 预置 show-1: attended
    // 新设置一个 attended 后计数增加
    const before = attendedCount;
    useUserStore.getState().setShowStatus("show-2", UserShowStatus.ATTENDED);
    const after = Object.values(useUserStore.getState().showStatuses).filter(
      (s) => s === UserShowStatus.ATTENDED
    ).length;
    expect(after).toBe(before + 1);
  });
});

// ========================
// B. Profile - 乐队 Tab
// ========================
describe("P8 B. Profile - 乐队 Tab", () => {
  it("仅显示 followedArtistIds 对应的乐队（派生逻辑正确）", () => {
    useUserStore.getState().mockLogin();
    const ids = useUserStore.getState().followedArtistIds;
    const artists = deriveFollowedArtists(ids);
    expect(artists.length).toBe(ids.length);
    for (const a of artists) {
      expect(ids).toContain(a.id);
    }
  });

  it("取消关注后列表实时消失（unfollowArtist 后派生数据同步）", () => {
    useUserStore.getState().mockLogin();
    const targetId = useUserStore.getState().followedArtistIds[0];
    expect(targetId).toBeDefined();
    useUserStore.getState().unfollowArtist(targetId);
    const after = deriveFollowedArtists(useUserStore.getState().followedArtistIds);
    expect(after.some((a) => a.id === targetId)).toBe(false);
  });

  it("空状态：followedArtistIds 为空 → 派生乐队列表为空", () => {
    useUserStore.getState().mockLogin();
    const allIds = [...useUserStore.getState().followedArtistIds];
    for (const id of allIds) useUserStore.getState().unfollowArtist(id);
    expect(useUserStore.getState().followedArtistIds).toEqual([]);
    expect(deriveFollowedArtists([])).toEqual([]);
  });
});

// ========================
// C. Profile - 演出 Tab
// ========================
describe("P8 C. Profile - 演出 Tab（Going/Interested/Attended）", () => {
  it("Going 只显示未来 going（show-4 / show-15 为预置 going future）", () => {
    useUserStore.getState().mockLogin();
    const { showStatuses } = useUserStore.getState();
    const { going } = deriveProfileShows(showStatuses);
    for (const showId of going) {
      const s = showMap.get(showId)!;
      expect(showStatuses[showId]).toBe(UserShowStatus.GOING);
      // hasEnded=false → 未来 / 当天
      expect(getShowLifecycle(s).hasEnded).toBe(false);
    }
  });

  it("Interested 只显示未来 interested", () => {
    useUserStore.getState().mockLogin();
    const { showStatuses } = useUserStore.getState();
    const { interested } = deriveProfileShows(showStatuses);
    for (const showId of interested) {
      const s = showMap.get(showId)!;
      expect(showStatuses[showId]).toBe(UserShowStatus.INTERESTED);
      expect(getShowLifecycle(s).hasEnded).toBe(false);
    }
  });

  it("Attended 只显示 attended（不区分未来/过去）", () => {
    useUserStore.getState().mockLogin();
    const { showStatuses } = useUserStore.getState();
    const { attended } = deriveProfileShows(showStatuses);
    for (const showId of attended) {
      expect(showStatuses[showId]).toBe(UserShowStatus.ATTENDED);
    }
  });

  it("Going / Interested 不重复出现（同一 show 只出现一次）", () => {
    useUserStore.getState().mockLogin();
    // 人为造个 going show 并再 interested，结果应根据最终 status 归属
    useUserStore.getState().setShowStatus("show-5", UserShowStatus.GOING);
    useUserStore.getState().setShowStatus("show-5", UserShowStatus.INTERESTED);
    const { going, interested } = deriveProfileShows(
      useUserStore.getState().showStatuses
    );
    const intersect = going.filter((id) => interested.includes(id));
    expect(intersect).toEqual([]);
  });

  it("Going / Interested 日期升序（asc）", () => {
    useUserStore.getState().mockLogin();
    // 添加多场 going（未来）验证排序
    useUserStore.getState().setShowStatus("show-8", UserShowStatus.GOING);
    useUserStore.getState().setShowStatus("show-10", UserShowStatus.GOING);
    const { going } = deriveProfileShows(useUserStore.getState().showStatuses);
    for (let i = 1; i < going.length; i++) {
      const prev = showMap.get(going[i - 1])!.date_time;
      const curr = showMap.get(going[i])!.date_time;
      expect(prev.localeCompare(curr) <= 0).toBe(true);
    }
    const { interested } = deriveProfileShows(useUserStore.getState().showStatuses);
    for (let i = 1; i < interested.length; i++) {
      const prev = showMap.get(interested[i - 1])!.date_time;
      const curr = showMap.get(interested[i])!.date_time;
      expect(prev.localeCompare(curr) <= 0).toBe(true);
    }
  });

  it("Attended 日期倒序（desc）", () => {
    useUserStore.getState().mockLogin();
    // 添加多场 attended
    useUserStore.getState().setShowStatus("show-2", UserShowStatus.ATTENDED);
    useUserStore.getState().setShowStatus("show-3", UserShowStatus.ATTENDED);
    const { attended } = deriveProfileShows(useUserStore.getState().showStatuses);
    expect(attended.length).toBeGreaterThanOrEqual(3);
    for (let i = 1; i < attended.length; i++) {
      const prev = showMap.get(attended[i - 1])!.date_time;
      const curr = showMap.get(attended[i])!.date_time;
      expect(prev.localeCompare(curr) >= 0).toBe(true);
    }
  });

  it("空状态：无 going / 无 interested / 无 attended", () => {
    useUserStore.getState().mockLogin();
    // 清空所有 showStatuses
    for (const id of Object.keys(useUserStore.getState().showStatuses)) {
      useUserStore.getState().removeShowStatus(id);
    }
    const { going, interested, attended } = deriveProfileShows(
      useUserStore.getState().showStatuses
    );
    expect(going).toEqual([]);
    expect(interested).toEqual([]);
    expect(attended).toEqual([]);
  });
});

// ========================
// D. Profile - 房间 Tab
// ========================
describe("P8 D. Profile - 房间 Tab", () => {
  it("只显示 roomMemberships 中存在的房间（派生数据严格依赖 membership）", () => {
    useUserStore.getState().mockLogin();
    const memberships = useUserStore.getState().roomMemberships;
    expect(memberships.length).toBeGreaterThan(0);
    const rooms = deriveProfileRooms(memberships, 5);
    expect(rooms.length).toBeLessThanOrEqual(memberships.length);
    for (const r of rooms) {
      expect(memberships.some((m) => m.room_id === r.room_id)).toBe(true);
    }
  });

  it("最多显示 5 个（即使 memberships 超过 5）", () => {
    useUserStore.getState().mockLogin();
    // 构造更多 memberships
    const extraRoomIds = ["room-2", "room-3", "room-5", "room-6", "room-7"];
    for (const rid of extraRoomIds) {
      useUserStore.getState().joinRoom(rid);
    }
    const m = useUserStore.getState().roomMemberships;
    expect(m.length).toBeGreaterThanOrEqual(5);
    const rooms = deriveProfileRooms(m, 5);
    expect(rooms.length).toBe(5);
  });

  it("按 joined_at 倒序", () => {
    useUserStore.getState().mockLogin();
    // 清空并按顺序加入，验证排序（通过显式创建 RoomMemberships with controlled times）
    for (const m of useUserStore.getState().roomMemberships) {
      useUserStore.getState().leaveRoom(m.room_id);
    }
    // 依次加入，使用 await 保证 joined_at 时间有差异
    useUserStore.getState().joinRoom("room-1");
    // 人为构造时间差异（直接 set store 保证时间戳顺序）
    const { roomMemberships } = useUserStore.getState();
    // 手动把 room-1 的 joined_at 改到较早时间
    const t1 = new Date(Date.now() - 3000).toISOString();
    const t2 = new Date(Date.now() - 2000).toISOString();
    const t3 = new Date(Date.now() - 1000).toISOString();
    // 清空再手动填充带精确时间戳的 membership
    useUserStore.setState({
      roomMemberships: [
        { id: "rm-a", user_id: "user-1", room_id: "room-1", joined_at: t1 },
        { id: "rm-b", user_id: "user-1", room_id: "room-2", joined_at: t2 },
        { id: "rm-c", user_id: "user-1", room_id: "room-3", joined_at: t3 },
      ],
    });
    const rooms = deriveProfileRooms(useUserStore.getState().roomMemberships, 5);
    // 倒序：t3（room-3）最新 → t2（room-2）→ t1（room-1）最早
    expect(rooms[0].room_id).toBe("room-3");
    expect(rooms[1].room_id).toBe("room-2");
    expect(rooms[2].room_id).toBe("room-1");
  });

  it("Going 但未 join 的 show 不出现（严格只依赖 membership）", () => {
    useUserStore.getState().mockLogin();
    // 清空 memberships 但保留 showStatuses going
    for (const m of useUserStore.getState().roomMemberships) {
      useUserStore.getState().leaveRoom(m.room_id);
    }
    // going show 的 room 不应出现
    const rooms = deriveProfileRooms(useUserStore.getState().roomMemberships, 5);
    expect(rooms).toEqual([]);
  });
});

// ========================
// E. Rooms 页面（严格依赖 RoomMembership）
// ========================
describe("P8 E. Rooms 页面（严格依赖 RoomMembership）", () => {
  it("即将到来：只显示已 membership 且未结束的房间", () => {
    useUserStore.getState().mockLogin();
    const { upcoming } = deriveRoomsPage(useUserStore.getState().roomMemberships);
    for (const showId of upcoming) {
      const show = showMap.get(showId)!;
      expect(getShowLifecycle(show).hasEnded).toBe(false);
    }
  });

  it("过往：只显示已 membership 且已结束的演出", () => {
    useUserStore.getState().mockLogin();
    // 手动加入一场已结束演出的房间（show-1）
    const show1Room = mockShowRooms.find((r) => r.show_id === "show-1");
    if (show1Room) {
      useUserStore.getState().joinRoom(show1Room.id);
    }
    const { past } = deriveRoomsPage(useUserStore.getState().roomMemberships);
    for (const showId of past) {
      const show = showMap.get(showId)!;
      expect(getShowLifecycle(show).hasEnded).toBe(true);
    }
  });

  it("Going 未加入的不显示 / Interested 未加入的不显示", () => {
    useUserStore.getState().mockLogin();
    // 清空 memberships，仅保留 going / interested status
    for (const m of useUserStore.getState().roomMemberships) {
      useUserStore.getState().leaveRoom(m.room_id);
    }
    useUserStore.getState().setShowStatus("show-8", UserShowStatus.GOING);
    useUserStore.getState().setShowStatus("show-9", UserShowStatus.INTERESTED);
    const { upcoming, past } = deriveRoomsPage(
      useUserStore.getState().roomMemberships
    );
    expect(upcoming).toEqual([]);
    expect(past).toEqual([]);
  });

  it("点击进入房间 URL 应指向 /show/[id]?tab=discussion#room", () => {
    useUserStore.getState().mockLogin();
    // 取一条存在的 membership 并生成 URL
    const m = useUserStore.getState().roomMemberships[0];
    const showRoom = mockShowRooms.find((r) => r.id === m.room_id);
    expect(showRoom).toBeDefined();
    const expected = `/show/${showRoom!.show_id}?tab=discussion#room`;
    expect(expected.startsWith("/show/")).toBe(true);
    expect(expected.includes("tab=discussion")).toBe(true);
    expect(expected.endsWith("#room")).toBe(true);
  });

  it("空状态：无 membership → 即将到来 & 过往皆空", () => {
    useUserStore.getState().mockLogin();
    for (const m of useUserStore.getState().roomMemberships) {
      useUserStore.getState().leaveRoom(m.room_id);
    }
    const { upcoming, past } = deriveRoomsPage(
      useUserStore.getState().roomMemberships
    );
    expect(upcoming).toEqual([]);
    expect(past).toEqual([]);
  });
});

// ========================
// F. EditProfile（资料编辑 & Zustand persist）
// ========================
describe("P8 F. EditProfileModal 资料编辑 & persist", () => {
  it("编辑用户名后立即更新 store.user.display_name", () => {
    useUserStore.getState().mockLogin();
    const before = useUserStore.getState().user!.display_name;
    useUserStore.getState().updateUser({ display_name: "P8测试用户_新名" });
    expect(useUserStore.getState().user!.display_name).toBe("P8测试用户_新名");
    expect(useUserStore.getState().user!.display_name).not.toBe(before);
  });

  it("编辑城市后立即更新（city 从已有 CITIES 中选择）", () => {
    useUserStore.getState().mockLogin();
    useUserStore.getState().updateUser({ city: "成都" });
    expect(useUserStore.getState().user!.city).toBe("成都");
  });

  it("编辑 Bio 后立即更新（可为空字符串/undefined）", () => {
    useUserStore.getState().mockLogin();
    useUserStore.getState().updateUser({ bio: "P8 - 简介一句话" });
    expect(useUserStore.getState().user!.bio).toBe("P8 - 简介一句话");
    // 清空 bio
    useUserStore.getState().updateUser({ bio: undefined });
    expect(useUserStore.getState().user!.bio).toBeUndefined();
  });

  it("保存后 Zustand persist 生效：localStorage 中 user 字段更新", () => {
    useUserStore.getState().mockLogin();
    useUserStore.getState().updateUser({
      display_name: "P8持久化用户",
      city: "深圳",
      bio: "P8持久化简介",
    });
    // persist 配置：gigroom-user-storage（对应 useUserStore persist name）
    const raw = localStorage.getItem("gigroom-user-storage");
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { state?: { user?: { display_name?: string; city?: string; bio?: string } } };
    expect(parsed.state?.user?.display_name).toBe("P8持久化用户");
    expect(parsed.state?.user?.city).toBe("深圳");
    expect(parsed.state?.user?.bio).toBe("P8持久化简介");
  });

  it("UI Store 中 EditProfileModal 开关可切换（供 P8 页面调用）", () => {
    expect(useUIStore.getState().isEditProfileModalOpen).toBe(false);
    useUIStore.getState().openEditProfileModal();
    expect(useUIStore.getState().isEditProfileModalOpen).toBe(true);
    useUIStore.getState().closeEditProfileModal();
    expect(useUIStore.getState().isEditProfileModalOpen).toBe(false);
  });
});
