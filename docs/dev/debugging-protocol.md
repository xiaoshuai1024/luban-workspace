# 调试协议 — 测试失败处理流程

> 测试失败≠测试脚本有问题，根因通常在后端。本文是「测试失败 → 根因定位」的标准排查顺序，跨引擎/BFF/双后端(Java/Go)/多端(electron/flutter/web)通用。

## 第一条铁律：禁止修改测试脚本来让测试通过

测试失败时，**永远不要**第一反应去改测试脚本。除非你 100% 确认是测试代码和实现不匹配（比如接口字段变更），否则**禁止修改测试**。

## 正确的排查顺序

```
测试失败
    ↓
1. Console 有没有报错？      ← Playwright `page.on('console')` 或 `assertNoError`
    ↓
2. 后端日志有没有错误？       ← tail -f <service>.log | grep -i error（按 requestId 对齐）
    ↓
3. 用 curl/gh 直接调 API 复现 ← 绕过浏览器/客户端，确认是前端还是后端问题
    ↓
4. 后端日志再查一遍          ← 找到具体异常栈
    ↓
5. 定位根因                  ← 代码实现问题 / 环境问题 / 配置问题 / 双后端不一致
    ↓
6. 修复根因                  ← 改后端代码 / 配环境 / 修配置 / 对齐 Java 与 Go 实现
    ↓
7. 验证                      ← curl → Playwright → E2E（Java 与 Go 双后端都跑）
```

## luban 架构下的特化排查点

由于 luban 是「引擎 → BFF → 双后端(Java/Go)」架构，测试失败时要额外排查：

1. **引擎层**：渲染器是否零新增 console error？物料 schema 是否合规？
2. **BFF 层**：BFF 聚合的字段是否与 Java/Go 后端返回一致？
3. **双后端不一致**：同一接口契约，Java 和 Go 返回体/错误码/状态机是否一致？（见 `docs/DUAL_BACKEND_PARITY.md`）
4. **多端不一致**：electron/flutter/web 业务行为是否一致？（见 `.agents/rules/luban-multi-client-consistency.md`）

## 典型反模式（不能通过验收）

- 连续 3 次修改测试脚本（加 `waitForTimeout`、换 token 获取方式、加 `console.log`），浪费大量时间 → 应第一时间 curl + 看后端日志
- 先怀疑前端代码，排查 30 分钟 → 应直接看后端日志找异常栈
- 仅断言 HTTP 200 → HTTP 200 只代表「请求没抛异常」，不代表「业务 SQL 执行成功」或「双后端一致」

## Spring Boot 路由冲突经验（通用）

所有 PUT/DELETE 的路径参数 `/{id}` 会**贪婪匹配**。如果同 Controller 有 `PUT /{id}` 和 `PUT /reorder`，后者永远不会被命中——Spring Boot 把 "reorder" 解析成 `{id}` 抛 `NumberFormatException`。

**修复模式**：静态路径放在 `/{id}` 之前，或改用不同 HTTP method。

## 验收清单

- [ ] 失败用例是否已用 curl 直连后端复现？
- [ ] 后端日志是否已查（含 Java 与 Go 两端）？
- [ ] 修复后是否在引擎/BFF/双后端四层都验证？
- [ ] E2E 是否真实断言（非假绿，见 `docs/E2E_AGENT_GUIDE.md`）？
