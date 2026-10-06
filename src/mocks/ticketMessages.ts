/**
 * DEMO/MOCK 数据 - 交易消息（出收票 1v1 会话）
 * ⚠️ 全部为虚构演示数据。
 */
import type { TicketConversation, TicketMessage } from "@/lib/types";
import { userMap } from "./users";

const u = (id: string) => userMap.get(id);

/**
 * 预置会话：
 * - conv-1：user-1（当前 mock 用户）向 user-4 咨询 show-4 的出票帖 tp-4（未读 1 条，用于演示红点）
 * - conv-2：user-2 向 user-1 咨询 show-5 的收票帖 tp-1（user-1 是帖主）
 */
export const mockTicketConversations: TicketConversation[] = [
  {
    id: "conv-1",
    ticket_post_id: "tp-4",
    show_id: "show-4",
    owner_user_id: "user-4",
    requester_user_id: "user-1",
    created_at: "2026-08-16T11:30:00Z",
    updated_at: "2026-08-16T12:05:00Z",
    post: undefined,
    owner: u("user-4"),
    requester: u("user-1"),
  },
  {
    id: "conv-2",
    ticket_post_id: "tp-1",
    show_id: "show-5",
    owner_user_id: "user-1",
    requester_user_id: "user-2",
    created_at: "2026-08-10T09:00:00Z",
    updated_at: "2026-08-10T09:20:00Z",
    owner: u("user-1"),
    requester: u("user-2"),
  },
  // 未来场会话（show-15 = 2026-10-02，P3 测试用，演出未结束可发消息）
  {
    id: "conv-3",
    ticket_post_id: "tp-10",
    show_id: "show-15",
    owner_user_id: "user-2",
    requester_user_id: "user-1",
    created_at: "2026-09-26T10:00:00Z",
    updated_at: "2026-09-30T20:00:00Z",
    owner: u("user-2"),
    requester: u("user-1"),
  },
];

export const mockTicketMessages: TicketMessage[] = [
  {
    id: "tm-1",
    conversation_id: "conv-1",
    from_user_id: "user-1",
    from_user: u("user-1"),
    content: "你好，票还在吗？可以走转赠吗",
    is_read: true,
    created_at: "2026-08-16T11:30:00Z",
  },
  {
    id: "tm-2",
    conversation_id: "conv-1",
    from_user_id: "user-4",
    from_user: u("user-4"),
    content: "在的，秀动直接转赠，原价",
    is_read: true,
    created_at: "2026-08-16T11:58:00Z",
  },
  {
    id: "tm-3",
    conversation_id: "conv-1",
    from_user_id: "user-4",
    from_user: u("user-4"),
    content: "你确定要的话我现在就挂转赠",
    is_read: false,
    created_at: "2026-08-16T12:05:00Z",
  },
  {
    id: "tm-4",
    conversation_id: "conv-2",
    from_user_id: "user-2",
    from_user: u("user-2"),
    content: "你好，我这边多一张预售，原价出",
    is_read: true,
    created_at: "2026-08-10T09:00:00Z",
  },
  {
    id: "tm-5",
    conversation_id: "conv-2",
    from_user_id: "user-1",
    from_user: u("user-1"),
    content: "好的，怎么交易？",
    is_read: true,
    created_at: "2026-08-10T09:10:00Z",
  },
  {
    id: "tm-6",
    conversation_id: "conv-2",
    from_user_id: "user-2",
    from_user: u("user-2"),
    content: "演出前一周秀动转赠，到时候联系你",
    is_read: true,
    created_at: "2026-08-10T09:20:00Z",
  },
  // conv-3（show-15 未来场）：帖主 user-2 的最新回复，未读 → 私聊红点 + 交易消息通知深链可走查
  {
    id: "tm-7",
    conversation_id: "conv-3",
    from_user_id: "user-2",
    from_user: u("user-2"),
    content: "票还在的，演出当天下午秀动转给你",
    is_read: false,
    created_at: "2026-09-30T20:00:00Z",
  },
];

/** 预置收藏：user-1 收藏了 tp-4（show-4 出票）和 tp-6（show-10 出票）；
 *  fav-3：user-2 收藏了 user-1 的 tp-8（与预置 ticket_favorite 通知对应） */
export const mockTicketFavorites: import("@/lib/types").TicketFavorite[] = [
  {
    id: "fav-1",
    ticket_post_id: "tp-4",
    user_id: "user-1",
    created_at: "2026-08-16T11:20:00Z",
  },
  {
    id: "fav-2",
    ticket_post_id: "tp-6",
    user_id: "user-2",
    created_at: "2026-08-21T10:00:00Z",
  },
  {
    id: "fav-3",
    ticket_post_id: "tp-8",
    user_id: "user-2",
    created_at: "2026-09-26T09:50:00Z",
  },
];
