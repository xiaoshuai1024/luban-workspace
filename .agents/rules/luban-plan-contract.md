<!--
description: 新建或修改 Superpowers plan 时提醒加载方案编写契约与执行约束
globs: docs/superpowers/plans/**/*.md
alwaysApply: false
-->

# Superpowers Plan 契约（软提醒）

用户在聊天中提出「写方案」等**实现计划**意图但未显式使用 **`/plan-template`** 时，Agent 应**主动建议**使用该命令（见 `docs/SUPERPOWERS.md`）。

编辑或新建 `docs/superpowers/plans/**/*.md` 时：

1. 编写前加载 `docs/SUPERPOWERS.md`「计划类 Skill 的触发时机」与方案章节，核对必选内容（需求溯源、按系统新增功能模块表、列表级交互链路、页面结构展示与高保真原型、集成复用表、UX/架构自检、E2E 计划含 P0、跨端主路径、脚本保障逻辑、文首 `taskGraph`）。
2. 执行与收尾对齐 `docs/SUPERPOWERS.md`「AGENT_WORKFLOW_CONSTRAINTS」（TDD、并行 subagent 条件、Console→Network→后端日志、verification）。
3. 任务状态以任务图 JSON 为准；校验 `node scripts/verify-plan-ssot.mjs validate <path>`（schema）+ `node scripts/verify-plan-ssot.mjs journey-coverage`（旅程覆盖率，P0 阻断）。
4. **范围与质量（对齐 `/plan-template`）**：采用**最完整可交付策略**——需求内功能**不得静默跳过**；同时**控制功能膨胀**——凡非需求原文或本期目标所必需的能力，须列入「**明确不做 / 后续迭代**」并说明理由，禁止无边界镀金。禁止假绿、占位、骨架页、以 raw JSON 顶替用户页面；页面交互须与 E2E 计划可验收对齐。
5. **旅程覆盖一致性（MUST）**：凡 plan 含 §7.0 用户旅程覆盖声明，定稿前须核对：(a) 旅程声明表与 taskGraph JSON `journeys[]` 逐行一致；(b) P0 旅程在 §7.3 场景表有对应 `@J-<id>` 绑定；(c) `make journey-coverage` 跑通（P0=100%）。无 E2E 增量的 plan 可跳过。
6. **多维结论落盘**：若用户要求将并行多视角结论写入本 plan，须按 **`/10-bs`** 执行：仅将**综合结论**写入目标文档的约定章节，不得把分轮过程堆进 plan。
6. **编写方案时可按需加载的 skills**（路径以仓库为准）：`architecture-review-e2e-tdd`、`ux-product-review`（与 `/super-pm`）、`writing-plans`、`brainstorming`（需求含混或创新点前）、`ten-round-brainstorm`（与 `/10-bs` 配套）。

本规则为 **fail open** 提醒；合并不以此文件为唯一门禁，仍以人审与 CI 为准。

---

## 经验：十轮并行头脑风暴的工作方法

每个独立视角同时审视同一命题，非串行改稿：

1. 定义 10 个正交的视角维度（功能缺失、设计缺陷、可用性、性能、冲突、边界、自动化、可读性、增量、工作流整合）
2. 所有视角**并行**思考，互不干扰
3. 结论按 H/M/L 优先级排序，纳入方案
4. 有效避免「想到哪算哪」的盲点

---

## 经验：writing-plans discipline — 写方案前必须先加载方案契约

### 场景
撰写实现计划时，直接输出 §2 任务表 → §3 执行计划 → §4 验证门禁三段，缺失页面结构展示、集成复用表、数据隔离声明、E2E 脚本保障逻辑、TDD 执行约定等多个 MUST 章节。

### 根因
1. 没有加载 `writing-plans` skill 就动手写 plan
2. 没有读取方案章节清单
3. 凭记忆输出模板，而非按契约逐节对照

### 解决方案
1. 每轮定稿前显式加载 `writing-plans` skill + 读取方案章节清单
2. 逐节对照：文首 YAML → 分支 → 溯源 → 任务表 → 执行计划 → 模块表 → 交互链 → 页面结构 → 集成复用 → 数据声明 → E2E 计划 → TDD 约定
3. 每节都核对质量禁令自检表与分级验收门禁

### 预防
- 写 plan 前必须执行：`writing-plans` skill → 方案章节清单 → 任务图 SSOT
- 完成后自检：页面结构展示是否存在？集成复用表是否存在？E2E 脚本保障逻辑是否存在？
