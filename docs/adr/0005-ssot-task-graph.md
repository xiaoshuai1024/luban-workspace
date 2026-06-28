# ADR 0005: SSOT 任务图（JSON 为计划/执行事实源）

| 字段 | 值 |
|------|-----|
| 状态 | Accepted |
| 日期 | 2026-06-28 |
| 决策者 | 工程效率组 |
| 关联文档 | [.agents/rules/luban-task-graph-ssot.md](../../.agents/rules/luban-task-graph-ssot.md)、docs/superpowers/PLAN_WRITING_CONTRACT.md、[scripts/verify-plan-ssot.mjs](../../scripts/verify-plan-ssot.mjs) |
| 回溯 | Yes（决策实际发生于项目早期，本篇为 2026-06-28 回溯记录） |

## 背景 (Context)

Luban 重度依赖 AI Agent 多会话协作开发。一个 feature 的计划往往由一个会话起草、由后续多个会话执行，进度信息起初完全靠"对话里说过"来承载。这很快暴露三个痛点：上下文窗口有限导致跨会话记忆丢失；不同 Agent 对"哪些完成、哪些阻塞"口径不一；对话里宣称"已完成"但代码并未真正落地，回溯无凭。

团队需要一个独立于对话、可被机器校验、可在任意会话无歧义读出的进度事实源。任务图要同时承载计划侧（依赖结构、用户旅程覆盖）与执行侧（状态机、阻塞原因、时间戳）。

## 决策 (Decision)

每个 feature 维护一份结构化任务图 JSON 作为唯一事实源（SSOT）：`docs/superpowers/tasks/<featureId>.json`，与 `feature/<name>` 或 plan slug 对齐；计划的撰写与执行都同步维护它，对话宣称不计入。

- writing-plans 新建或实质性修改计划时，**同一变更批次**创建/更新对应 JSON，并在 plan 首 YAML 填 `taskGraph`，与 JSON 的 `metadata.planPath` 互指。
- 执行阶段按状态机更新：开工→`in_progress`；验证完成→`done`；阻塞→`blocked`+`blockedReason`；并刷新 `metadata.updatedAt`。依赖图表达并行就绪集，子任务用 `parentId` 与 `id`（如 `3.1`）。
- 凡 plan 含 §7.0 用户旅程声明，对应 JSON 须有 `journeys[]`，P0 旅程须绑定 spec `@J-<id>`。
- 提交前跑 `node scripts/verify-plan-ssot.mjs validate`（schema）+ `journey-coverage`（P0 阻断）。
- 会话记忆闭环：进度只存 SSOT，不靠对话；完成/阻塞后写 JSON，下会话 SessionStart hook 自动读出。

## 考虑过的备选方案 (Alternatives Considered)

### 备选 A：纯 Markdown 计划（无结构化状态）
- 优点：写作门槛低、可读性好、git diff 直观。
- 缺点 / 代价：状态散落在自然语言里，无法被机器校验（schema/依赖/旅程覆盖率全部失效）；并行就绪集要靠人脑推；与 Sprint、E2E、看板等下游无法双向链接，等于退回"靠对话记忆"。

### 备选 B：GitHub Issue / Project 作 SSOT
- 优点：现成、有 UI、原生协作。
- 缺点 / 代价：状态强耦合 GitHub 生命周期，离线/内网不可用；无法表达子任务依赖图与 P0 旅程 spec 绑定；与计划正文（plan slug）、任务产物（artifacts）的耦合弱，校验脚本无法本地 deterministic 运行；Agent 写入需鉴权，多 Agent 并发易冲突。

## 后果 (Consequences)

- **正面**：跨会话进度口径统一；状态机可被 verify-plan-ssot 校验；journey-coverage 在 P0 上做硬阻断，避免"宣称完成但漏 P0 旅程"；下游 Sprint MCP、看板、E2E 契约都可双向链接。
- **负面 / 代价**：写计划与改计划都要同步维护 JSON，多一道工序；schema 变更需要迁移存量 JSON；Agent 若漏维护会触发校验失败阻塞提交（这是预期代价）。
- **需要后续跟进**：保持 verify-plan-ssot 的 schema 与 journeys 规则与 PLAN_WRITING_CONTRACT 同步演进；监控"对话宣称完成但不更新 JSON"的违规频率，必要时加 pre-commit 钩子。

## 备注

推翻本决策需同时满足：出现比 JSON 更结构化且本地可校验的事实源载体，且迁移成本可接受。与 ADR-0006（Sprint MCP 在本 SSOT 之上叠加）、ADR-0012（SSOT 是记忆闭环的存储层）强相关。
