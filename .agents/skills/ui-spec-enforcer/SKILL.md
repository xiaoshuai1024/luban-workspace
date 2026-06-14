---
name: ui-spec-enforcer
description: Enforce luban UI implementation standards from luban-ui material library and the agent markdown spec. Use when writing or reviewing frontend UI, styles, components, interactions, glass effects, colors, spacing, or design-related docs for luban low-code engine renderer, SSR site, admin, or multi-client (electron/flutter).
---

# UI Spec Enforcer (luban 低代码平台)

## 规范来源（先读）

1. `docs/UI_SPEC.md`（Agent 摘要）
2. `packages/ui/luban-ui`（**可执行单源** — Vue 3 物料库 + token 定义）
3. `design-system/luban/MASTER.md`（设计系统主文档，含 token / 色板 / 字体 / 组件规范）
4. `scripts/check-design-tokens.mjs`（Token 合规自动扫描）

**冲突优先级**：
- 实现细节：`packages/ui/luban-ui` 源码（CSS 变量 / SCSS / design-tokens）
- Agent 摘要与策略：`docs/UI_SPEC.md`
- 设计意图与背景：`design-system/luban/MASTER.md`

> **🔴 TODO（待确认）**：luban-ui 的品牌主色、token 前缀（`--lb-*` 或其他）、字号/间距刻度均为占位。落地前必须从 luban-ui 源码提取并回填 `docs/UI_SPEC.md`、`design-system/luban/MASTER.md`、`scripts/check-design-tokens.mjs`。**不得臆造色值**。

## 强制工作流

任何 UI 代码改动前：
- Read `docs/UI_SPEC.md` 相关章节。
- 在 `packages/ui/luban-ui` 中定位对应组件 / token 定义。
- 提取具体 token（color / radius / blur / spacing / icon size / typography）。

实现过程中：
- 复用既有 token 与 class 模式。
- 除非明确要求，不得引入新的视觉语言。
- 交互与状态须与规范一致。

完成前：
- 报告应用了哪些规范条目（至少 2 条）。
- 指向用作参考的具体文件路径。
- 运行 `node scripts/check-design-tokens.mjs` 并附 exit code 与违规计数。

## 不可协商规则（Non-negotiable）

- 主交互强调色须使用 **luban-ui 品牌主色**（`--lb-color-primary`，**值待 luban-ui 确认**，占位 `#2ECC71` 不具约束力）。
- **禁止**用信息蓝（`--lb-color-info`）作组件主强调色。
- 毛玻璃 / 背景模糊须用半透明白 + `backdrop-filter: blur()` + 细边/高光，**禁止**纯灰实底或纯 `opacity` 冒充。
- 导航栏、tab、图标须遵循 luban-ui 文档尺寸与 active 态行为。
- 通用 safe-area（Web/PWA）：固定定位元素须保留 `env(safe-area-inset-*)` 兜底（**通用 safe-area 保留**；小程序专属 safe-area 全量门禁不适用）。
- **单位**：统一 px / rem，**禁止 rpx**（小程序专属，luban 不用）。
- **物料 props schema**：须符合 `.agents/rules/luban-material-schema.md`。
- **多端渲染一致**：引擎产物在 Web SSR / electron / flutter 中视觉一致，不得 hardcode 覆盖 token。
- **预览与发布一致**：预览态与发布态使用同一渲染器（见 UI-LC-003）。

## 快速自检

- [ ] 颜色与 focus/active 态遵循 luban-ui 品牌主色映射。
- [ ] 圆角/间距/排版匹配 luban-ui token（非硬编码）。
- [ ] 毛玻璃组件含 blur + 半透明背景 + 细边。
- [ ] 单位统一 px/rem，无 rpx。
- [ ] 物料 props schema 合规。
- [ ] 引擎产物各端渲染一致。
- [ ] 输出笔记清晰映射改动到规范条目。
- [ ] 已运行 `scripts/check-design-tokens.mjs` 并附结果。
- [ ] 若 token 仍为「待确认」，已在 PR 标注需 luban-ui 维护者确认，未臆造色值。
