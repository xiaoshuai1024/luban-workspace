---
planId: 2026-06-20-luban-designer-wave15
title: Luban 设计器 Wave 1.5：精细样式系统 + 营销建站组件全量目录 + LeadCapture 闭环 + Cypress 全链路 E2E
createdAt: 2026-06-20
status: approved
type: plan
branchStrategy: 各子仓 feature/luban-designer-wave15 同名分支；meta 仓 feature/luban-designer-wave15
taskGraph: docs/superpowers/tasks/luban-designer-wave15.json
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
---

> 正按 `writing-plans` + `PLAN_WRITING_CONTRACT.md` 输出。任务图 SSOT：`docs/superpowers/tasks/luban-designer-wave15.json`（已落盘，本 plan 文首 `taskGraph` 字段已同步）。

---

## §0 需求追溯矩阵

| 上游需求 | 来源 | 映射 task | E2E 场景 | 验收门禁 |
|----------|------|-----------|----------|----------|
| 样式属性面板（color/margin/padding/typography/border/background） | todo `2026-06-19-w1-t7-style-panel` | D15-A1/A2/A3 | F1 样式配置→实时预览→撤销 | 画布实时变化+撤销栈 |
| 数据源「管理数据源」+「测试连通」 | review R2 §4.3 | D15-B1 | F1 弹窗 CRUD+连通结果 | CRUD 写入+连通显示 ok/message/latencyMs |
| PropertyPanel 四态（加载/空/错/成功） | review R3 §4.3 | D15-B2 | F1 错误卡片+重试 | 四态可触发 |
| ComponentTree 锁定/隐藏 + L/H 快捷键 | review Y3 §4.2#7 | D15-C1 | F1 锁定删禁用+L 键 | locked 删禁用+快捷键生效 |
| FeatureGate 开关系统 | wave1 §6.5（计划标记完成但代码缺失） | D15-D1 | 单测+env 关闭 UI 隐藏 | 默认全开+关闭时隐藏 |
| 扩展营销/建站组件目录 | 用户「增加营销和搭建网站所需的组件」 | D15-E1/E4 | F2 营销组装落地页 | 9 新组件渲染+7 组调色板 |
| 升级现有营销组件（LeadCapture 等） | 用户「扩展现在的组件」 | D15-E2 | F3 LeadCapture 提交闭环 | 4 组件升级生效 |
| LeadCapture 接 LubanForm 提交链路 | 用户「真正可用」+ 讨论稿决策 | D15-E3 | F3 website SSR 闭环 | POST /forms/:id/submit 生成 lead |
| 可视化数组编辑器 | 用户「真正可用」+ 讨论稿决策 | D15-E0 | F2 数组编辑器交互 | object-item array 不降级 json |
| Cypress E2E 保证设计器功能 | 用户「通过端到端测试保证」 | D15-F1/F2/F3 | 三条 spec 真绿 | cypress run 真绿 |
| 精细样式（要用户可直接使用） | 用户「样式需要比较精细」 | D15-A3 全量 5 组 | F1 实时预览 | 5 组控件全配可预览 |

## §0.1 明确不做（防膨胀）

| 不做项 | 理由（引用） |
|--------|--------------|
| 侧边栏「设计器」一级菜单 | 用户 AskUserQuestion 答案「维持现状仅修复」 |
| `:root --lb-*` CSS 变量运行时主题层 | 用户未选「主题 token 迁移」；新组件仅用 `$lb-*` SCSS 变量 |
| modal focus-trap a11y | 既有 TODO，非本期（LubanModal.vue:9） |
| 协作编辑/CRDT/出码/模板库/版本历史/灰度 | wave1 §10 已声明属 wave 3/4 |
| backend-go lead-capture 实现 | lead-capture plan §0.2 已声明不做（现有 Java 端单端） |
| 数组可视化编辑器的「嵌套数组」支持（如 LubanMenu children） | v1 仅扁平对象数组；LubanMenu 等递归数组保留 json 编辑（防膨胀） |
| 物料设计 token `:root` 变量化 + 暗色主题 | 同上，本期 SCSS 变量足够 |
| 预览模式内可提交（engine preview） | 现有架构 submit 由 website 端 provide；engine preview 仅样式/数据预览，不含真实提交（避免误触发生成 lead） |

## §1 目标与非目标

**目标**：交付真正可用的低代码营销建站设计器——用户可在 `/designer/...` 全屏设计器内：拖拽营销组件 → 用可视化编辑器配置数组 props → 用精细样式面板调样式 → 配数据源/事件 → 组装完整落地页 → 发布 → 在 website SSR 站点访问看到渲染结果。Cypress E2E 覆盖全链路。

**非目标**：见 §0.1。

## §2 角色与场景

| 角色 | 场景 | 主链路 |
|------|------|--------|
| 运营/搭建者 | 搭建营销落地页 | 进设计器 → 拖 Navbar/Hero/FeatureGrid/Pricing/FAQ/Footer → 配数组 props + 样式 → 保存 → 发布 |
| 运营/搭建者 | 配置表单留资 | 拖 LeadCapture → 配 formId + 字段 → 发布 → 访客提交生成 lead |
| 运营/搭建者 | 精细化样式调整 | 选中节点 → 样式面板调背景/边框/排版/间距/阴影 → 实时预览 → 撤销 |
| 管理员 | 管理数据源 | 选中节点 → 数据源区 → 管理弹窗 CRUD → 测试连通 → 绑定 |

## §3 子系统总览

| 子系统 | 本期增量 |
|--------|----------|
| `ui/luban-ui` (luban-low-code) | NodeSchema +style/className；2 renderer 样式接线；PropSchemaItem +array/itemFields；compat.ts 重映射；palette.ts 重组 7 组；materials 注册 9 新物料；LeadCapture 提交链路接线（RuntimeRenderer + material + website DynamicPage） |
| `ui/luban-ui` (luban-base) | +9 营销组件 Vue（Navbar/Footer/FeatureGrid/Stats/FAQ/Pricing/TestimonialCarousel/Gallery/LogoCloud）；升级 4 个（LeadCapture/Hero/CTA/Testimonial）；4 个营销组件 token 化 |
| `engine/luban` | FeatureGate(`config/features.ts`)；PropertyPanel 样式分区+数组控件+数据源 CRUD 弹窗+测试连通+四态；ComponentTree 锁定/隐藏；useKeyboard L/H；cypress 3 条 spec |
| `web/luban-website` | DynamicPage `extractSubmitConfig` 扩展支持 LubanLeadCapture（formId 提取）|
| `bff/luban-bff` | **无**（复用现有 `POST /api/forms/:id/submit`）|
| `backend` (Java) | **无**（复用现有 `/lead/forms/:id/submit`）|
| `backend` (Go) | **无**（lead-capture §0.2 不做 Go）|
| `client/*` | **本轮不涉及** |

## §4 前端页面结构与设计展示

### §4.0 入口表

| 入口 | 路由 | 承载 |
|------|------|------|
| 设计器全屏页 | `/designer/sites/:siteId/pages/:pageId` | PageEditor.vue（isDesignerMode） |
| 设计器新建页 | `/designer/sites/:siteId/pages/new` | 同上 |
| （已有）站点页面列表 | `/sites/:siteId/pages` | PageList.vue（唯一入口） |
| （已有）website SSR | `/{slug}/{path}` | DynamicPage.vue |

> 本期**不新增路由**。设计器入口维持现状（PageList → 编辑/新建）。Cypress E2E 路由合规：F1/F2 用 `/sites/:siteId/pages/:pageId`（in-admin 编辑器，与现有 designer.cy.ts 一致）+ 全屏 `/designer/...` 至少一条用例；F3 闭环到 website 正式路由 `/{slug}/{path}`。**无新增 `pages/e2e/*` 专测页**。

### §4.1 设计器三栏工作区（已有，本期增强）

```
┌─────────────────────────────────────────────────────────────┐
│ 浮动顶栏（designer 模式）：返回 | 页名 | 状态 | 撤销/重做/预览/保存/发布 │
├──────────┬────────────────────────────────┬──────────────────┤
│ 左：物料  │ 中：画布（LubanDesigner/LubanPage）│ 右：组件树+属性面板 │
│ 7 组：    │ design 模式：可拖拽+选中+drop     │ ComponentTree：   │
│ 信息/布局 │ preview 模式：只读渲染+数据注入   │  ┌ 锁定/隐藏图标    │
│ /表单/营销│                                  │  │ 节点行 🔒 👁      │
│ /导航/反馈│                                  │ 属性面板：        │
│ /数据展示 │                                  │  基础属性(按schema)│
│          │                                  │  ┌ 样式分区(5组)   │
│          │                                  │  事件动作          │
│          │                                  │  数据源[管理][连通]│
│          │                                  │  数组 props(可视化)│
└──────────┴────────────────────────────────┴──────────────────┘
```

### §4.2 属性面板交互链（逐分区分步）

**基础属性区**（已有，本期不变）：按 meta.propSchema 渲染 string/number/boolean/select/options/json/array 控件。

**样式分区**（新增，D15-A3）：
1. 操作：选中节点 → 样式分区展开（5 折叠组：尺寸/背景/边框/排版/布局/阴影）
2. 配置：改 `backgroundColor` → 触发 `update:style` emit
3. 反馈：画布 wrapper `:style` 实时更新（无需保存）
4. 撤销：Ctrl+Z 回退到前一 style 快照（useHistory 入栈）
5. 预览：点「预览」→ LubanPage runtime 渲染同样应用 style

字段清单（样式分区）：
| 组 | 字段 | 控件 |
|----|------|------|
| 尺寸 | width/height/margin/padding | ElInput(px/rem/%) |
| 背景 | backgroundColor / backgroundImage | ElColorPicker + ElInput |
| 边框 | borderColor/borderWidth/borderRadius/borderStyle | ElColorPicker+ElInputNumber+ElInput+ElSelect |
| 排版 | fontSize/fontWeight/color/textAlign/lineHeight | ElInputNumber+ElSelect+ElColorPicker+ElSelect |
| 布局 | display/flexDirection/justifyContent/alignItems/gap | ElSelect（display=flex 时展开）|
| 阴影 | boxShadow | ElSelect 预设+ElInput 自定义 |

**事件动作区**（已有）：按 meta.events 配动作表达式。

**数据源区**（增强，D15-B1/B2）：
1. ElSelect 选数据源 + varName ElInput（已有）
2. **[管理数据源]** 按钮 → 弹 DatasourceManageDialog（ElDialog+ElTable：名称/类型/操作[编辑/删除] + 新建按钮）→ CRUD 后刷新下拉
3. **[测试连通]** 按钮 → 调 testDatasource(selectedId) → 显示 `{ok, message, latencyMs}` 结果卡片
4. 四态：CRUD/连通期间 v-loading；失败显示错误卡片+重试；成功 ElMessage 反馈

**数组 props 控件**（新增，D15-E0）：itemFields 驱动的列表编辑器
- 列表展示当前数组每行（按 itemFields 渲染字段输入）
- [+ 添加] 按钮 push 默认行
- 每行 [删除] splice
- change 触发 handleInput 写回 node.props[key]

### §4.3 关键页面结构（无新增页面，均为组件级增强）

> 本期无新增路由页面。PageEditor/PropertyPanel/ComponentTree 为已有组件增强。website DynamicPage 为已有页面增强（仅 extractSubmitConfig 扩展）。无需高保真原型——结构清晰、控件标准 Element Plus、可由文字约束稳定开发。

## §5 数据模型与契约

### §5.1 NodeSchema 扩展（D15-A1）

```ts
// luban-low-code/src/lib/schema.ts（canonical）
export interface NodeSchema {
  id: string;
  type: string;
  props?: Record<string, unknown>;
  children?: NodeSchema[];
  visible?: string | boolean;
  loop?: NodeLoop;
  events?: Record<string, string>;
  datasource?: NodeDatasource;
  locked?: boolean;
  hidden?: boolean;
  style?: Record<string, string>;   // 新增：CSS 属性 → 值（如 backgroundColor/fontSize）
  className?: string;                // 新增：自定义 class（空格分隔）
}
```
engine `@/types/schema` re-export 同步（保持 single source = low-code canonical）。

### §5.2 PropSchemaItem 扩展（D15-E0）

```ts
// luban-low-code/src/lib/componentMeta.ts
export interface PropSchemaItem {
  type: 'string' | 'number' | 'boolean' | 'select' | 'json' | 'options' | 'array'; // +array
  default?: unknown;
  required?: boolean;
  options?: { label: string; value: string | number }[];
  itemFields?: PropSchema;   // 新增：type='array' 时，每行的字段描述
  label?: string;
}
export type PropSchema = Record<string, PropSchemaItem>;
```

### §5.3 FeatureGate（D15-D1）

```ts
// engine/src/config/features.ts
const env = import.meta.env;
function envBool(key: string, dft: boolean): boolean {
  const v = env[key];
  if (v === undefined || v === null || v === '') return dft;
  return v !== 'false' && v !== '0';
}
export const FEATURES = {
  style:           envBool('VITE_FEATURE_STYLE', true),
  datasourceManage:envBool('VITE_FEATURE_DATASOURCE_MANAGE', true),
  testConnect:     envBool('VITE_FEATURE_TEST_CONNECT', true),
  treeLockHide:    envBool('VITE_FEATURE_TREE_LOCK_HIDE', true),
  events:          envBool('VITE_FEATURE_EVENTS', true),
  datasource:      envBool('VITE_FEATURE_DATASOURCE', true),
} as const;
export type FeatureKey = keyof typeof FEATURES;
export function isFeatureEnabled(key: FeatureKey): boolean { return FEATURES[key]; }
```

### §5.4 LeadCapture 提交链路契约（D15-E2/E3）

**现有 LubanForm 链路（参考实现）**：
`LubanForm @submit` → `RuntimeRenderer @submit`（gated `root.type==='LubanForm'`）→ `formSubmitHandler({formId, formState, event})` → website `DynamicPage.handleFormSubmit` → `useLeadSubmit.submit(formId, contact)` → `POST ${bff}/api/forms/:formId/submit` → BFF `callBackend('/lead/forms/:id/submit')` → Java 后端。

**LeadCapture 接线（补 3 个间隙）**：
1. `RuntimeRenderer.vue:203` 的 `root.type === 'LubanForm'` → 扩为 `['LubanForm','LubanLeadCapture'].includes(root.type)`
2. `LubanLeadCapture.vue` inputs 加 `name`+`v-model` 绑 formState（复用 RuntimeRenderer formState 机制）；加 `formId` prop
3. `lead-capture/material.ts` propsSchema 加 `formId: {type:'string'}`；`website/DynamicPage.extractSubmitConfig` 扩展识别 `LubanLeadCapture`

**BFF/后端**：复用现有 `POST /api/forms/:id/submit` + `/lead/forms/:id/submit`，**无新增端点**。
- 双后端契约一致性声明：lead 端点仅 Java 实现（Go lead-capture §0.2 声明不做），**本期不新增接口，故无双后端新增契约**。已有 Java 端点行为不变。

### §5.5 调色板分组（D15-E4）

```ts
// palette.ts toPaletteCategory 扩展
const GROUP_MAP: Record<string, PaletteCategory> = {
  content: '信息', layout: '布局', general: '信息', button: '信息',
  form: '表单',
  marketing: '营销',        // 新组件 category
  navigation: '导航', feedback: '反馈', 'data-display': '数据展示',
};
export type PaletteCategory = '信息' | '布局' | '表单' | '营销' | '导航' | '反馈' | '数据展示';
```
营销组件统一 `category: 'marketing'`（Hero/CTA/Testimonial/LeadCapture 从 content 迁移到 marketing，保持注册名不变）。

## §6 TDD 与测试计划

### §6.1 TDD 先行（红→绿）

| task | 先写测试类型 | 关键断言 |
|------|--------------|----------|
| D15-D1 FeatureGate | 单测 `features.spec.ts` | 默认全开；VITE_FEATURE_STYLE=false 时 false |
| D15-C1 useKeyboard L/H | 单测 `useKeyboard.spec.ts`（已存在，扩用例） | 'l'→'lock'，'h'→'hide'；inputFocused 时 null |
| D15-E0 compat array | 单测 `compat.spec.ts`（新建） | object-item array→type:'array'+itemFields；primitive array→'options' |
| D15-E0 PropertyPanel array | 组件单测 | itemFields 渲染 N 字段；增删行写回 |
| D15-A2 renderer style | 组件单测 | node.style 渲染到 wrapper :style；runtime 同样应用 |
| D15-E1/E2 物料 | material-parity spec 扩展 | 9 新+4 升级物料 schema↔Vue 一致；零硬编码 hex |
| D15-F1/F2/F3 E2E | cypress（红：先写断言，跑红，再绿） | 见 §7 |

### §6.2 覆盖率门禁（目标，见 gateTargets）

- ui 包：行 90%（物料 schema 单测 + compat + renderer）
- engine 包：行 85%（features + useKeyboard + schemaTree + PropertyPanel 关键逻辑）
- 不达标则补单测，**禁止调低阈值**

## §7 E2E 用例枚举（Cypress，engine 子仓）

所有 spec 沿用现有模式：`before()` 嵌套 `cy.request` 建站点+页面 + `loginReal()` 命令 + `after()` 级联清理。环境前置：中间件在 192.168.100.248(13306/16379)，本机 dev 裸进程起 bff(3100)/engine(5173)/java(8080)/website(3000)，docker 禁本机。

### §7.1 designer.cy.ts 扩展（D15-F1）

| 用例 | 前置 | 操作与断言 | 清理 |
|------|------|-----------|------|
| 样式面板配置→实时预览→撤销 | 拖文本到画布+选中 | 改 backgroundColor → 断言 wrapper style 含该色 → 撤销 → 断言 style 回退 | after 删站点 |
| 数据源管理弹窗 CRUD | 建一个 static 数据源 | [管理数据源]→新建→断言表格出现→编辑→删除→断言下拉刷新 | after 删站点+数据源 |
| 测试连通 | 选 static 数据源 | [测试连通]→断言显示 ok=true + latencyMs | after 删 |
| ComponentTree 锁定+L 键 | 拖组件 | 点锁定→断言删按钮 disabled→L 键→断言锁定态切换 | after 删 |
| 预览模式样式生效 | 配样式 | 预览→断言 LubanPage runtime 应用 style | after 删 |

### §7.2 designer-marketing.cy.ts（D15-F2，新建）

| 用例 | 操作与断言 |
|------|-----------|
| 营销组件可见 | 断言调色板「营销」分组有 Navbar/Hero/FeatureGrid/Pricing/FAQ/Footer |
| 拖拽组装落地页 | 依次拖 6 组件到画布 → 断言 sortable-item≥6 |
| 数组编辑器配 FeatureGrid | 点 FeatureGrid → 数组控件添加 3 张 card → 断言 props.cards.length=3 |
| 保存+发布 | 填名+路径 → 保存 → 发布 → 断言 status=published |

### §7.3 designer-publish-flow.cy.ts（D15-F3，新建）

| 用例 | 操作与断言 |
|------|-----------|
| LeadCapture 提交闭环 | 拖 Hero+LeadCapture → 配 LeadCapture formId → 保存发布 → 访问 `/{slug}/{path}` → 断言 SSR 渲染 Hero+LeadCapture |
| 表单提交生成 lead | （website 端）填 LeadCapture 表单提交 → 断言 200 + 后端 lead 存在（可选查 /api/leads） |

**§7 路由合规性确认**：F1/F2 用 in-admin `/sites/:siteId/pages/:pageId`（正式路由，与现有 designer.cy.ts 一致）+ 全屏 `/designer/...` 至少 1 条；F3 用 website 正式 `/{slug}/{path}`。**无新增 `pages/e2e/*`**。

## §8 实现阶段并行 Task 线

依据 taskGraph JSON 的 `dependsOn` + `group`，可并行的独立线：

**Wave 0（地基，无依赖，全并行）**：
- 线 D15-D1（FeatureGate, engine）
- 线 D15-A1（NodeSchema, ui）
- 线 D15-C1（useKeyboard L/H + ComponentTree, engine）
- 线 D15-E0（数组编辑器基建, ui）

**Wave 1（依赖 wave0）**：
- D15-A2（renderer 接线, ui, 依 A1）
- D15-B1（数据源 CRUD 弹窗, engine, 依 D1）
- D15-E1（9 新组件, ui, 依 E0）
- D15-E2（4 升级组件, ui, 依 E0）

**Wave 2（依赖 wave1）**：
- D15-A3（样式面板, engine, 依 A1/A2/D1）
- D15-B2（四态, engine, 依 B1）
- D15-E3（LeadCapture 提交链路, ui+website, 依 E2）
- D15-E4（调色板重组, ui, 依 E1）

**Wave 3（E2E，依赖 wave2）**：
- D15-F1（依 A3/B1/C1）
- D15-F2（依 E4/F1）
- D15-F3（依 E3/F1）

**派发策略**（主会话并发 Task）：
- Wave0：4 个 subagent 并行
- Wave1：4 个 subagent 并行
- Wave2：4 个 subagent 并行（D15-E3 涉及 website，单独派发）
- Wave3：E2E 串行（cypress 不能并行同站）

每个 task 完成后**该包内** build+test 验证门通过再算完成。

## §8.1 分级验收门禁表

| 级别 | 验证方式 | 通过条件 | 责任 |
|------|----------|----------|------|
| 1. 代码质量与审查 | `/luban-review` 全自动审查 | 🔴🟡🔵 全部清零（含建议级） | 实现会话 |
| 2. 安全审查 | 敏感字段自查（见 §8.2） | 无新增敏感数据泄露；LeadCapture submit 复用现有去重/防刷/加密 | 实现会话 |
| 3. 单测+覆盖率门禁 | ui: `pnpm build && pnpm test`(行≥90%); engine: `pnpm build && pnpm test`(行≥85%) | 全绿+达标 | 实现会话 |
| 4. E2E 验收 | engine: `pnpm e2e`（cypress） | F1/F2/F3 真绿，不放宽断言 | 实现会话（询问用户后跑） |

### §8.2 敏感字段清单与分级约束

| 字段 | 出现位置 | 加密/脱敏策略 |
|------|----------|---------------|
| LeadCapture 表单字段（手机号/邮箱） | LeadCapture submit → BFF → Java | 复用现有 `/lead/forms/:id/submit` 后端去重(手机号)+加密存储；BFF 不返回 leadId（已有逻辑）|
| FeatureGate env | VITE_FEATURE_* | 仅布尔开关，无敏感 |

**安全自查（OWASP Top 10 相关）**：
- A03 注入：样式值/style 字符串直接入 CSS——需校验（拒绝 `expression()`/`javascript:` 协议；PropertyPanel 输入做白名单/转义）
- A01 失效访问控制：LeadCapture submit 端点已 public（访客提交），复用现有防刷（LeadSubmit 已有 dedup/spam）；FeatureGate 关闭不改变鉴权
- A07 身份认证：无新增认证变更

### §8.3 FeatureGate 开关设计

| key | 作用域 | 关闭时行为 |
|-----|--------|-----------|
| `VITE_FEATURE_STYLE` | PropertyPanel 样式分区 | 隐藏样式分区 |
| `VITE_FEATURE_DATASOURCE_MANAGE` | 数据源管理弹窗按钮 | 隐藏[管理数据源]按钮 |
| `VITE_FEATURE_TEST_CONNECT` | 测试连通按钮 | 隐藏[测试连通]按钮 |
| `VITE_FEATURE_TREE_LOCK_HIDE` | ComponentTree 锁定/隐藏 | 隐藏锁定/隐藏按钮+L/H 快捷键禁用 |
| `VITE_FEATURE_EVENTS` | 事件分区 | 隐藏事件动作分区 |
| `VITE_FEATURE_DATASOURCE` | 数据源分区整体 | 隐藏数据源分区 |

**回滚方案**：任一功能出问题，首选 `VITE_FEATURE_*=false` env 关闭（无需回滚代码）；样式注入风险（§8.2 A03）若发现，可快速关 `VITE_FEATURE_STYLE`。

### §8.4 双后端契约一致性声明

本期**不新增后端接口**。LeadCapture 复用现有 `POST /api/forms/:id/submit`（Java 单端实现，Go lead-capture §0.2 明确不做）。FeatureGate/样式/调色板/组件均为前端 ui+engine 增量，不触及后端契约。**无双后端新增契约义务**。

### §8.5 多端渲染一致性声明

新增 9 个营销组件 + 样式系统在 luban-low-code（canonical renderer）。website DynamicPage 通过 RuntimeRenderer 渲染，自动获得新组件+样式能力。**engine 设计态（DesignRenderer）与 website 运行态（RuntimeRenderer）样式表现须一致**（D15-A2 接线时双端验证）。client（electron/flutter）本期不涉及。

### §8.6 Post-Development Workflow

```
代码提交（各子仓 feature/luban-designer-wave15）
  → /luban-review 全自动审查 🔴🟡🔵 清零（先行，未过审查禁止跑验证）
  → ui 包：pnpm build && pnpm test（行≥90%）
  → engine 包：pnpm build && pnpm test（行≥85%）
  → 询问用户后跑 engine: pnpm e2e（cypress，需全栈起）
  → 全栈覆盖率汇总
  → 完成汇报（保留命令与关键输出证据）
```

**实现会话硬约束**（/plan-template §5）：本期范围内（15 个 task）须**连续推进至全部就绪+验证全绿**后做一次完成汇报。**禁止**部分完成即宣称交付；**禁止**分期交付同一 plan；遇用户决策阻塞或环境硬限制时列残余项，禁止假装完成。

### §8.7 质量禁令自检表

| 禁令 | 本期对应措施 |
|------|-------------|
| 禁跳过功能 | §0 需求矩阵逐条有 task+E2E |
| 禁假绿 | E2E 失败即修，不 skip/不空断言 |
| 禁占位 | 无 TODO/假文案/mock 冒充 |
| 禁骨架交付 | 每功能完整链路+四态 |
| 禁 JSON 替代页面 | 数组编辑器为可视化 UI |
| 页面交互完整 | §4.2 逐分区分步 |
| 验收以可交付为准 | 真实页面完整业务链路 |
| 引擎渲染 E2E 绑正式路由 | F1/F2/F3 全正式路由 |
| 门禁分级 | §8.1 四级 |
| /luban-review 清零 | §8.6 先行 |
| 安全审查 | §8.2 |
| 双后端契约 | §8.4（本期无新增） |
| 多端渲染一致 | §8.5 |
| FeatureGate 默认约束 | §8.3 |

## §9 实现任务派发（并行 subagent 已扫描代码库填充）

> 本节由 3 个并行 subagent（ui/engine/website）codegraph 搜索代码库产出，主会话合并去重 + 一致性校验。

### §9.1 文件变更总览

#### ui 子系统（`packages/ui/luban-ui`）

| taskID | file | new/modify | summary |
|--------|------|-----------|---------|
| D15-A1 | `luban-low-code/src/lib/schema.ts` | modify | NodeSchema +`style?:Record<string,string>` +`className?:string` |
| D15-A2 | `luban-low-code/src/lib/DesignRenderer.vue` | modify | wrapper div（template L182-192）加 `:style="root.props?.style"` `:class="root.props?.className"` |
| D15-A2 | `luban-low-code/src/lib/RuntimeRenderer.vue` | modify | `componentProps()`(L138-147) 注入 style/class（inheritAttrs 透传）；非透传组件由 wrapper 兜底 |
| D15-E0 | `luban-low-code/src/lib/componentMeta.ts` | modify | PropSchemaItem.type +`'array'`；+`itemFields?:PropSchema` |
| D15-E0 | `luban-low-code/src/lib/material/compat.ts` | modify | `case 'array'`：object-item → `type:'array'+itemFields`（从 items.properties 派生）；primitive/无 items → `'options'`/`'json'` |
| D15-E0 | `luban-low-code/src/lib/material/defineMaterial.ts` | modify | JSONSchemaProperty +`properties?:Record<string,JSONSchemaProperty>`（formalize items.properties） |
| D15-E0 | `luban-low-code/src/lib/material/__tests__/compat.spec.ts` | **new** | array(items.properties)→'array'+itemFields；enum/number passthrough；primitive array→'options' |
| D15-E1 | `luban-base/src/lib/marketing/Luban{Navbar,Footer,FeatureGrid,Stats,FAQ,Pricing,TestimonialCarousel,Gallery,LogoCloud}.vue` | **new ×9** | 9 个营销组件 Vue（新 marketing/ 子目录，与 content/ 分离） |
| D15-E1 | `luban-base/src/index.ts` | modify | +9 行 `export { default as LubanXxx } from './lib/marketing/LubanXxx.vue'`（mirror 现有 L9-14） |
| D15-E1 | `luban-low-code/src/materials/marketing/{navbar,footer,feature-grid,stats,faq,pricing,testimonial-carousel,gallery,logo-cloud}/material.ts` | **new ×9** | 9 物料定义（category:'marketing'，schema 见 §9.4） |
| D15-E2 | `luban-base/src/lib/content/LubanLeadCapture.vue` | modify | +formId prop；inputs 加 name+v-model；`@submit.prevent` 接 emit('submit', collected)；+成功态 UI |
| D15-E2 | `luban-base/src/lib/content/LubanHero.vue` | modify | +secondaryCta/secondaryCtaUrl；+eyebrow；+layout 变体(split/centered)；token 化 |
| D15-E2 | `luban-base/src/lib/content/LubanCTA.vue` | modify | +secondaryCta；+fullWidth 开关；token 化 |
| D15-E2 | `luban-base/src/lib/content/LubanTestimonial.vue` | modify | rating 显示完善；token 化 |
| D15-E2 | `luban-low-code/src/materials/marketing/{lead-capture,hero,cta,testimonial}/material.ts` | modify | lead-capture +formId；hero/cta/testimonial props 同步 |
| D15-E3 | `luban-low-code/src/lib/RuntimeRenderer.vue` | modify | `@submit` 分支（L202-210）`root.type==='LubanForm'` 扩为 `['LubanForm','LubanLeadCapture'].includes(root.type)` |
| D15-E4 | `luban-low-code/src/lib/palette.ts` | modify | toPaletteCategory 扩 7 组（信息/布局/表单/营销/导航/反馈/数据展示）；PaletteCategory union 扩；getPaletteGroups 输出全量 |
| D15-E4 | `luban-low-code/src/materials/index.ts` | modify | 注册 9 新物料（materials[] L63-90 追加）+9 re-export（mirror L134-137） |
| **cross** | `luban-low-code/src/materials/material-parity.spec.ts` | **modify（关键隐患）** | L28 `expect(all.length).toBe(20)` → 29（否则新物料注册即测试红） |

#### engine 子系统（`packages/engine/luban`）

| taskID | file | new/modify | summary |
|--------|------|-----------|---------|
| D15-D1 | `src/config/features.ts` | **new** | FEATURES map + isFeatureEnabled（src/config/ 目录新建） |
| D15-D1 | `src/config/__tests__/features.spec.ts` | **new** | 默认全开 + VITE_FEATURE_*=false 关闭 |
| D15-D1 | `src/vite-env.d.ts` | modify | ImportMetaEnv +VITE_FEATURE_* keys |
| D15-A3 | `src/views/page/components/PropertyPanel.vue` | modify | 样式分区 inline（5 组，mirror options 模式）+`update:style` emit +getStyleValue/handleStyleInput |
| D15-A3 | `src/views/page/PageEditor.vue` | modify | onUpdateStyle handler（mirror onUpdateProp L292-299）+history.push+node.style 写入；模板接线 L518-527 |
| D15-B1 | `src/views/page/components/DatasourceManageDialog.vue` | **new** | ElDialog+ElTable CRUD（调 datasource.ts 全套） |
| D15-B1 | `src/views/page/components/PropertyPanel.vue` | modify | 数据源区 +[管理数据源][测试连通] 按钮 + emit open-datasource/test-connect |
| D15-B1 | `src/views/page/PageEditor.vue` | modify | dialog 接线 + siteId 传入 + CRUD 后 loadDatasources() 刷新 |
| D15-B2 | `src/views/page/components/PropertyPanel.vue` | modify | 数据源/事件区 v-loading + 错误卡片+重试 + ElMessage 成功反馈（+import ElMessage） |
| D15-C1 | `src/views/page/components/ComponentTree.vue` | modify | 锁定/隐藏图标（#default slot L187-220）+ locked 删禁用 + lock/hide emit（L38-42） |
| D15-C1 | `src/composables/useKeyboard.ts` | modify | ShortcutAction +'lock'|'hide'；matchShortcut +'l'/'h' 分支（L24-36） |
| D15-C1 | `src/composables/useKeyboard.spec.ts` | modify | +'l'→'lock'+'h'→'hide'+input 态抑制用例 |
| D15-C1 | `src/views/page/PageEditor.vue` | modify | useKeyboard(L89-95)+lock/hide handler→onToggleLock/onToggleHide 入栈；模板 @lock @hide 接线 |
| D15-E0 | `src/views/page/components/PropertyPanel.vue` | modify | +'array' 控件分支（mirror options L290-330）+ getArrayItems/addArrayItem/removeArrayItem/updateArrayItem/commitArray |
| D15-F1 | `cypress/e2e/designer.cy.ts` | modify | +样式配置/数据源 CRUD/测试连通/锁定+L键/预览样式 用例 |
| D15-F2 | `cypress/e2e/designer-marketing.cy.ts` | **new** | 营销组装落地页+数组编辑器+保存发布 |
| D15-F3 | `cypress/e2e/designer-publish-flow.cy.ts` | **new** | Hero+LeadCapture+发布+website SSR 闭环 |

> StyleSection 决策：**inline 进 PropertyPanel**（不单独组件）——现有 options/events/datasource 均为 ElForm 内 inline 子块，共享 handleInput/commit，单独组件需重穿 node/readonly/emit，得不偿失。

#### website 子系统（`packages/web/luban-website`）

| taskID | file | new/modify | summary |
|--------|------|-----------|---------|
| D15-E3 | `views/DynamicPage.vue` | modify | extractSubmitConfig（L54-65）+`LubanLeadCapture` 分支（读 props.submitConfig+formId）|

> **website 最小 delta = 仅 extractSubmitConfig 一个分支**。collectContact/useLeadSubmit/路由/渲染均不动（collectContact L68-76 纯字段透传，天然适配 LeadCapture 字段；useLeadSubmit.submit L54 对 formId 类型无感知）。依赖顺序：UI 侧 RuntimeRenderer+LeadCapture 先行 → website ⑥ 后接（纯加法零风险）。
> **F3 E2E 注意**：DynamicPage 整页包 `<ClientOnly>`（L153），SSR HTML 无 LeadCapture 内容，断言须基于 hydration 后 DOM。

### §9.2 API 契约

**本期无新增后端/BFF 接口**。复用：
- `POST /api/forms/:id/submit`（BFF `src/app/api/forms/[id]/submit/route.ts`）→ body `{formId, contact, pageId?, channelId?, utm?, captchaToken?}` → `callBackend('/lead/forms/${id}/submit')`（Java 单端，Go lead-capture §0.2 不做）。响应 `{status, dedup}`（leadId 脱敏不返回）。
- 数据源 CRUD：`GET/POST/PUT/DELETE /api/datasources[/:id]` + `POST /api/datasources/:id/test` + `POST /api/datasources/:id/query`（已实现，engine `api/datasource.ts` 已封装）。

**双后端契约一致性**：本期不新增接口，无新增双后端契约义务。LeadCapture 复用现有 Java 单端 lead 端点。

### §9.3 数据库变更

**无**。本期纯前端（ui+engine+website DynamicPage 增强），不触及 DB/Flyway/Go schema。

### §9.4 物料 schema（9 新建，见 task 图 D15-E1）

> 全部 `category:'marketing'`，`version:'1.0.0'`，array props 用 `items:{type:'object',properties:{...}}`（D15-E0 formalize 后类型合法）。完整 propsSchema 见 §5.5 及 task 图 gate。字段速览：

| 物料 | 数组 props | itemFields |
|------|-----------|-----------|
| LubanNavbar | links | label,url |
| LubanFooter | columns→links(嵌套，v1 用 json 编辑) | title,links |
| LubanFeatureGrid | features | icon,title,description |
| LubanStats | stats | value,label,suffix |
| LubanFAQ | items | question,answer |
| LubanPricing | plans→features(嵌套) | name,price,period,features,ctaText,ctaUrl |
| LubanTestimonialCarousel | testimonials | quote,author,role,avatarUrl,rating |
| LubanGallery | images | src,alt,caption |
| LubanLogoCloud | logos | src,alt,url |

> **嵌套数组（Footer columns.links / Pricing plans.features）v1 降级 json 编辑**（§0.1 防膨胀：不做嵌套数组可视化）；扁平数组走 'array' 可视化编辑器。LubanMenu children 同理保留 json。

### §9.5 组件接口

**features.ts（D15-D1）** — 统一 env key 为 plan §5.3 定义的 `VITE_FEATURE_{STYLE,DATASOURCE_MANAGE,TEST_CONNECT,TREE_LOCK_HIDE,EVENTS,DATASOURCE}`：
```ts
export const FEATURES = { style, datasourceManage, testConnect, treeLockHide, events, datasource } as const
export type FeatureKey = keyof typeof FEATURES
export function isFeatureEnabled(key: FeatureKey): boolean
```

**PropertyPanel.vue 新增 emit/handler（D15-A3/E0/B1/B2）**：
```ts
emits: +('update:style', nodeId, style: Record<string,string>)
        +('open-datasource') +('test-connect', dsId: string)
helpers: getStyleValue(group,field) / handleStyleInput(group,field,v)
         getArrayItems(key,itemFields) / addArrayItem / removeArrayItem / updateArrayItem / commitArray
```

**DatasourceManageDialog.vue（D15-B1）**：
```ts
props: { siteId: string; modelValue: boolean; datasources: DatasourceMeta[] }
emits: { 'update:modelValue'(v); 'refresh'(); 'select'(ds|null) }
// 内部调 createDatasource/updateDatasource/deleteDatasource/testDatasource
```

**PageEditor.vue 新增 handler（D15-A3/C1/B1）**：
```ts
onUpdateStyle(nodeId, style): void          // history.push + node.style 赋值
onToggleLock(nodeId): void                  // history.push + node.locked = !node.locked
onToggleHide(nodeId): void                  // history.push + node.hidden = !node.hidden
```

**useKeyboard.matchShortcut（D15-C1）**：
```ts
type ShortcutAction = 'undo'|'redo'|'delete'|'save'|'duplicate'|'lock'|'hide'|null
// +if(!ctrl && key==='l') return 'lock'; +if(!ctrl && key==='h') return 'hide'
// input 态抑制（L28）天然覆盖裸字母
```

**website extractSubmitConfig（D15-E3）**：+`if(node.type==='LubanLeadCapture' && node.props?.submitConfig) return node.props.submitConfig`；返回值 SubmitConfig 不变。

### §9.6 并行派发计划（基于 taskGraph dependsOn）

| wave | 可并行 subagent | 依赖 |
|------|----------------|------|
| **0**（地基） | [D15-D1 engine][D15-A1 ui][D15-C1 engine][D15-E0 ui] — 4 并行 | 无 |
| **1** | [D15-A2 ui(依A1)][D15-B1 engine(依D1)][D15-E1 ui(依E0)][D15-E2 ui(依E0)] — 4 并行 | wave0 |
| **2** | [D15-A3 engine(依A1/A2/D1)][D15-B2 engine(依B1)][D15-E3 ui+website(依E2)][D15-E4 ui(依E1)] — 4 并行 | wave1 |
| **3** | E2E：D15-F1(依A3/B1/C1) → F2(依E4/F1) + F3(依E3/F1) — F1 先行，F2/F3 可并行 | wave2 |

**一致性校验结果**：
- ✅ 所有文件路径经 codegraph/Grep/Read 确认存在或标注 new
- ✅ D15-E0 PropSchemaItem.itemFields 与 PropertyPanel 数组控件签名一致
- ✅ D15-E3 website extractSubmitConfig 与 UI RuntimeRenderer 分支扩展配套
- ✅ material-parity.spec.ts L28 隐患已识别（D15-E4 同步 bump 20→29）
- ✅ FeatureGate env key 统一（VITE_FEATURE_* 6 个，见 §5.3）
- ⚠ 新组件目录 `luban-base/src/lib/marketing/`（新子目录，与现有 content/ 分离）—— index.ts barrel 显式路径，无歧义
