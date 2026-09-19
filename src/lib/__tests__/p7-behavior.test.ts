/**
 * P7.1 行为测试 - Auth 架构与登录拦截基础层
 *
 * 覆盖：
 * A. Auth 状态（初始/登录/登出/localStorage 恢复/凭证登录/注册/authLoading）
 * B. useRequireAuth（已登录立即执行 / 未登录不执行+开 modal / 登录后执行一次 / 清空 / logout 不残留）
 * C. 页面行为（Artist Follow / Interested / Going 的 pending→登录→自动执行）
 *
 * 使用 react-dom/client + act 渲染真实组件，验证 PendingAuthExecutor 与 useRequireAuth 联动。
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, Fragment, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { UserShowStatus } from "@/lib/types";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { PendingAuthExecutor } from "@/components/user/PendingAuthExecutor";
import { followArtist, unfollowArtist } from "@/lib/api/user";

// ========================
// 渲染测试夹具
// ========================
/** Harness：暴露 requireAuth 到 ref，便于测试直接调用，避免 DOM 事件 */
function Harness({
  action,
  requireAuthRef,
}: {
  action: () => void;
  requireAuthRef: React.MutableRefObject<((a: () => void) => void) | null>;
}) {
  const requireAuth = useRequireAuth();
  requireAuthRef.current = requireAuth;
  return createElement(
    "button",
    {
      id: "trigger",
      onClick: () => requireAuth(action),
    },
    "go"
  );
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
// A. Auth 状态
// ========================
describe("P7 A. Auth 状态", () => {
  beforeEach(() => {
    useUserStore.getState().logout();
    useUIStore.getState().cancelLoginModal();
    localStorage.clear();
  });

  it("未登录初始状态正确", () => {
    const s = useUserStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.user).toBeNull();
    expect(s.authLoading).toBe(false);
    expect(s.followedArtistIds).toEqual([]);
    expect(s.showStatuses).toEqual({});
    expect(s.roomMemberships).toEqual([]);
  });

  it("mockLogin 后用户状态正确", () => {
    useUserStore.getState().mockLogin();
    const s = useUserStore.getState();
    expect(s.isLoggedIn).toBe(true);
    expect(s.user).not.toBeNull();
    expect(s.user?.id).toBe("user-1");
    expect(s.authLoading).toBe(false);
    expect(s.followedArtistIds.length).toBe(4);
    expect(Object.keys(s.showStatuses).length).toBe(4);
    expect(s.roomMemberships.length).toBe(2);
  });

  it("logout 后用户清空", () => {
    useUserStore.getState().mockLogin();
    useUserStore.getState().logout();
    const s = useUserStore.getState();
    expect(s.isLoggedIn).toBe(false);
    expect(s.user).toBeNull();
    expect(s.followedArtistIds).toEqual([]);
    expect(s.showStatuses).toEqual({});
    expect(s.roomMemberships).toEqual([]);
  });

  it("localStorage session 可以恢复（重新加载 store 后 rehydrate）", async () => {
    useUserStore.getState().mockLogin();
    const stored = localStorage.getItem("gigroom-user-storage");
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored!);
    expect(parsed.state.isLoggedIn).toBe(true);
    expect(parsed.state.user?.id).toBe("user-1");

    // 重置模块，重新导入 store（模拟页面刷新后从 localStorage rehydrate）
    vi.resetModules();
    const fresh = await import("@/lib/stores/useUserStore");
    expect(fresh.useUserStore.getState().isLoggedIn).toBe(true);
    expect(fresh.useUserStore.getState().user?.id).toBe("user-1");
  });

  it("loginWithCredentials 成功登录并载入 demo 数据", async () => {
    await useUserStore.getState().loginWithCredentials("demo@gigroom.cn", "1234");
    const s = useUserStore.getState();
    expect(s.isLoggedIn).toBe(true);
    expect(s.user?.id).toBe("user-1");
    expect(s.authLoading).toBe(false);
    expect(s.followedArtistIds.length).toBe(4);
  });

  it("loginWithCredentials 密码过短应抛错且不登录", async () => {
    await expect(
      useUserStore.getState().loginWithCredentials("demo@gigroom.cn", "12")
    ).rejects.toThrow();
    expect(useUserStore.getState().isLoggedIn).toBe(false);
    expect(useUserStore.getState().authLoading).toBe(false);
  });

  it("registerWithCredentials 成功创建新用户并登录（空业务数据）", async () => {
    await useUserStore
      .getState()
      .registerWithCredentials({
        email: "new@gigroom.cn",
        password: "1234",
        display_name: "新用户",
      });
    const s = useUserStore.getState();
    expect(s.isLoggedIn).toBe(true);
    expect(s.user?.display_name).toBe("新用户");
    expect(s.user?.onboarding_completed).toBe(false);
    expect(s.followedArtistIds).toEqual([]);
    expect(s.showStatuses).toEqual({});
  });

  it("registerWithCredentials 缺用户名应抛错", async () => {
    await expect(
      useUserStore
        .getState()
        .registerWithCredentials({
          email: "new@gigroom.cn",
          password: "1234",
          display_name: "  ",
        })
    ).rejects.toThrow();
    expect(useUserStore.getState().isLoggedIn).toBe(false);
  });

  it("authLoading 在登录过程中先 true 后 false", async () => {
    const promise = useUserStore
      .getState()
      .loginWithCredentials("demo@gigroom.cn", "1234");
    // 触发后立即应为 loading（delay 300ms）
    expect(useUserStore.getState().authLoading).toBe(true);
    await promise;
    expect(useUserStore.getState().authLoading).toBe(false);
  });
});

// ========================
// B. useRequireAuth
// ========================
describe("P7 B. useRequireAuth", () => {
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

  it("已登录调用时立即执行 action", () => {
    useUserStore.getState().mockLogin();
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    // 未触发 pending / modal
    expect(useUIStore.getState().pendingAuthAction).toBeNull();
    expect(useUIStore.getState().isLoginModalOpen).toBe(false);
  });

  it("未登录时不立即执行 action", () => {
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("未登录时打开 LoginModal 并保存 pending action", () => {
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);
    expect(typeof useUIStore.getState().pendingAuthAction).toBe("function");
  });

  it("登录成功后执行 pending action", () => {
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(spy).not.toHaveBeenCalled();

    act(() => {
      useUserStore.getState().mockLogin();
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("pending action 只执行一次", () => {
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(spy);
    });
    act(() => {
      useUserStore.getState().mockLogin();
    });
    expect(spy).toHaveBeenCalledTimes(1);

    // 再触发一次无关重渲染，确认不会重复执行
    act(() => {
      useUserStore.getState().updateUser({ bio: "noop" });
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("执行后 pending action 被清空", () => {
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(useUIStore.getState().pendingAuthAction).not.toBeNull();

    act(() => {
      useUserStore.getState().mockLogin();
    });
    expect(useUIStore.getState().pendingAuthAction).toBeNull();
  });

  it("logout 后 pending action 不残留", () => {
    useUserStore.getState().mockLogin();
    const spy = vi.fn();
    renderApp(root, spy, requireAuthRef);

    // 登录态下手动塞入一个 pending（模拟边界场景）
    act(() => {
      useUIStore.getState().setPendingAuthAction(spy);
    });
    expect(useUIStore.getState().pendingAuthAction).not.toBeNull();

    // 登出 → executor 应回收 pending
    act(() => {
      useUserStore.getState().logout();
    });
    expect(useUIStore.getState().pendingAuthAction).toBeNull();
    expect(spy).not.toHaveBeenCalled();
  });

  it("用户取消（cancelLoginModal）应清空 pending action", () => {
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
});

// ========================
// C. 页面行为：3 个入口的 pending→登录→自动执行
// ========================
describe("P7 C. 页面行为（Artist Follow / Interested / Going）", () => {
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

  it("Artist Follow：未登录点击不改变 follow，登录后自动完成 follow", async () => {
    // pending action 复刻 FollowButton.doToggle 的读取最新状态模式
    const action = () => {
      const u = useUserStore.getState().user;
      if (u) void followArtist(u.id, "artist-15");
    };
    renderApp(root, action, requireAuthRef);

    // 游客触发
    act(() => {
      requireAuthRef.current?.(action);
    });
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);

    // 登录 → pending 执行
    act(() => {
      useUserStore.getState().mockLogin();
    });
    // 等待异步 followArtist 完成
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");
  });

  it("Interested：未登录点击不改变状态，登录后自动变 interested", () => {
    const action = () => {
      useUserStore.getState().setShowStatus("show-13", UserShowStatus.INTERESTED);
    };
    renderApp(root, action, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(action);
    });
    expect(useUserStore.getState().showStatuses["show-13"]).toBeUndefined();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);

    act(() => {
      useUserStore.getState().mockLogin();
    });
    expect(useUserStore.getState().showStatuses["show-13"]).toBe(
      UserShowStatus.INTERESTED
    );
  });

  it("Going：未登录点击不改变状态，登录后自动变 going", () => {
    const action = () => {
      useUserStore.getState().setShowStatus("show-13", UserShowStatus.GOING);
    };
    renderApp(root, action, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(action);
    });
    expect(useUserStore.getState().showStatuses["show-13"]).toBeUndefined();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);

    act(() => {
      useUserStore.getState().mockLogin();
    });
    expect(useUserStore.getState().showStatuses["show-13"]).toBe(
      UserShowStatus.GOING
    );
  });

  it("已登录直接执行 Going，不弹登录框", () => {
    useUserStore.getState().mockLogin();
    const action = () => {
      useUserStore.getState().setShowStatus("show-13", UserShowStatus.GOING);
    };
    renderApp(root, action, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(action);
    });
    expect(useUIStore.getState().isLoginModalOpen).toBe(false);
    expect(useUserStore.getState().showStatuses["show-13"]).toBe(
      UserShowStatus.GOING
    );
  });

  it("pending action 执行 follow 后 unfollow 仍可正常工作（状态闭环）", async () => {
    const followAction = () => {
      const u = useUserStore.getState().user;
      if (u) void followArtist(u.id, "artist-15");
    };
    renderApp(root, followAction, requireAuthRef);

    act(() => {
      requireAuthRef.current?.(followAction);
    });
    act(() => {
      useUserStore.getState().mockLogin();
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(useUserStore.getState().followedArtistIds).toContain("artist-15");

    // 登录后直接 unfollow（已登录走立即执行路径）
    const unfollowAction = () => {
      const u = useUserStore.getState().user;
      if (u) void unfollowArtist(u.id, "artist-15");
    };
    act(() => {
      requireAuthRef.current?.(unfollowAction);
    });
    await act(async () => {
      await new Promise((r) => setTimeout(r, 200));
    });
    expect(useUserStore.getState().followedArtistIds).not.toContain("artist-15");
  });
});

// useRef 引用类型导出，便于测试夹具
export {};
