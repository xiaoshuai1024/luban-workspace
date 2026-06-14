---
description: 交互式多仓库合并助手：e2e-archi review → merge → 修复 → changelog
---

# /merge-branch

合并远端 feature 分支（主仓库 + 全部子模块），先 review 后合并，统一修复，输出 changelog。

**工作流：** fetch → 预检 → e2e-archi review（仅报告）→ merge + 冲突 → 修复 + 全量测试 → changelog 与报告

---

## 用法

```
/merge-branch <branch-name>
```

参数 `<branch-name>` 为远端分支名，默认主仓库 + 各子模块均使用同名分支。

---

## 工作流

### Step 0：检查参数与环境

```bash
set -euo pipefail

# 确认在主仓库根目录
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"
if [[ -z "${ROOT}" ]]; then
  echo "错误：不在 git 仓库中"
  exit 1
fi
cd "${ROOT}"

# 检查参数
if [[ -z "${1:-}" ]]; then
  echo "错误：缺少分支名参数"
  echo "用法：/merge-branch <branch-name>"
  exit 1
fi
BRANCH="$1"

# 工作区清洁检查
if [[ -n "$(git status --porcelain)" ]]; then
  echo "⚠️  工作区有未提交的变更："
  git status --short
  echo "请先 commit 或 stash 后再合并。"
  exit 1
fi

# 记录合并前的基点
MERGE_BASE="$(git rev-parse HEAD)"
```

- 未传分支名 → 报错退出
- 工作区不干净 → 提示先 commit/stash 后退出
- 确认当前在主仓库根目录

### Step 1：发现子模块 + Fetch 并检查分支存在性

#### 1.1 从 .gitmodules 发现子模块

```bash
SUBMODULES=()
if [[ -f ".gitmodules" ]]; then
  while IFS= read -r rel; do
    [[ -z "${rel}" ]] && continue
    SUBMODULES+=("${rel}")
  done < <(git config --file .gitmodules --get-regexp '^submodule\..*\.path$' | awk '{ print $2 }' | sort -u)
fi
```

动态从 `.gitmodules` 发现（luban-workspace 有 11 个子模块）。

#### 1.2 初始化子模块工作树

```bash
git submodule update --init --recursive
```

#### 1.3 检查分支存在性

对 **主仓库 + 各子模块** 依次执行 `git fetch origin "${BRANCH}"`。检查各仓库 `origin/${BRANCH}` 是否存在。汇总输出：

```
luban-workspace                   → ✅ 分支存在
packages/engine/luban             → ✅ 分支存在
packages/bff/luban-bff            → ❌ 无此分支，跳过
...
```

- 若子模块无该分支 → 跳过该仓库，继续
- 若主仓库无该分支 → 报错退出

**询问用户是否继续**，等待确认（Y/n）。

### Step 2：Review（e2e-archi）

对 **每个存在目标分支的仓库** 执行代码审查，**仅报告，不修复**。

#### 2.1 收集变更信息

```bash
git log --oneline HEAD..origin/${BRANCH}
git diff --stat HEAD...origin/${BRANCH}
```

#### 2.2 并行审查

使用独立的 subagent（`isolation: worktree`）并行审查每个仓库：

- 加载规则：`.agents/rules/luban-e2e-execution-contract.md`、`docs/E2E_AGENT_GUIDE.md`
- 审查内容：远端分支相对于当前分支的变更（diff + 新增文件 + 修改文件）
- 输出：结构化的审查报告，含 🔴 阻断 / 🟡 主要 / 🔵 建议 三级问题
- 每个仓库独立 subagent，并行启动

#### 2.3 汇总展示

- 有 🔴 阻断问题 → 提示风险，询问「是否仍继续合并？风险问题将在修复阶段处理」
- 用户确认后继续，拒绝则退出

### Step 3：Merge + 冲突处理

合并顺序：**子模块 → 主仓库**（先合并子模块确保子模块指针就绪）

对每个仓库：

#### 3.1 执行 Merge

```bash
current_branch="$(git symbolic-ref -q --short HEAD 2>/dev/null || true)"
default_branch="$(git config --get init.defaultBranch || echo main)"  # 各子仓按 .gitmodules branch

if [[ -z "${current_branch}" ]]; then
  # detached HEAD：仅更新本地默认分支，跳过 merge
  git branch -f "${default_branch}" "origin/${BRANCH}" 2>/dev/null || true
elif [[ "${current_branch}" == "${default_branch}" ]]; then
  git merge --ff-only "origin/${BRANCH}"
else
  git merge --no-edit "origin/${BRANCH}"
fi
```

- **默认分支**：使用 `--ff-only`（仅快进，非快进则报错）
- **其他分支**：使用 `--no-edit`

#### 3.2 无冲突

记录已合并的 commit 列表，继续下一个仓库。

#### 3.3 有冲突 → 逐文件处理

```bash
git diff --name-only --diff-filter=U   # 列出冲突文件
```

对每个冲突文件，按 `/merge-conflict` 的「默认保留双方代码」原则处理：
- 可保留双方 → 自动编辑文件 → `git add <file>`
- 不可保留 → 展示冲突 + 推荐方案 → **等待用户确认**后再执行
- 重复代码 → 去重后保留一份 → `git add <file>`

#### 3.4 主仓库特殊处理：子模块指针冲突

主仓库 merge 时若子模块指针有冲突（双方都改了指针），按「保留远端分支的指针」优先（因为子模块本身已经合完）：

```bash
git diff --name-only --diff-filter=U | while IFS= read -r f; do
  if git ls-files --stage "${f}" 2>/dev/null | grep -q "^160000"; then
    git checkout --theirs "${f}"
    git add "${f}"
  fi
done
```

### Step 4：修复 + 全量测试

汇总 Step 2 发现的所有 🔴 阻断 和 🟡 主要 问题。

#### 4.1 修复问题

- 按 后端 → 引擎/BFF/website → UI 物料 顺序修复
- 每个修复遵循 TDD（先写失败测试 → 实现 → 验证）
- 对跨仓库的问题，可从受影响最深的仓库开始

#### 4.2 跑全量测试

每个子项目按以下命令执行：

| 项目 | 命令 | 说明 |
|------|------|------|
| root | `git diff --cached` | 确认暂存内容正确 |
| Java 后端 | `cd packages/backend/luban-backend && mvn -q verify` | 单测 + 集成测 |
| Go 后端 | `cd packages/backend/luban-backend-go && go test ./... -race -cover` | 单测 + 竞态 + 覆盖率 |
| 引擎/BFF/UI/website | `cd packages/<...> && pnpm test && pnpm run build` | 单测 + 构建 |

- 若测试失败 → 修复直到全部通过
- 上一个通过后才进入下一个

#### 4.3 后端启动验证

```bash
cd packages/backend/luban-backend
mvn -q spring-boot:run &
BACKEND_PID=$!
(sleep 60 && kill "${BACKEND_PID}" 2>/dev/null) &
WATCHDOG_PID=$!
BACKEND_READY=false
for i in $(seq 1 50); do
  if curl -sf http://127.0.0.1:8080/actuator/health >/dev/null 2>&1; then
    echo "✅ 后端启动成功"
    BACKEND_READY=true
    break
  fi
  sleep 1
done
kill "${BACKEND_PID}" 2>/dev/null || true
kill "${WATCHDOG_PID}" 2>/dev/null || true
```

### Step 5：Changelog + 最终报告

#### 5.1 生成 Changelog

对每个仓库，使用 `MERGE_BASE` 提取本次合入的 commit：

```bash
git log --oneline --no-merges "${MERGE_BASE}..HEAD"
```

按约定分类（从 commit message 前缀识别）：feat / fix / chore / refactor / docs / test / style / perf。

#### 5.2 输出最终报告

格式：

```
━━━ 合并报告：<source> → <target> ━━━━━━━━━━━━━━━━━━━

  分支: feature/<branch-name>
  基点: ${MERGE_BASE}

  ┌─ packages/engine/luban ─────────────────────────┐
  │  合并 N 个 commit                                │
  │  冲突: 无                                        │
  └──────────────────────────────────────────────────┘

  ┌─ packages/backend/luban-backend ────────────────┐
  │  合并 N 个 commit                                │
  └──────────────────────────────────────────────────┘

  ┌─ Review 问题修复 ────────────────────────────────┐
  │  🔴 ...                                  → 已修复  │
  └──────────────────────────────────────────────────┘

  ┌─ 构建/测试 ──────────────────────────────────────┐
  │  backend-java    mvn verify         ✅ PASS      │
  │  backend-go      go test            ✅ PASS      │
  │  engine          pnpm test          ✅ PASS      │
  │  backend start   验证启动           ✅ OK        │
  └──────────────────────────────────────────────────┘

  合并完成。如需要创建 PR，可执行 /pr-all
```

## 回滚指引

```bash
# 软回退（保留工作区）
git reset --soft "${MERGE_BASE}"
# 或完全回退
git reset --hard "${MERGE_BASE}"
```

每个子模块独立回退（使用 ORIG_HEAD）。

---

## 约束与注意事项

1. **禁止假绿** — 修复阶段测试必须真实跑通，不得跳过或 mock
2. **禁止自动提交到远端** — 本命令仅做本地合并，不 push 不创建 PR
3. **禁止静默跳过冲突** — 每个不可自动解决的冲突均需用户确认
4. **工作区卫生** — 开始前检查工作区是否干净
5. **子模块指针** — 主仓库合并时若子模块指针冲突，按「保留远端分支的指针」优先
6. **修复阶段范围** — 仅修复 Step 2 发现的问题，不扩充 Scope
7. **合并顺序** — 先合并所有子模块，再合并主仓库
8. **默认分支特殊处理** — 默认分支上使用 `--ff-only` 快进合并，其他分支使用 `--no-edit`

---

## 参考

- 冲突处理细则见 [merge-conflict](./merge-conflict.md)
- e2e-archi review 规则：`.agents/rules/luban-e2e-execution-contract.md`、`docs/E2E_AGENT_GUIDE.md`
- 项目测试命令见 `AGENTS.md`
- 子模块管理：`.gitmodules`
