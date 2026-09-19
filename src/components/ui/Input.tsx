"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, disabled, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        disabled={disabled}
        className={cn(
          "flex h-11 w-full rounded-md border border-border bg-bg-secondary px-4 text-body text-text-primary",
          "placeholder:text-text-tertiary",
          "focus-visible:outline-none focus-visible:border-accent-lime focus-visible:ring-1 focus-visible:ring-accent-lime",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-bg-tertiary",
          "transition-colors duration-150",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
