#!/usr/bin/env bash
#
# pr-all.sh
# 在有改动的子模块 + 主仓上：push 当前分支 → gh pr create --base <默认分支>。
# 取代 kangdou 的云效 MR 脚本，改用 GitHub gh CLI。
#
# 用法（主仓根目录）:
#   bash scripts/git/pr-all.sh [TARGET_BRANCH]
#   make pr-all
#   make pr-all BRANCH=master
#
# 选项:
#   --target <branch>   所有 PR 的 base 分支（默认取每个 submodule 的 .gitmodules branch；
#                       若未登记则用 BRANCH 参数，默认 main）
#   --title <title>     PR 标题前缀；自动加 [repo]
#   --body <text>       PR 描述（追加到每个 PR）
#   --reviewers <csv>   reviewer（逗号分隔的 GitHub 用户名）
#   --exclude <csv>     要跳过的子模块路径（逗号分隔）
#   --auto-commit       有未提交改动时自动 commit（否则报错退出）
#   --commit-message    配合 --auto-commit 使用的提交说明
#   --dry-run           仅打印计划，不 push/不建 PR
#   --yes               跳过确认提示
#   -h, --help
#
# 行为:
#   - 仅处理「当前分支领先 base」或「工作区有改动」的仓库；干净且无 ahead 的跳过。
#   - 源分支须为 feature/* | bugfix/* | hotfix/* | chore/* | refactor/*
#     （禁止直接对 master/main 建 PR；如确需，请显式用 gh 手工建）。
#   - 主仓（meta）始终最后处理，以包含子模块指针更新。
#
# 依赖：gh（已认证 xiaoshuai1024，https，scope repo/workflow）、git。
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Error: 未找到必需命令: $1" >&2
    exit 1
  }
}
require_cmd git
require_cmd gh

usage() {
  cat <<'EOF'
用法:
  bash scripts/git/pr-all.sh [--target <branch>] [--title <t>] [--body <text>]
                             [--reviewers <csv>] [--exclude <csv>]
                             [--auto-commit] [--commit-message <m>]
                             [--dry-run] [--yes] [-h]

在每个有改动的子模块 + 主仓执行 push + gh pr create --base <默认分支>。
EOF
}

TARGET_OVERRIDE=""
BASE_TITLE="chore: 提交本次改动"
BASE_BODY=""
REVIEWERS=""
EXCLUDE_CSV=""
AUTO_COMMIT="false"
COMMIT_MESSAGE="chore: prepare changes before PR"
DRY_RUN="false"
ASSUME_YES="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target)        TARGET_OVERRIDE="${2:-}"; shift 2 ;;
    --title)         BASE_TITLE="${2:-}"; shift 2 ;;
    --body)          BASE_BODY="${2:-}"; shift 2 ;;
    --reviewers)     REVIEWERS="${2:-}"; shift 2 ;;
    --exclude)       EXCLUDE_CSV="${2:-}"; shift 2 ;;
    --auto-commit)   AUTO_COMMIT="true"; shift ;;
    --commit-message) COMMIT_MESSAGE="${2:-}"; shift 2 ;;
    --dry-run)       DRY_RUN="true"; shift ;;
    --yes)           ASSUME_YES="true"; shift ;;
    -h|--help)       usage; exit 0 ;;
    *)
      # 兼容位置参数：第一个非选项视为 target（make pr-all BRANCH=xxx 传入）
      if [[ -z "${TARGET_OVERRIDE}" && "$1" != -* ]]; then
        TARGET_OVERRIDE="$1"; shift
      else
        echo "Error: 未知参数: $1" >&2; usage >&2; exit 1
      fi
      ;;
  esac
done

# 取某 submodule 在 .gitmodules 中登记的 branch，回退 main
default_branch_for_path() {
  local rel="$1"
  local b
  b="$(git config --file "${ROOT}/.gitmodules" --get "submodule.${rel}.branch" 2>/dev/null || true)"
  if [[ -z "$b" ]]; then
    local name; name="$(basename "$rel")"
    b="$(git config --file "${ROOT}/.gitmodules" --get "submodule.${name}.branch" 2>/dev/null || true)"
  fi
  echo "${b:-main}"
}

is_excluded() {
  [[ -z "${EXCLUDE_CSV}" ]] && return 1
  [[ ",${EXCLUDE_CSV}," == *",$1,"* ]]
}

list_submodule_paths() {
  git config --file "${ROOT}/.gitmodules" --get-regexp '^submodule\..*\.path$' \
    | awk '{ print $2 }' | sort -u
}

repo_has_real_changes() {
  # 工作区有变更 OR 当前分支领先 base
  local dir="$1" base="$2"
  [[ -n "$(git -C "${dir}" status --porcelain 2>/dev/null)" ]] && return 0
  git -C "${dir}" fetch origin "${base}" -q 2>/dev/null || true
  if git -C "${dir}" rev-parse "origin/${base}" >/dev/null 2>&1; then
    [[ -n "$(git -C "${dir}" rev-list "origin/${base}..HEAD" 2>/dev/null)" ]] && return 0
  fi
  return 1
}

ensure_repo_committed() {
  local dir="$1" name="$2"
  if [[ -z "$(git -C "${dir}" status --porcelain 2>/dev/null)" ]]; then
    return 0
  fi
  if [[ "${AUTO_COMMIT}" != "true" ]]; then
    echo "Error: ${name} 有未提交改动。请加 --auto-commit 或先手动 commit。" >&2
    exit 1
  fi
  git -C "${dir}" add -A
  if [[ -n "$(git -C "${dir}" diff --cached --name-only)" ]]; then
    git -C "${dir}" commit -m "${COMMIT_MESSAGE}"
  fi
}

assert_feature_branch() {
  local branch="$1" name="$2"
  case "$branch" in
    feature/*|bugfix/*|hotfix/*|chore/*|refactor/*|dependabot/*) return 0 ;;
    *)
      echo "Error: ${name} 当前分支 '${branch}' 不是 feature/* 等，禁止对默认分支建 PR。" >&2
      exit 1
      ;;
  esac
}

create_repo_pr() {
  local dir="$1" name="$2" base="$3"

  local source_branch
  source_branch="$(git -C "${dir}" rev-parse --abbrev-ref HEAD)"
  assert_feature_branch "$source_branch" "$name"

  ensure_repo_committed "${dir}" "$name"

  if [[ "${DRY_RUN}" == "true" ]]; then
    echo "[${name}] (dry-run) skip push + gh pr create"
    return 0
  fi

  echo "[${name}] push origin ${source_branch}"
  git -C "${dir}" push -u origin HEAD

  local title="[${name}] ${BASE_TITLE}"
  local gh_args=(pr create --base "${base}" --head "${source_branch}" --title "${title}")
  if [[ -n "${BASE_BODY}" ]]; then
    gh_args+=(--body "${BASE_BODY}")
  fi
  if [[ -n "${REVIEWERS}" ]]; then
    gh_args+=(--reviewer "${REVIEWERS}")
  fi

  echo "[${name}] gh ${gh_args[*]}"
  if gh -R "$(repo_full_name "${dir}")" "${gh_args[@]}" 2>&1; then
    echo "[${name}] ✓ PR created (base=${base})"
  else
    echo "[${name}] warn: gh pr create 失败（可能已存在 PR）。尝试列出现有 PR："
    gh -R "$(repo_full_name "${dir}")" pr list --head "${source_branch}" --base "${base}" 2>&1 || true
  fi
}

# 从 origin remote URL 推导 owner/repo
repo_full_name() {
  local url
  url="$(git -C "$1" remote get-url origin 2>/dev/null || true)"
  url="${url%.git}"
  if [[ "$url" == git@*:* ]]; then
    echo "${url#*:}"
  elif [[ "$url" == https://* ]]; then
    url="${url#https://*/}"
    # 去掉可能的 token@（私有部署不会，标准 github 不带 token）
    echo "$url"
  else
    echo ""
  fi
}

# ── 收集待处理仓库 ────────────────────────────────────────
declare -a TO_PROCESS=()   # 每项 "dir|name|base"

# 子模块
if [[ -f "${ROOT}/.gitmodules" ]]; then
  while IFS= read -r rel; do
    [[ -z "$rel" ]] && continue
    is_excluded "$rel" && { echo "[${rel}] excluded"; continue; }
    sub_root="${ROOT}/${rel}"
    [[ ! -d "$sub_root" ]] && { echo "[${rel}] skip: 路径不存在"; continue; }
    if ! git -C "$sub_root" symbolic-ref -q HEAD >/dev/null 2>&1; then
      echo "[${rel}] skip: detached HEAD"; continue
    fi
    local_base="${TARGET_OVERRIDE:-$(default_branch_for_path "$rel")}"
    if repo_has_real_changes "$sub_root" "$local_base"; then
      TO_PROCESS+=("${sub_root}|${rel}|${local_base}")
    else
      echo "[${rel}] clean & no ahead, skip"
    fi
  done < <(list_submodule_paths)
fi

# 主仓（meta）：base 用 TARGET_OVERRIDE 或 main
META_BASE="${TARGET_OVERRIDE:-main}"
if [[ -z "$(git -C "${ROOT}" status --porcelain 2>/dev/null)" ]]; then
  # 主仓干净时也看是否 ahead（含子模块指针更新）
  git -C "${ROOT}" fetch origin "${META_BASE}" -q 2>/dev/null || true
  if git -C "${ROOT}" rev-parse "origin/${META_BASE}" >/dev/null 2>&1; then
    [[ -n "$(git -C "${ROOT}" rev-list "origin/${META_BASE}..HEAD" 2>/dev/null)" ]] \
      && TO_PROCESS+=("${ROOT}|luban-workspace|${META_BASE}")
  fi
else
  TO_PROCESS+=("${ROOT}|luban-workspace|${META_BASE}")
fi

# ── 执行计划展示 ──────────────────────────────────────────
echo ""
echo "PR 执行计划："
for entry in "${TO_PROCESS[@]}"; do
  IFS='|' read -r dir name base <<<"$entry"
  src="$(git -C "${dir}" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '?')"
  state="clean"; [[ -n "$(git -C "${dir}" status --porcelain 2>/dev/null)" ]] && state="dirty"
  echo "- repo=${name}  src=${src}  base=${base}  state=${state}"
done
echo "- reviewers=${REVIEWERS:-<none>}"
echo "- auto_commit=${AUTO_COMMIT}"
echo "- dry_run=${DRY_RUN}"
echo ""

if [[ "${#TO_PROCESS[@]}" -eq 0 ]]; then
  echo "没有需要建 PR 的仓库。"
  exit 0
fi

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "Dry-run 模式：不 push、不建 PR。"
  exit 0
fi

if [[ "${ASSUME_YES}" != "true" ]]; then
  read -r -p "确认对以上仓库执行 push + gh pr create？(y/N) " reply
  [[ "$reply" =~ ^[Yy]$ ]] || { echo "已取消。"; exit 0; }
fi

for entry in "${TO_PROCESS[@]}"; do
  IFS='|' read -r dir name base <<<"$entry"
  create_repo_pr "$dir" "$name" "$base"
done

echo "pr-all: 完成。"
