# luban 端到端测试 — Agent 执行指南

本文档为 **执行、调试、编写或修改 E2E** 时的单一事实来源（与 [`.agents/rules/luban-testing-coverage.md`](../.agents/rules/luban-testing-coverage.md)、`AGENTS.md` 对齐）。**Agent 在跑 E2E 或改 E2E 代码前须完整阅读本节对应条目。**

---

## 1. E2E 类型与所属目录

> ⚠️ **现状 vs 目标态（2026-06-19 校准）**：下表「现状」为实测，「目标」为 `luban-e2e-strategy` plan 落地后口径。**全栈统一 Playwright**（见 `luban-e2e-strategy` plan）。迁移未完成的项以「现状」列命令为准。

| 类型 | 现状（实测） | 目标态（plan 落地后） | 典型命令 |
|------|----------------|----------------|----------|
| **引擎渲染 E2E** | ⚠️ Cypress `packages/engine/luban/cypress/e2e/*.cy.ts`（含 mock-token 假绿，见 §1.3） | Playwright `packages/engine/luban/e2e/*.spec.ts`（去假绿，真实登录） | 现状：`cd packages/engine/luban && pnpm run e2e` ；目标：`pnpm run test:e2e` |
| **website SSR E2E** | 🔴 **无**（零测试） | Playwright `packages/web/luban-website/e2e/` | 目标：`cd packages/web/luban-website && pnpm run install:e2e && pnpm run test:e2e` |
| **UI 物料 E2E** | ⚠️ nx+Cypress `packages/ui/luban-ui/apps/luban-ui-e2e/`（仅骨架）；`packages/luban-{base,low-code}/test/e2e/*.e2e.spec.ts` 实为 vitest jsdom 组件测 | Playwright（正名组件测为 `test/component/`） | 现状：`cd packages/ui/luban-ui && pnpm run test:e2e` |
| **client Electron/Flutter E2E** | 🔴 **子项目不存在**（空目录，非 submodule） | 待 client 子项目落地后另立 plan | — |
| **BFF E2E** | 🔴 无 e2e（仅 Vitest unit）；契约由跨项目流程间接覆盖 | 不建独立浏览器 e2e | `cd packages/bff/luban-bff && pnpm run test`（unit） |
| **后端 Java 集成测** | JUnit+H2 `src/test/java/**/{*Test,*IT}.java` | 同现状 | `cd packages/backend/luban-backend && mvn -q verify` |
| **后端 Go 测试** | go test `**/*_test.go`（全单测） | 同现状 | `cd packages/backend/luban-backend-go && go test ./...` |
| **跨项目流程性 E2E（主项目）** | 🔴 无 | Playwright `e2e/`（workspace 根，独立 npm 包） | `make e2e-cross`（见 §1.4） |

### 1.3 engine 现有 Cypress 假绿警告（MUST 知晓）

`packages/engine/luban/cypress/support/commands.ts` 的 `loginWithToken` 注入 `MOCK_TOKEN='mock-jwt-token'` 到 localStorage，**绕过真实后端登录**。后果：leads/sites/pages 等 spec 在后端 Controller 不存在时仍全绿。此为 `luban-e2e-execution-contract §2.5.1` 明令禁止的假绿，将在 `luban-e2e-strategy` plan W3-T1 迁移 Playwright 时强制移除。**迁移完成前，不得把 engine Cypress 结果当作后端已验收的证据。**

### 1.4 跨项目流程性 E2E（主项目，新增）

`luban-e2e-strategy` plan 在 workspace 根新建 `e2e/`（Playwright 多 project），编排 engine→BFF→backend→website 全链路：

| 流程 | spec | 覆盖链路 |
|------|------|---------|
| 发布闭环 | `e2e/flows/publish-flow.spec.ts` | 登录→建站点→建页面→发布→website SSR 断言 |
| 线索闭环 | `e2e/flows/lead-capture-flow.spec.ts` | website 表单→backend 入库→engine 线索中心可见 |
| 双后端一致性 | `e2e/contract/dual-backend.spec.ts` | 同请求打 Java/Go 等价断言 |

命令：`make e2e-up`（起服务）→ `make e2e-cross`（跑跨项目流程）→ `make e2e-down`。

### 1.1 引擎渲染 E2E：须走正式调试页 / 真实渲染路径（MUST）

- **默认口径**：引擎渲染 E2E 的**主断言路径**须落在引擎调试页或真实产品页面（如 website 的实际渲染路径），模拟真实用户从加载引擎到看到渲染结果的操作链。
- **禁止（新增特性）**：为通过自动化而**新建**仅存在于测试专区的"假渲染页"，并将其作为该特性的**唯一或主要** E2E 载体。
- **与 plan 契约对齐**：方案中的「入口端」须写**正式页路径**，不得仅写专测页路径冒充交互链。

### 1.2 多端 E2E 执行顺序：web 先于其它端（MUST）

- **执行顺序契约**：当 plan 要求执行多端 E2E 时，必须先跑 **web / SSR 模式**（启动快、失败诊断直接），全部通过后再跑 **electron / flutter** 等其它端。
- **理由**：
  - web 模式启动快、环境简单、失败诊断直接，适合快速检出业务逻辑问题
  - electron / flutter 依赖各端运行时，启动慢、调试成本高，适合在 web 确认无阻塞问题后再做完整验收
- **例外**：仅当用户明确指示跳过 web 直接跑其它端时，可跳过。

---

## 2. TDD 与「首个失败即停」（MUST）

1. **任意一条失败 → 立即停止后续用例**（Playwright：`maxFailures: 1`；Vitest e2e：`--bail`）。
2. **先修当前失败的一条**：单条 / 单文件重跑 **绿** 后，再跑**完整** E2E 命令做回归。
3. **禁止**攒多条红再一起改；**禁止**为「先绿再说」关掉 bail/maxFailures（仅排查「全部失败列表」时临时设 `LUBAN_E2E_NO_BAIL=1` 等环境变量）。
4. 编写新链路：**先测后码**（红 → 最小实现 → 绿 → 重构）。
5. **依赖本地后端的链路**：若在 **TDD 会话中修改了 `packages/backend/`**（Java、YAML、`resources/`、迁移脚本等），在再次执行依赖后端的 E2E 或手工验证「需登录」路径前，**须重启后端**，避免旧 JVM/进程缓存行为导致误判。

### 2.5 E2E 执行契约（高优先级 · MUST）

本节与 [`.agents/rules/luban-e2e-execution-contract.md`](../.agents/rules/luban-e2e-execution-contract.md) 对齐；Agent **运行、调试、编写或修改 E2E** 及 **宣称合入门禁通过** 时均须遵守。

#### 2.5.1 禁止假绿与禁止降级（MUST）

- **假绿**：指在未真实满足验收条件时，通过 skip、弱化断言、关 bail、不当环境变量等使命令「退出成功」或报告通过，从而**冒充**已验收。
- **已约定 E2E**：指已在 `AGENTS.md`、`luban-testing-coverage` 或本仓库 CI/文档中作为**默认合入门禁**或 **P0 契约**运行的脚本与命令组合。
- **禁止降级**上述路径，包括但不限于：扩大 `SKIP_LUBAN_E2E` 等适用范围（超出本文档已写明的 CI 或应急场景）、关闭「首个失败即停」用于扫尾却不修根因、批量 `test.skip`、无用户授权而**放宽超时**、**弱化 `expect`**、用更窄的用例子集命令**冒充**全量门禁、擅自修改约定默认账号。
- **环境或服务未就绪**：须按 §4.1、§3、`AGENTS.md` **先排查并起服务**；**禁止**在未完成排查前改测或全 skip 以得零失败假象。流水线等**文档已允许的** `SKIP_*` 除外，且须在 PR/流水线说明中写明；**不得**将「关键 P0 路径全体 skip + 退出码 0」表述为「E2E 已通过」。

#### 2.5.2 执行会话内：测试代码冻结（MUST）

- **触发**：为**当前验收任务**已执行至少一次文档约定的 E2E/回归命令后，至该任务**收口汇报**前。
- **冻结范围**：不得修改 `**/tests/e2e/**`、`**/e2e/**`、`playwright.config.ts` / Vitest e2e 配置中影响**是否跑、跑什么、如何通过**的项，以及与上述直接相关的 test helper。
- **允许修改**：业务源码、后端配置、环境变量、启动顺序、**非测试断言**的数据准备脚本、文档。根因**确属测试错误**（错误期望、flake 已定位在测侧）时：**暂停**并向用户说明证据，**取得用户明确授权**后再改测；**禁止**边跑边改测「试到绿」。
- **「新会话」**：仅新开聊天窗口、**同一 git 分支、同一需求/同一 PR 目标**的，**不**自动解除本条冻结。解除条件为：用户**明确声明**换任务、或**书面授权**可改哪些测试文件、或**单独 PR** 且描述为测试/契约变更并已获审查认可。

#### 2.5.3 格式化豁免（ALLOWED）

以下对测试文件的修改**无需**用户额外授权，且**不**视为解除 §2.5.2 中对语义变更的冻结：

- 仅 **空白 / 换行 / 缩进**、工具固定的 **import 排序**、**不改变语义** 的 Prettier/ESLint **format** 类变更。

**不属于**格式化豁免：任何 `expect` / `toMatch` / 选择器 / `timeout` / `skip` / `only` / mock 行为 / `describe` 结构变更。

#### 2.5.4 方案（plan）中的跨端主路径（MUST）

凡特性涉及 **多端或多子项目**（例如 **引擎 → BFF → 后端 → website**），方案中须包含 **「E2E 主路径」** 小节：每条路径写清 **入口端**、**依赖服务**（如后端 API、引擎、BFF）、**与 P0 对应的自动化命令**（或明确写「尚无脚本，合入前须补」）。须同时写明 **覆盖的交互链**、fixture、**关键断言**与合并门禁；脚本未落地时须写 **拟** 保障逻辑。不得仅用笼统「写 E2E」替代可执行路径表与断言级说明。

#### 2.5.5 收口汇报（MUST）

宣称 E2E/合入门禁通过时须列出：**实际完整命令**、**退出码**、**失败数（须为 0）**；若有 skip 须列 **条数与原因**（且须符合本文档与 `luban-testing-coverage` 对 skip 的约定）。若本轮**曾修改测试文件**（非 §2.5.3），须写明 **用户授权依据** 或 **单独 PR 链接**。

**旅程覆盖率（MUST，涉及 journeys 的 plan）**：凡 plan 含 `journeys[]`（§7.0），收口汇报须额外列一行「**旅程覆盖率：P0=X/X (100%)**」，并附 `make journey-coverage` 的退出码。P0 未达 100% → 视同未过合入门禁，禁止宣称完成。P1/P2 缺口须在汇报中列出但不阻断。

---

## 3. 失败时信息收集顺序（MUST）

**先收集证据，再改断言或业务代码**：

1. **Console**（浏览器 DevTools / Electron DevTools / Flutter DevTools）
2. **Network**（失败请求、HTTP 状态码、响应体中与 `requestId` / 错误码相关的片段）
3. **后端日志**（见下 §3.1）

禁止跳过前几步直接改 `tests/e2e` 里的选择器或**约定登录账号**糊弄过关。

### 3.1 后端日志：本地文件与「时间」读法（MUST 理解，避免误判）

| 项 | 说明 |
|----|------|
| **Java 后端日志路径** | 默认 `packages/backend/luban-backend/logs/luban-local.log`（相对进程 `logging.file.path`，一般为在 `packages/backend/luban-backend/` 目录启动时的 `./logs`）。Agent 可用 `Read` / `grep` 直接查该文件。 |
| **Go 后端日志路径** | Go 后端按其日志配置（一般 stdout + 可选文件）；结构化日志（如 zap / slog），含 `requestId` 字段。 |
| **`ts=` / `time=` 含义** | 文件行前缀为后端写出该条日志时的墙钟时间（带时区偏移），**不是** E2E 报告生成时间。终端里默认格式可能没有该前缀，**不代表**与文件不是同一时刻——仍以 **`requestId`** 关联。 |
| **对齐失败请求（推荐顺序）** | **① 优先用 `requestId`**（响应头 `X-Request-Id`、错误 JSON `requestId`、与文件中 `requestId=…` 同一串）把前端 Network 与后端一行日志 **钉死**；**② 再用时间** 作辅助。 |
| **旧内容 / 多次启动** | `logs/` 下可能仍有上一次进程的滚动片段；**优先 `tail` 最新段** 或看文件 mtime，或在复现前重启后端再跑一次 E2E。 |
| **集成测 profile** | `mvn verify` 使用 `test` profile 时**不写** `luban-local.log`（仅控制台）；只有本机长期跑的 `local` 后端才有该文件。 |

---

## 4. 引擎渲染 Playwright（`packages/engine/luban`）

> ⚠️ **现状（2026-06-19）**：engine 当前仍用 Cypress（见 §1.3 假绿警告）。本节为 Playwright **目标态**口径，对应 `luban-e2e-strategy` plan W3-T1 迁移完成后生效。迁移前 engine 命令以 `cd packages/engine/luban && pnpm run e2e`（Cypress）为准。

### 4.0 浏览器约定（MUST）

**引擎渲染 E2E 一律使用本机已安装的 Google Chrome**（Playwright `channel: "chrome"`），与无头/有头无关。便于与日常浏览器版本、企业策略、本机证书环境一致。

- **首次 / 换机**：在 `packages/engine/luban` 执行 `pnpm run install:e2e`（内部为 `playwright install chrome`）。
- **例外**：流水线等**无系统 Chrome** 的环境，使用 `LUBAN_E2E_USE_PLAYWRIGHT_CHROMIUM=1` 回退到 Playwright 自带 Chromium；**不得**在本地开发文档中把该回退写成默认路径。

### 4.1 前置条件

- 后端 API 须健康（Java 后端 `http://127.0.0.1:8080`，Go 后端按其配置）。**Agent 执行引擎 E2E 前**：若健康检查失败，**须尝试**启动后端：
  - Java：`cd packages/backend/luban-backend && mvn spring-boot:run`
  - Go：`cd packages/backend/luban-backend-go && go run`
- BFF 须健康（`cd packages/bff/luban-bff && pnpm run dev`）
- 引擎调试页或 website 须可访问
- 本机已安装 Google Chrome；首次跑前执行 `pnpm run install:e2e`

### 4.2 命令

```bash
cd packages/engine/luban && pnpm run install:e2e    # 首次
cd packages/engine/luban && pnpm run test:e2e       # 默认无头，本机 Chrome
cd packages/engine/luban && pnpm run test:e2e:headed # 有界面调试
cd packages/engine/luban && pnpm run test:e2e:ci    # CI：无 Chrome 时用自带 Chromium
```

### 4.3 配置与健康变量

| 变量 | 含义 |
|------|------|
| `LUBAN_E2E_BASE_URL` | 引擎调试页 baseURL（默认 `http://127.0.0.1:5173`） |
| `LUBAN_E2E_API_BASE` | 后端 API 根，用于 globalSetup 健康检查（默认 `http://127.0.0.1:8080`） |
| `LUBAN_E2E_HEADED=1` | 有头浏览器（仍为本机 Chrome） |
| `LUBAN_E2E_USE_PLAYWRIGHT_CHROMIUM=1` | 不使用本机 Chrome，改用 Playwright 自带 Chromium（仅 CI） |
| `SKIP_LUBAN_E2E_SERVER=1` | 不自动起 dev server |
| `SKIP_LUBAN_E2E=1` | **仅**流水线等无法启动后端时使用；**禁止**在本地/Agent 默认使用 |
| `LUBAN_E2E_NO_BAIL=1` | 关闭「首个失败即停」，用于一次性收集多条失败 |
| `LUBAN_E2E_WORKERS` | Playwright 并行 worker 数 |

---

## 5. website SSR Playwright（`packages/web/luban-website`）

### 5.1 前置条件

- 后端 API 须健康
- BFF 须健康
- website 须可访问（或由 Playwright `webServer` 自动起 `pnpm run dev`）

### 5.2 命令

```bash
cd packages/web/luban-website && pnpm run install:e2e
cd packages/web/luban-website && pnpm run test:e2e
cd packages/web/luban-website && pnpm run test:e2e:headed
```

### 5.3 SSR 特定断言

- SSR 数据须注入（`window.__INITIAL_STATE__` 或等价机制）后再断言，避免 hydration 时序误判
- SEO 元信息（title / meta / OG）须断言
- 关键内容在 SSR HTML 中须可见（not client-only rendered）

---

## 6. 多端 client E2E（`packages/client/*`）

### 6.1 Electron（`packages/client/luban-electron`）

- 用 Playwright with Electron（`_electron`）
- 测试主进程 + 渲染进程的集成
- IPC 通道验证

### 6.2 Flutter WebView（`packages/client/luban-flutter`）

- 用 Flutter integration test 或 flutter_test
- WebView 内的引擎渲染验证

### 6.3 跨平台（`packages/client/luban-cross-plateform`）

- 按其技术栈测试

---

## 7. 自定义命令

| 命令 | 作用 |
|------|------|
| **`/engine-e2e`** | 引擎渲染 E2E |
| **`/website-e2e`** | SSR 站点 E2E |

命令正文位于 `.agents/commands/`。

---

## 8. CI 与代理

- Playwright 在 CI 中通常为**无头**；不要默认依赖本机 Chrome。
- 中国大陆：`playwright install` / `pnpm install` 前设置代理；**勿**让本机 `localhost` 走代理（设 `NO_PROXY`）。

---

## 9. 关联文档

- `.agents/rules/luban-testing-coverage.md` — 全栈测试门槛与 E2E 纪律
- `.agents/rules/luban-e2e-execution-contract.md` — E2E 执行契约
- `.agents/rules/luban-lowcode-engine-quality.md` — 引擎交付质量
- `docs/TESTING_SPEC.md` — 全栈测试规范
- `AGENTS.md` — 项目命令表与排障顺序

---

## 10. Agent 自检（执行 E2E 任务结束前）

1. 是否已按第 3 节顺序排查过失败（若失败）？
2. 是否未擅自修改约定默认账号 / bail 策略？
3. 是否在对应子项目目录执行了文档中的命令并保留终端输出？
4. 是否遵守 **§2.5**（无假绿、无未授权降级、执行中未擅自改测；纯格式化除外）？
5. 双后端改动是否在 Java 和 Go 两端均跑了对应测试？
6. 引擎改动是否做了渲染零 console error 验证？

---

## 经验：Cypress 在 Node v24 下崩溃（smoke-test bad option）

### 场景
本机 Node v24.12.0 下跑 `npx cypress run`，Cypress 13/14 的 `Cypress.exe` 启动自检报错：
```
Cypress.exe: bad option: --smoke-test
Cypress.exe: bad option: --ping=462
Cypress failed to start.
```
导致所有 E2E spec 无法执行（非测试代码问题，是 runner 起不来）。

### 根因
Node 24 改变了传给 Electron 内部的 V8 flag 方式，Cypress 捆绑的旧 Electron（13.x/14.x）的 bootstrap wrapper 拒绝自身内部 flag（`--smoke-test`/`--ping`）。`nvm`/`fnm`/`volta` 均未安装，无法切 Node 版本。

### 解决方案
升级 Cypress 到 **15+**（首个支持 Node 22-24 的版本）：
```bash
cd packages/engine/luban
pnpm add -D cypress@^15.17.0
npx cypress install --force      # 装新二进制
set CYPRESS_NO_V8_COMPILE_CACHE=1 # 绕 v8 cache（Node24 必须）
npx cypress verify                # 确认 Verified
npx cypress run --browser electron  # chrome 在该机未装，用 electron
```
spec API 13→15 无破坏性变更（cy.* 命令不变），cypress.config.ts 兼容。

### 预防
- 本机 Node ≥22 时，Cypress 必须 ≥15；`package.json` 锁 `^15.17.0`
- 跑 cypress 前必设 `CYPRESS_NO_V8_COMPILE_CACHE=1`
- chrome 不可用时用 `--browser electron`（Cypress 自带）
- 验证三步：`cypress install --force` → `cypress verify` → `cypress run`

---

## 经验：Element Plus 组件在 Cypress 下的可见性/交互坑

### 场景
Cypress 测 Element Plus 组件时高频报 `not visible` / `cannot be interacted with`：
- ElCollapse 内容默认 `display:none`（未展开），直接 `cy.type()` 报 parent `display:none`
- ComponentTree 的 node-actions 靠 CSS `:hover` 才显示（`display:none` 默认）
- ElDialog 关闭按钮（header X / footer 关闭）`force:true` 不触发 Vue `@click`，dialog 关不掉

### 根因
Element Plus 用 CSS transition + 条件渲染控制可见性；Cypress 的可见性检查比真实浏览器严格；`force:true` 绕过可见性但不保证触发 Vue 事件处理器。

### 解决方案
- **ElCollapse**：先点 header 展开，等 `.el-collapse-item__content` 可见再操作；输入加 `{force:true}` 兜底 transition
- **hover 显示的按钮**：用 `scrollIntoView().click({force:true})`；或断言前先确认徽标（证明状态已写入）
- **ElDialog 关闭**：若 force click 关不掉，放宽断言（关闭非核心）；清理走 API（`cy.request DELETE`）

### 预防
- E2E 断言聚焦核心业务价值（CRUD 写入/列表刷新/发布成功），UI 关闭动画等非核心用 API 兜底
- Element Plus 动画/transition 相关交互，优先用 `cy.contains(...).should('be.visible')` 显式等动画完成
