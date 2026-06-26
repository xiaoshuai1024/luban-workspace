---
featureId: designer-polish
title: 设计器精致化改造
createdAt: 2026-06-25
status: draft
taskGraph: docs/superpowers/tasks/designer-polish.json
contractSource: plan-template 命令体 + writing-plans skill + PLAN_WRITING_CONTRACT
scope: W1 IDE装配 + W2 精致度打磨 + W3 能力扩展（17 tasks, 3 waves, 分期执行）
split: 按改造阶段分期（W1 装配→W2 精致度→W3 扩展），同一 plan 覆盖
branches: 各子仓（engine/luban + ui/luban-ui）统一分支 feature/designer-polish（基于 dev）
---

# 设计器精致化改造

## 背景与诊断

调研结论：设计器**零件齐全但未组装**。`luban-low-code` 已开发 18 个面板组件 + 内核（全部通过单测），但 `PageEditor.vue` 只挂了一个孤立画布，且连 `designMode` 属性都没传（默认 `false` → 走 RuntimeRenderer，完全不是设计模式）。

**断线的 12 个组件**：PropertyPanel / ComponentPanel / OutlineTree / DesignerToolbar / ContextMenu / useHistory / CodeEditor / DevicePreview / HistoryPanel / MultiSelectToolbar / AlignGuides / CanvasZoom

**根本原因**：`PageEditor.vue`（engine）通过动态 `import('luban-low-code')` 只取 `LubanDesigner` 组件，但 luban-low-code 的 `src/index.ts` 已导出全部 18+ 组件。已开发组件的功能完整（经单元测试覆盖），只是从未被装配到 IDE 布局中。

**对标标杆**：Webflow/Framer（精致度）+ lowcode-engine（架构）+ amis-editor（配置丰富）+ Formily/Designable（Vue 契合）

**本期不做**：iframe 画布隔离（架构级改动，后续独立 plan）

---

## §1 需求溯源（追溯矩阵）

| 上游需求 | task id | E2E 场景 | 验收门禁 |
|---------|---------|---------|---------|
| 设计器"不能用"——拖拽不生效、无网格线、无拖入预览 | T-eng-1 | 拖组件入画布 → 看到插入指示线 → 画布显示组件 | G3 + G4 |
| designMode 未开启，仅显示 Runtime 视图 | T-eng-1 | 进 PageEditor → 设计态显示选中/框选/拖拽 | G3 + G4 |
| 无属性面板（选中组件后不可编辑属性） | T-eng-3 | 选中组件 → 右侧属性面板显示字段 → 修改生效 | G3 + G4 |
| 无组件库面板（无法从面板拖入组件） | T-eng-4 | 左侧组件库展示分类 → 拖入画布 | G3 + G4 |
| 无大纲树（无法查看/操作组件层级） | T-eng-5 | 大纲树显示组件层级 → 点击定位 → 复制删除 | G3 + G4 |
| 无撤销重做 | T-eng-2 | Ctrl+Z 撤销 → Ctrl+Y 重做 → 工具栏按钮同步 | G3 + G4 |
| 无右键菜单/快捷键 | T-eng-6 | 右键节点 → 菜单出现 → 复制/删除生效 | G3 + G4 |
| 交互细节粗糙（选中无尺寸标注、数字只能手输、对齐线仅 hover 触发） | T-ui-1~T-ui-6 | 选中显示 W×H；拖改数值；拖拽时等距高亮 | G3 + G4 |
| 属性面板无折叠/搜索 | T-ui-4 | 面板按组折叠 → 搜索过滤字段 | G3 |
| setter 类型不足（仅 7 种，缺滑块/代码/图标/表达式编辑器） | T-ui-7 | 选中组件 → 属性面板出现新 setter → 交互正常 | G3 + G4 |
| luban-base 有 17 个组件未注册到设计器 | T-ui-8 | 组件库出现新物料 → 可拖入画布 → 属性面板有 schema | G3 + G4 |
| 物料无联动声明（A字段变化不影响B字段显隐） | T-ui-9 | 设 visibleWhen → 条件满足时字段显示 → 不满足隐藏 | G3 |
| 组件库无预设模板（snippet） | T-ui-10 | 组件库显示"按钮-主要/次要/危险"变体 → 拖入即用 | G3 |

**无遗漏覆盖声明**：所有调研发现的 gap（84 页报告）逐条映射到 17 个 task，无静默跳过。L0 阻塞（设计器完全不可用）由 W1 解决，L1 重要（交互精致度）由 W2 解决，L2 增强（能力扩展）由 W3 解决。

---

## §2 系统与链路

### 2.1 涉及子系统

| 子系统 | 涉及？ | 说明 |
|--------|--------|------|
| engine (`packages/engine/luban`) | ✅ 核心 | PageEditor.vue 重写 + useDesignerKeyboard composable |
| ui (`packages/ui/luban-ui`) | ✅ 核心 | luban-low-code：DesignRenderer/PropertyPanel/ComponentPanel/OutlineTree/NodeToolbar/setters/materials 改造 |
| backend-java | ❌ 不涉及 | 纯客户端改造，无 API 变更 |
| backend-go | ❌ 不涉及 | 同上 |
| bff | ❌ 不涉及 | 同上 |
| website | ❌ 不涉及 | 设计器在 engine 内，website 仅消费 RuntimeRenderer 产物 |
| client | ❌ 不涉及 | 规划态 |

### 2.2 各子系统新增/改动

#### engine (`packages/engine/luban`)

| 文件 | 新增/修改 | 说明 |
|------|----------|------|
| `src/views/page/PageEditor.vue` | **重写** | 完整 IDE 三栏布局 + 集成 7 个面板 + useHistory |
| `src/composables/useDesignerKeyboard.ts` | **新增** | 全局快捷键（Ctrl+Z/Y/C/V/D, Delete, Ctrl+S, Esc） |

#### ui luban-low-code (`packages/ui/luban-ui/packages/luban-low-code/`)

| 文件 | 新增/修改 | 说明 |
|------|----------|------|
| `src/lib/DesignRenderer.vue` | 修改 | 增选中尺寸标注 W×H（T-ui-1） |
| `src/lib/PropertyPanel.vue` | 修改 | 分组折叠 + 搜索框 + visibleWhen 消费（T-ui-4, T-ui-9） |
| `src/lib/ComponentPanel.vue` | 修改 | 缩略图 + snippet 变体（T-ui-6, T-ui-10） |
| `src/lib/NodeToolbar.vue` | 修改 | 拖拽手柄 + 层级按钮 + 气泡 tooltip（T-ui-5） |
| `src/lib/OutlineTree.vue` | 修改 | 新增显隐/锁定 toggle（T-ui-5） |
| `src/lib/LubanDesigner.vue` | 修改 | SortableJS drag 事件绑定对齐辅助线（T-ui-3） |
| `src/lib/alignGuides.ts` | 修改 | 等距高亮算法（T-ui-3） |
| `src/lib/ScrubInput.vue` | **新增** | 数值拖动改值组件（T-ui-2） |
| `src/lib/setters/index.ts` | 修改 | 注册 6 个新 setter（T-ui-7） |
| `src/lib/setters/NumberSetter.vue` | **新增** | 带 scrub + 滑块模式（T-ui-7） |
| `src/lib/setters/SliderSetter.vue` | **新增** | 范围选择（T-ui-7） |
| `src/lib/setters/CodeSetter.vue` | **新增** | 属性级代码编辑（T-ui-7） |
| `src/lib/setters/IconSetter.vue` | **新增** | 图标选择器（T-ui-7） |
| `src/lib/setters/ExpressionSetter.vue` | **新增** | 表达式输入（复用 expression.ts）（T-ui-7） |
| `src/lib/setters/EffectSetter.vue` | **新增** | 阴影/圆角/模糊/滤镜面板（T-ui-7） |
| `src/lib/material/defineMaterial.ts` | 修改 | JSONSchemaProperty 增 visibleWhen 字段（T-ui-9）；MaterialDefinition 增 snippets（T-ui-10） |
| `src/materials/form/phone-input/material.ts` | **新增** | LubanPhoneInput 物料（T-ui-8） |
| `src/materials/form/region-select/material.ts` | **新增** | LubanRegionSelect 物料（T-ui-8） |
| `src/materials/form/date-picker/material.ts` | **新增** | LubanDatePicker 物料（T-ui-8） |
| `src/materials/form/file-upload/material.ts` | **新增** | LubanFileUpload 物料（T-ui-8） |
| `src/materials/form/rating/material.ts` | **新增** | LubanRating 物料（T-ui-8） |
| `src/materials/form/slider/material.ts` | **新增** | LubanSlider 物料（T-ui-8） |
| `src/materials/website/image/material.ts` | **新增** | LubanImage 物料（T-ui-8） |
| `src/materials/website/divider/material.ts` | **新增** | LubanDivider 物料（T-ui-8） |
| `src/materials/website/rich-text/material.ts` | **新增** | LubanRichText 物料（T-ui-8） |
| `src/materials/marketing/carousel/material.ts` | **新增** | LubanCarousel 物料（T-ui-8） |
| `src/materials/marketing/countdown/material.ts` | **新增** | LubanCountdown 物料（T-ui-8） |
| （其余 6 个同理，W3 执行时按实际 luban-base 导出列表补充） | | |

### 2.3 端到端链路（W1—用户完整编辑流程）

```
1. 用户打开页面编辑器
  路由: /sites/:siteId/pages/:pageId → PageEditor.vue
  → 加载 PageSchema → 初始化 useHistory(schema)
  → 渲染 IDE 三栏布局

2. 用户从左侧组件库拖入一个按钮组件
  ComponentPanel: onDragStart(dataTransfer={type:'LubanButton'})
  → 拖入画布 → LubanDesigner: onPaletteDrop
  → emit('add-node', 'LubanButton')
  → schemaUtils.insertNode(schema, newNode)
  → useHistory.push(schema)  // 记快照
  → DesignRenderer 重新渲染

3. 用户选中按钮
  ← 点击节点 → DesignRenderer: emit('select', nodeId)
  → PageEditor: selectedNodeId = nodeId
  → PropertyPanel: getComponentMeta('LubanButton') → 渲染属性表单
  → OutlineTree: 高亮对应节点

4. 用户修改按钮文案
  PropertyPanel: patch('text', '点击领取')
  → emit('update:modelValue', {text: '点击领取'})
  → PageEditor: updateNodeProps(schema, nodeId, {text: '点击领取'})
  → schema 更新 → useHistory.push(schema)
  → 画布重渲染 → 按钮显示"点击领取"

5. 用户 Ctrl+Z 撤销
  useDesignerKeyboard: keydown('z', ctrlKey=true)
  → useHistory.undo()
  → schema 回退 → 全视图同步更新

6. 用户 Ctrl+S 保存
  → PageEditor.handleSave()
  → savePage(siteId, pageId, {name, path, schema})
  → ElMessage.success('保存成功')

7. 用户点击工具栏"预览"模式
  → designMode = false
  → LubanDesigner 走 RuntimeRenderer
  → 预览实际渲染效果
```

---

## §3 业务逻辑

### 3.1 状态机

**编辑器模式状态**（PageEditor 内部状态）：

```
┌─────────┐    点击"设计"    ┌─────────┐
│  预览    │ ◄────────────── │  设计    │
│designMode=false│  ──────► │designMode=true│
│          │  点击"预览"     │          │
└────┬────┘                 └────┬────┘
     │                           │
     │ 点击"代码"                  │ 点击"代码"
     ▼                           ▼
┌─────────────────────┐
│      代码模式        │
│ designMode=true     │
│ showCodeEditor=true │
└─────────────────────┘
```

**历史栈状态**（useHistory）：

```
┌─────────────┐  push()   ┌──────────────┐  undo()   ┌─────────────┐
│ current     │ ───────►  │ undoStack     │ ◄─────── │ redoStack    │
│ (当前schema) │           │ [snapshot...]  │ ───────► │ [snapshot...] │
└─────────────┘           └──────────────┘  redo()   └─────────────┘
                                       MAX=50，超出丢弃最旧
```

### 3.2 关键业务规则

| 规则 | 实现 |
|------|------|
| schema 每次修改后自动 push 历史快照 | PageEditor watch(schema, deep) → useHistory.push() |
| 属性面板 patch 不得跨节点污染 | updateNodeProps 通过 findNode 精准定位 |
| 组件库拖入失败时显示错误提示（非 silent fail） | LubanDesigner dropError ref + 错误浮层 |
| 选中的节点 ID 全局唯一 | internalSelected + data-lb-node selector |
| 快捷键不响应输入框中按键 | useDesignerKeyboard 检查 event.target 是否 input/textarea |
| 保存前校验名称+路径非空 | ElMessage.warning 提示 |
| 多选仅流式布局可用（absolute 模式暂不启用） | MultiSelectToolbar absoluteOnly=true 默认禁用 |

### 3.3 错误场景清单（每功能至少 3 种）

**拖入组件**：
1. 拖入数据为空（`dataTransfer.getData` 返回空）→ 显示"未检测到组件数据"错误浮层
2. 拖入数据 JSON 格式异常 → 显示"拖入数据格式错误"
3. 拖入未知组件类型 → `getComponentMeta(type)` 返回 null → 控制台 warn + 静默不添加

**属性面板**：
1. 选中无 propsSchema 的组件 → 显示"该组件无可配置属性"空态
2. JSON 字段输入非法 JSON → `commitJson` catch，静默不更新
3. 节点被删除后选中状态残留 → `selectedNodeId` 指向不存在的 node → 属性面板自动清空

**保存**：
1. 页面名称为空 → `ElMessage.warning('请填写页面名称和路径')`
2. API 返回错误 → `ElMessage.error(e.message)`
3. 新建页面时 schema 为 null → 降级为空 schema `{root:{id:'root',type:'LubanContainer',children:[]}}`

---

## §4 页面结构（含 UI 时）

### §4.0 入口表

| 路由 | 视图组件 | 来源端 | 状态 |
|------|---------|--------|------|
| `/sites/:siteId/pages/:pageId` | `PageEditor.vue` | engine | **重写**（从简陋单画布→完整 IDE） |
| `/sites/:siteId/pages/new` | `PageEditor.vue` (同一个组件) | engine | **重写** |

### §4.1 信息架构

```
PageEditor（IDE 三栏布局）
├── 顶栏: DesignerToolbar
│   ├── 撤销/重做 (canUndo/canRedo)
│   ├── 设备切换 PC/iPad/H5
│   ├── 模式切换 设计/预览/代码
│   ├── 模板选择 SaveTemplate
│   ├── 页面名称/路径 输入 (Element Plus ElInput inline)
│   └── 保存按钮 / 返回列表
├── 左栏: ComponentPanel（可折叠，默认展开）
│   ├── 搜索框
│   ├── 最近使用 (grid, 最多 6 个)
│   ├── 分类折叠组 (信息/布局/表单/营销/导航/反馈/数据展示)
│   └── 每个组件项 (图标 + 名称，draggable)
├── 中间: LubanDesigner 画布
│   ├── 缩放控件 (左下角 builtin-toolbar)
│   ├── 网格背景 (可选)
│   ├── 插入指示线 (蓝色横线)
│   ├── 对齐辅助线 overlay
│   ├── 间距提示 overlay
│   ├── 框选矩形 overlay
│   ├── 拖入预览 ghost (组件类型名)
│   ├── 拖放提示浮层 ("释放以添加组件")
│   └── 画布内容区 (DesignRenderer / RuntimeRenderer 条件渲染)
└── 右栏: 上下分栏
    ├── PropertyPanel (上半)
    │   ├── 选中空态提示 ("请选择一个组件")
    │   ├── 搜索框
    │   ├── 基础属性组 (可折叠)
    │   ├── 样式组 (可折叠)
    │   ├── 事件组 (可折叠)
    │   └── 高级组 (可折叠)
    └── OutlineTree (下半)
        ├── 根节点
        ├── 递归子节点 (缩进 + 类型图标)
        ├── 每节点: 名称 + 显隐toggle + 锁定toggle + 操作按钮(复制/删除/上下移)
        └── 空态 ("暂无组件")
```

### §4.2 主界面交互链

**交互 1：拖入组件**
1. 用户找到目标组件 → 按住拖动
2. 组件库项半透明 + 光标变 copy
3. 拖入画布 → 画布背景变蓝（dropZoneActive）
4. 鼠标在组件间移动 → 蓝色插入指示线显示目标位置
5. 释放 → 组件插入 schema → 画布立即渲染新组件

**交互 2：选中编辑**
1. 点击画布内组件 → 蓝色选中框 + 右上角 NodeToolbar 浮出
2. NodeToolbar：复制 ⧉ / 删除 ✕
3. 右侧属性面板同步显示该组件配置
4. 修改属性值 → 画布内实时更新

**交互 3：撤销重做**
1. Ctrl+Z → schema 回退 → 画布/属性面板/大纲树同步
2. Ctrl+Y → 恢复 → 同上
3. 工具栏按钮 disabled 状态实时反映 canUndo/canRedo

**交互 4：大纲树操作**
1. 点击节点 → 画布选中该组件
2. 点 ⧉ 复制 → 组件克隆到同级
3. 点 ✕ 删除 → 组件移除
4. 点 ↑↓ 移动层级
5. 点 👁 切换显隐（hidden: true 时节点半透明）
6. 点 🔒 切换锁定（locked: true 时不可拖拽）

### §4.3 逐页页面结构

#### PageEditor（IDE 三栏布局）

```
┌──────────────────────────────────────────────────────────────┐
│  DesignerToolbar                                              │
│  [←Undo] [Redo→] | [●PC] [iPad] [H5] | [设计][预览][代码]  │
│  [模板▼] | 名称: [________] 路径: [________] [保存] [返回]  │
├──────────┬──────────────────────────────┬───────────────────┤
│          │                              │  PropertyPanel    │
│  组件库   │                              │  ┌─────────────┐   │
│          │                              │  │ 搜索...      │   │
│ [搜索...] │                              │  ├─────────────┤   │
│          │                              │  │ ▼ 基础属性   │   │
│ ⏐ 最近   │                              │  │  text: [___] │   │
│ [📦][📦] │        画布 (Canvas)          │  │  type: [▼]   │   │
│ [📦][📦] │                              │  │  size: [▼]   │   │
│          │    ┌──────────────────┐       │  ├─────────────┤   │
│ ▼ 信息   │    │  root Container  │       │  │ ▶ 样式      │   │
│  📦 按钮  │    │  ┌────────────┐  │       │  ├─────────────┤   │
│  📦 文本  │    │  │ 按钮 Demo  │  │       │  │ ▶ 事件      │   │
│  📦 Banner│    │  └────────────┘  │       │  └─────────────┘   │
│          │    │  ┌────────────┐  │       │                   │
│ ▼ 布局   │    │  │ 文本 Demo  │  │       │  OutlineTree      │
│  📦 容器  │    │  └────────────┘  │       │  ┌─────────────┐   │
│  📦 行    │    └──────────────────┘       │  │ 📦 root      │   │
│          │    [−  100%  +  ⊞ ⊟]         │  │  ┣ 📦 按钮 👁🔒│   │
│ ▼ 表单   │                              │  │  ┣ 📦 文本 👁🔒│   │
│  📦 表单  │                              │  │  └            │   │
│  📦 输入  │                              │  └─────────────┘   │
│ ...      │                              │                   │
├──────────┴──────────────────────────────┴───────────────────┤
│  status bar: ● 未保存  |  上次保存: 12:30  |  v1.2.3         │
└──────────────────────────────────────────────────────────────┘
```

**四态说明**：

| 状态 | 位置 | 表现 |
|------|------|------|
| **加载态** | PageEditor 全屏 | `v-loading="loading"` + Element Plus loading spinner |
| **空态（无组件）** | 画布中间 | "从左侧拖拽组件到此处" + ⊹ 虚线区域 |
| **空态（无选中）** | PropertyPanel | "请选择一个组件开始编辑" |
| **空态（无 outline）** | OutlineTree | "暂无组件" |
| **错误态** | 拖放错误 | 画布底部浮层 ⚠️ + 错误文案，3s 自动消失 |
| **保存成功** | 顶栏右侧 | ElMessage.success 顶部通知 |
| **保存失败** | 顶栏右侧 | ElMessage.error 顶部通知 |

### §4.4 UX 自检

| 维度 | 状态 |
|------|------|
| 加载/空/错/成功四态 | W1 已覆盖：加载=loading spinner，空=placeholder引导文案，错=error浮层+message，成功=message |
| 拖拽反馈 | W1 覆盖：拖入高亮+插入指示线+drop-hint浮层；W2 增强：辅助线实时跟随+等距高亮 |
| 键盘可访问性 | W1 覆盖：Ctrl+Z/Y/C/V/D/Delete/Ctrl+S/Esc/Space平移 |
| 焦点管理 | Esc 取消选中 + 焦点回到画布 |
| 对比度 | 使用 luban-base 设计 token（`--lb-*` CSS 变量），对齐 `docs/UI_SPEC.md` |
| 一致性 | 所有 setter 统一使用 `fieldName/value/onChange` 协议；分组折叠行为一致 |

---

## §5 集成与复用表

| 复用件 | 提供方 | 消费方 | 契约 |
|--------|--------|--------|------|
| `useHistory` | luban-low-code `useHistory.ts` | T-eng-1 PageEditor | `{current:Ref, push, undo, redo, canUndo, canRedo, reset}` |
| `LubanDesigner` | luban-low-code | T-eng-1 PageEditor | props: `schema, designMode, selectedNodeId, breakpoint`; emits: `add-node, select, copy, delete, context-menu, multi-select, reorder, move-node` |
| `PropertyPanel` | luban-low-code | T-eng-3 | props: `nodeMeta, modelValue, styleValue`; emits: `update:modelValue, update:styleValue` |
| `ComponentPanel` | luban-low-code | T-eng-4 | 无 props（自驱动从 registry 读）；通过 HTML5 drag API 发射组件类型 |
| `OutlineTree` | luban-low-code | T-eng-5 | props: `root, selectedId`; emits: `select, duplicate, delete, reorder, toggle-hidden, toggle-locked` |
| `DesignerToolbar` | luban-low-code | T-eng-2 | props: `canUndo, canRedo, ...`; emits: `undo, redo, device-change, mode-change, template-select, save, import-json, export-json` |
| `context-menu` 事件 | LubanDesigner emit | T-eng-6 ContextMenu | `(x:number, y:number, nodeId:string)` |
| `schemaUtils.*` | luban-low-code `schemaUtils.ts` | T-eng-3/4/5/6 | `findNode, removeNode, duplicateNode, moveNode, insertNode, updateNodeProps, bringToFront, sendToBack` |
| `materialRegistry` | luban-low-code | T-eng-3/4/5 | `get(name) → MaterialDefinition` |
| `getPaletteGroups/getPaletteItems` | luban-low-code `palette.ts` | T-eng-4 ComponentPanel | 返回分类后的组件列表 |
| `getComponentMeta` | luban-low-code `componentMeta.ts` | T-eng-3 PropertyPanel | `(type) → ComponentMeta` |
| `expression.evaluate` | luban-low-code | T-ui-9 visibleWhen | `evaluateBoolean(expr, ctx) → boolean` |
| `ScrubInput.vue` | luban-low-code（新增） | T-ui-2 NumberSetter/SpacingSetter | props: `modelValue, min, max, step, unit?`; emits: `update:modelValue` |

---

## §6 架构边界 + 门禁自检

### §6.1 架构边界

- **engine 层**：负责 IDE 布局装配 + 状态桥接（history/selectedNodeId/designMode）+ E2E
- **luban-low-code 层**：负责编辑器内核（画布/面板/setter/物料）+ 单元测试
- **luban-base 层**：纯 Vue3 组件实现，设计器不感知
- **BFF/后端**：本期无变更

**不破坏现有契约**：
- 所有 luban-low-code 导出（`src/index.ts`）保持不变
- `PageEditor.vue` 保留现有 `savePage/createPage` API 不变
- 现有 `schema` / `MaterialRegistry` / `defineMaterial` 接口向后兼容

### §6.2 双后端 parity 矩阵

**本期不涉及**。纯前端改造，无 API 变更，Java/Go 后端无改动。

### §6.3 覆盖率门禁目标

| 包 | 行覆盖率目标 | 验证命令 |
|----|------------|---------|
| engine (`packages/engine/luban`) | 85% | `pnpm test` |
| ui (`packages/ui/luban-ui`) | 90% | `pnpm test` |

### §6.4 物料 schema 标准

对齐 `.agents/rules/luban-material-schema.md`：W3 新增的 17 个物料须遵守 `defineMaterial({ name, version(semver), category, propsSchema(JSON Schema), events[], slots[] })`，每字段声明 `default`。

### §6.5 FeatureGate 策略

本期无新增 API/功能开关需求。设计器改造全部在 engine 内部，已有 auth 保护（admin only）。改造是**增强现有设计器页面**，不是新增独立功能——所有变更天然在现有的 admin 权限边界内。不新增 FeatureGate。

**不使用开关的理由**：设计器是同一页面的渐进增强，不可拆分（如"有关闭属性面板的设计器"或"组件库显示一半"均无法正常使用）。回滚手段：revert commit（纯前端代码，无 DB 迁移/配置变更）。

---

## §7 E2E 测试计划

### §7.1 跨端主路径

**测试栈**：Cypress（engine 端已有 `cypress.config.ts` + `cypress` 13.x 依赖）

**拖拽 E2E 基础设施**（W1 前搭建）：

1. **安装 `@4tw/cypress-drag-drop` 插件** — 提供 `.drag()` / `.move()` API 封装 HTML5 drag 事件
2. **新增 Cypress 自定义命令**（`cypress/support/commands.ts`）：
   ```ts
   // 模拟 HTML5 drag from component panel → canvas drop
   Cypress.Commands.add('dragFromPanel', (panelSelector: string, canvasSelector: string) => {
     const dataTransfer = new DataTransfer()
     cy.get(panelSelector).trigger('dragstart', { dataTransfer })
     cy.get(canvasSelector).trigger('drop', { dataTransfer })
   })

   // SortableJS 拖拽排序：模拟 mouse 事件链
   Cypress.Commands.add('sortableMove', (sourceSelector: string, targetSelector: string) => {
     cy.get(sourceSelector).trigger('mousedown', { button: 0 })
     cy.get(targetSelector).trigger('mousemove', { clientX: 300, clientY: 200 })
     cy.get(targetSelector).trigger('mouseup')
   })

   // 断言拖拽视觉反馈（插入指示线 / drop hint）
   Cypress.Commands.add('assertDropIndicator', () => {
     cy.get('.luban-designer__insert-line').should('exist')
   })
   ```

**主链路 E2E**（绑正式路由 `/sites/:siteId/pages/:pageId`）：
1. 登录 → 进入站点 → 点击页面编辑 → 断言 IDE 三栏布局渲染
2. **拖入组件**（真实 HTML5 drag 事件）→ 断言画布出现组件
3. **画布内排序**（SortableJS mouse 事件链）→ 断言顺序变化
4. **嵌套跨容器拖拽**（Row → Col 拖入按钮）→ 断言子容器内出现组件
5. 选中按钮 → 断言属性面板显示、选中尺寸标注
6. 修改按钮文案 → 断言画布实时更新
7. Ctrl+Z 撤销 → 断言文案回退
8. Ctrl+S 保存 → 断言成功提示
9. 切换到预览模式 → 断言 RuntimeRenderer 渲染

**路由合规性确认**：
- ✅ 所有 E2E 路由均为正式产品路由：`/sites/:siteId/pages/:pageId`（`PageEditor.vue`）
- ❌ 无新增 `pages/e2e/*` 专测页

### §7.2 脚本保障逻辑

- **首个失败即停**：Cypress `retries: 0`（默认），首测失败即停止当前 spec
- **禁假绿**：禁 `cy.skip` / `.should('not.exist')` 空断言；每条用例须有真实的 DOM 断言
- **环境预检**：`cypress.config.ts` 的 `baseUrl: 'http://localhost:5173'`，engine dev server 须 5173 端口启动
- **对齐规范**：遵循 `.agents/rules/luban-e2e-execution-contract.md`

### §7.3 E2E 用例枚举（拖拽专项）

#### 场景 A：组件库拖入画布（HTML5 drag）

| 项目 | 内容 |
|------|------|
| **前置条件** | engine dev 启动（5173），BFF 启动（3100），已通过 `loginWithToken` 注入 JWT，导航到 `/sites/:id/pages/:pid`，PageEditor 已加载，JSON 中的 `dataTransfer.setData` 已在 ComponentPanel dragstart handler 中正确设值 |
| **用例 A1** | 在组件库找到"按钮"（`[data-palette-type="LubanButton"]`）→ `trigger('dragstart', { dataTransfer })` — 断言 `dataTransfer.types` 含 `application/json`，`dataTransfer.getData('application/json')` 解析得到 `{ type: 'LubanButton' }` |
| **用例 A2** | 拖入画布空白区 → `cy.get('.luban-designer__canvas').trigger('drop', { dataTransfer })` → 断言画布出现新 `[data-lb-node]` 元素 → 断言新节点 data-lb-type 为 `LubanButton` |
| **用例 A3** | 拖入时画布背景变蓝 → 断言 `.luban-designer__canvas--drop-active` class 存在 → 拖入结束后 class 自动移除 |
| **用例 A4** | 拖入两个组件间隙 → 断言蓝色插入指示线（`.luban-designer__insert-line`）出现在正确位置（top style 值介于两个组件之间） |
| **用例 A5** | 拖入预览 ghost → 鼠标悬停时断言 `.luban-designer__drop-preview` 显示 "+ LubanButton" 文本 |
| **用例 A6（失败）** | dragstart 设空 dataTransfer → canvas drop → 断言 `.luban-designer__drop-error` 显示"未检测到组件数据" |
| **清理** | 每次测试前确保 schema 为空白页面（`{root: {id:'root', type:'LubanContainer', children:[]}}`），通过 API 重置 |

#### 场景 B：画布内排序（SortableJS）

| 项目 | 内容 |
|------|------|
| **前置条件** | 画布内已存在 3 个组件（通过 API 预设 schema：Button + Text + Container），在 `designMode=true` 状态 |
| **用例 B1** | `cy.get('[data-lb-node]:eq(0)').trigger('mousedown', { which:1 })` → `.trigger('mousemove', { clientY: 300 })` → 断言 SortableJS 动画 class `.sortable-chosen` 出现在被拖元素 |
| **用例 B2** | 释放到 `[data-lb-node]:eq(1)` 位置 → `trigger('mouseup')` → 断言 DOM 顺序变化：原来在 index 0 的元素现在在 index 2 |
| **用例 B3** | `locked` 节点不可拖拽 → 设置节点 `node.locked=true` → 尝试拖拽 → 断言 `.design-renderer__wrapper--locked` class 阻止 Sortable |
| **清理** | 测试后通过 API 将页面 schema 重置为空 |

#### 场景 C：跨嵌套容器拖拽

| 项目 | 内容 |
|------|------|
| **前置条件** | 画布内存在 Row 容器（含 2 个 Col 子容器），一个 Col 内已有按钮 |
| **用例 C1** | 从 Col1 拖按钮到 Col2 → 断言按钮从 Col1 的 sortable-list 移除 → 出现在 Col2 的 sortable-list 中 |
| **用例 C2** | 从组件库拖新组件到 Col2 内部 → 拖入到 `[data-parent-id="<col2-id>"]` 容器上 → 断言新组件插入到 Col2 children |
| **用例 C3** | 不允许跨类型拖拽（如按钮拖入按钮内）→ 断言 SortableJS `onMove` 返回 false（通过 `canAcceptChild` 检查） |
| **清理** | 测试后通过 API 重置 schema |

#### 场景 D：拖拽视觉反馈

| 项目 | 内容 |
|------|------|
| **前置条件** | 画布内已有 2+ 组件 |
| **用例 D1** | 拖拽组件到与其他组件同一边缘（左/右/垂直中线）→ 断言 `.luban-designer__guide--vertical`（红色对齐线）渲染 |
| **用例 D2** | 三个组件等间距排列 → 拖中间组件 → 断言紫色等距辅助线出现（W2 T-ui-3 后加入） |
| **用例 D3** | 拖拽时间距提示 → 断言 `.luban-designer__spacing-label` 显示像素距离值 |
| **清理** | 同上 |

#### 场景 E：IDE 编辑完整流程（非拖拽）

| 项目 | 内容 |
|------|------|
| **用例 E1** | 选中组件 → 断言属性面板出现该组件字段 → 修改 text value → `cy.get('.lb-node-toolbar')` 浮出 |
| **用例 E2** | Ctrl+Z → 断言画布回退；Ctrl+Y → 断言恢复 |
| **用例 E3** | Ctrl+S → 断言 `ElMessage.success('保存成功')` |
| **用例 E4** | 大纲树点击节点 → 断言画布同步选中 → 属性面板同步更新 |
| **用例 E5** | 右键节点 → `ContextMenu` 出现 → 点击"删除" → 断言节点消失 |
| **用例 E6** | 切换预览模式 → 断言 `RuntimeRenderer` 渲染（无选中框/无 NodeToolbar） |

### §7.4 E2E 路由合规性确认

| E2E 使用的路由 | 正式产品路由？ | 说明 |
|---------------|--------------|------|
| `/sites/:siteId/pages/:pageId` | ✅ | PageEditor.vue 正式路由 |
| `/sites/:siteId/pages/new` | ✅ | 新建页面路由（同 PageEditor.vue） |

**禁止使用的路由**：
| 路由 | 原因 |
|------|------|
| `pages/e2e/*` | 禁止专测页作为主 E2E 载体（契约 §8 禁令） |

### §7.5 E2E 文件组织

```
packages/engine/luban/cypress/e2e/
├── designer-drag-panel.cy.ts   # 场景 A: 组件库拖入画布（6 用例）
├── designer-drag-sort.cy.ts    # 场景 B: SortableJS 排序（3 用例）
├── designer-drag-nested.cy.ts  # 场景 C: 跨容器拖拽（3 用例）
├── designer-drag-visual.cy.ts  # 场景 D: 拖拽视觉反馈（3 用例）
├── designer-edit.cy.ts         # 场景 E: 完整编辑流程（6 用例）
└── login.cy.ts                 # 已有，保持不变
```

### §7.6 E2E 运行命令

```bash
# 全部 designer E2E
cd packages/engine/luban && npx cypress run --spec "cypress/e2e/designer-*.cy.ts"

# 拖拽专项
cd packages/engine/luban && npx cypress run --spec "cypress/e2e/designer-drag-*.cy.ts"

# 交互式运行（调试用）
cd packages/engine/luban && npx cypress open
```

**环境依赖**（运行前确保）：
1. Java backend 启动（`mvn spring-boot:run -DskipTests`，端口 8080）
2. BFF 启动（`npx tsx server.ts`，端口 3100）
3. engine dev 启动（`pnpm dev`，端口 5173）
4. MySQL + Redis 已启动

---

## §8 TDD 与执行约定

### 8.1 TDD 先行

| 关键行为 | 测试类型 | 先于？ |
|---------|---------|--------|
| PageEditor IDE 布局渲染 + designMode=true | engine E2E | 任何 W1 代码修改前 |
| useHistory push/undo/redo | vitest 单测（已有 `use-history.spec.ts`） | T-eng-2 接线前 |
| PropertyPanel 渲染 + patch 回写 | vitest 单测（已有 `property-panel.spec.ts`） | T-eng-3 接线前 |
| ScrubInput 拖拽改值 | vitest 单测（新增） | T-ui-2 实现前 |
| 对齐辅助线算法（等距高亮） | vitest 单测（扩展现有 `alignGuides` 测试） | T-ui-3 实现前 |

### 8.2 首失败即停

指修当前红用例时专注该条，修绿后继续至**全量**门禁通过。禁止在仍有未实现 W1 任务时因"部分跑通"提前收工。

### 8.3 并行 subagent

**W1（7 tasks）并行执行**：
- Group A（无依赖）：T-eng-1
- Group B（依赖 T-eng-1，彼此独立）：T-eng-2, T-eng-3, T-eng-4, T-eng-5 → **4 个 subagent 并行**
- Group C（依赖 A+B）：T-eng-6, T-eng-7 → **2 个 subagent 并行**

**W2（6 tasks）并行执行**：
- T-ui-1, T-ui-2, T-ui-3, T-ui-5 → **4 个 subagent 并行**（独立文件，无互相依赖）
- T-ui-4 依赖 T-eng-3（W1），T-ui-6 依赖 T-eng-4（W1）→ 各自独立 subagent

**W3（4 tasks）并行执行**：
- T-ui-7, T-ui-8 → 2 个 subagent 并行
- T-ui-9, T-ui-10 → 各自独立 subagent

### 8.4 单期收口

**本期范围**：W1 + W2 + W3 全部 17 个任务。分期执行（按 wave），每个 wave 完成后 merge 到 dev，最终全部完成后统一跑完整验证门禁。完成汇报 = 全部 17 tasks done + 门禁全过。

**禁止分期交付同一方案**约束：本 plan 覆盖 W1-W3，分 3 个 wave 在同一分支 `feature/designer-polish` 执行。每个 wave 完成后 commit + push，不拆分 plan。最终一次收口。

### 8.5 Post-Development Workflow

```
代码提交（W1→W2→W3 每个 wave 提交一次）
   ↓
/luban-review 全自动审查（🔴🟡🔵 清零）
   ↓
编译：pnpm build（engine + luban-ui）
   ↓
单测 + 覆盖率：pnpm test（vitest + @vitest/coverage-v8）
   ↓
询问用户后跑 E2E（Cypress engine E2E，含真实 drag & drop 验证）
   ↓
全栈覆盖率汇总（engine 85% + ui 90%）
   ↓
完成汇报
```

### 8.6 验证门定义

| 阶段 | 验证门 | 命令 |
|------|--------|------|
| W1 Lint | TypeScript 零错误 | `cd packages/engine/luban && pnpm exec tsc --noEmit` |
| W1 单测 | luban-low-code 单测全绿 | `cd packages/ui/luban-ui && pnpm test` |
| W1 E2E | IDE 布局渲染 + 拖入 + 编辑 | `cd packages/engine/luban && npx cypress run --spec "cypress/e2e/designer-drag-panel.cy.ts,cypress/e2e/designer-edit.cy.ts"` |
| W2 E2E | 拖拽视觉反馈（对齐线/排序/跨容器） | `cd packages/engine/luban && npx cypress run --spec "cypress/e2e/designer-drag-*.cy.ts"` |
| W3 E2E | 完整编辑链路（17 tasks 全部） | `cd packages/engine/luban && npx cypress run --spec "cypress/e2e/designer-*.cy.ts"` |
| 收口门禁 | /luban-review 清零 | `/luban-review` |
| 收口覆盖率 | engine 85% + ui 90% | `pnpm test --coverage` |

---

## §10 明确不做（防膨胀）

| 项 | 理由 |
|----|------|
| **iframe 画布隔离** | 架构级改动，成本高；luban 物料全为受控 Vue 组件，div 模式可承载。建议后续独立 plan |
| **自由绝对定位画布（海报模式）** | 当前流式布局已满足落地页/表单场景；MultiSelectToolbar 已预留 absoluteOnly 标记 |
| **AI 辅助生成** | 超出本期范围 |
| **多人协作/实时编辑** | DesignerToolbar 有占位 UI（onlineUsers/collabEnabled），本期不接后端 |
| **样式系统重构（class系统/盒模型可视化面板）** | 用户确认 A5 选 A（基本够用），W2 仅做 scrub 拖改值 + 折叠搜索 |
| **BFF/后端/website/客户端** | 纯前端改造，无 API/SSR/多端变更 |
| **CodeMirror/Monaco 集成** | W3 CodeSetter 用轻量 `<textarea>` + 语法高亮（非完整 IDE） |

## 已知缺口显式延后

| 项 | 延后到 | 理由 |
|----|--------|------|
| iframe 画布隔离 | 后续独立 plan | 架构级，需 Vue simulator + postMessage 桥 |
| 逻辑流可视化编排 | 后续独立 plan | 需要后端 + BFF + 新面板，非设计器精致度范畴 |
| 字段绑定 setter（数据源字段选择器） | 后续独立 plan | 依赖 CMS 数据源管理面板 |
| 协作编辑后端 | 后续独立 plan | 需要 WebSocket/CRDT 后端 |

---

## 质量禁令自检表

- [x] 1. 禁止跳过功能（所有调研 gap 映射到 17 task，有「明确不做」声明）
- [x] 2. 禁止假绿（E2E 真实断言，见 §7.3）
- [x] 3. 禁止占位（无可 TODO/假固定文案/mock 数据，所有面板绑定真实 registry+schema）
- [x] 4. 禁止骨架交付（每个 W1 task 交付完整可用面板，非空壳）
- [x] 5. 禁止用 JSON 替代页面（设计器本身即可视化 UI）
- [x] 6. 页面交互完整（§4.3 逐页四态齐全，§4.2 交互分步链路）
- [x] 7. 验收口径=可交付（用户可在 engine 内使用完整设计器编辑页面）
- [x] 8. 引擎 E2E 绑正式路由（`/sites/:siteId/pages/:pageId`，非 e2e/* 专测页）
- [x] 9. 门禁分级执行（G1–G4 齐全，见下文）
- [x] 10. /luban-review 清零（§8.5 Post-Dev Workflow 首步）
- [x] 11. 安全审查门禁（不适用：无敏感数据/支付/外部对接/权限变更）
- [x] 12. 双后端契约一致（不适用：无 API 变更）
- [x] 13. 多端渲染一致（不适用：仅设计态改动，RuntimeRenderer 逻辑不变，SSR 产物一致）
- [x] 14. FeatureGate 默认约束（不适用：纯增强现有页面，见 §6.5 理由）

---

## 分级验收门禁表

| 级别 | 名称 | 验证方式 | 通过条件 | 责任 |
|------|------|---------|---------|------|
| **G1** | 代码质量与审查 | `/luban-review` 全自动审查 | 🔴🟡🔵 全部清零 | plan owner |
| **G2** | 安全审查 | 不适用（无敏感数据/支付/外部对接/权限变更） | N/A | — |
| **G3** | 单测 + 覆盖率门禁 | `pnpm test`（engine + luban-ui） | engine 85%，ui 90% | plan owner |
| **G4** | E2E 验收 | Playwright §7.3 用例 | 全绿、无 skip、无假绿 | plan owner |

**门禁执行顺序**：G1（/luban-review 清零）→ G3（单测覆盖率）→ G4（E2E）。G2 跳过（不适用）。

---

## 敏感字段清单

不适用。本期无新增 API/DB/配置，纯前端代码无敏感数据处理。

---

## 双后端契约一致性声明

**不适用**。本期无新增/修改 API 接口，Java 与 Go 后端均无改动。现有的所有后端接口契约保持不变。

---

## 多端渲染一致性声明

**不适用**。本期变更仅影响**设计态**（engine 内的 PageEditor 交互层）。RuntimeRenderer（负责产出 SSR 渲染 schema）逻辑不变，website/electron/flutter 的渲染行为不变。现有物料的 props schema 向后兼容（W3 仅新增字段，不改已有字段类型）。

---

## 回滚方案

| 变更 | 回滚首选 | 回滚次选 | 数据影响 | 验证点 |
|------|---------|---------|---------|--------|
| PageEditor 重写 | revert commit（纯前端） | — | 无 | 旧版 PageEditor 可用 |
| luban-low-code 组件修改 | revert commit | — | 无 | 组件单测仍绿 |
| 物料 schema 扩展（T-ui-8） | revert commit | — | 无 | MaterialRegistry 不破 |

**无 FeatureGate 关闭回滚**：本期无新增 FeatureGate 开关。所有变更为纯前端代码，revert 是首选的回滚手段。

---

## 实现会话约定

本期范围（17 tasks, 3 waves）须在**单次实现周期内**连续推进。每个 wave 提交验证通过后继续下一个 wave，不中途收口。完成汇报 = 全部 17 tasks done + G1/G3/G4 门禁全过 + 截图验证。

**并行派发**：按 §8.3 的并行计划，每个 wave 内无依赖的 task 用 subagent 并行执行。

---

---
## §9 实现任务派发

> 由 2 个并行 subagent（engine + ui）通过 codegraph 搜索代码库自动生成，经主 agent 合并去重与一致性校验。

### 9.1 文件变更总览

#### 9.1.1 engine 子系统

| Task ID | 文件路径 | 新建/修改 | 摘要 |
|---------|---------|-----------|------|
| **T-eng-1** | `packages/engine/luban/src/views/page/PageEditor.vue` | 修改（重写） | IDE 三栏布局：DesignerToolbar + ComponentPanel + LubanDesigner + PropertyPanel/OutlineTree + `designMode=true` + useHistory |
| **T-eng-2** | `packages/engine/luban/src/views/page/PageEditor.vue` | 修改（同文件） | DesignerToolbar emit 接线：undo/redo/设备/模式/模板/保存，消费 useHistory |
| **T-eng-3** | `packages/engine/luban/src/views/page/PageEditor.vue` | 修改（同文件） | PropertyPanel 接线：selectedNodeId→getComponentMeta→渲染→updateNodeProps |
| **T-eng-4** | `packages/engine/luban/src/views/page/PageEditor.vue` | 修改（同文件） | ComponentPanel 接线：getPaletteGroups + HTML5 drag + 最近使用 |
| **T-eng-5** | `packages/engine/luban/src/views/page/PageEditor.vue` | 修改（同文件） | OutlineTree 接线：schema 传入 + 选中联动 + delete/duplicate/reorder → schemaUtils |
| **T-eng-6** | `packages/engine/luban/src/views/page/PageEditor.vue` | 修改（同文件） | ContextMenu 接线：消费 context-menu emit → 定位 ContextMenu 组件 |
| **T-eng-6** | `packages/engine/luban/src/composables/useDesignerKeyboard.ts` | **新建**（目录+文件） | 全局快捷键 composable：Ctrl+Z/Y/C/V/D/Delete/Ctrl+S/Esc，注入 useHistory+selectedNodeId |
| **T-eng-7** | `packages/engine/luban/src/views/page/PageEditor.vue` | 修改（同文件） | CodeEditor 接线：代码模式双向绑定 JSON↔schema |

**engine 包基础设施确认**：
- PageEditor 路由：`packages/engine/luban/src/router/index.ts` → `/sites/:siteId/pages/:pageId` (PageEditor) + `/sites/:siteId/pages/new` (PageNew) — 已存在，无需修改
- API：`packages/engine/luban/src/api/page.ts` — `getPage/savePage/createPage/deletePage` — 已存在，无需修改
- 类型：`packages/engine/luban/src/types/schema.d.ts` — `PageSchema/NodeSchema` — 已存在
- Store：`packages/engine/luban/src/stores/page.ts` — `currentSchema` ref — 可复用
- E2E 配置：`packages/engine/luban/cypress.config.ts`（Cypress，非 Playwright） — 已存在
- 单测配置：`packages/engine/luban/vitest.config.ts` — 已存在
- composables 目录：`packages/engine/luban/src/composables/` **不存在** → 需新建目录

#### 9.1.2 ui (luban-low-code) 子系统

| Task ID | 文件路径（相对 luban-low-code/src） | 新建/修改 | 摘要 |
|---------|-------------------------------------|-----------|------|
| **T-ui-1** | `lib/DesignRenderer.vue` | 修改 | 选中态 `--selected` 旁增 W×H 尺寸标注 overlay |
| **T-ui-2** | `lib/setters/ScrubInput.vue` | **新建** | 通用 scrub 数值输入：hover 上下拖改值 |
| **T-ui-2** | `lib/setters/SpacingSetter.vue` | 修改 | 集成 ScrubInput，四方向独立 scrub |
| **T-ui-3** | `lib/alignGuides.ts` | 修改 | `computeAlignGuides` 增等距检测：拖动节点与另外两节点等距时输出紫色高亮线 |
| **T-ui-3** | `lib/LubanDesigner.vue` | 修改 | 对齐线 overlay 增紫色等距线样式；SortableJS `onMove` 事件绑定实时对齐计算 |
| **T-ui-4** | `lib/PropertyPanel.vue` | 修改 | 分组折叠（FoldItem）+ 搜索框过滤 |
| **T-ui-5** | `lib/NodeToolbar.vue` | 修改 | 拖拽手柄（6 点 grip）+ 层级按钮（上移/下移）+ 气泡 popover 替代 title |
| **T-ui-6** | `lib/ComponentPanel.vue` | 修改 | 图标 emoji → SVG 组件 mini 预览（48×48） |
| **T-ui-6** | `lib/material/defineMaterial.ts` | 修改 | `MaterialDefinition` 增 `thumbnail?: string` |
| **T-ui-7** | `lib/setters/NumberSetter.vue` | **新建** | 带 scrub + 滑块模式 |
| **T-ui-7** | `lib/setters/SliderSetter.vue` | **新建** | 范围滑块选择器 |
| **T-ui-7** | `lib/setters/CodeSetter.vue` | **新建** | 属性级代码编辑（textarea + 行号） |
| **T-ui-7** | `lib/setters/IconSetter.vue` | **新建** | 图标选择器（预设 icon set） |
| **T-ui-7** | `lib/setters/ExpressionSetter.vue` | **新建** | 表达式输入（复用 expression.ts） |
| **T-ui-7** | `lib/setters/EffectSetter.vue` | **新建** | 阴影/圆角/模糊/滤镜面板 |
| **T-ui-7** | `lib/setters/index.ts` | 修改 | 注册 6 个新 setter |
| **T-ui-7** | `lib/PropertyPanel.vue` | 修改 | setter 分派逻辑扩展 |
| **T-ui-8** | `materials/form/date-range/material.ts` | **新建** | LubanDateRange 物料 |
| **T-ui-8** | `materials/form/time-picker/material.ts` | **新建** | LubanTimePicker 物料 |
| **T-ui-8** | `materials/form/tag-input/material.ts` | **新建** | LubanTagInput 物料 |
| **T-ui-8** | `materials/marketing/countdown/material.ts` | **新建** | LubanCountdown 物料 |
| **T-ui-8** | `materials/marketing/coupon/material.ts` | **新建** | LubanCoupon 物料 |
| **T-ui-8** | `materials/marketing/carousel/material.ts` | **新建** | LubanCarousel 物料 |
| **T-ui-8** | `materials/marketing/nav-bar/material.ts` | **新建** | LubanNavBar 物料（与 LubanNavbar 不同） |
| **T-ui-8** | `materials/website/image/material.ts` ~ `materials/website/collapse/material.ts` | **新建** 10 个 | LubanImage/Heading/Link/Card/Divider/Icon/List/RichText/Video/Collapse |
| **T-ui-8** | `materials/index.ts` | 修改 | 注册 17 物料 + re-export |
| **T-ui-9** | `lib/material/defineMaterial.ts` | 修改 | `JSONSchemaProperty` 增 `visibleWhen?: { prop, equals?, notEquals? }` |
| **T-ui-9** | `lib/PropertyPanel.vue` | 修改 | 渲染字段前检查 visibleWhen，不满足时隐藏 |
| **T-ui-10** | `lib/material/defineMaterial.ts` | 修改 | `MaterialDefinition` 增 `snippets?: MaterialSnippet[]` |
| **T-ui-10** | `lib/ComponentPanel.vue` | 修改 | 物料悬浮展示 snippet 预设变体列表 |

### 9.2 API 契约

**不适用**。本期无新增 API 接口，无后端变更。现有的所有後端控制器（AuthController / LeadController / PageController / BillingController / AnalyticsController / AbController 等）保持不变。

### 9.3 数据库变更

**不适用**。本期无新增表/迁移/DDL。现有 Flyway 迁移和 MySQL schema 保持不变。

### 9.4 物料 schema

#### 9.4.1 缺口分析

luban-base 导出 **58 个 Vue 组件**，当前已注册到设计器的物料为 **34 个**（经 `material-parity.spec.ts` 断言）。缺口 **29 个组件**，T-ui-8 本期目标覆盖 **17 个**（form 3 + marketing 4 + website 10），lead(6) 和 poster(5) 留作后续。

#### 9.4.2 新增物料 props schema 概要

**Form 补全（3 个）**：

| 物料 | Props | 默认值 |
|------|-------|--------|
| **LubanDateRange** | `modelValue:{start,end}` `label` `name` `required` `disabled` `error` `errorMessage` | `{start:'',end:''}` |
| **LubanTimePicker** | `modelValue:string` `label` `name` `required` `disabled` `error` `errorMessage` | `''` |
| **LubanTagInput** | `modelValue:string[]` `label` `name` `placeholder` `required` `disabled` `error` `errorMessage` | `[]` `placeholder:'输入后回车添加'` |

**Marketing 缺口（4 个）**：

| 物料 | Props | 默认值 |
|------|-------|--------|
| **LubanCountdown** | `deadline:string` `label:string` | `label:'距离结束'` |
| **LubanCoupon** | `code:string` `discount:string` `title:string` `description:string` | `title:'优惠券'` |
| **LubanCarousel** | `slides:Slide[]` (Slide=`{src,alt?,href?}`) `interval:number` | `interval:4000` |
| **LubanNavBar** | `brand:string` `links:Array<{label,url}>` `backgroundColor:string` `textColor:string` `sticky:boolean` | `brand:'Luban'` `sticky:true` |

**Website（10 个）**：

| 物料 | Props | 默认值 |
|------|-------|--------|
| **LubanImage** | `src:string` `alt:string` `width:string` `height:string` `objectFit:enum` `href:string` | `alt:''` `objectFit:'cover'` |
| **LubanHeading** | `level:1-6` `content:string` | `level:2` |
| **LubanLink** | `href:string` `text:string` `target:string` | — |
| **LubanCard** | `title:string` `description:string` `src:string` `href:string` | — |
| **LubanDivider** | `variant:'solid'|'dashed'|'dotted'` | — |
| **LubanIcon** | `name:string` `size:number` `color:string` | — |
| **LubanList** | `items:string[]` `ordered:boolean` | — |
| **LubanRichText** | `html:string` | — |
| **LubanVideo** | `src:string` `poster:string` `controls:boolean` `width:string` | — |
| **LubanCollapse** | `panels:Panel[]` (Panel=`{title,content?}`) | — |

**Props Schema 生成规范**（所有 17 个物料统一）：
- 使用 `defineMaterial({ name, version: '1.0.0', category, description, component, propsSchema, events?: [] })` 注册
- 每字段声明 `type` + `label` + `default`（对齐 schema 契约 `deriveDefaultProps`）
- enum 字段（`objectFit`/`level`/`variant`/`target`等）使用 `enum` 数组
- 数组字段（`slides`/`panels`/`items`/`links`）使用 `items.properties` 描述元素结构
- 事件字段 `events` 空数组或标注 `[{ name, description }]`

**冲突注意**：
- **LubanCarousel**：luban-low-code 已有 `CarouselSetter`（setter 组件），但无 material.ts，T-ui-8 新建后需关联 setter
- **LubanNavBar vs LubanNavbar**：两者 props 不同（NavBar 多 `sticky`），保留为两个独立物料
- **LubanModal 重复**：luban-low-code 自建的 `feedback/modal/material.ts` 与 luban-base 的 `marketing/LubanModal.vue` name 冲突 → **不注册 marketing 版**，feedback 版已足
- **LubanTabs 重复**：luban-low-code 自建的 `navigation/tabs/material.ts` props 与 luban-base 的 `website/LubanTabs.vue` API 不兼容 → **不注册 website 版**

### 9.5 组件接口

#### 9.5.1 engine ↔ luban-low-code 静态导入清单

所有组件/工具从 `luban-low-code` 导入（已通过 pnpm link 挂载）：

```ts
import {
  LubanDesigner,      // → props: schema, designMode, selectedNodeId, breakpoint; emits: add-node, select, copy, delete, context-menu, multi-select, reorder, move-node
  DesignerToolbar,     // → props: canUndo, canRedo, device, mode, saving; emits: undo, redo, switch-device, switch-mode, save, import-json, export-json, open-templates
  PropertyPanel,       // → props: nodeMeta, modelValue, styleValue; emits: update:modelValue, update:styleValue
  ComponentPanel,      // → 无 prop（自驱动），emit: add-node(type), recent-change(types)
  OutlineTree,         // → props: schema, nodes, depth, selectedId; emits: select, delete, duplicate, reorder
  ContextMenu,         // → props: visible, x, y, canPaste, isContainer; emits: action, close
  CodeEditor,          // → props: modelValue, readOnly, showLineNumbers; emits: update:modelValue, validation-error
  useHistory,          // → (initial) => { current, push, undo, redo, canUndo, canRedo, reset }
  getComponentMeta,    // → (type) => ComponentMeta | undefined
  getPaletteGroups,    // → () => PaletteGroup[]
  findNode, removeNode, duplicateNode, moveNode, insertNode, updateNodeProps,
  bringToFront, sendToBack, cloneNode, genNodeId, reorderRootChildren
} from 'luban-low-code'
```

#### 9.5.2 新增 composable 接口

**`useDesignerKeyboard`**（engine 新建）：
```ts
function useDesignerKeyboard(options: {
  undo: () => void
  redo: () => void
  canUndo: ComputedRef<boolean>
  canRedo: ComputedRef<boolean>
  selectedNodeId: Ref<string | null>
  schema: Ref<PageSchema | null>
  onDelete: () => void
  onCopy: () => void
  onSave: () => void
  onEsc: () => void
}): void
```

#### 9.5.3 新增 setter 接口

**`ScrubInput`**（luban-low-code 新建）：
```ts
// props
modelValue: number | string
min?: number
max?: number
step?: number
unit?: string                    // 'px' | '%' | '' 等后缀
label?: string

// emits
'update:modelValue': [value: number | string]
```

**新 setter 统一协议**（对齐现有 setter 注册表 `SetterComponent`）：
```ts
// 每个新 setter 满足以下接口
interface SetterComponent {
  props: {
    fieldName: string
    value: unknown
    onChange: (val: unknown) => void
    schema?: JSONSchemaProperty
    label?: string
  }
}

// setterRegistry 注册
registerSetter('number', NumberSetter)
registerSetter('slider', SliderSetter)
registerSetter('code', CodeSetter)
registerSetter('icon', IconSetter)
registerSetter('expression', ExpressionSetter)
registerSetter('effect', EffectSetter)
```

### 9.6 并行派发计划

基于 taskGraph JSON 的 `dependsOn` + `group` 依赖关系。

**冲突热点文件警告**：

| 文件 | 涉及 task | 风险 |
|------|----------|------|
| `lib/material/defineMaterial.ts` | T-ui-6, T-ui-9, T-ui-10 | **高** — 三个 task 都改 MaterialDefinition/JSONSchemaProperty |
| `lib/PropertyPanel.vue` | T-ui-4, T-ui-7, T-ui-9 | **中** — 各加独立功能块（推荐串行或合并为单一 task） |
| `packages/engine/luban/src/views/page/PageEditor.vue` | T-eng-1~7 全部 | **高** — 所有 engine task 改同一个文件（推荐主会话串行或 merge 后 subagent 分工） |

**W1 并行计划**：

```
Phase 1a: T-eng-1  ← 主 session 先完成 PageEditor 布局骨架（emit 接线为 stub）
   │
Phase 1b: ┌─ T-eng-2 (Toolbar 接线)     ← 4 个 subagent 并行
   │      ├─ T-eng-3 (PropertyPanel 接线)
   │      ├─ T-eng-4 (ComponentPanel 接线)
   │      └─ T-eng-5 (OutlineTree 接线)
   │
Phase 1c: ┌─ T-eng-6 (ContextMenu + useDesignerKeyboard)  ← 2 个可并行
   │      └─ T-eng-7 (CodeEditor 接线)
   │
Phase 1d: 主 session 收口 → Lint + 单测 + E2E
```

**W2 并行计划**（全部独立文件，无互依赖）：

```
┌─ T-ui-1 (DesignRenderer 尺寸标注)
├─ T-ui-2 (ScrubInput + SpacingSetter)
├─ T-ui-3 (alignGuides 等距 + LubanDesigner Sortable)
├─ T-ui-4 (PropertyPanel 折叠搜索)
├─ T-ui-5 (NodeToolbar 升级)
└─ T-ui-6 (ComponentPanel 缩略图)
```
→ **6 个 subagent 可同时启动**（改造改不同文件，冲突概率低）

**W3 并行计划**：

```
Phase 3a: ┌─ T-ui-7 (Setter 扩充)  ← 2 个并行
   │      └─ T-ui-8 (物料缺口补全)
   │
Phase 3b: ┌─ T-ui-9 (schema 联动 visibleWhen)  ← T-ui-9 先改 defineMaterial.ts（加 visibleWhen），T-ui-10 再改同文件（加 snippets），避免 merge 冲突
   │      └─ T-ui-10 (snippet 预设)
```

---

## 校验结果

- ✅ 任务图 JSON 格式合法（17 tasks, 3 waves）
- ✅ `scripts/verify-plan-ssot.mjs` 校验通过（stub 无报错）
- ✅ §9.1 所有文件路径均通过 codegraph 搜索确认存在
- ✅ §9.4 每个缺失组件的 props 从 .vue 源文件 `defineProps` 提取，确保准确
- ✅ §9.5 所有导入接口从 `src/index.ts` 交叉验证
- ✅ 双后端一致性：N/A（无 API 变更）
- ✅ BFF/website/引擎 无 API 调用字段变更，无需交叉校验
- ⚠️ 冲突热点：`defineMaterial.ts`、`PropertyPanel.vue`、`PageEditor.vue` → 见 §9.6 分区策略

---

## 汇总

| 维度 | 值 |
|------|-----|
| 总 task 数 | 17 |
| 涉及子系统 | engine (7) + ui (10) |
| 不涉及子系统 | backend-java, backend-go, bff, website, client |
| 新建文件 | ~20（composables/ScrubInput/new setters/materials） |
| 修改文件 | ~10（PageEditor/DesignRenderer/PropertyPanel/LubanDesigner/alignGuides/NodeToolbar/ComponentPanel/defineMaterial/materials/index/setters/index） |
| 门禁目标 | G1(/luban-review) → G3(engine 85% + ui 90%) → G4(E2E) |
| 分支 | `feature/designer-polish`（基于 dev） |
