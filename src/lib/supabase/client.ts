/**
 * Supabase 浏览器客户端（P10.1.5 统一 Database 类型）
 *
 * 使用 @supabase/ssr 的 createBrowserClient<Database>，与 server client
 * 共享同一份 Database 类型（database.types.ts）。
 * 仅使用 NEXT_PUBLIC_* 环境变量，绝不引入 service role key。
 *
 * 使用方式（Client Component）：
 *   import { createClient } from "@/lib/supabase/client";
 *   const supabase = createClient();
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/supabase/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let cachedClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * 创建浏览器端 Supabase 客户端（单例 + Database 泛型）
 * 如果环境变量未配置，抛出明确错误（不静默 fallback 到 Mock Auth）
 */
export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[Supabase] 浏览器客户端未初始化：缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY。请在 .env.local 中配置 Supabase 环境变量。"
    );
  }

  if (cachedClient) return cachedClient;

  cachedClient = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return cachedClient;
}
