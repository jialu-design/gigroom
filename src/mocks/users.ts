/**
 * DEMO/MOCK 数据 - 用户
 * ⚠️ 用户信息全部为虚构，头像使用 picsum 占位图。
 * 仅用于开发演示。
 */
import type { User } from "@/lib/types";

export const mockUsers: User[] = [
  {
    id: "user-1",
    display_name: "鞋狗阿明",
    avatar_url: "https://picsum.photos/seed/user1gigroom/100/100",
    city: "上海",
    bio: "Shoegaze/Emo爱好者，每年看50场现场",
    onboarding_completed: true,
    created_at: "2025-01-15T08:00:00Z",
  },
  {
    id: "user-2",
    display_name: "后朋克少女",
    avatar_url: "https://picsum.photos/seed/user2gigroom/100/100",
    city: "北京",
    bio: "Post-Punk forever | 恶心的人类",
    onboarding_completed: true,
    created_at: "2025-02-20T08:00:00Z",
  },
  {
    id: "user-3",
    display_name: "数学摇滚老张",
    avatar_url: "https://picsum.photos/seed/user3gigroom/100/100",
    city: "武汉",
    bio: "Math Rock / 中西部emo | 拍照菜鸡",
    onboarding_completed: true,
    created_at: "2025-03-10T08:00:00Z",
  },
  {
    id: "user-4",
    display_name: "livehouse常客",
    avatar_url: "https://picsum.photos/seed/user4gigroom/100/100",
    city: "成都",
    bio: "什么都听一点，什么都看一点",
    onboarding_completed: true,
    created_at: "2025-04-05T08:00:00Z",
  },
  {
    id: "user-5",
    display_name: "录音笔小王",
    avatar_url: "https://picsum.photos/seed/user5gigroom/100/100",
    city: "广州",
    bio: "现场录音爱好者 | B站搜我的名字",
    onboarding_completed: true,
    created_at: "2025-05-01T08:00:00Z",
  },
];

/** 当前 mock 登录用户（默认 user-1） */
export const mockCurrentUser = mockUsers[0];

/** 按 ID 快速查找 */
export const userMap = new Map(mockUsers.map((u) => [u.id, u]));
