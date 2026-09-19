"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  key: string;
  label: string;
  disabled?: boolean;
}

interface TabBarProps {
  tabs: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  /** 是否紧凑样式（用于小区域内部） */
  compact?: boolean;
  className?: string;
}

/**
 * 横向Tab切换，激活项有底部暗红下划线动画
 */
export function TabBar({ tabs, activeKey, onChange, compact = false, className }: TabBarProps) {
  return (
    <div
      role="tablist"
      className={cn(
        "relative flex items-stretch gap-0 border-b border-border overflow-x-auto scrollbar-hide",
        className
      )}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            role="tab"
            aria-selected={isActive}
            disabled={tab.disabled}
            onClick={() => !tab.disabled && onChange(tab.key)}
            className={cn(
              "relative flex-1 text-center transition-colors duration-150",
              compact ? "py-2 text-sm" : "py-2.5 text-sm",
              isActive
                ? "text-text-primary font-semibold"
                : "text-text-tertiary hover:text-text-secondary disabled:opacity-40 disabled:hover:text-text-tertiary"
            )}
          >
            {tab.label}
            {/* 激活下划线 */}
            <span
              className={cn(
                "absolute left-0 right-0 bottom-0 h-[2px] bg-accent-lime transition-all duration-200 ease-zine",
                isActive ? "opacity-100 scale-x-100" : "opacity-0 scale-x-0"
              )}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
