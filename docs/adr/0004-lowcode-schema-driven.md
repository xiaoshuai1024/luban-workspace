# ADR 0004: 低代码引擎 Schema-driven 架构

| 字段 | 值 |
|------|-----|
| 状态 | Accepted |
| 日期 | 2026-06-28 |
| 决策者 | 架构组 |
| 关联文档 | [docs/LOWCODE_ENGINE_SPEC.md](../LOWCODE_ENGINE_SPEC.md)、[.agents/rules/luban-lowcode-engine-quality.md](../../.agents/rules/luban-lowcode-engine-quality.md)、[.agents/rules/luban-material-schema.md](../../.agents/rules/luban-material-schema.md) |
| 回溯 | Yes（决策实际发生于项目早期，本篇为 2026-06-28 回溯记录） |

## 背景 (Context)

luban 的核心交付物是「让运营自助搭出可发布页面」。这意味着页面内容必须以数据形式可存储、可版本化、可在多端复现，而不是写死在某份源码里。我们需要一种机制，把「页面长什么样」从「页面如何被渲染」中彻底剥离出来：前者是可序列化的描述，后者是各端各自的运行时。

页面描述本身也要经得起校验。运营在可视化设计器里搭出的配置是脏数据来源——字段缺失、类型错、引用了不存在的物料、版本对不上——如果没有运行时校验，这些脏数据会直接穿透到渲染层导致白屏或崩溃。因此「描述」必须自带结构约束（schema），并且引擎在渲染前能据此裁剪、补默认值、兜底。

更关键的是平台优先级：低代码引擎的可用性与物料合规，被明确排在「各端一致性」和「后端功能」之前。能力受限时优先保障引擎能稳定渲染。这要求架构本身就把「引擎稳定渲染」作为不可妥协的底线，单点失败不得级联到整页。多端一致性（web/electron/flutter 渲染同一份页面）也只有在「同一份 schema、同一套物料契约」的前提下才可能成立。

## 决策 (Decision)

我们选择运行时 schema-driven 架构：页面以 JSON schema 描述，引擎在运行时解析 schema、调度物料、用 propsSchema 校验 props、走渲染管线输出 UI，物料独立版本化（semver）；多端共享同一 schema 产出一致渲染。

三层职责清晰：**Schema** 是页面描述，结构为 `{ version, tree: { material, props, children } }` 的页面树。**Engine**（`packages/engine/luban`）负责把 JSON 页面树转渲染指令、按 schema 中的物料名+版本从 manifest 调度加载、用每个物料的 `propsSchema` 校验实际 props（缺失字段填默认值）、递归渲染页面树，并内置事件系统与 ErrorBoundary——单个物料 throw 只显示错误占位、不中断整页渲染。**Materials**（`packages/ui/luban-ui`）通过 `defineMaterial` 注册 Vue3 组件，每个物料声明 `propsSchema`/`events`/`slots` 与 semver 版本。

引擎在渲染前对 schema 做结构校验、物料存在性、版本兼容性、props 校验与循环引用检测；校验失败的物料显示占位并上报，绝不抛错中断渲染。

## 考虑过的备选方案 (Alternatives Considered)

### 备选 A：代码生成（schema → 生成源码再构建）
- 优点：产出的是可读源码，可二次手改、可静态分析、运行时无解析开销，渲染性能最优。
- 缺点 / 代价：运营每次改页面都要「生成 + 构建 + 发布」，反馈链路从毫秒级变成分钟级，彻底扼杀可视化搭建的实时体验；生成出的源码一旦被手改就和 schema 脱钩、双向同步几乎不可能；多端要为每端各生成一份代码，一致性反而更难保证。与「运营自助、即时预览」的产品定位直接冲突。

### 备选 B：模板嵌套（预置一批页面模板，运行时只选模板填变量）
- 优点：实现简单，渲染确定性强，性能好，几乎不存在解析失败的可能。
- 缺点 / 代价：表达力被锁死在预置模板的组合空间内，运营无法自由组合物料、无法构造模板作者没预见到的布局；新增排版能力要改模板源码、重新发版，丧失「低代码」的核心价值；本质上退化成「带变量的固定页面」，无法支撑设计器的自由编辑。

## 后果 (Consequences)

- **正面**：页面以数据形态可存储/可版本化/可多端复现；物料独立 semver 让物料可平滑演进而不锁死引擎；propsSchema 在渲染前兜底，脏数据不再穿透成白屏；ErrorBoundary 保证单点失败不级联；多端一致性有了共同的事实基础（同一 schema）。
- **负面 / 代价**：运行时解析与校验有固定开销，需控制大页面性能；每个物料都必须维护 propsSchema 并保证字段有默认值、有中文 description，物料作者的心智与测试成本上升；版本治理（major 不兼容需保留别名 `Button@1.x`）增加了 manifest 复杂度。
- **需要后续跟进**：CI 落地 schema 校验脚本，无 propsSchema 的物料禁止注册；引擎构建门禁（`cd packages/engine/luban && pnpm run build`）纳入改动收尾流程；物料默认值覆盖与边界值的单测需持续补齐。

## 备注

这是平台最高优先级约束（引擎可用性 > 各端一致性 > 后端功能）。推翻需证明存在另一套机制能在保证「脏数据不白屏 + 多端一致 + 物料可独立演进」三项的同时显著优于现状。与 [ADR 0002](./0002-frontend-three-services.md)、[ADR 0011](./0011-multi-client-consistency.md) 联动：三服务分离部署 schema 产物，多端一致性依赖同一 schema 渲染。
