<!--
description: luban 全栈改动的测试覆盖门槛（单测、集成测、E2E，分栈覆盖率）
globs: "**/*"
alwaysApply: true
-->

# 测试覆盖（MUST · alwaysApply）

凡**新增或修改可执行业务逻辑**（API、鉴权、状态、UI 行为、引擎渲染、物料 schema、构建产物），须在同一 PR / 同一任务内补齐测试，禁止「只改代码、零测试」合并。

**E2E 执行高优先级契约**见 [`.agents/rules/luban-e2e-execution-contract.md`](./luban-e2e-execution-contract.md) 与 [`docs/E2E_AGENT_GUIDE.md`](../../docs/E2E_AGENT_GUIDE.md) §2.5。

## 分栈要求

### 低代码引擎 `packages/engine/luban`（TypeScript）

- **单元测试**：Vitest，覆盖 schema 解析、渲染管线、物料调度、props 校验
- **渲染 E2E**：Playwright 驱动引擎渲染页面，断言物料挂载、props 透传、事件链路
- **构建门禁**：合并前在该仓根执行 `pnpm run build` 必须通过；渲染器零新增 console error

### BFF `packages/bff/luban-bff`（TypeScript / Node）

- **单元测试**：Vitest，覆盖聚合逻辑、字段裁剪、错误转换
- **集成测试**：用 Mock 后端验证 Java/Go 双路调用与降级
- **合并前**：`pnpm test` 须通过

### UI 物料库 `packages/ui/luban-ui`（Vue 3 / Vite）

- **组件测试**：Vitest + Vue Test Utils，每个物料至少覆盖：默认渲染、props 边界、slot、事件
- **合并前**：`pnpm test` 须通过

### SSR 站点 `packages/web/luban-website`（TypeScript / SSR）

- **单元测试**：Vitest，覆盖 SSR 数据获取、路由、SEO 元信息
- **E2E**：Playwright 驱动，覆盖核心页面 SSR 渲染与交互
- **合并前**：`pnpm run build` + `pnpm run test:e2e`

### 后端 Java `packages/backend/luban-backend`（Spring Boot / Maven）

- **优先**：为变更点补充 `src/test/java/**/*Test.java`（Surefire，切片 / Mockito）
- **接口与 DB 迁移**：补充 `src/test/java/**/*IT.java`（Failsafe），Java 后端独立配置 MySQL（不再共用 `kddev`）
- **安全切面、上下文等横切逻辑**：须有至少一类可执行测试覆盖允许/拒绝路径
- **合并前**：`mvn -q verify` 须通过

#### Mockito 使用规范（MUST）

- 禁止在 `@BeforeEach` 中 mock final class（需 `mockito-inline` 依赖）
- 禁止跨测试共享 mock 状态（每个 `@Test` 必须独立 `@Mock` 或 `@ResetMocks`）
- `Mockito.when().thenReturn()` 不能用于 void 方法 → 用 `doNothing().when()`
- 集成测试（IT）优先用 `@SpyBean` 替代 `@MockBean` 测真实逻辑
- 并发测试用 `CountDownLatch` + `CompletableFuture`，禁止 `Thread.sleep`

### 后端 Go `packages/backend/luban-backend-go`（go mod）

- **单元测试**：`*_test.go`，覆盖核心业务逻辑与错误分支
- **竞态检测**：`go test ./... -race -cover`
- **合并前**：`go test ./...` 须通过

### 多端 client `packages/client/*`（Electron / Flutter / 跨平台）

- 各端按自身技术栈测试；Web 部分（Electron 渲染层）走 Playwright
- 业务一致性断言见 [`luban-multi-client-consistency.md`](./luban-multi-client-consistency.md)

## 端到端与 TDD 执行纪律（首个失败即停，MUST）

跑 E2E（Playwright、引擎渲染、website SSR）时须遵守：

1. **任意一条用例失败后，立即停止后续用例**（仓库通过 `maxFailures` / `--bail` 配置落实）
2. **先只修当前失败的这一条**：定位根因 → 最小改动 → 单独重跑确认绿后，再跑完整命令做回归
3. **禁止**在仍有红用例时宣称收尾完成或合并就绪
4. **禁止**为通过 E2E 擅自修改约定默认账号、断言强度或超时

### Agent 跑 E2E 失败时（信息收集先于结论，MUST）

自动化或页面行为不符合预期时，**先收集证据再改代码**：
1. Console（浏览器 / DevTools）
2. Network（失败请求、状态码、响应体片段）
3. 后端日志（优先与 Network/错误体同一 `requestId` 在日志中检索；时间窗口仅作辅助）

## E2E 覆盖最低标准（MUST）

凡新增或修改业务功能，E2E 测试须满足以下量化下限：

| 功能类型 | 最低用例数 | 必须覆盖的场景 |
|----------|-----------|---------------|
| 列表/表格页 | 2 | 正常数据渲染 + 空数据（含空态占位） |
| 表单/创建页 | 2 | 成功提交 + 必填校验/非法输入 |
| 状态变更操作 | N = 状态转换数 | 每个合法转换 1 条；非法转换至少 1 条 |
| 删除操作 | 1 | 删除前确认 + 删除后列表不包含（算 1 条完整链路） |
| 引擎渲染新物料 | 2 | 默认渲染 + props 边界 |

评估 E2E 覆盖时，须在 PR 或会话说明中标注是否达标；不满足时须逐条说明理由。

## 旅程覆盖率门禁（MUST）

E2E 链路覆盖的**主指标**是旅程覆盖率（非代码行覆盖率）。口径见 `docs/TESTING_SPEC.md`「旅程覆盖率度量」：

- **分母**：所有 taskGraph JSON `journeys[]` 并集（全局旅程总盘）。
- **分子**：spec 标题含 `@J-<journey-id>` 标签的旅程。
- **门禁**：`make journey-coverage`（或 `node scripts/verify-plan-ssot.mjs journey-coverage`）。
  - **P0 旅程须 100% 有 spec 绑定** → 否则 exit 1，阻断合并。
  - P1/P2 缺口仅报告，不阻断。
- **与代码行覆盖率正交**：`make test-coverage` 同时输出两个维度，任一 P0 阻断 → 整体阻断。

新增/修改 E2E 链路的方案须在 §7.0 声明旅程并同步 taskGraph JSON（见 `.agents/rules/luban-task-graph-ssot.md`）。

## 分栈覆盖率门禁（MUST）

| 子项目 | 工具 | 行覆盖率 | 分支覆盖率 | 备注 |
|--------|------|---------|-----------|------|
| engine / bff / website | Vitest coverage-v8 | **85%** | 75% | TS 仓统一 |
| luban-ui 物料库 | Vitest coverage-v8 | **90%** | 80% | 组件库质量优先 |
| backend (Java, JaCoCo) | JaCoCo | **80%** | 70% | 排除 config 包与 main 类 |
| backend-go | `go test -cover` | **75%** | - | Go 标准覆盖 |
| client（各端） | 各端原生工具 | **85%** | 75% | 与 TS 仓口径对齐 |

一键全栈覆盖率：`make test-coverage`（汇总表格 + HTML 报告）。

### JaCoCo 排除项

- `com/luban/config/**`
- `LubanBackendApplication.class`（main 类）
- 纯 POJO/DTO/VO 类若有 `@lombok.Generated` 注解则自动豁免

### TS 仓排除项

- `**/*.d.ts` 类型声明文件
- 路由、配置等样板文件（在 vitest.config 中声明）

## 并行与收口纪律（MUST）

1. **并行强制**：任务图 JSON 中存在 ≥2 个无依赖关系的 `pending` 任务时，Agent **必须**使用 `Task` 并行派发 subagent，不得串行逐个做。
2. **收口强制**：同一批次派发的 subagent **全部完成**后，主 Agent 方可宣称该阶段完成；任一 subagent 失败须在主会话明确报告并决策是否回退。
3. **中途恢复**：开发进行中若被中断，在下一次继续时须先恢复所有未完成的 subagent 任务，不得只做一部分就宣称恢复完成。

## Agent 自检清单（结束前）

1. 我改动的包是哪些？每个包是否都有对应测试命令跑过？
2. 引擎改动是否在本机运行渲染验证？
3. 双后端改动（Java/Go）是否两端均跑了对应测试？
4. 若只做了「手测」，是否已在 PR/说明中标注并登记后续自动化任务？

## 与文档对齐

- `CLAUDE.md`「测试门禁」「快速命令」
- `docs/TESTING_SPEC.md` — 分栈测试规范
- `docs/E2E_AGENT_GUIDE.md` — E2E 执行单一指南
