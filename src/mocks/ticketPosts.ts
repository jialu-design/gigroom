/**
 * DEMO/MOCK 数据 - 出收票帖
 * ⚠️ 票务信息全部为demo虚构，不代表真实交易。
 * 包含 active 和 completed 两种状态的样本。
 */
import type { TicketPost } from "@/lib/types";
import { TicketPostType, TicketPostStatus } from "@/lib/types";
import { userMap } from "./users";

const u = (id: string) => userMap.get(id);

export const mockTicketPosts: TicketPost[] = [
  // show-5 相关（售罄场，收票需求多）
  {
    id: "tp-1",
    show_id: "show-5",
    user_id: "user-1",
    user: u("user-1"),
    type: TicketPostType.BUYING,
    quantity: 1,
    face_value: 180,
    price: 180, // 原价收
    note: "Dear Eloise北京场售罄了，求一张预售票，原价收，绝不加价",
    status: TicketPostStatus.ACTIVE,
    created_at: "2026-07-25T10:00:00Z",
    comment_count: 0,
  },
  {
    id: "tp-2",
    show_id: "show-5",
    user_id: "user-2",
    user: u("user-2"),
    type: TicketPostType.BUYING,
    quantity: 2,
    face_value: 180,
    price: 200, // 愿意加一点
    note: "求两张，带朋友一起看，可适当加价",
    status: TicketPostStatus.ACTIVE,
    created_at: "2026-07-26T14:00:00Z",
    comment_count: 1,
  },
  // show-9 相关（售罄场）
  {
    id: "tp-3",
    show_id: "show-9",
    user_id: "user-3",
    user: u("user-3"),
    type: TicketPostType.BUYING,
    quantity: 1,
    face_value: 200,
    price: 200,
    note: "万青北京场求票！原价收，有意私信",
    status: TicketPostStatus.ACTIVE,
    created_at: "2026-07-20T09:00:00Z",
    comment_count: 0,
  },
  // show-4 相关（在售场，出票）
  {
    id: "tp-4",
    show_id: "show-4",
    user_id: "user-4",
    user: u("user-4"),
    type: TicketPostType.SELLING,
    quantity: 1,
    face_value: 100,
    price: 100, // 原价转
    note: "临时有事去不了，CF上海场预售票原价转，秀动转赠",
    status: TicketPostStatus.ACTIVE,
    created_at: "2026-08-16T10:00:00Z",
    comment_count: 2,
  },
  {
    id: "tp-5",
    show_id: "show-4",
    user_id: "user-5",
    user: u("user-5"),
    type: TicketPostType.SELLING,
    quantity: 2,
    face_value: 100,
    price: 100,
    note: "朋友不去了，多一张预售票，原价转两张",
    status: TicketPostStatus.COMPLETED,
    created_at: "2026-08-14T15:00:00Z",
    updated_at: "2026-08-15T20:00:00Z",
    comment_count: 3,
  },
  // show-10 相关
  {
    id: "tp-6",
    show_id: "show-10",
    user_id: "user-2",
    user: u("user-2"),
    type: TicketPostType.SELLING,
    quantity: 1,
    face_value: 100,
    price: 100,
    note: "Slowdive+DIIV上海场，临时出差去不了，原价转",
    status: TicketPostStatus.ACTIVE,
    created_at: "2026-08-20T18:00:00Z",
    comment_count: 0,
  },
  // show-1 相关（已结束场，已完成的交易）
  {
    id: "tp-7",
    show_id: "show-1",
    user_id: "user-3",
    user: u("user-3"),
    type: TicketPostType.SELLING,
    quantity: 1,
    face_value: 80,
    price: 80,
    note: "CF武汉场预售票转，去不了了",
    status: TicketPostStatus.COMPLETED,
    created_at: "2026-07-22T12:00:00Z",
    updated_at: "2026-07-23T10:00:00Z",
    comment_count: 1,
  },
  {
    id: "tp-8",
    show_id: "show-1",
    user_id: "user-1",
    user: u("user-1"),
    type: TicketPostType.BUYING,
    quantity: 1,
    face_value: 80,
    price: 80,
    note: "求一张CF武汉场预售票",
    status: TicketPostStatus.COMPLETED,
    created_at: "2026-07-20T16:00:00Z",
    updated_at: "2026-07-21T11:00:00Z",
    comment_count: 2,
  },
  // show-19 相关（延期场）
  {
    id: "tp-9",
    show_id: "show-19",
    user_id: "user-2",
    user: u("user-2"),
    type: TicketPostType.SELLING,
    quantity: 1,
    face_value: 120,
    price: 120,
    note: "草东延期了去不了，原价退转，已申请退票但也可转赠",
    status: TicketPostStatus.ACTIVE,
    created_at: "2026-08-11T10:00:00Z",
    comment_count: 0,
  },
  // show-15 相关（未来场，P3 测试用）
  {
    id: "tp-10",
    show_id: "show-15",
    user_id: "user-2",
    user: u("user-2"),
    type: TicketPostType.SELLING,
    quantity: 1,
    face_value: 150,
    price: 150,
    note: "临时有事，原价转一张",
    status: TicketPostStatus.ACTIVE,
    created_at: "2026-09-25T10:00:00Z",
    comment_count: 0,
  },
];
