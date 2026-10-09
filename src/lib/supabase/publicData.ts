/**
 * Supabase 公共数据读取层（P10.2-A）
 *
 * 职责：
 * 1. 检测 Supabase 环境变量是否配置
 * 2. 集中提供 isSupabaseConfigured 标志
 * 3. 提供 typed from() helpers 给各 API 模块复用
 *
 * 设计原则：
 * - 公共读数据（artists/venues/shows/show_artists）在 env 已配置时
 *   走真实 Supabase；未配置时由各 API 模块自行 fallback 到 mock（保证测试/本地开发）
 * - 不偷偷 fallback：在 dev 环境 console.warn 明确提示
 * - UI 不感知：API 层完全屏蔽 Supabase vs Mock 的差异
 */
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { PostgrestQueryBuilder } from "@supabase/supabase-js";

/** 是否配置了 Supabase 环境变量（决定公共读数据是否走真实 Supabase） */
export function isSupabaseConfigured(): boolean {
  return (
    typeof process !== "undefined" &&
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * 公共读数据源覆盖开关（开发/演示用）：
 * 设 NEXT_PUBLIC_DATA_SOURCE=mock 时，公共读数据（shows/artists）
 * 强制走本地 mock，便于验证 mock 测试数据（如周边城市兜底）。
 * 不影响 Auth / 用户行为数据（profile/follows/rooms/messages 等仍按原逻辑走 Supabase）。
 */
export function isPublicDataMockForced(): boolean {
  return process.env.NEXT_PUBLIC_DATA_SOURCE === "mock";
}

/** 公共读数据是否启用 Supabase 读取（已配置 env 且未被 mock 覆盖） */
export function isPublicDataSupabaseEnabled(): boolean {
  return isSupabaseConfigured() && !isPublicDataMockForced();
}

/**
 * 用户行为数据是否启用 Supabase（rooms/messages/posts/follows/events 等）。
 * 与公共读使用同一个 mock 覆盖开关：NEXT_PUBLIC_DATA_SOURCE=mock 时，
 * 行为写入也强制走 mock fallback，避免 mock 字符串 ID（room-16/show-16）
 * 被写入 Supabase UUID 字段导致 "invalid input syntax for type uuid"。
 * 注意：profile.ts（身份同步）与 storage.ts（图片上传）不使用此开关，
 * 始终跟随 Supabase Auth 真实身份。
 */
export function isBehaviorSupabaseEnabled(): boolean {
  return isSupabaseConfigured() && !isPublicDataMockForced();
}

/**
 * 关注关系是否启用 Supabase 持久化（独立于 isBehaviorSupabaseEnabled）。
 *
 * V1 HR Demo：真实 Auth 用户关注 Mock 乐队（字符串 ID）写入
 * user_mock_artist_follows（artist_id text），不依赖 public.artists，
 * 因此 NEXT_PUBLIC_DATA_SOURCE=mock（公共读/其他行为走本地 Mock）
 * 不应关闭关注关系的云端持久化。
 * 仅在完全未配置 Supabase（本地开发 / CI）时回退本地 store。
 */
export function isFollowPersistenceEnabled(): boolean {
  return isSupabaseConfigured();
}

/**
 * 判定 artistId 是否为仓库内 Mock 乐队 ID（如 "artist-1"）。
 * 真实 Supabase artists 主键为 uuid；非 UUID 一律视为 Mock ID，
 * 关注关系路由到 user_mock_artist_follows（artist_id text）。
 */
export function isMockArtistId(artistId: string): boolean {
  return !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    artistId
  );
}

/** dev 环境未走 Supabase 时给出明确提示（不静默 fallback） */
export function warnSupabaseNotConfigured(domain: string): void {
  if (process.env.NODE_ENV === "development") {
    if (isPublicDataMockForced()) {
      console.warn(
        `[DataSource] ${domain} 数据按 NEXT_PUBLIC_DATA_SOURCE=mock 强制走本地 Mock。` +
          ` 移除该环境变量后将恢复走真实 Supabase。`
      );
    } else {
      console.warn(
        `[Supabase] ${domain} 数据回退到 Mock：缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY。` +
          ` 配置后公共读数据将自动走真实 Supabase。`
      );
    }
  }
}

// ============
// 公共读数据请求去重 + 短 TTL 缓存
// ============
//
// 背景：首页等客户端页面会在同一时刻并发触发多个相同的全量拉取请求
// （React StrictMode dev 双调用 effect + Zustand persist hydration 后
// useEffect 依赖引用变化导致重跑 + 多个 API 复用同一全量数据）。
// Supabase 区域延迟较高（单请求 1-3s），重复请求会让首屏长时间空白。
//
// 本工具对"无参数拉全量表、上层再 filter"的公共读请求做两件事：
// 1. in-flight 去重：同一时刻并发的多次调用共享同一个 Promise，只发 1 次网络请求
// 2. TTL 缓存：TTL 内的重复调用直接返回缓存，不再打网络
//
// 错误不缓存（允许下一次重试）。测试环境（NODE_ENV=test）TTL=0，
// 保留"每次调用都真实 fetch"的语义，仅去重并发 Promise。
const CACHE_TTL_MS = process.env.NODE_ENV === "test" ? 0 : 15_000;

/**
 * 公共读数据请求超时（ms）
 * 断网 / DNS 失败时 Supabase fetch 可能永不 settle，导致首页 loading 永远不结束。
 * 超时后 reject，由上层 API 的 catch 触发 mock fallback，保证页面一定能渲染。
 */
const FETCH_TIMEOUT_MS = process.env.NODE_ENV === "test" ? 5_000 : 8_000;

export interface TtlFetcher<T> {
  (): Promise<T>;
  /** 手动清空缓存（数据被外部变更后可调用，强制下次重新拉取） */
  reset(): void;
}

/** 给 Promise 加超时，超时后 reject（让上层 catch 走 mock fallback） */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Supabase fetch timeout (${ms}ms)`)), ms)
    ),
  ]);
}

export function createTtlFetcher<T>(fetcher: () => Promise<T>): TtlFetcher<T> {
  let inflight: Promise<T> | null = null;
  let cachedData: T | null = null;
  let cachedAt = 0;

  const run = (): Promise<T> => {
    // 命中有效缓存
    if (cachedData !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
      return Promise.resolve(cachedData);
    }
    // 已有进行中的请求 → 共享（去重 StrictMode / persist 重跑 / 多组件并发）
    if (inflight) {
      return inflight;
    }
    const promise = withTimeout(fetcher(), FETCH_TIMEOUT_MS)
      .then((data) => {
        cachedData = data;
        cachedAt = Date.now();
        inflight = null;
        return data;
      })
      .catch((err) => {
        // 失败不缓存、清空 inflight，允许下次重试
        inflight = null;
        throw err;
      });
    inflight = promise;
    return promise;
  };

  run.reset = () => {
    inflight = null;
    cachedData = null;
    cachedAt = 0;
  };

  return run;
}


// ============
// typed from() helpers（集中处理 postgrest-js 手写 schema 类型断言）
// ============

type Schema = Database["public"];
type GenericRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};

function makeTypedFrom<
  TName extends keyof Database["public"]["Tables"],
  TTable extends Database["public"]["Tables"][TName]
>(tableName: TName) {
  type QueryBuilder = PostgrestQueryBuilder<
    Record<string, unknown>,
    Schema,
    {
      Row: TTable["Row"];
      Insert: TTable["Insert"];
      Update: TTable["Update"];
      Relationships: GenericRelationship[];
    },
    TName & string
  >;
  return () => {
    const supabase = createClient();
    const raw = supabase.from(tableName as string);
    return raw as unknown as QueryBuilder;
  };
}

export const profilesFrom = makeTypedFrom("profiles");
export const artistsFrom = makeTypedFrom("artists");
export const venuesFrom = makeTypedFrom("venues");
export const showsFrom = makeTypedFrom("shows");
export const showArtistsFrom = makeTypedFrom("show_artists");
export const userArtistFollowsFrom = makeTypedFrom("user_artist_follows");
export const userMockArtistFollowsFrom = makeTypedFrom(
  "user_mock_artist_follows"
);
export const showRoomsFrom = makeTypedFrom("show_rooms");
export const roomMembershipsFrom = makeTypedFrom("room_memberships");
export const discussionMessagesFrom = makeTypedFrom("discussion_messages");
export const buddyPostsFrom = makeTypedFrom("buddy_posts");
export const buddyPostCommentsFrom = makeTypedFrom("buddy_post_comments");
export const ticketPostsFrom = makeTypedFrom("ticket_posts");
export const ticketPostCommentsFrom = makeTypedFrom("ticket_post_comments");
export const livePostsFrom = makeTypedFrom("live_posts");
export const userEventsFrom = makeTypedFrom("user_events");
export const ticketOwnershipsFrom = makeTypedFrom("ticket_ownerships");
export const companionRequestsFrom = makeTypedFrom("companion_requests");
export const ticketTransfersFrom = makeTypedFrom("ticket_transfers");
export const userReputationsFrom = makeTypedFrom("user_reputations");
export const reputationEventsFrom = makeTypedFrom("reputation_events");

// ============
// Adapter：DB Row → 前端类型
// ============

import type {
  User,
  Artist,
  Venue,
  Show,
  ShowArtist,
  ArtistExternalLinks,
  UserArtistFollow,
  ShowRoom,
  RoomMembership,
  DiscussionMessage,
  BuddyPost,
  BuddyPostComment,
  TicketPost,
  TicketPostComment,
  LivePost,
  VideoPlatform,
  UserEvent,
  TicketOwnership,
  CompanionRequest,
  TicketTransfer,
  ReputationEvent,
  UserReputation,
} from "@/lib/types";
import {
  ShowStatus,
  ShowTicketStatus,
  ArtistRole,
  TicketPostType,
  TicketPostStatus,
  EventType,
  TargetType,
  TicketOwnershipStatus,
  RoomStatus,
  CompanionType,
  CompanionStatus,
  TicketTransferStatus,
  ReputationEventType,
} from "@/lib/types";

type ArtistRow = Database["public"]["Tables"]["artists"]["Row"];
type VenueRow = Database["public"]["Tables"]["venues"]["Row"];
type ShowRow = Database["public"]["Tables"]["shows"]["Row"];
type ShowArtistRow = Database["public"]["Tables"]["show_artists"]["Row"];
type UserArtistFollowRow = Database["public"]["Tables"]["user_artist_follows"]["Row"];
type UserMockArtistFollowRow =
  Database["public"]["Tables"]["user_mock_artist_follows"]["Row"];
type ShowRoomRow = Database["public"]["Tables"]["show_rooms"]["Row"];
type RoomMembershipRow = Database["public"]["Tables"]["room_memberships"]["Row"];
type DiscussionMessageRow = Database["public"]["Tables"]["discussion_messages"]["Row"];
type BuddyPostRow = Database["public"]["Tables"]["buddy_posts"]["Row"];
type BuddyPostCommentRow = Database["public"]["Tables"]["buddy_post_comments"]["Row"];
type TicketPostRow = Database["public"]["Tables"]["ticket_posts"]["Row"];
type TicketPostCommentRow = Database["public"]["Tables"]["ticket_post_comments"]["Row"];
type LivePostRow = Database["public"]["Tables"]["live_posts"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type UserEventRow = Database["public"]["Tables"]["user_events"]["Row"];
type TicketOwnershipRow = Database["public"]["Tables"]["ticket_ownerships"]["Row"];
type CompanionRequestRow = Database["public"]["Tables"]["companion_requests"]["Row"];
type TicketTransferRow = Database["public"]["Tables"]["ticket_transfers"]["Row"];
type UserReputationRow = Database["public"]["Tables"]["user_reputations"]["Row"];
type ReputationEventRow = Database["public"]["Tables"]["reputation_events"]["Row"];

/** profiles DB row → 前端 User（仅保留核心展示字段） */
export function profileRowToUser(row: ProfileRow): User {
  return {
    id: row.id,
    display_name: row.display_name,
    avatar_url: row.avatar_url ?? undefined,
    city: row.city ?? undefined,
    bio: row.bio ?? undefined,
    onboarding_completed: row.onboarding_completed,
    created_at: row.created_at,
  };
}

/** artist DB row → 前端 Artist */
export function artistRowToArtist(row: ArtistRow): Artist {
  return {
    id: row.id,
    name: row.name,
    cover_url: row.cover_url ?? undefined,
    city: row.city ?? undefined,
    country: row.country ?? undefined,
    genres: row.genres ?? [],
    bio: row.bio ?? undefined,
    external_links: (row.external_links as ArtistExternalLinks | null) ?? undefined,
    created_at: row.created_at,
  };
}

/** venue DB row → 前端 Venue */
export function venueRowToVenue(row: VenueRow): Venue {
  return {
    id: row.id,
    name: row.name,
    city: row.city,
    address: row.address ?? undefined,
  };
}

/** show DB row → 前端 Show（不含 venue/artists 关联，需调用方注入） */
export function showRowToShow(row: ShowRow): Show {
  return {
    id: row.id,
    title: row.title ?? undefined,
    venue_id: row.venue_id ?? "",
    city: row.city,
    date_time: row.date_time,
    poster_url: row.poster_url ?? undefined,
    price_presale: row.price_presale ?? undefined,
    price_door: row.price_door ?? undefined,
    price_text: row.price_text ?? undefined,
    ticket_platform: row.ticket_platform ?? undefined,
    ticket_url: row.ticket_url ?? undefined,
    ticket_status: (row.ticket_status as ShowTicketStatus | null) ?? undefined,
    status: row.status as ShowStatus,
    is_demo: row.is_demo,
    created_at: row.created_at,
  };
}

/** show_artist DB row → 前端 ShowArtist（不含 artist 关联，需调用方注入） */
export function showArtistRowToShowArtist(row: ShowArtistRow): ShowArtist {
  return {
    id: row.id,
    show_id: row.show_id,
    artist_id: row.artist_id,
    role: row.role as ArtistRole,
    billing_order: row.billing_order,
  };
}

/** user_artist_follow DB row → 前端 UserArtistFollow */
export function followRowToFollow(row: UserArtistFollowRow): UserArtistFollow {
  return {
    id: row.id,
    user_id: row.user_id,
    artist_id: row.artist_id,
    created_at: row.created_at,
  };
}

/**
 * user_mock_artist_follow DB row → 前端 UserArtistFollow。
 * 该表无独立 id 列（复合主键 user_id+artist_id），合成稳定 id。
 */
export function mockFollowRowToFollow(
  row: UserMockArtistFollowRow
): UserArtistFollow {
  return {
    id: `${row.user_id}:${row.artist_id}`,
    user_id: row.user_id,
    artist_id: row.artist_id,
    created_at: row.created_at,
  };
}

/** show_rooms DB row → 前端 ShowRoom（count 字段保留 optional，Supabase 路径不返回） */
export function showRoomRowToShowRoom(row: ShowRoomRow): ShowRoom {
  return {
    id: row.id,
    show_id: row.show_id,
    created_at: row.created_at,
  };
}

/** room_memberships DB row → 前端 RoomMembership */
export function membershipRowToMembership(row: RoomMembershipRow): RoomMembership {
  return {
    id: row.id,
    user_id: row.user_id,
    room_id: row.room_id,
    joined_at: row.joined_at,
  };
}

/** discussion_messages DB row → 前端 DiscussionMessage（user/reply_to_user 由业务层补充） */
export function messageRowToMessage(row: DiscussionMessageRow): DiscussionMessage {
  return {
    id: row.id,
    room_id: row.room_id,
    user_id: row.user_id,
    content: row.content,
    reply_to_id: row.reply_to_id ?? undefined,
    created_at: row.created_at,
  };
}

// ============
// P10.3 社区帖子 Adapter
// ============

/** buddy_posts DB row → 前端 BuddyPost（user/comment_count 由业务层补充） */
export function buddyPostRowToBuddyPost(row: BuddyPostRow): BuddyPost {
  return {
    id: row.id,
    show_id: row.show_id,
    user_id: row.user_id,
    content: row.content,
    tags: row.tags ?? [],
    created_at: row.created_at,
  };
}

/** buddy_post_comments DB row → 前端 BuddyPostComment（user 由业务层补充） */
export function buddyPostCommentRowToBuddyPostComment(
  row: BuddyPostCommentRow
): BuddyPostComment {
  return {
    id: row.id,
    buddy_post_id: row.buddy_post_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
  };
}

/** ticket_posts DB row → 前端 TicketPost（user/comment_count 由业务层补充） */
export function ticketPostRowToTicketPost(row: TicketPostRow): TicketPost {
  return {
    id: row.id,
    show_id: row.show_id,
    user_id: row.user_id,
    type: row.type as TicketPostType,
    quantity: row.quantity,
    face_value: row.face_value ?? undefined,
    price: row.price ?? undefined,
    note: row.note ?? undefined,
    status: row.status as TicketPostStatus,
    created_at: row.created_at,
    updated_at: row.updated_at ?? undefined,
  };
}

/** ticket_post_comments DB row → 前端 TicketPostComment（user 由业务层补充） */
export function ticketPostCommentRowToTicketPostComment(
  row: TicketPostCommentRow
): TicketPostComment {
  return {
    id: row.id,
    ticket_post_id: row.ticket_post_id,
    user_id: row.user_id,
    content: row.content,
    created_at: row.created_at,
  };
}

/** live_posts DB row → 前端 LivePost（user 由业务层补充） */
export function livePostRowToLivePost(row: LivePostRow): LivePost {
  return {
    id: row.id,
    show_id: row.show_id,
    user_id: row.user_id,
    content: row.content ?? undefined,
    image_urls: row.image_urls ?? [],
    video_url: row.video_url ?? undefined,
    video_platform: (row.video_platform as VideoPlatform | null) ?? undefined,
    created_at: row.created_at,
  };
}

// ============
// P10.5 用户行为事件 Adapter
// ============

/** user_events DB row → 前端 UserEvent */
export function userEventRowToUserEvent(row: UserEventRow): UserEvent {
  return {
    id: row.id,
    user_id: row.user_id,
    event_type: row.event_type as EventType,
    target_type: row.target_type as TargetType,
    target_id: row.target_id,
    metadata: row.metadata,
    created_at: row.created_at,
  };
}

// ============
// P10.6 票务持有 Adapter
// ============

/** ticket_ownerships DB row → 前端 TicketOwnership */
export function ticketOwnershipRowToTicketOwnership(
  row: TicketOwnershipRow
): TicketOwnership {
  return {
    id: row.id,
    user_id: row.user_id,
    show_id: row.show_id,
    ticket_id: row.ticket_id,
    status: row.status as TicketOwnershipStatus,
    verified_at: row.verified_at,
    created_at: row.created_at,
  };
}

// ============
// P10.6.3 找搭子请求 Adapter
// ============

/** companion_requests DB row → 前端 CompanionRequest（user 由业务层补充） */
export function companionRequestRowToCompanionRequest(
  row: CompanionRequestRow
): CompanionRequest {
  return {
    id: row.id,
    user_id: row.user_id,
    show_id: row.show_id,
    type: row.type as CompanionType,
    content: row.content,
    status: row.status as CompanionStatus,
    created_at: row.created_at,
  };
}

// ============
// P10.6.4 官方转票 Adapter
// ============

/** ticket_transfers DB row → 前端 TicketTransfer（seller/buyer 由业务层补充） */
export function ticketTransferRowToTicketTransfer(
  row: TicketTransferRow
): TicketTransfer {
  return {
    id: row.id,
    ticket_id: row.ticket_id,
    seller_id: row.seller_id,
    buyer_id: row.buyer_id,
    original_price: row.original_price,
    transfer_price: row.transfer_price,
    status: row.status as TicketTransferStatus,
    created_at: row.created_at,
  };
}

// ============
// P10.7 用户信用 Adapter
// ============

/** user_reputations DB row → 前端 UserReputation */
export function userReputationRowToUserReputation(
  row: UserReputationRow
): UserReputation {
  return {
    user_id: row.user_id,
    total_score: row.total_score,
    transfer_count: row.transfer_count,
    companion_count: row.companion_count,
    attended_count: row.attended_count,
    updated_at: row.updated_at,
  };
}

/** reputation_events DB row → 前端 ReputationEvent */
export function reputationEventRowToReputationEvent(
  row: ReputationEventRow
): ReputationEvent {
  return {
    id: row.id,
    user_id: row.user_id,
    event_type: row.event_type as ReputationEventType,
    score_delta: row.score_delta,
    description: row.description,
    related_id: row.related_id,
    created_at: row.created_at,
  };
}
