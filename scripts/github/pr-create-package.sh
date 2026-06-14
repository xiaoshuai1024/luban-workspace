#!/usr/bin/env bash
# 按 package 提 PR；包装到 github/create-pr.sh
set -euo pipefail
PKG="${1:?usage: pr-create-package.sh <pkg-path> [gh-args...]}"
shift
exec "$(dirname "$0")/create-pr.sh" --path "$PKG" "$@"
