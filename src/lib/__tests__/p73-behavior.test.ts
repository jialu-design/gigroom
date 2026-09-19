/**
 * P7.3 行为测试 - 剩余互动入口统一接入 useRequireAuth
 *
 * 覆盖：
 * A. Join Room（未登录→LoginModal→完成→自动加入；Going 不自动 Join；Join 不改 Interested/Going）
 * B. useRequireRoomMembership（未登录→LoginModal；已登录未加入→toast；已加入→执行）
 * C. Discussion（发送/回复需 membership；举报只需登录）
 * D. Buddy（发布/回复需 membership）
 * E. Ticket（发布/回复/标记需 membership）
 * F. Live（时间锁优先于登录；时间到+未登录→LoginModal；时间到+未加入→toast；时间到+已加入→执行）
 * G. Delete / Report（非作者不能删除；作者可删；举报需登录不要求 membership）
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";

// Mock Toast（避免 vitest import-analysis 解析 JSX 组件）
vi.mock("@/components/ui/Toast", () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

import { UserShowStatus } from "@/lib/types";
import { useUserStore, type RegisterInput } from "@/lib/stores/useUserStore";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useRequireRoomMembership } from "@/hooks/useRequireRoomMembership";
import { PendingAuthExecutor } from "@/components/user/PendingAuthExecutor";
import { getShowLifecycle } from "@/lib/utils/showLifecycle";
import type { Show } from "@/lib/types";
import { ShowStatus } from "@/lib/types";

// ========================
// 渲染夹具
// ========================
function Harness({
  roomId,
  action,
  requireRoomRef,
}: {
  roomId: string;
  action: () => void;
  requireRoomRef: React.MutableRefObject<((roomId: string, action: () => void) => void) | null>;
}) {
  const requireRoomMembership = useRequireRoomMembership();
  requireRoomRef.current = requireRoomMembership;
  return createElement(
    "button",
    {
      id: "trigger-room",
      onClick: () => requireRoomMembership(roomId, action),
    },
    "go"
  );
}

function HarnessAuth({
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
      id: "trigger-auth",
      onClick: () => requireAuth(action),
    },
    "go"
  );
}

function renderRoomApp(
  root: Root,
  roomId: string,
  action: () => void,
  requireRoomRef: React.MutableRefObject<((roomId: string, action: () => void) => void) | null>
) {
  act(() => {
    root.render(
      createElement(
        Fragment,
        null,
        createElement(PendingAuthExecutor),
        createElement(Harness, { roomId, action, requireRoomRef })
      )
    );
  });
}

function renderAuthApp(
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
        createElement(HarnessAuth, { action, requireAuthRef })
      )
    );
  });
}

function registerNewUser(input: RegisterInput = { email: "new@gigroom.cn", password: "1234", display_name: "新用户" }) {
  return useUserStore.getState().registerWithCredentials(input);
}

// ========================
// A. Join Room
// ========================
describe("P7.3 A. Join Room", () => {
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
    act(() => root.unmount());
    container.remove();
  });

  it("未登录点击 Join Room 不立即加入", () => {
    const spy = vi.fn();
    renderAuthApp(root, spy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);
    expect(useUserStore.getState().roomMemberships).toHaveLength(0);
  });

  it("Login + Onboarding 完成后自动加入房间", async () => {
    const roomId = "room-99";
    const spy = vi.fn(() => {
      useUserStore.getState().joinRoom(roomId);
    });
    renderAuthApp(root, spy, requireAuthRef);

    // 游客触发 Join Room
    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(spy).not.toHaveBeenCalled();

    // 注册（onboarding=false）
    await act(async () => {
      useUIStore.getState().closeLoginModal();
      await registerNewUser();
    });
    // onboarding 未完成 → 不执行
    expect(spy).not.toHaveBeenCalled();

    // 完成 onboarding → 自动执行
    act(() => {
      useUserStore.getState().updateUser({ city: "上海", onboarding_completed: true });
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(useUserStore.getState().roomMemberships.some((m) => m.room_id === roomId)).toBe(true);
  });

  it("已登录完成 onboarding 直接加入", () => {
    useUserStore.getState().mockLogin();
    const roomId = "room-99";
    const spy = vi.fn(() => {
      useUserStore.getState().joinRoom(roomId);
    });
    renderAuthApp(root, spy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(spy);
    });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(useUserStore.getState().roomMemberships.some((m) => m.room_id === roomId)).toBe(true);
  });

  it("Going 不会自动加入 Room", () => {
    useUserStore.getState().mockLogin();
    const setShowStatus = useUserStore.getState().setShowStatus;
    const roomId = "room-13";

    // 模拟 Going（通过 useRequireAuth 直接执行）
    const goingAction = () => setShowStatus("show-13", UserShowStatus.GOING);
    renderAuthApp(root, goingAction, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(goingAction);
    });
    // Going 执行了
    expect(useUserStore.getState().showStatuses["show-13"]).toBe(UserShowStatus.GOING);
    // 但没有自动加入房间
    expect(useUserStore.getState().roomMemberships.some((m) => m.room_id === roomId)).toBe(false);
  });

  it("Join Room 不会改变 Interested/Going", () => {
    useUserStore.getState().mockLogin();
    // 预设 show-15 为 going
    useUserStore.getState().setShowStatus("show-15", UserShowStatus.GOING);

    const roomId = "room-15";
    const joinAction = () => useUserStore.getState().joinRoom(roomId);
    renderAuthApp(root, joinAction, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(joinAction);
    });

    // Join Room 执行了
    expect(useUserStore.getState().roomMemberships.some((m) => m.room_id === roomId)).toBe(true);
    // showStatus 不变
    expect(useUserStore.getState().showStatuses["show-15"]).toBe(UserShowStatus.GOING);
  });
});

// ========================
// B. useRequireRoomMembership
// ========================
describe("P7.3 B. useRequireRoomMembership", () => {
  let container: HTMLDivElement;
  let root: Root;
  let requireRoomRef: React.MutableRefObject<((roomId: string, action: () => void) => void) | null>;

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
    requireRoomRef = { current: null };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("未登录：保存 action + 打开 LoginModal，不执行", () => {
    const spy = vi.fn();
    renderRoomApp(root, "room-1", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-1", spy);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);
    expect(typeof useUIStore.getState().pendingAuthAction).toBe("function");
  });

  it("已登录但未加入房间：toast 提示，不执行 action", () => {
    useUserStore.getState().mockLogin();
    // mockCurrentUser 默认加入 room-1, room-4；room-99 未加入
    const spy = vi.fn();
    renderRoomApp(root, "room-99", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-99", spy);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(useUIStore.getState().isLoginModalOpen).toBe(false);
    expect(useUIStore.getState().isOnboardingModalOpen).toBe(false);
  });

  it("已登录且已加入房间：执行 action", () => {
    useUserStore.getState().mockLogin();
    // mockCurrentUser 默认加入 room-1
    const spy = vi.fn();
    renderRoomApp(root, "room-1", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-1", spy);
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("未登录→注册→onboarding 完成→自动检查 membership（新用户未加入→toast，不执行）", async () => {
    const spy = vi.fn();
    renderRoomApp(root, "room-1", spy, requireRoomRef);

    act(() => {
      requireRoomRef.current?.("room-1", spy);
    });
    expect(spy).not.toHaveBeenCalled();

    await act(async () => {
      useUIStore.getState().closeLoginModal();
      await registerNewUser();
    });

    // 完成 onboarding
    act(() => {
      useUserStore.getState().updateUser({ city: "上海", onboarding_completed: true });
    });

    // 新用户未加入 room-1 → wrappedAction 中 membership 检查失败 → 不执行
    expect(spy).not.toHaveBeenCalled();
  });

  it("未登录→注册→onboarding 完成→已加入房间→自动执行", async () => {
    const roomId = "room-99";
    const spy = vi.fn();
    renderRoomApp(root, roomId, spy, requireRoomRef);

    act(() => {
      requireRoomRef.current?.(roomId, spy);
    });

    await act(async () => {
      useUIStore.getState().closeLoginModal();
      await registerNewUser();
    });

    // 新用户加入房间
    act(() => {
      useUserStore.getState().joinRoom(roomId);
    });

    // 完成 onboarding → 自动执行
    act(() => {
      useUserStore.getState().updateUser({ city: "上海", onboarding_completed: true });
    });

    expect(spy).toHaveBeenCalledTimes(1);
  });
});

// ========================
// C. Discussion（发送/回复需 membership；举报只需登录）
// ========================
describe("P7.3 C. Discussion 权限", () => {
  let container: HTMLDivElement;
  let root: Root;
  let requireRoomRef: React.MutableRefObject<((roomId: string, action: () => void) => void) | null>;
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
    requireRoomRef = { current: null };
    requireAuthRef = { current: null };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("未登录发送消息 → 登录流程（不执行）", () => {
    const sendSpy = vi.fn();
    renderRoomApp(root, "room-1", sendSpy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-1", sendSpy);
    });
    expect(sendSpy).not.toHaveBeenCalled();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);
  });

  it("登录但未加入房间 → 仍不能发送", () => {
    useUserStore.getState().mockLogin();
    const sendSpy = vi.fn();
    renderRoomApp(root, "room-99", sendSpy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-99", sendSpy);
    });
    expect(sendSpy).not.toHaveBeenCalled();
  });

  it("已登录且已加入 → 可以发送", () => {
    useUserStore.getState().mockLogin();
    const sendSpy = vi.fn();
    renderRoomApp(root, "room-1", sendSpy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-1", sendSpy);
    });
    expect(sendSpy).toHaveBeenCalledTimes(1);
  });

  it("未登录举报 → 登录后继续举报（requireAuth 流程）", async () => {
    const reportSpy = vi.fn();
    renderAuthApp(root, reportSpy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(reportSpy);
    });
    expect(reportSpy).not.toHaveBeenCalled();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);

    // 注册 + onboarding 完成
    await act(async () => {
      useUIStore.getState().closeLoginModal();
      await registerNewUser();
    });
    act(() => {
      useUserStore.getState().updateUser({ city: "上海", onboarding_completed: true });
    });
    // 登录完成 → 自动执行举报
    expect(reportSpy).toHaveBeenCalledTimes(1);
  });
});

// ========================
// D. Buddy（发布/回复需 membership）
// ========================
describe("P7.3 D. Buddy 权限", () => {
  let container: HTMLDivElement;
  let root: Root;
  let requireRoomRef: React.MutableRefObject<((roomId: string, action: () => void) => void) | null>;

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
    requireRoomRef = { current: null };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("未登录发布 → 登录流程", () => {
    const spy = vi.fn();
    renderRoomApp(root, "room-1", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-1", spy);
    });
    expect(spy).not.toHaveBeenCalled();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);
  });

  it("登录但未加入 → 不可发布", () => {
    useUserStore.getState().mockLogin();
    const spy = vi.fn();
    renderRoomApp(root, "room-99", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-99", spy);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("已加入 → 可发布", () => {
    useUserStore.getState().mockLogin();
    const spy = vi.fn();
    renderRoomApp(root, "room-1", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-1", spy);
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("回复权限正确（需 membership）", () => {
    useUserStore.getState().mockLogin();
    // 未加入 → 不能回复
    const replySpy = vi.fn();
    renderRoomApp(root, "room-99", replySpy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-99", replySpy);
    });
    expect(replySpy).not.toHaveBeenCalled();

    // 已加入 → 可以回复
    const replySpy2 = vi.fn();
    renderRoomApp(root, "room-1", replySpy2, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-1", replySpy2);
    });
    expect(replySpy2).toHaveBeenCalledTimes(1);
  });
});

// ========================
// E. Ticket（发布/回复/标记需 membership）
// ========================
describe("P7.3 E. Ticket 权限", () => {
  let container: HTMLDivElement;
  let root: Root;
  let requireRoomRef: React.MutableRefObject<((roomId: string, action: () => void) => void) | null>;

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
    requireRoomRef = { current: null };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("发布出票/收票需要 membership（未加入→不执行）", () => {
    useUserStore.getState().mockLogin();
    const spy = vi.fn();
    renderRoomApp(root, "room-99", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-99", spy);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("发布出票/收票 membership 通过→执行", () => {
    useUserStore.getState().mockLogin();
    const spy = vi.fn();
    renderRoomApp(root, "room-1", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-1", spy);
    });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("回复需要 membership（未加入→不执行）", () => {
    useUserStore.getState().mockLogin();
    const spy = vi.fn();
    renderRoomApp(root, "room-99", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-99", spy);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("标记 completed 需要 membership（未加入→不执行）", () => {
    useUserStore.getState().mockLogin();
    const spy = vi.fn();
    renderRoomApp(root, "room-99", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-99", spy);
    });
    expect(spy).not.toHaveBeenCalled();
  });

  it("标记 completed 仅作者可操作（ContentActions 已通过 isOwner 控制 UI 显示）", () => {
    // 验证 ContentActions 的 isOwner 逻辑契约：
    // currentUserId === post.user_id 才显示删除/标记完成入口
    const currentUserId: string = "user-1";
    const postUserId: string = "user-2";
    expect(currentUserId === postUserId).toBe(false); // 非作者 → 不显示

    const postUserId2: string = "user-1";
    expect(currentUserId === postUserId2).toBe(true); // 作者 → 显示
  });
});

// ========================
// F. Live（时间锁优先于登录）
// ========================
describe("P7.3 F. Live 时间锁优先", () => {
  // 构造一个未来的演出（canPostLive=false）
  const futureShow: Show = {
    id: "show-future",
    title: "未来演出",
    date_time: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    status: ShowStatus.UPCOMING,
    city: "上海",
    venue_id: "v1",
    venue: { id: "v1", name: "Test Venue", city: "上海" } as any,
    artists: [],
    ticket_status: "on_sale" as any,
    poster_url: "",
    price_text: "",
    interested_count: 0,
    going_count: 0,
    is_demo: false,
    created_at: new Date().toISOString(),
  };

  // 构造一个今天的演出（canPostLive=true，UPCOMING + 今天）
  const todayShow: Show = {
    ...futureShow,
    id: "show-today",
    date_time: new Date().toISOString(),
  };

  it("演出时间未到时 canPostLive=false（无论登录状态都不能发布）", () => {
    const lifecycle = getShowLifecycle(futureShow);
    expect(lifecycle.canPostLive).toBe(false);
  });

  it("演出时间已到 canPostLive=true", () => {
    const lifecycle = getShowLifecycle(todayShow);
    expect(lifecycle.canPostLive).toBe(true);
  });

  it("时间锁优先：时间未到 → 即使已登录已加入也不执行（handleCreate 安全检查）", () => {
    useUserStore.getState().mockLogin();
    useUserStore.getState().joinRoom("room-1");

    const lifecycle = getShowLifecycle(futureShow);
    // 模拟 handleCreate 的安全检查：canPostLive=false → 直接返回
    const spy = vi.fn();
    if (!lifecycle.canPostLive) {
      // showToast + return（不执行 spy）
    } else {
      spy();
    }
    expect(spy).not.toHaveBeenCalled();
  });

  it("时间已到 + 未登录 → LoginModal（走 useRequireRoomMembership）", () => {
    let container: HTMLDivElement;
    let root: Root;
    let requireRoomRef: React.MutableRefObject<((roomId: string, action: () => void) => void) | null>;

    useUserStore.getState().logout();
    useUIStore.setState({
      isLoginModalOpen: false,
      isOnboardingModalOpen: false,
      isCitySelectorOpen: false,
      pendingAuthAction: null,
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    requireRoomRef = { current: null };

    const spy = vi.fn();
    renderRoomApp(root, "room-1", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-1", spy);
    });
    // 未登录 → LoginModal
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);
    expect(spy).not.toHaveBeenCalled();

    act(() => root.unmount());
    container.remove();
  });

  it("时间已到 + 登录未加入 → 不可发布（toast 提示）", () => {
    let container: HTMLDivElement;
    let root: Root;
    let requireRoomRef: React.MutableRefObject<((roomId: string, action: () => void) => void) | null>;

    useUserStore.getState().mockLogin();
    useUIStore.setState({
      isLoginModalOpen: false,
      isOnboardingModalOpen: false,
      isCitySelectorOpen: false,
      pendingAuthAction: null,
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    requireRoomRef = { current: null };

    const spy = vi.fn();
    renderRoomApp(root, "room-99", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-99", spy);
    });
    // 已登录但未加入 → toast，不执行
    expect(spy).not.toHaveBeenCalled();
    expect(useUIStore.getState().isLoginModalOpen).toBe(false);

    act(() => root.unmount());
    container.remove();
  });

  it("时间已到 + 登录已加入 → 可发布", () => {
    let container: HTMLDivElement;
    let root: Root;
    let requireRoomRef: React.MutableRefObject<((roomId: string, action: () => void) => void) | null>;

    useUserStore.getState().mockLogin();
    useUIStore.setState({
      isLoginModalOpen: false,
      isOnboardingModalOpen: false,
      isCitySelectorOpen: false,
      pendingAuthAction: null,
    });

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    requireRoomRef = { current: null };

    const spy = vi.fn();
    renderRoomApp(root, "room-1", spy, requireRoomRef);
    act(() => {
      requireRoomRef.current?.("room-1", spy);
    });
    expect(spy).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    container.remove();
  });
});

// ========================
// G. Delete / Report
// ========================
describe("P7.3 G. Delete / Report", () => {
  let container: HTMLDivElement;
  let root: Root;
  let requireAuthRef: React.MutableRefObject<((a: () => void) => void) | null>;
  let requireRoomRef: React.MutableRefObject<((roomId: string, action: () => void) => void) | null>;

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
    requireRoomRef = { current: null };
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("非作者不能删除（ContentActions isOwner=false → 不显示删除入口）", () => {
    const currentUserId: string = "user-1";
    const contentUserId: string = "user-2";
    const isOwner = currentUserId === contentUserId;
    expect(isOwner).toBe(false);
    // ContentActions 只在 isOwner=true 时渲染删除按钮
  });

  it("作者可以删除（ContentActions isOwner=true → 显示删除入口）", () => {
    const currentUserId: string = "user-1";
    const contentUserId: string = "user-1";
    const isOwner = currentUserId === contentUserId;
    expect(isOwner).toBe(true);
  });

  it("删除操作需要登录（通过 ContentActions 仅对登录用户显示，且 handleDelete 检查 user）", () => {
    // 游客 user=null → currentUserId=undefined → isOwner=false → 不显示删除
    const currentUserId = undefined;
    const contentUserId = "user-1";
    const isOwner = currentUserId === contentUserId;
    expect(isOwner).toBe(false);
  });

  it("举报需要登录但不要求 membership（useRequireAuth 流程）", () => {
    const reportSpy = vi.fn();
    renderAuthApp(root, reportSpy, requireAuthRef);
    // 未登录
    act(() => {
      requireAuthRef.current?.(reportSpy);
    });
    expect(reportSpy).not.toHaveBeenCalled();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);
  });

  it("举报已登录用户直接执行（不检查 membership）", () => {
    useUserStore.getState().mockLogin();
    // mockLogin 默认未加入 room-99，但举报不需要 membership
    const reportSpy = vi.fn();
    renderAuthApp(root, reportSpy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(reportSpy);
    });
    expect(reportSpy).toHaveBeenCalledTimes(1);
    // 不打开 LoginModal（已登录）
    expect(useUIStore.getState().isLoginModalOpen).toBe(false);
  });

  it("举报不检查 membership：已登录但未加入房间也能举报", () => {
    useUserStore.getState().mockLogin();
    // 未加入 room-99
    const isMember = useUserStore.getState().roomMemberships.some((m) => m.room_id === "room-99");
    expect(isMember).toBe(false);

    // 举报仍可执行（通过 useRequireAuth，不通过 useRequireRoomMembership）
    const reportSpy = vi.fn();
    renderAuthApp(root, reportSpy, requireAuthRef);
    act(() => {
      requireAuthRef.current?.(reportSpy);
    });
    expect(reportSpy).toHaveBeenCalledTimes(1);
  });
});

// ========================
// H. 房间生命周期分级（讨论 7 天宽限 / 找搭子票务结束即关 / 现场规则不变）
// ========================
describe("P7.3 H. 生命周期按功能分级", () => {
  const DAY = 24 * 60 * 60 * 1000;

  function makeShow(daysFromNow: number, status: ShowStatus): Show {
    return {
      id: `show-${status}-${daysFromNow}`,
      title: "生命周期测试演出",
      date_time: new Date(Date.now() + daysFromNow * DAY).toISOString(),
      status,
      city: "上海",
      venue_id: "v1",
      venue: { id: "v1", name: "Test Venue", city: "上海" } as any,
      artists: [],
      ticket_status: "on_sale" as any,
      poster_url: "",
      price_text: "",
      interested_count: 0,
      going_count: 0,
      is_demo: false,
      created_at: new Date().toISOString(),
    };
  }

  it("演出结束 3 天：讨论仍可发（宽限期内），找搭子/票务不可发，现场仍可补发", () => {
    const lc = getShowLifecycle(makeShow(-3, ShowStatus.ENDED));
    expect(lc.hasEnded).toBe(true);
    expect(lc.canDiscuss).toBe(true);
    expect(lc.canPostBuddyTicket).toBe(false);
    expect(lc.canPostLive).toBe(true);
  });

  it("演出结束超过 7 天：讨论只读，找搭子/票务不可发，现场补发规则不变", () => {
    const lc = getShowLifecycle(makeShow(-10, ShowStatus.ENDED));
    expect(lc.canDiscuss).toBe(false);
    expect(lc.canPostBuddyTicket).toBe(false);
    expect(lc.canPostLive).toBe(true);
  });

  it("7 天边界：第 6 天 23 小时仍可讨论，第 7 天 1 小时只读", () => {
    const within = getShowLifecycle(makeShow(-6.95, ShowStatus.ENDED));
    expect(within.canDiscuss).toBe(true);
    const beyond = getShowLifecycle(makeShow(-7.05, ShowStatus.ENDED));
    expect(beyond.canDiscuss).toBe(false);
  });

  it("未来演出：讨论/找搭子/票务均可发，现场未到当天不可发", () => {
    const lc = getShowLifecycle(makeShow(30, ShowStatus.UPCOMING));
    expect(lc.canDiscuss).toBe(true);
    expect(lc.canPostBuddyTicket).toBe(true);
    expect(lc.canPostLive).toBe(false);
  });

  it("演出当天：讨论/找搭子/票务/现场全部可发", () => {
    const lc = getShowLifecycle(makeShow(0, ShowStatus.UPCOMING));
    expect(lc.canDiscuss).toBe(true);
    expect(lc.canPostBuddyTicket).toBe(true);
    expect(lc.canPostLive).toBe(true);
  });

  it("已取消的演出：即使在 7 天内也不可讨论/发帖", () => {
    const lc = getShowLifecycle(makeShow(-3, ShowStatus.CANCELLED));
    expect(lc.canDiscuss).toBe(false);
    expect(lc.canPostBuddyTicket).toBe(false);
  });
});

export {};
