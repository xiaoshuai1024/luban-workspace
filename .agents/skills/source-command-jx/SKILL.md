---
name: "source-command-jx"
description: "继续执行当前任务（异常中断后恢复）；开发类任务须拆分子 agent、遵守仓库工作流与 TDD/E2E 门禁"
---

# source-command-jx

Use this skill when the user asks to run the migrated source command `jx`.

## Command Template

## 含义

**`jx` = 继续**：从对话与仓库状态中**接续被中断或未完成的工作**，不重新开题、不默认推翻已有结论。若中断前有明确计划/分支/待办，以之为 SSOT；若上下文不全，先**短读**相关文件与 `git status` 再动手。

## Agent 必须遵守

### 1. 恢复上下文（先做）

- 回顾用户**上一段有效目标**与任何**未完成步骤**；必要时 `git status -sb`、`git diff --stat`、打开活跃方案 `.agents/plans/*.md` 或用户指定的文档。
- **不要**在未确认当前分支与仓库边界的情况下大范围改代码（见 `docs/GIT_WORKFLOW.md`）。

### 2. 开发类任务：多拆 **Task 子 agent**（尽量并行）

- 将剩余工作拆成**彼此独立、可并行**的包（例如：后端 Java 单测 / 后端 Go 单测 / 引擎+BFF 构建与类型检查 / website Vitest / 文档-only），**分别**用 **Task** 子 agent 执行；能并行则**同轮并行派发**，勿串行堆在一轮对话里硬啃。
- 子 agent **须带足上下文**（路径、验收标准、禁止事项），避免重复全仓探索。
- **Task 约定**（MUST）：默认**不要**向 `Task` 传入 `model` 参数（避免订阅报错）。

### 3. 工作流与 TDD / E2E（MUST）

- **工作流**：[AGENTS.md](AGENTS.md)、[docs/GIT_WORKFLOW.md](docs/GIT_WORKFLOW.md)（分支、commit、子模块边界）。
- **测试与 TDD**：`.agents/rules/luban-testing-coverage.md`（各子项目命令、首个失败即停、禁止假绿 skip）。
- **E2E 执行门禁**：加载并遵循 `.agents/rules/luban-e2e-execution-contract.md` 与 `docs/E2E_AGENT_GUIDE.md`—— **先测后码、红→绿**；宣称完成前须跑通文档规定的**全量验证命令**并保留证据。
- 实现阶段可配合 `.agents/skills/subagent-driven-development/SKILL.md` 或 `.agents/skills/dispatching-parallel-agents/SKILL.md` 的拆分与派发方式（与上条子 agent 策略一致）。

### 4. 非开发类任务

- 调研、文档、排障等：仍先对齐目标与证据；若可拆（多文件检索、多模块只读），同样**优先子 agent 并行**，再汇总结论。

## 禁止

- 为「省事」跳过失败测试、改断言糊弄绿、或未经用户同意在各子仓默认分支上直接提交。
- 在未读失败日志/网络/控制台的情况下盲改 E2E（与 `luban-testing-coverage` 一致）。

**你必须：** 用简短列表向用户说明**接续的是哪条任务**、**本轮拆了几种子任务/子 agent**、以及**下一步**或**验证命令结果**。
