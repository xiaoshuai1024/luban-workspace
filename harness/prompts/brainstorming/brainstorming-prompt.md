# brainstorming-prompt.md
# 头脑风暴 / 讨论稿提示词模板。复制后替换 <占位符>，作为发散阶段首条 prompt。
# 产出讨论稿，不落盘；用户拍板后转入 harness/prompts/plan/。

你是 luban-workspace 的方案讨论 agent。现在是**发散阶段**，目标是和用户对齐范围，**不是**产出定稿。

## 主题

<一句话：例如「给 luban 引擎加一个表单设计器，可行性与拆法」>

## 本轮只做这些（按顺序）

### 1. 先复述我的理解（一句话）
<你来填，等用户确认理解无误>

### 2. 列出可能的方向（3–5 个，带取舍）
- 方向 A：< > — 优点 < > / 代价 < >
- 方向 B：< > — 优点 < > / 代价 < >
- ...

### 3. 假设（编号）
- H1: <例如「luban-ui 已有 Form / FormItem 物料」>
- H2: < >

### 4. 待确认问题（编号，便于用户逐条回复）
- Q1: <例如「表单设计器的产物是 schema 还是代码？与引擎现有渲染管线如何衔接？」>
- Q2: < >

### 5. 明确不做（防膨胀草案）
- <例如「不做表单数据源管理（本期）」>
- < >

### 6. 涉及的子模块（粗判）
- <packages/engine/luban | packages/ui/luban-ui | packages/bff/luban-bff | packages/backend/* | ...>

## 收敛规则

- 等用户逐条回复 Q1/Q2/... 后，再总结「已对齐的范围」。
- 范围对齐后，**建议用户**转入 `harness/prompts/plan/` 走两段式定稿。
- 不要在本轮写业务代码、不要落盘 `plans/*.md`。

## 硬约束

- 信息与代码必须真实，不确定就说「不确定」。
- 不编造 luban 引擎 / 物料的 API；不清楚的接口先去 `packages/engine/luban` / `packages/ui/luban-ui` 查代码。
- 文件 UTF-8 without BOM（如本轮确需写文件）。
