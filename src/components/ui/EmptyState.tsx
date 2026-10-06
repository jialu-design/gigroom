"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary" | "ghost";
  };
  className?: string;
}

/**
 * 通用空状态组件：图标 + 标题 + 描述 + 可选操作按钮
 */
export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center border border-dashed border-border rounded-md bg-bg-secondary",
        className
      )}
    >
      {icon && (
        <div className="mb-4 text-4xl text-text-tertiary" aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="text-h3 text-text-primary mb-2">{title}</h3>
      {description && (
        <p className="text-sm text-text-tertiary max-w-sm mb-5">
          {description}
        </p>
      )}
      {action && (
        <Button variant={action.variant ?? "secondary"} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
