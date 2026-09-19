/**
 * API 抽象层 - 推荐与同好匹配系统（P10.8）
 *
 * 基于 P10.5 用户行为数据 + P10.7 用户信誉体系，实现 Gigroom 第一版推荐能力。
 *
 * 推荐逻辑（规则推荐，不引入 AI 模型）：
 *
 * 演出推荐依据：
 * - 关注艺人（40% 音乐兴趣）
 * - 历史参加演出（25% 历史行为）
 * - 浏览记录（SHOW_VIEW 事件）
 * - 用户互动行为
 * - 城市匹配（15% 距离匹配）
 *
 * 同好匹配依据：
 * - 共同喜欢艺人
 * - 共同参加演出
 * - 音乐兴趣相似
 * - 用户信誉分（10%）
 *
 * 评分权重：
 * - 音乐兴趣 40%
 * - 历史行为 25%
 * - 距离匹配 15%
 * - 社区活跃 10%
 * - 信誉分 10%
 *
 * 架构：纯计算层，复用现有 API（follows, shows, user, events, reputation, rooms, companions）
 * 不直接访问 Supabase，通过 lib/api 层获取数据
 */
import type {
  Show,
  User,
  UserInterestProfile,
  RecommendedShow,
  RecommendedCompanion,
  RecommendedCommunity,
  RecommendationScoreBreakdown,
} from "@/lib/types";
import { ShowStatus, EventType, UserShowStatus } from "@/lib/types";
import { getShows } from "@/lib/api/shows";
import { getFollowedArtists } from "@/lib/api/follows";
import { getUserShowStatuses } from "@/lib/api/user";
import { getUserEvents } from "@/lib/api/events";
import { getUserInterestProfile } from "@/lib/api/events";
import { getUserReputation } from "@/lib/api/reputation";
import { getRoomsByUser } from "@/lib/api/rooms";
import { getRoomByShow } from "@/lib/api/rooms";
import { getCompanionRequests } from "@/lib/api/companions";
import { getProfile } from "@/lib/api/profile";
import { useUserStore } from "@/lib/stores/useUserStore";

const delay = <T>(data: T, ms = 100): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ============
// 评分权重常量
// ============

const WEIGHTS = {
  MUSIC_INTEREST: 0.40,    // 40%
  HISTORICAL_BEHAVIOR: 0.25, // 25%
  DISTANCE_MATCH: 0.15,    // 15%
  COMMUNITY_ACTIVITY: 0.10, // 10%
  REPUTATION: 0.10,        // 10%
} as const;

// ============
// 核心评分函数
// ============

/**
 * 计算推荐评分明细
 *
 * 输入各项 0-100 的子分数，返回加权总分和明细
 */
export function calculateRecommendationScore(
  musicInterestScore: number,
  historicalBehaviorScore: number,
  distanceMatchScore: number,
  communityActivityScore: number,
  reputationScore: number
): RecommendationScoreBreakdown {
  const total =
    musicInterestScore * WEIGHTS.MUSIC_INTEREST +
    historicalBehaviorScore * WEIGHTS.HISTORICAL_BEHAVIOR +
    distanceMatchScore * WEIGHTS.DISTANCE_MATCH +
    communityActivityScore * WEIGHTS.COMMUNITY_ACTIVITY +
    reputationScore * WEIGHTS.REPUTATION;

  return {
    musicInterest: Math.round(musicInterestScore * WEIGHTS.MUSIC_INTEREST * 100) / 100,
    historicalBehavior: Math.round(historicalBehaviorScore * WEIGHTS.HISTORICAL_BEHAVIOR * 100) / 100,
    distanceMatch: Math.round(distanceMatchScore * WEIGHTS.DISTANCE_MATCH * 100) / 100,
    communityActivity: Math.round(communityActivityScore * WEIGHTS.COMMUNITY_ACTIVITY * 100) / 100,
    reputation: Math.round(reputationScore * WEIGHTS.REPUTATION * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

// ============
// 演出推荐
// ============

/**
 * 获取推荐演出列表
 *
 * 推荐逻辑：
 * 1. 获取所有 UPCOMING 演出
 * 2. 获取用户关注艺人、历史参加演出、浏览记录、用户画像
 * 3. 对每场演出计算推荐评分
 * 4. 按评分降序排列
 *
 * @param userId 用户 ID
 * @param limit  返回数量（默认 10）
 */
export async function getRecommendedShows(
  userId: string,
  limit = 10
): Promise<RecommendedShow[]> {
  // 并行获取所有数据源
  const [showsResult, followedArtists, showStatuses, events, interestProfile] = await Promise.all([
    getShows().catch(() => ({ data: [] as Show[], total: 0, has_more: false })),
    getFollowedArtists(userId).catch(() => []),
    getUserShowStatuses(userId).catch(() => []),
    getUserEvents(userId).catch(() => []),
    getUserInterestProfile(userId).catch((): UserInterestProfile => ({
      favoriteArtists: [],
      favoriteGenres: [],
      attendedShows: [],
      activeCommunities: [],
      engagementScore: 0,
    })),
  ]);

  // 只推荐 UPCOMING 演出
  const upcomingShows = (showsResult.data ?? []).filter(
    (s: Show) => s.status === ShowStatus.UPCOMING
  );

  // 用户已关注的艺人 ID 集合
  const followedArtistIds = new Set(followedArtists.map((a) => a.id));
  // 用户关注的风格集合
  const favoriteGenres = new Set(interestProfile.favoriteGenres);
  // 用户已参加的演出 ID 集合
  const attendedShowIds = new Set(
    showStatuses
      .filter((s) => s.status === UserShowStatus.ATTENDED || s.status === UserShowStatus.GOING)
      .map((s) => s.show_id)
  );
  // 用户浏览过的演出 ID 集合
  const viewedShowIds = new Set(
    events
      .filter((e) => e.event_type === EventType.SHOW_VIEW)
      .map((e) => e.target_id)
  );

  // 用户信誉分（用于信誉子分）
  const reputation = await getUserReputation(userId).catch(() => ({
    user_id: userId,
    total_score: 0,
    transfer_count: 0,
    companion_count: 0,
    attended_count: 0,
    updated_at: new Date().toISOString(),
  }));
  const reputationScore = Math.min(100, reputation.total_score);

  // 用户城市（从 store 获取）
  const userCity = useUserStore.getState().user?.city;

  const results: RecommendedShow[] = [];

  for (const show of upcomingShows) {
    const reasons: string[] = [];
    let musicScore = 0;
    let historyScore = 0;
    let distanceScore = 0;
    let communityScore = 0;

    // 1. 音乐兴趣评分（40%）
    const showArtistIds = (show.artists ?? []).map((sa) => sa.artist_id);
    const matchedArtists = showArtistIds.filter((id) => followedArtistIds.has(id));
    if (matchedArtists.length > 0) {
      musicScore += 60;
      reasons.push(`关注艺人参与`);
    }
    // 风格匹配
    const showGenres = (show.artists ?? []).flatMap((sa) => sa.artist?.genres ?? []);
    const matchedGenres = showGenres.filter((g) => favoriteGenres.has(g));
    if (matchedGenres.length > 0) {
      musicScore += 40;
      reasons.push(`音乐风格匹配`);
    }
    musicScore = Math.min(100, musicScore);

    // 2. 历史行为评分（25%）
    // 浏览过的演出加分
    if (viewedShowIds.has(show.id)) {
      historyScore += 30;
    }
    // 同艺人历史参加
    const attendedArtistIds = new Set(
      showStatuses
        .filter((s) => s.status === UserShowStatus.ATTENDED)
        .flatMap((s) => s.show_id)
    );
    // 如果用户参加过同艺人的演出
    for (const artistId of showArtistIds) {
      // 简化判断：如果有浏览记录或参加历史
      if (attendedShowIds.size > 0) {
        historyScore += 40;
        reasons.push(`有历史观演记录`);
        break;
      }
    }
    // engagementScore 影响
    historyScore += Math.min(30, interestProfile.engagementScore * 0.3);
    historyScore = Math.min(100, historyScore);

    // 3. 距离匹配评分（15%）
    if (userCity && show.city === userCity) {
      distanceScore = 100;
      reasons.push(`同城演出`);
    } else if (userCity) {
      distanceScore = 20;
    } else {
      distanceScore = 50; // 未知城市给中等分
    }

    // 4. 社区活跃评分（10%）
    if (interestProfile.activeCommunities.includes(show.id)) {
      communityScore = 100;
      reasons.push(`已加入社区`);
    } else {
      communityScore = 30;
    }

    // 5. 信誉分（10%）— 直接使用用户信誉分
    const breakdown = calculateRecommendationScore(
      musicScore,
      historyScore,
      distanceScore,
      communityScore,
      reputationScore
    );

    results.push({
      show,
      score: breakdown.total,
      reasons,
    });
  }

  // 按评分降序排列，取前 limit 条
  results.sort((a, b) => b.score - a.score);
  return delay(results.slice(0, limit));
}

// ============
// 同好匹配
// ============

/**
 * 获取推荐同好
 *
 * 推荐逻辑：
 * 1. 获取某场演出的找搭子请求
 * 2. 对每个请求者计算与当前用户的匹配度
 * 3. 匹配依据：共同喜欢艺人、共同参加演出、音乐兴趣相似、信誉分
 *
 * @param userId  当前用户 ID
 * @param showId  演出 ID
 * @param limit   返回数量（默认 10）
 */
export async function getRecommendedCompanions(
  userId: string,
  showId: string,
  limit = 10
): Promise<RecommendedCompanion[]> {
  // 获取该演出的找搭子请求
  const companionRequests = await getCompanionRequests(showId).catch(() => []);

  // 获取当前用户的兴趣画像
  const myProfile = await getUserInterestProfile(userId).catch((): UserInterestProfile => ({
    favoriteArtists: [],
    favoriteGenres: [],
    attendedShows: [],
    activeCommunities: [],
    engagementScore: 0,
  }));
  const myArtistIds = new Set(myProfile.favoriteArtists);
  const myGenres = new Set(myProfile.favoriteGenres);
  const myAttendedShows = new Set(myProfile.attendedShows);

  const results: RecommendedCompanion[] = [];

  for (const request of companionRequests) {
    // 跳过自己的请求
    if (request.user_id === userId) continue;

    // 获取对方用户信息和画像
    const [otherUser, otherProfile, otherReputation] = await Promise.all([
      getProfile(request.user_id).catch(() => null),
      getUserInterestProfile(request.user_id).catch((): UserInterestProfile => ({
        favoriteArtists: [],
        favoriteGenres: [],
        attendedShows: [],
        activeCommunities: [],
        engagementScore: 0,
      })),
      getUserReputation(request.user_id).catch(() => ({
        user_id: request.user_id,
        total_score: 0,
        transfer_count: 0,
        companion_count: 0,
        attended_count: 0,
        updated_at: new Date().toISOString(),
      })),
    ]);

    if (!otherUser) continue;

    const reasons: string[] = [];
    let musicScore = 0;
    let historyScore = 0;
    let distanceScore = 50;
    let communityScore = 30;
    let reputationScore = Math.min(100, otherReputation.total_score);

    // 1. 音乐兴趣匹配（共同艺人 + 共同风格）
    const otherArtistIds = new Set(otherProfile.favoriteArtists);
    const commonArtists = Array.from(myArtistIds).filter((id) => otherArtistIds.has(id));
    if (commonArtists.length > 0) {
      musicScore += 60;
      reasons.push(`共同喜欢 ${commonArtists.length} 位艺人`);
    }

    const otherGenres = new Set(otherProfile.favoriteGenres);
    const commonGenres = Array.from(myGenres).filter((g) => otherGenres.has(g));
    if (commonGenres.length > 0) {
      musicScore += 40;
      reasons.push(`共同音乐风格`);
    }
    musicScore = Math.min(100, musicScore);

    // 2. 历史行为（共同参加演出）
    const otherAttendedShows = new Set(otherProfile.attendedShows);
    const commonShows = Array.from(myAttendedShows).filter((id) => otherAttendedShows.has(id));
    if (commonShows.length > 0) {
      historyScore = Math.min(100, commonShows.length * 30);
      reasons.push(`共同参加 ${commonShows.length} 场演出`);
    } else {
      historyScore = 20;
    }

    // 3. 距离匹配 — 城市匹配
    const myCity = useUserStore.getState().user?.city;
    if (myCity && otherUser.city === myCity) {
      distanceScore = 100;
      reasons.push(`同城`);
    } else if (myCity) {
      distanceScore = 20;
    }

    // 4. 社区活跃
    if (otherProfile.activeCommunities.length > 0) {
      communityScore = Math.min(100, otherProfile.activeCommunities.length * 25);
    }

    // 5. 信誉分
    if (otherReputation.total_score > 0) {
      reasons.push(`信誉分 ${otherReputation.total_score}`);
    }

    const breakdown = calculateRecommendationScore(
      musicScore,
      historyScore,
      distanceScore,
      communityScore,
      reputationScore
    );

    results.push({
      user: otherUser,
      score: breakdown.total,
      reasons,
      reputation: otherReputation,
    });
  }

  // 按评分降序
  results.sort((a, b) => b.score - a.score);
  return delay(results.slice(0, limit));
}

// ============
// 社区推荐
// ============

/**
 * 获取推荐社区
 *
 * 推荐逻辑：
 * 1. 获取用户已加入的社区对应的演出
 * 2. 获取 UPCOMING 演出中用户未加入的社区
 * 3. 基于关注艺人 + 城市匹配评分
 *
 * @param userId 用户 ID
 * @param limit  返回数量（默认 5）
 */
export async function getRecommendedCommunities(
  userId: string,
  limit = 5
): Promise<RecommendedCommunity[]> {
  // 并行获取数据
  const [showsResult, followedArtists, userRooms, interestProfile] = await Promise.all([
    getShows().catch(() => ({ data: [] as Show[], total: 0, has_more: false })),
    getFollowedArtists(userId).catch(() => []),
    getRoomsByUser(userId).catch(() => []),
    getUserInterestProfile(userId).catch((): UserInterestProfile => ({
      favoriteArtists: [],
      favoriteGenres: [],
      attendedShows: [],
      activeCommunities: [],
      engagementScore: 0,
    })),
  ]);

  const followedArtistIds = new Set(followedArtists.map((a) => a.id));
  const userCity = useUserStore.getState().user?.city;
  // 用户已加入社区的 show_id 集合
  const joinedShowIds = new Set(userRooms.map((r) => r.show_id));

  const reputation = await getUserReputation(userId).catch(() => ({
    user_id: userId,
    total_score: 0,
    transfer_count: 0,
    companion_count: 0,
    attended_count: 0,
    updated_at: new Date().toISOString(),
  }));

  const results: RecommendedCommunity[] = [];

  // 对 UPCOMING 演出中未加入的社区评分
  const upcomingShows = (showsResult.data ?? []).filter(
    (s: Show) => s.status === ShowStatus.UPCOMING && !joinedShowIds.has(s.id)
  );

  for (const show of upcomingShows) {
    const room = await getRoomByShow(show.id).catch(() => null);
    if (!room) continue;

    const reasons: string[] = [];
    let musicScore = 0;
    let historyScore = 0;
    let distanceScore = 0;
    let communityScore = 30;

    // 音乐兴趣
    const showArtistIds = (show.artists ?? []).map((sa) => sa.artist_id);
    const matchedArtists = showArtistIds.filter((id) => followedArtistIds.has(id));
    if (matchedArtists.length > 0) {
      musicScore = 80;
      reasons.push(`关注艺人社区`);
    } else {
      musicScore = 30;
    }

    // 历史行为
    if (interestProfile.attendedShows.length > 0) {
      historyScore = 50;
    }

    // 距离
    if (userCity && show.city === userCity) {
      distanceScore = 100;
      reasons.push(`同城社区`);
    } else {
      distanceScore = 30;
    }

    // 社区活跃 — 已有人加入的社区更活跃
    communityScore = 50;

    const reputationScore = Math.min(100, reputation.total_score);

    const breakdown = calculateRecommendationScore(
      musicScore,
      historyScore,
      distanceScore,
      communityScore,
      reputationScore
    );

    results.push({
      room,
      show,
      score: breakdown.total,
      reasons,
    });
  }

  results.sort((a, b) => b.score - a.score);
  return delay(results.slice(0, limit));
}
