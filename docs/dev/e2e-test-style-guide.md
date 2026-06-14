# E2E 测试编写规范

> 本规范将优化成果固化为可执行规则，所有 agent 和开发者在编写 E2E 测试前必须阅读。
> 适用：luban 全栈 E2E（引擎渲染 / website / 多端 / 运营后台）。

## 1. 超时约定

| 场景 | 推荐值 | 说明 |
|------|--------|------|
| 全局 per-test timeout | 60s | `playwright.config.ts` 全局，特殊情况显式覆盖 |
| `page.goto()` | 30s | 本地 SPA 导航应在 3-5s 内完成 |
| `toBeVisible()` | 15s | 首屏/重要元素可见性断言 |
| `toContainText()` | 15s | 异步数据加载后的文本断言 |
| `toBeHidden()` | 10s | 弹窗/抽屉关闭 |
| expect 默认 | 15s | `playwright.config.ts` 全局 |
| 后端异步操作 | 45s | 涉及后端异步任务的测试 |

**核心认知：** 缩小超时不影响绿跑（测试通过时速度不变），但能让红跑（有问题时）更快失败，缩短调试反馈周期。不要随意放大超时掩盖问题。

## 2. 禁止反模式

### `page.waitForTimeout()`
必须用 Playwright 自动等待（`toBeVisible` / `waitFor` / `toHaveURL`）替代。
**例外：** retry 退避循环中的延迟（须加 eslint-disable 注释说明理由）。

### 在有 `storageState` 的 spec 中重复调用登录函数
`auth.setup.ts` 已预认证并写入 `storageState`，每个 spec 共享认证状态。

### CSS class 选择器
优先 `getByTestId`、`getByRole`、`getByText`。测试专用 data 属性命名约定（按端前缀，如 `engine-*` / `website-*`）。

### 跨端测试拆成多次 Playwright 调用
合并到同一次 Playwright 调用内，避免 setup overhead。

## 3. 数据创建原则（禁止 SQL）

所有 E2E 测试数据**必须通过 API 动态创建**，禁止写 SQL INSERT 语句。

### 理由

- SQL 绕过业务逻辑层，可能建立不符合真实约束的数据
- SQL 语句直接依赖数据库 schema，重构或迁移后容易失效
- API 创建的数据经过完整校验和默认值填充，更接近真实用户场景
- SQL 硬编码 ID，违反「所有 ID 由服务端自动生成」原则

### 允许的 API 方式

| 数据类型 | 方式 |
|----------|------|
| 业务实体 | 对应业务 API |
| 用户/会话 | 认证 API / E2E helper API |
| 测试前置数据 | E2E 专用 setup API |

### 例外

- **E2E 基础设施**的 setup/teardown 脚本（不与业务数据直接相关的健康检测、环境检查等）
- **业务数据清理**可通过 API 或 SQL TRUNCATE（仅测试结束后清理，且须由独立脚本执行）

### 强制要求

- 测试代码中出现 `INSERT INTO`、`db.execute`、`mysql.*execute` 等 SQL 构造且非 exception 注释的，Review 必须驳回
- 辅助函数中也不得包含 SQL

## 4. Tag 分档约定

Playwright 测试使用 tag 过滤：

| Tag | 用途 | 预估数量 | 执行时间 |
|-----|------|---------|---------|
| `@smoke` | 核心功能冒烟，开发迭代时必跑 | 5-10 | <1min |
| `@cross` | 跨端串联测试 | 5-10 | ~2min |
| 无 tag | 全量验证（默认），提交/CI 前必跑 | 全部 | ~5-8min |

## 5. luban 多端 E2E 模式

### 引擎渲染 E2E

验证低代码引擎消费物料 + schema 渲染页面的正确性：

- 物料 props 变更后渲染结果符合预期
- 引擎产物在 SSR（website）及各端渲染一致
- 渲染器零新增 console error（见 `docs/LOWCODE_ENGINE_SPEC.md`）

### website SSR E2E

- 服务端渲染的 HTML 结构正确
- hydration 后无 mismatch
- 路由跳转正确

### 多端（electron/flutter/web）E2E

- 同一业务在三个端行为一致
- 环境变量统一注入（如跨端共享的订单号等标识）
- 执行顺序：源端 create → 目标端 verify

## 6. Playwright 配置

- `playwright.config.ts` 配置 `webServer`（`reuseExistingServer: true`），服务已运行时不重复启动
- 默认 `workers: 1`（安全），可通过环境变量启用并行
- 失败自动重试 1 次
- Trace 保留到 `test-results/`

### 选择器优先级

1. `getByTestId()` — 最可靠
2. `getByRole()` + `getByText()` — 次优
3. `locator()` with CSS — 最后手段（必须有注释说明）

## 7. 超时值速查

spec 文件中只在需要**大于**全局值的场景显式设置 timeout：

```typescript
// ✅ 需要大于全局默认值时显式设置
await expect(table).toContainText(text, { timeout: 25_000 });

// ❌ 不需要等于或小于全局默认值
await expect(page).toHaveURL(/pattern/, { timeout: 15_000 }); // 15s 是全局 expect timeout，可省略
```

## 8. 验证 Checklist

提交 E2E 测试代码前检查：

- [ ] 是否避免了 `waitForTimeout`？如有，加 eslint-disable 注释说明理由
- [ ] 是否使用了 `getByTestId` / `getByRole` 而非 class 选择器？
- [ ] **列表/详情页是否断言了关键 API 200 + 业务 code（禁止 UI 假绿）？**
- [ ] timeout 是否在约定范围内？
- [ ] 是否依赖了重复登录？在 `storageState` 模式下不应调用
- [ ] 是否添加了合适的 tag（`@smoke` / `@cross`）？
- [ ] 是否运行过 `pnpm run lint` 且无 error？
- [ ] 是否在 Java 和 Go 双后端都验证了（写操作）？

## 9. eslint-plugin-playwright 规则

| 规则 | 级别 | 说明 |
|------|------|------|
| `no-wait-for-timeout` | error | 禁止 `waitForTimeout` |
| `prefer-native-locators` | warn | 优先使用 `getByTestId`/`getByRole` |
| `no-force-option` | warn | 谨慎使用 `force: true` |
| `valid-expect` | error | 确保 expect 正确使用 |

## 10. 列表页必须断言关键 API（禁止 UI 假绿）

**背景**：列表 API 返回 500，旧用例仅断言表格可见仍通过，形成 UI 假绿。

凡 **依赖后端列表/详情 JSON** 的页面，E2E **至少满足其一**：

1. **直连 API 契约**（推荐用于 smoke）：独立 `*-api-contract.spec.ts`，断言 HTTP 200、业务 code、`items` 等字段。
2. **页面 + `waitForResponse`**：进入页面前 `waitForResponse` 匹配真实列表 URL，断言 `ok()`；并断言 **无** 错误提示。

```typescript
const listResp = page.waitForResponse(
  (r) => r.request().method() === "GET" && r.url().includes("/api/materials") && r.ok(),
  { timeout: 45_000 }
);
await page.goto(`/materials/governance`);
const body = await listResp;
expect(body.ok()).toBeTruthy();
await expect(page.locator("[role='alert']")).toHaveCount(0);
```

**禁止**：仅 `toBeVisible(.el-table)` 或标题文案作为列表页唯一断言。

## 11. 数据清理纪律（硬性要求）

E2E 测试通过 API 或 UI 操作创建的**所有业务数据**，必须保证在测试完成后被清理。违反此规约的 PR 一律驳回。

### 核心原则

1. **谁创建谁清理** — 每个测试对自己写入的数据负责
2. **兜底优先** — `test.afterAll` 必须提供兜底清理，不依赖 `afterEach`
3. **前缀隔离** — 所有 E2E 创建的数据在名称/标识中必须包含 `E2E` 前缀
4. **幂等清理** — 清理逻辑必须幂等：多次执行不报错，已不存在的跳过

```typescript
// ✅ 正确：afterAll 兜底清理
test.describe("功能名称", () => {
  let createdIds: string[] = [];
  test("创建数据", async ({ request }) => {
    const res = await request.post("/api/...", { data: { name: "E2E_测试数据" } });
    createdIds.push((await res.json()).data.id);
  });
  test.afterAll(async ({ request }) => {
    for (const id of createdIds) {
      await request.delete(`/api/.../${encodeURIComponent(id)}`).catch(() => {});
    }
  });
});
```

### 禁止行为

- 创建了数据但无 `afterAll` 兜底清理
- 用 `afterEach` 代替 `afterAll`（单用例失败会跳过 afterEach）
- 依赖外部脚本做清理（CI 中断时脚本不执行）
- 清理失败抛异常阻断后续（应捕获异常，best effort 清理）

### 例外

- 只读测试（不创建、不修改任何数据）不需要清理
- 通过 SQL TRUNCATE 清理的独立脚本仅允许在 CI 专用数据库执行，禁止在共享开发库使用

## 12. 基准 CheckList

每季度或每次大幅改动 E2E 基础设施后，运行基准测试与基线对比，退化超过 20% 则标记回查。
