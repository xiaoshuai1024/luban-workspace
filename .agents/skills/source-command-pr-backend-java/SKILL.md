---
name: "source-command-pr-backend-java"
description: "提交 packages/backend/luban-backend (Java) 子模块改动并创建 PR 到默认分支（只产生 PR，禁止直接推送默认分支）"
---

# source-command-pr-backend-java

Use this skill when the user asks to run the migrated source command `pr-backend-java`.

## Command Template

对应子模块路径：`packages/backend/luban-backend`（Java / Spring Boot）。在主仓库根目录执行：

```bash
bash scripts/github/pr-create-package.sh backend-java
```

可选提交说明：

```bash
bash scripts/github/pr-create-package.sh backend-java -m "feat(backend-java): 说明本次改动"
```

**你必须：** 在主仓库根目录运行；确认 **packages/backend/luban-backend** 子模块当前分支为 `feature/*`、`bugfix/*` 或 `hotfix/*`（禁止在默认分支 master 上操作）；**禁止切换分支**；执行后输出 PR 结果。

**双后端提醒（MUST）：** 若本次改动涉及对外接口契约（新增/修改 REST API、错误码、响应体），**必须**检查 Go 后端（`packages/backend/luban-backend-go`）是否需要同步实现，保持行为一致（见 `docs/DUAL_BACKEND_PARITY.md`）。如需同步，提示用户另起 `/pr-backend-go`。

**约束：** 本命令只产生 PR，绝不直接 push 到默认分支。使用 GitHub `gh` CLI，禁止云效/MR。需已通过 `gh auth login` 认证。涉及 Flyway 迁移须用秒级时间戳（见 `docs/dev/luban-flyway-migration-standards.md`）。
