---
name: "source-command-pr-engine"
description: "提交 packages/engine/luban 子模块改动并创建 PR 到默认分支（只产生 PR，禁止直接推送默认分支）"
---

# source-command-pr-engine

Use this skill when the user asks to run the migrated source command `pr-engine`.

## Command Template

对应子模块路径：`packages/engine/luban`。在主仓库根目录执行：

```bash
bash scripts/github/pr-create-package.sh engine
```

可选提交说明：

```bash
bash scripts/github/pr-create-package.sh engine -m "feat(engine): 说明本次改动"
```

**你必须执行的步骤：**

1. 在**主仓库根目录**执行命令。
2. 确认 **packages/engine/luban** 子模块当前分支为 `feature/*`、`bugfix/*` 或 `hotfix/*`（禁止在默认分支 master 上操作）。
3. **禁止切换分支**——只能在当前已检出的分支操作。
4. 脚本行为：`git add -A` → `git commit`（若有改动）→ `git push`（推送当前分支）→ `gh pr create` 创建指向默认分支 **master** 的 PR。
5. 将终端输出中的 PR 链接原文返回给用户。

**约束：** 本命令只产生 PR，绝不直接 push 到默认分支。使用 GitHub `gh` CLI，禁止云效/MR。需已通过 `gh auth login` 认证（见 `.agents/rules/luban-github-agile-agent.md`）。
