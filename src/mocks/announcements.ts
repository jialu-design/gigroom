/**
 * DEMO/MOCK 数据 - 演出公告
 * ⚠️ 公告内容全部为demo虚构，不代表真实演出信息。
 */
import type { Announcement } from "@/lib/types";
import { AnnouncementType } from "@/lib/types";

export const mockAnnouncements: Announcement[] = [
  {
    id: "ann-1",
    show_id: "show-4",
    type: AnnouncementType.TICKET_SALE,
    title: "预售已开票（DEMO）",
    content: "本场演出预售票已在秀动开票，售完即止。现场票视情况发售。",
    created_at: "2026-07-01T10:00:00Z",
  },
  {
    id: "ann-2",
    show_id: "show-5",
    type: AnnouncementType.SOLD_OUT,
    title: "全票种售罄（DEMO）",
    content: "感谢大家支持，本场演出所有票种已全部售罄。",
    created_at: "2026-07-20T15:00:00Z",
  },
  {
    id: "ann-3",
    show_id: "show-9",
    type: AnnouncementType.SOLD_OUT,
    title: "售罄通知（DEMO）",
    content: "万能青年旅店北京专场全票种售罄，感谢支持。",
    created_at: "2026-07-15T12:00:00Z",
  },
  {
    id: "ann-4",
    show_id: "show-10",
    type: AnnouncementType.GUEST_CHANGE,
    title: "嘉宾调整通知（DEMO）",
    content: "原定嘉宾因行程调整无法出席，本次为脏手指与过失双专场合演。",
    created_at: "2026-08-05T18:00:00Z",
  },
  {
    id: "ann-5",
    show_id: "show-13",
    type: AnnouncementType.TIME_CHANGE,
    title: "开票时间调整（DEMO）",
    content: "原定8月15日开票，现调整至8月20日20:00开票，敬请留意。",
    created_at: "2026-08-12T10:00:00Z",
  },
  {
    id: "ann-6",
    show_id: "show-19",
    type: AnnouncementType.POSTPONED,
    title: "演出延期通知（DEMO）",
    content: "因不可抗力，本场演出延期，具体时间另行通知。已购票的用户可申请退票。",
    created_at: "2026-08-10T20:00:00Z",
  },
  {
    id: "ann-7",
    show_id: "show-1",
    type: AnnouncementType.ORGANIZER_NOTICE,
    title: "入场须知（DEMO）",
    content: "请提前30分钟入场，演出开始后停止入场。场内禁止录音录像。",
    created_at: "2026-07-20T10:00:00Z",
  },
  {
    id: "ann-8",
    show_id: "show-4",
    type: AnnouncementType.VENUE_CHANGE,
    title: "入场时间提前（DEMO）",
    content: "入场时间由19:30调整为19:00，请各位提前到场。",
    created_at: "2026-08-15T14:00:00Z",
  },
];
