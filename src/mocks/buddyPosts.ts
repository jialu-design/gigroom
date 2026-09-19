/**
 * DEMO/MOCK 数据 - 找搭子帖
 * ⚠️ 帖子内容全部为demo虚构，用户为虚构用户。
 */
import type { BuddyPost } from "@/lib/types";
import { userMap } from "./users";

const u = (id: string) => userMap.get(id);

export const mockBuddyPosts: BuddyPost[] = [
  // show-4 相关
  {
    id: "bp-1",
    show_id: "show-4",
    user_id: "user-1",
    user: u("user-1"),
    content: "有没有人一起去看CF上海场？我住浦东，可以提前约个饭",
    tags: ["一起看演出", "吃饭"],
    created_at: "2026-08-15T10:00:00Z",
    comment_count: 3,
  },
  {
    id: "bp-2",
    show_id: "show-4",
    user_id: "user-4",
    user: u("user-4"),
    content: "从成都飞上海看CF，有没有人顺路拼车去MAO的？落地虹桥",
    tags: ["拼车"],
    created_at: "2026-08-15T12:00:00Z",
    comment_count: 2,
  },
  {
    id: "bp-3",
    show_id: "show-4",
    user_id: "user-3",
    user: u("user-3"),
    content: "武汉来的，第一次去MAO上海，有人带路吗？提前排队也好",
    tags: ["一起看演出", "排队"],
    created_at: "2026-08-16T09:00:00Z",
    comment_count: 1,
  },
  // show-10 相关
  {
    id: "bp-4",
    show_id: "show-10",
    user_id: "user-2",
    user: u("user-2"),
    content: "朋克之夜！脏手指+过失，谁一起？我北京本地的",
    tags: ["一起看演出"],
    created_at: "2026-08-14T18:00:00Z",
    comment_count: 0,
  },
  {
    id: "bp-5",
    show_id: "show-10",
    user_id: "user-5",
    user: u("user-5"),
    content: "广州飞上海看朋克之夜，有没有人一起排队的？打算提前一小时到",
    tags: ["排队", "拼车"],
    created_at: "2026-08-15T20:00:00Z",
    comment_count: 1,
  },
  // show-7 相关
  {
    id: "bp-6",
    show_id: "show-7",
    user_id: "user-1",
    user: u("user-1"),
    content: "SQ+DOC联合专场，上海育音堂，有人一起吃饭吗？附近有家不错的面馆",
    tags: ["吃饭"],
    created_at: "2026-08-20T11:00:00Z",
    comment_count: 2,
  },
  // show-12 相关
  {
    id: "bp-7",
    show_id: "show-12",
    user_id: "user-3",
    user: u("user-3"),
    content: "武汉VOX主场！柏林护士+Default，武汉的朋克们集合了",
    tags: ["一起看演出", "排队"],
    created_at: "2026-08-18T15:00:00Z",
    comment_count: 4,
  },
  // show-15 相关
  {
    id: "bp-8",
    show_id: "show-15",
    user_id: "user-1",
    user: u("user-1"),
    content: "惘闻上海场！后摇党集合，国庆假期看演出太舒服了",
    tags: ["一起看演出"],
    created_at: "2026-08-13T10:00:00Z",
    comment_count: 0,
  },
  // show-18 相关
  {
    id: "bp-9",
    show_id: "show-18",
    user_id: "user-5",
    user: u("user-5"),
    content: "蛙池+回春丹广州场，本地的有没有人一起？看完去吃宵夜",
    tags: ["一起看演出", "吃饭"],
    created_at: "2026-08-14T12:00:00Z",
    comment_count: 1,
  },
  // show-8 相关
  {
    id: "bp-10",
    show_id: "show-8",
    user_id: "user-4",
    user: u("user-4"),
    content: "成都本地，回春丹专场有没有一起的？小酒馆我熟，可以带路",
    tags: ["一起看演出", "排队", "吃饭"],
    created_at: "2026-08-22T16:00:00Z",
    comment_count: 2,
  },
  // show-1 相关（已结束）
  {
    id: "bp-11",
    show_id: "show-1",
    user_id: "user-3",
    user: u("user-3"),
    content: "武汉CF场，有没有人提前去排队的？打算6点去占位",
    tags: ["排队"],
    created_at: "2026-07-24T18:00:00Z",
    comment_count: 5,
  },
];
