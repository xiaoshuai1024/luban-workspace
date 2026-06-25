---
featureId: designer-pro-upgrade
title: Luban 低代码设计器生产级升级（三栏布局+全功能+协作+模板+样式系统）
status: ready
branch: feature/lead-capture-mvp
upstream:
  - docs/LOWCODE_ENGINE_SPEC.md
  - docs/UI_SPEC.md
  - .agents/rules/luban-lowcode-engine-quality.md
  - .agents/rules/luban-material-schema.md
  - .agents/skills/ux-product-review/SKILL.md
依据声明: |
  本 plan 依据「/plan-template 命令内联契约（§0-§9 + 14 质量禁令 + §9 派发 + 四级门禁）」
  + .agents/skills/writing-plans/SKILL.md + docs/superpowers/PLAN_WRITING_CONTRACT.md 编写。
已加载 skill: writing-plans, ux-product-review, plan-eng-review
架构决策:
  - UI: Element Plus + vuedraggable + tippy.js（零重型依赖）
  - Schema: PropSchemaItem.type 扩展 +5 类型 + ComponentMeta 新增 styleSchema
  - 选择状态: lift up 到 PageEditor（selectedNodeId 双向同步）
  - 样式: 写入 node.props.style（CSS-in-JS），渲染时合并到 :style
  - 协作: Yjs CRDT + BFF WebSocket（y-websocket），乐观并发无锁
  - 模板: 预置 JSON schema 模板（营销页/表单页/海报/企业官网/活动落地页）
taskGraph: docs/superpowers/tasks/designer-pro-upgrade.json
---

# Luban 低代码设计器生产级升级 · 实现计划

> 将 luban 设计器从"画布壳"升级为与阿里 LowCodeEngine / 腾讯微搭同级的生产级可视化设计器。
> 范围覆盖 25 项能力（三栏布局+组件面板+属性面板+工具栏+撤销重做+大纲树+节点工具条+快捷键+
> 嵌套拖拽+空态引导+多设备预览+实时预览+右键菜单+对齐辅助线+搜索折叠+代码编辑+版本对比+
> 样式面板+响应式断点+自定义设置器+物料级定制设置器+多选对齐+历史面板+画布缩放+导入导出模板），
> 以及 CRDT 实时协作和页面模板库。

---

## §0 范围与分支策略

### 0.1 本期范围

将 luban 设计器升级为**生产级可视化页面搭建工具**：

1. **完整三栏设计器**（25 项能力，分三批递进）
   - **第一批（核心可用 10 项）**：三栏布局 + 组件面板 + 属性面板接线 + 工具栏 + 撤销重做 + 大纲树 + 节点工具条 + 键盘快捷键 + 嵌套拖拽排序 + 空态引导
   - **第二批（生产体验 7 项）**：多设备预览 + 实时预览模式 + 右键菜单 + 对齐辅助线 + 搜索增强 + 代码编辑模式 + 版本对比
   - **第三批（高级能力 8 项）**：样式面板 + 响应式断点 + 自定义设置器 + 物料级设置器 + 多选对齐 + 历史面板 + 画布缩放 + 导入导出模板

2. **CRDT 实时协作**：Yjs CRDT + BFF WebSocket，多人同编一页，在线用户 + 远程光标

3. **页面模板库**：预置 5 个页面模板（营销页/表单页/海报/企业官网/活动落地页），一键应用

### 0.2 分支与仓库

| 阶段 | 分支策略 |
|------|----------|
| **方案编写** | 本 plan 在 `feature/lead-capture-mvp` 分支（当前工作分支）编写 |
| **执行** | luban 策略：用户分支优先，Agent 不自动新切分支。各子模块同名分支 |
| **涉及子模块** | engine / luban-ui(luban-low-code + luban-base) / bff / website / backend-java |

### 0.3 taskGraph SSOT

任务图 JSON：`docs/superpowers/tasks/designer-pro-upgrade.json`（随本 plan 同步创建）。

### 0.4 架构决策定稿

| 决策点 | 选定 | 理由 |
|--------|------|------|
| UI 框架 | Element Plus + vuedraggable + tippy.js | 零重型依赖，风格统一，vuedraggable 复用 sortablejs |
| Schema 扩展 | PropSchemaItem.type +5 类型 + ComponentMeta.styleSchema | 向后兼容，样式与业务属性分离 |
| 选择状态 | lift up 到 PageEditor（双向 prop） | 画布/面板/大纲三处同步 |
| 样式存储 | node.props.style（CSS-in-JS） | schema 自包含，渲染时合并 :style |
| 协作并发 | Yjs CRDT（乐观并发无锁） | Yjs 自动合并，无需手动冲突解决 |
| 协作服务端 | 并入 BFF WebSocket | 复用 BFF 鉴权，不新增子项目 |
| 模板存储 | 前端内置 JSON 常量 + 后端可选模板表 | 零额外依赖，后续可扩展为用户自定义模板 |

---

## §1 需求溯源与追溯矩阵

| # | 需求 | Task ID | E2E 场景 | 验收门禁 |
|---|------|---------|----------|----------|
| R1 | 三栏布局 + 组件面板拖拽 | T-ui-d1~3, T-eng-d1 | E2E-D1 | G3/G4 |
| R2 | 属性面板接线 + 选中编辑 | T-ui-d4, T-eng-d1 | E2E-D2 | G3/G4 |
| R3 | 工具栏 + 撤销/重做 | T-ui-d5, T-eng-d2 | E2E-D3 | G3/G4 |
| R4 | 大纲树 + 节点工具条 | T-ui-d6~7, T-eng-d1 | E2E-D4 | G3/G4 |
| R5 | 键盘快捷键 | T-eng-d3 | E2E-D5 | G3 |
| R6 | 嵌套容器拖拽排序 | T-ui-d8, T-eng-d1 | E2E-D6 | G3/G4 |
| R7 | 多设备预览 + 实时预览 | T-ui-d9~10, T-eng-d2 | E2E-D7 | G3/G4 |
| R8 | 右键菜单 + 对齐辅助线 | T-ui-d11~12, T-eng-d1 | E2E-D8 | G3/G4 |
| R9 | 代码编辑模式 | T-ui-d13, T-eng-d2 | E2E-D9 | G3 |
| R10 | 版本对比 | T-ui-d14, T-eng-d4, T-bff-d1 | E2E-V1 | G3/G4 |
| R11 | 样式面板 + 响应式断点 | T-ui-d15~16, T-eng-d1 | E2E-S1 | G3/G4 |
| R12 | 自定义设置器 + 物料级定制 | T-ui-d17~18 | E2E-S2 | G3 |
| R13 | 多选对齐 + 历史面板 | T-ui-d19~20, T-eng-d1 | E2E-A1 | G3 |
| R14 | 画布缩放 + 导入导出模板 | T-ui-d21, T-eng-d5 | E2E-I1 | G3/G4 |
| R15 | CRDT 实时协作 | T-bff-d2~3, T-eng-d6, T-ui-d22 | E2E-C1 | G3/G4 |
| R16 | 页面模板库 | T-ui-d23, T-eng-d5 | E2E-T1 | G3/G4 |
| R17 | PropSchemaItem 类型扩展 + styleSchema | T-ui-d24 | (单测) | G3 |
| R18 | schemaUtils 树操作扩展 | T-ui-d25 | (单测) | G3 |
| R19 | BFF 协作 WebSocket 服务 | T-bff-d2~3 | E2E-C1 | G3/G4 |
| R20 | website 渲染样式支持 | T-web-d1 | E2E-W1 | G3/G4 |

### 明确不做（防膨胀）

- ❌ AI 辅助生成页面
- ❌ 组件市场/第三方物料上架/NPM 发布流程
- ❌ 多端（electron/flutter/cross-platform）渲染验证（本轮仅 engine + website）
- ❌ Go 后端协作/版本实现（仅 Java + BFF；Go 文档标注差异）
- ❌ 用户自定义模板持久化（本期模板为前端内置 JSON，后续迭代可加后端模板表）

---

## §2 背景与目标

当前 luban 设计器仅有一个"画布壳"——底层零件（registry/palette/PropertyPanel/OutlineTree/useHistory/DesignRenderer）已有代码，但 PageEditor 没有接线。用户无法拖组件、无法编辑属性、无法撤销。

**目标**：升级为生产级设计器，运营人员可直接搭建营销页/表单页/海报，包含实时协作、模板库、完整样式编辑。

**成功标准**：
- 运营人员从模板创建页面 → 拖拽组件 → 编辑属性/样式 → 预览 → 发布，全程无需开发者介入
- 两名运营同时编辑同一页面，修改实时同步无冲突
- 设计器零 console error，所有按钮/交互有真实反馈

---

## §3 业务逻辑

### 3.1 协作冲突解决（CRDT）

- schema 用 Yjs Y.Map 嵌套结构，每个节点是 Y.Map（id/type/props/children）
- props 字段级合并（Y.Map last-write-wins by client clock）
- children 用 Y.Array（插入/删除/移动自动合并顺序）
- 光标/选区/在线状态用 YAwareness
- 无需手动冲突解决，Yjs 自动收敛
- **冲突示例**：A 删节点 X 同时 B 改 X.props → 删除优先（Y.Array remove），孤立属性更新被丢弃

### 3.2 页面模板

- 5 个内置模板：营销活动页、留资表单页、海报页、企业官网首页、活动落地页
- 模板格式：标准 PageSchema JSON
- 应用模板 = 深拷贝模板 schema → 替换当前 schema → useHistory.push
- 模板中的 formId 为占位值，应用时提示用户关联真实表单

### 3.3 样式系统

- 样式值存储在 `node.props.style: Record<string, string>`（CSS 属性名 → 值）
- 渲染时：`:style="node.props.style"`（Vue 原生支持对象语法）
- 响应式断点：`node.props.responsive: { pc?: CSS, tablet?: CSS, mobile?: CSS }`
- 渲染时根据当前设备类型选择对应样式层

### 3.4 协作状态机

页面协作状态：
- `offline`：未连接 WebSocket，单人模式
- `connecting`：WebSocket 连接中
- `online`：已连接，在线用户 N 人
- `error`：连接失败，降级为单人模式

**合法转换**：offline ↔ connecting → online；online → error → offline（自动重连）

---

## §4 页面结构与交互链路

### §4.0 入口表

| 页面 | 路由 | 子系统 | 角色 |
|------|------|--------|------|
| 设计器（三栏） | `sites/:siteId/pages/:pageId` | engine | 运营搭建 |
| 新建页面（选模板） | `sites/:siteId/pages/new` | engine | 运营新建 |
| 模板选择弹窗 | 设计器内弹窗 | engine | 运营选模板 |
| 协作面板 | 设计器工具栏 | engine | 多人协作 |
| 访客动态页 | `/:site/:path*` | website | 访客浏览 |

### §4.0b 按系统新增模块表

| 系统 | 新增模块 | 职责 | task |
|------|---------|------|------|
| luban-low-code | ComponentPanel/DesignerToolbar/NodeToolbar/ContextMenu/AlignGuides/DevicePreview/CodeEditor/VersionCompare + setters/ + schemaUtils 扩展 + PropSchemaItem 扩展 | 设计器核心能力 | T-ui-d1~25 |
| engine | PageEditor 重写 + useDesigner/useShortcut/useCollab composables + 模板库 | 管理后台接线 | T-eng-d1~6 |
| bff | collab WebSocket 服务 + 协作鉴权 | 协作服务端 | T-bff-d2~3 |
| backend-java | 无新增（版本/FeatureGate 已有） | — | — |
| website | RuntimeRenderer 样式渲染支持 | 访客样式渲染 | T-web-d1 |

### §4.0c 设计器布局（升级后）

```
┌──────────────────────────────────────────────────────────────────┐
│ 工具栏：[←撤销][→重做] | [💻PC][📱H5][📋iPad] | [👁预览][{ }代码]│
│         [📤导入][📥导出][📋模板] | [🚀发布] | [协作●3在线]      │
├───────────┬────────────────────────────────────┬─────────────────┤
│ 组件面板   │         画布（DesignRenderer）      │  属性/大纲/版本  │
│           │                                    │  ──[属性][大纲]──│
│ 🔍 搜索    │  ┌──────────────────────────────┐  │  [版本][历史]   │
│           │  │                              │  │                 │
│ ▸ 信息     │  │  [选中节点 ◀ 节点工具条]      │  │  ┌───────────┐ │
│  文本 按钮 │  │  [其他节点]                   │  │  │字段名:input│ │
│ ▸ 表单     │  │                              │  │  │标签: input │ │
│  输入框    │  │  [👤A @pos 远程光标]          │  │  │必填: [☐]  │ │
│ ▸ 营销     │  │                              │  │  │样式 ▸     │ │
│  倒计时    │  └──────────────────────────────┘  │  └───────────┘ │
│ ▸ 网站     │                                    │                 │
│ ▸ 海报     │   (空态: 拖拽组件到此处)            │  大纲:          │
│           │                                    │  ├ root         │
│ 最近使用   │   缩放: 100% [−][+][重置]          │  │  ├ Text#1    │
│  倒计时    │                                    │  │  └ Form#2    │
│           │                                    │                 │
├───────────┴────────────────────────────────────┴─────────────────┤
│ 状态栏：●未保存 | 上次保存 10:30 | v3 | 在线: user-A, user-B     │
└──────────────────────────────────────────────────────────────────┘
```

### §4.1 UX 自检摘要

**阻断**：无。架构决策已锁定（UI/Schema/协作/样式/模板）。

**强烈建议**：
- 设计器画布交互密度高（拖拽+选中+属性+大纲+协作光标叠加），§4.0c 线框 + §4.2 分步链约束
- 所有交互须有视觉反馈（hover/active/transition 200-300ms）
- 协作断线须降级为单人模式，不阻塞编辑

### §4.2 关键交互链路

**D1：拖拽搭建**
1. 左栏按住"文本"拖动 → dragstart 设 dataTransfer `{type:'LubanText'}`
2. 拖到画布 dropzone → dragover 高亮 → drop
3. PageEditor handleAddNode → getComponentMeta defaultProps → 新节点追加 → useHistory.push
4. 画布渲染新节点 + 自动选中 → 右栏属性面板加载

**D2：属性编辑**
1. 点击节点 → selectedNodeId 更新 → 右栏属性面板加载 propSchema
2. 改值 → PropertyPanel emit patch → PageEditor 更新 node.props → useHistory.push
3. 画布实时反映新 props

**D3：撤销/重做**
1. Ctrl+Z → useShortcut → history.undo() → schema 回退 → 画布更新
2. Ctrl+Shift+Z → history.redo()
3. 工具栏按钮同步禁用态

**D4：大纲树操作**
1. 右栏"大纲"Tab → OutlineTree 渲染 schema 树
2. 点击节点 → 选中同步到画布
3. 点击删除 → schemaUtils.removeNode → useHistory.push

**C1：协作**
1. 进入页面 → useCollab 建 Y.Doc + 连 BFF WebSocket
2. 在线用户数显示在工具栏
3. A 改 content → Y.Doc update → sync 到 BFF → B 画布实时变
4. B 离开 → awareness remove → 在线列表更新

**T1：模板应用**
1. 工具栏"模板" → 弹窗列出 5 个模板（预览缩略图）
2. 选模板 → 深拷贝 schema → 替换当前 → useHistory.push
3. 画布渲染模板内容

### §4.3 逐页页面结构

**PageEditor（设计器三栏）**：见 §4.0c 线框。

**模板选择弹窗**
```
┌────────────────────────────────────────────┐
│ 选择模板                            [✕]     │
├────────────────────────────────────────────┤
│ ┌──────┐  ┌──────┐  ┌──────┐              │
│ │营销页│  │表单页│  │海报页│              │
│ │预览图│  │预览图│  │预览图│              │
│ └──────┘  └──────┘  └──────┘              │
│ ┌──────┐  ┌──────┐                        │
│ │官网  │  │落地页│                        │
│ │预览图│  │预览图│                        │
│ └──────┘  └──────┘                        │
│              [应用模板] [取消]              │
└────────────────────────────────────────────┘
```

---

## §5 集成与复用表

| 复用物 | 来源 | 本期如何用 |
|--------|------|-----------|
| DesignRenderer | luban-low-code | 扩展：+节点工具条+右键+对齐线 |
| PropertyPanel | luban-low-code | 重写：+新 setter 类型+分组 |
| OutlineTree | luban-low-code | 接线到右栏 Tab |
| useHistory | luban-low-code | 接线到工具栏+快捷键 |
| getPaletteGroups | luban-low-code | ComponentPanel 消费 |
| getComponentMeta | luban-low-code | 属性面板+模板默认值 |
| canAcceptChild | luban-low-code | 嵌套拖拽校验 |
| reorderRootChildren | luban-low-code | 替换为 schemaUtils 通用版 |
| pageVersion API | engine api | 版本对比面板 |
| AuthFilter/JWT | backend+bff | 协作 WebSocket 鉴权 |

---

## §6 架构边界与门禁自检

### 6.1 架构边界
- **物料只存在于 luban-ui**：设计器通过 registry/palette 消费
- **设计器内核在 luban-low-code**：engine 只做接线+业务
- **协作状态在 BFF WebSocket**：Yjs 文档持久化靠页面保存
- **样式写入 schema**：node.props.style，不引入外部 CSS

### 6.2 门禁自检（14 质量禁令）

| # | 禁令 | 本 plan 对应 |
|---|------|-------------|
| 1 | 禁止跳过功能 | §1 R1-R20 全部有 task |
| 2 | 禁止假绿 | E2E 全真实执行 |
| 3 | 禁止占位 | 所有组件全实装 |
| 4 | 禁止骨架交付 | 每功能完整交互链路 |
| 5 | 禁止 JSON 替代页面 | 设计器真实三栏 UI |
| 6 | 页面交互完整 | §4.2 每链路有分步 |
| 7 | 验收以可交付为准 | 每特性真实页面业务链路 |
| 8 | E2E 绑定正式路由 | 无 pages/e2e/* |
| 9 | 门禁分级 | G1-G4 表见下 |
| 10 | /luban-review 清零 | Post-Dev Workflow 含 |
| 11 | 安全审查 | G2 含协作 WebSocket 鉴权 |
| 12 | 双后端一致 | 协作仅 Java+BFF，Go 延后标注 |
| 13 | 多端渲染一致 | 声明：本轮仅 engine+website |
| 14 | FeatureGate | realtime_collab 开关 |

---

## §7 E2E 测试计划

### 7.1 E2E 用例枚举

**E2E-D1：拖拽搭建**：拖"文本"到画布 → 节点出现+选中
**E2E-D2：属性编辑**：选中→改 content → 画布文本变化
**E2E-D3：撤销/重做**：改 content→Ctrl+Z→回退→Ctrl+Shift+Z→恢复
**E2E-D4：大纲树**：大纲点击节点→画布高亮→大纲删除→画布节点消失
**E2E-D5：快捷键**：选中→Delete→节点删除→Ctrl+Z→恢复
**E2E-D6：嵌套拖拽**：拖"输入框"到 Form 容器→嵌套渲染
**E2E-D7：多设备预览**：点 H5→画布宽=375→点 PC→恢复
**E2E-D8：右键菜单**：右键节点→菜单出现→点删除→节点删除
**E2E-D9：代码编辑**：切代码模式→编辑 JSON→切回可视化→生效
**E2E-V1：版本对比**：发布→版本列表→选版本→分屏对比
**E2E-S1：样式面板**：选中→改颜色→画布实时变色
**E2E-C1：协作**：两 session→A 改→B 画布实时变→B 离开→A 在线数减
**E2E-T1：模板**：选模板→应用→画布渲染模板内容
**E2E-I1：导入导出**：导出 JSON→导入→schema 恢复
**E2E-W1：website 样式渲染**：发布含 style 的页面→website 渲染带样式

### 7.2 多租户隔离验证
| 用例 | 断言 |
|------|------|
| siteA 协作连 siteB 页面 | WebSocket 拒绝 |

---

## §8 TDD 与执行约定

- **先测后码**：schemaUtils 树操作函数先写单测
- **首个失败即停**
- **并行 subagent**：按 wave 依赖并发 Task
- **禁止分期收口**：本期全部完成后+全门禁绿才汇报

### Post-Development Workflow
```
代码提交 → /luban-review 全自动审查（清零）
→ 编译（pnpm build ×4 + mvn compile）
→ 单测+覆盖率门禁
→ 询问用户后跑 E2E
→ 截图验证
→ 完成汇报
```

---

## §9 实现任务派发

> 基于 task graph SSOT（`docs/superpowers/tasks/designer-pro-upgrade.json`）。

### 9.1 文件变更总览

**luban-low-code**（`packages/ui/luban-ui/packages/luban-low-code/src/lib/`）

| task | 文件 | 新建/改 | 摘要 |
|------|------|---------|------|
| T-ui-d25 | `schemaUtils.ts` | 改 | +findNode/findParent/removeNode/duplicateNode/moveNode/insertNode |
| T-ui-d24 | `componentMeta.ts` | 改 | PropSchemaItem.type +5 类型 + styleSchema + category 扩展 |
| T-ui-d1 | `ComponentPanel.vue` | 新建 | 左栏组件面板（搜索+分类折叠+拖拽源） |
| T-ui-d5 | `DesignerToolbar.vue` | 新建 | 工具栏（撤销/重做/设备/预览/代码/发布/协作/缩放） |
| T-ui-d7 | `NodeToolbar.vue` | 新建 | 节点浮动工具条（复制/删除/拖拽手柄） |
| T-ui-d11 | `ContextMenu.vue` | 新建 | 右键上下文菜单 |
| T-ui-d12 | `AlignGuides.vue` | 新建 | 对齐辅助线 |
| T-ui-d9 | `DevicePreview.vue` | 新建 | 多设备预览容器 |
| T-ui-d13 | `CodeEditor.vue` | 新建 | JSON schema 代码编辑 |
| T-ui-d14 | `VersionCompare.vue` | 新建 | 版本对比面板 |
| T-ui-d17 | `setters/index.ts` | 新建 | setter registry |
| T-ui-d17 | `setters/ColorSetter.vue` | 新建 | 颜色选择器 |
| T-ui-d17 | `setters/SpacingSetter.vue` | 新建 | 间距四向输入 |
| T-ui-d17 | `setters/ImageSetter.vue` | 新建 | 图片 URL+预览 |
| T-ui-d17 | `setters/RichTextSetter.vue` | 新建 | 轻量富文本 |
| T-ui-d18 | `setters/CarouselSetter.vue` | 新建 | 幻灯片可视化编辑 |
| T-ui-d18 | `setters/TabsSetter.vue` | 新建 | 标签页可视化编辑 |
| T-ui-d18 | `setters/LinkListSetter.vue` | 新建 | 链接列表编辑 |
| T-ui-d4 | `PropertyPanel.vue` | 改 | 重写：+新 setter +分组+styleSchema |
| T-ui-d8 | `DesignRenderer.vue` | 改 | +节点工具条+右键+嵌套 vuedraggable |
| T-ui-d22 | `LubanDesigner.vue` | 改 | +selectedNodeId prop+新事件+空态 |
| T-ui-d23 | `templates.ts` | 新建 | 5 个内置页面模板 JSON |
| T-ui-d1~25 | `index.ts` | 改 | 全量导出更新 |

**engine**（`packages/engine/luban/src/`）

| task | 文件 | 新建/改 | 摘要 |
|------|------|---------|------|
| T-eng-d1 | `views/page/PageEditor.vue` | 改 | 完全重写：三栏布局+全接线 |
| T-eng-d2 | `views/page/DesignerWorkspace.vue` | 新建 | 三栏容器编排 |
| T-eng-d3 | `composables/useShortcut.ts` | 新建 | 键盘快捷键 |
| T-eng-d6 | `composables/useCollab.ts` | 新建 | Yjs 客户端 |
| T-eng-d4 | `views/page/VersionComparePanel.vue` | 新建 | 版本对比接线 |
| T-eng-d5 | `views/page/TemplateDialog.vue` | 新建 | 模板选择弹窗 |
| T-eng-d1 | `composables/useDesigner.ts` | 新建 | 设计器状态管理 |

**bff**（`packages/bff/luban-bff/src/`）

| task | 文件 | 新建/改 | 摘要 |
|------|------|---------|------|
| T-bff-d2 | `app/api/collab/[siteId]/[pageId]/route.ts` | 新建 | y-websocket 协作 |
| T-bff-d3 | `lib/collabServer.ts` | 新建 | 房间管理+广播 |
| T-bff-d3 | `lib/collabAuth.ts` | 新建 | JWT 校验+房间权限 |

**website**（`packages/web/luban-website/`）

| task | 文件 | 新建/改 | 摘要 |
|------|------|---------|------|
| T-web-d1 | RuntimeRenderer 样式渲染 | 改 | 读 node.props.style 合并到 :style |

### 9.6 并行派发计划

| wave | 并行 task | 派发方式 | 收口 |
|------|----------|----------|------|
| W1 | T-ui-d25(schemaUtils), T-ui-d24(meta扩展) | 串行（基础依赖） | 单测全绿 |
| W2 | T-ui-d1(ComponentPanel), T-ui-d5(Toolbar), T-ui-d7(NodeToolbar), T-ui-d4(PropertyPanel重写) | 4 路并行 | build pass |
| W3 | T-ui-d8(DesignRenderer), T-ui-d22(LubanDesigner), T-ui-d9~14(设备/菜单/对齐/代码/版本) | 5 路并行 | build pass |
| W4 | T-ui-d17~18(setters), T-ui-d23(templates), T-ui-d19~21(多选/历史/缩放/导入导出) | 4 路并行 | build pass |
| W5 | T-eng-d1~6(PageEditor+composables), T-bff-d2~3(协作), T-web-d1(website样式) | 4 路并行(engine串行内部) | 全栈 build |
| W6 | T-eng-d6(协作集成), E2E | 串行收口 | E2E 全绿 |

---

## 分级验收门禁表

| 门禁 | 验证方式 | 通过条件 |
|------|----------|----------|
| G1 代码质量 | /luban-review | 🔴🟡🔵 清零 |
| G2 安全审查 | 协作 WebSocket 鉴权 + FeatureGate | JWT 校验 + realtime_collab 开关 |
| G3 单测+覆盖率 | nx test + vitest | schemaUtils 100% + 设计器组件冒烟 |
| G4 E2E | Cypress 全量 | 全绿无 skip |

## FeatureGate 开关

| key | 关闭行为 |
|-----|--------|
| realtime_collab | 协作 WebSocket 拒绝，设计器单人模式 |

## 双后端声明
协作仅 Java + BFF 实现；Go 延后并文档标注。

## 多端渲染一致声明
本轮仅 engine + website 验证。website RuntimeRenderer 须支持 node.props.style 渲染。

## 每步验证门
- luban-low-code：`验证门: cd packages/ui/luban-ui && nx build luban-low-code && nx test luban-low-code`
- engine：`验证门: cd packages/engine/luban && vite build && vitest run`
- bff：`验证门: cd packages/bff/luban-bff && next build`
- website：`验证门: cd packages/web/luban-website && nuxt build`
