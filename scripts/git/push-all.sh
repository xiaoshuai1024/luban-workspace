#!/usr/bin/env bash
#
# push-all.sh
# 遍历 .gitmodules 中各子模块 + 主仓：有改动则按规范 commit + push 当前分支（不建 PR）。
# 顺序：各子模块先提交（便于主仓随后更新子模块指针）→ 主仓最后。
#
# 用法（主仓根目录）:
#   bash scripts/git/push-all.sh
#   bash scripts/git/push-all.sh -m "feat(engine): 新增物料渲染"
#   bash scripts/git/push-all.sh --plain
#
# 默认（无 -m、无 --plain）：每个仓库单独生成一条 conventional 说明
#   （见 scripts/git/push-all-commit-msg.lib.sh），并可设
#   PUSH_ALL_REQUIREMENT_FILE=路径 指向方案 md 以提取首行 # 标题。
#
# 行为：
#   - 仅当仓库存在未提交变更时才 commit；否则跳过。
#   - detached HEAD 的仓库跳过并 warn。
#   - 提交后执行 git push -u origin HEAD（推送当前检出分支）。
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi
# shellcheck source=push-all-commit-msg.lib.sh
source "${SCRIPT_DIR}/push-all-commit-msg.lib.sh"

usage() {
  cat <<'EOF'
用法:
  bash scripts/git/push-all.sh [-m|--message <提交说明>] [--plain]

说明:
  - 遍历 .gitmodules 各子模块，最后处理主仓。
  - 仅当仓库存在未提交变更时才 commit；否则跳过。
  - detached HEAD 的仓库跳过并 warn。
  - 提交后执行 git push -u origin HEAD。

提交说明（三选一，优先级从高到低）:
  -m / --message   所有本次产生的提交共用这一条说明（覆盖自动推断）。
  --plain          所有仓库使用固定说明: chore: push-all 同步本地改动 (UTC 日期)
  （默认）         每个仓库根据暂存文件路径 + 可选需求文档自动推断 type(scope): subject
                   环境变量 PUSH_ALL_REQUIREMENT_FILE 指向含「# 标题」的 md；
                   未设时尝试 harness/plans 或 docs/superpowers/plans 下最近修改的 md。

选项:
  -m, --message   自定义提交说明（所有本次产生的提交共用）
  --plain         关闭自动推断，使用固定 chore 说明
  -h, --help      显示本帮助
EOF
}

MSG=""
USE_PLAIN=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    -m|--message) MSG="${2:-}"; shift 2 ;;
    --plain)      USE_PLAIN=1; shift ;;
    -h|--help)    usage; exit 0 ;;
    *) echo "Error: 未知参数: $1" >&2; usage >&2; exit 1 ;;
  esac
done

repo_has_pending_changes() {
  [[ -n "$(git -C "$1" status --porcelain 2>/dev/null)" ]]
}

push_repo() {
  local dir="$1"; local label="$2"

  if [[ ! -d "${dir}/.git" ]] && [[ ! -f "${dir}/.git" ]]; then
    echo "[${label}] skip: 不是 git 仓库目录 ${dir}" >&2
    return 0
  fi
  if ! git -C "${dir}" symbolic-ref -q HEAD >/dev/null 2>&1; then
    echo "[${label}] warn: detached HEAD，跳过 commit/push" >&2
    return 0
  fi
  local branch
  branch="$(git -C "${dir}" branch --show-current)"
  if ! repo_has_pending_changes "${dir}"; then
    echo "[${label}] skip: 干净 (${branch})"
    return 0
  fi

  echo "[${label}] commit + push (${branch})..."
  git -C "${dir}" add -A
  if git -C "${dir}" diff --cached --quiet; then
    echo "[${label}] skip: add 后无可提交内容（可能仅剩被忽略文件）(${branch})"
    return 0
  fi

  local commit_msg=""
  if [[ -n "${MSG}" ]]; then
    commit_msg="${MSG}"
  elif [[ "${USE_PLAIN}" == "1" ]]; then
    commit_msg="chore: push-all 同步本地改动 ($(date -u +%Y-%m-%d))"
  else
    commit_msg="$(push_all_auto_commit_subject "${dir}" "${label}" "${ROOT}")"
  fi

  echo "[${label}] commit 说明: ${commit_msg}"
  git -C "${dir}" commit -m "${commit_msg}"
  git -C "${dir}" push -u origin HEAD
  echo "[${label}] done (${branch})"
}

# 子模块顺序：按 .gitmodules 读取（保持稳定），最后主仓
SUB_PATHS=()
if [[ -f "${ROOT}/.gitmodules" ]]; then
  while IFS= read -r rel; do
    [[ -n "${rel}" ]] && SUB_PATHS+=("$rel")
  done < <(git config --file "${ROOT}/.gitmodules" --get-regexp '^submodule\..*\.path$' \
            | awk '{ print $2 }' | sort -u)
fi

for rel in "${SUB_PATHS[@]}"; do
  sub_root="${ROOT}/${rel}"
  if [[ ! -d "${sub_root}" ]]; then
    echo "[${rel}] skip: 路径不存在"
    continue
  fi
  push_repo "${sub_root}" "${rel}"
done

push_repo "${ROOT}" "root"

echo "push-all: 全部完成"
