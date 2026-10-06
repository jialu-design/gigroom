// 主要Livehouse城市列表
export const CITIES = [
  "北京",
  "上海",
  "广州",
  "深圳",
  "成都",
  "武汉",
  "杭州",
  "南京",
  "西安",
  "重庆",
  "长沙",
  "天津",
  "苏州",
  "厦门",
  "青岛",
  "郑州",
  "昆明",
  "沈阳",
  "大连",
  "合肥",
  // 测试用城市：无本地演出，用于验证首页周边城市兜底（无锡 → 上海/苏州/南京）
  "无锡",
];

// 音乐风格标签（对应 Artist.genres 字段）
export const GENRES = [
  "Emo",
  "Shoegaze",
  "Math Rock",
  "Indie Rock",
  "Post-Punk",
  "Post-Rock",
  "Punk",
  "Hardcore",
  "Dream Pop",
  "Britpop",
  "Alternative",
  "Folk",
  "Electronic",
  "Noise Rock",
  "Garage Rock",
];

/**
 * Genre UI 中文展示映射（仅用于展示层 label，不改 artists.ts Canonical genres 原始数据）。
 * 未映射的 genre 原样展示英文原词。
 */
export const GENRE_LABEL: Record<string, string> = {
  Emo: "情绪摇滚",
  Shoegaze: "盯鞋",
  "Math Rock": "数学摇滚",
  "Indie Rock": "独立摇滚",
  "Post-Punk": "后朋克",
  "Post-Rock": "后摇",
  Punk: "朋克",
  Hardcore: "硬核",
  "Dream Pop": "梦幻流行",
  Britpop: "英伦摇滚",
  Alternative: "另类",
  Folk: "民谣",
  Electronic: "电子",
  "Noise Rock": "噪音摇滚",
  "Garage Rock": "车库摇滚",
};

/** 取 genre 的展示 label（有中文映射用中文，否则原样英文） */
export function getGenreLabel(genre: string): string {
  return GENRE_LABEL[genre] ?? genre;
}

// 找搭子标签
export const BUDDY_TAGS = [
  "一起看演出",
  "排队",
  "吃饭",
  "拼车",
  "拼双人票",
  "互拍",
];

// 讨论消息发送 cooldown（毫秒），UI 层强制 10 秒
export const MESSAGE_COOLDOWN_MS = 10_000;

// 演出生命周期状态中文映射
export const SHOW_STATUS_LABEL: Record<string, string> = {
  upcoming: "即将到来",
  ended: "已结束",
  cancelled: "已取消",
  postponed: "已延期",
};

// 演出售票状态中文映射
export const SHOW_TICKET_STATUS_LABEL: Record<string, string> = {
  coming_soon: "即将开票",
  on_sale: "在售",
  sold_out: "售罄",
};

// 通知类型图标映射
export const NOTIFICATION_ICON: Record<string, string> = {
  new_show: "🔔",
  attended_check: "❓",
};
