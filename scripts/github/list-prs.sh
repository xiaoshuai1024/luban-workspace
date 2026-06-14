#!/usr/bin/env bash
#
# list-prs.sh
# 列出 luban-workspace 各子模块 + 主仓的开放 PR（gh pr list 封装）。
#
# 用法（主仓根目录）:
#   bash scripts/github/list-prs.sh [--state open|closed|all] [--limit 30] [--mine]
#   bash scripts/github/list-prs.sh --repo packages/engine/luban
#
# 选项:
#   --state <s>   PR 状态（默认 open）
#   --limit <n>   每个 repo 最多列出几条（默认 20）
#   --mine        仅 @me 的 PR（--author @me）
#   --repo <rel>  只查单个子模块（相对路径）
#   --json        输出 JSON（便于管道处理）
#   -h, --help
#
# 依赖：gh（已认证）。
#
set -euo pipefail

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "Error: 缺少命令: $1" >&2; exit 1; }; }
require_cmd git
require_cmd gh

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[[ -z "$ROOT" ]] && { echo "Error: 不在 git 仓库内。" >&2; exit 1; }

STATE="open"
LIMIT=20
MINE="false"
ONLY_REPO=""
JSON="false"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --state) STATE="${2:-}"; shift 2 ;;
    --limit) LIMIT="${2:-}"; shift 2 ;;
    --mine)  MINE="true"; shift ;;
    --repo)  ONLY_REPO="${2:-}"; shift 2 ;;
    --json)  JSON="true"; shift ;;
    -h|--help) grep '^#' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Error: 未知参数: $1" >&2; exit 1 ;;
  esac
done

# 从 dir 推导 owner/repo
repo_full_name() {
  local url
  url="$(git -C "$1" remote get-url origin 2>/dev/null || true)"
  url="${url%.git}"
  if [[ "$url" == git@*:* ]]; then
    echo "${url#*:}"
  elif [[ "$url" == https://* ]]; then
    echo "${url#https://*/}"
  else
    echo ""
  fi
}

# 构造目标仓库列表："dir|display"
declare -a TARGETS=()
if [[ -n "$ONLY_REPO" ]]; then
  case "$ONLY_REPO" in
    "$ROOT"/*) ONLY_REPO="${ONLY_REPO#$ROOT/}" ;;
  esac
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

for entry in "${TARGETS[@]}"; do
  dir="${entry%|*}"
  label="${entry#*|}"
  if [[ ! -d "$dir" ]]; then
    printf "%-40s [skip: 不存在]\n" "$label"
    continue
  fi
  if ! git -C "$dir" rev-parse --git-dir >/dev/null 2>&1; then
    printf "%-40s [skip: 不是 git 仓]\n" "$label"
    continue
  fi
  full="$(repo_full_name "$dir")"
  [[ -z "$full" ]] && { printf "%-40s [skip: 无 origin]\n" "$label"; continue; }

  echo ""
  echo "── ${label}  (${full}) ──────────────────────"
  gh_args=(pr list --repo "$full" --state "$STATE" --limit "$LIMIT")
  [[ "$MINE" == "true" ]] && gh_args+=(--author "@me")
  if [[ "$JSON" == "true" ]]; then
    gh "${gh_args[@]}" --json number,title,headRefName,baseRefName,state,author,url 2>&1 || true
  else
    gh "${gh_args[@]}" 2>&1 || true
  fi
done

echo ""
echo "Done."
