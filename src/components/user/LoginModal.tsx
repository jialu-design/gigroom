"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { signIn, signUp } from "@/lib/api/auth";

type Tab = "login" | "register";

/**
 * LoginModal（P10.1 Supabase Auth 接入）
 *
 * - 登录 Tab：邮箱 + 密码 → auth.signIn()
 * - 注册 Tab：邮箱 + 密码 + 确认密码 + 用户名 → auth.signUp()
 * - 登录/注册成功后：
 *     有 session → setAuthUser → 检查 onboarding → 关闭/打开 Onboarding
 *     无 session（需邮箱验证）→ 显示验证提示，不关闭 Modal
 * - 取消（X/遮罩/Escape）走 cancelLoginModal，清空 pending action
 * - 不在 LoginModal 内直接执行业务 action（pending 由全局 executor 统一处理）
 */
export function LoginModal() {
  const isLoginModalOpen = useUIStore((s) => s.isLoginModalOpen);
  const cancelLoginModal = useUIStore((s) => s.cancelLoginModal);
  const closeLoginModal = useUIStore((s) => s.closeLoginModal);
  const openOnboardingModal = useUIStore((s) => s.openOnboardingModal);
  const setAuthUser = useUserStore((s) => s.setAuthUser);
  const { showToast } = useToast();

  const [tab, setTab] = React.useState<Tab>("login");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [info, setInfo] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  // 打开时重置表单
  React.useEffect(() => {
    if (isLoginModalOpen) {
      setTab("login");
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setDisplayName("");
      setError(null);
      setInfo(null);
      setLoading(false);
    }
  }, [isLoginModalOpen]);

  const handleLogin = async () => {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const { user } = await signIn(email, password);
      setAuthUser(user);
      showToast("登录成功", "success");
      closeLoginModal();
      // 登录成功后根据 onboarding 状态分流
      if (!user.onboarding_completed) {
        openOnboardingModal();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    setError(null);
    setInfo(null);
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);
    try {
      const result = await signUp(email, password, displayName);

      if (result.needsEmailConfirm) {
        // Confirm Email ON → session 为 null
        setInfo("注册成功，请前往邮箱完成验证后登录");
        showToast("注册成功，请验证邮箱", "info");
        return;
      }

      // Confirm Email OFF → 有 session
      if (result.user) {
        setAuthUser(result.user);
        showToast("注册成功，请完成新手引导", "success");
        closeLoginModal();
        openOnboardingModal();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === "login") void handleLogin();
    else void handleRegister();
  };

  return (
    <Modal
      open={isLoginModalOpen}
      onClose={cancelLoginModal}
      title={tab === "login" ? "登录" : "注册"}
      className="max-w-md"
    >
      {/* Tab 切换 */}
      <div className="mb-6 flex gap-6 border-b border-border">
        {(
          [
            { key: "login", label: "登录" },
            { key: "register", label: "注册" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setError(null);
              setInfo(null);
            }}
            className={cn(
              "relative pb-3 text-sm font-medium transition-colors",
              tab === t.key
                ? "text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            )}
          >
            {t.label}
            {tab === t.key && (
              <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-accent-lime" />
            )}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {tab === "register" && (
          <div>
            <label className="mb-1.5 block text-sm text-text-secondary">
              用户名
            </label>
            <Input
              type="text"
              placeholder="给自己起个名字"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              autoComplete="username"
              disabled={loading}
            />
          </div>
        )}

        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">
            邮箱
          </label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-text-secondary">
            密码
          </label>
          <Input
            type="password"
            placeholder="至少 6 位"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={tab === "login" ? "current-password" : "new-password"}
            disabled={loading}
          />
        </div>

        {tab === "register" && (
          <div>
            <label className="mb-1.5 block text-sm text-text-secondary">
              确认密码
            </label>
            <Input
              type="password"
              placeholder="再输入一次"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              disabled={loading}
            />
          </div>
        )}

        {error && (
          <p className="text-sm text-accent-red" role="alert">
            {error}
          </p>
        )}

        {info && (
          <p className="text-sm text-accent-yellow" role="status">
            {info}
          </p>
        )}

        <Button
          type="submit"
          variant="primary"
          size="md"
          className="w-full justify-center"
          disabled={loading}
        >
          {loading
            ? tab === "login"
              ? "登录中..."
              : "注册中..."
            : tab === "login"
            ? "登录"
            : "注册"}
        </Button>
      </form>

      <p className="mt-4 text-center text-xs text-text-tertiary">
        注册即同意 GigRoom 社区准则，请使用真实邮箱
      </p>
    </Modal>
  );
}
