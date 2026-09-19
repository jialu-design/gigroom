"use client";

import * as React from "react";
import { Search, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useCityStore } from "@/lib/stores/useCityStore";
import { CITIES } from "@/lib/constants";
import { filterCities } from "@/lib/utils/cityNeighbors";
import { cn } from "@/lib/utils";

/**
 * 城市选择弹窗（首页「探索更多城市」/ 全局城市切换入口）
 *
 * 复用 useUIStore 预留的 isCitySelectorOpen 状态位；
 * 视觉与 OnboardingModal Step 1 保持一致（黑底 + lime 高亮）。
 * 点击城市立即写入 useCityStore 并关闭，不涉及登录/onboarding。
 */

export function CitySelectorModal() {
  const isOpen = useUIStore((s) => s.isCitySelectorOpen);
  const close = useUIStore((s) => s.closeCitySelector);
  const currentCity = useCityStore((s) => s.city);
  const setCity = useCityStore((s) => s.setCity);

  const [search, setSearch] = React.useState("");

  // 每次打开重置搜索词
  React.useEffect(() => {
    if (isOpen) setSearch("");
  }, [isOpen]);

  const filteredCities = React.useMemo(
    () => filterCities(search, CITIES),
    [search]
  );

  const handleSelect = (city: string) => {
    setCity(city);
    close();
  };

  return (
    <Modal open={isOpen} onClose={close} title="选择你的位置" className="max-w-xl">
      <h2 className="text-xl font-bold text-text-primary mb-1">
        你在哪座城市看演出？
      </h2>
      <p className="text-body text-text-secondary mb-5">
        选择城市后，将优先为你推荐当地及周边的演出
      </p>

      {/* 城市搜索 */}
      <div className="relative mb-4">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
        />
        <Input
          type="text"
          placeholder="搜索城市"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* 城市网格 */}
      <div className="max-h-[46vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
        {filteredCities.length === 0 && (
          <div className="col-span-full text-sm text-text-tertiary text-center py-6">
            没有找到「{search.trim()}」，试试别的关键词？
          </div>
        )}
        {filteredCities.map((c) => {
          const active = c === currentCity;
          return (
            <button
              key={c}
              type="button"
              onClick={() => handleSelect(c)}
              aria-pressed={active}
              className={cn(
                "h-11 rounded-sm border text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5",
                active
                  ? "border-accent-lime bg-accent-lime/10 text-accent-lime"
                  : "border-border bg-bg-tertiary text-text-secondary hover:border-border-light hover:text-text-primary"
              )}
            >
              {active && <Check size={14} />}
              {c}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
