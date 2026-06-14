<!--
description: electron / flutter / web 三端业务一致
globs: packages/client/**, packages/web/**, packages/engine/**
alwaysApply: false
-->

# 多端业务一致性（MUST）

luban 通过低代码引擎驱动多端渲染，理论上同一 schema 在各端应产出一致的业务表现。但实际各端运行时差异（Chromium / Flutter WebView / Web）会引入分叉。

本规则约束各端业务一致，适用于 `packages/client/luban-electron`、`packages/client/luban-flutter`、`packages/client/luban-cross-plateform`、`packages/web/luban-website`。

## 核心要求

### 1. 业务逻辑一致
- 同一业务能力在各端的：可用功能集、状态机、权限边界、错误处理**一致**
- 不得因端的技术栈差异省略功能（如 web 有"导出"按钮但 electron 没有）

### 2. 数据契约一致
- 各端消费的 BFF API 一致（不各端自造接口）
- 字段映射、错误处理、分页结构一致

### 3. UI 表现一致（容许样式微调）
- 同一页面的信息架构、操作入口、状态展示**一致**
- 容许因平台习惯的样式微调（如 macOS 的交通灯按钮位置），但**不容许**功能缺失

### 4. 用户旅程一致
- 同一任务在各端的步骤数、关键节点一致
- 例：登录流程在 web 是 3 步，在 electron 也应是 3 步（不容许省略）

## 检查清单（改 client / web / engine 时 MUST）

- [ ] 改动是否影响多端？若是，是否各端同步？
- [ ] 新增能力是否在各端均有入口？
- [ ] 状态枚举在各端的中文映射是否一致？
- [ ] 错误处理在各端的表现是否一致？
- [ ] 是否做了多端交叉验证（至少 2 端手测）？

## 引擎驱动的多端渲染

luban 的核心机制是**引擎渲染**：同一 schema 在各端通过引擎渲染为对应平台的 UI。

- 理论上：schema 一致 → 各端渲染一致
- 实际上：各端运行时差异会引入分叉（见下）

### 各端运行时差异

| 端 | 渲染引擎 | 常见差异 |
|----|---------|---------|
| Web（website） | Chromium（最新） | 基线，CSS 支持最完整 |
| Electron | Chromium（嵌入版本） | 版本可能落后；Node 集成 |
| Flutter WebView | 各平台 WebView | iOS WKWebView / Android Chromium 版本碎片化 |

### CSS 子集约定（详见 [`luban-lowcode-engine-quality.md`](./luban-lowcode-engine-quality.md)）

物料样式优先用标准 CSS 子集：
- 布局：flex / grid
- 选择器：基础类、属性选择器
- 避免依赖：`clip-path`、`backdrop-filter`、`container queries`、复杂伪元素

关键样式在多端做交叉验证。

## 各端差异的合理化（允许）

以下差异是**平台习惯**，允许且应当遵守：

| 维度 | Web | Electron | Flutter |
|------|-----|----------|---------|
| 窗口控制 | 浏览器原生 | 自绘交通灯 / 系统原生 | 系统原生 |
| 文件操作 | 受限（下载） | 完整（fs） | 受限 |
| 通知 | Web Notification | 系统 Notification | 系统 Notification |
| 快捷键 | 浏览器约束 | 全局快捷键 | 受限 |
| 离线 | Service Worker | 完整本地 | 完整本地 |

**功能本身**仍须一致（如"导出"功能），只是**实现机制**按平台习惯。

## 多端测试要求

- 每个核心业务能力至少在 2 端做交叉验证
- 关键用户旅程（登录、创建、编辑、删除）做多端 E2E
- engine 渲染 E2E 至少覆盖 web + electron（flutter webview 按需）

详见 [`luban-testing-coverage.md`](./luban-testing-coverage.md)。

## 与文档对齐

- `CLAUDE.md`「硬约束 2：低代码引擎交付门槛」
- [`docs/LOWCODE_ENGINE_SPEC.md`](../../docs/LOWCODE_ENGINE_SPEC.md)
- [`docs/E2E_AGENT_GUIDE.md`](../../docs/E2E_AGENT_GUIDE.md)
