/**
 * DEMO/MOCK 数据 - 场地
 * ⚠️ 场地名称为真实中国Livehouse，但地址等信息为demo占位，不代表真实地址。
 * 仅用于开发演示，不代表任何真实演出安排。
 */
import type { Venue } from "@/lib/types";

export const mockVenues: Venue[] = [
  { id: "venue-1", name: "MAO Livehouse上海", city: "上海", address: "上海市黄浦区重庆中路308号（demo占位地址）" },
  { id: "venue-2", name: "MAO Livehouse北京", city: "北京", address: "北京市海淀区中关村大街15号（demo占位地址）" },
  { id: "venue-3", name: "育音堂", city: "上海", address: "上海市杨浦区国泰路11号（demo占位地址）" },
  { id: "venue-4", name: "School酒吧", city: "北京", address: "北京市东城区安定门内大街（demo占位地址）" },
  { id: "venue-5", name: "VOX Livehouse", city: "武汉", address: "武汉市洪山区珞喻路（demo占位地址）" },
  { id: "venue-6", name: "MAO Livehouse杭州", city: "杭州", address: "杭州市西湖区文一路（demo占位地址）" },
  { id: "venue-7", name: "小酒馆空间", city: "成都", address: "成都市成华区万象城（demo占位地址）" },
  { id: "venue-8", name: "B10现场", city: "深圳", address: "深圳市南山区华侨城创意园（demo占位地址）" },
  { id: "venue-9", name: "的声音空间", city: "广州", address: "广州市海珠区工业大道（demo占位地址）" },
  { id: "venue-10", name: "1701 Live House", city: "南京", address: "南京市鼓楼区广州路（demo占位地址）" },
  // 周边城市兜底测试用场地（苏州/天津/重庆）
  { id: "venue-11", name: "MAO Livehouse苏州", city: "苏州", address: "苏州市姑苏区（demo占位地址）" },
  { id: "venue-12", name: "13CLUB天津", city: "天津", address: "天津市和平区（demo占位地址）" },
  { id: "venue-13", name: "坚果LIVEHOUSE", city: "重庆", address: "重庆市渝中区（demo占位地址）" },
];

/** 按 ID 快速查找 */
export const venueMap = new Map(mockVenues.map((v) => [v.id, v]));
