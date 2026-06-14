<!--
description: 运行或修改 E2E（Playwright、引擎渲染、website SSR、多端）前必读 docs/E2E_AGENT_GUIDE.md
globs: "**/*"
alwaysApply: false
-->

# E2E 执行门禁（MUST）

凡**运行、调试、编写或修改**仓库内端到端测试（包括但不限于：`pnpm run test:e2e`、`playwright test`、引擎渲染 E2E、website SSR E2E、Electron 渲染层 E2E，以及编辑 `**/tests/e2e/**`、`**/e2e/**`、`playwright.config.ts`、`scripts/e2e/**`），必须先 **完整阅读**：

**[`docs/E2E_AGENT_GUIDE.md`](../../docs/E2E_AGENT_GUIDE.md)**

并遵循其中的：
- **TDD / 首个失败即停**
- **§2.5 E2E 执行契约**（高优先级：禁止假绿与降级、执行中测试冻结、新会话不自动解冻、纯格式化可豁免）
- **Console → Network → 后端日志** 排障顺序
- **Playwright 默认无头，使用本机 Google Chrome**
- **执行前保证依赖的后端服务已启动**（Java/Go 后端、引擎、BFF）
- **禁止无后端时全体 skip 冒充通过**

另须遵守 [`.agents/rules/luban-e2e-execution-contract.md`](./luban-e2e-execution-contract.md)。

禁止在未阅读该文档的情况下：擅自修改 `tests/e2e` 默认登录账号、关闭 bail/maxFailures（除文档允许的临时环境变量）、或跳过证据收集直接改断言；**禁止**在验收已开始后无用户授权修改测试语义（§2.5.2）。

---

## 经验：E2E 测试可靠性（通用）

- 浏览器上下文级别的测试（`chromium.launch` + 手动登录）比 fixture 自动登录更可靠，不受 storageState 过期影响
- 测试验证步骤导航时使用实际 progress 标识，而非猜测的 active 类
- SSR E2E 须确认 SSR 数据已注入（`window.__INITIAL_STATE__` 或等价机制）后再断言，避免 hydration 时序误判

---

## 经验：低代码引擎渲染 E2E 模式

### 场景
新增物料或修改 schema 后，需要把渲染验证固化成可重复执行的自动化测试。

### 结构规范

```typescript
/**
 * {物料名} 渲染 E2E
 *
 * 用户旅程：
 *   ① 加载引擎 → 注册物料
 *   ② 渲染包含该物料的 schema
 *   ③ 断言物料 DOM 挂载
 *   ④ 断言 props 透传
 *   ⑤ 触发事件 → 断言回调
 */
import { expect, test } from "@playwright/test";

test.describe("{物料} 渲染 @smoke", () => {
  test("默认渲染 + props 透传 @smoke", async ({ page }) => {
    // 加载引擎、注入 schema、断言
  });
});
```

### 命名约定

| 文件 | 用途 |
|------|------|
| `{material}-render.spec.ts` | 物料渲染冒烟 |
| `{feature}-golden-flow.spec.ts` | 黄金流程 |
| `{feature}-e2e.spec.ts` | 完整功能（含边界 case） |

### 标签规范

- `@smoke` — 冒烟级：核心渲染 + 主路径
- `@core` — 核心级：事件链路 + props 边界
- `@e2e` — 全量级：完整用户旅程

---

## 经验：auth.setup storageState origin 必须与测试 baseURL 一致

### 场景
Playwright E2E 测试中，auth.setup 成功写入了 storageState，但测试用例仍显示登录页。

### 根因
`saveAuthStorageState` 以 `origin` 为 key 存储 state。auth.setup 与测试导航的 origin 不一致时，storageState 不共享。

### 解决方案
- Playwright config 中 `baseURL` 固定为一个 origin（如 `http://127.0.0.1:3000`）
- 测试代码中导航使用 `page.goto('/path')` 相对路径
- 禁止硬编码不同 origin

---

## 经验：E2E 测试禁止以环境/数据问题为借口中断

### 场景
测试过程中遇到页面加载失败、API 返回错误、数据不存在等情况时，本能反应可能是跳过测试。

### 根因
luban 各后端独立配置，引擎与 BFF 已经过充分验证可用。任何"环境不可用""依赖不可达""数据缺失"的说法本质上是没有先排查。

### 规则

| 借口 | 正确的排查/修复方式 |
|------|-------------------|
| "引擎没启动" | 在 `packages/engine/luban` 启动 dev / 渲染调试页 |
| "BFF 没启动" | `cd packages/bff/luban-bff && pnpm run dev` |
| "Java 后端没启动" | `cd packages/backend/luban-backend && mvn spring-boot:run` |
| "Go 后端没启动" | `cd packages/backend/luban-backend-go && go run` |
| "缺少数据" | 通过 API 创建 / fixture / SQL |
| "Playwright 没装" | `pnpm exec playwright install chromium` |

三不原则：不跳过、不绕行、不找借口——先排查再说话。

---

## 经验：SSR E2E 数据迁移与 fixture

### 场景
SSR 站点 E2E 因数据库无业务数据而失败。

### 根因
dev 数据库缺少 E2E 测试依赖的业务数据。

### 解决方案
- 在测试 setup 中创建测试数据（通过 BFF 或后端 API）
- 或维护一份 fixture seed 脚本，按各后端独立配置导入
- `afterAll` 中清理测试数据（软删除优先）

### 预防
- 新增 E2E 涉及新模块时，同步确认 dev 数据库是否有对应测试数据
- 测试数据自创建自清理，不依赖外部预置数据
