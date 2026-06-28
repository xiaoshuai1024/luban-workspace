# Architecture Decision Records (ADR)

> 记录 Luban 平台上**有意义的架构与技术选型决策**：为什么选 X 而不选 Y。
> 模板见 [0000-template.md](./0000-template.md)。

## 为什么有 ADR

luban-workspace 已有丰富的 rules（`.agents/rules/`）和技术经验（`docs/dev/`），它们回答 **「具体怎么做 / 约束是什么」**。ADR 回答另一个问题：**「当初为什么这么选」**——即决策点本身。

- rules / docs = 执行约束（How）
- ADR = 决策依据（Why）

ADR **只记决策点**，具体执行细节链接到现有 rules / docs，不在 ADR 里重复（避免多处漂移）。

## 何时写 ADR

- 做出一个影响多模块 / 难以回退的技术选型
- 在多个可行方案间权衡后选定一个
- 推翻或替换既有方案（新 ADR + 旧 ADR 标 `Superseded by`）
- 解决了一个反复出现的架构争议

**不必写**：纯实现细节、无争议的小修小补、可直接从代码读出的决定。

## 模板与编号

- **模板**：[0000-template.md](./0000-template.md)（MADR 风格）
- **编号**：四位补零 `NNNN-短标题.md`，补丁式追加，**永不重排、永不复用**
- **被取代**的 ADR：保留原文件，状态改为 `Superseded by ADR-XXXX`；新建一篇接续

## 状态模型

```
Proposed ──► Accepted ──► Deprecated
                │
                └────────► Superseded by ADR-XXXX
```

| 状态 | 含义 |
|------|------|
| Proposed | 已提出，等待确认（本仓多为直接 Accepted） |
| Accepted | 已采纳，当前生效 |
| Deprecated | 不再推荐，但仍可参考 |
| Superseded by ADR-XXXX | 被后续 ADR 取代，看新 ADR |

## 索引

| # | 标题 | 状态 | 日期 |
|---|------|------|------|
| [0001](./0001-dual-backend.md) | 双后端架构（Java + Go 双实现） | Accepted | 2026-06-28 |
| [0002](./0002-frontend-three-services.md) | 前端三服务分离（engine / BFF / website） | Accepted | 2026-06-28 |
| [0003](./0003-e2e-unified-playwright.md) | E2E 统一 Playwright（弃 Cypress） | Accepted | 2026-06-28 |
| [0004](./0004-lowcode-schema-driven.md) | 低代码引擎 Schema-driven 架构 | Accepted | 2026-06-28 |
| [0005](./0005-ssot-task-graph.md) | SSOT 任务图（JSON 为计划/执行事实源） | Accepted | 2026-06-28 |
| [0006](./0006-sprint-mcp-inhouse.md) | 敏捷流程自研 Sprint MCP | Accepted | 2026-06-28 |
| [0007](./0007-git-submodule-monorepo.md) | Git submodule 多仓（meta + 子仓） | Accepted | 2026-06-28 |
| [0008](./0008-no-local-docker.md) | 禁止本地 Docker，中间件远端化 | Accepted | 2026-06-28 |
| [0009](./0009-test-layering-coverage-gates.md) | 测试分层与覆盖率门禁 | Accepted | 2026-06-28 |
| [0010](./0010-squash-merge-submodule-order.md) | Squash 合并 + submodule PR 顺序 | Accepted | 2026-06-28 |
| [0011](./0011-multi-client-consistency.md) | 多端业务一致性（engine/website/client） | Accepted | 2026-06-28 |
| [0012](./0012-agent-governance-system.md) | Agent 治理体系（rules + skills + 记忆闭环） | Accepted | 2026-06-28 |

## 维护约定

- 新增 ADR：复制模板 → 编号顺延 → 更新本索引表 → 同一 commit 提交
- 改状态：更新对应 ADR 的「状态」行 + 本索引表「状态」列
- ADR 是**只增不删**的历史档案；决策被推翻时写新 ADR，不删旧文
