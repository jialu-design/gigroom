/**
 * Next.js Middleware（P10.1）
 *
 * 职责：刷新 Supabase Auth session（token/cookies）
 * 不做复杂业务鉴权、不查询 Profile/Shows/房间成员关系
 *
 * 参考：https://supabase.com/docs/guides/auth/server-side/nextjs
 */
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(request: NextRequest) {
  // 如果环境变量未配置，直接放行（Mock 阶段）
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options as never)
        );
      },
    },
  });

  // 刷新 session（不在此处做 redirect）
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * 匹配所有路径，排除 _next/static、_next/image、favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
