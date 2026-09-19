"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type BadgeVariant =
  | "default"
  | "red"
  | "green"
  | "blue"
  | "yellow"
  | "grey"
  | "lime";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-bg-tertiary text-text-secondary border-border",
  red: "bg-accent-red-muted/40 text-accent-red border-accent-red-muted",
  green: "bg-accent-green/30 text-accent-green-hover border-accent-green",
  blue: "bg-accent-blue/30 text-accent-blue-hover border-accent-blue",
  yellow: "bg-accent-yellow/20 text-accent-yellow border-accent-yellow/50",
  grey: "bg-bg-tertiary text-text-tertiary border-border",
  // Electric Lime（#B7F34A）：在售等正向业务标签
  lime: "bg-accent-lime/20 text-accent-lime border-accent-lime/50",
};

/**
 * Badge：状态标签（带边框小圆角矩形）
 * Tag：内容标签（纯背景无边框，用于帖子标签/风格标签）
 */
export function Badge({ variant = "default", size = "sm", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center border rounded-sm font-medium",
        size === "sm" ? "h-5 px-2 text-xs" : "h-6 px-3 text-sm",
        variantClasses[variant],
        className
      )}
      {...props}
    />
  );
}

interface TagProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: "sm" | "md";
}

export function Tag({ size = "sm", className, ...props }: TagProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-sm text-text-secondary",
        size === "sm" ? "h-5 px-2 text-xs bg-bg-tertiary" : "h-7 px-3 text-sm bg-bg-secondary border border-border",
        className
      )}
      {...props}
    />
  );
}
