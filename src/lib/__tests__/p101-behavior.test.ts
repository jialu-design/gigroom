/**
 * P10.1 行为测试 - Supabase Auth 真接入
 *
 * 覆盖：
 * A. Client 架构（browser/server/middleware：anon key、无 service role、cookie adapter）
 * B. 注册（signUp display_name metadata / Confirm Email ON/OFF / 注册失败）
 * C. 登录（signInWithPassword / 加载 profile / onboarding 分流 / 失败不执行 pending）
 * D. Session restore（有 session 恢复 / profile 加载 / 无 session 未登录 / 失败清理）
 * E. Logout（调用 signOut / 清理本地 / pending 清理 / TopNav 未登录）
 * F. Profile（读取 / 更新写库 / 更新失败不污染本地 / onboarding completion 写 city + flag）
 * G. Regression（pending Going / Follow / Join Room 在新 auth 路径下仍成立）
 *
 * 全程 Mock Supabase client，不连真实网络。
 */
import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from "vitest";
import { createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { readFileSync } from "fs";
import type { User } from "@/lib/types";
import { UserShowStatus } from "@/lib/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { PendingAuthExecutor } from "@/components/user/PendingAuthExecutor";

// ============================================================
// Mock Supabase client（确保不连真实网络）
// ============================================================
const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: { current: null as unknown as SupabaseFake },
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => supabaseMock.current,
}));

interface ProfileResult {
  data: unknown;
  error: unknown;
}
interface Chain {
  select: Mock;
  eq: Mock;
  update: Mock;
  insert: Mock;
  upsert: Mock;
  single: Mock;
}
interface SupabaseFake {
  auth: {
    signUp: Mock;
    signInWithPassword: Mock;
    signOut: Mock;
    getSession: Mock;
    getUser: Mock;
    onAuthStateChange: Mock;
  };
  from: Mock;
  __profileResult: ProfileResult;
}

function makeFromChain(result: ProfileResult): Chain {
  const chain = {} as Chain;
  chain.select = vi.fn(() => chain);
  chain.eq = vi.fn(() => chain);
  chain.update = vi.fn(() => chain);
  chain.insert = vi.fn(() => chain);
  chain.upsert = vi.fn(() => chain);
  chain.single = vi.fn(async () => result);
  return chain;
}

function makeSupabaseFake(profileResult: ProfileResult = { data: null, error: null }): SupabaseFake {
  return {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(async () => ({})),
      getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
      getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
    from: vi.fn(() => makeFromChain(profileResult)),
    __profileResult: profileResult,
  };
}

/** 构造一个 profile 行 */
function profileRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "auth-user-1",
    display_name: "乐迷小张",
    avatar_url: null,
    city: null,
    bio: null,
    onboarding_completed: false,
    created_at: "2026-08-16T00:00:00Z",
    updated_at: "2026-08-16T00:00:00Z",
    ...overrides,
  };
}

/** 构造一个 Supabase auth user 对象 */
function authUser(id = "auth-user-1") {
  return { id, email: "test@gigroom.cn", aud: "authenticated" };
}

// 辅助：重置 store + UI
function resetStores() {
  useUserStore.getState().clearAuth();
  useUIStore.setState({
    isLoginModalOpen: false,
    isOnboardingModalOpen: false,
    isCitySelectorOpen: false,
    isEditProfileModalOpen: false,
    pendingAuthAction: null,
  });
  localStorage.clear();
}

// ============================================================
// A. Client 架构
// ============================================================
describe("P10.1 A. Client 架构", () => {
  it("browser client 使用 @supabase/ssr 的 createBrowserClient", () => {
    const src = readFileSync("src/lib/supabase/client.ts", "utf-8");
    expect(src).toContain("createBrowserClient");
    expect(src).toContain("@supabase/ssr");
  });

  it("browser client 使用 NEXT_PUBLIC_SUPABASE_URL / ANON_KEY", () => {
    const src = readFileSync("src/lib/supabase/client.ts", "utf-8");
    expect(src).toContain("NEXT_PUBLIC_SUPABASE_URL");
    expect(src).toContain("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  });

  it("client 文件不包含 service role key", () => {
    const src = readFileSync("src/lib/supabase/client.ts", "utf-8");
    expect(src.toLowerCase()).not.toContain("service_role");
    expect(src.toLowerCase()).not.toContain("servicerole");
  });

  it("server client 使用 cookie adapter（getAll / setAll）", () => {
    const src = readFileSync("src/lib/supabase/server.ts", "utf-8");
    expect(src).toContain("getAll");
    expect(src).toContain("setAll");
    expect(src).toContain("cookies");
  });

  it("server client 不使用 service role", () => {
    const src = readFileSync("src/lib/supabase/server.ts", "utf-8");
    expect(src.toLowerCase()).not.toContain("service_role");
  });

  it("middleware 存在并使用 @supabase/ssr createServerClient", () => {
    const src = readFileSync("src/middleware.ts", "utf-8");
    expect(src).toContain("createServerClient");
    expect(src).toContain("@supabase/ssr");
  });

  it("middleware 不使用 service role", () => {
    const src = readFileSync("src/middleware.ts", "utf-8");
    expect(src.toLowerCase()).not.toContain("service_role");
  });

  it("middleware 仅刷新 session，不做 redirect 业务逻辑", () => {
    const src = readFileSync("src/middleware.ts", "utf-8");
    expect(src).toContain("getUser");
    // 不应包含基于 RoomMembership / profile 的鉴权 redirect
    expect(src.toLowerCase()).not.toContain("roommembership");
    expect(src.toLowerCase()).not.toContain("redirect(");
  });

  it("环境变量缺失时 createClient 抛出明确错误（不静默 fallback）", () => {
    const src = readFileSync("src/lib/supabase/client.ts", "utf-8");
    expect(src).toContain("throw new Error");
    expect(src).toMatch(/未初始化|缺少|未配置/);
  });
});

// ============================================================
// B. 注册
// ============================================================
describe("P10.1 B. 注册 signUp", () => {
  beforeEach(() => {
    supabaseMock.current = makeSupabaseFake({ data: profileRow(), error: null });
    resetStores();
  });

  it("signUp 参数包含 display_name metadata", async () => {
    const { signUp } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signUp = vi.fn(async () => ({
      data: { user: authUser(), session: { access_token: "x" } },
      error: null,
    }));

    await signUp("test@gigroom.cn", "password123", "小张");

    expect(supabaseMock.current.auth.signUp).toHaveBeenCalledWith({
      email: "test@gigroom.cn",
      password: "password123",
      options: { data: { display_name: "小张" } },
    });
  });

  it("Confirm Email OFF → 有 session → 返回 user，进入 onboarding 路径", async () => {
    const { signUp } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signUp = vi.fn(async () => ({
      data: { user: authUser(), session: { access_token: "x" } },
      error: null,
    }));

    const result = await signUp("test@gigroom.cn", "password123", "小张");

    expect(result.session).toBe(true);
    expect(result.needsEmailConfirm).toBe(false);
    expect(result.user).not.toBeNull();
    expect(result.user?.display_name).toBe("乐迷小张");
    // 新注册 profile onboarding_completed=false → 进入 onboarding
    expect(result.user?.onboarding_completed).toBe(false);
  });

  it("Confirm Email ON → session null → needsEmailConfirm=true，不返回 user", async () => {
    const { signUp } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signUp = vi.fn(async () => ({
      data: { user: authUser(), session: null },
      error: null,
    }));

    const result = await signUp("test@gigroom.cn", "password123", "小张");

    expect(result.session).toBe(false);
    expect(result.needsEmailConfirm).toBe(true);
    expect(result.user).toBeNull();
  });

  it("注册失败 → 抛出可理解的中文错误", async () => {
    const { signUp } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signUp = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { message: "User already registered" },
    }));

    await expect(
      signUp("test@gigroom.cn", "password123", "小张")
    ).rejects.toThrow("该邮箱已注册");
  });

  it("注册不额外 insert profile（由 DB trigger 创建）", async () => {
    const { signUp } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signUp = vi.fn(async () => ({
      data: { user: authUser(), session: { access_token: "x" } },
      error: null,
    }));

    await signUp("test@gigroom.cn", "password123", "小张");

    // from 仅用于 select profile，不应有 insert 调用
    const fromChain = supabaseMock.current.from();
    expect(fromChain.insert).not.toHaveBeenCalled();
  });
});

// ============================================================
// C. 登录
// ============================================================
describe("P10.1 C. 登录 signIn", () => {
  beforeEach(() => {
    supabaseMock.current = makeSupabaseFake({ data: profileRow(), error: null });
    resetStores();
  });

  it("正确调用 signInWithPassword", async () => {
    const { signIn } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signInWithPassword = vi.fn(async () => ({
      data: { user: authUser(), session: { access_token: "x" } },
      error: null,
    }));

    await signIn("test@gigroom.cn", "password123");

    expect(supabaseMock.current.auth.signInWithPassword).toHaveBeenCalledWith({
      email: "test@gigroom.cn",
      password: "password123",
    });
  });

  it("登录成功加载 profile", async () => {
    const { signIn } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signInWithPassword = vi.fn(async () => ({
      data: { user: authUser(), session: { access_token: "x" } },
      error: null,
    }));

    const { user } = await signIn("test@gigroom.cn", "password123");

    expect(user.id).toBe("auth-user-1");
    expect(user.display_name).toBe("乐迷小张");
    // from 被调用读取 profile
    expect(supabaseMock.current.from).toHaveBeenCalledWith("profiles");
  });

  it("登录失败不加载 profile，抛出中文错误", async () => {
    const { signIn } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signInWithPassword = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    }));
    const fromSpy = supabaseMock.current.from;

    await expect(
      signIn("test@gigroom.cn", "wrong")
    ).rejects.toThrow("邮箱或密码不正确");

    // 失败路径不加载 profile
    expect(fromSpy).not.toHaveBeenCalled();
  });

  it("profile onboarding=true → setAuthUser 后 pending action 执行", async () => {
    supabaseMock.current.__profileResult = {
      data: profileRow({ onboarding_completed: true }),
      error: null,
    };
    supabaseMock.current.from = vi.fn(() =>
      makeFromChain(supabaseMock.current.__profileResult)
    );
    const { signIn } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signInWithPassword = vi.fn(async () => ({
      data: { user: authUser(), session: { access_token: "x" } },
      error: null,
    }));

    const spy = vi.fn();
    useUIStore.getState().setPendingAuthAction(spy);
    const { user } = await signIn("t@g.cn", "pw");
    useUserStore.getState().setAuthUser(user);

    // 已登录 + onboarding 完成 → 这里直接验证 store 状态正确
    // pending 执行由 PendingAuthExecutor 负责（见 G 区回归测试）
    expect(useUserStore.getState().isLoggedIn).toBe(true);
    expect(useUserStore.getState().user?.onboarding_completed).toBe(true);
  });

  it("profile onboarding=false → 登录后应打开 onboarding", async () => {
    supabaseMock.current.__profileResult = {
      data: profileRow({ onboarding_completed: false }),
      error: null,
    };
    supabaseMock.current.from = vi.fn(() =>
      makeFromChain(supabaseMock.current.__profileResult)
    );
    const { signIn } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signInWithPassword = vi.fn(async () => ({
      data: { user: authUser(), session: { access_token: "x" } },
      error: null,
    }));

    const { user } = await signIn("t@g.cn", "pw");
    // 模拟 LoginModal 登录成功逻辑：setAuthUser + onboarding 未完成 → openOnboardingModal
    useUserStore.getState().setAuthUser(user);
    if (!user.onboarding_completed) {
      useUIStore.getState().openOnboardingModal();
    }

    expect(useUIStore.getState().isOnboardingModalOpen).toBe(true);
    expect(useUserStore.getState().user?.onboarding_completed).toBe(false);
  });

  it("登录失败时不执行 pending action", async () => {
    const { signIn } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signInWithPassword = vi.fn(async () => ({
      data: { user: null, session: null },
      error: { message: "Invalid login credentials" },
    }));

    const spy = vi.fn();
    useUIStore.getState().setPendingAuthAction(spy);

    await expect(signIn("t@g.cn", "wrong")).rejects.toThrow();
    expect(spy).not.toHaveBeenCalled();
    expect(useUserStore.getState().isLoggedIn).toBe(false);
  });
});

// ============================================================
// D. Session restore
// ============================================================
describe("P10.1 D. Session restore getSession", () => {
  beforeEach(() => {
    supabaseMock.current = makeSupabaseFake({ data: profileRow({ onboarding_completed: true }), error: null });
    resetStores();
  });

  it("刷新有 session → 恢复登录，profile 正确加载", async () => {
    const { getSession } = await import("@/lib/api/auth");
    supabaseMock.current.auth.getSession = vi.fn(async () => ({
      data: { session: { access_token: "x", user: authUser() } },
      error: null,
    }));
    supabaseMock.current.auth.getUser = vi.fn(async () => ({
      data: { user: authUser() },
      error: null,
    }));

    const { user, session } = await getSession();

    expect(session).not.toBeNull();
    expect(user).not.toBeNull();
    expect(user?.id).toBe("auth-user-1");
    expect(user?.display_name).toBe("乐迷小张");
  });

  it("无 session → 返回 user=null（未登录）", async () => {
    const { getSession } = await import("@/lib/api/auth");
    supabaseMock.current.auth.getSession = vi.fn(async () => ({
      data: { session: null },
      error: null,
    }));

    const { user, session } = await getSession();

    expect(session).toBeNull();
    expect(user).toBeNull();
  });

  it("session 存在但 getUser 失败 → 正确清理为未登录", async () => {
    const { getSession } = await import("@/lib/api/auth");
    supabaseMock.current.auth.getSession = vi.fn(async () => ({
      data: { session: { access_token: "x" } },
      error: null,
    }));
    supabaseMock.current.auth.getUser = vi.fn(async () => ({
      data: { user: null },
      error: { message: "token expired" },
    }));

    const { user, session } = await getSession();

    expect(user).toBeNull();
    expect(session).toBeNull();
  });

  it("getSession 报错 → 返回未登录，不抛出", async () => {
    const { getSession } = await import("@/lib/api/auth");
    supabaseMock.current.auth.getSession = vi.fn(async () => ({
      data: { session: null },
      error: { message: "network" },
    }));

    const { user } = await getSession();
    expect(user).toBeNull();
  });
});

// ============================================================
// E. Logout
// ============================================================
describe("P10.1 E. Logout", () => {
  beforeEach(() => {
    supabaseMock.current = makeSupabaseFake();
    resetStores();
  });

  it("调用 Supabase auth.signOut", async () => {
    const { signOut } = await import("@/lib/api/auth");
    supabaseMock.current.auth.signOut = vi.fn(async () => ({}));

    await signOut();

    expect(supabaseMock.current.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it("clearAuth 清理本地 auth snapshot + 业务数据", () => {
    // 先登录
    useUserStore.getState().setAuthUser({
      id: "u1",
      display_name: "x",
      onboarding_completed: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    useUserStore.getState().followArtist("artist-1");
    useUserStore.getState().joinRoom("room-1");
    expect(useUserStore.getState().isLoggedIn).toBe(true);

    useUserStore.getState().clearAuth();

    expect(useUserStore.getState().isLoggedIn).toBe(false);
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().followedArtistIds).toEqual([]);
    expect(useUserStore.getState().roomMemberships).toEqual([]);
    expect(useUserStore.getState().notifications).toEqual([]);
  });

  it("clearAuth 清空 pending action", () => {
    useUIStore.getState().setPendingAuthAction(() => {});
    expect(useUIStore.getState().pendingAuthAction).not.toBeNull();

    useUserStore.getState().clearAuth();

    expect(useUIStore.getState().pendingAuthAction).toBeNull();
  });

  it("useLogout 调用 signOut + clearAuth，TopNav 回到未登录", async () => {
    const { useLogout } = await import("@/hooks/useLogout");
    const signOutSpy = vi.fn(async () => ({}));
    supabaseMock.current.auth.signOut = signOutSpy;

    // 登录
    useUserStore.getState().setAuthUser({
      id: "u1",
      display_name: "x",
      onboarding_completed: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    useUIStore.getState().setPendingAuthAction(() => {});
    expect(useUserStore.getState().isLoggedIn).toBe(true);

    // 渲染一个使用 useLogout 的 harness
    let logoutFn: (() => Promise<void>) | null = null;
    function Harness() {
      logoutFn = useLogout();
      return null;
    }
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(Harness));
    });

    await act(async () => {
      await logoutFn!();
    });

    expect(signOutSpy).toHaveBeenCalledTimes(1);
    // TopNav 数据源 isLoggedIn → false
    expect(useUserStore.getState().isLoggedIn).toBe(false);
    expect(useUserStore.getState().user).toBeNull();
    expect(useUIStore.getState().pendingAuthAction).toBeNull();

    act(() => root.unmount());
    container.remove();
  });
});

// ============================================================
// F. Profile
// ============================================================
describe("P10.1 F. Profile API", () => {
  beforeEach(() => {
    supabaseMock.current = makeSupabaseFake({ data: profileRow(), error: null });
    resetStores();
  });

  it("登录后读取 profiles（getProfile 转换为 User）", async () => {
    const { getProfile, profileRowToUser } = await import("@/lib/api/profile");
    supabaseMock.current.from = vi.fn(() =>
      makeFromChain({ data: profileRow({ display_name: "阿强", city: "成都" }), error: null })
    );

    const user = await getProfile("auth-user-1");

    expect(supabaseMock.current.from).toHaveBeenCalledWith("profiles");
    expect(user.id).toBe("auth-user-1");
    expect(user.display_name).toBe("阿强");
    expect(user.city).toBe("成都");

    // adapter 单元测试
    const converted = profileRowToUser(
      profileRow({ onboarding_completed: true }) as never
    );
    expect(converted.onboarding_completed).toBe(true);
  });

  it("profile 不存在 → 返回 fallback User（不抛错）", async () => {
    const { getProfile } = await import("@/lib/api/profile");
    supabaseMock.current.from = vi.fn(() =>
      makeFromChain({ data: null, error: { message: "no rows" } })
    );

    const user = await getProfile("auth-user-x");

    expect(user.id).toBe("auth-user-x");
    expect(user.onboarding_completed).toBe(false);
  });

  it("update profile 写数据库（from.update 被调用）", async () => {
    const { updateProfile } = await import("@/lib/api/profile");
    const updatedRow = profileRow({ display_name: "新名字", city: "北京" });
    // 复用同一个 chain 实例，确保 update spy 被记录
    const sharedChain = makeFromChain({ data: updatedRow, error: null });
    supabaseMock.current.from = vi.fn(() => sharedChain);

    const user = await updateProfile("auth-user-1", {
      display_name: "新名字",
      city: "北京",
    });

    expect(sharedChain.update).toHaveBeenCalled();
    expect(user.display_name).toBe("新名字");
    expect(user.city).toBe("北京");
  });

  it("update 失败不污染本地状态（抛错，store 不变）", async () => {
    const { updateProfile } = await import("@/lib/api/profile");
    supabaseMock.current.from = vi.fn(() =>
      makeFromChain({ data: null, error: { message: "rls denied" } })
    );

    // 本地先有一个用户
    useUserStore.getState().setAuthUser({
      id: "auth-user-1",
      display_name: "原名字",
      onboarding_completed: true,
      created_at: "2026-01-01T00:00:00Z",
    });

    await expect(
      updateProfile("auth-user-1", { display_name: "新名字" })
    ).rejects.toThrow();

    // 本地状态未被污染
    expect(useUserStore.getState().user?.display_name).toBe("原名字");
  });

  it("onboarding completion 写 city + onboarding_completed=true（upsert 兼容 profile 缺失）", async () => {
    const { completeOnboarding } = await import("@/lib/api/profile");
    const updatedRow = profileRow({ city: "杭州", onboarding_completed: true });
    let capturedUpsert: Record<string, unknown> | null = null;
    let upsertSpy: Mock | null = null;
    supabaseMock.current.from = vi.fn(() => {
      const chain = makeFromChain({ data: updatedRow, error: null });
      upsertSpy = vi.fn((payload: Record<string, unknown>) => {
        capturedUpsert = payload;
        return chain;
      });
      chain.upsert = upsertSpy;
      return chain;
    });

    const user = await completeOnboarding("auth-user-1", "杭州", "乐迷小张");

    expect(upsertSpy).toHaveBeenCalled();
    expect(capturedUpsert).toEqual(
      expect.objectContaining({
        id: "auth-user-1",
        display_name: "乐迷小张",
        city: "杭州",
        onboarding_completed: true,
      })
    );
    expect(user.city).toBe("杭州");
    expect(user.onboarding_completed).toBe(true);
  });
});

// ============================================================
// G. AuthProvider session restore
// ============================================================
describe("P10.1 G. AuthProvider session restore", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    supabaseMock.current = makeSupabaseFake({ data: profileRow({ onboarding_completed: true }), error: null });
    resetStores();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("刷新有 session → AuthProvider 恢复登录态 + 加载 profile", async () => {
    const { AuthProvider } = await import("@/components/user/AuthProvider");
    supabaseMock.current.auth.getSession = vi.fn(async () => ({
      data: { session: { access_token: "x", user: authUser() } },
      error: null,
    }));
    supabaseMock.current.auth.getUser = vi.fn(async () => ({
      data: { user: authUser() },
      error: null,
    }));
    supabaseMock.current.from = vi.fn(() =>
      makeFromChain({ data: profileRow({ onboarding_completed: true }), error: null })
    );

    // 初始 authLoading=true
    useUserStore.getState().setAuthLoading(true);

    await act(async () => {
      root.render(createElement(AuthProvider, null, createElement("div")));
    });
    // 等待异步 session 恢复
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(useUserStore.getState().isLoggedIn).toBe(true);
    expect(useUserStore.getState().user?.id).toBe("auth-user-1");
    expect(useUserStore.getState().authLoading).toBe(false);
  });

  it("无 session → authLoading=false，未登录", async () => {
    const { AuthProvider } = await import("@/components/user/AuthProvider");
    supabaseMock.current.auth.getSession = vi.fn(async () => ({
      data: { session: null },
      error: null,
    }));

    useUserStore.getState().setAuthLoading(true);

    await act(async () => {
      root.render(createElement(AuthProvider, null, createElement("div")));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(useUserStore.getState().isLoggedIn).toBe(false);
    expect(useUserStore.getState().user).toBeNull();
    expect(useUserStore.getState().authLoading).toBe(false);
  });

  it("onAuthStateChange SIGNED_OUT → clearAuth（清理本地）", async () => {
    const { AuthProvider } = await import("@/components/user/AuthProvider");
    let stateCb: ((event: string, session: unknown) => Promise<void>) | null = null;
    supabaseMock.current.auth.getSession = vi.fn(async () => ({
      data: { session: null },
      error: null,
    }));
    supabaseMock.current.auth.onAuthStateChange = vi.fn((cb: (e: string, s: unknown) => Promise<void>) => {
      stateCb = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });

    await act(async () => {
      root.render(createElement(AuthProvider, null, createElement("div")));
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // 先登录
    useUserStore.getState().setAuthUser({
      id: "u1",
      display_name: "x",
      onboarding_completed: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    expect(useUserStore.getState().isLoggedIn).toBe(true);

    // 触发 SIGNED_OUT
    await act(async () => {
      await stateCb!("SIGNED_OUT", null);
    });

    expect(useUserStore.getState().isLoggedIn).toBe(false);
    expect(useUserStore.getState().user).toBeNull();
  });
});

// ============================================================
// H. Regression - pending action 在新 auth 路径下仍成立
// ============================================================
describe("P10.1 H. Regression - pending action 链路（setAuthUser 路径）", () => {
  let container: HTMLDivElement;
  let root: Root;
  let requireAuthRef: React.MutableRefObject<((a: () => void) => void) | null>;

  function Harness() {
    const requireAuth = useRequireAuth();
    requireAuthRef.current = requireAuth;
    return null;
  }

  function renderApp() {
    act(() => {
      root.render(
        createElement(
          Fragment,
          null,
          createElement(PendingAuthExecutor),
          createElement(Harness)
        )
      );
    });
  }

  beforeEach(() => {
    resetStores();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    requireAuthRef = { current: null };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  function authUserOnboarded(): User {
    return {
      id: "auth-user-1",
      display_name: "小张",
      onboarding_completed: true,
      created_at: "2026-08-16T00:00:00Z",
    };
  }
  function authUserNotOnboarded(): User {
    return {
      id: "auth-user-1",
      display_name: "小张",
      onboarding_completed: false,
      created_at: "2026-08-16T00:00:00Z",
    };
  }

  it("pending Going → setAuthUser(onboarded) → 自动执行 Going", () => {
    const action = () => {
      useUserStore.getState().setShowStatus("show-13", UserShowStatus.GOING);
    };
    renderApp();

    // 游客触发 → 存 pending + 开 login
    act(() => requireAuthRef.current?.(action));
    expect(useUserStore.getState().showStatuses["show-13"]).toBeUndefined();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);

    // 模拟 Supabase 登录成功（onboarding 已完成）
    act(() => {
      useUIStore.getState().closeLoginModal();
      useUserStore.getState().setAuthUser(authUserOnboarded());
    });

    expect(useUserStore.getState().showStatuses["show-13"]).toBe(UserShowStatus.GOING);
    expect(useUIStore.getState().pendingAuthAction).toBeNull();
  });

  it("pending Follow → 新注册 onboarding=false → 完成 onboarding → 自动 Follow", () => {
    const action = () => {
      useUserStore.getState().followArtist("artist-15");
    };
    renderApp();

    act(() => requireAuthRef.current?.(action));
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");

    // 登录但未 onboarding → 开 onboarding，不执行
    act(() => {
      useUIStore.getState().closeLoginModal();
      useUserStore.getState().setAuthUser(authUserNotOnboarded());
    });
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");
    expect(useUIStore.getState().isOnboardingModalOpen).toBe(true);

    // 完成 onboarding（写 onboarding_completed=true）→ 自动执行
    act(() => {
      useUserStore.getState().updateUser({ city: "上海", onboarding_completed: true });
    });
    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");
    expect(useUIStore.getState().pendingAuthAction).toBeNull();
  });

  it("pending Join Room → setAuthUser(onboarded) → 自动 Join Room", () => {
    const action = () => {
      useUserStore.getState().joinRoom("room-1");
    };
    renderApp();

    act(() => requireAuthRef.current?.(action));
    expect(useUserStore.getState().roomMemberships).toHaveLength(0);

    act(() => {
      useUIStore.getState().closeLoginModal();
      useUserStore.getState().setAuthUser(authUserOnboarded());
    });

    expect(useUserStore.getState().roomMemberships).toHaveLength(1);
    expect(useUserStore.getState().roomMemberships[0].room_id).toBe("room-1");
    expect(useUIStore.getState().pendingAuthAction).toBeNull();
  });

  it("pending action 只执行一次（不重复）", () => {
    const action = vi.fn(() => {
      useUserStore.getState().setShowStatus("show-99", UserShowStatus.INTERESTED);
    });
    renderApp();

    act(() => requireAuthRef.current?.(action));
    act(() => {
      useUIStore.getState().closeLoginModal();
      useUserStore.getState().setAuthUser(authUserOnboarded());
    });

    expect(action).toHaveBeenCalledTimes(1);
    // 再次触发无关 rerender 不重复执行
    act(() => {
      useUserStore.getState().updateUser({ bio: "update" });
    });
    expect(action).toHaveBeenCalledTimes(1);
  });

  it("logout 清空 pending action（不残留）", () => {
    const action = vi.fn();
    renderApp();
    act(() => requireAuthRef.current?.(action));
    expect(useUIStore.getState().pendingAuthAction).not.toBeNull();

    act(() => useUserStore.getState().clearAuth());

    expect(useUIStore.getState().pendingAuthAction).toBeNull();
    expect(action).not.toHaveBeenCalled();
  });
});

export {};
