/**
 * DEMO/MOCK 数据 - 讨论消息
 * ⚠️ 聊天内容全部为demo虚构，不代表真实对话。
 * room-1 对应 show-1, room-4 对应 show-4
 */
import type { DiscussionMessage } from "@/lib/types";
import { userMap } from "./users";

const u = (id: string) => userMap.get(id);

export const mockMessages: DiscussionMessage[] = [
  // room-4 (show-4: Chinese Football x Default 上海)
  {
    id: "msg-1",
    room_id: "room-4",
    user_id: "user-1",
    user: u("user-1"),
    content: "终于等到CF上海了！上个月武汉那场没去成，这次必须冲",
    created_at: "2026-08-15T10:30:00Z",
  },
  {
    id: "msg-2",
    room_id: "room-4",
    user_id: "user-3",
    user: u("user-3"),
    content: "同！我也是武汉没去成，这次买了预售了",
    created_at: "2026-08-15T11:00:00Z",
  },
  {
    id: "msg-3",
    room_id: "room-4",
    user_id: "user-2",
    user: u("user-2"),
    content: "Default的Math Rock太顶了，期待support set",
    created_at: "2026-08-15T12:15:00Z",
  },
  {
    id: "msg-4",
    room_id: "room-4",
    user_id: "user-1",
    user: u("user-1"),
    content: "有人从外地来的吗？可以拼车",
    reply_to_id: "msg-1",
    reply_to_user: u("user-1"),
    created_at: "2026-08-15T14:00:00Z",
  },
  {
    id: "msg-5",
    room_id: "room-4",
    user_id: "user-4",
    user: u("user-4"),
    content: "我从成都飞过来！有没有推荐住的地方",
    reply_to_id: "msg-4",
    reply_to_user: u("user-1"),
    created_at: "2026-08-15T15:30:00Z",
  },
  {
    id: "msg-6",
    room_id: "room-4",
    user_id: "user-3",
    user: u("user-3"),
    content: "MAO附近有很多青旅，走过去十分钟",
    reply_to_id: "msg-5",
    reply_to_user: u("user-4"),
    created_at: "2026-08-15T16:00:00Z",
  },
  {
    id: "msg-7",
    room_id: "room-4",
    user_id: "user-5",
    user: u("user-5"),
    content: "请问有人知道几点结束吗？要赶末班地铁",
    created_at: "2026-08-16T09:00:00Z",
  },
  {
    id: "msg-8",
    room_id: "room-4",
    user_id: "user-1",
    user: u("user-1"),
    content: "一般22:30左右结束，地铁应该来得及",
    reply_to_id: "msg-7",
    reply_to_user: u("user-5"),
    created_at: "2026-08-16T09:30:00Z",
  },
  // room-1 (show-1: 已结束，Chinese Football x 柏林护士 武汉)
  {
    id: "msg-9",
    room_id: "room-1",
    user_id: "user-3",
    user: u("user-3"),
    content: "昨晚太炸了！CF新歌现场版比录音版好听十倍",
    created_at: "2026-07-26T10:00:00Z",
  },
  {
    id: "msg-10",
    room_id: "room-1",
    user_id: "user-1",
    user: u("user-1"),
    content: "柏林护士的support set也很惊喜，第一次听就被圈粉了",
    created_at: "2026-07-26T11:00:00Z",
  },
  {
    id: "msg-11",
    room_id: "room-1",
    user_id: "user-5",
    user: u("user-5"),
    content: "我录了几首，正在剪辑，回头传B站分享到群里",
    created_at: "2026-07-26T14:00:00Z",
  },
  {
    id: "msg-12",
    room_id: "room-1",
    user_id: "user-3",
    user: u("user-3"),
    content: "期待！",
    reply_to_id: "msg-11",
    reply_to_user: u("user-5"),
    created_at: "2026-07-26T14:30:00Z",
  },
];
