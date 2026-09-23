#!/bin/sh
# dev:restart — 安全重启开发服务器（单实例保证）
# 流程：仅终止 cwd 为本项目的残留 next dev/build 进程 → 删除 .next → 启动唯一一个 next dev
# 背景：残留/断裂的 dev 实例会因内存编译状态与磁盘 .next 脱节而输出引用 404 CSS 的 HTML（裸 HTML）
cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"

PIDS=$(pgrep -f "next (dev|build)" 2>/dev/null || true)
for pid in $PIDS; do
  CWD=$(lsof -p "$pid" 2>/dev/null | awk '/cwd/{print $NF}' | head -1)
  if [ "$CWD" = "$ROOT" ]; then
    kill "$pid" 2>/dev/null && echo "[dev:restart] 已终止残留 next 进程 $pid"
  fi
done
sleep 1

rm -rf .next
echo "[dev:restart] .next 已清理，启动单实例 dev..."
exec ./node_modules/.bin/next dev
