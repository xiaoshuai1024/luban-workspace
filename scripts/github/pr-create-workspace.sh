#!/usr/bin/env bash
# meta 仓提 PR；包装到 github/create-pr.sh（meta 根目录）
set -euo pipefail
exec "$(dirname "$0")/create-pr.sh" --path "." "$@"
