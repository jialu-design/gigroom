/**
 * prebuild 守卫：阻止在 dev server 运行时执行 next build。
 *
 * 背景：next build 会整体改写 .next。若此时本项目仍有 next dev 在运行，
 * dev 的内存编译状态会与磁盘 .next 脱节，表现为 HTML 200 但
 * /_next/static/css|chunks/* 全部 404（页面渲染成"裸 HTML"）。
 * 该守卫使并发 build 在开始前直接失败，从源头消除这一类损坏。
 */
import { execSync } from "child_process";

const root = process.cwd();

function projectNextProcesses() {
  const out = execSync("ps -eo pid,command | grep -E 'next (dev|start)' | grep -v grep || true", {
    encoding: "utf8",
  });
  const hits = [];
  for (const line of out.trim().split("\n")) {
    if (!line) continue;
    const pid = parseInt(line.trim().split(/\s+/)[0], 10);
    if (!Number.isFinite(pid)) continue;
    try {
      const cwd = execSync(`lsof -p ${pid} 2>/dev/null | awk '/cwd/{print $NF}'`, {
        encoding: "utf8",
      }).trim();
      if (cwd === root) hits.push(pid);
    } catch {
      // 进程可能已退出，忽略
    }
  }
  return hits;
}

const running = projectNextProcesses();
if (running.length > 0) {
  console.error("");
  console.error("[prebuild 守卫] 检测到本项目仍有运行中的 Next 进程:", running.join(", "));
  console.error("next build 会改写 .next，导致运行中的 dev 出现 CSS/chunk 404（裸 HTML）。");
  console.error("正确流程：先停 dev → npm run build → npm run dev:restart 重新启动。");
  console.error("");
  process.exit(1);
}
console.log("[prebuild 守卫] 无运行中的 dev server，继续 build。");
