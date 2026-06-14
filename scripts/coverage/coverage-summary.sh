#!/usr/bin/env bash
#
# coverage-summary.sh
# luban-workspace 全栈单元测试覆盖率门禁检查。
#
# 依次遍历 packages/* 下各包，按技术栈分发收集覆盖率：
#   - TS（pnpm test --coverage / vitest --coverage）→ engine / bff / ui / website
#   - Java（mvn -q verify + 读 target/site/jacoco/index.xml）→ luban-backend
#   - Go（go test ./... -coverprofile=coverage.out）→ luban-backend-go
#
# 包不存在或无测试用例则跳过并提示，不中断整体流程。
# 末尾输出汇总表 + 各 HTML 报告路径；任一存在测试的包未达标 → 退出码 1。
#
# 覆盖率目标（见 CLAUDE.md）：
#   TS 引擎/bff/website 85% · UI 组件库 90% · Java 后端 80% · Go 后端 75%
#
# 用法（主仓根目录）:
#   bash scripts/coverage/coverage-summary.sh
#   make test-coverage
#
# 依赖假设（须已装）：pnpm / mvn / go；缺失对应工具时该栈整体跳过。
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# ── 颜色 ──────────────────────────────────────────────────
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; CYAN=''; BOLD=''; NC=''
fi

PASS=0
FAIL=1
SKIP=2

# ── 包清单（相对路径 : 显示名 : 技术栈 : 行覆盖率目标%） ──
# 技术栈：ts | java | go
PKGS=(
  "packages/engine/luban:engine:ts:85"
  "packages/bff/luban-bff:bff:ts:85"
  "packages/ui/luban-ui:ui:ts:90"
  "packages/web/luban-website:website:ts:85"
  "packages/backend/luban-backend:luban-backend:java:80"
  "packages/backend/luban-backend-go:luban-backend-go:go:75"
)

# 汇总表数据：name|stack|target|actual|status|html_path
declare -a SUMMARY_ROWS=()
ANY_FAIL=0
ANY_REAL=0   # 至少有一个包真正执行了覆盖率（非 skip）

print_header() {
  echo ""
  printf "${CYAN}%s${NC}\n" "═══════════════════════════════════════════════════════════"
  printf "${CYAN}%s${NC}\n" "  luban-workspace 全栈单元测试覆盖率门禁检查"
  printf "${CYAN}%s${NC}\n" "═══════════════════════════════════════════════════════════"
  echo ""
}

require_cmd_or_skip() {
  # $1 = 命令名；存在返回 0，否则打印提示并返回 1
  if command -v "$1" >/dev/null 2>&1; then
    return 0
  fi
  printf "  ${YELLOW}⚠${NC} 未找到 '%s'，跳过该栈\n" "$1"
  return 1
}

# 读取 JaCoCo index.xml 中的行覆盖率百分比（<counter type='LINE' missed=.. covered=..>）
jacoco_line_pct() {
  local idx="$1"
  [[ -f "$idx" ]] || return 1
  # 兼容老（HTML 内嵌 XML 不再用）与新版本：直接读 target/site/jacoco/jacoco.xml 或 index.xml 同目录
  local xml="$idx"
  [[ -f "$xml" ]] || xml="${idx%/index.xml}/jacoco.xml"
  [[ -f "$xml" ]] || xml="${idx}"
  awk '
    /<counter type="LINE"/ {
      miss=0; cov=0
      match($0, /missed="([0-9]+)"/, m); if (m[1]!="") miss=m[1]
      match($0, /covered="([0-9]+)"/, c); if (c[1]!="") cov=c[1]
      total=miss+cov
      if (total>0) { printf "%.2f\n", (cov*100.0)/total; exit }
    }
  ' "$xml" 2>/dev/null
  # 兜底：index.xml（旧版报告根节点有 counter 聚合）
}

# 从 Go coverprofile 计算 total 行覆盖率（带 go 工具优先）
go_line_pct() {
  local cov="$1"
  [[ -f "$cov" ]] || return 1
  if command -v go >/dev/null 2>&1; then
    go tool cover -func="$cov" 2>/dev/null | awk '/^total:/ { gsub("%","",$3); printf "%.2f\n", $3; exit }'
  else
    awk -F: '
      /^mode/ { next }
      {
        n=split($3, p, " "); split(p[1], c, " ")
        # col3 = "count,num"
        split($3, a, " "); split(a[1], kv, ",")
        # 简化：累计非零语句计为 covered
        total++; if (kv[2]+0 > 0) covered++
      }
      END { if (total>0) printf "%.2f\n", covered*100.0/total }
    ' "$cov" 2>/dev/null
  fi
}

# 从 TS coverage/coverage-summary.json 读 lines.pct（@vitest/istanbul 或 c8）
ts_line_pct() {
  local pkg_dir="$1"
  local f
  for f in \
      "${pkg_dir}/coverage/coverage-summary.json" \
      "${pkg_dir}/coverage/lcov-report/coverage-summary.json" \
      "${pkg_dir}/coverage/coverage-final.json"; do
    if [[ -f "$f" ]]; then
      # coverage-summary.json: { "total": { "lines": { "pct": 87.5 } } }
      local pct
      pct="$(awk -F'"pct"' '/"lines"/{print}' "$f" 2>/dev/null | head -1)"
      pct="${pct#*:}"; pct="${pct%%,*}"; pct="${pct//[^0-9.]/}"
      if [[ -n "$pct" ]]; then printf "%.2f\n" "$pct"; return 0; fi
    fi
  done
  return 1
}

run_ts_pkg() {
  local pkg_dir="$1" name="$2" target="$3"
  local html_path="${pkg_dir}/coverage/index.html"
  [[ -f "${pkg_dir}/coverage/lcov-report/index.html" ]] && html_path="${pkg_dir}/coverage/lcov-report/index.html"

  printf "▸ [TS] %s（目标 ≥%s%%）...\n" "$name" "$target"
  if ! require_cmd_or_skip pnpm; then
    SUMMARY_ROWS+=("${name}|ts|${target}|-|SKIP|${html_path}"); return 0; fi
  if ! require_cmd_or_skip node; then
    SUMMARY_ROWS+=("${name}|ts|${target}|-|SKIP|${html_path}"); return 0; fi

  local exit_code
  set +e
  # 优先项目自定义 test:coverage，回退通用 pnpm test --coverage
  if grep -q '"test:coverage"' "${pkg_dir}/package.json" 2>/dev/null; then
    ( cd "${pkg_dir}" && pnpm run test:coverage ) 2>&1
  else
    ( cd "${pkg_dir}" && pnpm test -- --coverage ) 2>&1
  fi
  exit_code=$?
  set -e
  ANY_REAL=1

  local actual="-"
  actual="$(ts_line_pct "${pkg_dir}" 2>/dev/null || echo -)"
  if [[ "$exit_code" -ne 0 ]]; then
    printf "  ${RED}✗${NC} %s 测试失败（exit=%s）\n" "$name" "$exit_code"
    SUMMARY_ROWS+=("${name}|ts|${target}|${actual}|FAIL|${html_path}")
    ANY_FAIL=1; return 0
  fi
  if [[ "$actual" == "-" ]]; then
    printf "  ${YELLOW}⚠${NC} %s 测试通过但未解析到覆盖率（检查 reporter 配置）\n" "$name"
    SUMMARY_ROWS+=("${name}|ts|${target}|-|WARN|${html_path}"); return 0
  fi
  # awk 比较：actual >= target
  if awk "BEGIN{exit !($actual >= $target)}"; then
    printf "  ${GREEN}✓${NC} %s %s%% ≥ %s%%\n" "$name" "$actual" "$target"
    SUMMARY_ROWS+=("${name}|ts|${target}|${actual}|PASS|${html_path}")
  else
    printf "  ${RED}✗${NC} %s %s%% < %s%%\n" "$name" "$actual" "$target"
    SUMMARY_ROWS+=("${name}|ts|${target}|${actual}|FAIL|${html_path}")
    ANY_FAIL=1
  fi
}

run_java_pkg() {
  local pkg_dir="$1" name="$2" target="$3"
  local jacoco_idx="${pkg_dir}/target/site/jacoco/index.html"
  local html_path="${pkg_dir}/target/site/jacoco/index.html"

  printf "▸ [Java] %s（目标 ≥%s%%）...\n" "$name" "$target"
  if ! require_cmd_or_skip mvn; then
    SUMMARY_ROWS+=("${name}|java|${target}|-|SKIP|${html_path}"); return 0; fi
  if ! require_cmd_or_skip java; then
    SUMMARY_ROWS+=("${name}|java|${target}|-|SKIP|${html_path}"); return 0; fi

  local exit_code
  set +e
  ( cd "${pkg_dir}" && mvn -q verify ) 2>&1
  exit_code=$?
  set -e
  ANY_REAL=1

  if [[ "$exit_code" -ne 0 ]]; then
    printf "  ${RED}✗${NC} %s 构建或测试失败（exit=%s）\n" "$name" "$exit_code"
    SUMMARY_ROWS+=("${name}|java|${target}|-|FAIL|${html_path}")
    ANY_FAIL=1; return 0
  fi

  local actual="-"
  actual="$(jacoco_line_pct "${jacoco_idx%/index.xml}" 2>/dev/null || echo -)"
  # jacoco_line_pct 接收 xml 路径，这里传目录让它兜底到 jacoco.xml
  if [[ "$actual" == "-" ]]; then
    actual="$(jacoco_line_pct "${pkg_dir}/target/site/jacoco/jacoco.xml" 2>/dev/null || echo -)"
  fi
  if [[ "$actual" == "-" ]]; then
    printf "  ${YELLOW}⚠${NC} %s 构建成功但未找到 JaCoCo 报告（pom 未配 jacoco-maven-plugin？）\n" "$name"
    SUMMARY_ROWS+=("${name}|java|${target}|-|WARN|${html_path}"); return 0
  fi
  if awk "BEGIN{exit !($actual >= $target)}"; then
    printf "  ${GREEN}✓${NC} %s %s%% ≥ %s%%\n" "$name" "$actual" "$target"
    SUMMARY_ROWS+=("${name}|java|${target}|${actual}|PASS|${html_path}")
  else
    printf "  ${RED}✗${NC} %s %s%% < %s%%\n" "$name" "$actual" "$target"
    SUMMARY_ROWS+=("${name}|java|${target}|${actual}|FAIL|${html_path}")
    ANY_FAIL=1
  fi
}

run_go_pkg() {
  local pkg_dir="$1" name="$2" target="$3"
  local cov_out="${pkg_dir}/coverage.out"
  local html_path="${pkg_dir}/coverage.html"

  printf "▸ [Go] %s（目标 ≥%s%%）...\n" "$name" "$target"
  if ! require_cmd_or_skip go; then
    SUMMARY_ROWS+=("${name}|go|${target}|-|SKIP|${html_path}"); return 0; fi

  local exit_code
  set +e
  ( cd "${pkg_dir}" && go test ./... -coverprofile="${cov_out}" ) 2>&1
  exit_code=$?
  set -e
  ANY_REAL=1

  if [[ "$exit_code" -ne 0 ]]; then
    printf "  ${RED}✗${NC} %s 测试失败（exit=%s）\n" "$name" "$exit_code"
    SUMMARY_ROWS+=("${name}|go|${target}|-|FAIL|${html_path}")
    ANY_FAIL=1; return 0
  fi
  # 生成 HTML（best-effort，失败不影响判定）
  if [[ -f "${cov_out}" ]]; then
    ( cd "${pkg_dir}" && go tool cover -html="${cov_out}" -o "${html_path}" ) 2>/dev/null || true
  fi

  local actual="-"
  actual="$(go_line_pct "${cov_out}" 2>/dev/null || echo -)"
  if [[ "$actual" == "-" ]]; then
    printf "  ${YELLOW}⚠${NC} %s 测试通过但未解析到覆盖率\n" "$name"
    SUMMARY_ROWS+=("${name}|go|${target}|-|WARN|${html_path}"); return 0
  fi
  if awk "BEGIN{exit !($actual >= $target)}"; then
    printf "  ${GREEN}✓${NC} %s %s%% ≥ %s%%\n" "$name" "$actual" "$target"
    SUMMARY_ROWS+=("${name}|go|${target}|${actual}|PASS|${html_path}")
  else
    printf "  ${RED}✗${NC} %s %s%% < %s%%\n" "$name" "$actual" "$target"
    SUMMARY_ROWS+=("${name}|go|${target}|${actual}|FAIL|${html_path}")
    ANY_FAIL=1
  fi
}

print_summary_table() {
  echo ""
  printf "${CYAN}%s${NC}\n" "═══════════════════════════════════════════════════════════"
  printf "${CYAN}%s${NC}\n" "  覆盖率报告汇总"
  printf "${CYAN}%s${NC}\n" "═══════════════════════════════════════════════════════════"
  printf "  %-22s %-6s %-10s %-10s %s\n" "项目" "栈" "目标" "实际" "状态"
  printf "  %-22s %-6s %-10s %-10s %s\n" "----------------------" "------" "----------" "----------" "--------"

  local row name stack target actual status color sym
  for row in "${SUMMARY_ROWS[@]}"; do
    IFS='|' read -r name stack target actual status _ <<<"$row"
    case "$status" in
      PASS) color="$GREEN"; sym="PASS ✓" ;;
      FAIL) color="$RED";   sym="FAIL ✗" ;;
      WARN) color="$YELLOW"; sym="WARN ⚠" ;;
      SKIP) color="$YELLOW"; sym="SKIP –" ;;
      *)    color="$NC";    sym="$status" ;;
    esac
    printf "  %-22s %-6s %-10s %-10s ${color}%s${NC}\n" \
      "$name" "$stack" "≥${target}%" "${actual}%" "$sym"
  done

  printf "${CYAN}%s${NC}\n" "═══════════════════════════════════════════════════════════"
  echo ""
  echo "  HTML 覆盖率报告路径（存在时）："
  for row in "${SUMMARY_ROWS[@]}"; do
    IFS='|' read -r name _ _ _ status html_path <<<"$row"
    if [[ "$status" != "SKIP" && -f "${ROOT_DIR}/${html_path}" ]]; then
      printf "    %-16s %s\n" "$name:" "$html_path"
    fi
  done
  echo ""
}

# ── 主流程 ─────────────────────────────────────────────────
print_header

for entry in "${PKGS[@]}"; do
  # entry = "packages/.../dir:name:stack:target"
  rel="${entry%%:*}"; rest="${entry#*:}"
  name="${rest%%:*}"; rest="${rest#*:}"
  stack="${rest%%:*}"; target="${rest#*:}"

  pkg_dir="${ROOT_DIR}/${rel}"
  if [[ ! -d "$pkg_dir" ]]; then
    printf "${YELLOW}[skip]${NC} %s 路径不存在：%s\n" "$name" "$rel"
    SUMMARY_ROWS+=("${name}|${stack}|${target}|-|SKIP|-")
    continue
  fi
  if [[ ! -d "$pkg_dir/.git" && ! -f "$pkg_dir/.git" && ! -f "$pkg_dir/package.json" && ! -f "$pkg_dir/pom.xml" && ! -f "$pkg_dir/go.mod" ]]; then
    printf "${YELLOW}[skip]${NC} %s 子模块尚未初始化（空目录）：%s\n" "$name" "$rel"
    SUMMARY_ROWS+=("${name}|${stack}|${target}|-|SKIP|-")
    continue
  fi

  case "$stack" in
    ts)   run_ts_pkg   "$pkg_dir" "$name" "$target" ;;
    java) run_java_pkg "$pkg_dir" "$name" "$target" ;;
    go)   run_go_pkg   "$pkg_dir" "$name" "$target" ;;
    *)    printf "${RED}未知技术栈：%s${NC}\n" "$stack" ;;
  esac
done

print_summary_table

if [[ "$ANY_REAL" -eq 0 ]]; then
  printf "${YELLOW}%s${NC}\n" "⚠ 没有任何包真正执行了覆盖率（全部 skip）。请检查子模块是否初始化、工具链是否安装。"
  exit 1
fi

if [[ "$ANY_FAIL" -eq 1 ]]; then
  printf "${RED}%s${NC}\n" "❌ 部分包覆盖率门禁未通过，请检查上述报告。"
  exit 1
fi

printf "${GREEN}%s${NC}\n" "✅ 所有已执行包的覆盖率门禁均通过！"
exit 0
