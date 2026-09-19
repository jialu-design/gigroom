"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * 自定义样式的原生select（V1简单实现，不做自定义dropdown菜单）
 * 保证可用性，避免过度设计
 */
export function Select({
  options,
  value,
  onChange,
  placeholder,
  className,
  disabled,
  ...props
}: SelectProps) {
  return (
    <div className="relative">
      <select
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "appearance-none h-11 w-full rounded-md border border-border bg-bg-secondary pl-4 pr-10 text-body text-text-primary cursor-pointer",
          "focus-visible:outline-none focus-visible:border-accent-lime focus-visible:ring-1 focus-visible:ring-accent-lime",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-colors duration-150",
          !value && placeholder && "text-text-tertiary",
          className
        )}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={18}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary"
        aria-hidden
      />
    </div>
  );
}
