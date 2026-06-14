#!/usr/bin/env bash
# 薄包装：全部 submodule + meta 仓提 PR；等价 git/pr-all.sh
exec "$(dirname "$0")/../git/pr-all.sh" "$@"
