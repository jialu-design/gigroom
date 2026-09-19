/**
 * 类型统一收口：Database / ProfileRow 统一从 database.types.ts 导出。
 *
 * P10.1.5 新增 database.types.ts 作为真实 `supabase gen types` 的替换入口。
 * 本文件保留以兼容历史 import path `@/lib/supabase/types`，调用方无需立即
 * 全部改路径，但推荐新代码直接使用 `@/lib/supabase/database.types`。
 */
export type { Database, ProfileRow } from "./database.types";
