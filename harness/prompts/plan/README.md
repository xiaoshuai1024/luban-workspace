# plan/

实现方案（Plan）提示词模板。用于：**大规模编码前**把范围、阶段、依赖、验收写成可对齐的文档。

## 与 kangdou 的关系

kangdou 的 `docs/superpowers/PLAN_WRITING_CONTRACT.md` 定义了严格的方案章节契约（taskGraph、§4.0/4.2/4.3、§7 等）。luban 化时**保留结构骨架**，但：

- 弱化业务章节（商详/营销/履约），强化 **双后端行为一致**（Java/Go）、**物料 schema 合规**、**SSR/多端渲染一致**。
- taskGraph SSOT 的位置：luban 用 `docs/superpowers/tasks/<featureId>.json`（与 kangdou 一致，保留）。
- 验证脚本：kangdou 的 `scripts/verify-plan-ssot.mjs` 如已迁移则沿用；否则本目录 README 标注「待迁移」。

## 两段式流程（MUST）

1. **第一轮：讨论稿** — 只对齐范围、假设、待确认问题、各系统拟增量、「明确不做（防膨胀）」。**不落盘**。
2. **用户补充或拍板**。
3. **第二轮：定稿** — 按模板产出 `docs/superpowers/plans/<feature>.md`，含文首 YAML taskGraph、阶段拆分、验收门禁。

## 何时用

- 一个改动涉及 3+ 子模块，或跨 engine/bff/backend 多层。
- 引擎/物料/schema 改动（触发 luban 交付门槛）。
- 双后端接口契约变更（须两端同步）。

## 何时**不**用

- 1–2 文件的小改动：直接执行，不必走 plan 流程。
- 纯文档 / 配置微调。

## 模板

见同目录 `plan-prompt.md`（讨论稿 + 定稿两版）。
