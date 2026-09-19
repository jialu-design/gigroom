/**
 * Supabase 服务端客户端（P10.1.5 统一 Database 类型）
 *
 * 使用 @supabase/ssr 的 createServerClient<Database>，与 browser client
 * 共享同一份 Database 类型（database.types.ts）。
 * 结合 Next.js cookies() 实现 session 传递。
 *
 * ⚠️ 此客户端不使用 service role key
 *    如需 service role（管理员操作），未来单独创建 admin.ts
 *
 * 使用方式（Server Component / Route Handler）：
 *   import { createServerClient } from "@/lib/supabase/server";
 *   const supabase = createServerClient();
 */
import { createServerClient as ssrCreateServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * 创建服务端 Supabase 客户端
 * 从 next/headers 读取 cookie，实现 session 传递
 * 如果环境变量未配置，抛出明确错误
 */
export function createServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "[Supabase] 服务端客户端未初始化：缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY。"
    );
  }

  const cookieStore = cookies();

  return ssrCreateServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Server Component 中无法写 cookie（只能 Route Handler / Server Action 写）
          // 此处安全忽略：middleware 会负责刷新
        }
      },
    },
  });
}
