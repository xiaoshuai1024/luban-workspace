#!/usr/bin/env bash
# push-all 自动提交说明：根据暂存文件路径推断 type/scope，并可选从需求文档取标题。
# 由 push-all.sh source；勿单独执行。
# luban 化：scope 映射按子模块路径；root 仓同步子模块指针。

: "${PUSH_ALL_REQUIREMENT_FILE:=}"

push_all_sanitize_subject() {
  local s="$1"
  s="${s//$'\r'/}"
  s="${s#"${s%%[![:space:]]*}"}"
  s="${s%"${s##*[![:space:]]}"}"
  s="${s//$'\n'/ }"
  if [[ ${#s} -gt 68 ]]; then
    s="${s:0:65}..."
  fi
  echo "$s"
}

# 从需求/方案文档取首行 # 标题作为摘要。优先环境变量，回退 harness/plans 最近一个 md。
push_all_read_requirement_title() {
  local root="$1"
  local f="${PUSH_ALL_REQUIREMENT_FILE:-}"
  if [[ -z "$f" || ! -f "$f" ]]; then
    if [[ -d "${root}/harness/plans" ]]; then
      f="$(find "${root}/harness/plans" -maxdepth 1 -name '*.md' -type f -print0 2>/dev/null |
        xargs -0 ls -t 2>/dev/null | head -1 || true)"
    fi
    if [[ -z "$f" || ! -f "$f" ]] && [[ -d "${root}/docs/superpowers/plans" ]]; then
      f="$(find "${root}/docs/superpowers/plans" -maxdepth 1 -name '*.md' -type f -print0 2>/dev/null |
        xargs -0 ls -t 2>/dev/null | head -1 || true)"
    fi
  fi
  if [[ -z "$f" || ! -f "$f" ]]; then
    return 0
  fi
  local line
  line="$(grep -m1 -E '^#[[:space:]]+' "$f" 2>/dev/null | sed -E 's/^#[[:space:]]+//')"
  if [[ -n "$line" ]]; then
    push_all_sanitize_subject "$line"
  fi
}

# label 是子模块路径（如 packages/engine/luban）或 root
push_all_scope_for_label() {
  case "$1" in
    packages/engine/*)  echo "engine" ;;
    packages/bff/*)     echo "bff" ;;
    packages/ui/*)      echo "ui" ;;
    packages/web/*)     echo "website" ;;
    packages/backend/luban-backend-go) echo "backend-go" ;;
    packages/backend/luban-backend)    echo "backend" ;;
    packages/backend/*) echo "backend" ;;
    packages/docs/*)    echo "docs" ;;
    packages/ai/*)      echo "ai" ;;
    packages/client/*)  echo "client" ;;
    root)               echo "workspace" ;;
    *)                  echo "repo" ;;
  esac
}

push_all_file_is_test() {
  case "$1" in
    *Test.java | *IT.java | *.test.ts | *.test.tsx | *.spec.ts | *.spec.tsx | \
    */__tests__/* | */e2e/* | */test/* | */src/test/* | *_test.go) return 0 ;;
    *) return 1 ;;
  esac
}

push_all_file_is_doc() {
  case "$1" in
    *.md | docs/* | */docs/* | *.mdx) return 0 ;;
    *) return 1 ;;
  esac
}

push_all_file_is_migration() {
  case "$1" in
    */db/migration/*.sql | */migration/V*.sql | */resources/db/migration/*.sql) return 0 ;;
    *) return 1 ;;
  esac
}

push_all_file_is_lock() {
  case "$1" in
    pnpm-lock.yaml | package-lock.json | yarn.lock | go.sum | go.mod) return 0 ;;
    *) return 1 ;;
  esac
}

push_all_file_is_src() {
  case "$1" in
    *.java)
      if push_all_file_is_test "$1"; then return 1; fi
      return 0
      ;;
    *.vue | *.ts | *.tsx | *.js | *.mjs | *.jsx)
      case "$1" in
        *.test.ts | *.test.tsx | *.spec.ts | *.spec.tsx) return 1 ;;
        *) return 0 ;;
      esac
      ;;
    *.go)
      case "$1" in *_test.go) return 1 ;; *) return 0 ;; esac
      ;;
    *) return 1 ;;
  esac
}

# 调用前须已完成 git add
push_all_auto_commit_subject() {
  local dir="$1"
  local label="$2"
  local root="$3"

  local -a files=()
  while IFS= read -r line; do
    [[ -n "$line" ]] && files+=("$line")
  done < <(git -C "${dir}" diff --cached --name-only 2>/dev/null)

  local n="${#files[@]}"
  if [[ "$n" -eq 0 ]]; then
    echo "chore: 同步本地改动"
    return 0
  fi

  local scope
  scope="$(push_all_scope_for_label "$label")"

  local cnt_test=0 cnt_docs=0 cnt_mig=0 cnt_lock=0 cnt_sub=0 cnt_src=0
  local f
  for f in "${files[@]}"; do
    if push_all_file_is_test "$f"; then cnt_test=$((cnt_test + 1)); fi
    if push_all_file_is_doc "$f"; then cnt_docs=$((cnt_docs + 1)); fi
    if push_all_file_is_migration "$f"; then cnt_mig=$((cnt_mig + 1)); fi
    if push_all_file_is_lock "$f"; then cnt_lock=$((cnt_lock + 1)); fi
    if [[ "$label" == "root" ]]; then
      case "$f" in
        packages/*) cnt_sub=$((cnt_sub + 1)) ;;
      esac
    fi
    if push_all_file_is_src "$f"; then cnt_src=$((cnt_src + 1)); fi
  done

  local type="chore"
  local tail=""

  if [[ "$label" == "root" && "$cnt_sub" -eq "$n" && "$cnt_sub" -gt 0 ]]; then
    echo "chore(workspace): 同步子模块指针"
    return 0
  fi

  if [[ "$cnt_test" -ge "$n" ]] || [[ "$n" -gt 0 && $((cnt_test * 2)) -ge $((n)) ]]; then
    type="test"
  elif [[ "$cnt_docs" -eq "$n" ]]; then
    type="docs"
  elif [[ "$cnt_lock" -eq "$n" ]]; then
    type="chore"
    tail="更新锁文件"
  elif [[ "$cnt_mig" -gt 0 && "$cnt_src" -eq 0 ]]; then
    type="chore"
    tail="数据库迁移"
  elif [[ "$cnt_src" -gt 0 || "$cnt_mig" -gt 0 ]]; then
    type="feat"
  fi

  local req
  req="$(push_all_read_requirement_title "$root")"

  local summary=""
  if [[ -n "$req" ]]; then
    summary="$req"
  else
    local one="${files[0]}"
    one="${one##*/}"
    if [[ "$n" -gt 1 ]]; then
      summary="${one} 等 ${n} 项"
    else
      summary="$one"
    fi
  fi

  if [[ -n "$tail" ]]; then
    summary="${tail} · ${summary}"
  fi

  local subject="${type}(${scope}): ${summary}"
  push_all_sanitize_subject "$subject"
}
