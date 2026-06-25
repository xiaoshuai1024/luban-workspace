---
name: "source-command-pr-bff"
description: "提交 packages/bff/luban-bff 子模块改动并创建 PR 到默认分支（只产生 PR，禁止直接推送默认分支）"
---

# source-command-pr-bff

Use this skill when the user asks to run the migrated source command `pr-bff`.

## Command Template

对应子模块路径：`packages/bff/luban-bff`。在主仓库根目录执行：

```bash
bash scripts/github/pr-create-package.sh bff
```

可选提交说明：

```bash
bash scripts/github/pr-create-package.sh bff -m "feat(bff): 说明本次改动"
```

**你必须：** 在主仓库根目录运行；确认 **packages/bff/luban-bff** 子模块当前分支为 `feature/*`、`bugfix/*` 或 `hotfix/*`（禁止在默认分支 master 上操作）；**禁止切换分支**；执行后输出 PR 结果。

**约束：** 本命令只产生 PR，绝不直接 push 到默认分支。使用 GitHub `gh` CLI，禁止云效/MR。需已通过 `gh auth login` 认证。
