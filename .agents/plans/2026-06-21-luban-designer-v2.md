---
planId: 2026-06-21-luban-designer-v2
title: Luban 设计器 v2：竞品刚需补齐 + 工程化 + E2E 全流程覆盖
createdAt: 2026-06-21
status: approved
type: plan
branchStrategy: 各子仓 feature/luban-designer-v2 同名分支；meta 仓 feature/luban-designer-v2
taskGraph: docs/superpowers/tasks/luban-designer-v2.json
gateTargets:
  engine: 0.85
  bff: 0.85
  website: 0.85
  ui: 0.90
  java: 0.80
  go: 0.75
loadedSkills:
  - .agents/skills/writing-plans/SKILL.md
  - .agents/skills/ux-product-review/SKILL.md
  - .agents/rules/luban-e2e-execution-contract.md
  - .agents/rules/luban-material-schema.md
  - .agents/rules/luban-lowcode-engine-quality.md
  - .agents/rules/luban-dual-backend-parity.md
  - docs/SYSTEM_ARCHITECTURE.md
---

> 正按 `writing-plans` + `PLAN_WRITING_CONTRACT.md` 输出。任务图 SSOT：`docs/superpowers/tasks/luban-designer-v2.json`（14 tasks, 6 waves, 已 node 校验合法）。
> **范围说明（用户决策）**：合并单份大 plan；除多人协作外全部纳入；P1 全选；P3 全选；完整 CMS。范围极大，按 wave 推进，wave 内并行、wave 间串行依赖。

---

## §0 需求追溯矩阵

| 上游需求 | 来源 | 映射 task | 验收门禁 |
|----------|------|-----------|----------|
| E2E 覆盖率 35%→≥85% | 本轮覆盖缺口分析 | V2-T0/V2-T13 | cypress 真绿，覆盖≥85% |
| 响应式断点编辑 | 竞品缺口（Webflow/Framer 标配） | V2-T4 | 三断点独立 style，SSR media-query |
| SEO 元信息 | 竞品缺口（上线必备） | V2-T2 | useSeoMeta 注入，每页可配 |
| 模板/区块库 | 竞品缺口（冷启动转化） | V2-T3 | 10-20 套模板，新建页可选 |
| 设计 token/主题系统 | Wave 1.5 plan 声明未做 | V2-T1 | 零硬编码 hex，CSS 变量换肤 |
| 动画/过渡系统 | 竞品缺口（Framer 最强） | V2-T5 | hover/scroll/in-view 动画 |
| Form 管理 UI | 探查确认完全缺（API 已就绪） | V2-T6 | 表单 CRUD + 去重规则可视化 |
| 完整 CMS 内容集合 | 竞品缺口（Webflow CMS 最强） | V2-T7 | collection 表 + 双后端 + 绑定渲染 |
| 版本历史/回滚 | Wave1 plan §10 声明 wave3 | V2-T8 | 快照 + 回滚，双后端 |
| 出码/导出静态站 | Wave1 plan §10 声明 wave3 | V2-T9 | zip 独立部署 |
| 分析埋点集成 | 竞品缺口（GA4/Pixel） | V2-T10 | 脚本注入 + 事件追踪 |
| 多选 + 批量操作 | 竞品缺口（框选/批量） | V2-T11 | 框选 + 批量移动/对齐/删除 |
| 拖拽对齐辅助线/吸附 | 竞品缺口（拖拽体验） | V2-T12 | 参考线 + 吸附 + 间距提示 |

## §0.1 明确不做（防膨胀）

| 不做项 | 理由（引用） |
|--------|--------------|
| 多人实时协作/CRDT | 用户明确排除（"除多人协作"） |
| Lead 状态/PII 脱敏 | 探查确认已完整（状态机+转换 UI+服务端脱敏），无需做 |
| AI 助手 | 已有独立 plan（luban-ai-assistant-*），不在本轮 |
| Go 后端 lead-capture | lead-capture plan §0.2 明确不做 |
| 侧边栏"设计器"一级菜单 | 用户已定维持现状 |
| modal focus-trap a11y | 既有 TODO，非本期 |
| 协作编辑/自定义物料市场/灰度发布 | Wave1 plan §10 声明 wave4，本轮不做（版本历史 V2-T8 仅做快照回滚，不含灰度） |

## §1 目标与非目标

**目标**：把 Luban 从"能用的低代码营销建站设计器"提升到"对标 Webflow/Framer 的竞品级产品"。补齐 6 类竞品刚需（响应式/SEO/模板/token/CMS/动画）+ 5 项工程化（版本/出码/埋点/多选/对齐线）+ Form 管理 UI，并把 E2E 覆盖率从 35% 拉到 ≥85%。

**非目标**：见 §0.1。

## §2 角色与场景

| 角色 | 场景 | 主链路 |
|------|------|--------|
| 搭建者 | 用模板快速起页 | 新建页 → 选模板 → 微调 → 发布 |
| 搭建者 | 做响应式适配 | 设计 desktop → 切 tablet/mobile → 独立调 style → 预览 |
| 搭建者 | 配 SEO/埋点 | 页面属性 → 填 SEO/OG → 站点设置填 GA4 ID → 发布 |
| 内容运营 | CMS 内容管理 | collection 管理 → 增内容项 → 组件绑定字段 → 发布自动渲染 |
| 营销人员 | 配留资表单去重 | Form 管理 → 建表单 → 配 dedupKeys(手机号) → LeadCapture 绑 formId |
| 管理员 | 版本回滚 | 页面历史 → 选版本 → 回滚 → 发布 |
| 访客 | 移动端访问 | 手机访问 → SSR 按 mobile 断点渲染 → 填表 → 生成 lead（去重+埋点） |

## §3 子系统总览

| 子系统 | 本期增量 |
|--------|----------|
| `ui/luban-ui` (luban-low-code) | NodeSchema 扩 responsive/animation/seo；2 renderer 断点+动画；调色板模板入口；对齐线；token CSS 变量层 |
| `ui/luban-ui` (luban-base) | 全物料去硬编码 hex→token；动画 propSchema |
| `engine/luban` | FeatureGate 扩；PropertyPanel 加 SEO/动画分区；模板选择器；断点切换器；FormList/FormConfig 视图；CMS 管理 UI；版本历史面板；出码导出；多选批量；埋点配置；E2E 全覆盖 |
| `web/luban-website` | useSeoMeta 注入；GA4/Pixel 脚本；响应式 media-query 渲染；CMS 绑定渲染 |
| `bff/luban-bff` | collection/版本/SEO/埋点配置 代理路由 |
| `backend` (Java) | collection 表+CRUD（Flyway）；page_versions 快照表；site/page SEO+analytics 字段；collection/版本 API |
| `backend` (Go) | 与 Java 同接口双实现（collection/版本；lead 仍不做） |
| `client/*` | 本轮不涉及 |

## §4 前端页面结构与设计展示

### §4.0 入口表

| 入口 | 路由 | 承载 | 本期变化 |
|------|------|------|----------|
| 运营后台 | `/dashboard` 等 | DefaultLayout | 侧边栏加「表单管理」「CMS 内容」两项 |
| 设计器全屏 | `/designer/...` | DesignerLayout | 顶栏加断点切换器 + 模板入口 + 历史入口 + 导出入口 |
| （已有）页面列表 | `/sites/:siteId/pages` | PageList | 新建页时弹模板选择器 |
| （新）表单管理 | `/sites/:siteId/forms` | FormList | 本期新增 |
| （新）表单配置 | `/sites/:siteId/forms/:id` | FormConfig | 本期新增 |
| （新）CMS 内容 | `/sites/:siteId/collections` | CollectionList | 本期新增 |
| （新）版本历史 | `/sites/:siteId/pages/:pageId/history` | VersionHistory | 本期新增（弹层或独立路由） |
| website SSR | `/{slug}/{path}` | DynamicPage | useSeoMeta + 埋点 + 响应式 |

### §4.1 设计器增强（顶栏 + 属性面板 + 画布）

```
设计器顶栏（新增按钮）：
[返回] [页名] [状态] | [断点:💻desktop 📱tablet 📱mobile] | [撤销↶][重做↷] | [模板][历史][导出] | [预览][保存][发布]

属性面板（新增分区）：
基础属性 | 样式(5组,per-breakpoint) | 动画(新) | 事件 | 数据源 | SEO(页面级,新)
                                   ↑ 断点切换时样式分区标题显示当前断点

画布（新增）：
- 断点切换时画布宽度模拟（desktop=100%/tablet=768px/mobile=375px）
- 拖动时显示对齐参考线（兄弟/父边缘）+ 吸附 + 间距数值
- 框选多节点（shift+点击 或 拖框）→ 批量操作浮动条
```

### §4.2 关键页面结构

> 本期新增多个页面（FormList/FormConfig/CollectionList/VersionHistory）。结构清晰、控件标准 Element Plus，可由文字约束稳定开发，无需高保真原型。模板选择器为弹层（ElDialog + 模板缩略图网格）。

## §5 数据模型与契约

### §5.1 NodeSchema 扩展

```ts
// V2-T1/T4/T5 扩展（向后兼容，全部可选字段）
export interface NodeSchema {
  // ...现有字段...
  style?: Record<string, string>;
  className?: string;
  /** V2-T4 响应式：per-breakpoint style 覆盖（desktop 为默认，tablet/mobile 覆盖） */
  responsive?: { tablet?: Record<string,string>; mobile?: Record<string,string> };
  /** V2-T5 动画：入场/hover/scroll 触发 */
  animation?: NodeAnimation;
}
export interface NodeAnimation {
  type?: 'fade' | 'slide-up' | 'slide-left' | 'zoom' | 'flip';
  duration?: number;   // ms
  delay?: number;      // ms
  easing?: string;     // CSS easing
  trigger?: 'in-view' | 'hover' | 'load';
  scrollRepeat?: boolean;
}
/** V2-T2 SEO（PageSchema 级，非 NodeSchema） */
export interface PageSchema {
  root: NodeSchema;
  formState?: Record<string, unknown>;
  seo?: PageSeo;  // V2-T2 新增
}
export interface PageSeo {
  title?: string;
  description?: string;
  keywords?: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  canonical?: string;
}
```

### §5.2 双后端契约一致性声明（MUST）

本期**新增多个后端接口**，Java 与 Go **必须双端实现且行为一致**：
- **V2-T7 CMS**：`/collections`（CRUD）、`/collections/:id/items`（CRUD）— Java+Go 双端
- **V2-T8 版本**：`/pages/:id/versions`（list）、`/pages/:id/versions/:vid`（get/rollback）— Java+Go 双端
- **V2-T2 SEO**：`pages`/`sites` 表加 `seo`/`analytics_config` JSON 字段 — Java+Go 双端
- **V2-T10 埋点**：`sites` 表加 `analytics_config`（GA4/Pixel ID）— Java+Go 双端
- **lead 端点仍仅 Java**（lead-capture plan §0.2 Go 不做）

响应体字段、错误码、状态机 Java/Go 必须一致。Contract test 覆盖（workspace e2e/contract/dual-backend.spec.ts 扩展）。

### §5.3 FeatureGate 扩展

engine `src/config/features.ts` 新增开关：
- `responsive`（V2-T4 样式 per-breakpoint）
- `animation`（V2-T5 动画分区）
- `seo`（V2-T2 SEO 分区）
- `templates`（V2-T3 模板入口）
- `cms`（V2-T7 CMS 入口）
- `forms`（V2-T6 表单管理入口）
- `versionHistory`（V2-T8 历史入口）
- `export`（V2-T9 出码入口）
- `analytics`（V2-T10 埋点配置）
- `multiSelect`（V2-T11 多选）
- `alignGuides`（V2-T12 对齐线）

默认全开。env `VITE_FEATURE_*` 关闭。回滚首选手段。

## §6 TDD 与测试计划

### §6.1 TDD 先行

| task | 先写测试 | 关键断言 |
|------|----------|----------|
| V2-T1 token | grep 断言零硬编码 hex | material-parity 扩 |
| V2-T2 SEO | website SSR HTML 断言 meta | og:title/description 出现 |
| V2-T4 响应式 | renderer 断言 media-query 输出 | 三断点 CSS 生成 |
| V2-T5 动画 | renderer 断言 animation class | 触发条件正确 |
| V2-T7 CMS | 双后端 contract test | collection CRUD 字段一致 |
| V2-T8 版本 | 双后端 contract test | 快照存取一致 |
| V2-T0/T13 E2E | cypress 红→绿 | 覆盖率门禁 |

### §6.2 覆盖率门禁

ui 行≥90%，engine/bff/website 行≥85%，java 行≥80%，go 行≥75%。

## §7 E2E 用例枚举（Cypress + workspace root）

V2-T0 补齐现有缺口（详见覆盖分析报告），V2-T13 补齐新功能。关键新用例：
- **访客 LeadCapture 真实提交闭环**（V2-T0 最高价值）：website 填表 → 提交 → 断言 leads 列表出现新行
- **响应式断点**：切 mobile → 配 style → 预览 mobile 视口渲染
- **模板**：新建页选模板 → 断言 schema 加载
- **CMS**：建 collection → 绑定组件 → 发布 → SSR 循环渲染
- **版本回滚**：保存多版本 → 回滚 → 断言 schema 复原
- **出码**：导出 zip → 断言含 index.html
- **Form 管理**：建表单 → 配 dedupKeys → 提交重复手机号 → 断言去重

**门禁**：cypress 真绿，禁假绿/禁降级（luban-e2e-execution-contract）。

## §8 实现阶段并行 Task 线

| wave | 可并行 subagent | 依赖 |
|------|----------------|------|
| **0** | V2-T0（E2E 补齐，engine） | 无 |
| **1** | V2-T1（token, ui）+ V2-T2（SEO, cross） — 2 并行 | 无 |
| **2** | V2-T3（模板, engine, 依T1）+ V2-T4（响应式, cross, 依T1） — 2 并行 | wave1 |
| **3** | V2-T5（动画, ui, 依T1）+ V2-T6（Form UI, engine）+ V2-T7（CMS, cross, 依T1） — 3 并行 | wave2 |
| **4** | V2-T8（版本, cross）+ V2-T9（出码, engine, 依T4）+ V2-T10（埋点, cross, 依T2）+ V2-T11（多选, engine）+ V2-T12（对齐线, ui） — 5 并行 | wave3 |
| **5** | V2-T13（最终 E2E 全覆盖） | wave4 全部 |

**执行硬约束**（/plan-template §5）：本轮 14 个 task 须**连续推进至全部就绪+验证全绿**后做一次完成汇报。禁止部分完成即宣称交付；遇阻塞列残余项，禁止假装完成。

## §8.1 分级验收门禁表

| 级别 | 验证方式 | 通过条件 |
|------|----------|----------|
| 1 代码质量 | `/luban-review` 全自动审查 | 🔴🟡🔵 清零（先行） |
| 2 安全审查 | 敏感字段自查（见 §8.2） | 无新增泄露；CMS/版本/埋点无越权 |
| 3 单测+覆盖率 | 各包 build+test（ui≥90%/engine≥85%/java≥80%/go≥75%） | 全绿达标 |
| 4 E2E | cypress + workspace root playwright | V2-T0+T13 真绿，覆盖≥85% |

### §8.2 敏感字段清单

| 字段 | 位置 | 策略 |
|------|------|------|
| GA4/Pixel ID | site.analytics_config | 非敏感（公开 ID），明文存储 |
| CMS 内容 | collection items | 按站点隔离；无敏感默认 |
| 版本快照 | page_versions.schema | 含历史 schema，按站点+page 隔离 |
| Lead（既有） | leads 表 | 复用现有去重+加密（不改动） |

**安全自查**：CMS/版本 API 须站点级鉴权（admin-only 写）；公开读仅限已发布页面。

### §8.3 FeatureGate 开关设计

11 个新开关（见 §5.3），默认全开，env 关闭即隐藏对应 UI。回滚首选：任一功能出问题设 env 关闭，无需回滚代码。

### §8.4 多端渲染一致性声明

V2-T1/T4/T5 的渲染变更在 luban-low-code（canonical renderer）。website（RuntimeRenderer）自动获得。engine 设计态（DesignRenderer）与 website 运行态须一致（断点/动画/token）。client 本期不涉及。

### §8.5 Post-Development Workflow

```
代码提交（各子仓 feature/luban-designer-v2）
  → /luban-review 清零（先行）
  → ui/engine/website/bff build + test（覆盖率达标）
  → Java mvn verify + Go go test（双后端 contract）
  → 询问用户后跑 cypress + workspace playwright
  → 覆盖率汇总 ≥85%
  → 完成汇报（保留命令与输出证据）
```

### §8.6 质量禁令自检表

| 禁令 | 措施 |
|------|------|
| 禁跳过功能 | §0 矩阵逐条 task+E2E |
| 禁假绿 | E2E 失败即修 |
| 禁占位 | 无 TODO/假文案 |
| 禁骨架 | 每功能完整链路 |
| 禁 JSON 替代页面 | CMS/模板/Form 均可视化 UI |
| 页面交互完整 | §4.2 逐页结构 |
| 验收以可交付为准 | 真实页面完整链路 |
| 引擎渲染 E2E 绑正式路由 | 全正式路由 |
| 门禁分级 | §8.1 四级 |
| /luban-review 清零 | §8.5 先行 |
| 安全审查 | §8.2 |
| 双后端契约 | §5.2 |
| 多端渲染一致 | §8.4 |
| FeatureGate 默认约束 | §8.3 |

## §9 实现任务派发（并行 subagent 已扫描代码库填充）

> 本节由 3 个并行 subagent（ui / engine+website / backend+bff）codegraph 搜索代码库产出，主会话合并去重 + 一致性校验。

### §9.1 文件变更总览

#### ui 子系统（luban-base + luban-low-code）

| taskID | file | new/modify | summary |
|--------|------|-----------|---------|
| V2-T1 | `luban-base/src/styles/_variables.scss` | modify | `$lb-*` 定义下追加 `:root { --lb-*:#{$lb-*} }` 自定义属性层（保留 `!default`） |
| V2-T1 | `luban-base/src/theme/{theme.ts,types.ts,presets.ts}` | **new×3** | 运行时主题 API：applyTheme/resetTheme/getCurrentTheme/onThemeChange；LubanThemeTokens 类型；light/dark 预设 |
| V2-T1 | `luban-base/src/index.ts` | modify | 导出 theme 模块 |
| V2-T1 | `luban-base/src/lib/{content,marketing}/*.vue`（13 组件）+ `styles/{button,form}.scss` + `LubanSidePanel.vue` | modify | 去硬编码 hex→`var(--lb-*)`（Hero/CTA/LeadCapture/Testimonial/9 营销组件，共 ~60 处 hex） |
| V2-T1 | `luban-low-code/src/lib/DesignRenderer.vue` | modify | scoped style 硬编码色（#1e88e5/#9ca3af/rgba）→ var |
| V2-T4 | `luban-low-code/src/lib/schema.ts` | modify | NodeSchema +`responsive?:NodeResponsive`；+NodeResponsive/ResponsiveOverride/ResponsiveBreakpoint 接口 |
| V2-T4 | `luban-low-code/src/lib/{responsive.ts,responsiveStyle.ts}` | **new×2** | BREAKPOINTS 定义+resolveResponsiveProps 合并+toResponsiveCss 输出 @media |
| V2-T4 | `DesignRenderer.vue`/`RuntimeRenderer.vue`/`LubanDesigner.vue`/`LubanPage.vue` | modify | +breakpoint/viewport prop，按断点合并 style，CSS media-query 注入 |
| V2-T4 | `luban-low-code/test/unit/responsive.spec.ts` | new | 三断点合并优先级 + @media 输出单测 |
| V2-T5 | `luban-low-code/src/lib/schema.ts` | modify | NodeSchema +`animation?:NodeAnimation`；+NodeAnimation/AnimationType/AnimationTrigger |
| V2-T5 | `luban-low-code/src/lib/{animation.ts,animationObserver.ts}` | **new×2** | type→@keyframes 映射+buildAnimationCss；IntersectionObserver composable（scroll 触发/scrollRepeat） |
| V2-T5 | `RuntimeRenderer.vue`/`DesignRenderer.vue` | modify | 注入动画 CSS（按 nodeId 去重）+设计态预览 |
| V2-T5 | `defineMaterial.ts`/`compat.ts`/`componentMeta.ts` | modify | MaterialDefinition +`animation?` 能力声明；ComponentMeta.animation 透出 |
| V2-T5 | `materials/**/material.ts`（button/hero/cta/text/banner 5 个默认启用） | modify | 声明 animation triggers |
| V2-T5 | `luban-low-code/test/unit/animation.spec.ts` | new | buildAnimationCss 合法性 + IO 重置单测 |
| V2-T12 | `luban-low-code/src/lib/align/{useAlignGuides.ts,types.ts,AlignOverlay.vue,guideMath.ts}` | **new×4** | composable+纯函数+SVG overlay（参考线/吸附/间距） |
| V2-T12 | `DesignRenderer.vue`/`LubanDesigner.vue` | modify | Sortable onMove 接 useAlignGuides；顶栏"显示对齐线"开关 |
| V2-T12 | `luban-low-code/test/unit/guideMath.spec.ts` | new | computeGuides/computeSnap/computeSpacingHints 单测 |

#### engine 子系统

| taskID | file | new/modify | summary |
|--------|------|-----------|---------|
| V2-T2 | `src/api/page.ts` | modify | PageMeta +`seo?:PageSeoMeta`；+PageSeoMeta 接口；SavePagePayload 同步 |
| V2-T2 | `src/views/page/components/PropertyPanel.vue` | modify | +SEO 折叠分区（page 级）+update:page-seo emit |
| V2-T2 | `src/views/page/PageEditor.vue` | modify | 接 update:page-seo；save/publish 透传 seo |
| V2-T3 | `src/views/page/components/TemplatePicker.vue` | **new** | ElDialog+缩略图网格；emit select(template) |
| V2-T3 | `src/config/templates.ts` | **new** | 10-20 模板定义（{id,name,thumbnail,schema}[]） |
| V2-T3 | `src/views/page/PageList.vue` | modify | goNew() 改为先开 TemplatePicker |
| V2-T6 | `src/views/form/{FormList.vue,FormConfig.vue}` | **new×2** | 表单列表+配置（dedupKeys/dedupWindow/dedupPolicy/antiSpam 可视化）；api/form.ts 已就绪 |
| V2-T6 | `src/router/index.ts`/`src/layouts/DefaultLayout.vue` | modify | +/forms 路由+侧边栏"表单管理" |
| V2-T9 | `src/utils/exportStatic.ts` | **new** | schema→静态 HTML/CSS/JS zip |
| V2-T9 | `src/views/page/PageEditor.vue` | modify | +导出按钮 |
| V2-T10 | `src/api/site.ts`/`src/views/site/SiteDetail.vue` | modify | Site +analytics；GA4/Pixel ID 配置表单 |
| V2-T11 | `src/views/page/PageEditor.vue`/`ComponentTree.vue` | modify | +selectedIds 多选+批量操作；ComponentTree 多选联动 |
| V2-T0/T13 | `cypress/e2e/{designer-multiselect,page-seo-templates-export,forms}.cy.ts` | **new×3** | 多选/SEO-模板-导出/Form CRUD E2E |

#### website 子系统

| taskID | file | new/modify | summary |
|--------|------|-----------|---------|
| V2-T2 | `views/DynamicPage.vue` | modify | useHead→useSeoMeta（title/description/og*/robots）+canonical link |
| V2-T2 | `nuxt.config.ts` | modify | +app.head 默认（titleTemplate/viewport/charset） |
| V2-T10 | `plugins/analytics.client.ts`/`composables/useSiteAnalytics.ts` | **new×2** | GA4/Pixel 脚本注入+track()；拉站点 analytics 配置 |

#### Java 后端 + Go 后端 + BFF

| taskID | file | new/modify | summary |
|--------|------|-----------|---------|
| V2-T7 | Java `controller/{Collection,CollectionItem}Controller.java` + service/mapper/entity/dto | **new** | collection+items CRUD（对齐 FormController 风格） |
| V2-T7 | Go `internal/{handler,service,repository,model}/collection*.go` | **new** | 双实现（json.RawMessage，禁 []byte） |
| V2-T7 | BFF `src/app/api/collections/**/route.ts` | **new** | thin proxy（透传，无字段变换） |
| V2-T8 | Java `controller/PageVersionController.java` + service/mapper/entity/dto；PageService.save 触发快照 | **new+modify** | 版本 list/get/rollback |
| V2-T8 | Go `internal/{handler,service,repository,model}/page_version*.go`；page_service 快照注入 | **new+modify** | 双实现 |
| V2-T8 | BFF `src/app/api/sites/[siteId]/pages/[pageId]/versions/**/route.ts` | **new** | list/get/rollback 透传 |
| V2-T2 | Java/Go `Page`/`Site` entity+mapper+dto+service +`seo_json` | modify | SEO 字段（JSON） |
| V2-T2 | Go `page_repo`/`site_repo` `SELECT *`→显式列名 | modify | **关键**：RawMessage 列顺序敏感 |
| V2-T2 | BFF sites/pages route.ts | modify | body 透传 seo |
| V2-T10 | Java/Go `Site` entity+mapper+dto+service +`analytics_config_json` | modify | 埋点配置字段 |
| V2-T10 | BFF sites route.ts + public by-path | modify | 透传 analyticsConfig |
| 全部 | Java Flyway `V2026062100000{1-4}__*.sql`（4 文件）+ Go `dao/mysql.go initSchema` | **new+modify** | 见 §9.3 |
| V2-T7/T8 | Java `AuthFilter.java` + Go `router.go` RequireAdmin | modify | collections 写 admin-only；versions rollback admin-only |

### §9.2 API 契约（双后端字段对字段一致）

**V2-T7 CMS**（新端点，Java+Go 双端）：
- `GET/POST /collections?siteId=` · `GET/PUT/DELETE /collections/{id}?siteId=` · `GET/POST /collections/{id}/items?siteId=&page=&size=` · `GET/PUT/DELETE /collections/{id}/items/{itemId}?siteId=`
- 写操作 RequireAdmin，读 RequireUser；siteId tenant guard
- CollectionSaveRequest: `{siteId,name,fieldSchema,status}` · CollectionResponse: `{id,siteId,name,fieldSchema,status,createdAt,updatedAt}`
- CollectionItemSaveRequest: `{data}` · CollectionItemResponse: `{id,collectionId,data,status,createdAt,updatedAt}`
- 错误码：COLLECTION_NOT_FOUND/COLLECTION_NAME_CONFLICT/COLLECTION_ITEM_NOT_FOUND

**V2-T8 版本历史**（新端点，Java+Go 双端）：
- `GET /sites/{siteId}/pages/{pageId}/versions?page=&size=` · `GET /sites/{siteId}/pages/{pageId}/versions/{versionId}` · `POST /sites/{siteId}/pages/{pageId}/versions/{versionId}/rollback`
- rollback 语义（双端一致）：读 versionId 的 schema → 覆盖 page.schema_json → **新建**一条 version（versionNo 自增）→ 返回 201 新版本（复制语义非指针）
- PageVersionListResponse（不含 schema）· PageVersionResponse（含 schema）· 错误码 PAGE_VERSION_NOT_FOUND

**V2-T2 SEO**（既有端点字段扩展，无新端点）：
- PageSaveRequest/PageResponse/SiteCreateRequest/SiteResponse +`seo?:{title,description,keywords,ogTitle,ogDescription,ogImage,canonical,noIndex}`
- 公开 `/public/sites/{slug}/pages?path=` 返回体下发 seo（website useSeoMeta 注入）

**V2-T10 埋点**（既有端点字段扩展，无新端点）：
- SiteCreateRequest/SiteResponse +`analyticsConfig?:{ga4:{measurementId},pixel:{pixelId},customScripts,events:{pageView,leadSubmit,ctaClick}}`
- 公开端点下发 analyticsConfig（website 注入脚本）

**BFF 全部 thin proxy**（透传，无字段变换；仅访客公开端点 forms/submit 剥 leadId 的既有特例保留）。

### §9.3 数据库变更（DDL）

Flyway 秒级时间戳 `V2026062100000{1-4}`；Go `dao/mysql.go initSchema` 列名/约束名严格对齐。

**V20260621000001__add_collections.sql**（V2-T7）：
```sql
CREATE TABLE collections (
  id VARCHAR(36) PRIMARY KEY, site_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL, field_schema_json JSON NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_collections_site_name (site_id, name),
  CONSTRAINT fk_collections_site FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
CREATE TABLE collection_items (
  id VARCHAR(36) PRIMARY KEY, collection_id VARCHAR(36) NOT NULL,
  data_json JSON NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'active',
  created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_items_collection FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  KEY idx_items_collection_status (collection_id, status), KEY idx_items_updated (collection_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**V20260621000002__add_page_versions.sql**（V2-T8）：
```sql
CREATE TABLE page_versions (
  id VARCHAR(36) PRIMARY KEY, page_id VARCHAR(36) NOT NULL,
  version_no INT NOT NULL, schema_json JSON NOT NULL, summary VARCHAR(255),
  created_by VARCHAR(36), created_at DATETIME(3) NOT NULL,
  CONSTRAINT fk_versions_page FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  UNIQUE KEY uk_page_version (page_id, version_no), KEY idx_versions_page_created (page_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
（保留策略：每页最近 50 版，应用层 deleteOlderThan 清理）

**V20260621000003__add_seo_columns.sql**（V2-T2）：
```sql
ALTER TABLE pages ADD COLUMN seo_json JSON NULL AFTER schema_json;
ALTER TABLE sites ADD COLUMN seo_json JSON NULL AFTER base_url;
```

**V20260621000004__add_site_analytics_config.sql**（V2-T10）：
```sql
ALTER TABLE sites ADD COLUMN analytics_config_json JSON NULL AFTER seo_json;
```

> Go 端 ALTER 兜底：MySQL 8.0+ 用 `ADD COLUMN IF NOT EXISTS`；5.7 需 INFORMATION_SCHEMA 探测。[待确认] 统一 MySQL 8.0（与 JSON 类型依赖一致）。

### §9.4 物料 schema（NodeSchema/PageSchema 扩展）

见 plan §5.1（NodeAnimation/NodeResponsive/PageSeo 完整接口已定义）。要点：
- NodeResponsive：tablet/mobile 浅合并 desktop（非深合并），resolveResponsiveProps 按 desktop→tablet→mobile 折叠
- NodeAnimation：type 映射 @keyframes，trigger 区分 scroll(hover/on-select/on-load)，scrollRepeat 控制重播
- MaterialAnimationSchema（物料能力声明）与 NodeSchema.animation（节点运行时值）分离：能力约束面板选项
- PageSeo 归属 low-code（PageSchema.seo），engine re-export 透明消费

### §9.5 组件接口（关键签名）

**Theme API**（luban-base/src/theme/theme.ts）：
```ts
applyTheme(tokens: Partial<LubanThemeTokens>): void
applyThemePreset(name: LubanThemeName): void
resetTheme(): void
getCurrentTheme(): Readonly<LubanThemeTokens>
onThemeChange(cb): () => void
```

**Renderer 新 props**：
```ts
DesignRenderer: +breakpoint?:'desktop'|'tablet'|'mobile'; +showAlignGuides?:boolean
RuntimeRenderer: +viewport?:'desktop'|'tablet'|'mobile'|'auto'  // auto=ResizeObserver
```

**Align-Guide composable**：
```ts
useAlignGuides(draggedEl, {threshold?,showSpacing?,siblings?}): {lines,spacingHints,onDrag,clear}
// 纯逻辑 guideMath.ts: computeGuides/computeSnap/computeSpacingHints（可绕 DOM 单测）
```

**engine 新视图**：FormList/FormConfig（props 从 route.params；emit edit/view-leads/saved）；TemplatePicker（v-model + emit select）；CollectionList/VersionHistory（[待确认] 后端端点就绪后建）；PropertyPanel +update:page-seo emit；PageEditor +breakpoint/export/selectedIds/template handler。

**website**：useSeoMeta（title/description/og*/robots）+canonical link；analytics plugin（useScript 注入 GA4/Pixel + $analytics.track）。

### §9.6 并行派发计划（基于 taskGraph dependsOn）

| wave | 可并行 subagent | 依赖 |
|------|----------------|------|
| **0** | V2-T0（E2E 补齐, engine） | 无 |
| **1** | V2-T1（token, ui）+ V2-T2（SEO, cross） — 2 并行 | 无 |
| **2** | V2-T3（模板, engine, 依T1）+ V2-T4（响应式, cross, 依T1） — 2 并行 | wave1 |
| **3** | V2-T5（动画, ui, 依T1）+ V2-T6（Form UI, engine）+ V2-T7（CMS, cross, 依T1） — 3 并行 | wave2 |
| **4** | V2-T8（版本, cross）+ V2-T9（出码, engine, 依T4）+ V2-T10（埋点, cross, 依T2）+ V2-T11（多选, engine）+ V2-T12（对齐线, ui） — 5 并行 | wave3 |
| **5** | V2-T13（最终 E2E 全覆盖） | wave4 全部 |

**一致性校验结果**：
- ✅ 所有文件路径经 codegraph/Grep/Read 确认存在或标注 new
- ✅ DDL 表名/约束名 Java Flyway ↔ Go initSchema 严格对齐
- ✅ API 端点 Java/Go 字段对字段一致（双后端契约 §5.2）
- ✅ BFF 全 thin proxy 无字段变换（除既有 lead submit leadId 剥离）
- ✅ JSON 列 Go 用 json.RawMessage（禁 []byte，避 base64 坑）
- ⚠️ Go page_repo/site_repo `SELECT *` 必须改显式列名（V2-T2 SEO 加列后）
- ⚠️ Go ALTER 兜底策略 [待确认] MySQL 版本（建议统一 8.0）
- ⚠️ PageSeo 归属 low-code PageSchema（engine re-export 透明消费）
- ⚠️ V2-T9 出码策略 [待确认]（纯 client 字符串化 vs BFF 端点）
