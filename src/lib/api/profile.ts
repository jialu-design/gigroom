/**
 * API 抽象层 - Profile 模块（P10.1.5 + P10.4 统一用户数据层）
 *
 * 职责：
 * 1. profiles 表 ↔ 前端 User 类型的 adapter 转换
 * 2. 单用户读写（getProfile / updateProfile / completeOnboarding）
 * 3. 批量用户查找（getProfilesByIds），供 posts / messages / rooms 等模块回填 user
 *
 * 设计原则：
 * - UI 不直接访问 Supabase profiles；所有展示用的 User 数据通过本文件
 *   （或 user.ts 的对外 re-export）获取
 * - 未配置 Supabase 时 fallback 到 mocks/users，保持本地可运行
 * - 类型断言集中在本文件（profileRowToUser），不散落在页面/组件
 *
 * P10.4 新增：
 * - getProfilesByIds(userId[]) 批量查询
 * - enrichPosts / enrichMessages 通用回填工具
 * - getCurrentUser / getUser 的 Supabase 路径
 */
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/lib/supabase/database.types";
import type { User } from "@/lib/types";
import type { PostgrestQueryBuilder } from "@supabase/supabase-js";
import { isSupabaseConfigured, warnSupabaseNotConfigured } from "@/lib/supabase/publicData";
import { userMap, mockCurrentUser } from "@/mocks/users";

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
type ProfileRelationships = Database["public"]["Tables"]["profiles"]["Relationships"];
/** 完整 GenericSchema — 复用 database.types.ts 的 Database.public，不重复手写 */
type Schema = Database["public"];
type ProfileTable = {
  Row: ProfileRow;
  Insert: ProfileInsert;
  Update: ProfileUpdate;
  Relationships: ProfileRelationships;
};

/** profiles 表的 typed QueryBuilder — 集中在本层使用，不外露 */
type ProfilesQueryBuilder = PostgrestQueryBuilder<
  Record<string, unknown>,
  Schema,
  ProfileTable,
  "profiles"
>;

/**
 * 取 profiles 表的 typed from()。
 * 集中式类型转换：显式指定 PostgrestQueryBuilder 的泛型参数，绕过
 * 手写 schema 过不了 postgrest-js 条件类型推断的问题。
 */
function profileFrom(): ProfilesQueryBuilder {
  const supabase = createClient();
  const raw = supabase.from("profiles");
  return raw as unknown as ProfilesQueryBuilder;
}

/**
 * Profile adapter：数据库行 → 前端 User 类型
 * 集中在此处转换，不允许页面/组件散落断言。
 * ProfileRow 已在本文件顶部声明，无需 import。
 */
export function profileRowToUser(row: ProfileRow): User {
  return {
    id: row.id,
    display_name: row.display_name,
    avatar_url: row.avatar_url ?? undefined,
    city: row.city ?? undefined,
    bio: row.bio ?? undefined,
    onboarding_completed: row.onboarding_completed,
    created_at: row.created_at,
  };
}

/** 延迟辅助（mock 路径对齐真实 API 调用的异步语义） */
const delay = <T>(data: T, ms = 50): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

// ============
// Supabase 路径
// ============

/**
 * 批量从 profiles 表读取用户资料（用于回填 post/message 的 user 字段）
 * - 空数组直接返回空 Map
 * - Supabase 未配置时 fallback 到 mocks/users
 */
export async function getProfilesByIds(
  userIds: string[]
): Promise<Map<string, User>> {
  if (userIds.length === 0) return new Map();

  if (!isSupabaseConfigured()) {
    warnSupabaseNotConfigured("profiles");
    return getUserMapFromMock(userIds);
  }

  try {
    const { data, error } = await profileFrom()
      .select("*")
      .in("id", userIds);

    if (error) throw error;

    const map = new Map<string, User>();
    if (data) {
      for (const raw of data as unknown as Array<Database["public"]["Tables"]["profiles"]["Row"]>) {
        const user = profileRowToUser(raw);
        map.set(user.id, user);
      }
    }
    return map;
  } catch {
    warnSupabaseNotConfigured("profiles");
    return getUserMapFromMock(userIds);
  }
}

/** 从 mock 构造用户 Map（未配置 Supabase 时使用） */
function getUserMapFromMock(userIds: string[]): Promise<Map<string, User>> {
  const map = new Map<string, User>();
  for (const id of userIds) {
    const u = userMap.get(id);
    if (u) map.set(id, u);
  }
  return delay(map);
}

/**
 * 获取单个用户资料
 * - 优先走 Supabase profiles
 * - profile 不存在时：若 userMap 有则 fallback；否则返回占位 User（便于 UI 先展示 ID）
 * - 调用方使用方需要注意：永远返回非 null User（便于现有 UI 代码直接访问 user.id 等）
 */
export async function getProfile(userId: string): Promise<User> {
  const fallbackUser = userMap.get(userId);

  try {
    const { data, error } = await profileFrom()
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      // Supabase 报错：fallback 到 mock
      return fallbackUser ?? nullUser(userId);
    }
    if (!data) {
      // profile 尚未创建（trigger 延迟）：fallback 到 mock；无 mock 则返回占位 User
      return fallbackUser ?? nullUser(userId);
    }

    return profileRowToUser(data);
  } catch {
    // 网络异常 / client 异常：fallback
    return fallbackUser ?? nullUser(userId);
  }
}

/** 兼容旧逻辑：返回一个占坑 User（profile 尚未 trigger 创建时） */
function nullUser(userId: string): User {
  return {
    id: userId,
    display_name: "",
    avatar_url: undefined,
    city: undefined,
    bio: undefined,
    onboarding_completed: false,
    created_at: new Date().toISOString(),
  };
}

/** 判断一个 User 是否为占位符（非真实用户） */
export function isPlaceholderUser(u: User): boolean {
  return u.display_name === "" && u.onboarding_completed === false && u.bio === undefined;
}

/**
 * 更新 Profile
 * 写入 profiles 表，返回更新后的 User
 * - 优先走 Supabase（与 P10.1 Auth 路径保持一致）
 * - DB 异常时 fallback 到 mock（保证本地开发不因未配置环境变量阻塞）
 */
export async function updateProfile(
  userId: string,
  updates: {
    display_name?: string;
    avatar_url?: string;
    city?: string;
    bio?: string;
    onboarding_completed?: boolean;
  }
): Promise<User> {
  const dbUpdates: ProfileUpdate = {};
  if (updates.display_name !== undefined) dbUpdates.display_name = updates.display_name;
  if (updates.avatar_url !== undefined) dbUpdates.avatar_url = updates.avatar_url || null;
  if (updates.city !== undefined) dbUpdates.city = updates.city || null;
  if (updates.bio !== undefined) dbUpdates.bio = updates.bio || null;
  if (updates.onboarding_completed !== undefined)
    dbUpdates.onboarding_completed = updates.onboarding_completed;

  try {
    const { data, error } = await profileFrom()
      .update(dbUpdates)
      .eq("id", userId)
      .select("*")
      .single();

    if (error || !data) {
      throw error ?? new Error("保存资料失败，请稍后重试");
    }

    return profileRowToUser(data);
  } catch (err) {
    // 真实环境未配置 Supabase 时，fallback 到 mocks/users，保证本地运行
    if (!isSupabaseConfigured()) {
      warnSupabaseNotConfigured("profiles");
      const user = userMap.get(userId);
      if (!user) throw new Error("User not found");
      Object.assign(user, updates);
      return delay(user);
    }
    throw err;
  }
}

/**
 * 完成 Onboarding
 * 写入 city + onboarding_completed=true
 *
 * 使用 upsert（而非 update）以兼容 profile 行尚未创建的情况：
 * - 正常情况：handle_new_user trigger 已创建 profile → upsert 走 UPDATE 分支
 * - 异常情况：trigger 未生效或 profile 行缺失 → upsert 走 INSERT 分支
 *
 * @param userId      当前登录用户 ID（auth.uid）
 * @param city        用户选择的城市
 * @param displayName 用户名（INSERT 时填入 NOT NULL 列；UPDATE 时忽略）
 */
export async function completeOnboarding(
  userId: string,
  city: string,
  displayName?: string
): Promise<User> {
  try {
    const { data, error } = await profileFrom()
      .upsert(
        {
          id: userId,
          display_name: displayName ?? "新乐迷",
          city,
          onboarding_completed: true,
        },
        { onConflict: "id" }
      )
      .select("*")
      .single();

    if (error || !data) {
      console.error("[completeOnboarding] Supabase error:", error);
      throw error ?? new Error("保存资料失败，请稍后重试");
    }

    return profileRowToUser(data);
  } catch (err) {
    // 未配置 Supabase（env 缺失 / 本地 mock 阶段）时 fallback 到 mocks/users
    if (!isSupabaseConfigured()) {
      warnSupabaseNotConfigured("profiles");
      const user = userMap.get(userId);
      if (user) {
        Object.assign(user, { city, onboarding_completed: true });
        return delay(user);
      }
    }
    throw err;
  }
}

// ============
// 用户回填工具（供 posts / messages / rooms 使用）
// ============

/** 任何带 user_id 字段的接口（post / comment / message 等） */
interface UserOwned {
  user_id: string;
  user?: User;
  id: string;
}

/**
 * 批量回填对象列表的 user 字段
 * - 收集所有 user_id → 一次性 getProfilesByIds
 * - 逐条给 items.user 赋值（若查不到则保持原样，不覆盖可能已存在的 mock user）
 */
export async function hydrateUsers<T extends UserOwned>(
  items: T[]
): Promise<T[]> {
  if (items.length === 0) return items;

  const uniqueIds = Array.from(new Set(items.map((i) => i.user_id))).filter(Boolean);
  if (uniqueIds.length === 0) return items;

  const userMapById = await getProfilesByIds(uniqueIds);
  for (const item of items) {
    const u = userMapById.get(item.user_id);
    if (u) {
      item.user = u;
    }
  }
  return items;
}

/**
 * 回填单条对象的 user 字段
 */
export async function hydrateUser<T extends UserOwned>(item: T): Promise<T> {
  const map = await getProfilesByIds([item.user_id]);
  const u = map.get(item.user_id);
  if (u) item.user = u;
  return item;
}

/**
 * 回填 message 的 user + reply_to_user
 */
export async function hydrateMessageUsers<T extends UserOwned & { reply_to_id?: string; reply_to_user?: User }>(
  message: T,
  allMessages?: T[]
): Promise<T> {
  const ids = new Set<string>([message.user_id]);
  if (message.reply_to_id) ids.add(message.reply_to_id);
  const userMapById = await getProfilesByIds(Array.from(ids));

  const u = userMapById.get(message.user_id);
  if (u) message.user = u;

  if (message.reply_to_id) {
    // 先尝试用用户 Map 直接查 reply_to_id 对应的 user（同作者场景）
    let replyUser = userMapById.get(message.reply_to_id);
    // 若没查到，尝试从 allMessages 里找到 reply_to_id 对应消息的 user_id
    if (!replyUser && allMessages) {
      const target = allMessages.find((m) => m.id === message.reply_to_id);
      if (target) {
        const replyMap = await getProfilesByIds([target.user_id]);
        replyUser = replyMap.get(target.user_id);
      }
    }
    if (replyUser) message.reply_to_user = replyUser;
  }

  return message;
}

/** 对外：读取当前登录用户（优先 Supabase，fallback mock） */
export async function getCurrentUserProfile(): Promise<User | null> {
  if (!isSupabaseConfigured()) {
    warnSupabaseNotConfigured("profiles");
    return delay(mockCurrentUser);
  }
  // Supabase 路径的“当前用户”解析由 AuthProvider + useUserStore 负责，
  // 这里只提供底层读取接口；真实调用点在 auth/profile 逻辑里。
  return null;
}
