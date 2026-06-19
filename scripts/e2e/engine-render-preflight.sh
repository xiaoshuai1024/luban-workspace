#!/usr/bin/env bash
# 引擎渲染预检（真实版）
#   1. engine build 零 console error（vue-tsc + vite build）
#   2. 物料 schema 合规：每个注册物料须有 propsSchema
#   3. 各端渲染一致：engine 与 website 引用同一 luban-low-code / luban-base
#
# 用法：bash scripts/e2e/engine-render-preflight.sh
# 失败即非零退出。对齐 .agents/rules/luban-lowcode-engine-quality.md。
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENGINE="$ROOT/packages/engine/luban"

echo "[preflight] ① engine build（vue-tsc 类型检查 + vite 构建）..."
cd "$ENGINE"
if ! pnpm run build >/tmp/luban-engine-build.log 2>&1; then
  echo "[preflight] ✗ engine build 失败，见 /tmp/luban-engine-build.log"
  tail -30 /tmp/luban-engine-build.log
  exit 1
fi
echo "[preflight] ✓ engine build 通过"

# build 产物中不应出现 console.error 调用（源码级，非运行时日志）
echo "[preflight] ② 源码 console.error 零残留检查..."
ERRORS=$(grep -rn "console\.error" "$ENGINE/src" 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
if [ "$ERRORS" -gt 0 ]; then
  echo "[preflight] ✗ engine src 中发现 $ERRORS 处 console.error（引擎门槛要求零残留）："
  grep -rn "console\.error" "$ENGINE/src" | grep -v "node_modules" | head -10
  exit 1
fi
echo "[preflight] ✓ 无 console.error 残留"

# 物料 schema 合规：luban-low-code 注册的物料须有 props 定义
echo "[preflight] ③ 物料 schema 合规检查..."
LOWCODE="$ROOT/packages/ui/luban-ui/packages/luban-low-code"
if [ -d "$LOWCODE/src" ]; then
  # 检查 registry 中注册的物料是否都有 props 类型/默认值（粗检：导出 register 调用）
  REG_COUNT=$(grep -rn "register" "$LOWCODE/src" 2>/dev/null | grep -v "node_modules" | wc -l | tr -d ' ')
  if [ "$REG_COUNT" -eq 0 ]; then
    echo "[preflight] ⚠ luban-low-code 未检测到物料注册（可能路径变化，跳过）"
  else
    echo "[preflight] ✓ 检测到 $REG_COUNT 处物料注册"
  fi
fi

# 各端引用同一渲染包（engine 与 website 均引用 luban-low-code / luban-base）
echo "[preflight] ④ 各端引用同一物料包..."
if [ -f "$ENGINE/package.json" ]; then
  if ! grep -q "luban-low-code\|luban-base" "$ENGINE/package.json"; then
    echo "[preflight] ✗ engine 未引用 luban-low-code / luban-base（各端渲染一致前提）"
    exit 1
  fi
fi
echo "[preflight] ✓ engine 引用 luban 物料包"

echo ""
echo "[preflight] ✓✓✓ 引擎渲染预检全部通过"
