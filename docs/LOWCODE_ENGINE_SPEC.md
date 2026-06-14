# 低代码引擎 / 物料 / Schema 规范（luban-workspace）

本文档定义 luban 低代码引擎的核心规范：引擎架构、物料定义、schema 规范、版本治理、渲染管线。

**这是 luban 平台的核心约束**（见 `CLAUDE.md` 硬约束 2 与 `AGENTS.md` 系统优先级）。

---

## 1. 引擎架构

```
┌──────────────────────────────────────────────┐
│  Schema（页面描述）                          │
│  {                                           │
│    "version": "1.0",                         │
│    "tree": {                                 │
│      "material": "LubanContainer",           │
│      "props": { ... },                       │
│      "children": [ ... ]                     │
│    }                                         │
│  }                                           │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  Engine（packages/engine/luban）             │
│  - Schema 解析                               │
│  - 物料调度（manifest）                      │
│  - Props 校验（propsSchema）                 │
│  - 渲染管线（React/Vue/原生）                │
│  - 事件系统                                  │
│  - 错误边界（ErrorBoundary）                 │
└──────────────────┬───────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────┐
│  Materials（packages/ui/luban-ui）           │
│  - 物料定义（defineMaterial）                │
│  - Vue 3 组件                                │
│  - propsSchema / events / slots              │
│  - 版本（semver）                            │
└──────────────────────────────────────────────┘
```

### 引擎职责

- **解析 schema**：把 JSON 描述的页面树转换为渲染指令
- **物料调度**：根据 schema 中的物料名 + 版本，从 manifest 加载对应物料
- **props 校验**：用物料的 `propsSchema` 校验实际 props，缺失字段填默认值
- **渲染**：递归渲染页面树
- **事件系统**：物料的 events 上报到引擎，引擎做事件总线
- **错误边界**：单个物料崩溃不级联到整棵树

### 引擎不应做

- 不做业务逻辑（业务在后端）
- 不做数据持久化（持久化在后端）
- 不做权限控制（权限在 BFF/后端）
- 不直接调用后端 API（通过 BFF）

---

## 2. Schema 规范

### 2.1 Schema 结构

```json
{
  "version": "1.0",
  "metadata": {
    "name": "页面名",
    "description": "页面描述",
    "author": "xxx",
    "createdAt": "2026-06-14T00:00:00Z",
    "updatedAt": "2026-06-14T00:00:00Z"
  },
  "tree": {
    "material": "LubanPage",
    "version": "1.0.0",
    "props": {
      "title": "示例页面",
      "layout": "vertical"
    },
    "children": [
      {
        "material": "LubanButton",
        "version": "1.0.0",
        "props": {
          "type": "primary",
          "label": "点击我"
        },
        "events": {
          "click": "handleClick"
        }
      }
    ]
  },
  "handlers": {
    "handleClick": {
      "type": "navigate",
      "url": "/detail"
    }
  }
}
```

### 2.2 Schema 校验规则

引擎渲染前对 schema 做：

1. **结构校验**：JSON Schema 语法合法
2. **物料存在性**：schema 引用的物料名是否已注册
3. **版本兼容性**：版本是否匹配（见 §4 版本治理）
4. **props 校验**：用物料的 `propsSchema` 校验实际 props
5. **循环引用检测**：容器物料嵌套检测（防止栈溢出）
6. **事件处理器存在性**：events 引用的 handler 须在 handlers 中定义

校验失败的物料：
- 显示错误占位（"该组件加载失败：原因"）
- **不抛错中断渲染**
- 上报到监控

### 2.3 Schema 版本

- Schema 顶层 `version` 字段表示 schema 格式版本（当前 `"1.0"`）
- Schema 格式不兼容变更时升级 major 版本
- 引擎同时支持多个 schema 版本（向后兼容）

---

## 3. 物料规范

详见 [`.agents/rules/luban-material-schema.md`](../.agents/rules/luban-material-schema.md)。

### 3.1 物料定义

每个物料必须包含：

```typescript
export const MyMaterial = defineMaterial({
  name: "LubanButton",          // 唯一名（PascalCase）
  version: "1.0.0",             // semver
  category: "general",          // 分类
  description: "通用按钮",
  component: LubanButtonVue,
  propsSchema: { /* JSON Schema */ },
  events: [{ name: "click", description: "点击" }],
  slots: [{ name: "default", description: "默认插槽" }],
});
```

### 3.2 物料分类

| 分类 | 用途 | 示例 |
|------|------|------|
| `general` | 通用组件 | Button、Icon、Text |
| `layout` | 布局容器 | Container、Row、Col、Tabs |
| `form` | 表单组件 | Input、Select、DatePicker、Switch |
| `data-display` | 数据展示 | Table、List、Card、Tag |
| `navigation` | 导航 | Menu、Breadcrumb、Pagination |
| `feedback` | 反馈 | Dialog、Drawer、Toast、Loading |

### 3.3 物料注册流程

1. 在 `packages/ui/luban-ui/src/materials/<category>/<name>/` 创建物料
2. 声明物料定义（如上）
3. 在 `packages/ui/luban-ui/src/materials/index.ts` 注册导出
4. 引擎通过物料清单（manifest）加载
5. 同步更新物料文档（如有）

### 3.4 物料测试要求

每个物料至少覆盖：
- 默认渲染（所有 props 取默认值）
- props 边界（每个 enum 值、空值、非法值）
- slot 渲染
- 事件触发

---

## 4. 版本治理

### 4.1 物料版本（semver）

每个物料声明 semver 版本：`MAJOR.MINOR.PATCH`

- **MAJOR**：破坏性变更（props 接口不兼容）
- **MINOR**：向后兼容的新功能
- **PATCH**：向后兼容的 bug 修复

### 4.2 Schema 引用版本

schema 引用物料时记录版本：`{ material, version }`

### 4.3 引擎版本兼容性检查

引擎在物料版本不匹配时：

| 版本差异 | 行为 |
|---------|------|
| MAJOR 不一致 | 尝试兼容降级（如 v1 props → v2 props 的适配层）或显示警告 |
| MINOR 不一致 | 默认兼容 |
| PATCH 不一致 | 默认兼容 |

### 4.4 物料升级流程

物料升级到新 MAJOR 版本时：

1. 旧版本**保留**（别名 `Button@1.x` 仍可访问）
2. 新版本注册为 `Button@2.0.0`
3. 在物料定义中声明 `migrateFrom` 函数（v1 props → v2 props 适配）
4. 文档记录破坏性变更
5. 现有 schema 渐进迁移（不强制一次性升级）

---

## 5. 渲染管线

### 5.1 渲染流程

```
1. 接收 schema
   │
2. 解析 schema（结构校验）
   │
3. 收集 schema 引用的所有物料
   │
4. 等待物料加载（manifest + 动态 import）
   │
5. 物料缺失 → 占位组件 + console warn
   │
6. 校验每个物料的 props（propsSchema）
   │
7. 循环引用检测
   │
8. 递归渲染（每个物料挂载点用 ErrorBoundary 包裹）
   │
9. 绑定事件处理器
   │
10. 渲染完成
```

### 5.2 错误处理

- 单个物料 throw → ErrorBoundary 捕获 → 显示错误占位
- 物料缺失 → 占位组件 + console warn
- props 不合规 → 用默认值兜底 + console warn（不抛错）
- 循环引用 → 超出最大深度时显示占位
- 整棵渲染树崩溃 → 显示页面级错误页（保留上报通道）

### 5.3 性能优化

- 物料按需加载（dynamic import）
- 渲染结果 memo 化（相同 schema + props 不重复渲染）
- 大列表虚拟滚动（`LubanList` 物料内置）
- 渲染批次合并（多次 schema 更新合并为一次渲染）

---

## 6. 各端渲染一致

详见 [`.agents/rules/luban-multi-client-consistency.md`](../.agents/rules/luban-multi-client-consistency.md)。

- 理论上：schema 一致 → 各端渲染一致
- 实际上：各端运行时差异会引入分叉
- 物料样式用标准 CSS 子集（避免 `clip-path`、`backdrop-filter` 等各端支持度不一的属性）
- 关键样式在多端做交叉验证

---

## 7. BFF 与后端

- 引擎**不直接**调用后端 API
- 引擎通过 BFF 获取数据
- BFF 聚合 Java/Go 后端能力
- 物料如需数据，通过 schema 的 `dataSource` 声明（BFF 端点 + 参数）

### 7.1 dataSource 示例

```json
{
  "material": "LubanTable",
  "props": {
    "columns": [...]
  },
  "dataSource": {
    "type": "bff",
    "endpoint": "/api/v1/users",
    "method": "GET",
    "params": { "page": 1, "pageSize": 20 },
    "dataPath": "items"
  }
}
```

引擎在渲染前请求 dataSource，把响应数据通过 `dataPath` 提取后传给物料的 `data` prop。

---

## 8. 调试与可观测

### 8.1 引擎调试页

- 位于 `packages/engine/luban/debug/`（或 `playground/`）
- 用于运行时验证 schema 渲染、物料挂载
- 允许在开发阶段修改（不属于"产品原型目录"）
- 改动后须在该仓根跑 `pnpm run build` 确认无 console error

### 8.2 渲染监控

- 物料加载失败上报（物料名 + 版本 + 原因）
- 渲染崩溃上报（schema 路径 + 错误堆栈）
- 性能指标上报（首屏时间、物料加载时间）
- 上报到监控（如 Sentry）

---

## 9. 关联文档

- `.agents/rules/luban-lowcode-engine-quality.md` — 引擎交付质量
- `.agents/rules/luban-material-schema.md` — 物料 schema 与版本治理
- `.agents/rules/luban-multi-client-consistency.md` — 多端一致
- `.agents/rules/luban-frontend-ux-enum.md` — 前端 UX 与枚举显示
- `docs/DUAL_BACKEND_PARITY.md` — 双后端契约（BFF 消费）
- `docs/E2E_AGENT_GUIDE.md` — 引擎渲染 E2E

---

## 10. Agent 自检（涉及引擎改动时）

1. 是否在本仓根跑了 `pnpm run build`？
2. 是否在引擎调试页验证了渲染零 console error？
3. 新增物料是否声明了 `propsSchema`（每个字段有默认值、有中文描述）？
4. 改动物料是否考虑了版本兼容性？
5. 改动是否影响多端渲染一致性？
6. 是否补充了对应的物料测试（默认渲染 + props 边界 + slot + 事件）？
