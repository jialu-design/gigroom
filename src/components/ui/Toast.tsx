"use client";

import * as React from "react";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

/** Toast Provider：放在layout里，全局管理toast */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const showToast = React.useCallback(
    (message: string, type: ToastType = "info", duration = 3000) => {
      const id = Math.random().toString(36).slice(2, 9);
      setToasts((prev) => [...prev, { id, type, message, duration }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast 容器：右下角 */}
      <div
        className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm w-[calc(100%-3rem)] sm:w-auto"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const iconMap: Record<ToastType, React.ReactElement> = {
  success: <CheckCircle2 size={18} className="text-accent-green-hover" />,
  error: <XCircle size={18} className="text-accent-red" />,
  warning: <AlertTriangle size={18} className="text-accent-yellow" />,
  info: <Info size={18} className="text-accent-blue-hover" />,
};

function ToastCard({ toast, onClose }: { toast: ToastItem; onClose: () => void }) {
  return (
    <div
      role="status"
      className={cn(
        "flex items-start gap-3 px-4 py-3 rounded-md border bg-bg-elevated shadow-lg animate-slide-up"
      )}
      style={{
        borderLeftColor:
          toast.type === "success"
            ? "var(--accent-green)"
            : toast.type === "error"
            ? "var(--accent-red)"
            : toast.type === "warning"
            ? "var(--accent-yellow)"
            : "var(--accent-blue)",
        borderLeftWidth: "3px",
      }}
    >
      {iconMap[toast.type]}
      <p className="flex-1 text-body text-text-primary leading-relaxed">
        {toast.message}
      </p>
      <button
        onClick={onClose}
        aria-label="关闭提示"
        className="shrink-0 text-text-tertiary hover:text-text-primary transition-colors"
      >
        <X size={16} />
      </button>
    </div>
  );
}

/** Hook: 在客户端组件中调用 showToast */
export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    // 降级：provider未包裹时返回console版，避免崩溃
    return {
      showToast: (message: string, type?: ToastType) => {
        console[
          type === "error" ? "error" : type === "warning" ? "warn" : "log"
        ](`[Toast:${type ?? "info"}] ${message}`);
      },
    };
  }
  return ctx;
}
