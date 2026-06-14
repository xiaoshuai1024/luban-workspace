# luban 设计系统 · 主文档（Master）

> **LOGIC:** 当构建具体页面/物料时，先查 `design-system/luban/pages/[page-name].md`（若存在）。
> 若存在，其规则 **覆盖** 本 Master 文档。
> 若不存在，严格遵循下方规则。

---

**Project:** luban 低代码平台
**Generated:** 2026-06-14（占位骨架版）
**Category:** Low-code Platform（引擎 + 物料库 + SSR + 多端）

---

> **🔴 TODO（待从 luban-ui 提取确认）**：本文档为骨架版。所有色值、token、字号、间距均为占位或参考值，**不代表 luban 实际设计系统**。Agent 在落地前必须：
> 1. 在 `packages/ui/luban-ui` 源码中检索实际 token 定义（CSS 变量 / SCSS / design-tokens.ts）；
> 2. 找到后回填本文件，并把「待确认」标记替换为真实值；
> 3. 同步更新 `docs/UI_SPEC.md` 与 `scripts/check-design-tokens.mjs` 的 `TOKEN_COLORS_HEX` 白名单；
> 4. 找不到时不得臆造，须在 PR 中标注「需 luban-ui 设计 token 维护者确认」。

---

## 全局规则（Global Rules）

### 色板（Color Palette）

> 占位表。luban-ui 实际 token 提取后回填。

| 角色 | Hex（待确认） | CSS 变量（待确认） |
|------|--------------|-------------------|
| Primary（品牌主色） | `#2ECC71` ⚠️占位 | `--lb-color-primary` |
| Secondary（次色） | 待确认 | `--lb-color-secondary` |
| CTA / Accent | 待确认 | `--lb-color-cta` |
| Info（信息蓝，**不作主强调**） | 待确认 | `--lb-color-info` |
| Success | 待确认 | `--lb-color-success` |
| Warning | 待确认 | `--lb-color-warning` |
| Danger | 待确认 | `--lb-color-danger` |
| Background（页面铺底） | 待确认 | `--lb-bg-base` |
| Text（主文案） | 待确认 | `--lb-color-text` |
| Text Secondary（次要文案） | 待确认 | `--lb-color-text-secondary` |

**配色原则（与 `docs/UI_SPEC.md` §2 一致）**：
- 主交互、选中态、聚焦环、链接、价格强调、空状态按钮 → 用品牌主色及透明度变体。
- **禁止**用信息蓝（`--lb-color-info`）作组件主强调色。
- 语义色（success/warning/danger）保持语义独立，不混用。

### 字体（Typography）

- **字体栈（待确认）**：占位 `Inter + 系统中文字体栈`。须从 luban-ui typography 组件提取。
- **字号刻度（待确认）**：占位参考 `12 / 14 / 16 / 18 / 20 / 24 / 32 / 40 / 48 px`。
- **字重**：规范值 400 / 500 / 600 / 700，禁止 300 / 800 / 900 等非常用字重。
- **行高**：正文建议 1.5；标题待确认。

### 间距变量（Spacing Variables）

> 占位刻度（待 luban-ui 确认）。

| Token | 值（待确认） | 用途 |
|-------|-------------|------|
| `--lb-space-xs` | `4px` | 紧凑间隙 |
| `--lb-space-sm` | `8px` | 图标间隙、行内间距 |
| `--lb-space-md` | `16px` | 标准内边距 |
| `--lb-space-lg` | `24px` | 区块内边距 |
| `--lb-space-xl` | `32px` | 大间隙 |
| `--lb-space-2xl` | `48px` | 区块外边距 |
| `--lb-space-3xl` | `64px` | Hero 区内边距 |

### 阴影层级（Shadow Depths）

> 占位（待 luban-ui 确认）。

| 层级 | 值（待确认） | 用途 |
|------|-------------|------|
| `--lb-shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 轻微浮起 |
| `--lb-shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | 卡片、按钮 |
| `--lb-shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | 弹窗、下拉 |
| `--lb-shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero 图、特色卡片 |

### 圆角（Radius）

> 占位刻度（待 luban-ui 确认）。

| Token | 值（待确认） | 用途 |
|-------|-------------|------|
| `--lb-radius-sm` | `4px` / `8px` | 按钮、输入框 |
| `--lb-radius-md` | `12px` | 卡片 |
| `--lb-radius-lg` | `16px` | 弹窗、大卡片 |
| `--lb-radius-full` | `50%` / `9999px` | 圆形头像、胶囊 |

### 单位策略

- **统一 px / rem**（基于根字号），**禁止 rpx**（小程序专属，luban 不用）。
- 容器尺寸与字号单位策略须项目内一致（见 UI-CQ-005'）。

---

## 组件规范（Component Specs）

> 占位。具体组件（按钮、卡片、输入框、弹窗、表格、表单、物料）的 CSS 须从 luban-ui 实际实现提取，本节后续回填。

### 按钮（Buttons）

```css
/* TODO（待确认）：以下为占位，须从 luban-ui 按钮组件提取实际样式 */
.btn-primary {
  background: var(--lb-color-primary); /* 待确认 */
  color: white;
  padding: var(--lb-space-sm) var(--lb-space-md);
  border-radius: var(--lb-radius-sm);
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### 卡片（Cards）

```css
/* TODO（待确认）：luban-ui 卡片类名待回填（占位 .lb-card） */
.lb-card {
  background: var(--lb-bg-base); /* 待确认 */
  border-radius: var(--lb-radius-md);
  padding: var(--lb-space-lg);
  box-shadow: var(--lb-shadow-md);
  transition: all 200ms ease;
}
```

### 输入框（Inputs）

```css
/* TODO（待确认） */
.lb-input {
  padding: var(--lb-space-sm) var(--lb-space-md);
  border: 1px solid var(--lb-color-border, #E2E8F0); /* 待确认 */
  border-radius: var(--lb-radius-sm);
  font-size: 16px;
  transition: border-color 200ms ease;
}

.lb-input:focus-visible {
  border-color: var(--lb-color-primary);
  outline: none;
  box-shadow: 0 0 0 3px var(--lb-color-primary-soft, rgba(46, 204, 113, 0.2)); /* 待确认 */
}
```

### 弹窗（Modals）

```css
/* TODO（待确认） */
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: var(--lb-radius-lg);
  padding: var(--lb-space-xl);
  box-shadow: var(--lb-shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## 风格指引（Style Guidelines）

**风格（待确认）**：低代码编辑器风格 — 信息密度适中、工具感、可操作性优先。

**关键词（占位）**：专业、清晰、工具化、一致性、可访问、多端兼容

**适用场景**：低代码编辑器、SSR 站点、管理端、桌面端（electron）、移动端（flutter）

**关键效果（待确认）**：
- 区块化布局（16-24px 间隙）
- 一致的 hover / active 反馈（color shift + subtle lift）
- 200-300ms 过渡
- 大标题（24-32px+）
- 响应式断点：375px / 768px / 1024px / 1440px

### 页面模式（Page Pattern）

**模式名（占位）**：低代码编辑器三栏布局（物料区 | 画布 | 属性面板）

- **转换策略**：物料区清晰分类、画布所见即所得、属性面板即时反馈
- **CTA 放置**：顶部工具栏（保存 / 预览 / 发布）+ 右上角主操作
- **区块顺序**：1. 顶部工具栏，2. 左侧物料区，3. 中央画布（含预览切换），4. 右侧属性面板

---

## 反模式（Anti-Patterns，禁止使用）

- ❌ 重度拟物化（skeuomorphism）
- ❌ 忽略无障碍
- ❌ **emoji 作图标** — 须用 SVG 图标（Heroicons / Lucide 或 luban-ui 内置图标）
- ❌ **可点击元素缺 `cursor: pointer`**
- ❌ **hover 导致布局位移** — 避免 scale 变换引起重排
- ❌ **低对比度文字** — 维持 4.5:1 最小对比度
- ❌ **瞬态变化** — 须用过渡（150-300ms）
- ❌ **不可见焦点态** — 焦点态须可见以支持键盘导航
- ❌ **硬编码颜色** — 须用 luban-ui token（见 `scripts/check-design-tokens.mjs`）
- ❌ **rpx 单位** — luban 统一 px/rem，禁止小程序专属单位
- ❌ **混用单位做容器尺寸** — px 与 vh/vw/%/rem 混用导致不一致（见 UI-CQ-005'）
- ❌ **预览与发布渲染不一致** — 须用同一渲染器（见 UI-LC-003）
- ❌ **渲染异常白屏** — 须有错误边界 + 占位 + 可重试（见 UI-LC-006）

---

## 交付前检查清单（Pre-Delivery Checklist）

交付任何 UI 代码前，确认：

- [ ] 未用 emoji 作图标（用 SVG）
- [ ] 图标来自一致图标集
- [ ] 所有可点击元素有 `cursor: pointer`
- [ ] hover 态有平滑过渡（150-300ms）
- [ ] 浅色模式：文字对比度 ≥4.5:1
- [ ] 焦点态对键盘导航可见
- [ ] 响应 `prefers-reduced-motion`
- [ ] 响应式：375px / 768px / 1024px / 1440px
- [ ] 固定导航栏后无内容被遮挡
- [ ] 移动端无横向滚动
- [ ] 颜色使用 luban-ui token（运行 `node scripts/check-design-tokens.mjs` 无 error）
- [ ] 单位统一 px/rem，无 rpx
- [ ] 物料 props schema 合规（见 `.agents/rules/luban-material-schema.md`）
- [ ] 引擎产物在 Web SSR / electron / flutter 渲染一致
- [ ] 预览与发布渲染一致（同一渲染器）

---

## 与其他文档的关系

- **Agent 摘要**：`docs/UI_SPEC.md`（本主文档的精简版，供 Agent 快速对照）
- **视觉 token 强制器**：`.agents/skills/ui-spec-enforcer/SKILL.md`
- **UX + 产品审查**：`.agents/skills/ux-product-review/SKILL.md`（78 条 UI 规则）
- **Token 扫描脚本**：`scripts/check-design-tokens.mjs`
- **低代码引擎规范**：`docs/LOWCODE_ENGINE_SPEC.md`
- **物料 schema 规则**：`.agents/rules/luban-material-schema.md`
- **多端一致性**：`.agents/rules/luban-multi-client-consistency.md`

---

*文档版本：占位骨架版（2026-06-14）。luban-ui token 回填后请同步更新本文档、`docs/UI_SPEC.md`、`scripts/check-design-tokens.mjs`，并移除「待确认」标记。*
