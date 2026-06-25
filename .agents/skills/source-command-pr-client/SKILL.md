---
name: "source-command-pr-client"
description: "提交 packages/client/* 子模块（electron/flutter/cross-platform）改动并创建 PR 到默认分支（只产生 PR，禁止直接推送默认分支）"
---

# source-command-pr-client

Use this skill when the user asks to run the migrated source command `pr-client`.

## Command Template

对应子模块路径：`packages/client/`（luban-electron / luban-flutter / luban-cross-plateform，默认分支 main）。在主仓库根目录执行（指定 client 子项）：

```bash
# 按需指定 client 子项：electron / flutter / cross-platform
bash scripts/github/pr-create-package.sh client:electron
bash scripts/github/pr-create-package.sh client:flutter
bash scripts/github/pr-create-package.sh client:cross-platform
```

可选提交说明：

```bash
bash scripts/github/pr-create-package.sh client:electron -m "feat(client): 说明本次改动"
```

**你必须：** 在主仓库根目录运行；确认目标 client 子模块当前分支为 `feature/*`、`bugfix/*` 或 `hotfix/*`（禁止在默认分支 main 上操作）；**禁止切换分支**；执行后输出 PR 结果。

**多端一致提醒（MUST）：** 若本次改动涉及业务逻辑渲染，**必须**检查与引擎渲染、website、其它 client 的业务一致（见 `.agents/rules/luban-multi-client-consistency.md`）。

**约束：** 本命令只产生 PR，绝不直接 push 到默认分支。使用 GitHub `gh` CLI，禁止云效/MR。需已通过 `gh auth login` 认证。client 子项目部分为规划态（main 分支），改动前先确认子模块已实际接入。
