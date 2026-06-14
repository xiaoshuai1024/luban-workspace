#!/usr/bin/env bash
#
# pull-all.sh
# 在 luban-workspace 主仓与 .gitmodules 中各子模块上：
#   fetch origin → 合并 origin/<默认分支> 进当前检出分支（不换分支）。
#
# 与 kangdou 的 pull-all-dev.sh 同源，差异：
#   - 「默认分支」取每个 submodule 在 .gitmodules 中登记的 branch（6 master + 5 main）；
#     BRANCH 参数（默认 main）仅在 .gitmodules 未登记 branch 时作为兜底。
#   - 不主动切换分支，避免在 feature 分支上工作的子模块被 detach。
#   - 任何仓库处于 detached HEAD 时报错退出。
#
# 用法（主仓根目录）:
#   bash scripts/git/pull-all.sh [BRANCH]
#   make pull-all
#   make pull-all BRANCH=master
#
# 在目标分支上则 --ff-only，否则 merge --no-edit。
#
set -euo pipefail

FALLBACK_BRANCH="${1:-main}"

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || true)"
if [[ -z "${ROOT}" ]]; then
  echo "Error: not inside a git repository." >&2
  exit 1
fi
cd "${ROOT}"

# 读取某 submodule 在 .gitmodules 中登记的 branch；未登记则回退兜底分支。
default_branch_for_path() {
  local rel="$1"
  local name
  name="$(basename "$rel")"
  local b
  b="$(git config --file "${ROOT}/.gitmodules" --get "submodule.${rel}.branch" 2>/dev/null || true)"
  # .gitmodules 的 key 是按 path 还是按 name 取决于配置；path 形式优先
  if [[ -z "$b" ]]; then
    b="$(git config --file "${ROOT}/.gitmodules" --get-regexp "^submodule\..*\.branch$" 2>/dev/null \
        | awk -v p="$rel" '$0 ~ ("submodule." p ".branch") { $1=""; sub(/^ +/,""); print; exit }')"
  fi
  if [[ -z "$b" ]]; then
    b="$(git config --file "${ROOT}/.gitmodules" --get "submodule.${name}.branch" 2>/dev/null || true)"
  fi
  echo "${b:-${FALLBACK_BRANCH}}"
}

# 列出 .gitmodules 中所有 submodule path（去重、排序）
list_submodule_paths() {
  git config --file "${ROOT}/.gitmodules" --get-regexp '^submodule\..*\.path$' \
    | awk '{ print $2 }' | sort -u
}

sync_repo() {
  local label="$1"; local dir="$2"; local branch="$3"

  (
    cd "${dir}" || exit 1
    if ! git rev-parse --git-dir >/dev/null 2>&1; then
      echo "[${label}] skip: 不是 git 仓库"
      exit 0
    fi

    # 1. detached HEAD 守卫
    local current
    current="$(git symbolic-ref -q --short HEAD 2>/dev/null || true)"
    if [[ -z "${current}" ]]; then
      echo "[${label}] ERROR: detached HEAD — 跳过（dir=${dir}）" >&2
      exit 1
    fi
    echo "[${label}] 当前分支: ${current}，目标: origin/${branch}"

    # 2. fetch 远端默认分支
    if ! git fetch origin "${branch}" 2>&1; then
      echo "[${label}] warn: fetch origin ${branch} 失败（远端无该分支？）"
      exit 0
    fi

    # 3. 更新本地同名分支指针（若存在）
    if git show-ref --verify --quiet "refs/heads/${branch}"; then
      git branch -f "${branch}" "origin/${branch}"
    else
      git branch "${branch}" "origin/${branch}"
    fi

    # 4. 合并进当前分支
    if [[ "${current}" == "${branch}" ]]; then
      git merge --ff-only "origin/${branch}"
      echo "[${label}] ✓ 在 ${branch} 上快进到 $(git rev-parse --short HEAD)"
    else
      local mb
      mb="$(git merge-base HEAD "origin/${branch}" 2>/dev/null || true)"
      if [[ -n "${mb}" && "${mb}" == "$(git rev-parse "origin/${branch}")" ]]; then
        echo "[${label}] ✓ 已是最新（origin/${branch} 已包含在 ${current}）"
      else
        git merge --no-edit "origin/${branch}" 2>&1 || {
          echo "[${label}] ERROR: 合并 origin/${branch} 冲突，请手动解决" >&2
          exit 1
        }
        echo "[${label}] ✓ 已合并 origin/${branch} 进 ${current} ($(git rev-parse --short HEAD))"
      fi
    fi
  )
}

echo "==> 仅初始化尚未检出的子模块工作树（避免 detach 已存在的子模块）"
if [[ -f "${ROOT}/.gitmodules" ]]; then
  while IFS= read -r rel; do
    [[ -z "${rel}" ]] && continue
    sub_root="${ROOT}/${rel}"
    if [[ -e "${sub_root}/.git" ]]; then
      echo "[${rel}] 已初始化，跳过（避免 detach）"
      continue
    fi
    git submodule update --init "${rel}" || echo "warn: submodule update --init 失败: ${rel}"
  done < <(list_submodule_paths)
fi

# 主仓：默认分支用兜底值（meta 仓自身约定）
echo "==> 主仓: ${ROOT}"
sync_repo "root" "${ROOT}" "${FALLBACK_BRANCH}"

# 各子模块：按 .gitmodules 各自的 branch 同步
if [[ -f "${ROOT}/.gitmodules" ]]; then
  while IFS= read -r rel; do
    [[ -z "${rel}" ]] && continue
    sub_root="${ROOT}/${rel}"
    if [[ ! -d "${sub_root}" ]]; then
      echo "[${rel}] skip: 路径不存在"
      continue
    fi
    echo "==> 子模块: ${rel}"
    sync_repo "${rel}" "${sub_root}" "$(default_branch_for_path "${rel}")"
  done < <(list_submodule_paths)
else
  echo "(无 .gitmodules)"
fi

echo "Done. 主仓与各子模块已与各自默认分支同步（合并进当前分支，未切换分支）。"
