import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
    // 项目约定：测试文件串行执行（避免高负载下 CPU 抢占导致 5s 超时与 act 时序抖动）
    fileParallelism: false,
  },
});
