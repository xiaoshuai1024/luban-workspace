#!/usr/bin/env bash
#
# run-per-pkg.sh
# 通用按包执行命令：遍历 packages/* 各子模块，按技术栈分发命令。
#
#   ACTION=test    TS → pnpm test     Java → mvn -q test       Go → go test ./...
#   ACTION=lint    TS → pnpm run lint Java → mvn -q verify ... Go → go vet ./...
#   ACTION=install TS → pnpm install  Java → mvn -q -DskipTests package / 依赖下载  Go → go mod download
#   ACTION=build   TS → pnpm run build Java → mvn -q -DskipTests package Go → go build ./...
#
# 子模块不存在 / 无对应命令脚本 / 工具缺失 → 跳过并提示，不中断。
# 末尾汇总每个包的退出码；任一非 skip 包失败 → 总退出码 1。
#
# 用法（主仓根目录）:
#   bash scripts/git/run-per-pkg.sh <action> [pkg...]
#   make test | make lint | make install-deps
#
#   # 仅跑指定包（传子模块相对路径，空格分隔）
#   bash scripts/git/run-per-pkg.sh test packages/engine/luban packages/ui/luban-ui
#
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi

ACTION="${1:-}"
shift || true
EXTRA_PKGS=("$@")

usage() {
  cat <<'EOF'
用法:
  bash scripts/git/run-per-pkg.sh <test|lint|install|build> [pkg...]

action:
  test     运行单元测试
  lint     代码检查
  install  安装/下载依赖
  build    构建（跳过测试）

pkg...  可选；不传则遍历 .gitmodules 中所有子模块。
        传则只对指定的子模块相对路径执行（如 packages/engine/luban）。
EOF
}

if [[ -z "${ACTION}" ]]; then
  echo "Error: 缺少 action 参数。" >&2
  usage >&2; exit 1
fi
case "$ACTION" in
  test|lint|install|build) ;;
  -h|--help) usage; exit 0 ;;
  *) echo "Error: 未知 action: ${ACTION}" >&2; usage >&2; exit 1 ;;
esac

# ── 颜色 ──────────────────────────────────────────────────
if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; CYAN='\033[0;36m'; NC='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; CYAN=''; NC=''
fi

# 判断包技术栈：看标记文件
stack_of() {
  local d="$1"
  [[ -f "${d}/package.json" ]] && { echo "ts"; return; }
  [[ -f "${d}/pom.xml" ]] && { echo "java"; return; }
  [[ -f "${d}/go.mod" ]] && { echo "go"; return; }
  [[ -f "${d}/build.gradle" || -f "${d}/build.gradle.kts" ]] && { echo "java"; return; }
  echo "unknown"
}

has_script() {
  # 判断 package.json 是否含 script
  local pkg="$1" script="$2"
  [[ -f "$pkg" ]] || return 1
  grep -q "\"${script}\"" "$pkg" 2>/dev/null
}

run_one() {
  local pkg_dir="$1" name="$2"
  if [[ ! -d "$pkg_dir" ]]; then
    printf "${YELLOW}[skip]${NC} %s 路径不存在\n" "$name"
    return 99   # 99 = skip
  fi
  # 子模块未初始化（空目录）
  if [[ ! -d "$pkg_dir/.git" && ! -f "$pkg_dir/.git" ]] && [[ -z "$(ls -A "$pkg_dir" 2>/dev/null)" ]]; then
    printf "${YELLOW}[skip]${NC} %s 子模块未初始化（空目录）\n" "$name"
    return 99
  fi

  local stack; stack="$(stack_of "$pkg_dir")"
  if [[ "$stack" == "unknown" ]]; then
    printf "${YELLOW}[skip]${NC} %s 无法识别技术栈（无 package.json/pom.xml/go.mod）\n" "$name"
    return 99
  fi

  # 选定命令 + 主工具（用于预检）
  local cmd=""
  local primary_tool=""
  case "$stack/$ACTION" in
    ts/test)
      if has_script "${pkg_dir}/package.json" test; then cmd="pnpm test"; primary_tool="pnpm"
      else printf "${YELLOW}[skip]${NC} %s (ts) 无 test script\n" "$name"; return 99; fi
      ;;
    ts/lint)
      if has_script "${pkg_dir}/package.json" lint; then cmd="pnpm run lint"; primary_tool="pnpm"
      else printf "${YELLOW}[skip]${NC} %s (ts) 无 lint script\n" "$name"; return 99; fi
      ;;
    ts/build)
      if has_script "${pkg_dir}/package.json" build; then cmd="pnpm run build"; primary_tool="pnpm"
      else printf "${YELLOW}[skip]${NC} %s (ts) 无 build script\n" "$name"; return 99; fi
      ;;
    ts/install)   cmd="pnpm install"; primary_tool="pnpm" ;;
    java/test)    cmd="mvn -q test"; primary_tool="mvn" ;;
    java/lint)    cmd="mvn -q verify"; primary_tool="mvn" ;;
    java/build)   cmd="mvn -q -DskipTests package"; primary_tool="mvn" ;;
    java/install) cmd="mvn -q -DskipTests dependency:resolve"; primary_tool="mvn" ;;
    go/test)      cmd="go test ./..."; primary_tool="go" ;;
    go/lint)
      # 优先用 golangci-lint（配置在 .golangci.yml）；未安装则降级 go vet
      if command -v golangci-lint >/dev/null 2>&1; then
        cmd="golangci-lint run ./..."
      else
        cmd="go vet ./..."
      fi
      primary_tool="go" ;;
    go/build)     cmd="go build ./..."; primary_tool="go" ;;
    go/install)   cmd="go mod download"; primary_tool="go" ;;
  esac

  if [[ -z "$cmd" ]]; then
    printf "${YELLOW}[skip]${NC} %s (%s) 无 %s 命令\n" "$name" "$stack" "$ACTION"
    return 99
  fi

  # 主工具缺失 → skip（不报 FAIL）
  if ! command -v "$primary_tool" >/dev/null 2>&1; then
    printf "${YELLOW}[skip]${NC} %s (%s) 未安装 '%s'\n" "$name" "$stack" "$primary_tool"
    return 99
  fi

  printf "${CYAN}▸${NC} [%s] %s → %s\n" "$stack" "$name" "$cmd"
  local rc
  set +e
  ( cd "$pkg_dir" && eval "$cmd" ) 2>&1
  rc=$?
  set -e
  if [[ $rc -eq 0 ]]; then
    printf "  ${GREEN}✓${NC} %s ok\n" "$name"
  else
    printf "  ${RED}✗${NC} %s 失败 (exit=%s)\n" "$name" "$rc"
  fi
  return $rc
}

# ── 待处理包清单 ──────────────────────────────────────────
declare -a PKG_DIRS=()
if [[ ${#EXTRA_PKGS[@]} -gt 0 ]]; then
  for p in "${EXTRA_PKGS[@]}"; do
    # 允许传相对或绝对，统一转成相对 root
    case "$p" in
      "$ROOT"/*) p="${p#$ROOT/}" ;;
    esac
    PKG_DIRS+=("$p")
  done
elif [[ -f "${ROOT}/.gitmodules" ]]; then
  while IFS= read -r rel; do
    [[ -n "$rel" ]] && PKG_DIRS+=("$rel")
  done < <(git config --file "${ROOT}/.gitmodules" --get-regexp '^submodule\..*\.path$' \
            | awk '{ print $2 }' | sort -u)
else
  echo "Error: 无 .gitmodules 且未传包路径。" >&2
  exit 1
fi

# ── 执行 + 汇总 ───────────────────────────────────────────
declare -a RESULTS=()   # "name:status"
TOTAL_FAIL=0
TOTAL_OK=0
TOTAL_SKIP=0

for rel in "${PKG_DIRS[@]}"; do
  name="$(basename "$rel")"
  set +e
  run_one "${ROOT}/${rel}" "$name"
  rc=$?
  set -e
  case $rc in
    0)  RESULTS+=("${name}:PASS"); TOTAL_OK=$((TOTAL_OK+1)) ;;
    99) RESULTS+=("${name}:SKIP"); TOTAL_SKIP=$((TOTAL_SKIP+1)) ;;
    *)  RESULTS+=("${name}:FAIL($rc)"); TOTAL_FAIL=$((TOTAL_FAIL+1)) ;;
  esac
done

echo ""
printf "${CYAN}%s${NC}\n" "═══════════════════════════════════════════════════════════"
printf "${CYAN}%s${NC} (${ACTION})\n" "  run-per-pkg 汇总"
printf "${CYAN}%s${NC}\n" "═══════════════════════════════════════════════════════════"
for r in "${RESULTS[@]}"; do
  case "$r" in
    *:PASS) printf "  ${GREEN}%s${NC}\n" "$r" ;;
    *:FAIL*) printf "  ${RED}%s${NC}\n" "$r" ;;
    *:SKIP) printf "  ${YELLOW}%s${NC}\n" "$r" ;;
    *) printf "  %s\n" "$r" ;;
  esac
done
printf "${CYAN}%s${NC}\n" "───────────────────────────────────────────────────────────"
printf "  ok=%s  skip=%s  fail=%s\n" "$TOTAL_OK" "$TOTAL_SKIP" "$TOTAL_FAIL"
echo ""

if [[ $TOTAL_FAIL -gt 0 ]]; then
  printf "${RED}%s${NC}\n" "❌ 有 ${TOTAL_FAIL} 个包 ${ACTION} 失败。"
  exit 1
fi
printf "${GREEN}%s${NC}\n" "✅ 全部 ok（或 skip）"
exit 0
