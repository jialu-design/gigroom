/**
 * Zustand Store - 用户状态
 * V1 核心原则：未登录可浏览，互动时触发登录
 * P10.1：Supabase Auth 成为真实登录事实来源，store 仅保存 auth snapshot
 * - mockLogin / loginWithCredentials / registerWithCredentials 标记 @deprecated，仅供测试
 * - 生产路径通过 AuthProvider → auth API → Supabase 更新 store
 * P9：通知数据单一来源（notifications 数组），unreadCount 由派生得到
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, UserShowStatus, RoomMembership, Notification } from "@/lib/types";
import { NotificationType } from "@/lib/types";
import { mockCurrentUser } from "@/mocks/users";
import { useUIStore } from "@/lib/stores/useUIStore";

// Mock 预置数据（仅在 mockLogin / 凭证登录时使用）
const MOCK_FOLLOWED = ["artist-1", "artist-4", "artist-7", "artist-11"];
const MOCK_SHOW_STATUSES: Record<string, UserShowStatus> = {
  "show-1": "attended" as UserShowStatus,
  "show-4": "going" as UserShowStatus,
  "show-7": "interested" as UserShowStatus,
  "show-15": "going" as UserShowStatus,
};
const MOCK_ROOM_MEMBERSHIPS: RoomMembership[] = [
  { id: "rm-1", user_id: "user-1", room_id: "room-1", joined_at: "2026-07-20T10:00:00Z" },
  { id: "rm-4", user_id: "user-1", room_id: "room-4", joined_at: "2026-08-01T10:00:00Z" },
];
const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-1",
    user_id: "user-1",
    type: NotificationType.NEW_SHOW,
    title: "Chinese Football 在上海有新演出（DEMO）",
    related_show_id: "show-4",
    is_read: false,
    created_at: "2026-08-14T10:00:00Z",
  },
  {
    id: "notif-4",
    user_id: "user-1",
    type: NotificationType.ATTENDED_CHECK,
    title: "你去了 Chinese Football 武汉场吗？（DEMO）",
    related_show_id: "show-1",
    is_read: true,
    created_at: "2026-07-26T10:00:00Z",
  },
  // ===== 场景覆盖 seed：每种已有通知类型至少 1 条代表数据（deep link 全部指向真实内容）=====
  // 注意：不 seed LIVE_INTERACTION（p5-live-interaction 测试锁定该类型初始计数 0/1），
  // 该类型通过现场互动动态生成走查；BUDDY_INTERACTION 无生成路径，以已读历史样本供 UI 走查
  {
    id: "notif-2",
    user_id: "user-1",
    type: NotificationType.DISCUSSION_REPLY,
    title: "数学摇滚老张 回复了你的讨论（DEMO）",
    related_show_id: "show-15",
    related_content_id: "msg-15-2",
    from_user_id: "user-3",
    target_url: "/show/show-15?tab=discussion#room",
    is_read: false,
    created_at: "2026-09-30T12:30:00Z",
  },
  {
    id: "notif-3",
    user_id: "user-1",
    type: NotificationType.BUDDY_REPLY,
    title: "录音笔小王 回复了你的找搭子帖（DEMO）",
    related_show_id: "show-15",
    related_content_id: "bp-8",
    from_user_id: "user-5",
    target_url: "/show/show-15?tab=buddy#room",
    is_read: false,
    created_at: "2026-09-29T12:00:00Z",
  },
  {
    id: "notif-5",
    user_id: "user-1",
    type: NotificationType.TICKET_MESSAGE,
    title: "后朋克少女 给你发了一条交易消息（DEMO）",
    related_show_id: "show-15",
    related_content_id: "conv-3",
    from_user_id: "user-2",
    target_url: "/show/show-15?tab=ticket#room",
    is_read: false,
    created_at: "2026-09-30T20:00:00Z",
  },
  {
    id: "notif-6",
    user_id: "user-1",
    type: NotificationType.TICKET_FAVORITE,
    title: "后朋克少女 收藏了你的出收票帖（DEMO）",
    related_show_id: "show-1",
    related_content_id: "tp-8",
    from_user_id: "user-2",
    target_url: "/show/show-1?tab=ticket#room",
    is_read: true,
    created_at: "2026-09-26T10:00:00Z",
  },
  {
    id: "notif-7",
    user_id: "user-1",
    type: NotificationType.BUDDY_INTERACTION,
    title: "后朋克少女 对你的找搭子帖感兴趣（DEMO）",
    related_show_id: "show-15",
    related_content_id: "bp-8",
    from_user_id: "user-2",
    target_url: "/show/show-15?tab=buddy#room",
    is_read: true,
    created_at: "2026-09-25T10:00:00Z",
  },
];

const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));

// ============================================================================
// P0-1 按用户持久化业务数据快照（修复重新登录后 收藏/Going/Interested/小屋 丢失）
//
// 背景：clearAuth() 登出时会清空全部业务数据并写回 persist；重新登录时
// setAuthUser() 只恢复 user 快照。follows/rooms 会由 DB 重新同步，
// 但 mock-only 状态（showStatuses/notifications/likedLivePostIds）没有任何
// 恢复路径 → 重新登录后全部丢失。
//
// 方案：按 userId 把业务数据快照写 localStorage（gigroom-business-<id>）。
// - 登出（clearAuth）：先写入快照再清空
// - 登录/恢复会话（setAuthUser）：当前字段为空时从快照恢复（不覆盖已同步的新数据）
// - 数据真值源：followedArtistIds / roomMemberships → Supabase（快照仅缓存兜底）；
//   showStatuses / notifications / likedLivePostIds → mock-only（快照即持久层）
// ============================================================================
type BusinessSnapshot = {
  followedArtistIds: string[];
  showStatuses: Record<string, UserShowStatus>;
  roomMemberships: RoomMembership[];
  notifications: Notification[];
  likedLivePostIds: string[];
};

const businessKey = (userId: string) => `gigroom-business-${userId}`;

function loadBusinessSnapshot(userId: string): Partial<BusinessSnapshot> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(businessKey(userId));
    return raw ? (JSON.parse(raw) as Partial<BusinessSnapshot>) : {};
  } catch {
    return {};
  }
}

function saveBusinessSnapshot(userId: string, snap: BusinessSnapshot) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(businessKey(userId), JSON.stringify(snap));
  } catch {
    // 存储不可用时静默降级：仅丢失跨会话恢复能力
  }
}

function extractBusinessSnapshot(state: {
  followedArtistIds: string[];
  showStatuses: Record<string, UserShowStatus>;
  roomMemberships: RoomMembership[];
  notifications: Notification[];
  likedLivePostIds: string[];
}): BusinessSnapshot {
  return {
    followedArtistIds: state.followedArtistIds,
    showStatuses: state.showStatuses,
    roomMemberships: state.roomMemberships,
    notifications: state.notifications,
    likedLivePostIds: state.likedLivePostIds,
  };
}

export interface RegisterInput {
  email: string;
  password: string;
  display_name: string;
}

interface UserState {
  // 当前用户（null = 游客）
  user: User | null;
  isLoggedIn: boolean;
  /** Auth 流程 loading（登录/注册进行中） */
  authLoading: boolean;

  // 用户数据（游客时为空）
  followedArtistIds: string[];
  showStatuses: Record<string, UserShowStatus>;
  roomMemberships: RoomMembership[];
  /** 通知列表（P9 单一来源，unreadCount 由派生得到） */
  notifications: Notification[];
  /** P5: 当前用户点赞过的现场帖 id（持久化，刷新保持一致） */
  likedLivePostIds: string[];

  // Actions
  /** @deprecated 仅供测试。P10.1 后生产路径走 Supabase Auth */
  mockLogin: () => void;
  /** @deprecated 仅供测试。P10.1 后生产路径走 auth API */
  loginWithCredentials: (email: string, password: string) => Promise<void>;
  /** @deprecated 仅供测试。P10.1 后生产路径走 auth API */
  registerWithCredentials: (input: RegisterInput) => Promise<void>;

  // P10.1 Auth snapshot actions（由 AuthProvider 调用）
  /** 设置 auth 用户 snapshot（由 AuthProvider 在 session 恢复/变更时调用） */
  setAuthUser: (user: User | null) => void;
  /** 设置 authLoading（由 AuthProvider 在初始化/session 检查时调用） */
  setAuthLoading: (loading: boolean) => void;
  /** 清除 auth 状态（登出时调用，清空 user + 业务数据 + pending action） */
  clearAuth: () => void;
  /** 兼容：保留 login 方法供测试使用 */
  login: (user: User) => void;
  logout: () => void;
  updateUser: (updates: Partial<Pick<User, "display_name" | "avatar_url" | "city" | "bio" | "onboarding_completed">>) => void;
  followArtist: (artistId: string) => void;
  unfollowArtist: (artistId: string) => void;
  /** P10.2-B: 从 Supabase 同步关注列表（覆盖 store cache） */
  setFollowedArtistIds: (ids: string[]) => void;
  setShowStatus: (showId: string, status: UserShowStatus) => void;
  removeShowStatus: (showId: string) => void;
  joinRoom: (roomId: string) => void;
  leaveRoom: (roomId: string) => void;
  /** P10.2-D: 从 Supabase 同步房间成员列表（覆盖 store cache） */
  setRoomMemberships: (memberships: RoomMembership[]) => void;
  // P9 通知 actions
  /** 添加通知（防重复：同 type + related_show_id/related_content_id + from_user_id 已存在则跳过） */
  addNotification: (notification: Notification) => void;
  /** 标记单条已读 */
  markNotificationRead: (notificationId: string) => void;
  /** 全部标记已读 */
  markAllNotificationsRead: () => void;
  /** P4 收口：关联内容（消息/帖子/会话）被删除时，把对应通知置为失效并清除未读 */
  markNotificationsContentDeleted: (contentIds: string[]) => void;
  /** P5: 点赞/取消点赞现场帖（toggle，幂等） */
  toggleLivePostLike: (postId: string) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      // 默认：游客状态
      user: null,
      isLoggedIn: false,
      authLoading: true, // P10.1: 初始为 true，AuthProvider 检查 session 后设为 false
      followedArtistIds: [],
      showStatuses: {},
      roomMemberships: [],
      notifications: [],
      likedLivePostIds: [],
      setAuthUser: (user) =>
        set((state) => {
          if (!user) {
            return { user: null, isLoggedIn: false, authLoading: false };
          }
          // P0-1: 登录/恢复会话时，从按用户快照恢复「当前为空」的业务字段。
          // DB 同步（follows/rooms）随后覆盖真值；mock-only 字段以快照为持久层。
          const snap = loadBusinessSnapshot(user.id);
          return {
            user,
            isLoggedIn: true,
            authLoading: false,
            followedArtistIds:
              state.followedArtistIds.length === 0 && snap.followedArtistIds
                ? snap.followedArtistIds
                : state.followedArtistIds,
            showStatuses:
              Object.keys(state.showStatuses).length === 0 && snap.showStatuses
                ? snap.showStatuses
                : state.showStatuses,
            roomMemberships:
              state.roomMemberships.length === 0 && snap.roomMemberships
                ? snap.roomMemberships
                : state.roomMemberships,
            notifications:
              state.notifications.length === 0 && snap.notifications
                ? snap.notifications
                : state.notifications,
            likedLivePostIds:
              state.likedLivePostIds.length === 0 && snap.likedLivePostIds
                ? snap.likedLivePostIds
                : state.likedLivePostIds,
          };
        }),

      setAuthLoading: (loading) =>
        set({ authLoading: loading }),

      clearAuth: () => {
        useUIStore.getState().clearPendingAuthAction();
        // P0-1: 登出前先把当前用户业务数据写入按用户快照，供重新登录恢复
        const current = useUserStore.getState();
        if (current.user) {
          saveBusinessSnapshot(
            current.user.id,
            extractBusinessSnapshot(current)
          );
        }
        set({
          user: null,
          isLoggedIn: false,
          authLoading: false,
          followedArtistIds: [],
          showStatuses: {},
          roomMemberships: [],
          notifications: [],
          likedLivePostIds: [],
        });
      },

      // ===== @deprecated Mock auth methods（仅供测试） =====
      mockLogin: () =>
        set({
          user: mockCurrentUser,
          isLoggedIn: true,
          authLoading: false,
          followedArtistIds: [...MOCK_FOLLOWED],
          showStatuses: { ...MOCK_SHOW_STATUSES },
          roomMemberships: [...MOCK_ROOM_MEMBERSHIPS],
          notifications: [...MOCK_NOTIFICATIONS],
          likedLivePostIds: [],
        }),

      login: (user) =>
        set({
          user,
          isLoggedIn: true,
          authLoading: false,
        }),

      loginWithCredentials: async (email, password) => {
        set({ authLoading: true });
        await delay();
        // mock 校验：非空邮箱 + 密码 >= 4
        if (!email || !email.trim() || !password || password.length < 4) {
          set({ authLoading: false });
          throw new Error("邮箱或密码不正确");
        }
        // mock 成功：载入 demo 账号
        set({
          user: mockCurrentUser,
          isLoggedIn: true,
          authLoading: false,
          followedArtistIds: [...MOCK_FOLLOWED],
          showStatuses: { ...MOCK_SHOW_STATUSES },
          roomMemberships: [...MOCK_ROOM_MEMBERSHIPS],
          notifications: [...MOCK_NOTIFICATIONS],
          likedLivePostIds: [],
        });
      },

      registerWithCredentials: async ({ email, password, display_name }) => {
        set({ authLoading: true });
        await delay();
        if (!email || !email.trim() || !password || password.length < 4) {
          set({ authLoading: false });
          throw new Error("邮箱或密码不正确");
        }
        if (!display_name || !display_name.trim()) {
          set({ authLoading: false });
          throw new Error("请输入用户名");
        }
        // mock 注册：新建空业务数据用户并登录
        const newUser: User = {
          id: `user-${Date.now()}`,
          display_name: display_name.trim(),
          avatar_url: "",
          city: "",
          bio: "",
          onboarding_completed: false,
          created_at: new Date().toISOString(),
        };
        set({
          user: newUser,
          isLoggedIn: true,
          authLoading: false,
          followedArtistIds: [],
          showStatuses: {},
          roomMemberships: [],
          notifications: [],
          likedLivePostIds: [],
        });
      },

      logout: () => {
        // P10.1: logout 委托 clearAuth（保留兼容，生产路径由 AuthProvider 触发）
        useUserStore.getState().clearAuth();
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),

      followArtist: (artistId) =>
        set((state) => ({
          followedArtistIds: state.followedArtistIds.includes(artistId)
            ? state.followedArtistIds
            : [...state.followedArtistIds, artistId],
        })),

      unfollowArtist: (artistId) =>
        set((state) => ({
          followedArtistIds: state.followedArtistIds.filter((id) => id !== artistId),
        })),

      setFollowedArtistIds: (ids) =>
        set({ followedArtistIds: [...ids] }),

      setShowStatus: (showId, status) =>
        set((state) => ({
          showStatuses: { ...state.showStatuses, [showId]: status },
        })),

      removeShowStatus: (showId) =>
        set((state) => {
          const { [showId]: _, ...rest } = state.showStatuses;
          return { showStatuses: rest };
        }),

      joinRoom: (roomId) =>
        set((state) => {
          if (state.roomMemberships.some((m) => m.room_id === roomId)) return state;
          return {
            roomMemberships: [
              ...state.roomMemberships,
              {
                id: `rm-${Date.now()}`,
                user_id: state.user?.id ?? "guest",
                room_id: roomId,
                joined_at: new Date().toISOString(),
              },
            ],
          };
        }),

      leaveRoom: (roomId) =>
        set((state) => ({
          roomMemberships: state.roomMemberships.filter((m) => m.room_id !== roomId),
        })),

      setRoomMemberships: (memberships) =>
        set({ roomMemberships: [...memberships] }),

      // ===== P9 通知 actions =====
      addNotification: (notification) =>
        set((state) => {
          // 防重复：同 type + related_show_id/related_content_id（+来源用户）已存在则跳过。
          // 互动类通知（回复/点赞/评论/收藏/消息）按来源用户区分；
          // new_show/attended_check 无 from_user_id，退化为按演出去重。
          const exists = state.notifications.some(
            (n) =>
              n.type === notification.type &&
              n.related_show_id === notification.related_show_id &&
              n.related_content_id === notification.related_content_id &&
              n.from_user_id === notification.from_user_id
          );
          if (exists) return state;
          return {
            notifications: [notification, ...state.notifications],
          };
        }),

      markNotificationRead: (notificationId) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === notificationId ? { ...n, is_read: true } : n
          ),
        })),

      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        })),

      markNotificationsContentDeleted: (contentIds) =>
        set((state) => {
          if (contentIds.length === 0) return {};
          const idSet = new Set(contentIds);
          return {
            notifications: state.notifications.map((n) =>
              n.related_content_id && idSet.has(n.related_content_id)
                ? { ...n, is_content_deleted: true, is_read: true }
                : n
            ),
          };
        }),

      toggleLivePostLike: (postId) =>
        set((state) => ({
          likedLivePostIds: state.likedLivePostIds.includes(postId)
            ? state.likedLivePostIds.filter((id) => id !== postId)
            : [...state.likedLivePostIds, postId],
        })),
    }),
    {
      name: "gigroom-user-storage",
      partialize: (state) => ({
        user: state.user,
        isLoggedIn: state.isLoggedIn,
        followedArtistIds: state.followedArtistIds,
        showStatuses: state.showStatuses,
        roomMemberships: state.roomMemberships,
        notifications: state.notifications,
        likedLivePostIds: state.likedLivePostIds,
      }),
    }
  )
);

// P0-1: 登录期间业务数据变化时，自动更新按用户快照（follows/rooms 为 DB 缓存，
// showStatuses/notifications/likedLivePostIds 为 mock-only 持久层）
useUserStore.subscribe((state, prev) => {
  if (!state.isLoggedIn || !state.user) return;
  if (
    state.followedArtistIds !== prev.followedArtistIds ||
    state.showStatuses !== prev.showStatuses ||
    state.roomMemberships !== prev.roomMemberships ||
    state.notifications !== prev.notifications ||
    state.likedLivePostIds !== prev.likedLivePostIds
  ) {
    saveBusinessSnapshot(state.user.id, extractBusinessSnapshot(state));
  }
});
