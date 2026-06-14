# luban 低代码平台 · UI 规范（Agent 摘要）

本文档供 Agent 实现界面（低代码引擎渲染器、SSR 站点、管理端、各端物料）时快速对齐视觉与交互。**详细 token 与组件状态以 luban-ui 物料库（`packages/ui/luban-ui`）为准**。

> **TODO（待人工确认）**：本规范为骨架版，所有具体色值、token、字号、间距均标注「待从 luban-ui 提取确认」。Agent 在 token 落地前应：
> 1. 优先在 `packages/ui/luban-ui` 源码中检索实际定义（CSS 变量 / SCSS / design-tokens.ts）；
> 2. 找到后回填本文件并把「待确认」标记替换为真实值；
> 3. 找不到时不得臆造色值，须在 PR 中标注「需 luban-ui 设计 token 维护者确认」。

---

## 1. 规范来源（必读顺序）

| 资源 | 路径 | 用途 |
|------|------|------|
| **luban-ui 物料库（主参考）** | `packages/ui/luban-ui` | Vue 3 组件 + token 定义源（CSS 变量 / SCSS / design-tokens）；组件级样式以仓库内实现为准 |
| **本规范摘要** | `docs/UI_SPEC.md`（本文档） | Agent 实现时的快速对照 |
| **低代码引擎渲染契约** | `docs/LOWCODE_ENGINE_SPEC.md` | 引擎渲染物料时的 schema/props/事件契约 |
| **设计系统主文档** | `design-system/luban/MASTER.md` | 设计 token、色板、字体、组件规范的单一来源（占位 + TODO） |
| **token 扫描脚本** | `scripts/check-design-tokens.mjs` | 自动扫描 .vue/.ts 中的硬编码颜色与 token 违规 |

**优先级（冲突时）**：
1. `packages/ui/luban-ui` 实际实现（**可执行单源**）
2. `design-system/luban/MASTER.md`（设计意图）
3. 本文档（Agent 摘要）

---

## 2. 品牌色与配色原则

> **🔴 待确认（从 luban-ui 提取）**：luban 的品牌主色尚未在本仓内固化。下方为占位。

- **品牌主色（主交互）**：`--lb-color-primary`，**值待从 luban-ui 提取确认**（占位 `#2ECC71` 沿用自参考实现稿，**仅作占位**，不代表 luban 实际品牌色）。
- **不要**把信息蓝 `--lb-color-info` 当作组件主强调色；信息蓝仅用于中性信息提示。
- **语义色**：成功（绿）、警告（橙）、危险（红）、信息（蓝）保持语义独立。
- **可点击/选中/聚焦/链接/价格强调/空状态按钮**：一律用品牌主色及其透明度变体，**不要**用信息蓝。

**映射示例（Agent 实现时按此执行，token 待回填）**：

| 场景 | 错误做法 | 正确做法 |
|------|----------|----------|
| 筛选 Pill 选中 | 信息蓝实心 | 品牌主色实心，或主色描边 + 浅主色底 |
| 输入框 focus 环 | 蓝色外发光 | 品牌主色外发光 |
| 侧栏选中 | 蓝色底 | 品牌主色底，或主色字 + 浅主色背景 |
| 价格数字 | 默认用蓝 | 主色或正文色；促销再用警示橙 |

---

## 3. 设计 Token（骨架，待 luban-ui 回填）

> 所有值为占位。Agent **不得**把占位值当作真实 token 使用；落地前必须从 `packages/ui/luban-ui` 提取并回填本表，同时更新 `scripts/check-design-tokens.mjs` 的 `TOKEN_COLORS_HEX` 白名单。

### 色彩

| Token | 值（占位/待确认） | 说明 |
|------|------------------|------|
| `--lb-color-primary` | `#2ECC71` ⚠️占位 | 品牌主色，主交互与主强调（**待确认**） |
| `--lb-color-info` | 待确认 | 信息蓝，仅用于中性信息（**不作主强调**） |
| `--lb-color-success` | 待确认 | 成功态 |
| `--lb-color-warning` | 待确认 | 警示、促销次要 |
| `--lb-color-danger` | 待确认 | 警示、错误、删除 |
| `--lb-color-text` | 待确认 | 主文案 |
| `--lb-color-text-secondary` | 待确认 | 次要文案 |
| `--lb-bg-base` | 待确认 | 页面默认铺底 |

### 圆角 / 间距 / 阴影

| Token | 值（待确认） | 说明 |
|------|-------------|------|
| `--lb-radius-sm` | 待确认 | 小圆角（按钮、输入框） |
| `--lb-radius-md` | 待确认 | 中圆角（卡片） |
| `--lb-radius-lg` | 待确认 | 大圆角（弹窗、大卡片） |
| `--lb-space-xs/sm/md/lg/xl` | 待确认 | 4/8/12/16/20/24/32 量级（**待确认实际刻度**） |
| `--lb-shadow-sm/md/lg/xl` | 待确认 | 阴影层级 |

### 字体

| Token | 值（待确认） | 说明 |
|------|-------------|------|
| `--lb-font-family` | 待确认 | 中文字体栈 + Web 字体 |
| `--lb-font-size-*` | 待确认 | 字号刻度（待确认） |
| `--lb-line-height-*` | 待确认 | 行高刻度 |

> **TODO 提取指引**：在 luban-ui 中检索以下文件（典型路径，实际以仓库结构为准）：
> - `packages/ui/luban-ui/src/styles/tokens.css` 或 `tokens.scss` 或 `design-tokens.ts`
> - `packages/ui/luban-ui/src/styles/variables.scss`
> - 主题入口 `packages/ui/luban-ui/src/index.ts` 中导出的 design tokens
>
> 找到后，把 token 名前缀（`--lb-*` 或其他）与实际值同步到本表与 `scripts/check-design-tokens.mjs`。前缀若 luban-ui 已用其他前缀（如 `--luban-*` / `--lb-ui-*`），本仓统一以 luban-ui 实际前缀为准，本文档 placeholder 中的 `--lb-` 不具约束力。

---

## 4. 字体层级（占位）

- 页面标题 / H1：字号待确认
- 模块标题 / H2：字号待确认
- 正文：待确认，行高建议 1.5
- 辅助 / Caption：待确认

> **TODO**：从 luban-ui 排版组件（Title / Text / Heading）中提取实际字号刻度。

---

## 5. 多端渲染相关

luban 的渲染目标为 **Web（SSR）+ 低代码引擎运行时 + 多端（electron/flutter/web）**，不涉及小程序原生约束。需注意：

- **Web/SSR 安全区**：浏览器与桌面端无原生 safe-area-inset，但 PWA / 移动 Web 仍建议保留通用 `env(safe-area-inset-*)` 兜底（**通用 safe-area 保留**，小程序专属 tab-bar 遮挡类规则不适用）。
- **单位**：统一使用 **px / rem**（基于根字号），**禁止** rpx（rpx 是小程序专属，luban 不用）。
- **各端渲染一致（MUST）**：物料在 Web SSR、electron、flutter webview 中须视觉一致；见 `docs/LOWCODE_ENGINE_SPEC.md` 与 `.agents/rules/luban-multi-client-consistency.md`。

---

## 6. 动效与无障碍

- 尊重 `prefers-reduced-motion: reduce`：减弱或关闭装饰性动画。
- 尊重 `prefers-color-scheme: dark`：若 luban-ui 支持深色模式，须通过 CSS 变量驱动。
- 焦点态（`:focus-visible`）须可见，键盘可达性必检。

---

## 7. 与低代码引擎的关系

- 引擎渲染器（`packages/engine/luban`）消费 luban-ui 物料，按 schema 渲染页面。
- 物料 props schema 合规见 `.agents/rules/luban-material-schema.md`。
- 视觉 token 由 luban-ui 统一注入，引擎不得在渲染产物中硬编码颜色覆盖 token（见 `scripts/check-design-tokens.mjs`）。

---

## 8. Agent 自检清单（界面 PR 前）

- [ ] 主交互、选中态、聚焦环是否为 **品牌主色** 体系，而非信息蓝强调。
- [ ] 圆角、间距、字号是否使用 luban-ui token，而非硬编码。
- [ ] 是否使用 **px/rem**，未混入 rpx。
- [ ] 物料 props 是否符合 `.agents/rules/luban-material-schema.md`。
- [ ] 引擎产物在 Web SSR / electron / flutter 中渲染一致（无 hardcode 覆盖）。
- [ ] 已运行 `node scripts/check-design-tokens.mjs` 并附违规计数（exit code）。
- [ ] 若本规范中 token 仍为「待确认」，是否已在 PR 中标注需 luban-ui 维护者确认，未臆造色值。

---

*文档版本：占位骨架版。token 回填后请同步更新 `design-system/luban/MASTER.md` 与 `scripts/check-design-tokens.mjs`，并移除本节「待确认」标记。*
