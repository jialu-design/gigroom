"use client";

import * as React from "react";
import { Search, ArrowRight, Check } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { FollowButton } from "@/components/artist/FollowButton";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useCityStore } from "@/lib/stores/useCityStore";
import { CITIES } from "@/lib/constants";
import { getArtists } from "@/lib/api/artists";
import { completeOnboarding } from "@/lib/api/profile";
import type { Artist } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

type Step = 1 | 2;

/**
 * OnboardingModal（P7.2 基础版，严格两步）
 *
 * Step 1：城市（必选，未选时「下一步」disabled，不可跳过）
 *   - 搜索 + 单选
 *   - 选择后写入城市 store + 本地临时草稿态（不提前标记 onboarding completed）
 *
 * Step 2：乐队（可选任意数量，0～N，无最低要求）
 *   - 展示现有 Artist，支持搜索
 *   - FollowButton 直接操作 store（用户已登录）
 *   - 底部两个出口：
 *       「开始探索」→ 写入城市、保存关注、完成 onboarding、关闭
 *       「暂时跳过」→ 写入城市、但不添加额外关注、完成 onboarding、关闭
 *
 * 完成 onboarding 时：
 *   setCity(city) + updateUser({ onboarding_completed: true, city, ... })
 *   → 触发 PendingAuthExecutor 的「就绪转换」→ 执行 pending action（只执行一次，执行后清空）
 *
 * 新注册用户流程：LoginModal 注册成功 → 开 OnboardingModal → 完成 → 自动执行 pending。
 * 已有 demo 用户（onboarding_completed=true）不会进入 OnboardingModal。
 */
export function OnboardingModal() {
  const isOpen = useUIStore((s) => s.isOnboardingModalOpen);
  const closeOnboardingModal = useUIStore((s) => s.closeOnboardingModal);
  const updateUser = useUserStore((s) => s.updateUser);
  const user = useUserStore((s) => s.user);
  const currentCityStore = useCityStore((s) => s.city);
  const setCityStore = useCityStore((s) => s.setCity);
  const { showToast } = useToast();

  const [step, setStep] = React.useState<Step>(1);
  const [citySearch, setCitySearch] = React.useState("");
  const [selectedCity, setSelectedCity] = React.useState<string | null>(null);
  const [artistSearch, setArtistSearch] = React.useState("");
  const [artists, setArtists] = React.useState<Artist[]>([]);
  const [artistsLoading, setArtistsLoading] = React.useState(false);
  const [finishing, setFinishing] = React.useState(false);

  // 每次打开重置
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setCitySearch("");
      setSelectedCity(currentCityStore && currentCityStore !== "上海" ? currentCityStore : null);
      setArtistSearch("");
      setArtists([]);
      setFinishing(false);
      // 加载 Step 2 用的 Artist 数据（与城市选择无关联，可提前加载）
      void (async () => {
        setArtistsLoading(true);
        const res = await getArtists({ limit: 50 });
        setArtists(res.data);
        setArtistsLoading(false);
      })();
    }
  }, [isOpen, currentCityStore]);

  const filteredCities = React.useMemo(() => {
    const q = citySearch.trim();
    if (!q) return CITIES;
    return CITIES.filter((c) => c.includes(q));
  }, [citySearch]);

  const filteredArtists = React.useMemo(() => {
    const q = artistSearch.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.genres.some((g) => g.toLowerCase().includes(q))
    );
  }, [artists, artistSearch]);

  const handleFinish = async (applyFollowed = true) => {
    if (!selectedCity || finishing || !user) return;
    setFinishing(true);
    try {
      // P10.1: 写入 profiles 表（city + onboarding_completed=true）
      const updatedUser = await completeOnboarding(
        user.id,
        selectedCity,
        user.display_name
      );
      // 同步本地 store snapshot
      updateUser({
        city: updatedUser.city,
        onboarding_completed: updatedUser.onboarding_completed,
      });
      // 保存城市到 city store
      setCityStore(selectedCity);
      showToast("新手引导完成", "success");
      closeOnboardingModal();
    } catch (err: unknown) {
      // 打印真实 Supabase error，避免被 catch 吞掉
      const supabaseErr = err as { code?: string; message?: string };
      console.error("[Onboarding] completeOnboarding 失败:", supabaseErr);
      const hint =
        supabaseErr?.code === "PGRST205"
          ? "数据库表未部署，请在 Supabase 执行 migration SQL"
          : "保存失败，请重试";
      showToast(hint, "error");
      setFinishing(false);
    }
  };

  const canNext = selectedCity !== null;

  return (
    <Modal
      open={isOpen}
      onClose={closeOnboardingModal}
      title={step === 1 ? "新手引导 · 1/2" : "新手引导 · 2/2"}
      className="max-w-xl"
    >
      {step === 1 && (
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">
            你通常在哪座城市看演出？
          </h2>
          <p className="text-body text-text-secondary mb-5">
            我们会优先为你推荐该城市的演出
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
              value={citySearch}
              onChange={(e) => setCitySearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 城市单选网格 */}
          <div className="max-h-[42vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-2 pr-1">
            {filteredCities.length === 0 && (
              <div className="col-span-full text-sm text-text-tertiary text-center py-6">
                没有找到「{citySearch}」，试试别的关键词？
              </div>
            )}
            {filteredCities.map((c) => {
              const active = c === selectedCity;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setSelectedCity(c)}
                  className={cn(
                    "h-11 rounded-sm border text-sm font-medium transition-colors",
                    active
                      ? "border-accent-lime bg-accent-lime/10 text-accent-lime"
                      : "border-border bg-bg-tertiary text-text-secondary hover:border-border-light hover:text-text-primary"
                  )}
                >
                  {c}
                </button>
              );
            })}
          </div>

          {/* 下一步（未选城市 disabled） */}
          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              size="md"
              onClick={() => setStep(2)}
              disabled={!canNext}
              className="gap-1"
            >
              下一步
              <ArrowRight size={16} />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-1">
            关注喜欢的乐队，有新演出时第一时间告诉你
          </h2>
          <p className="text-body text-text-secondary mb-5">
            可关注任意数量乐队，也可以稍后再关注
          </p>

          {/* 乐队搜索 */}
          <div className="relative mb-4">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
            />
            <Input
              type="text"
              placeholder="搜索乐队 / 风格"
              value={artistSearch}
              onChange={(e) => setArtistSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* 乐队列表（紧凑 2 列卡片） */}
          {artistsLoading ? (
            <div className="max-h-[42vh] grid grid-cols-2 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[3/4] rounded-sm bg-bg-secondary animate-pulse"
                />
              ))}
            </div>
          ) : filteredArtists.length === 0 ? (
            <div className="max-h-[42vh] overflow-y-auto py-8 text-center text-sm text-text-tertiary">
              没有找到匹配的乐队
            </div>
          ) : (
            <div className="max-h-[42vh] overflow-y-auto grid grid-cols-2 sm:grid-cols-3 gap-3 pr-1">
              {filteredArtists.map((a) => (
                <ArtistCardCompact key={a.id} artist={a} />
              ))}
            </div>
          )}

          {/* 底部：开始探索 / 暂时跳过 */}
          <div className="mt-6 flex items-center justify-between gap-3">
            <Button
              variant="ghost"
              size="md"
              onClick={() => handleFinish(false)}
              disabled={!canNext}
            >
              暂时跳过
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => handleFinish(true)}
              disabled={!canNext || finishing}
            >
              {finishing ? "完成中..." : "开始探索"}
              {!finishing && <Check size={16} />}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Step 2 内用的紧凑乐队卡片（封面+名+FollowButton），不复用 ArtistCard 复杂视觉 */
function ArtistCardCompact({ artist }: { artist: Artist }) {
  return (
    <div className="flex flex-col rounded-sm border border-border bg-bg-secondary p-2">
      <div className="relative aspect-square w-full overflow-hidden rounded-sm bg-bg-tertiary poster-border">
        {artist.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- Modal 内一次性卡片，避免 Next Image 额外复杂
          <img
            src={artist.cover_url}
            alt={artist.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-text-tertiary text-base font-bold">
            {artist.name.charAt(0)}
          </div>
        )}
      </div>
      <div className="mt-2">
        <h4 className="text-sm font-medium text-text-primary line-clamp-1">
          {artist.name}
        </h4>
        {artist.city && (
          <p className="mt-0.5 text-xs text-text-tertiary line-clamp-1">
            {artist.city}
          </p>
        )}
      </div>
      <FollowButton
        artistId={artist.id}
        artistName={artist.name}
        size="sm"
        className="mt-2 w-full"
        stopPropagation={false}
        bypassAuthGate
      />
    </div>
  );
}
