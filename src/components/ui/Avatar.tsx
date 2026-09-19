"use client";

import * as React from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";

type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";
type AvatarShape = "circle" | "square";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  fallbackName?: string; // 用于首字母fallback
  size?: AvatarSize;
  shape?: AvatarShape;
  className?: string;
}

const sizeClasses: Record<AvatarSize, string> = {
  xs: "w-6 h-6 text-xs",
  sm: "w-8 h-8 text-sm",
  md: "w-10 h-10 text-body",
  lg: "w-14 h-14 text-h3",
  xl: "w-24 h-24 text-h1",
};

/**
 * 头像组件：圆形/方形，支持图片URL -> 首字母fallback -> 图标fallback三级降级
 */
export function Avatar({
  src,
  alt = "用户头像",
  fallbackName,
  size = "md",
  shape = "circle",
  className,
}: AvatarProps) {
  const [errored, setErrored] = React.useState(false);
  const showImg = src && !errored;

  // 首字母：优先fallbackName的第一个非空字符（中英文都取第一字）
  const initial = fallbackName
    ? fallbackName.trim().charAt(0).toUpperCase()
    : null;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center overflow-hidden bg-bg-tertiary text-text-secondary shrink-0 border border-border",
        sizeClasses[size],
        shape === "circle" ? "rounded-full" : "rounded-md",
        className
      )}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element -- 头像URL来源动态(P10才对接图床白名单)，且依赖原生onError完成三级降级(图片→首字母→图标)
        <img
          src={src!}
          alt={alt}
          onError={() => setErrored(true)}
          className="w-full h-full object-cover"
        />
      ) : initial ? (
        <span className="font-medium leading-none">{initial}</span>
      ) : (
        <User
          size={size === "xs" ? 14 : size === "sm" ? 18 : size === "lg" ? 28 : size === "xl" ? 48 : 22}
          aria-hidden
        />
      )}
    </div>
  );
}
