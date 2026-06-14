#!/usr/bin/env bash
#
# check-ci.sh
# 检查 luban-workspace 各子模块 + 主仓最新 PR / 默认分支的 CI 状态（gh 封装）。
#
# 用法（主仓根目录）:
#   bash scripts/github/check-ci.sh
#   bash scripts/github/check-ci.sh --repo packages/engine/luban
#   bash scripts/github/check-ci.sh --pr 123            # 仅查指定 PR 号（每个 repo 解析）
#   bash scripts/github/check-ci.sh --watch             # 轮询直到所有完成（默认不轮询）
#   bash scripts/github/check-ci.sh --branch feature/x  # 指定分支
#
# 输出：每个仓库的最末 commit 的 checks 结论（success/failure/pending/none）。
# 退出码：任一仓库存在 failure → 1；全部 success 或无 CI → 0。
#
# 依赖：gh（已认证）。
#
set -euo pipefail

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Error: 缺少命令: $1" >&2; exit 1; }; }
require_cmd git
require_cmd gh

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -z "$ROOT" ]] && { echo "Error: 不在 git 仓库内。" >&2; exit 1; }

ONLY_REPO=""
ONLY_PR=""
ONLY_BRANCH=""
WATCH="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)   ONLY_REPO="${2:-}"; shift 2 ;;
    --pr)     ONLY_PR="${2:-}"; shift 2 ;;
    --branch) ONLY_BRANCH="${2:-}"; shift 2 ;;
    --watch)  WATCH="true"; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Error: 未知参数: $1" >&2; exit 1 ;;
  esac
done

repo_full_name() {
  local url
  url="$(git -C "$1" remote get-url origin 2>/dev/null || true)"
  url="${url%.git}"
  if [[ "$url" == git@*:* ]]; then echo "${url#*:}"
  elif [[ "$url" == https://* ]]; then echo "${url#https://*/}"
  else echo ""; fi
}

# 给定 repo dir，返回需要检查的分支（HEAD 或 --branch）
resolve_branch() {
  local dir="$1"
  if [[ -n "$ONLY_BRANCH" ]]; then echo "$ONLY_BRANCH"; return; fi
  git -C "$dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo ""
}

# 报告某 repo / 分支的 checks 汇总
# 返回结论字符串（在 stdout）：success | failure | pending | none | error
report_checks() {
  local full="$1" branch="$2"
  if [[ -z "$branch" ]]; then echo "none"; return; fi
  # gh pr checks 需要 PR；用 gh run list 更通用
  local runs
  runs="$(gh run list --repo "$full" --branch "$branch" --limit 5 --json conclusion,status,name,event 2>/dev/null || echo '[]')"
  # 若无任何 run → none
  if [[ "$runs" == "[]" || -z "$runs" ]]; then echo "none"; return; fi
  # 取最近一条 completed 的 conclusion
  local concl
  concl="$(printf '%s' "$runs" | python3 -c '
import json, sys
try:
    data = json.load(sys.stdin)
except Exception:
    print("none"); sys.exit(0)
for r in data:
    if r.get("status") == "completed":
        print(r.get("conclusion") or "unknown"); sys.exit(0)
print("pending")
' 2>/dev/null || echo pending)"
  echo "$concl"
}

declare -a TARGETS=()
if [[ -n "$ONLY_REPO" ]]; then
  case "$ONLY_REPO" in "$ROOT"/*) ONLY_REPO="${ONLY_REPO#$ROOT/}" ;; esac
  TARGETS+=("${ROOT}/${ONLY_REPO}|${ONLY_REPO}")
else
  if [[ -f "${ROOT}/.gitmodules" ]]; then
    while IFS= read -r rel; do
      [[ -n "$rel" ]] && TARGETS+=("${ROOT}/${rel}|${rel}")
    done < <(git config --file "${ROOT}/.gitmodules" --get-regexp '^submodule\..*\.path$' \
              | awk '{ print $2 }' | sort -u)
  fi
  TARGETS+=("${ROOT}|luban-workspace(meta)")
fi

if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; CYAN=''; NC=''
fi

ANY_FAIL=0
MAX_WAIT=30   # --watch 最大轮询分钟（粗略）

check_once() {
  echo ""
  printf "${CYAN}%s${NC}\n" "═══════════════════════════════════════════════════════════"
  printf "${CYAN}%s${NC}\n" "  CI 状态汇总"
  printf "${CYAN}%s${NC}\n" "═══════════════════════════════════════════════════════════"
  local all_done=1
  for entry in "${TARGETS[@]}"; do
    dir="${entry%|*}"; label="${entry#*|}"
    if [[ ! -d "$dir" ]] || ! git -C "$dir" rev-parse --git-dir >/dev/null 2>&1; then
      printf "%-40s ${YELLOW}[skip]${NC}\n" "$label"
      continue
    fi
    full="$(repo_full_name "$dir")"
    [[ -z "$full" ]] && { printf "%-40s ${YELLOW}[skip: 无 origin]${NC}\n" "$label"; continue; }
    branch="$(resolve_branch "$dir")"
    concl="$(report_checks "$full" "$branch")"
    local color sym
    case "$concl" in
      success)  color="$GREEN";  sym="✓ success";;
      failure|cancelled|timed_out|action_required) color="$RED"; sym="✗ ${concl}"; ANY_FAIL=1;;
      pending|in_progress|queued|null) color="$YELLOW"; sym="… pending"; all_done=0;;
      none)     color="$YELLOW"; sym="– none";;
      *)        color="$NC";     sym="$concl";;
    esac
    printf "%-40s %-12s ${color}%s${NC}\n" "$label" "(${branch})" "$sym"
  done
  echo ""
  return $all_done
}

if [[ "$WATCH" == "true" ]]; then
  tries=0
  while true; do
    all_done=1
    check_once || all_done=0
    [[ $all_done -eq 1 ]] && break
    tries=$((tries+1))
    if [[ $tries -ge $MAX_WAIT ]]; then
      echo "watch: 达到最大轮询上限 ${MAX_WAIT} 次，停止。" >&2
      break
    fi
    echo "（${tries}/${MAX_WAIT}）等待 60s 后重试..."
    sleep 60
  done
else
  check_once || true
fi

if [[ $ANY_FAIL -eq 1 ]]; then
  printf "${RED}%s${NC}\n" "❌ 存在失败的 CI run。"
  exit 1
fi
printf "${GREEN}%s${NC}\n" "✅ 未检测到失败（success / pending / none）。"
exit 0
