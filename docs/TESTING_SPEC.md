# 全栈测试规范（luban-workspace）

本文档定义 luban-workspace 全栈测试规范。详细规则见 [`.agents/rules/luban-testing-coverage.md`](../.agents/rules/luban-testing-coverage.md)，E2E 执行见 [`docs/E2E_AGENT_GUIDE.md`](./E2E_AGENT_GUIDE.md)。

---

## 测试优先级

**端到端测试 > 集成测试 > 单元测试**。

端到端测试是验证全流程正确性的**唯一可靠手段**，禁止以"单元测试够了"为由跳过端到端测试。

---

## 分栈覆盖率门禁

| 子项目 | 路径 | 工具 | 行覆盖率 | 分支覆盖率 |
|--------|------|------|---------|-----------|
| 低代码引擎 | `packages/engine/luban` | Vitest coverage-v8 | **85%** | 75% |
| BFF | `packages/bff/luban-bff` | Vitest coverage-v8 | **85%** | 75% |
| UI 物料库 | `packages/ui/luban-ui` | Vitest coverage-v8 | **90%** | 80% |
| SSR 站点 | `packages/web/luban-website` | Vitest coverage-v8 | **85%** | 75% |
| 后端 Java | `packages/backend/luban-backend` | JaCoCo | **80%** | 70% |
| client（各端） | `packages/client/*` | 各端原生工具 | **85%** | 75% |

一键全栈覆盖率：`make test-coverage`（汇总表格 + HTML 报告）。

### 豁免原则

- Java 后端 `com/luban/config/` 和 `LubanBackendApplication.class` 全局豁免
- 纯 POJO/DTO/VO 类若有 `@lombok.Generated` 注解则自动豁免
- TS 仓 `.d.ts` 类型声明文件豁免
- 路由、配置等样板文件可在 vitest.config 中排除
- 不可实现的分支（如 `if (true)`、不可能的 null 检查）应使用 `/* istanbul ignore next */` 标记
- 其他豁免须在 PR 中说明理由

---

## 端到端测试规范

1. **覆盖所有功能点** — 每个业务功能必须有对应的端到端测试，禁止遗漏或跳过
2. **模拟真实用户操作** — 必须完全按照用户的操作方式来执行：
   - 引擎渲染 E2E：Playwright 驱动引擎渲染页面，断言物料挂载、props 透传、事件链路
   - website SSR E2E：Playwright 驱动 SSR 页面，断言渲染输出与交互
   - client（Electron / Flutter WebView）：各端原生 E2E 工具
   - 禁止使用测试专页、直接调用 API、直接传递参数等绕过 UI 的"捷径"
3. **全链路 PO 流程** — 每个功能的 PO 验收流程，需要从**用户操作**到**后端管理操作**的完整端到端覆盖
4. **数据隔离** — 每个测试场景独立创建/清理数据，禁止测试间共享状态
5. **可重复执行** — 同一测试多次运行结果一致（幂等）

### E2E 覆盖最低标准

| 功能类型 | 最低用例数 | 必须覆盖的场景 |
|----------|-----------|---------------|
| 列表/表格页 | 2 | 正常数据渲染 + 空数据（含空态占位） |
| 表单/创建页 | 2 | 成功提交 + 必填校验/非法输入 |
| 状态变更操作 | N = 状态转换数 | 每个合法转换 1 条；非法转换至少 1 条 |
| 删除操作 | 1 | 删除前确认 + 删除后列表不包含 |
| 引擎渲染新物料 | 2 | 默认渲染 + props 边界 |

### 旅程覆盖率度量（Journey Coverage）

E2E 覆盖率的**主指标是旅程覆盖率，不是代码行覆盖率**。代码行覆盖率（V8/JaCoCo）在 E2E 下会严重虚高（一条链路路过一大片代码但不一定有断言），仅作"死区发现"辅助。

**口径**：
$$\text{旅程覆盖率} = \frac{\text{有 spec 绑定的旅程数}}{\text{已声明的旅程总数}}$$

- **分母**：所有 taskGraph JSON `journeys[]` 的并集（全局旅程总盘，见 `docs/dev/ssot-task-graph.md`）。
- **分子**：spec 标题含 `@J-<journey-id>` 标签的旅程（见 `docs/dev/e2e-test-style-guide.md` §4）。
- **门禁**：`make journey-coverage` → P0 旅程须 100% 有 spec 绑定（阻断合并）；P1/P2 仅报告覆盖率与缺口，不阻断。

**与代码行覆盖率的关系**：二者正交。`make test-coverage` 同时输出两个维度（代码行覆盖率 + 旅程覆盖率），任一 P0 阻断 → 整体阻断。

---

## 集成测试规范

### 后端 Java（`*IT.java`）

1. 用 Surefire/Failsafe 运行
2. Java 后端**独立配置 MySQL**（不再共用 `kddev`），各后端独立配置数据库连接
3. 用于验证服务层多组件协作逻辑，作为 E2E 的补充
4. 合并前 `mvn -q verify` 须通过

### 后端 Go

1. 用 `go test` 运行集成测试
2. 用 testcontainers 或独立测试 DB
3. 与 Java 端的契约对齐用 contract test 验证

### 双后端 Contract Test（推荐）

维护一份 contract test 套件：同一组请求分别打 Java 与 Go 后端，断言响应等价（结构、关键字段、错误码）。详见 [`docs/DUAL_BACKEND_PARITY.md`](./DUAL_BACKEND_PARITY.md)。

---

## 单元测试规范

1. **覆盖率要求高** — 核心业务逻辑（Service 层）单元测试覆盖率目标 ≥ 90%
2. **纯 POJO 测试** — 不启动 Spring 容器（Java），依赖全部 mock；Go 用标准 testing 包
3. **不 mock 自己** — 不测试私有方法，只通过公有方法覆盖分支逻辑
4. **每种错误分支至少一个用例** — 成功路径 + 每种失败路径

### Java Mockito 使用规范（MUST）

- 禁止在 `@BeforeEach` 中 mock final class（需 `mockito-inline` 依赖）
- 禁止跨测试共享 mock 状态（每个 `@Test` 必须独立 `@Mock` 或 `@ResetMocks`）
- `Mockito.when().thenReturn()` 不能用于 void 方法 → 用 `doNothing().when()`
- 集成测试优先用 `@SpyBean` 替代 `@MockBean` 测真实逻辑
- 并发测试用 `CountDownLatch` + `CompletableFuture`，禁止 `Thread.sleep`

### TS 仓 Vitest 使用规范

- `vi.mock` 工厂中引用外部变量时**必须**用 `vi.hoisted()` 包裹（避免 TDZ）
- 不引用外部变量的简单 mock（`vi.mock("module", () => ({ fn: vi.fn() })）`）不受影响
- `@vitest/coverage-v8` 版本须与 `vitest` 主版本匹配（v3 → @vitest/coverage-v8@3）

---

## 测试执行规范

1. **开发阶段** — 每完成一个功能点，先写端到端测试再提交代码（或 TDD 在先）
2. **提交前** — 运行相关测试套件确认全部通过
3. **合并前** — CI 必须通过所有测试
4. **禁止 `@Disabled`/`skip`/`xit` 跳过失败测试** — 测试失败应当修复代码而非屏蔽测试

### 端到端与 TDD 执行纪律（首个失败即停，MUST）

跑 E2E 时须遵守：

1. **任意一条用例失败后，立即停止后续用例**（仓库通过 `maxFailures` / `--bail` 配置落实）
2. **先只修当前失败的这一条**：定位根因 → 最小改动 → 单独重跑确认绿后，再跑完整命令做回归
3. **禁止**在仍有红用例时宣称收尾完成或合并就绪

### 失败时信息收集顺序（MUST）

**先收集证据，再改断言或业务代码**：

1. Console（浏览器 DevTools）
2. Network（失败请求、HTTP 状态码、响应体片段）
3. 后端日志（优先与 Network/错误体同一 `requestId` 在日志中检索；时间窗口仅作辅助）

---

## 测试编写规范

1. **命名：** `方法名_should_预期行为`（如 `createMaterial_shouldRejectInvalidSchema`）或 `describe("...", () => { it("should ...") })`
2. **结构：** Given-When-Then 三段式（空行分隔）
3. **断言：** 明确断言预期结果，不写无断言的烟雾测试
4. **无日志断言** — 不 assert 日志输出
5. **代码风格保持一致** — 参考项目中已有的同类测试

---

## 测试 Review 规范

Review 测试代码时逐条检查：

- [ ] 端到端测试是否覆盖本功能的所有 PO 流程？
- [ ] 是否完全模拟用户操作（无 API 直调、无参数注入）？
- [ ] 单元测试是否覆盖所有分支（成功 + 每种失败路径）？
- [ ] 测试是否可重复执行、相互隔离？
- [ ] 是否使用了 `@Disabled` / `skip` / `xit` 跳过测试？（禁止）
- [ ] 测试代码是否存在冗余/重复逻辑需要抽取 fixture？
- [ ] 命名是否符合规范？
- [ ] 双后端改动是否有 contract test 覆盖？
- [ ] 引擎改动是否有渲染 E2E 覆盖？

---

## 各子项目测试命令速查

### TS 仓（engine / bff / ui / website）— pnpm

```bash
cd packages/engine/luban && pnpm install
cd packages/engine/luban && pnpm test              # Vitest 单测
cd packages/engine/luban && pnpm run build         # 构建（合并前 MUST）
cd packages/engine/luban && pnpm run test:e2e      # Playwright E2E
cd packages/engine/luban && pnpm run test:coverage # 覆盖率报告
```

### 后端 Java — Maven

```bash
cd packages/backend/luban-backend
mvn -q verify                  # 单测 + 集成测 + JaCoCo check
mvn -q test                    # 仅单测
mvn spring-boot:run            # 本地启动
mvn jacoco:report              # 仅生成覆盖率报告
# 报告位置：target/site/jacoco/index.html
```

### 后端 Go — go mod

```bash
# Go 后端已废弃
go test ./... -race -cover     # 全部测试 + 竞态检测 + 覆盖率
go test ./... -run TestXxx     # 单个测试
go test -coverprofile=cover.out ./... && go tool cover -html=cover.out  # HTML 覆盖率报告
```

### 全栈门禁

```bash
make test-coverage             # 一键分栈覆盖率汇总 + HTML 报告
```

---

## Agent 自检清单（结束前）

1. 我改动的子项目是哪些？每个子项目是否都有对应测试命令跑过？
2. 引擎改动是否在本机运行渲染验证（零 console error）？
3. 双后端改动（Java/Go）是否两端均跑了对应测试？
4. 跨子项目改动是否有 contract test / 跨包 E2E 覆盖？
5. 若只做了「手测」，是否已在 PR/说明中标注并登记后续自动化任务？
