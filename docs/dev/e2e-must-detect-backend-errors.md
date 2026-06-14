# E2E 必须检测后端错误（硬约束经验）

> 来源：某次 E2E 脚本未检查后端健康状态就直接调 API，导致后端 DOWN 时所有测试仍「通过」（curl 返回空字符串被意外当作成功）。
> 提炼为通用 E2E 硬约束，适用于 luban 全栈 E2E。

## 硬约束

E2E 测试必须能检测后端接口报错。禁止以下行为：

1. **禁止静默失败**：E2E 用例不能吞掉接口错误响应，必须对 HTTP 状态码和业务 code 做显式断言。
2. **后端未运行检测**：E2E 启动前或首次调用失败时必须检测后端是否在运行；若未运行则报错或提示启动，**禁止在后端 DOWN 状态下跳过 E2E 或返回假绿**（退出码 0）。
3. **错误可追溯**：每个失败断言必须输出 `requestId`（从响应头或响应体提取），方便后端日志对齐排查。
4. **curl E2E 规范**：每个 curl 调用必须检查 `$?`（exit code）+ HTTP status + 业务 `code` 字段三重判断，不可只检查 HTTP 200。
5. **客户端自动化 E2E 规范**：每个页面操作必须等待网络请求完成后再断言，禁止固定延迟后盲目断言 UI 状态。

## Why

后端 DOWN 时，curl 返回空字符串，若断言只检查「非空」或「包含某子串」，会被意外当作成功；或在后端返回 500 但前端有 fallback 渲染时，仅断言 UI 元素可见仍通过 → UI 假绿。

## How to apply

写 E2E 脚本时：

1. 第一步必然是 `curl /actuator/health` 等待 UP → 超时则报错（或尝试启动后端），不跳过测试。
2. 每条 curl 断言格式：`check "desc" '"code":0' "$BODY"` — code 不等于 0 即失败。
3. 从响应中 grep `requestId` 或 `X-Request-Id` 打印到失败信息。
4. Playwright 用例：用 `waitForResponse` 等真实 API 完成，并断言响应 `ok()` + 业务 code + 无错误提示。

## luban 双后端特化

后端健康检查需覆盖 **Java 和 Go 两个后端**：

- 两端都要 `/actuator/health`（Java）或等价健康端点（Go）返回 UP
- 写操作 E2E 在两端都跑，任一端返回错误即失败
- requestId 在两端的日志中都可查（字段名一致，见 `backend-logging-executable-plan.md`）

## 关联

- `docs/dev/debugging-protocol.md` — 测试失败排查顺序
- `docs/dev/e2e-data-assertion-rule.md` — 三层断言
- `docs/dev/e2e-test-style-guide.md` §10 — 列表页禁止 UI 假绿
- `docs/E2E_AGENT_GUIDE.md` — E2E 执行单一指南
