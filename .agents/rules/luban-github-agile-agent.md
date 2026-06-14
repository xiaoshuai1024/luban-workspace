<!--
description: GitHub MUST 规则（Issue / PR / label / gh CLI / MCP 优先），详见 docs/GIT_WORKFLOW.md
globs: "**/*"
alwaysApply: false
-->

# GitHub 敏捷管理（MUST）

luban-workspace 用 **GitHub** 替代云效作为代码托管与协作平台。**全文见 `docs/GIT_WORKFLOW.md`**。

## 核心要求

1. **gh CLI 优先**：凡涉及 GitHub 的操作（PR / Issue / label / release），优先使用 `gh` CLI + GitHub MCP Server
2. **工作项状态变更须先询问用户**：创建/关闭 Issue、合并 PR、修改 label 等写操作，必须先与用户确认
3. **缓存**：`.claude/state/github/`（不提交 Git）
4. **未鉴权**：按 `AGENTS.md` 完成引导（`gh auth login`）后再写入

## MCP 优先（所有 GitHub 相关）

当用户意图涉及 **GitHub / PR / Issue / 代码库 / 工作项 / Actions / Release** 时：

1. **MUST 优先使用 GitHub MCP Server**（除非用户明确要求非 MCP 路径）
2. **MUST 优先使用 gh CLI**（除非 MCP 不可用）
3. 若 MCP 与 gh 均不可用，回退到 GitHub REST API（`curl`），并在最终消息中**说明回退原因**

## PR 创建（额外约束）

当用户意图为"提交 PR"、"创建 PR"或等价语义时：

1. **MUST 使用 gh CLI** 作为创建 PR 的首选路径：
   ```bash
   gh pr create --title "feat: xxx" --body "..." --base <默认分支> --head feature/xxx
   ```
2. **分支策略**：`feature/* -> 各子项目默认分支`（6 master + 5 main），禁止直接面向默认分支（热修复除外）
3. **禁止**在用户确认 gh 已鉴权且预检通过前创建 PR
4. **首次使用且未鉴权**：必须提供可点击入口 URL + 明确步骤（`gh auth login`、配置 token、校验连通性）后再继续
5. 后续再次触发 PR 时，若曾出现"首次未鉴权"场景，必须再次提醒初始化要点

## PR 合并

当用户需要 **合并已创建的 PR** 时：

1. **优先用 gh CLI**：
   ```bash
   gh pr merge <number> --squash --delete-branch
   ```
2. **合并方式**：默认 `--squash`（luban 约定，保持默认分支历史整洁）；rebase / merge commit 须用户明确指定
3. **删除源分支**：合并后默认删除 feature 分支（`--delete-branch`）

## Issue 与 label

- 创建 Issue 须带 label（按 `scripts/github/labels.json` 约定的标准集）
- 工作项（Issue）状态变更（open / closed / reopened）须先询问用户
- 新建 Issue 默认 assign 给当前用户，可选 milestone

## 标准命令

```bash
# 鉴权
gh auth login
gh auth status

# PR
gh pr create --title "..." --body "..." --base master --head feature/xxx
gh pr list
gh pr view <number>
gh pr merge <number> --squash --delete-branch

# Issue
gh issue create --title "..." --body "..." --label bug
gh issue list
gh issue close <number>

# Actions
gh run list
gh run view <run-id>
gh run watch <run-id>

# Release
gh release create v1.0.0 ./dist/*
```

---

## 经验：gh CLI 在子模块中的鉴权

### 场景
在 luban 子模块（如 `packages/engine/luban`）执行 `gh pr create` 报错 "not authenticated"。

### 根因
`gh` 的鉴权状态可能因 git 上下文（子模块、多 origin）解析出不同的仓库归属。

### 解决方案
1. 主仓与各子模块须分别 `gh auth login`（或共享 `~/.config/gh/hosts.yml`）
2. 在子模块目录执行 `gh auth status` 确认鉴权
3. 创建 PR 时显式指定 `--repo owner/repo`：
   ```bash
   gh pr create --repo <owner>/luban --base master --head feature/xxx
   ```

### 预防
- 首次使用前在各子模块跑 `gh auth status` 确认
- `/pr-all` 失败时改用按包命令（`/pr-engine` / `/pr-bff` / ...）

---

## 经验：默认分支不一致导致 PR 失败

### 场景
`/pr-all` 在某些仓库创建 PR 失败：`base branch 'dev' not found`。

### 根因
luban 11 个子项目默认分支不同（6 master + 5 main），全量脚本按统一 base 时部分仓库会失败。

### 解决方案
- 各子项目的 PR 用各自的默认分支作为 base
- 失败时改用按包命令
- 详见 `docs/GIT_WORKFLOW.md`

---

## 经验：GitHub Actions CI 失败的排查

### 场景
PR 创建后 CI 跑红，需要排查。

### 排查顺序
1. `gh run view <run-id> --log-failed` 查看失败 step 的日志
2. 定位失败 job → 失败 step → 失败命令
3. 区分：编译错误 / 测试失败 / lint 失败 / 环境问题
4. 本地复现：在该子项目根目录跑同样的命令

### 预防
- 提 PR 前本地跑过对应子项目的 `pnpm test` / `mvn verify` / `go test`
- CI 与本地命令对齐（同样的覆盖率门禁、同样的测试范围）
