# E2E 数据层断言规范

> 通用 E2E 测试规范：写操作必须验证三层「操作 → API 响应 → 数据持久化」，禁止只查壳、禁止硬等待、禁止假绿。
> 适用：luban 的引擎渲染 E2E、website E2E、多端（electron/flutter/web）E2E、运营后台 E2E。

## 规则

**所有 E2E 测试中的写操作（创建/修改/删除/审批/状态流转），必须同时验证三层：**

```
操作 → API 响应 → 数据持久化
         ↓           ↓
    HTTP 状态码     DB/API 查询确认数据
   + 业务 code      + 页面无错误提示
```

## 性能优化规则

### 1. 禁止 waitForTimeout 硬等待

```typescript
// ❌ 禁止：浪费 3 秒
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);

// ✅ 正确：等网络空闲，通常 <1s
await page.goto(url, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle");
```

### 2. 优先使用条件等待

| 场景 | 推荐方式 |
|------|---------|
| 等待页面加载完成 | `page.waitForLoadState("networkidle")` |
| 等待元素出现 | `expect(locator).toBeVisible({ timeout })` |
| 等待元素消失 | `expect(locator).not.toBeVisible({ timeout })` |
| 等待 API 响应 | `page.waitForResponse(url, { timeout })` |
| 等待自定义条件 | `page.waitForFunction(() => ..., { timeout })` |

仅在前端有未 await 的异步调用且无法用元素状态判断时，才允许短时 `waitForTimeout(1000)` 作为 fallback。

### 3. 适当增加并行 workers

`playwright.config.ts` 中 workers 可通过环境变量控制，建议值 2-3。每 worker 独立浏览器实例。

### 4. 每个测试后断言无错误提示

```typescript
// 全局监听（适合 fixture 级别）
test.afterEach(async ({ page }) => {
  const errorToast = page.locator("[role='alert']");
  const count = await errorToast.count().catch(() => 0);
  if (count > 0) {
    const text = await errorToast.first().innerText();
    throw new Error(`页面出现错误提示: ${text}`);
  }
});
```

## 反例（不能通过验收）

```typescript
// ❌ 只检查 HTTP 状态码
await page.getByRole("button", { name: "确认创建" }).click();
const resp = await page.waitForResponse(...);
expect([200, 409]).toContain(resp.status());
// ❌ 没有验证数据是否落盘
// ❌ 没有检查页面是否有错误提示
// ❌ 没有对齐 Java/Go 双后端
```

HTTP 200 只代表「请求没抛异常」，不代表「业务 SQL 执行成功」或「页面无报错」或「双后端一致」。

## 正例

```typescript
// ✅ 状态码 + 业务 code + 数据层 + 错误提示 + requestId 四重断言
await page.getByRole("button", { name: "确认创建" }).click();
const resp = await page.waitForResponse(...);
expect([200, 409]).toContain(resp.status());

const body = await resp.json();
expect(body.code).toBe(0); // 业务 code

// 数据层验证：通过查询 API 确认数据已持久化
if (resp.status() === 200) {
  const queryResp = await page.request.get(`/api/.../detail?id=${body.data.id}`);
  expect(queryResp.ok()).toBeTruthy();
  const data = await queryResp.json();
  expect(data.data.status).toBe("PENDING");
  expect(data.data.items?.length).toBeGreaterThan(0);
}

// 页面无错误提示
await expect(page.locator("[role='alert']")).toHaveCount(0);

// requestId 对齐后端日志（从响应头提取）
const requestId = resp.headers()["x-request-id"];
if (!resp.ok()) console.error(`失败 requestId=${requestId}`);
```

## luban 双后端特化

写操作 E2E 应在 **Java 和 Go 两个后端**上各跑一遍（或通过环境变量切换），验证：

- 同一写操作在两端返回相同的业务 code 与状态
- 落盘后的数据结构一致
- 错误场景（重复创建、权限不足等）的错误码一致

详见 `docs/DUAL_BACKEND_PARITY.md`。

## Code Review 检查点

代码审查时逐条核查：

- [ ] 这个测试测的是写操作吗？
- [ ] HTTP 状态码断言后，有没有跟进业务 code + 数据层断言？
- [ ] 页面跳转/操作后，是否用了 `waitForTimeout` 硬等待？（应改为条件等待）
- [ ] 测试末尾是否检查了无错误提示？
- [ ] 如果是 409/404 等「操作未执行」的分支，是否明确记录了跳过数据验证的原因？
- [ ] 是否在 Java 和 Go 双后端都验证了？
- [ ] 失败断言是否输出了 `requestId` 便于后端日志对齐？
