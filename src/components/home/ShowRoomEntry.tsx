"use client";

import * as React from "react";
import Link from "next/link";
import {
  MessageSquare,
  Users,
  Ticket,
  Image as ImageIcon,
  ArrowRight,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ShowRoomEntryProps {
  /** 要进入的目标 showId（跳 /show/[id]#room） */
  showId?: string;
  /** 覆盖默认标题文案 */
  title?: string;
  className?: string;
}

/**
 * 首页 观演小屋 社区入口
 * 数字 + 文字 + 细分割线布局，不做大卡片
 */
export function ShowRoomEntry({
  showId,
  title = "1000+ 人正在等你讨论演出、找搭子、出收票、分享现场。",
  className,
}: ShowRoomEntryProps) {
  // 统计数字为全站固定 mock 总数据，不随 Featured Show 变化
  // 各频道直达对应小屋 Tab（有 showId 时深链，否则回退到演出列表）
  const roomHref = (tab: string) =>
    showId ? `/show/${showId}?tab=${tab}#room` : "/shows";
  const channels: ChannelItem[] = [
    { label: "讨论", count: "3.2k", icon: MessageSquare, href: roomHref("discussion") },
    { label: "找搭子", count: "2.1k", icon: Users, href: roomHref("buddy") },
    { label: "出收票", count: "680", icon: Ticket, href: roomHref("ticket") },
    { label: "现场", count: "4.5k", icon: ImageIcon, href: roomHref("live") },
  ];

  return (
    <section className={cn("border-b border-border", className)}>
      <div className="container-gigroom py-10 md:py-14">
        {/* 标题行 */}
        <div className="mb-6">
          <p className="font-condensed text-sm md:text-base font-semibold tracking-[0.18em] text-accent-lime uppercase mb-3 flex items-center gap-1.5">
            <Home size={13} strokeWidth={1.5} />
            GIGROOM · 观演小屋
          </p>
          <p className="text-text-primary text-lg md:text-xl max-w-2xl leading-relaxed">
            {title}
          </p>
        </div>

        {/* 数字 + 细分割线 + 按钮 */}
        <div className="flex flex-col md:flex-row md:items-center gap-6 md:gap-8">
          <div className="flex-1 grid grid-cols-4 gap-0 divide-x divide-border border border-border">
            {channels.map((ch) => (
              <Link
                key={ch.label}
                href={ch.href}
                className="group flex flex-col items-center gap-1.5 py-4 md:py-5 px-2 hover:bg-bg-secondary/40 transition-colors"
              >
                <span className="font-condensed text-2xl md:text-3xl font-bold text-text-primary tracking-wider">
                  {ch.count}
                </span>
                <span className="flex items-center gap-1.5 text-text-tertiary text-xs md:text-sm group-hover:text-text-secondary transition-colors">
                  <ch.icon size={13} />
                  {ch.label}
                </span>
              </Link>
            ))}
          </div>

          {/* 两个并列 CTA，控制高度留白，CTA 层级字体 */}
          <div className="flex shrink-0 flex-col sm:flex-row gap-3">
            <Link
              href="/shows"
              className="inline-flex items-center justify-center gap-2 bg-accent-lime text-bg-primary hover:bg-accent-lime-hover transition-colors px-5 h-11 text-base font-medium rounded-sm"
            >
              <Home size={17} strokeWidth={1.5} />
              加入新的观演小屋
            </Link>
            <Link
              href="/rooms"
              className="inline-flex items-center justify-center gap-1.5 border border-border text-text-primary hover:border-accent-lime hover:text-accent-lime transition-colors px-5 h-11 text-base font-medium rounded-sm"
            >
              回到我的观演小屋
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

interface ChannelItem {
  label: string;
  count: string;
  icon: typeof MessageSquare;
  href: string;
}
