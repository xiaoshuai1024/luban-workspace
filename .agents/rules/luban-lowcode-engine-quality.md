<!--
description: 低代码引擎交付门槛：零console error / 物料schema / 各端渲染一致
globs: packages/engine/**, packages/ui/**
alwaysApply: false
-->

# 低代码引擎交付质量（用户强约束，替代微信小程序合规）

**这是 luban 平台的最高优先级约束（见 `CLAUDE.md` 硬约束 2）。**

用户要求：**凡改动引擎、物料或 schema，交付后引擎渲染器不得出现因本次改动引入的 console error**；亦不得出现编译错误或 schema 校验失败。禁止「功能看似完成、引擎渲染一片红」再交给用户。

## Agent 在收尾前必须做到

1. **构建门禁**：凡改动 `packages/engine/luban/` 或 `packages/ui/luban-ui/` 下可能影响渲染的代码（schema 定义、物料组件、渲染管线、props 类型、依赖），在宣称完成前在该仓根执行
   `cd packages/engine/luban && pnpm run build`
   并确认 **命令成功退出**（编译失败 = 未完成）。

2. **物料 props schema 子集**：物料 props 须以 JSON Schema（或等价 TS 类型 + 运行时校验）声明，禁止"运行时凭空字段"。schema 不合规的物料禁止注册到引擎。详见 [`luban-material-schema.md`](./luban-material-schema.md)。

3. **渲染验证**：自动化无法完全替代真实渲染。Agent 若无法在本环境启动引擎，须在回复中明确列出 **已执行的构建命令与结果**，并提醒合并前由作者在引擎调试页 **再扫一眼 Console + schema 校验面板**；若 Agent 能执行构建，则不得以「仅单测通过」作为引擎侧完成的唯一依据。

4. **各端渲染一致**：引擎产物在 `packages/web/luban-website`（SSR）以及多端 client（electron / flutter webview / web）渲染须一致；同一 schema + 同一物料在各端表现不可分叉。详见 [`luban-multi-client-consistency.md`](./luban-multi-client-consistency.md)。

5. **与 `verification-before-completion` 一致**：凡对外声称「已修好 / 已完成」引擎相关项，须具备 **构建成功 + 渲染零 error** 的证据；否则只描述为「已改代码，待你在本地 build + 引擎调试页确认」。

---

## 经验：物料 props schema 缺失导致渲染崩溃

### 场景
新增物料未声明 props schema，引擎渲染时因 props 未校验直接传给组件，遇到 undefined 字段抛错。

### 根因
引擎依赖 schema 做字段裁剪、默认值填充、类型校验；无 schema 的物料等于"裸组件"，任何运行时脏数据都会穿透。

### 解决方案
每个物料必须：
1. 在物料定义文件中声明 `propsSchema`（JSON Schema）
2. 引擎在渲染前用 schema 校验 props，缺失字段填默认值
3. 不合规字段记 warn 并用默认值兜底，**不抛错**

### 预防
- 新增物料时同步声明 schema
- CI 跑 schema 校验脚本（如有），缺失 schema 的物料禁止注册

---

## 经验：引擎渲染异步时序问题

### 场景
渲染器在 schema 引用的物料尚未注册完成时就尝试渲染，console 报 "material not found"。

### 根因
物料注册是异步的（动态加载），但渲染调度未等待注册完成。

### 解决方案
- 渲染前等待所有 schema 引用的物料就绪（Promise.all + 超时兜底）
- 物料缺失时显示占位组件 + console warn，**不抛错中断渲染**
- 物料加载失败的容错：fallback 到内联文本或骨架

---

## 经验：物料组件 throw 导致整页白屏

### 场景
某个物料组件内部 throw（如 props 解构时访问 undefined），引擎未做错误边界，导致整页白屏。

### 根因
引擎缺少 ErrorBoundary，单个物料崩溃级联到整棵渲染树。

### 解决方案
- 每个物料挂载点用 ErrorBoundary 包裹
- 单个物料 throw 时显示错误占位（"该组件加载失败"），不影响其它物料
- 错误信息上报到监控（如 Sentry），不静默吞掉

---

## 经验：schema 循环引用导致渲染栈溢出

### 场景
schema 中容器物料嵌套自身（如 `List` 内嵌 `List`），未做循环检测，递归渲染栈溢出。

### 解决方案
- 渲染前对 schema 做循环引用检测（visited set）
- 设最大嵌套深度（如 20 层），超出显示占位
- 文档中明确容器物料的嵌套约束

---

## 经验：物料版本不兼容

### 场景
schema 引用 `Button@1.0.0`，但已注册的是 `Button@2.0.0`，props 接口已变更，渲染时 props 不匹配。

### 解决方案
- 物料注册时声明 semver 版本
- schema 引用物料时记录版本
- 引擎在版本不匹配时尝试兼容降级（如 v1 props → v2 props 的适配层）或显示警告
- 详见 [`luban-material-schema.md`](./luban-material-schema.md) §版本治理

---

## 经验：各端渲染差异 — CSS 子集不一致

### 场景
同一物料在 web 正常，在 electron 渲染层或 flutter webview 中样式错乱。

### 根因
各端 CSS 引擎差异（Chromium 版本、私有属性、webview 限制）。

### 解决方案
- 物料样式优先用标准 CSS 子集（flex / grid / 基础选择器）
- 避免依赖 `clip-path`、`backdrop-filter` 等各端支持度不一的属性
- 关键样式在多端做交叉验证
- 详见 [`luban-multi-client-consistency.md`](./luban-multi-client-consistency.md)
