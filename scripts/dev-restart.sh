#!/bin/sh
# dev:restart — 安全重启开发服务器（单实例 + 固定端口 3000）
#
# 流程：
#   1) 终止 cwd 为本项目的所有 Next 运行实体 —— 既杀 `next dev/build/start` CLI，
#      也杀真正监听端口的 `next-server (vX.Y.Z)` 服务进程（含 PPID=1 的孤儿）；
#   2) 校验 3000 已空闲 —— 被占就直接失败，绝不允许静默漂移到 3001；
#   3) 删除 .next；
#   4) 以固定 -p 3000 启动唯一实例；
#   5) 健康检查 + 漂移检测后才宣布就绪。
#
# 2026-09-30 事故修复：
# 旧版 pgrep 模式 `next (dev|build)` 匹配不到 next-server，CLI 父进程被手动杀掉后，
# next-server 成孤儿继续占 3000；随后 next build 覆盖 .next（旧 guard 同样漏检），
# 新 dev 启动时 3000 被占静默漂到 3001，浏览器仍访问 3000 孤儿 → chunk 404 → 裸 HTML。

cd "$(dirname "$0")/.." || exit 1
ROOT="$(pwd)"
PORT="${PORT:-3000}"

echo "[dev:restart] 1/5 扫描本项目残留 Next 进程（含 next-server 孤儿）..."
# 严格形态匹配，避免误伤执行本脚本/排查命令的 shell：
#  - next-server 进程命令行形如：next-server (v14.2.5)
#  - CLI 进程命令行形如：node /abs/path/node_modules/.bin/next dev
PIDS=$(ps -axo pid=,command= | awk '/next-server \(v[0-9]/ || /node +\/.*\.bin\/next (dev|build|start)/ {print $1}')
KILLED=""
for pid in $PIDS; do
  [ "$pid" = "$$" ] && continue
  CWD=$(lsof -p "$pid" 2>/dev/null | awk '$4=="cwd" {print $NF; exit}')
  if [ "$CWD" = "$ROOT" ]; then
    kill "$pid" 2>/dev/null && KILLED="$KILLED $pid"
  fi
done
if [ -n "$KILLED" ]; then
  echo "[dev:restart] 已发送 TERM:$KILLED，等待退出..."
  sleep 3
  for pid in $KILLED; do
    if kill -0 "$pid" 2>/dev/null; then
      echo "[dev:restart] PID $pid 未退出，SIGKILL 兜底"
      kill -9 "$pid" 2>/dev/null
    fi
  done
  sleep 1
else
  echo "[dev:restart] 无残留进程"
fi

echo "[dev:restart] 2/5 校验端口 $PORT ..."
USING=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$USING" ]; then
  echo "[dev:restart] ✘ 端口 $PORT 仍被占用（PID: $USING）："
  lsof -nP -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null
  echo "[dev:restart] 拒绝在端口漂移状态下启动。历史事故：静默漂到 3001，浏览器仍访问 3000 孤儿 → 裸 HTML。"
  echo "[dev:restart] 请先释放 $PORT（必要时手动 kill 上述 PID）后重试。"
  exit 1
fi

echo "[dev:restart] 3/5 清理 .next ..."
rm -rf .next

echo "[dev:restart] 4/5 启动单实例 dev（强制端口 $PORT）..."
./node_modules/.bin/next dev -p "$PORT" &
CHILD=$!
trap 'kill -9 "$CHILD" 2>/dev/null' TERM INT

READY=0
i=0
while [ "$i" -lt 90 ]; do
  if ! kill -0 "$CHILD" 2>/dev/null; then
    echo "[dev:restart] ✘ dev 进程提前退出，请检查上方 Next 报错"
    exit 1
  fi
  if curl -sf -o /dev/null "http://localhost:$PORT/"; then
    READY=1
    break
  fi
  i=$((i + 1))
  sleep 1
done
if [ "$READY" != "1" ]; then
  echo "[dev:restart] ✘ 90s 内 http://localhost:$PORT 未就绪"
  kill -9 "$CHILD" 2>/dev/null
  exit 1
fi

# 漂移检测：指定端口外不应出现本项目的 next 监听
OTHER_PORTS=""
for p in 3001 3002; do
  if [ -n "$(lsof -nP -iTCP:$p -sTCP:LISTEN -t 2>/dev/null)" ]; then
    OTHER_PORTS="$OTHER_PORTS $p"
  fi
done
if [ -n "$OTHER_PORTS" ]; then
  echo "[dev:restart] ✘ 检测到端口漂移:$OTHER_PORTS（$PORT 被外部占用）。已停止 dev，请先释放 $PORT。"
  kill -9 "$CHILD" 2>/dev/null
  exit 1
fi

LISTENER=$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t 2>/dev/null | tr '\n' ' ')
echo "[dev:restart] 5/5 ✓ 就绪 http://localhost:$PORT（监听 PID:$LISTENER），单实例固定端口"
wait "$CHILD"
