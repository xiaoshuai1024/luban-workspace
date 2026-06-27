<!--
description: 任务图 JSON 为唯一事实源；写计划必同步 JSON，执行必更新状态
globs: docs/superpowers/plans/**/*.md, docs/superpowers/tasks/**/*.json
alwaysApply: false
-->

# Superpowers 任务图 SSOT（MUST）

## 核心要求

1. **每 feature 一份 JSON**：`docs/superpowers/tasks/<featureId>.json`，与 `feature/<name>` 或 plan slug 对齐。
2. **`writing-plans`**：在 `docs/superpowers/plans/` **新建或实质性修改**计划时，**同一变更批次**须创建/更新对应 JSON，并在 plan 文首发 YAML 填写 `taskGraph`（与 `metadata.planPath` 互指）。
3. **`journeys` 字段与 plan §7.0 一致（MUST）**：凡 plan 含 §7.0 用户旅程覆盖声明，对应 taskGraph JSON 须有 `journeys[]` 数组，id/优先级/场景与 §7.0 旅程声明表逐行一致；P0 旅程须有 spec 绑定 `@J-<id>`（见 `docs/dev/ssot-task-graph.md`「旅程覆盖」）。无 E2E 增量的 plan 可省略 `journeys`。
4. **`executing-plans` / 开发**：开工任务 → `in_progress`；验证完成 → `done`；阻塞 → `blocked` + `blockedReason`；更新 `metadata.updatedAt`。
5. **并行与子任务**：依赖图表达并行就绪集；子任务用 `parentId` 与 `id`（如 `3.1`）；不设单独「并行组」字段。
6. **禁止**：仅写 Markdown 计划而不维护 JSON；仅在对话宣称完成而不更新 JSON。
7. **校验**：提交前对改动过的任务图执行 `node scripts/verify-plan-ssot.mjs validate <path>`（schema）+ `node scripts/verify-plan-ssot.mjs journey-coverage`（旅程覆盖率，P0 阻断）。
8. **Plan 正文契约**：新建或实质性修改 `docs/superpowers/plans/**/*.md` 时须符合 `docs/SUPERPOWERS.md` 计划章节（需求溯源、按系统新增模块表、集成复用表、UX/架构自检、E2E 计划等）。

## 与 GitHub

工作项状态变更须遵守 [`luban-github-agile-agent.md`](./luban-github-agile-agent.md)；JSON 负责**技术任务依赖与状态**，可选 `metadata.externalRefs` 弱引用 GitHub Issue / PR 编号。

---

## 经验：方案先行 + 审查方案

### 场景
实现大型新功能前，先用 `/plan-template` 出方案 → 审查方案 → 修复 → 再审查收敛。

### 经验教训
- 方案阶段发现的数据存储归属矛盾、API 命名、状态机遗漏，在编码前修复可避免高返工成本
- 方案中的表设计、API 签名、状态机图可直接作为实现契约

### 方案 → 实现的分阶段并行派发

- 将大功能拆为多个 Task，控制依赖关系
- 无依赖的 Task 并行派发（如 DDL + 删旧代码可并行）
- 每个 Task 一个独立 subagent，按 luban 各包路径工作

---

## 经验：前后端 API 契约必须在实现中持续验证

### 场景
不同包由不同 agent 实现时，API 签名不匹配是最常见的回归类型。

### 类型
1. 前端期望的端点在 Controller 中不存在
2. 字段名不一致（后端返回 `status`，前端期望 `decision`）
3. 类型不一致
4. 结构不一致（前端期望嵌套 `skus`，后端只返回简单字段）

### 预防
- 实现后必须在两端（BFF ↔ 后端、引擎 ↔ BFF）之间做逐端点核对
- 用 contract test 验证
- 双后端（Java/Go）契约必须一致，见 [`docs/DUAL_BACKEND_PARITY.md`](../../docs/DUAL_BACKEND_PARITY.md)

---

## 经验：verify-artifacts — 自动验证 task 产出物存在性

### 场景
计划包含多个 task，被标记为 "done" 后缺乏验证。

### 解决方案
在 `scripts/verify-plan-ssot.mjs` 中维护 `verify-artifacts` 命令：
```bash
node scripts/verify-plan-ssot.mjs verify-artifacts
```
读取所有 `docs/superpowers/tasks/*.json` → 对每个 `status === "done"` 且有 `artifacts` 的 task → 检查每个 artifact 在代码库中真实存在。缺失则报错退出。

### 预防
- 宣称完成前必须跑 `verify-artifacts`
- task 的 `artifacts` 字段应反映真实文件路径
