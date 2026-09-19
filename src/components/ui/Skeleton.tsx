"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** 固定高度，不传则自适应 */
  height?: number | string;
  width?: number | string;
  /** 圆角类型 */
  rounded?: "none" | "sm" | "md" | "lg" | "full";
}

const roundedMap = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  full: "rounded-full",
} as const;

/**
 * 骨架屏：低饱和度呼吸动画占位块
 */
export function Skeleton({
  height,
  width,
  rounded = "md",
  className,
  style,
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "bg-bg-tertiary relative overflow-hidden",
        roundedMap[rounded],
        className
      )}
      style={{
        height,
        width,
        ...style,
      }}
      {...props}
    >
      {/* 光泽扫过动画 */}
      <div
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_infinite]"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(240,237,230,0.06), transparent)",
        }}
        aria-hidden
      />
      <style>{`@keyframes shimmer { 100% { transform: translateX(100%); } }`}</style>
    </div>
  );
}

/** 快捷骨架组合：文本行（多段） */
export function SkeletonText({
  lines = 3,
  className,
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          height={14}
          rounded="sm"
          style={{
            width:
              i === lines - 1
                ? "60%"
                : i === 0
                ? "100%"
                : `${80 + Math.round(Math.random() * 15)}%`,
          }}
        />
      ))}
    </div>
  );
}

/** 快捷骨架：卡片 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Skeleton height={180} rounded="md" />
      <Skeleton height={20} width="70%" rounded="sm" />
      <Skeleton height={14} width="50%" rounded="sm" />
    </div>
  );
}
