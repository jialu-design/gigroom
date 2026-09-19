"use client";

import * as React from "react";
import { ExternalLink } from "lucide-react";
import {
  detectVideoPlatform,
  getVideoPlatformLabel,
} from "@/lib/api/posts/livePosts";
import type { VideoPlatform } from "@/lib/types";

interface VideoLinkCardProps {
  url: string;
}

export function VideoLinkCard({ url }: VideoLinkCardProps) {
  const platform = detectVideoPlatform(url);
  const label = getVideoPlatformLabel(platform);

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-sm border border-border bg-bg-secondary px-4 py-3 hover:border-border-light transition-colors"
    >
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">
          {label}
          {platform === undefined && (
            <span className="text-text-tertiary text-xs ml-1">
              （不支持的平台）
            </span>
          )}
        </p>
        <p className="text-xs text-text-tertiary truncate">{url}</p>
      </div>
      <ExternalLink size={16} className="text-text-tertiary shrink-0" />
    </a>
  );
}
