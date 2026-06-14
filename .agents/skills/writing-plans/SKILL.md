---
description: 按 PLAN_WRITING_CONTRACT.md 输出定稿 plan 文档的标准 skill，含 §0-§9 完整结构
---

# Writing Plans Skill

本 skill 用于按 `docs/superpowers/PLAN_WRITING_CONTRACT.md` 输出可执行的定稿 plan 文档。

## 触发条件

- `/plan-template` 第二轮定稿阶段
- 用户要求写方案/plan 且已完成范围讨论

## 输入约定

- 上游输入：第一轮讨论稿 + 用户确认的范围
- 加载文档：`docs/superpowers/PLAN_WRITING_CONTRACT.md`（必选章节 §0-§8）
- 任务图：创建 `docs/superpowers/tasks/<featureId>.json`，文首 YAML 含 `taskGraph` 引用

## 产出物

完整的 `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`，包含：

| 章节 | 内容 | 来源 |
|:----|:-----|:-----|
| §0 | 文首 YAML（taskGraph）+ 分支策略 | PLAN_WRITING_CONTRACT §0 / §0.1 |
| §1 | 需求溯源 | PLAN_WRITING_CONTRACT §1 |
| §2 | 系统与链路 | 本文硬要求 §3 |
| §3 | 业务逻辑 | architecture-review-e2e-tdd 对齐 |
| §4 | 页面结构 + 交互链路 + UX 自检 | PLAN_WRITING_CONTRACT §4.0 / §4.1 / §4.2 / §4.3 |
| §5 | 集成与复用表 | PLAN_WRITING_CONTRACT §5 |
| §6 | 架构边界 + 门禁自检 | PLAN_WRITING_CONTRACT §6 / §6.1 |
| §7 | E2E 测试计划 + 跨端主路径 | PLAN_WRITING_CONTRACT §7 / §7.1 / §7.2 |
| §8 | TDD 与执行约定 | PLAN_WRITING_CONTRACT §8 |
| §9 | 实现任务派发（由 §9 生成阶段自动填充） | 本文 §9 节 + subagent |
| — | 分级验收门禁表（G1-GN） | 本文输出骨架 |
| — | 质量禁令自检表（逐条勾选） | 本文质量禁令 |

## 执行要点

1. 全文加载 `PLAN_WRITING_CONTRACT.md` 后逐节对照输出
2. 创建 `docs/superpowers/tasks/<featureId>.json` 并执行 `node scripts/verify-plan-ssot.mjs validate`
3. §7 E2E 至少包含一条多租户隔离验证用例
4. 质量禁令自检表须逐条勾选（不得跳过）
