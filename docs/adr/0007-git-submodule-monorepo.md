# ADR 0007: Git submodule 多仓（meta + 子仓）

| 字段 | 值 |
|------|-----|
| 状态 | Accepted |
| 日期 | 2026-06-28 |
| 决策者 | 工程效率组 |
| 关联文档 | docs/dev/luban-git-merge-pull.md、docs/GIT_WORKFLOW.md、ADR-0010 |
| 回溯 | Yes（决策实际发生于项目早期，本篇为 2026-06-28 回溯记录） |

## 背景 (Context)

Luban 平台由多个技术栈异构的子项目构成：TS+pnpm（engine/bff/web/sprint-mcp 等）、Java+Maven（backend）、Vue3（ui），各子项目有独立的发版周期与 CI。meta 仓（luban-workspace）需要聚合这些子项目指针，使一份 checkout 能让 Agent 同时操作多端、跑跨端契约校验，同时让只关心单一子项目的协作者可以独立 clone 单仓。

团队在"单仓多包 monorepo"与"多仓 + meta 聚合"之间反复权衡，最终选择后者。

## 决策 (Decision)

采用 git submodule 多仓结构：luban-workspace 是 meta 仓，`packages/` 下各子项目（engine、bff、ui、web、backend 等）各自是独立 git submodule，各有独立远程仓库与默认分支，CI 按子项目隔离。

- 子项目可独立 clone 给只关心单端的协作者。
- 跨仓改动通过协作命令收敛：`/pull-all`（各 submodule 同步默认分支）、`/push-all`（各 submodule commit+push）、`/pr-all`（各 submodule + meta 仓 `gh pr create`）。
- meta 仓只持有指针与跨仓文档/脚本/治理文件（.agents/、docs/、scripts/）。

## 考虑过的备选方案 (Alternatives Considered)

### 备选 A：monorepo（单仓多包，pnpm workspace 风格）
- 优点：单一历史、原子跨端提交、依赖共享简单、CI 可做 selective build。
- 缺点 / 代价：技术栈异构（TS/Java/Vue）下 workspace 模型不天然，Java/Go 子项目不归属 pnpm workspace；仓库体量随子项目增长，单端协作者被迫 clone 全量历史；子项目无法独立发版与独立权限边界；CI 隔离需自建复杂矩阵。

### 备选 B：独立多仓，无 meta 聚合
- 优点：各仓完全独立、权限/CI/发版最干净。
- 缺点 / 代价：Agent 跨端协作时需手动逐仓 clone 与切换；跨端契约校验、统一治理文件（.agents/rules、scripts）无处安放，会多份漂移；失去"一份 checkout 跑全链路"的能力，与重 Agent 协作的定位冲突。

## 后果 (Consequences)

- **正面**：单端可独立 clone 与发版；meta 仓聚合让 Agent 一次性操作多端；CI 按子项目隔离爆炸半径小；治理与跨仓脚本有统一归属。
- **负面 / 代价**：submodule 指针管理心智负担；squash 合并后指针 dangling 风险（见 ADR-0010）；跨仓改动需多 PR；新协作者需理解 submodule 初始化。
- **需要后续跟进**：持续维护 /pull-all /push-all /pr-all 命令的正确性；监控指针 dangling 事件；评估是否需要把高频联动子项目合并以降低协作摩擦。

## 备注

推翻条件：跨仓改动占比高到协作成本压过隔离收益，或子项目技术栈收敛到单一 workspace 模型。指针 dangling 的具体处置见 ADR-0010。
