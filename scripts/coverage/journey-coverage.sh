#!/usr/bin/env bash
#
# journey-coverage.sh — 旅程覆盖率度量（E2E 链路覆盖）的薄包装。
#
# 代理到 scripts/verify-plan-ssot.mjs journey-coverage:
#   - 聚合所有 docs/superpowers/tasks/*.json 的 journeys（分母）
#   - 扫描所有 spec 的 @J-<journey-id> 标签（分子）
#   - 输出覆盖率矩阵；P0 旅程无 spec 绑定 → exit 1（阻断）
#
# 与 coverage-summary.sh（代码行覆盖率）正交，二者构成双维度门禁。
# 详见 docs/dev/ssot-task-graph.md「旅程覆盖」。
#
# 用法:
#   bash scripts/coverage/journey-coverage.sh
#   make journey-coverage
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
exec node "${ROOT_DIR}/scripts/verify-plan-ssot.mjs" journey-coverage
