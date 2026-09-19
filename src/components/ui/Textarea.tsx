"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, disabled, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        disabled={disabled}
        className={cn(
          "flex w-full rounded-md border border-border bg-bg-secondary px-4 py-3 text-body text-text-primary resize-y",
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
Textarea.displayName = "Textarea";
