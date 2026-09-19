/**
 * API 抽象层 - 认证模块（P10.1）
 *
 * UI 不直接调用 Supabase client，统一通过此模块。
 * P10.x 后续可替换实现，接口签名不变。
 *
 * Supabase Auth 成为真实登录事实来源。
 * profiles 表通过 handle_new_user() trigger 自动创建。
 */
import { createClient } from "@/lib/supabase/client";
import { getProfile } from "@/lib/api/profile";
import type { User } from "@/lib/types";

export interface SignUpResult {
  user: User | null;
  session: boolean;
  needsEmailConfirm: boolean;
}

export interface SignInResult {
  user: User;
}

/**
 * 注册
 * - supabase.auth.signUp + display_name metadata
 * - 返回 session 状态，区分 Confirm Email ON/OFF
 * - profiles 由 DB trigger 自动创建，前端不额外 insert
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<SignUpResult> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });

  if (error) {
    throw new Error(mapAuthError(error.message));
  }

  // Confirm Email ON → session 为 null
  if (!data.session || !data.user) {
    return {
      user: null,
      session: false,
      needsEmailConfirm: true,
    };
  }

  // Confirm Email OFF → 有 session，加载 profile
  const profile = await getProfile(data.user.id);
  return {
    user: profile,
    session: true,
    needsEmailConfirm: false,
  };
}

/**
 * 登录
 * - signInWithPassword
 * - 成功后加载 profile
 */
export async function signIn(
  email: string,
  password: string
): Promise<SignInResult> {
  const supabase = createClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(mapAuthError(error.message));
  }

  if (!data.user) {
    throw new Error("登录失败，请稍后重试");
  }

  // 加载 profile
  const profile = await getProfile(data.user.id);
  return { user: profile };
}

/**
 * 登出
 */
export async function signOut(): Promise<void> {
  const supabase = createClient();
  await supabase.auth.signOut();
}

/**
 * 获取当前 session（浏览器端）
 * 用于 App 启动时恢复登录状态
 */
export async function getSession(): Promise<{
  user: User | null;
  session: unknown;
}> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getSession();

  if (error || !data.session) {
    return { user: null, session: null };
  }

  // 有 session → 加载 profile
  const { data: authUser, error: userError } = await supabase.auth.getUser();
  if (userError || !authUser.user) {
    return { user: null, session: null };
  }

  const profile = await getProfile(authUser.user.id);
  return { user: profile, session: data.session };
}

/**
 * 获取当前用户（从 session）
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    return null;
  }

  return getProfile(data.user.id);
}

/**
 * 将 Supabase Auth error message 映射为用户可理解的中文提示
 */
function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials") || lower.includes("invalid credentials")) {
    return "邮箱或密码不正确";
  }
  if (lower.includes("email not confirmed")) {
    return "邮箱尚未验证，请先完成邮箱验证";
  }
  if (lower.includes("user already registered") || lower.includes("already been registered")) {
    return "该邮箱已注册";
  }
  if (lower.includes("password") && lower.includes("weak")) {
    return "密码强度不足，请使用至少 6 位密码";
  }
  if (lower.includes("rate limit") || lower.includes("too many")) {
    return "操作过于频繁，请稍后再试";
  }
  // 开发环境保留原始信息
  if (process.env.NODE_ENV === "development") {
    console.warn("[Auth] Supabase error:", message);
  }
  return "登录失败，请稍后重试";
}
