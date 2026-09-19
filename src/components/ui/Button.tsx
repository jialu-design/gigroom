"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "link" | "danger" | "lime";
type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-lime text-bg-primary hover:bg-accent-lime-hover active:bg-accent-lime-muted focus-visible:outline-accent-lime disabled:opacity-50 disabled:bg-accent-lime-muted",
  lime:
    "bg-accent-lime text-bg-primary hover:bg-accent-lime-hover active:bg-accent-lime-muted focus-visible:outline-accent-lime disabled:opacity-50",
  secondary:
    "bg-bg-tertiary text-text-primary border border-border hover:bg-bg-elevated hover:border-border-light active:bg-bg-elevated focus-visible:outline-accent-lime disabled:opacity-40",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-tertiary active:bg-bg-secondary focus-visible:outline-accent-lime disabled:opacity-40",
  link:
    "bg-transparent text-accent-lime hover:text-accent-lime-hover hover:underline underline-offset-4 p-0 h-auto min-h-0 focus-visible:outline-accent-lime disabled:opacity-40",
  danger:
    "bg-transparent text-accent-red border border-accent-red hover:bg-accent-red hover:text-text-primary active:bg-accent-red-muted focus-visible:outline-accent-red disabled:opacity-40",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm rounded-sm",
  md: "h-11 px-5 text-body rounded-md",
  lg: "h-14 px-7 text-lg rounded-md",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", type = "button", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 select-none whitespace-nowrap",
          variantClasses[variant],
          sizeClasses[size],
          variant !== "link" && "min-h-[44px]",
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
