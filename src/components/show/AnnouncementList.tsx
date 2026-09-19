"use client";

import * as React from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Megaphone } from "lucide-react";
import type { Announcement } from "@/lib/types";
import { AnnouncementType } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";

interface AnnouncementListProps {
  announcements: Announcement[];
  className?: string;
}

/**
 * 官方公告区
 * 视觉：左边框暗红高亮 + 稍亮背景 + 类型标签
 * 与 Room UGC 明显区分
 */
export function AnnouncementList({
  announcements,
  className,
}: AnnouncementListProps) {
  if (!announcements || announcements.length === 0) return null;

  return (
    <section className={className}>
      <div className="flex items-center gap-2 mb-5">
        <Megaphone size={18} className="text-accent-lime" />
        <h2 className="text-xl font-bold text-text-primary tracking-tight">
          演出公告
        </h2>
        <span className="text-xs text-text-tertiary">
          官方信息 · 与社区讨论无关
        </span>
      </div>

      <div className="space-y-3">
        {announcements.map((ann) => (
          <AnnouncementCard key={ann.id} announcement={ann} />
        ))}
      </div>
    </section>
  );
}

function AnnouncementCard({ announcement }: { announcement: Announcement }) {
  const typeLabel = announcement.type;
  const typeVariant = getTypeVariant(announcement.type);

  return (
    <div className="border-l-2 border-accent-lime bg-bg-secondary/50 rounded-md p-5 hover:bg-bg-secondary transition-colors">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Badge variant={typeVariant} size="sm">
            {typeLabel}
          </Badge>
          <span className="text-xs text-text-tertiary">
            {format(new Date(announcement.created_at), "yyyy-MM-dd HH:mm", {
              locale: zhCN,
            })}
          </span>
        </div>
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-1.5">
        {announcement.title}
      </h3>
      <p className="text-sm text-text-secondary leading-relaxed">
        {announcement.content}
      </p>
    </div>
  );
}

function getTypeVariant(type: AnnouncementType): "red" | "grey" | "yellow" | "blue" | "default" | "lime" {
  switch (type) {
    case AnnouncementType.TICKET_SALE:
      // 开票/在售类正向业务标签统一 Electric Lime，红色仅保留 error/danger
      return "lime";
    case AnnouncementType.SOLD_OUT:
      return "grey";
    case AnnouncementType.POSTPONED:
    case AnnouncementType.CANCELLED:
      return "yellow";
    case AnnouncementType.VENUE_CHANGE:
    case AnnouncementType.TIME_CHANGE:
    case AnnouncementType.GUEST_CHANGE:
      return "blue";
    case AnnouncementType.ORGANIZER_NOTICE:
      return "default";
    default:
      return "default";
  }
}
