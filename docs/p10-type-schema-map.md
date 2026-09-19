# P10 TypeScript ↔ 数据库 Schema 映射

## 概述

本文档对比 `src/lib/types/index.ts` 中的 TypeScript 类型与 `supabase/migrations/001_init.sql` 中的数据库表结构，标记差异和需要的 adapter。

## 映射表

### 1. User ↔ profiles

| TypeScript `User` | 数据库 `profiles` | 差异 |
|-------------------|------------------|------|
| `id: string` | `id uuid` | UUID → string，adapter 转换 |
| `display_name: string` | `display_name text` | 一致 |
| `avatar_url?: string` | `avatar_url text` (nullable) | 一致 |
| `city?: string` | `city text` (nullable) | 一致 |
| `bio?: string` | `bio text` (nullable) | 一致 |
| `onboarding_completed: boolean` | `onboarding_completed boolean` | 一致 |
| `created_at: string` | `created_at timestamptz` | ISO string ↔ timestamptz |
| — | `updated_at timestamptz` | TS 无此字段（不需要） |

**adapter 需求**：无特殊处理，UUID 和 timestamp 自动序列化为 string。

### 2. Artist ↔ artists

| TypeScript `Artist` | 数据库 `artists` | 差异 |
|---------------------|-----------------|------|
| `id: string` | `id uuid` | UUID → string |
| `name: string` | `name text` | 一致 |
| `cover_url?: string` | `cover_url text` | 一致 |
| `city?: string` | `city text` | 一致 |
| `country?: string` | `country text` | 一致 |
| `genres: string[]` | `genres text[]` | 一致 |
| `bio?: string` | `bio text` | 一致 |
| `external_links?: ArtistExternalLinks` | `external_links jsonb` | JSON ↔ jsonb，一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |

**adapter 需求**：无。

### 3. Venue ↔ venues

| TypeScript `Venue` | 数据库 `venues` | 差异 |
|--------------------|----------------|------|
| `id: string` | `id uuid` | UUID → string |
| `name: string` | `name text` | 一致 |
| `city: string` | `city text` | 一致 |
| `address?: string` | `address text` | 一致 |
| — | `created_at timestamptz` | TS 无此字段 |

**adapter 需求**：无。

### 4. Show ↔ shows

| TypeScript `Show` | 数据库 `shows` | 差异 |
|-------------------|---------------|------|
| `id: string` | `id uuid` | UUID → string |
| `title?: string` | `title text` | 一致 |
| `venue_id: string` | `venue_id uuid` (FK) | 一致 |
| `city: string` | `city text` | 一致 |
| `date_time: string` | `date_time timestamptz` | ISO ↔ timestamptz |
| `poster_url?: string` | `poster_url text` | 一致 |
| `price_presale?: number` | `price_presale numeric` | number ↔ numeric |
| `price_door?: number` | `price_door numeric` | number ↔ numeric |
| `price_text?: string` | `price_text text` | 一致 |
| `ticket_platform?: string` | `ticket_platform text` | 一致 |
| `ticket_url?: string` | `ticket_url text` | 一致 |
| `ticket_status?: ShowTicketStatus` | `ticket_status text` (CHECK) | 枚举值一致 |
| `status: ShowStatus` | `status text` (CHECK) | 枚举值一致 |
| `is_demo?: boolean` | `is_demo boolean` | 一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |
| — | `updated_at timestamptz` | TS 无 |
| `venue?: Venue` | — | 关联扩展（API join 返回） |
| `artists?: ShowArtist[]` | — | 关联扩展（API join 返回） |
| `interested_count?: number` | — | 聚合字段（API count 返回） |
| `going_count?: number` | — | 聚合字段（API count 返回） |

**adapter 需求**：`numeric` → `number` 转换；`venue` / `artists` / count 字段需 API 层 join 查询组装。

### 5. ShowArtist ↔ show_artists

| TypeScript `ShowArtist` | 数据库 `show_artists` | 差异 |
|------------------------|---------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `show_id: string` | `show_id uuid` (FK) | 一致 |
| `artist_id: string` | `artist_id uuid` (FK) | 一致 |
| `role: ArtistRole` | `role text` (CHECK) | 枚举值一致 |
| `billing_order: number` | `billing_order integer` | 一致 |
| `artist?: Artist` | — | 关联扩展（API join 返回） |

**adapter 需求**：无。

### 6. ShowRoom ↔ show_rooms

| TypeScript `ShowRoom` | 数据库 `show_rooms` | 差异 |
|----------------------|--------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `show_id: string` | `show_id uuid` UNIQUE | 一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |
| `member_count?: number` | — | 聚合字段（API count 返回） |
| `message_count?: number` | — | 聚合字段 |
| `buddy_post_count?: number` | — | 聚合字段 |
| `ticket_post_count?: number` | — | 聚合字段 |
| `live_post_count?: number` | — | 聚合字段 |

**adapter 需求**：count 字段需 API 层子查询组装。

### 7. RoomMembership ↔ room_memberships

| TypeScript `RoomMembership` | 数据库 `room_memberships` | 差异 |
|----------------------------|------------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `user_id: string` | `user_id uuid` (FK auth.users) | 一致 |
| `room_id: string` | `room_id uuid` (FK) | 一致 |
| `joined_at: string` | `joined_at timestamptz` | 一致 |

**adapter 需求**：无。`UNIQUE(user_id, room_id)` 约束保证防重复。

### 8. UserArtistFollow ↔ user_artist_follows

| TypeScript `UserArtistFollow` | 数据库 `user_artist_follows` | 差异 |
|------------------------------|----------------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `user_id: string` | `user_id uuid` | 一致 |
| `artist_id: string` | `artist_id uuid` | 一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |

**adapter 需求**：无。`UNIQUE(user_id, artist_id)` 保证防重复。

### 9. UserShowStatusRecord ↔ user_show_statuses

| TypeScript `UserShowStatusRecord` | 数据库 `user_show_statuses` | 差异 |
|----------------------------------|---------------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `user_id: string` | `user_id uuid` | 一致 |
| `show_id: string` | `show_id uuid` | 一致 |
| `status: UserShowStatus` | `status text` (CHECK) | 枚举值一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |
| `updated_at: string` | `updated_at timestamptz` | 一致 |

**adapter 需求**：无。`UNIQUE(user_id, show_id)` 保证单 status 模型。

### 10. Announcement ↔ announcements

| TypeScript `Announcement` | 数据库 `announcements` | 差异 |
|--------------------------|----------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `show_id: string` | `show_id uuid` (FK) | 一致 |
| `type: AnnouncementType` | `type text` (CHECK) | **⚠️ 值不同** |
| `title: string` | `title text` | 一致 |
| `content: string` | `content text` | 一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |

**⚠️ AnnouncementType 值映射**（中文 → 英文）：

| TypeScript enum key | TS value (中文) | DB CHECK value (英文) |
|---------------------|----------------|---------------------|
| `TICKET_SALE` | `"开票"` | `ticket_sale` |
| `SOLD_OUT` | `"售罄"` | `sold_out` |
| `EXTRA_SHOW` | `"加场"` | `extra_show` |
| `VENUE_CHANGE` | `"场地变更"` | `venue_change` |
| `TIME_CHANGE` | `"时间变更"` | `time_change` |
| `POSTPONED` | `"延期"` | `postponed` |
| `CANCELLED` | `"取消"` | `cancelled` |
| `GUEST_CHANGE` | `"嘉宾变化"` | `guest_change` |
| `ORGANIZER_NOTICE` | `"主办方公告"` | `organizer_notice` |

**adapter 需求**：API 层需要双向映射函数。

### 11. DiscussionMessage ↔ discussion_messages

| TypeScript `DiscussionMessage` | 数据库 `discussion_messages` | 差异 |
|-------------------------------|----------------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `room_id: string` | `room_id uuid` (FK) | 一致 |
| `user_id: string` | `user_id uuid` (FK) | 一致 |
| `content: string` | `content text` | 一致 |
| `reply_to_id?: string` | `reply_to_id uuid` (self-FK) | 一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |
| `user?: User` | — | 关联扩展 |
| `reply_to_user?: User` | — | 关联扩展 |

**adapter 需求**：关联扩展需 API 层 join。

### 12. BuddyPost ↔ buddy_posts

| TypeScript `BuddyPost` | 数据库 `buddy_posts` | 差异 |
|------------------------|--------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `show_id: string` | `show_id uuid` (FK) | 一致 |
| `user_id: string` | `user_id uuid` (FK) | 一致 |
| `content: string` | `content text` | 一致 |
| `tags: string[]` | `tags text[]` | 一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |
| `user?: User` | — | 关联扩展 |
| `comment_count?: number` | — | 聚合字段 |

**adapter 需求**：无。

### 13. TicketPost ↔ ticket_posts

| TypeScript `TicketPost` | 数据库 `ticket_posts` | 差异 |
|------------------------|--------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `show_id: string` | `show_id uuid` | 一致 |
| `user_id: string` | `user_id uuid` | 一致 |
| `type: TicketPostType` | `type text` (CHECK) | 枚举值一致 |
| `quantity: number` | `quantity integer` (CHECK > 0) | 一致 |
| `face_value?: number` | `face_value numeric` (CHECK >= 0) | number ↔ numeric |
| `price?: number` | `price numeric` (CHECK >= 0) | number ↔ numeric |
| `note?: string` | `note text` | 一致 |
| `status: TicketPostStatus` | `status text` (CHECK) | 枚举值一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |
| `updated_at?: string` | `updated_at timestamptz` | 一致 |
| `user?: User` | — | 关联扩展 |
| `comment_count?: number` | — | 聚合字段 |

**adapter 需求**：`numeric` → `number`。

### 14. LivePost ↔ live_posts

| TypeScript `LivePost` | 数据库 `live_posts` | 差异 |
|----------------------|--------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `show_id: string` | `show_id uuid` | 一致 |
| `user_id: string` | `user_id uuid` | 一致 |
| `content?: string` | `content text` | 一致 |
| `image_urls: string[]` | `image_urls text[]` | 一致 |
| `video_url?: string` | `video_url text` | 一致 |
| `video_platform?: VideoPlatform` | `video_platform text` (CHECK) | 枚举值一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |
| `user?: User` | — | 关联扩展 |

**adapter 需求**：无。

### 15. Notification ↔ notifications

| TypeScript `Notification` | 数据库 `notifications` | 差异 |
|--------------------------|----------------------|------|
| `id: string` | `id uuid` | UUID → string |
| `user_id: string` | `user_id uuid` | 一致 |
| `type: NotificationType` | `type text` (CHECK) | 枚举值一致 |
| `title: string` | `title text` | 一致 |
| `related_show_id?: string` | `related_show_id uuid` (nullable) | 一致 |
| `related_announcement_id?: string` | `related_announcement_id uuid` (nullable) | 一致 |
| `is_read: boolean` | `is_read boolean` | 一致 |
| `created_at: string` | `created_at timestamptz` | 一致 |
| `show?: Show` | — | 关联扩展 |
| `announcement?: Announcement` | — | 关联扩展 |

**adapter 需求**：无。防重复由 partial unique indexes 保证。

### 16. Report ↔ reports（TS 无类型）

| TypeScript | 数据库 `reports` | 差异 |
|-----------|----------------|------|
| **不存在** | `id uuid` | **P10 后续需新增 TS 类型** |
| — | `reporter_id uuid` | |
| — | `target_type text` (CHECK) | |
| — | `target_id uuid` | |
| — | `reason text` | |
| — | `details text` | |
| — | `created_at timestamptz` | |

**adapter 需求**：P10.x 需新增 `Report` TS interface。

## 总结

| 差异类型 | 数量 | 处理方式 |
|---------|------|---------|
| UUID ↔ string | 全部表 | Supabase JS SDK 自动序列化 |
| numeric ↔ number | shows, ticket_posts | API adapter 转换 |
| timestamptz ↔ string | 全部表 | Supabase JS SDK 自动序列化 |
| AnnouncementType 中文→英文 | announcements | **需要 adapter 双向映射** |
| 关联扩展字段 | Show, ShowRoom, DiscussionMessage 等 | API 层 join 查询组装 |
| 缺失 TS 类型 | Report | P10.x 新增 |
| is_demo 字段 | shows | 保留，P10 后逐步清理 |

**不需要现在修改 TypeScript 类型。** P10.x 接入 Supabase 时，在 `lib/api/` 层增加 adapter 函数处理差异即可。
