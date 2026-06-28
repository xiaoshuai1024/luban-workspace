# ADR 0006: 敏捷流程自研 Sprint MCP

| 字段 | 值 |
|------|-----|
| 状态 | Accepted |
| 日期 | 2026-06-28 |
| 决策者 | 工程效率组 |
| 关联文档 | [packages/sprint-mcp/README.md](../../packages/sprint-mcp/README.md)、ADR-0005 |
| 回溯 | Yes（决策实际发生于项目早期，本篇为 2026-06-28 回溯记录） |

## 背景 (Context)

ADR-0005 的 SSOT 任务图解决了"一个 feature 的技术任务依赖与状态"，但缺少迭代级的敏捷视图：燃尽、速率、carryover、跨 feature 的 epic/release 归并、复盘。团队调研了开源 MCP 生态，发现没有任何实现给出真正的 sprint/iteration 模型——所有现成项目都停留在纯 kanban（cardo 提供依赖+环检测+活动日志，Sprintra 给出 sprint/epic/story/release 概念，bradrisse 用 manager+action 工具命名），但无人把迭代生命周期端到端做出来，更无人与代码仓内任务图双向链接。

现成外部工具（Linear/Jira）又与代码仓、Agent 会话、任务图 JSON 集成差，状态需人工搬运，离线不可用。

## 决策 (Decision)

在 SSOT 任务图之上自研完整敏捷流程 MCP Server（Sprint/Epic/Story/Release/Retrospective），提供 22 个 MCP tool（manager+action 模式）+ 实时 HTTP 看板（:7777），纯 JSON 持久化并与任务图双向链接。

- 数据层：`docs/superpowers/sprints/<sprintId>.json`（一个迭代一文件）+ `releases.json` 全局注册表 + 现有 `tasks/*.json`（task 节点加 `sprintId` 反向指针，`story.taskRefs` 反向，构成双向链接）。把 SQLite 模型翻译为 git 可版本化的 JSON 文件。
- 22 tool 覆盖：sprint_manager/metrics/carryover、story_manager/backlog/context/dependency/comment、epic_manager、acceptance_criteria、release_manager/notes、board_view/filter/export、plan_link/status_sync、import_from_plan/export_to_taskgraph、sprint_retrospective、activity_log、git_branch_sync。
- 命令：`make sprint-build`/`sprint-up`/`sprint-open`/`sprint-status`；会话内 `/sprint-status` `/sprint-import <featureId>` `/sprint-plan`。

## 考虑过的备选方案 (Alternatives Considered)

### 备选 A：用 Linear/Jira 等现成工具
- 优点：成熟 UI、移动端、报表开箱即用、无需维护。
- 缺点 / 代价：状态在 SaaS 侧，与代码仓/任务图 JSON 双向同步需自写集成且离线不可用；Agent 写入需鉴权与配额；迭代数据不在 git 里，无法随仓 review/回溯；无法与 §7.0 旅程 spec、artifacts 校验联动。

### 备选 B：用纯 Markdown 计划管理迭代
- 优点：零依赖、纯文本、git 友好。
- 缺点 / 代价：无结构化查询能力（燃尽/速率/carryover/依赖环检测都要手写解析）；多 Agent 并发改写 Markdown 易冲突且无 schema 保护；无法对外暴露 MCP tool 供 Agent 直接编排。

## 后果 (Consequences)

- **正面**：填补生态空白，迭代数据随仓版本化；与任务图、release notes、复盘形成闭环；Agent 可通过 MCP tool 直接编排迭代操作；HTTP 看板给人实时可见。
- **负面 / 代价**：自研维护成本（22 tool + 看板 + SSE）；JSON schema 需与任务图协同演进；并发写需靠 git 流程约束而非数据库事务。
- **需要后续跟进**：监控 tool 使用率与看板活跃度；把高频手写操作沉淀为新的 manager/action；保持与 ADR-0005 schema 同步。

## 备注

推翻条件：出现等能力且与任务图/Agent 集成更好的开源 MCP，且迁移成本低。依赖 ADR-0005 的 SSOT 作为底层数据。
