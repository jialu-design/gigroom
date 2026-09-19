/**
 * GigRoom 核心数据类型定义
 * 严格按照 PRD 附录A：核心数据模型定义
 * 所有字段名与未来 Supabase 数据库表结构一致
 */

// ========================
// 枚举类型
// ========================

/** 演出生命周期状态（与售票状态独立） */
export enum ShowStatus {
  UPCOMING = "upcoming",     // 即将到来（未结束）
  ENDED = "ended",           // 已结束
  CANCELLED = "cancelled",   // 已取消
  POSTPONED = "postponed",   // 已延期
}

/** 演出售票状态（与演出生命周期独立） */
export enum ShowTicketStatus {
  COMING_SOON = "coming_soon", // 即将开票
  ON_SALE = "on_sale",         // 在售
  SOLD_OUT = "sold_out",       // 售罄
}

/** 出收票帖状态（活跃/已完成） */
export enum TicketPostStatus {
  ACTIVE = "active",
  COMPLETED = "completed",
}

/** 出收票帖类型 */
export enum TicketPostType {
  SELLING = "selling",
  BUYING = "buying",
}

/** 通知类型 */
export enum NotificationType {
  NEW_SHOW = "new_show",
  ANNOUNCEMENT = "announcement",
  ATTENDED_CHECK = "attended_check",
}

/** 用户对演出的状态 */
export enum UserShowStatus {
  INTERESTED = "interested",
  GOING = "going",
  ATTENDED = "attended",
}

/** 演出中乐队角色 */
export enum ArtistRole {
  HEADLINER = "headliner",
  SUPPORT = "support",
  GUEST = "guest",
}

/** 公告类型 */
export enum AnnouncementType {
  TICKET_SALE = "开票",
  SOLD_OUT = "售罄",
  EXTRA_SHOW = "加场",
  VENUE_CHANGE = "场地变更",
  TIME_CHANGE = "时间变更",
  POSTPONED = "延期",
  CANCELLED = "取消",
  GUEST_CHANGE = "嘉宾变化",
  ORGANIZER_NOTICE = "主办方公告",
}

/** 现场帖视频平台 */
export enum VideoPlatform {
  BILIBILI = "bilibili",
  XIAOHONGSHU = "xiaohongshu",
  DOUYIN = "douyin",
  YOUTUBE = "youtube",
}

// ========================
// 核心实体类型
// ========================

/** 用户 */
export interface User {
  id: string;
  display_name: string;
  avatar_url?: string;
  city?: string;
  bio?: string;
  onboarding_completed: boolean;
  created_at: string;
}

/** 乐队/艺人 */
export interface Artist {
  id: string;
  name: string;
  cover_url?: string;
  city?: string;
  country?: string;
  genres: string[];
  bio?: string;
  external_links?: ArtistExternalLinks;
  created_at: string;
}

/** 乐队外部链接 */
export interface ArtistExternalLinks {
  netease?: string; // 网易云音乐
  bandcamp?: string;
  spotify?: string;
  weibo?: string;
  instagram?: string;
}

/** 场地 */
export interface Venue {
  id: string;
  name: string;
  city: string;
  address?: string;
}

/** 演出 */
export interface Show {
  id: string;
  title?: string;
  venue_id: string;
  city: string;
  date_time: string; // ISO 8601
  poster_url?: string;
  price_presale?: number; // 预售票面价
  price_door?: number; // 现场票面价
  price_text?: string; // 自定义票价文案（如"80/100/120"）
  ticket_platform?: string; // 票务平台名称
  ticket_url?: string; // 购票链接
  ticket_status?: ShowTicketStatus; // 售票状态（coming_soon/on_sale/sold_out）
  status: ShowStatus; // 演出生命周期状态（upcoming/ended/cancelled/postponed）
  is_demo?: boolean; // 标记为 DEMO/MOCK 数据，UI 可据此显示提示
  created_at: string;
  // 关联扩展（API返回时携带）
  venue?: Venue;
  artists?: ShowArtist[];
  interested_count?: number;
  going_count?: number;
}

/** 演出-乐队关联 */
export interface ShowArtist {
  id: string;
  show_id: string;
  artist_id: string;
  role: ArtistRole; // headliner / support / guest
  billing_order: number; // 1 = headliner, 2+ = support 顺序
  // 关联扩展
  artist?: Artist;
}

/** 观演小屋 */
export interface ShowRoom {
  id: string;
  show_id: string;
  created_at: string;
  // P10.6.2: Room 生命周期状态（由演出状态 + 时间推导）
  room_status?: RoomStatus;
  // 关联扩展（API返回时携带）
  member_count?: number;
  message_count?: number;
  buddy_post_count?: number;
  ticket_post_count?: number;
  live_post_count?: number;
}

/** 房间成员 */
export interface RoomMembership {
  id: string;
  user_id: string;
  room_id: string;
  joined_at: string;
}

/** 用户关注乐队 */
export interface UserArtistFollow {
  id: string;
  user_id: string;
  artist_id: string;
  created_at: string;
}

/** 用户演出状态记录 */
export interface UserShowStatusRecord {
  id: string;
  user_id: string;
  show_id: string;
  status: UserShowStatus;
  created_at: string;
  updated_at: string;
}

// ========================
// 社区内容类型
// ========================

/** 演出公告 */
export interface Announcement {
  id: string;
  show_id: string;
  type: AnnouncementType;
  title: string;
  content: string;
  created_at: string;
}

/** 讨论消息 */
export interface DiscussionMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  reply_to_id?: string;
  created_at: string;
  // 关联扩展
  user?: User;
  reply_to_user?: User;
}

/** 找搭子帖 */
export interface BuddyPost {
  id: string;
  show_id: string;
  user_id: string;
  content: string;
  tags: string[]; // ['一起看演出','排队','吃饭','拼车'] 子集
  created_at: string;
  // 关联扩展
  user?: User;
  comment_count?: number;
}

/** 找搭子帖评论 */
export interface BuddyPostComment {
  id: string;
  buddy_post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // 关联扩展
  user?: User;
}

/** 出收票帖 */
export interface TicketPost {
  id: string;
  show_id: string;
  user_id: string;
  type: TicketPostType; // selling / buying
  quantity: number;
  face_value?: number; // 票面价
  price?: number; // 转让价
  note?: string;
  status: TicketPostStatus; // active / completed
  created_at: string;
  updated_at?: string;
  // 关联扩展
  user?: User;
  comment_count?: number;
}

/** 出收票帖评论 */
export interface TicketPostComment {
  id: string;
  ticket_post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  // 关联扩展
  user?: User;
}

/** 现场帖 */
export interface LivePost {
  id: string;
  show_id: string;
  user_id: string;
  content?: string;
  image_urls: string[];
  video_url?: string;
  video_platform?: VideoPlatform;
  created_at: string;
  // 关联扩展
  user?: User;
}

// ========================
// 通知类型
// ========================

/** 通知 */
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  related_show_id?: string;
  related_announcement_id?: string;
  is_read: boolean;
  created_at: string;
  // 关联扩展
  show?: Show;
  announcement?: Announcement;
}

// ========================
// API 查询/筛选类型
// ========================

/** 演出列表筛选参数 */
export interface ShowFilters {
  city?: string;
  status?: ShowStatus;
  ticket_status?: ShowTicketStatus;
  artist_id?: string;
  date_from?: string;
  date_to?: string;
  genre?: string;
  limit?: number;
  offset?: number;
}

/** 乐队列表筛选参数 */
export interface ArtistFilters {
  city?: string;
  genre?: string;
  /** 多风格筛选（OR 逻辑：命中任意一个即显示） */
  genres?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

/** API 返回分页结构 */
export interface PaginatedResult<T> {
  data: T[];
  total: number;
  has_more: boolean;
}

// ========================
// P10.5 用户行为事件类型
// ========================

/** 用户行为事件类型 */
export enum EventType {
  SHOW_VIEW = "show_view",
  SHOW_INTEREST = "show_interest",
  SHOW_ATTEND = "show_attend",
  ARTIST_FOLLOW = "artist_follow",
  ROOM_JOIN = "room_join",
  POST_CREATE = "post_create",
  COMMENT_CREATE = "comment_create",
  MESSAGE_SEND = "message_send",
  TICKET_PURCHASE = "ticket_purchase",
  TICKET_TRANSFER = "ticket_transfer",
  COMPANION_MATCH = "companion_match",
}

/** 事件目标类型 */
export enum TargetType {
  SHOW = "show",
  ARTIST = "artist",
  ROOM = "room",
  POST = "post",
  COMMENT = "comment",
  MESSAGE = "message",
}

/** 用户行为事件记录 */
export interface UserEvent {
  id: string;
  user_id: string;
  event_type: EventType;
  target_type: TargetType;
  target_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

/**
 * 用户兴趣画像（AI 推荐基础输入）
 * 由 getUserInterestProfile() 聚合计算得出
 */
export interface UserInterestProfile {
  favoriteArtists: string[];
  favoriteGenres: string[];
  attendedShows: string[];
  activeCommunities: string[];
  engagementScore: number;
}

// ========================
// P10.6 票务身份类型
// ========================

/** Room 生命周期状态 */
export enum RoomStatus {
  UPCOMING = "upcoming",
  ACTIVE = "active",
  ENDED = "ended",
  ARCHIVED = "archived",
}

/** 票务持有状态 */
export enum TicketOwnershipStatus {
  PENDING = "pending",
  VERIFIED = "verified",
  CANCELLED = "cancelled",
}

/** 票务持有记录 */
export interface TicketOwnership {
  id: string;
  user_id: string;
  show_id: string;
  ticket_id: string;
  status: TicketOwnershipStatus;
  verified_at: string | null;
  created_at: string;
}

// ========================
// P10.6.3 找搭子类型
// ========================

/** 找搭子请求类型 */
export enum CompanionType {
  COMPANION = "companion",
  CARPOOL = "carpool",
  HOTEL = "hotel",
  TICKET = "ticket",
}

/** 找搭子请求状态 */
export enum CompanionStatus {
  OPEN = "open",
  MATCHED = "matched",
  CLOSED = "closed",
}

/** 找搭子请求 */
export interface CompanionRequest {
  id: string;
  user_id: string;
  show_id: string;
  type: CompanionType;
  content: string;
  status: CompanionStatus;
  created_at: string;
  // 关联扩展（API 返回时携带）
  user?: User;
}

// ========================
// P10.6.4 官方转票类型
// ========================

/** 转票状态 */
export enum TicketTransferStatus {
  PENDING = "pending",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
}

/** 转票记录 */
export interface TicketTransfer {
  id: string;
  ticket_id: string;
  seller_id: string;
  buyer_id: string | null;
  original_price: number;
  transfer_price: number;
  status: TicketTransferStatus;
  created_at: string;
  // 关联扩展（API 返回时携带）
  seller?: User;
  buyer?: User;
}

// ========================
// P10.7 用户信用体系
// ========================

/** 信用事件类型 */
export enum ReputationEventType {
  TICKET_TRANSFER_COMPLETED = "ticket_transfer_completed",
  COMPANION_MATCHED = "companion_matched",
  SHOW_ATTENDED = "show_attended",
  POST_CREATED = "post_created",
  ROOM_JOINED = "room_joined",
  MANUAL_ADJUSTMENT = "manual_adjustment",
}

/** 信用分变动记录 */
export interface ReputationEvent {
  id: string;
  user_id: string;
  event_type: ReputationEventType;
  score_delta: number;
  description: string;
  related_id: string | null;
  created_at: string;
}

/** 用户信用汇总 */
export interface UserReputation {
  user_id: string;
  total_score: number;
  transfer_count: number;
  companion_count: number;
  attended_count: number;
  updated_at: string;
}

// ========================
// P10.8 推荐系统类型
// ========================

/** 推荐演出 */
export interface RecommendedShow {
  show: Show;
  score: number;
  reasons: string[];
}

/** 推荐同好 */
export interface RecommendedCompanion {
  user: User;
  score: number;
  reasons: string[];
  reputation: UserReputation;
}

/** 推荐社区 */
export interface RecommendedCommunity {
  room: ShowRoom;
  show: Show;
  score: number;
  reasons: string[];
}

/** 推荐评分明细 */
export interface RecommendationScoreBreakdown {
  musicInterest: number;   // 40%
  historicalBehavior: number; // 25%
  distanceMatch: number;   // 15%
  communityActivity: number; // 10%
  reputation: number;      // 10%
  total: number;
}
