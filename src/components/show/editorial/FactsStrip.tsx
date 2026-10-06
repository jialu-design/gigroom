"use client";

import * as React from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Heart, Users } from "lucide-react";
import type { Show, UserShowStatus } from "@/lib/types";
import { UserShowStatus as UserShowStatusEnum } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

interface FactsStripProps {
  show: Show;
  userShowStatus?: UserShowStatus;
  onStatusChange?: (status: UserShowStatus) => void;
  className?: string;
}

/**
 * ② SHOW FACTS — 数字锚点条
 * 日期 / 场地 / 预售价 / 现场价 四格大数字 + hairline 分隔（无卡片底色）。
 * 缺失的价格格留空不补文案；感兴趣/要去按钮挂在条尾。
 */
export function FactsStrip({
  show,
  userShowStatus,
  onStatusChange,
  className,
}: FactsStripProps) {
  const date = new Date(show.date_time);
  const interested = userShowStatus === "interested";
  const going = userShowStatus === "going";

  const cellLabel =
    "text-[10px] font-mono tracking-[0.25em] text-text-tertiary mb-2";
  const cellValue =
    "text-3xl xl:text-4xl font-extrabold tabular-nums text-text-primary leading-none";
  const cellSub = "text-sm text-text-secondary mt-2";

  return (
    <section className={cn("border-y border-border", className)}>
      <div className="grid grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border gap-y-8 py-6 lg:py-8">
        {/* 日期（提升数字可读性：condensed 大数字 + 星期/时刻分行） */}
        <div className="pr-4">
          <p className={cellLabel}>日期</p>
          <p className="font-condensed text-4xl xl:text-5xl font-bold tabular-nums text-text-primary leading-none tracking-tight">
            {format(date, "MM/dd")}
          </p>
          <p className={cn(cellSub, "mt-3")}>
            {format(date, "EEE", { locale: zhCN })} ·{" "}
            <span className="font-bold tabular-nums text-text-primary">{format(date, "HH:mm")}</span>
          </p>
        </div>
        {/* 场地 */}
        <div className="lg:pl-6">
          <p className={cellLabel}>场地</p>
          <p className={cn(cellValue, "text-2xl xl:text-3xl")}>{show.city}</p>
          <p className={cellSub}>{show.venue?.name ?? "—"}</p>
        </div>
        {/* 预售 */}
        <div>
          <p className={cellLabel}>预售</p>
          <p className={cellValue}>
            {show.price_presale != null ? `¥${show.price_presale}` : ""}
          </p>
          <p className={cellSub}>
            {show.price_presale == null && show.price_text ? show.price_text : ""}
          </p>
        </div>
        {/* 现场 */}
        <div className="lg:pl-6">
          <p className={cellLabel}>现场</p>
          <p className={cellValue}>
            {show.price_door != null ? `¥${show.price_door}` : ""}
          </p>
        </div>
      </div>

      {/* 感兴趣 / 我要去（行为逻辑与旧 Hero 完全一致，仅移位） */}
      <div className="flex gap-3 pb-6 lg:pb-8">
        <Button
          variant={interested ? "lime" : "secondary"}
          size="md"
          onClick={() => onStatusChange?.(UserShowStatusEnum.INTERESTED)}
          className="flex-1 lg:flex-none"
        >
          <Heart size={16} className={interested ? "fill-current" : ""} />
          {interested ? "已感兴趣" : "感兴趣"}
        </Button>
        <Button
          variant={going ? "primary" : "secondary"}
          size="md"
          onClick={() => onStatusChange?.(UserShowStatusEnum.GOING)}
          className="flex-1 lg:flex-none"
        >
          <Users size={16} />
          我要去
        </Button>
      </div>
    </section>
  );
}
