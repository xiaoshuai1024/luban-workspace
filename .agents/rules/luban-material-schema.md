<!--
description: 物料注册 / props schema / 版本治理
globs: packages/ui/**, packages/engine/**
alwaysApply: false
-->

# 物料 schema 与版本治理（MUST）

luban 低代码引擎以**物料 + schema**驱动渲染。物料是 `packages/ui/luban-ui` 注册的组件，schema 描述物料如何被引擎调度、props 如何校验。

详细规范见 [`docs/LOWCODE_ENGINE_SPEC.md`](../../docs/LOWCODE_ENGINE_SPEC.md)。

## 物料定义（每个物料 MUST 声明）

每个物料在注册时必须包含：

```typescript
export const MyMaterial = defineMaterial({
  name: "LubanButton",          // 唯一名（PascalCase）
  version: "1.0.0",             // semver
  category: "general",          // 分类（general / form / layout / data-display ...）
  description: "通用按钮",       // 中文描述
  component: LubanButtonVue,    // Vue 3 组件
  propsSchema: {                // JSON Schema 描述 props
    type: "object",
    properties: {
      type: { type: "string", enum: ["primary", "default", "danger"], default: "default" },
      size: { type: "string", enum: ["sm", "md", "lg"], default: "md" },
      label: { type: "string", default: "" },
      disabled: { type: "boolean", default: false },
    },
  },
  events: [                     // 物料可触发的事件
    { name: "click", description: "点击" },
  ],
  slots: [                      // 物料可接受的插槽
    { name: "default", description: "默认插槽" },
  ],
});
```

## 强制要求

### 1. propsSchema MUST 存在
- 每个物料必须声明 `propsSchema`（JSON Schema）
- 无 schema 的物料禁止注册到引擎
- 引擎在渲染前用 schema 校验 props，缺失字段填默认值

### 2. 字段必须有默认值
- `propsSchema` 中所有字段必须声明 `default`
- 引擎依赖默认值兜底，避免 undefined 导致渲染崩溃

### 3. 字段必须有中文描述
- 每个字段 `description` 为中文（用于引擎属性面板展示）
- 枚举值须可读（`primary` 而非 `1`）

### 4. 物料名 MUST 唯一
- `name` 在全引擎范围唯一（PascalCase）
- 同名物料冲突时报错，禁止覆盖

### 5. 版本治理
- 每个物料声明 semver 版本
- schema 引用物料时记录版本（`{ name, version }`）
- 引擎在版本不匹配时：
  - major 不一致（破坏性变更）：尝试兼容降级或显示警告
  - minor / patch 不一致：默认兼容
- 物料升级到新 major 版本时，旧版本须保留（别名 `Button@1.x`）

## 物料注册流程

1. 在 `packages/ui/luban-ui/src/materials/<category>/<name>/` 创建物料
2. 声明物料定义（如上）
3. 在 `packages/ui/luban-ui/src/materials/index.ts` 注册导出
4. 引擎通过物料清单（manifest）加载
5. 同步更新物料文档（如有）

## 物料测试要求

每个物料至少覆盖：
- 默认渲染（所有 props 取默认值）
- props 边界（每个 enum 值、空值、非法值）
- slot 渲染
- 事件触发

详见 [`luban-testing-coverage.md`](./luban-testing-coverage.md)。

## 物料 schema 校验

引擎渲染前对 schema 做：

1. **结构校验**：JSON Schema 语法合法
2. **物料存在性**：schema 引用的物料名是否已注册
3. **版本兼容性**：版本是否匹配
4. **props 校验**：用物料的 `propsSchema` 校验实际 props
5. **循环引用检测**：容器物料嵌套检测（防止栈溢出）

校验失败的物料：
- 显示错误占位（"该组件加载失败：原因"）
- **不抛错中断渲染**（详见 [`luban-lowcode-engine-quality.md`](./luban-lowcode-engine-quality.md)）
- 上报到监控

## 物料分类约定

| 分类 | 用途 | 示例 |
|------|------|------|
| `general` | 通用组件 | Button、Icon、Text |
| `layout` | 布局容器 | Container、Row、Col、Tabs |
| `form` | 表单组件 | Input、Select、DatePicker、Switch |
| `data-display` | 数据展示 | Table、List、Card、Tag |
| `navigation` | 导航 | Menu、Breadcrumb、Pagination |
| `feedback` | 反馈 | Dialog、Drawer、Toast、Loading |

新增分类须在引擎物料清单中登记。
