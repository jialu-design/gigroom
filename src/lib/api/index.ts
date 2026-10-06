/**
 * API 抽象层统一导出
 * 所有模块在 Mock 阶段返回 mock 数据，P10 替换为真实 Supabase 调用
 */
export * as showsApi from "./shows";
export * as artistsApi from "./artists";
export * as roomsApi from "./rooms";
export * as messagesApi from "./messages";
export * as notificationsApi from "./notifications";
export * as userApi from "./user";
export * as postsApi from "./posts";

// 同时也直接导出各模块（方便按需 import）
export * from "./shows";
export * from "./artists";
export * from "./rooms";
export * from "./messages";
export * from "./notifications";
export * from "./user";
export * from "./posts";
