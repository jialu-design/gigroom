# P10 数据边界审计报告

## 1. 当前数据来源

GigRoom 当前完全依赖 Mock 数据，分布在 `src/mocks/` 目录：

| Mock 文件 | 内容 | 被引用位置 |
|-----------|------|-----------|
| `mocks/users.ts` | mockCurrentUser | useUserStore, api/user.ts |
| `mocks/artists.ts` | artistMap, mockArtists | api/artists.ts, app/artists, app/artist/[id], app/profile, app/rooms |
| `mocks/shows.ts` | showMap, mockShows, mockShowRooms | api/shows.ts, api/rooms.ts, api/announcements.ts, api/notifications.ts, app/show/[id], app/shows, app/page, app/profile, app/rooms |
| `mocks/announcements.ts` | mockAnnouncements | api/announcements.ts, api/notifications.ts |
| `mocks/messages.ts` | mockDiscussionMessages | api/messages.ts |
| `mocks/buddyPosts.ts` | mockBuddyPosts, mockBuddyPostComments | api/posts/buddyPosts.ts |
| `mocks/ticketPosts.ts` | mockTicketPosts, mockTicketPostComments | api/posts/ticketPosts.ts |
| `mocks/livePosts.ts` | mockLivePosts | api/posts/livePosts.ts |

## 2. Zustand 当前职责

`useUserStore` 同时承担三个职责：

| 职责 | 字段 | P10 后归属 |
|------|------|-----------|
| Auth/session | `user`, `isLoggedIn`, `authLoading` | Supabase Auth session snapshot |
| 业务数据 | `followedArtistIds`, `showStatuses`, `roomMemberships`, `notifications` | Supabase 查询（Zustand 仅缓存） |
| Actions | `followArtist`, `unfollowArtist`, `setShowStatus`, `joinRoom`, `leaveRoom`, `addNotification`, `markNotificationRead` 等 | lib/api → Supabase mutation |

`useUIStore` 负责纯 UI 状态（Modal 开关、pendingAuthAction），P10 后保持不变。

`useCityStore` 负责当前选中城市，P10 后保持不变（纯客户端 UI 状态）。

## 3. UI 直接访问 Mock 的位置

### app/ 页面直接 import mock（8 处）

| 文件 | 导入内容 |
|------|---------|
| `src/app/page.tsx` | `@/mocks/shows` (showMap, mockShows) |
| `src/app/shows/page.tsx` | `@/mocks/shows` |
| `src/app/show/[id]/page.tsx` | `@/mocks/shows` (showMap) |
| `src/app/artists/page.tsx` | `@/mocks/artists` (artistMap, mockArtists) |
| `src/app/artist/[id]/page.tsx` | `@/mocks/artists` (artistMap) |
| `src/app/profile/page.tsx` | `@/mocks/shows` + `@/mocks/artists` |
| `src/app/rooms/page.tsx` | `@/mocks/shows` (showMap, mockShowRooms) |
| `src/app/notifications/page.tsx` | 无直接 mock import（通过 store） |

### lib/api/ 层直接 import mock（10 处）

| 文件 | 导入内容 |
|------|---------|
| `src/lib/api/user.ts` | `@/mocks/users` |
| `src/lib/api/artists.ts` | `@/mocks/artists` |
| `src/lib/api/shows.ts` | `@/mocks/shows` |
| `src/lib/api/rooms.ts` | `@/mocks/shows` |
| `src/lib/api/announcements.ts` | `@/mocks/announcements` |
| `src/lib/api/messages.ts` | `@/mocks/messages` |
| `src/lib/api/notifications.ts` | `@/mocks/shows`, `@/mocks/announcements`, `@/mocks/shows` (mockShowRooms) |
| `src/lib/api/posts/buddyPosts.ts` | `@/mocks/buddyPosts` |
| `src/lib/api/posts/ticketPosts.ts` | `@/mocks/ticketPosts` |
| `src/lib/api/posts/livePosts.ts` | `@/mocks/livePosts` |

## 4. UI 直接 mutation Store 的位置

### 组件直接调用 store mutation（6 处）

| 组件 | 调用的 mutation |
|------|----------------|
| `FollowButton.tsx` | `followArtist`, `unfollowArtist` |
| `EditProfileModal.tsx` | `updateUser` |
| `OnboardingModal.tsx` | `updateUser` |
| `NotificationItem.tsx` | 通过 api/notifications → store (markNotificationRead, answerAttendedCheckYes/No) |
| `ShowHero.tsx` | 通过 api → store (setShowStatus, removeShowStatus) |
| `ShowRoomFrame.tsx` | 通过 api → store (joinRoom, leaveRoom) |

### lib/api/ 层直接 mutation store（3 处）

| 文件 | 调用的 mutation |
|------|----------------|
| `src/lib/api/notifications.ts` | `addNotification`, `markNotificationRead`, `markAllNotificationsRead`, `setShowStatus`, `removeShowStatus` |
| `src/lib/api/user.ts` | `useUserStore.getState()` 读写 |
| `src/lib/api/rooms.ts` | `joinRoom`, `leaveRoom` |

## 5. API 层现状

### 已存在的 API 模块（10 个）

| 模块 | 存在 | 直接 import mock | 接口可原签名替换 Supabase |
|------|------|-----------------|------------------------|
| `lib/api/user.ts` | ✅ | ✅ | ✅ |
| `lib/api/artists.ts` | ✅ | ✅ | ✅ |
| `lib/api/shows.ts` | ✅ | ✅ | ✅ |
| `lib/api/rooms.ts` | ✅ | ✅ | ✅ |
| `lib/api/announcements.ts` | ✅ | ✅ | ✅ |
| `lib/api/messages.ts` | ✅ | ✅ | ✅ |
| `lib/api/notifications.ts` | ✅ | ✅ | ✅ |
| `lib/api/posts/buddyPosts.ts` | ✅ | ✅ | ✅ |
| `lib/api/posts/ticketPosts.ts` | ✅ | ✅ | ✅ |
| `lib/api/posts/livePosts.ts` | ✅ | ✅ | ✅ |

### UI 绕过 API 的位置

Profile 和 Rooms 页面直接 import `showMap`/`artistMap`/`mockShowRooms` 用于派生映射，绕过了 `lib/api/` 层。这是 P8 引入的技术债。

## 6. P10 后理想数据流

```
UI (Components / Pages)
    ↓
Hooks / lib/api/*
    ↓
Supabase Client (client.ts / server.ts)
    ↓
PostgreSQL (RLS 保护)
```

### Zustand 后续职责

| 保留 | 迁移到 Supabase |
|------|----------------|
| `useUIStore`（Modal 开关、pendingAuthAction） | `followedArtistIds` |
| `useCityStore`（当前城市） | `showStatuses` |
| `useUserStore.user`（auth session snapshot） | `roomMemberships` |
| 少量客户端临时状态 | `notifications` |

## 7. 需要逐步迁移的位置

### 优先级 P10.1（Auth + 核心数据）

1. `useUserStore` → 替换 mockLogin/loginWithCredentials 为 Supabase Auth
2. `lib/api/user.ts` → 从 profiles 表查询
3. `lib/api/artists.ts` → 从 artists 表查询
4. `lib/api/shows.ts` → 从 shows + show_artists + venues 查询

### 优先级 P10.2（业务状态）

5. `followArtist` / `unfollowArtist` → user_artist_follows 表
6. `setShowStatus` / `removeShowStatus` → user_show_statuses 表
7. `joinRoom` / `leaveRoom` → room_memberships 表

### 优先级 P10.3（社区内容）

8. `lib/api/messages.ts` → discussion_messages 表
9. `lib/api/posts/*` → buddy_posts / ticket_posts / live_posts 表

### 优先级 P10.4（通知）

10. `lib/api/notifications.ts` → notifications 表（含 server-side 生成）

## 8. 高风险位置

| 风险 | 描述 | 缓解方案 |
|------|------|---------|
| Profile/Rooms 直接 import mock | P8 引入的 showMap/artistMap 直接引用 | P10.2 迁移时改为通过 API 层 |
| notifications.ts 依赖多个 mock | 生成函数直接读 showMap/mockAnnouncements/mockShowRooms | P10.4 时改为 Supabase 查询 |
| useUserStore 混合职责 | Auth + 业务数据 + Actions 在同一 store | P10.1 拆分 auth session 与业务缓存 |
| AnnouncementType 中文值 | TS enum 用中文（"开票"），DB 用英文（ticket_sale） | API adapter 层做映射 |
| Show.is_demo 字段 | TS 有 is_demo，DB 也有，但 Supabase 数据可能不需要 | 保留字段，P10 后逐步清理 mock 标记 |
