/**
 * Zustand Store - UI 状态
 * 管理弹层开关、toast 等 UI 全局状态
 *
 * P7.1：新增 pendingAuthAction 机制
 * - 未登录用户点击互动操作时，先保存待执行 action，再打开 LoginModal
 * - 登录+Onboarding 全部完成后由 PendingAuthExecutor 执行一次并清空
 * - 用户主动取消（X/遮罩/Escape）走 cancelLoginModal，关闭并清空 pending
 *
 * P7.2：新增 OnboardingModal 开关（openOnboardingModal / closeOnboardingModal）。
 * Onboarding 未完成时，pending action 不提前执行，直到 onboarding_completed=true。
 *
 * 注意：不在 Zustand 中保存无法可靠持久化的复杂 React 状态；
 * pendingAuthAction 为内存态回调，不持久化、logout 后不残留。
 */
import { create } from "zustand";

interface UIState {
  // 弹层状态
  isLoginModalOpen: boolean;
  isOnboardingModalOpen: boolean;
  isCitySelectorOpen: boolean;
  isEditProfileModalOpen: boolean;

  // Pending auth action（未登录时暂存的待执行操作）
  pendingAuthAction: (() => void) | null;

  // Actions
  openLoginModal: () => void;
  /** 仅关闭弹层（登录成功路径，pending 已由 executor 处理） */
  closeLoginModal: () => void;
  /** 取消并关闭：关闭弹层 + 清空 pending（用户主动取消路径） */
  cancelLoginModal: () => void;

  openOnboardingModal: () => void;
  closeOnboardingModal: () => void;

  openEditProfileModal: () => void;
  closeEditProfileModal: () => void;

  /** 保存待执行的 auth action（requireAuth 在未登录/未 onboard 时调用） */
  setPendingAuthAction: (action: () => void) => void;
  /** 清空 pending action */
  clearPendingAuthAction: () => void;
  openCitySelector: () => void;
  closeCitySelector: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  isLoginModalOpen: false,
  isOnboardingModalOpen: false,
  isCitySelectorOpen: false,
  isEditProfileModalOpen: false,
  pendingAuthAction: null,

  openLoginModal: () => set({ isLoginModalOpen: true }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),
  cancelLoginModal: () =>
    set({ isLoginModalOpen: false, pendingAuthAction: null }),

  openOnboardingModal: () => set({ isOnboardingModalOpen: true }),
  closeOnboardingModal: () => set({ isOnboardingModalOpen: false }),

  openEditProfileModal: () => set({ isEditProfileModalOpen: true }),
  closeEditProfileModal: () => set({ isEditProfileModalOpen: false }),

  setPendingAuthAction: (action) => set({ pendingAuthAction: action }),
  clearPendingAuthAction: () => set({ pendingAuthAction: null }),
  openCitySelector: () => set({ isCitySelectorOpen: true }),
  closeCitySelector: () => set({ isCitySelectorOpen: false }),
}));
