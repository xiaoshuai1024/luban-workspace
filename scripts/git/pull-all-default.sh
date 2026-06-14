#!/usr/bin/env bash
# 薄包装：等价 pull-all.sh（保留命令历史引用名；按各子仓默认分支同步）
exec "$(dirname "$0")/pull-all.sh" "$@"
