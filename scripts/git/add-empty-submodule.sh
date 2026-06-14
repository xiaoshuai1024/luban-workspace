#!/usr/bin/env bash
# 接入尚为空的 luban 子仓（ai-assistant / electron / flutter / cross-plateform）。
# 空仓无 commit，git submodule add 会失败；待子仓有初始提交后执行本脚本。
#   usage: add-empty-submodule.sh <repo-name> <path> <branch>
set -euo pipefail
NAME="${1:?usage: add-empty-submodule.sh <repo-name> <path> <branch>}"
PATH_="${2:?}"
BRANCH="${3:-main}"
BASE="https://github.com/xiaoshuai1024"
git submodule add -f -b "$BRANCH" "$BASE/${NAME}.git" "$PATH_"
echo "✓ ${NAME} -> ${PATH_}"
