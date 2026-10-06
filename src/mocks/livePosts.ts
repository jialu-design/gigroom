/**
 * DEMO/MOCK 数据 - 现场帖
 * ⚠️ 现场内容全部为demo虚构，图片使用 picsum 占位图，视频链接为demo。
 * 仅为已结束演出(show-1, show-2, show-3)创建现场帖。
 */
import type { LivePost } from "@/lib/types";
import { VideoPlatform } from "@/lib/types";
import { userMap } from "./users";

const u = (id: string) => userMap.get(id);
const img = (seed: string) => `https://picsum.photos/seed/${seed}/600/600`;

export const mockLivePosts: LivePost[] = [
  // show-1 (Chinese Football x 鼠鼠鼠 武汉, 已结束)
  {
    id: "lp-1",
    show_id: "show-1",
    user_id: "user-5",
    user: u("user-5"),
    content: "昨晚CF武汉场太炸了！分享几张现场照片",
    image_urls: [img("live1a"), img("live1b"), img("live1c")],
    created_at: "2026-07-26T09:00:00Z",
  },
  {
    id: "lp-2",
    show_id: "show-1",
    user_id: "user-3",
    user: u("user-3"),
    content: "录了CF新歌的现场版，传B站了，链接在下面",
    image_urls: [],
    video_url: "https://www.bilibili.com/video/BVdemo000001",
    video_platform: VideoPlatform.BILIBILI,
    created_at: "2026-07-26T15:00:00Z",
  },
  {
    id: "lp-3",
    show_id: "show-1",
    user_id: "user-1",
    user: u("user-1"),
    content: "鼠鼠鼠的support set真的惊艳，第一次听就被圈粉",
    image_urls: [img("live1d")],
    created_at: "2026-07-26T18:00:00Z",
  },
  // show-2 (开端 成都, 已结束)
  {
    id: "lp-4",
    show_id: "show-2",
    user_id: "user-4",
    user: u("user-4"),
    content: "开端成都场，小酒馆氛围太好了",
    image_urls: [img("live2a"), img("live2b")],
    created_at: "2026-07-19T10:00:00Z",
  },
  {
    id: "lp-5",
    show_id: "show-2",
    user_id: "user-5",
    user: u("user-5"),
    content: "现场录音分享，音质一般但氛围满分",
    image_urls: [],
    video_url: "https://www.bilibili.com/video/BVdemo000002",
    video_platform: VideoPlatform.BILIBILI,
    created_at: "2026-07-19T16:00:00Z",
  },
  // show-3 (草东没有派对 x mouse on the keys 北京, 已结束)
  {
    id: "lp-6",
    show_id: "show-3",
    user_id: "user-2",
    user: u("user-2"),
    content: "School太小了但是氛围无敌！草东噪音墙太猛",
    image_urls: [img("live3a"), img("live3b"), img("live3c"), img("live3d")],
    created_at: "2026-08-03T10:00:00Z",
  },
  {
    id: "lp-7",
    show_id: "show-3",
    user_id: "user-5",
    user: u("user-5"),
    content: "mouse on the keys的钢琴后摇现场版比录音室版好听太多",
    image_urls: [img("live3e")],
    created_at: "2026-08-03T14:00:00Z",
  },
  {
    id: "lp-8",
    show_id: "show-3",
    user_id: "user-1",
    user: u("user-1"),
    content: "发个小红书的视频回顾",
    image_urls: [],
    video_url: "https://www.xiaohongshu.com/demo/video/0003",
    video_platform: VideoPlatform.XIAOHONGSHU,
    created_at: "2026-08-03T20:00:00Z",
  },
];
