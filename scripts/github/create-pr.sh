#!/usr/bin/env bash
#
# create-pr.sh
# 单仓库 gh pr create 封装（luban 化自云效 MR 脚本）。
#
# 用法（可在任一 git 仓库内执行）:
#   bash scripts/github/create-pr.sh [--repo <dir>] [--base <branch>]
#                                    [--head <branch>] [--title <t>] [--body <text>]
#                                    [--reviewers <csv>] [--draft] [--yes]
#
# 默认：
#   --repo   当前目录（.git 所在）或 cwd 向上查找的 git 顶层
#   --base   origin 的默认分支（自动探测：gh repo view 或 origin/main|master）
#   --head   当前检出分支
#   --title  "<head> -> <base>"
#   --body   空
#
# 行为：
#   - 源分支须为 feature/* | bugfix/* | hotfix/* | chore/* | refactor/*；否则报错。
#   - 自动 git push -u origin HEAD（如已 ahead）。
#   - 远端仓库用 gh -R owner/repo 定位（从 origin remote URL 推导）。
#
# 依赖：gh（已认证）。
#
set -euo pipefail

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || { echo "Error: 缺少命令: $1" >&2; exit 1; }
}
require_cmd git
require_cmd gh

REPO_DIR=""
BASE=""
HEAD_BRANCH=""
TITLE=""
BODY=""
REVIEWERS=""
DRAFT="false"
ASSUME_YES="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)      REPO_DIR="${2:-}"; shift 2 ;;
    --base)      BASE="${2:-}"; shift 2 ;;
    --head)      HEAD_BRANCH="${2:-}"; shift 2 ;;
    --title)     TITLE="${2:-}"; shift 2 ;;
    --body)      BODY="${2:-}"; shift 2 ;;
    --reviewers) REVIEWERS="${2:-}"; shift 2 ;;
    --draft)     DRAFT="true"; shift ;;
    --yes)       ASSUME_YES="true"; shift ;;
    -h|--help)
      grep '^#' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Error: 未知参数: $1" >&2; exit 1 ;;
  esac
done

# 定位仓库目录
if [[ -z "$REPO_DIR" ]]; then
  REPO_DIR="$(git rev-parse --show-toplevel 2>/dev/null || true)"
fi
if [[ -z "$REPO_DIR" ]] || [[ ! -d "$REPO_DIR/.git" && ! -f "$REPO_DIR/.git" ]]; then
  echo "Error: 未找到 git 仓库（cwd 或 --repo 指定）。" >&2
  exit 1
fi

cd "$REPO_DIR"

# 推导 owner/repo（用于 gh -R）
remote_url="$(git remote get-url origin 2>/dev/null || true)"
remote_url="${remote_url%.git}"
if [[ "$remote_url" == git@*:* ]]; then
  REPO_FULL="${remote_url#*:}"
elif [[ "$remote_url" == https://* ]]; then
  REPO_FULL="${remote_url#https://*/}"
else
  echo "Error: 无法识别 origin remote URL: ${remote_url}" >&2
  exit 1
fi

# 当前分支
if [[ -z "$HEAD_BRANCH" ]]; then
  HEAD_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
fi
if [[ -z "$HEAD_BRANCH" || "$HEAD_BRANCH" == "HEAD" ]]; then
  echo "Error: detached HEAD，无法建 PR。" >&2
  exit 1
fi
case "$HEAD_BRANCH" in
  feature/*|bugfix/*|hotfix/*|chore/*|refactor/*|dependabot/*) ;;
  *)
    echo "Error: 当前分支 '${HEAD_BRANCH}' 不是 feature/* 等，禁止对默认分支建 PR。" >&2
    exit 1
    ;;
esac

# 探测 base：优先 --base → gh repo view defaultBranch → origin/main → origin/master
if [[ -z "$BASE" ]]; then
  BASE="$(gh repo view "$REPO_FULL" --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || true)"
fi
if [[ -z "$BASE" ]]; then
  for cand in main master; do
    if git show-ref --verify --quiet "refs/remotes/origin/${cand}" 2>/dev/null; then
      BASE="$cand"; break
    fi
  done
fi
if [[ -z "$BASE" ]]; then
  echo "Error: 无法探测默认分支，请用 --base 显式指定。" >&2
  exit 1
fi

if [[ "$BASE" == "$HEAD_BRANCH" ]]; then
  echo "Error: base(${BASE}) == head(${HEAD_BRANCH})，无法建 PR。" >&2
  exit 1
fi

# 检查是否有 ahead
git fetch origin "$BASE" -q 2>/dev/null || true
NEEDS_PUSH=0
if git rev-parse "origin/${HEAD_BRANCH}" >/dev/null 2>&1; then
  [[ -n "$(git rev-list "origin/${HEAD_BRANCH}..HEAD" 2>/dev/null)" ]] && NEEDS_PUSH=1
else
  NEEDS_PUSH=1
fi

if [[ -z "$TITLE" ]]; then
  TITLE="${HEAD_BRANCH} -> ${BASE}"
fi

echo "仓库:   ${REPO_FULL}"
echo "源分支: ${HEAD_BRANCH}"
echo "目标:   ${BASE}"
echo "标题:   ${TITLE}"
[[ -n "$REVIEWERS" ]] && echo "review: ${REVIEWERS}"
[[ "$DRAFT" == "true" ]] && echo "draft:  yes"
echo ""

if [[ "$NEEDS_PUSH" -eq 1 ]]; then
  if [[ "$ASSUME_YES" != "true" ]]; then
    read -r -p "将 push origin ${HEAD_BRANCH} 并建 PR？(y/N) " reply
    [[ "$reply" =~ ^[Yy]$ ]] || { echo "已取消。"; exit 0; }
  fi
  git push -u origin HEAD
else
  echo "（已是最新，无需 push）"
fi

gh_args=(pr create --repo "$REPO_FULL" --base "$BASE" --head "$HEAD_BRANCH" --title "$TITLE")
if [[ -n "$BODY" ]]; then
  gh_args+=(--body "$BODY")
fi
if [[ -n "$REVIEWERS" ]]; then
  gh_args+=(--reviewer "$REVIEWERS")
fi
[[ "$DRAFT" == "true" ]] && gh_args+=(--draft)

echo "gh ${gh_args[*]}"
if gh "${gh_args[@]}"; then
  echo "✓ PR 已创建。"
else
  rc=$?
  echo "（gh pr create 失败，可能已存在 PR）" >&2
  gh pr list --repo "$REPO_FULL" --head "$HEAD_BRANCH" --base "$BASE" 2>&1 || true
  exit $rc
fi
