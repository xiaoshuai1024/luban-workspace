<!--
description: 前端交互组件选择决策树 + 枚举/状态值中文显示映射（MUST，基准 luban-ui）
globs: packages/**/*.vue, packages/**/*.tsx
alwaysApply: false
-->

# 前端 UX 与枚举显示规范（MUST）

## 组件选择决策树

以下场景必须使用对应的 luban-ui 组件，禁止省事用基础 `<input>` 替代：

| 场景 | luban-ui 组件 |
|------|--------------|
| 选项 ≤ 10 的固定集合（状态、类型、角色、审核结果等） | `LubanSelect` |
| 日期/时间选择 | `LubanDatePicker` / `LubanTimePicker` |
| 布尔值切换 | `LubanSwitch` |
| 多选固定集合 | `LubanSelect multiple` / `LubanCheckboxGroup` |
| 长文本/数字/搜索（仅此用输入框） | `LubanInput` / `LubanInputNumber` |
| 表格 | `LubanTable` |
| 分页 | `LubanPagination` |
| 弹窗 | `LubanDialog` / `LubanDrawer` |

> 实际组件名以 `packages/ui/luban-ui` 注册的导出为准；新增物料时优先扩展 luban-ui，而非各端自造。

## 枚举值中文显示（MUST）

所有 `status` / `type` / `state` / `enum` 类字段在 UI 展示时：

- **website / client（Vue 或各端）**：须用 computed 或 `formatXxx()` 函数映射为中文，禁止 `{{ rawValue }}` 输出英文
- **`LubanTable` 列**：须用 `formatter` 或 slot 映射为中文，禁止直接 `prop="status"`
- **`LubanSelect` 选项**：用 `{ value, label }` 数组，label 为中文
- 优先复用共享常量文件（`packages/ui/luban-ui/src/constants/` 或 BFF 暴露的枚举映射），而非在每个 view 重复定义
- **空值/未定义**：显示 `-` 或 `"未知"`，禁止留空白单元格

## 参考文档

- 枚举映射架构方案见 `docs/UI_SPEC.md`
- Plan 阶段须在方案 §4 中写明枚举显示方案
- 验收阶段须逐项核对

---

## 经验：列表全部显示"暂无信息"

### 场景
某列表页所有条目都显示"暂无信息"，但实际数据存在。

### 根因
后端列表 API 的字段名与前端模板期望的字段名不一致；或后端 SELECT 未包含展示所需列。

### 预防
- **后端列表 API MUST 返回展示字段**：任何列表 API 展示"标题"类字段，必须确认数据源已覆盖
- **单元测试守护**：断言响应体包含展示字段，删除或改动会立即失败
- **前端 fallback 路径要透明**：多级 fallback 要明确，开发时用 E2E 断言验证数据链路

---

## 经验：全栈验收常见问题

#### 1. ID 粒度误用
- 任何涉及"选择实体"的流程，先确认业务需要的是哪一级粒度（spuId / skuCode / materialId 等）
- 接口层类型定义须明确命名

#### 2. 字段语义错配
- CRUD API 的字段必须有且仅有一个语义
- 方案评审时每个字段标注中文含义和取值范围

#### 3. 聚合字段应为只读
- 聚合/汇总类字段（如总价、库存合计）在 UI 上永远是只读的，不提供输入控件
- 应从其它字段计算得出

#### 4. 旧路径迁移
- 后端接口路径迁移时，前端调用必须同步更新
- 删除旧 API 时同步排查 BFF 和前端调用

---

## 经验：ES2022 `.at(-1)` 在 TypeScript/Vue 项目中编译失败

### 场景
使用 `arr.at(-1)` 取数组最后一个元素，`pnpm run build` 报错：
```
error TS2550: Property 'at' does not exist on type '...[]'.
```

### 根因
项目 `tsconfig` 的 `lib` 默认不包含 `ES2022`。`.at()` 是 ES2022 新增方法。

### 解决方案
```typescript
// Before (breaks build)
const last = arr.at(-1);

// After (compatible)
const last = arr[arr.length - 1];
```

### 预防
1. 避免使用 `.at()`、`Object.hasOwn()`、Top-level await 等 ES2022 特性
2. 不确定特性支持度时，先检查 `tsconfig.json` → `compilerOptions.lib`
3. 构建门禁：`vue-tsc -b && vite build` 会捕获此类错误

---

## 经验：design tokens 统一替换法则

### 场景
新增页面使用了硬编码颜色、字号、圆角、阴影，与 luban 设计系统不一致。

### 解决方案 — 批量替换映射

| 硬编码 | Token |
|--------|-------|
| 主文本色 | `var(--luban-color-text)` |
| 次级文本色 | `var(--luban-color-text-secondary)` |
| 三级文本色 | `var(--luban-color-text-tertiary)` |
| 卡片背景 | `var(--luban-surface-elevated)` |
| 页面背景 | `var(--luban-bg-page)` |
| 主色 | `var(--luban-color-primary)` |
| 危险色 | `var(--luban-color-danger)` |
| 圆角 | `var(--luban-radius-*)` |
| 阴影 | `var(--luban-shadow-card)` |

### 预防
- 品类品牌色声明为页面级 CSS 变量 `--brand-xxx`，与 luban-token 共存
- 所有新文件必须在 Code Review 前跑 token 检查

---

## 经验：状态枚举中文映射

### 场景
新增页面 `{{ c.status }}` 直接显示后端英文状态值（如 `PENDING`、`SENT`），违反"所有状态/枚举必须映射为中文显示"规则。

### 解决
所有端（website、client）同样需要中文状态映射：

```typescript
const STATUS_MAP: Record<string, string> = {
  DRAFT: '草稿',
  PENDING: '待处理',
  PROCESSING: '处理中',
  DONE: '已完成',
  CANCELLED: '已取消',
};
// template: {{ STATUS_MAP[c.status] || c.status }}
```

### 预防
1. 审查 agent 的 Vue/前端页面 bucket 应检查所有 `{{ x.status }}` 是否有映射表
2. 统一在 `packages/ui/luban-ui/src/constants/statusLabels.ts` 定义状态映射，各端共享
3. **所有前后端状态枚举**都必须中文映射

---

## 经验：占位功能提示文案规范

"敬请期待" → "功能暂未开放"：
- "敬请期待" 有假功能/画饼之嫌，不符合交付质量要求
- 不要用骨架页冒充真实功能

---

## 经验：分页与错误体规范

涉及列表/分页接口时：
- 响应体结构统一（见 `luban-cross-cutting-standards.md`）
- 错误响应包含错误码与中文消息
- 列表为空时返回空数组而非 null
