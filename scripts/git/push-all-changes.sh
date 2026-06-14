#!/usr/bin/env bash
# 薄包装：等价 push-all.sh（各 submodule 有改动则 commit+push 当前分支）
exec "$(dirname "$0")/push-all.sh" "$@"
