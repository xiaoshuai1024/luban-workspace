#!/usr/bin/env bash
# 起齐 E2E 服务编排 + 健康检查 + 种子 e2e 账号
# 用法：make e2e-up（或 bash scripts/e2e/up-all.sh）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"

COMPOSE_FILE="docker-compose.e2e.yml"

echo "[e2e] 启动服务编排 ($COMPOSE_FILE)..."
docker compose -f "$COMPOSE_FILE" up -d --build

echo "[e2e] 等待各服务健康..."

wait_http() {
  local url="$1" label="$2" tries="${3:-60}"
  local i=0
  for ((; i<tries; i++)); do
    if curl -sf -o /dev/null -m 3 "$url" 2>/dev/null \
       || curl -s  -o /dev/null -m 3 "$url" 2>/dev/null; then
      # 任意 HTTP 响应（含 401/404）都算服务在线
      echo "  ✓ $label (@ $url)"
      return 0
    fi
    sleep 2
  done
  echo "  ✗ $label 超时未就绪 (@ $url)"
  echo "[e2e] 诊断：docker compose -f $COMPOSE_FILE logs $label"
  return 1
}

# health probes（200/401/404/302 均视为在线）
wait_http "http://127.0.0.1:8080/backend/actuator/health" "backend-java" 90 || exit 1
wait_http "http://127.0.0.1:8081/" "backend-go" 90 || exit 1
wait_http "http://127.0.0.1:3100/" "bff" 60 || exit 1
wait_http "http://127.0.0.1:4200/" "engine" 60 || exit 1
wait_http "http://127.0.0.1:3000/" "website" 60 || exit 1

echo ""
echo "[e2e] 全部服务就绪。"
echo "  Java      http://127.0.0.1:8080/backend"
echo "  Go        http://127.0.0.1:8081"
echo "  BFF       http://127.0.0.1:3100"
echo "  engine    http://127.0.0.1:4200"
echo "  website   http://127.0.0.1:3000"
echo ""
echo "[e2e] 若 e2e 账号尚未预置，请通过后端接口/SQL 创建专用账号，"
echo "      并在 e2e/.env 填入 LUBAN_E2E_ACCOUNT / LUBAN_E2E_PASSWORD。"
