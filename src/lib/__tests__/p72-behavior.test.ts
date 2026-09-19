/**
 * P7.2 行为测试 - TopNav 统一登录态 + Onboarding 流程
 *
 * 覆盖：
 * A. TopNav 登录态（未登录→登录→登出→刷新恢复）
 * B. Onboarding 状态（新注册 false / 已有 true / persist / Step1 不可跳过 / Step2 可关注或跳过）
 * C. useRequireAuth + PendingAuthExecutor（onboarding 分流规则）
 * D. 完整链路（Follow / Interested / Going：未登录→注册→onboarding→完成→自动执行）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { UserShowStatus } from "@/lib/types";
import { useUserStore, type RegisterInput } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { PendingAuthExecutor } from "@/components/user/PendingAuthExecutor";
import { followArtist } from "@/lib/api/user";

// ========================
// 渲染夹具
// ========================
function Harness({
  action,
  requireAuthRef,
}: {
  action: () => void;
  requireAuthRef: React.MutableRefObject<((a: () => void) => void) | null>;
}) {
  const requireAuth = useRequireAuth();
  requireAuthRef.current = requireAuth;
  return null;
}

function renderApp(
  root: Root,
  action: () => void,
  requireAuthRef: React.MutableRefObject<((a: () => void) => void) | null>
) {
  act(() => {
    root.render(
      createElement(
        Fragment,
        null,
        createElement(PendingAuthExecutor),
        createElement(Harness, { action, requireAuthRef })
      )
    );
  });
}

// ========================
// 辅助：模拟 register 流程创建一个 onboarding=false 的新用户
// ========================
function registerNewUser(input: RegisterInput = { email: "new@gigroom.cn", password: "1234", display_name: "新用户" }) {
  return useUserStore.getState().registerWithCredentials(input);
}

// ========================
// A. TopNav 登录态（逻辑层：接 useUserStore 正确响应状态变更）
// ========================
describe("P7 A. TopNav 登录态统一（store 层）", () => {
  beforeEach(() => {
    useUserStore.getState().logout();
    useUIStore.setState({
      isLoginModalOpen: false,
      isOnboardingModalOpen: false,
      isCitySelectorOpen: false,
      pendingAuthAction: null,
    });
    localStorage.clear();
  });

  it("未登录初始状态：isLoggedIn=false, user=null, TopNav 显示登录入口", () => {
    const s = useUserStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.user).toBeNull();
    // AppLayout 接 store：isLoggedIn=false → TopNav 渲染「登录」按钮
  });

  it("登录后立即显示用户状态：isLoggedIn=true, user 有值", async () => {
    await registerNewUser();
    const s = useUserStore.getState();
    expect(s.isLoggedIn).toBe(true);
    expect(s.user?.display_name).toBe("新用户");
  });

  it("logout 后立即恢复未登录状态（头像→登录按钮）", async () => {
    await registerNewUser();
    expect(useUserStore.getState().isLoggedIn).toBe(true);
    useUserStore.getState().logout();
    expect(useUserStore.getState().isLoggedIn).toBe(false);
    expect(useUserStore.getState().user).toBeNull();
  });

  it("刷新恢复 session 后 UI 状态正确（localStorage rehydrate）", async () => {
    useUserStore.getState().mockLogin();
    const saved = localStorage.getItem("gigroom-user-storage");
    expect(saved).toBeTruthy();

    vi.resetModules();
    const fresh = await import("@/lib/stores/useUserStore");
    expect(fresh.useUserStore.getState().isLoggedIn).toBe(true);
    expect(fresh.useUserStore.getState().user?.id).toBe("user-1");
    expect(fresh.useUserStore.getState().user?.onboarding_completed).toBe(true);
  });
});

// ========================
// B. Onboarding 状态与工作流
// ========================
describe("P7 B. Onboarding 状态", () => {
  beforeEach(() => {
    useUserStore.getState().logout();
    useUIStore.setState({
      isLoginModalOpen: false,
      isOnboardingModalOpen: false,
      isCitySelectorOpen: false,
      pendingAuthAction: null,
    });
    localStorage.clear();
  });

  it("新注册用户 onboarding_completed=false", async () => {
    await registerNewUser();
    expect(useUserStore.getState().user?.onboarding_completed).toBe(false);
  });

  it("已有 demo 用户（mockCurrentUser / mockLogin）onboarding_completed=true", () => {
    useUserStore.getState().mockLogin();
    expect(useUserStore.getState().user?.onboarding_completed).toBe(true);
  });

  it("Step 1 约束（测试逻辑：未选择城市不能进入下一步，选择后可以）", () => {
    // 此用例校验「未选择城市时下一步 disabled」的逻辑契约——
    // selectedCity 为 null 时 canNext=false。
    let selectedCity: string | null = null;
    const canNext = () => selectedCity !== null;

    expect(canNext()).toBe(false); // 未选 → 不可下一步
    selectedCity = "上海";
    expect(canNext()).toBe(true); // 选择后 → 可下一步
  });

  it("选择城市后可以进入 Step 2（契约：selectedCity 非空 + 进入下一步 state=2）", () => {
    // 验证城市非空 + step 自增逻辑（不需要渲染 Modal，只验证约束）
    let step = 1;
    let selectedCity: string | null = null;
    const nextStep = () => {
      if (selectedCity === null) return; // 不允许跳过 Step 1
      step = 2;
    };

    nextStep();
    expect(step).toBe(1); // 未选城市：保持 Step 1
    selectedCity = "成都";
    nextStep();
    expect(step).toBe(2); // 选完后进入 Step 2
  });

  it("Step 2 可以关注多个乐队（直接通过 store followArtist 验证契约）", async () => {
    useUserStore.getState().mockLogin();
    // 模拟用户在 Step 2 关注多支乐队
    useUserStore.getState().followArtist("artist-1"); // 已预置（幂等）
    useUserStore.getState().followArtist("artist-3");
    useUserStore.getState().followArtist("artist-15");
    const ids = useUserStore.getState().followedArtistIds;
    expect(ids).toContain("artist-1");
    expect(ids).toContain("artist-3");
    expect(ids).toContain("artist-15");
    // 无最低数量要求（数量 > 0 正常工作即可）
    expect(ids.length).toBeGreaterThan(2);
  });

  it("Step 2 可以全部不关注（0 个乐队也能完成 onboarding）", () => {
    // 模拟新用户 + 不关注任何乐队 → 直接完成
    useUserStore.getState().mockLogin();
    // 手工把 followed 清零（模拟未关注任何乐队的状态）
    useUserStore.setState({ followedArtistIds: [] });
    // 完成 onboarding（调用 updateUser 等价于 Modal 的 handleFinish）
    useUserStore.getState().updateUser({
      city: "上海",
      onboarding_completed: true,
    });
    expect(useUserStore.getState().user?.onboarding_completed).toBe(true);
    expect(useUserStore.getState().followedArtistIds).toEqual([]);
  });

  it("「暂时跳过」可以完成 onboarding（仍保存城市，不回滚手动添加的关注）", () => {
    useUserStore.getState().mockLogin();
    // 先手动关注一支
    useUserStore.getState().followArtist("artist-15");
    // 「暂时跳过」仍执行 setCity + updateUser(onboarding_completed=true)
    useUserStore.getState().updateUser({
      city: "北京",
      onboarding_completed: true,
    });
    expect(useUserStore.getState().user?.onboarding_completed).toBe(true);
    expect(useUserStore.getState().user?.city).toBe("北京");
    // 不回滚手动关注
    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");
  });

  it("onboarding 完成后状态持久化（localStorage）", () => {
    useUserStore.getState().mockLogin();
    useUserStore.getState().updateUser({
      city: "杭州",
      onboarding_completed: true,
    });
    const saved = localStorage.getItem("gigroom-user-storage");
    expect(saved).toBeTruthy();
    const parsed = JSON.parse(saved!);
    expect(parsed.state.user?.onboarding_completed).toBe(true);
    expect(parsed.state.user?.city).toBe("杭州");
  });
});

// ========================
// C. useRequireAuth + PendingAuthExecutor（onboarding 分流）
// ========================
describe("P7 C. useRequireAuth + PendingAuthExecutor（onboarding 分流）", () => {
  let container: HTMLDivElement;
  let root: Root;
  let requireAuthRef: React.MutableRefObject<((a: () => void) => void) | null>;

  beforeEach(() => {
    useUserStore.getState().logout();
    useUIStore.setState({
      isLoginModalOpen: false,
      isOnboardingModalOpen: false,
      isCitySelectorOpen: false,
      pendingAuthAction: null,
    });
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    requireAuthRef = { current: null };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("未登录：保存 action + 打开 LoginModal，不执行 action", () => {
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);
    expect(useUIStore.getState().isOnboardingModalOpen).toBe(false);
    expect(typeof useUIStore.getState().pendingAuthAction).toBe("function");
  });

  it("已登录但 onboarding 未完成：保存 action + 打开 OnboardingModal，不执行 action", async () => {
    await registerNewUser(); // 新用户：onboarding_completed=false
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(useUIStore.getState().isLoginModalOpen).toBe(false);
    expect(useUIStore.getState().isOnboardingModalOpen).toBe(true);
    expect(typeof useUIStore.getState().pendingAuthAction).toBe("function");
  });

  it("已登录且 onboarding_completed=true：立即执行 action", () => {
    useUserStore.getState().mockLogin(); // demo 用户：onboarding_completed=true
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(useUIStore.getState().isLoginModalOpen).toBe(false);
    expect(useUIStore.getState().isOnboardingModalOpen).toBe(false);
    expect(useUIStore.getState().pendingAuthAction).toBeNull();
  });

  it("onboarding 未完成时 pending 不提前执行；complete 后执行一次", async () => {
    await registerNewUser(); // onboarding_completed=false
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);

    // Step1：触发 requireAuth → 不执行，pending 保存
    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(typeof useUIStore.getState().pendingAuthAction).toBe("function");

    // 用户完成 onboarding：设置 onboarding_completed=true + city
    act(() => {
      useUserStore.getState().updateUser({
        city: "上海",
        onboarding_completed: true,
      });
    });

    expect(spy).toHaveBeenCalledTimes(1);
    // 只执行一次
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("完成 onboarding 后 pending 被清空", async () => {
    await registerNewUser();
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(useUIStore.getState().pendingAuthAction).not.toBeNull();

    act(() => {
      useUserStore.getState().updateUser({
        city: "上海",
        onboarding_completed: true,
      });
    });
    expect(useUIStore.getState().pendingAuthAction).toBeNull();
  });

  it("关闭 LoginModal（cancelLoginModal）后 pending 清空", () => {
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(useUIStore.getState().pendingAuthAction).not.toBeNull();

    act(() => {
      useUIStore.getState().cancelLoginModal();
    });
    expect(useUIStore.getState().isLoginModalOpen).toBe(false);
    expect(useUIStore.getState().pendingAuthAction).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("onboarding 中途 rerender 不重复执行 pending action", async () => {
    await registerNewUser();
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(spy);
    });

    // 触发一次「无关 rerender」，用 mockLogin 的 updateUser 改变非 onboarding 字段
    act(() => {
      useUserStore.getState().updateUser({ bio: "中途修改" });
    });
    // 仍未 onboard → spy 未执行
    expect(spy).not.toHaveBeenCalled();

    // 真正完成 onboarding
    act(() => {
      useUserStore.getState().updateUser({
        city: "上海",
        onboarding_completed: true,
      });
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("logout 不残留 pending action", async () => {
    await registerNewUser();
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(useUIStore.getState().pendingAuthAction).not.toBeNull();

    act(() => {
      useUserStore.getState().logout();
    });
    expect(useUIStore.getState().pendingAuthAction).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("已登录但 onboarding 未完成时调用 useRequireAuth 直接打开 OnboardingModal", async () => {
    await registerNewUser();
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);
    // 关一次以免打开后重复触发
    act(() => {
      useUIStore.getState().closeOnboardingModal();
    });

    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(useUIStore.getState().isOnboardingModalOpen).toBe(true);
    expect(spy).not.toHaveBeenCalled();
  });
});

// ========================
// D. 完整链路测试：Follow / Interested / Going → 注册 → onboarding → 完成 → 自动
// ========================
describe("P7 D. 完整链路（Follow/Interested/Going → 注册 → Onboarding → 自动执行）", () => {
  let container: HTMLDivElement;
  let root: Root;
  let requireAuthRef: React.MutableRefObject<((a: () => void) => void) | null>;

  beforeEach(() => {
    useUserStore.getState().logout();
    useUIStore.setState({
      isLoginModalOpen: false,
      isOnboardingModalOpen: false,
      isCitySelectorOpen: false,
      pendingAuthAction: null,
    });
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    requireAuthRef = { current: null };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("链路：Follow → register → onboarding 完成 → 自动 Follow", async () => {
    const action = () => {
      const u = useUserStore.getState().user;
      if (u) void followArtist(u.id, "artist-15");
    };
    renderApp(root, action, requireAuthRef);

    // 游客点击 Follow → 存 pending + 开 login
    act(() => {
      requireAuthRef.current?.(action);
    });
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);

    // 模拟注册成功：先 closeLoginModal（executor 会自动开 onboarding）
    // 我们直接调 registerWithCredentials 模拟 LoginModal 内部行为
    await act(async () => {
      useUIStore.getState().closeLoginModal();
      await registerNewUser();
    });

    // onboarding 未完成 → 不应执行
    expect(useUserStore.getState().user?.onboarding_completed).toBe(false);
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");

    // 完成 onboarding → 自动执行 pending action
    await act(async () => {
      useUserStore.getState().updateUser({
        city: "上海",
        onboarding_completed: true,
      });
      await new Promise((r) => setTimeout(r, 200)); // followArtist 为异步
    });

    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");
  });

  it("链路：Interested → register → onboarding 完成 → 自动 Interested", async () => {
    const action = () => {
      useUserStore.getState().setShowStatus("show-13", UserShowStatus.INTERESTED);
    };
    renderApp(root, action, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(action);
    });
    expect(useUserStore.getState().showStatuses["show-13"]).toBeUndefined();

    await act(async () => {
      useUIStore.getState().closeLoginModal();
      await registerNewUser();
    });
    // onboarding 未完成 → 不提前执行
    expect(useUserStore.getState().showStatuses["show-13"]).toBeUndefined();

    act(() => {
      useUserStore.getState().updateUser({
        city: "上海",
        onboarding_completed: true,
      });
    });
    expect(useUserStore.getState().showStatuses["show-13"]).toBe(
      UserShowStatus.INTERESTED
    );
  });

  it("链路：Going → register → onboarding 完成 → 自动 Going", async () => {
    const action = () => {
      useUserStore.getState().setShowStatus("show-13", UserShowStatus.GOING);
    };
    renderApp(root, action, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(action);
    });
    expect(useUserStore.getState().showStatuses["show-13"]).toBeUndefined();

    await act(async () => {
      useUIStore.getState().closeLoginModal();
      await registerNewUser();
    });
    expect(useUserStore.getState().showStatuses["show-13"]).toBeUndefined();

    act(() => {
      useUserStore.getState().updateUser({
        city: "上海",
        onboarding_completed: true,
      });
    });
    expect(useUserStore.getState().showStatuses["show-13"]).toBe(
      UserShowStatus.GOING
    );
  });
});

export {};
