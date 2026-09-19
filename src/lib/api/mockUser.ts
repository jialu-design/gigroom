/**
 * Mock fallback 路径的用户解析（DEMO 环境）
 *
 * 背景：NEXT_PUBLIC_DATA_SOURCE=mock 时，行为写入走 mock fallback。
 * fallback 此前只认 mock userMap（user-1~N），而当前登录用户是
 * 真实 Supabase Auth 用户（UUID id），不在 userMap 中，导致
 * 发消息/发帖报 "User not found"。本 helper 统一解析：
 * 1. mock 用户（测试数据作者）→ userMap
 * 2. 当前登录用户 → useUserStore 快照（来自 profiles 表）
 * 3. 其他（ghost）→ undefined，调用方继续抛 "User not found"
 */
import type { User } from "@/lib/types";
import { userMap } from "@/mocks/users";
import { useUserStore } from "@/lib/stores/useUserStore";

export function resolveMockAuthor(userId: string): User | undefined {
  const mockUser = userMap.get(userId);
  if (mockUser) return mockUser;
  const storeUser = useUserStore.getState().user;
  if (storeUser && storeUser.id === userId) return storeUser;
  return undefined;
}
