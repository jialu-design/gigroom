/**
 * prebuild 守卫：阻止在 dev server 运行时执行 next build。
 *
 * 背景：next build 会整体改写 .next。若此时本项目仍有 next dev 在运行，
 * dev 的内存编译状态会与磁盘 .next 脱节，表现为 HTML 200 但
 * /_next/static/css|chunks/* 全部 404（页面渲染成"裸 HTML"）。
 * 该守卫使并发 build 在开始前直接失败，从源头消除这一类损坏。
 *
 * 2026-09-30 事故修复：
 * 旧版只用 `ps | grep 'next (dev|start)'`，只能命中 `next dev` CLI 包装进程，
 * 而 Next 14 真正监听端口、持有 .next 的服务进程命令行是 `next-server (vX.Y.Z)`
 * （ps 中不含 "next dev" 字样）。CLI 被杀后它会变成 PPID=1 的孤儿继续占着 3000，
 * 旧守卫漏检 → build 被放行 → .next 被生产产物覆盖 → 裸 HTML。
 * 现修复：
 *  1) 进程发现同时覆盖 next-server 实际服务进程与 next CLI（dev/build/start），
 *     并以 lsof cwd === 项目根 作为本项目判定；
 *  2) 增加端口 3000 监听检查作为第二道独立保险（任何进程占用都拦截）。
 */
import { execSync } from "child_process";

const root = process.cwd();
const DEV_PORT = process.env.DEV_PORT || "3000";

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" });
  } catch {
    return "";
  }
}

function cwdOf(pid) {
  return sh(`lsof -p ${pid} 2>/dev/null | awk '$4=="cwd"{print $NF; exit}'`).trim();
}

/**
 * 候选必须是真正的 Next 运行实体，避免匹配到执行排查命令的 shell 自身：
 *  - 实际 HTTP 服务进程：命令形如 `next-server (v14.2.5)`
 *  - CLI 进程：node 运行 node_modules/.bin/next 或 next/dist/bin/next
 */
function isNextRuntime(command) {
  return (
    /next-server \(v/.test(command) ||
    /node\s+\S*node_modules\/\.bin\/next(?:\s|$)/.test(command) ||
    /node\s+\S*next\/dist\/bin\/next(?:\s|$)/.test(command)
  );
}

function projectNextProcesses() {
  const out = sh("ps -axo pid=,ppid=,command=");
  const hits = [];
  for (const line of out.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const pid = parseInt(trimmed.split(/\s+/)[0], 10);
    if (!Number.isFinite(pid)) continue;
    // 双保险：不杀守卫自己及其调用链
    if (pid === process.pid || pid === process.ppid) continue;
    if (!isNextRuntime(trimmed)) continue;
    if (cwdOf(pid) === root) hits.push({ pid, command: trimmed });
  }
  return hits;
}

function portListeners(port) {
  const out = sh(`lsof -nP -iTCP:${port} -sTCP:LISTEN 2>/dev/null`);
  return out
    .split("\n")
    .slice(1)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const cols = l.split(/\s+/);
      return { pid: cols[1], detail: l };
    });
}

const running = projectNextProcesses();
const listeners = portListeners(DEV_PORT);

if (running.length > 0 || listeners.length > 0) {
  console.error("");
  console.error("[prebuild 守卫] 检测到本项目 Next 仍在运行，已阻止 build：");
  for (const r of running) {
    console.error(`  - 进程 ${r.pid}: ${r.command}`);
  }
  for (const l of listeners) {
    console.error(`  - 端口 ${DEV_PORT} 被 PID ${l.pid} 占用: ${l.detail}`);
  }
  console.error("");
  console.error("next build 会改写 .next，导致运行中的 dev 出现 CSS/chunk 404（裸 HTML）。");
  console.error("正确流程：npm run dev:restart（会先清理残留并校验端口）→ build 结束后再启动 dev。");
  console.error("");
  process.exit(1);
}
console.log("[prebuild 守卫] 无运行中的 Next 进程/端口占用，继续 build。");
