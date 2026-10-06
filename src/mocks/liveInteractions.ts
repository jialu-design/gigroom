/**
 * DEMO/MOCK 数据 - 现场帖互动（P5）
 * ⚠️ 全部为 demo 虚构数据。
 * 点赞基数来自 mockLivePostLikes（其他用户）；当前用户点赞态存 useUserStore.likedLivePostIds（持久化）
 */
import type { LivePostLike, LivePostComment } from "@/lib/types";
import { userMap } from "./users";

const u = (id: string) => userMap.get(id);

export const mockLivePostLikes: LivePostLike[] = [
  // lp-1（user-5 的帖子）：3 个赞
  { id: "ll-1", live_post_id: "lp-1", user_id: "user-1", created_at: "2026-07-26T10:00:00Z" },
  { id: "ll-2", live_post_id: "lp-1", user_id: "user-2", created_at: "2026-07-26T10:05:00Z" },
  { id: "ll-3", live_post_id: "lp-1", user_id: "user-3", created_at: "2026-07-26T11:00:00Z" },
  // lp-2（user-3 的帖子）：2 个赞
  { id: "ll-4", live_post_id: "lp-2", user_id: "user-4", created_at: "2026-07-26T16:00:00Z" },
  { id: "ll-5", live_post_id: "lp-2", user_id: "user-5", created_at: "2026-07-26T17:00:00Z" },
  // lp-6（user-2 的帖子）：4 个赞
  { id: "ll-6", live_post_id: "lp-6", user_id: "user-1", created_at: "2026-08-03T11:00:00Z" },
  { id: "ll-7", live_post_id: "lp-6", user_id: "user-3", created_at: "2026-08-03T11:30:00Z" },
  { id: "ll-8", live_post_id: "lp-6", user_id: "user-4", created_at: "2026-08-03T12:00:00Z" },
  { id: "ll-9", live_post_id: "lp-6", user_id: "user-5", created_at: "2026-08-03T13:00:00Z" },
  // lp-8（user-1 的帖子）：1 个赞
  { id: "ll-10", live_post_id: "lp-8", user_id: "user-2", created_at: "2026-08-03T21:00:00Z" },
];

export const mockLivePostComments: LivePostComment[] = [
  {
    id: "lc-1",
    live_post_id: "lp-1",
    user_id: "user-2",
    user: u("user-2"),
    content: "太羡慕了，求歌单",
    created_at: "2026-07-26T12:00:00Z",
  },
  {
    id: "lc-2",
    live_post_id: "lp-1",
    user_id: "user-4",
    user: u("user-4"),
    content: "第三张拍得真好",
    created_at: "2026-07-26T13:00:00Z",
  },
  {
    id: "lc-3",
    live_post_id: "lp-6",
    user_id: "user-5",
    user: u("user-5"),
    content: "噪音墙现场听真的震撼",
    created_at: "2026-08-03T14:30:00Z",
  },
];
