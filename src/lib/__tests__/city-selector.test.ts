/**
 * 城市选择弹窗相关行为测试
 * - useUIStore 城市选择弹层开关
 * - filterCities 搜索过滤（trim + 子串，空串不过滤）
 */
import { describe, it, expect, beforeEach } from "vitest";
import { filterCities } from "@/lib/utils/cityNeighbors";
import { useUIStore } from "@/lib/stores/useUIStore";
import { useCityStore } from "@/lib/stores/useCityStore";
import { CITIES } from "@/lib/constants";

describe("useUIStore 城市选择弹层", () => {
  beforeEach(() => {
    useUIStore.setState({
      isLoginModalOpen: false,
      isOnboardingModalOpen: false,
      isCitySelectorOpen: false,
      isEditProfileModalOpen: false,
      pendingAuthAction: null,
    });
  });

  it("默认关闭，openCitySelector 后打开，closeCitySelector 后关闭", () => {
    expect(useUIStore.getState().isCitySelectorOpen).toBe(false);

    useUIStore.getState().openCitySelector();
    expect(useUIStore.getState().isCitySelectorOpen).toBe(true);

    useUIStore.getState().closeCitySelector();
    expect(useUIStore.getState().isCitySelectorOpen).toBe(false);
  });

  it("打开城市选择弹层不影响登录/onboarding 弹层状态", () => {
    useUIStore.getState().openLoginModal();
    useUIStore.getState().openCitySelector();

    expect(useUIStore.getState().isLoginModalOpen).toBe(true);
    expect(useUIStore.getState().isCitySelectorOpen).toBe(true);

    useUIStore.getState().closeCitySelector();
    expect(useUIStore.getState().isLoginModalOpen).toBe(true);
    expect(useUIStore.getState().isCitySelectorOpen).toBe(false);
  });
});

describe("filterCities 城市搜索", () => {
  it("空字符串等价于不过滤，返回全部城市副本", () => {
    expect(filterCities("", CITIES)).toEqual([...CITIES]);
  });

  it("纯空格等价于不过滤（trim）", () => {
    expect(filterCities("   ", CITIES)).toEqual([...CITIES]);
  });

  it("按子串模糊匹配", () => {
    expect(filterCities("州", CITIES)).toEqual(
      CITIES.filter((c) => c.includes("州"))
    );
    expect(filterCities("州", CITIES)).toContain("广州");
    expect(filterCities("州", CITIES)).toContain("苏州");
    expect(filterCities("州", CITIES)).toContain("杭州");
  });

  it("关键词两端空白被 trim", () => {
    expect(filterCities(" 北京 ", CITIES)).toEqual(["北京"]);
  });

  it("无匹配返回空数组（UI 显示空提示）", () => {
    expect(filterCities("火星", CITIES)).toEqual([]);
  });
});

describe("选择城市写入", () => {
  it("选中城市后写入 useCityStore（与弹窗 handleSelect 同一 store 动作）", () => {
    useCityStore.getState().setCity("杭州");
    expect(useCityStore.getState().city).toBe("杭州");
    useCityStore.getState().setCity("上海");
  });
});
