---
name: "source-command-pr-workspace"
description: "仅提交主仓库 luban-workspace 并创建 PR 到默认分支（只产生 PR，禁止直接推送默认分支）"
---

# source-command-pr-workspace

Use this skill when the user asks to run the migrated source command `pr-workspace`.

## Command Template

在仓库根目录执行：

```bash
bash scripts/github/pr-create-workspace.sh
```

可选：

```bash
bash scripts/github/pr-create-workspace.sh -m "docs: 说明主仓变更"
```

**说明：** 脚本会检查所有子模块工作区是否干净；若任一子模块仍有未提交变更，会报错并提示先单独提交子模块或使用 `/pr-all`。

**你必须：** 确认主仓库分支为 `feature/*`、`bugfix/*` 或 `hotfix/*`（禁止在默认分支 `main` 上操作）；**禁止切换分支**；运行命令并返回 PR 输出。

**约束：** 本命令只产生 PR（目标 main），绝不直接 push 到 main。使用 GitHub `gh` CLI，禁止云效/MR。需已通过 `gh auth login` 认证。
