/**
 * Zustand Store - 城市状态
 * 管理用户选择的城市，持久化到 localStorage
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CityState {
  city: string;
  setCity: (city: string) => void;
}

export const useCityStore = create<CityState>()(
  persist(
    (set) => ({
      city: "上海", // 默认上海
      setCity: (city) => set({ city }),
    }),
    {
      name: "gigroom-city-storage",
    }
  )
);
