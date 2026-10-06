"use client";

import Link from "next/link";
import type { Show } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getShowDisplayTitle, isMultiArtistShow } from "@/lib/utils/format";

interface ComingSoonCardProps {
  show: Show;
}

/** 城市代码（展示用，非演出数据） */
export const CITY_CODES: Record<string, string> = {
  北京: "BJ",
  上海: "SH",
  广州: "GZ",
  深圳: "SZ",
  成都: "CD",
  武汉: "WH",
  杭州: "HZ",
  南京: "NJ",
  西安: "XA",
  重庆: "CQ",
  长沙: "CS",
  天津: "TJ",
  苏州: "SU",
  无锡: "WX",
  厦门: "XM",
  青岛: "QD",
  郑州: "ZZ",
  昆明: "KM",
  沈阳: "SY",
  大连: "DL",
  合肥: "HF",
};

/**
 * 首页「即将开票」卡片（P1-6，参考 Figma 信息层级）
 * mono 眉题（GR·城市·日期）→ 艺人 → 演出副题 → 场地/日期 → 开票时间 + 票价起 → 提醒按钮。
 * Show 数据模型无开票时间字段，诚实显示"待公布"，不虚构。
 */
export function ComingSoonCard({ show }: ComingSoonCardProps) {
  const { showToast } = useToast();
  const requireAuth = useRequireAuth();

  const displayName = getShowDisplayTitle(show);
  const multiArtist = isMultiArtistShow(show);
  const venueName = show.venue?.name ?? "";

  const d = new Date(show.date_time);
  const zhDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  const mmdd = `${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const dateLine = `${mmdd.slice(0, 2)}.${mmdd.slice(2)} · ${zhDays[d.getDay()]}`;

  const handleNotify = () => {
    requireAuth(() => {
      showToast("已设置开票提醒（DEMO）", "success");
    });
  };

  return (
    <div className="border border-border bg-bg-secondary/40 p-4 md:p-5 flex flex-col">
      <p className="font-mono text-[10px] tracking-[0.2em] text-accent-lime uppercase">
        GR · {CITY_CODES[show.city] ?? "GI"} · {mmdd}
      </p>

      <h3 className="mt-2.5 text-lg md:text-xl font-bold text-text-primary">
        {displayName}
      </h3>
      {show.title && !multiArtist && show.title !== displayName && (
        <p className="mt-0.5 text-xs text-text-secondary line-clamp-1">
          {show.title}
        </p>
      )}

      <div className="mt-3 text-metadata">
        <p>
          {venueName || show.city} · {show.city}
        </p>
        <p className="mt-0.5">{dateLine}</p>
      </div>

      <div className="mt-auto pt-4 border-t border-border flex items-end justify-between">
        <div>
          <p className="text-[10px] text-text-tertiary">开票时间</p>
          <p className="text-xs text-text-secondary mt-0.5">待公布（DEMO）</p>
        </div>
        {show.price_presale !== undefined && (
          <span className="num-date text-xl text-text-primary">
            {show.price_presale}
            <span className="text-xs font-semibold text-text-secondary">起</span>
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={handleNotify}
        className="mt-4 w-full h-9 inline-flex items-center justify-center border border-accent-lime/60 text-accent-lime text-sm font-medium rounded-sm transition-colors hover:bg-accent-lime/10 focus-visible:outline-accent-lime"
      >
        提醒我
      </button>

      <Link
        href={`/show/${show.id}`}
        className="mt-2 text-center text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
      >
        查看演出详情 →
      </Link>
    </div>
  );
}
