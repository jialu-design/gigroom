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
    id: "notif-2",
    user_id: "user-1",
    type: NotificationType.ANNOUNCEMENT,
    title: "Chinese Football 上海站发布新公告：入场时间调整（DEMO）",
    related_show_id: "show-4",
    related_announcement_id: "ann-8",
    is_read: false,
    created_at: "2026-08-15T14:00:00Z",
  },
  {
    id: "notif-3",
    user_id: "user-1",
    type: NotificationType.ANNOUNCEMENT,
    title: "Carsick Cars 北京专场延期通知（DEMO）",
    related_show_id: "show-19",
    related_announcement_id: "ann-6",
    is_read: true,
    created_at: "2026-08-10T20:00:00Z",
  },
  {
    id: "notif-4",
    user_id: "user-1",
    type: NotificationType.ATTENDED_CHECK,
    title: "你去了 Chinese Football 武汉场吗？（DEMO）",
    related_show_id: "show-1",
    is_read: false,
    created_at: "2026-07-26T10:00:00Z",
  },
];

const delay = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));

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
  /** 添加通知（防重复：同 type + related_show_id + related_announcement_id 已存在则跳过） */
  addNotification: (notification: Notification) => void;
  /** 标记单条已读 */
  markNotificationRead: (notificationId: string) => void;
  /** 全部标记已读 */
  markAllNotificationsRead: () => void;
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

      // ===== P10.1 Auth snapshot actions =====
      setAuthUser: (user) =>
        set({
          user,
          isLoggedIn: !!user,
          authLoading: false,
        }),

      setAuthLoading: (loading) =>
        set({ authLoading: loading }),

      clearAuth: () => {
        useUIStore.getState().clearPendingAuthAction();
        set({
          user: null,
          isLoggedIn: false,
          authLoading: false,
          followedArtistIds: [],
          showStatuses: {},
          roomMemberships: [],
          notifications: [],
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
          // 防重复：同 type + related_show_id + related_announcement_id 已存在则跳过
          const exists = state.notifications.some(
            (n) =>
              n.type === notification.type &&
              n.related_show_id === notification.related_show_id &&
              n.related_announcement_id === notification.related_announcement_id
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
      }),
    }
  )
);
