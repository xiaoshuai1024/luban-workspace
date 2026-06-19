#!/usr/bin/env bash
# 停 E2E 服务编排，干净退出
# 用法：make e2e-down（或 bash scripts/e2e/down-all.sh）
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
COMPOSE_FILE="docker-compose.e2e.yml"

echo "[e2e] 停止服务编排 ($COMPOSE_FILE)..."
docker compose -f "$COMPOSE_FILE" down --remove-orphans

echo "[e2e] 已停止（数据卷 e2e-mysql 保留，如需清除：docker volume rm luban-workspace_e2e-mysql）"
