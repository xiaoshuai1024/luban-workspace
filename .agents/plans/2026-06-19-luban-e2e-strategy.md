---
featureId: luban-e2e-strategy
title: Luban E2E 测试体系 — 各端自洽 + 主项目跨项目流程性 E2E
createdAt: 2026-06-19
status: approved
taskGraph: docs/superpowers/tasks/luban-e2e-strategy.json
contractSource: plan-template 命令体 + writing-plans SKILL + luban-plan-contract.md
scope: 全栈统一 Playwright；engine Cypress→Playwright 迁移+去假绿；website 补 e2e；主项目根 e2e/ 跨项目黄金流程；CI 门禁
split: W0 文档纠偏 → W1 主项目骨架+发布闭环 → W2 website e2e → W3 engine/ui 迁移补强 → W4 CI 门禁
branches: workspace feature/luban-e2e-strategy；engine feature/luban-e2e-migration；website feature/add-e2e；ui feature/luban-e2e-migration
defaults:
  firstDelivery: W1(主项目骨架+发布闭环)
  authAccount: 后端预置专用 e2e 账号，env 注入 LUBAN_E2E_ACCOUNT/LUBAN_E2E_PASSWORD
  dualBackend: Java(8080)+Go 同时在线等价断言
  serviceBootstrap: docker-compose.e2e.yml(干净隔离)
  engineMigrationTiming: 串行 W1→W2→W3(避免同时改 engine 两套)
---

# Luban E2E 测试体系 — 各端自洽 + 主项目跨项目流程性 E2E

> **已定稿（round2 / approved）**。用户已确认全部默认决策：统一 Playwright、首交付 W1、后端预置 e2e 账号、双后端并发、docker-compose 起服务、engine 迁移串行 W3、任务图 JSON 同步产出。任务图 SSOT：`docs/superpowers/tasks/luban-e2e-strategy.json`（12 task）。
>
> **验收口径(MUST)**：各前端子项目有自洽的 Playwright e2e（聚焦自身 UI/渲染）；主项目根 `e2e/` 能编排 engine→BFF→backend→website 跑通「发布闭环」「线索闭环」两条黄金流程；engine 现有 mock-token 假绿消除；无假绿/降级/skip 顶替。

---

## §0 程序概览与现状纠偏

### 0.1 现状（实测，非文档宣称）

| 子项目 | 实际框架 | 实际用例 | 真实性 |
|---|---|---|---|
| engine/luban | Cypress (`cypress/e2e/`) | 5 文件：leads(13)/login(3)/navigation(5)/pages(2)/sites(3) | 🔴 **假绿**：`loginWithToken` 注入 `MOCK_TOKEN='mock-jwt-token'`，后端不存在也全绿 |
| ui/luban-ui | nx+Cypress (`apps/luban-ui-e2e/app.cy.ts`) | 1 条（designer 骨架渲染） | 🟡 骨架，仅 exist 断言 |
| ui/luban-base, luban-low-code | Vitest jsdom mount（命名 `.e2e.spec.ts`） | base 2 + low-code 1 | ⚠️ 名为 e2e 实为组件 mount 测，无浏览器/无后端 |
| web/luban-website | **无** | 0 | 🔴 零测试、零测试依赖 |
| bff/luban-bff | Vitest unit only | 无 e2e 目录 | 🔴 无集成/契约 e2e |
| backend Java | JUnit+H2 | contract 5 + service（含 1 IT） | 🟡 单端集成 |
| backend Go | go test | 8 文件全单测 | 🟡 无双端契约一致性脚本 |
| client-electron / client-flutter | — | — | 🔴 空目录，非 submodule，项目不存在 |

### 0.2 编排/CI 现状

- 根 `Makefile`：有 `test`/`test-coverage`，**无 `e2e` target**。
- `scripts/e2e/engine-render-preflight.sh`：**TODO stub（4 行 echo）**。
- `scripts/contract-check.sh`、`verify-production.sh`：存在但未纳入 Makefile。
- CI：各子仓 `.github/workflows/` 只有 `deploy-prod.yml`/`docker-publish-manage.yml`，**无任何跑测试的 workflow**。

### 0.3 文档 vs 实现脱节（重大）

`docs/E2E_AGENT_GUIDE.md` 描述的 Playwright 体系几乎全是**纸面规划**：宣称的 `tests/e2e/`（Playwright）目录在 engine/website/ui/bff 均**不存在**；engine 实为 Cypress；client e2e 对应的子项目**不存在**。**任何 agent 按该文档跑命令必失败或假绿。**

### 0.4 目标态（用户已决策）

```
各前端子项目：自洽 Playwright e2e（聚焦自身 UI/渲染）
+
主项目（workspace 根 e2e/）：跨项目流程性 e2e（engine→BFF→backend→website 全链路）

统一框架：Playwright
engine Cypress：随 W1 一起迁移到 Playwright
engine 假绿：随迁移消除（真实登录链路）
跨项目 e2e 位置：workspace 根 e2e/（独立 npm 包）
```

---

## §1 需求溯源（gap→task 矩阵）

| Gap（证据） | 层级 | task | E2E 场景 | 门禁 |
|---|---|---|---|---|
| engine cypress mock-token 假绿（`support/commands.ts:14` MOCK_TOKEN） | L0 | W1-T1, W3-T1 | leads/sites/pages 走真实登录+真实 BFF | G1/G3 |
| engine cypress 假绿，与文档 Playwright 口径冲突 | L0 | W0-T1 | E2E_AGENT_GUIDE 文档纠偏 | G1 |
| 无跨项目 e2e（根无 e2e/ 编排） | L0 | W1-T1~T3 | 发布闭环 + 线索闭环 | G2 |
| website 零测试（无 test 文件/依赖） | L0 | W2-T1~T3 | SSR 注入/SEO/hydration/公开页 | G2 |
| 各子项目 e2e 框架不统一（Cypress/nx/Vitest-mix） | L1 | W3-T1~T2 | engine/ui 统一 Playwright | G3 |
| 无双后端契约一致性脚本 | L1 | W1-T4 | 同 BFF 请求打 Java/Go 等价 | G2 |
| scripts/e2e preflight 是 stub | L2 | W1-T3 | 真实预检脚本 | G2 |
| CI 不跑测试，e2e 不进门禁 | L0 | W4-T1~T2 | PR 跑各子仓+workspace e2e | G1 |

无遗漏：所有探针 gap 映射到 W0~W4。

---

## §2 系统与链路

### 2.1 涉及子系统与分层职责

```
workspace（meta 仓）
└── e2e/                          ← 跨项目流程性 e2e（新增，独立 npm 包）
    ├── playwright.config.ts      ← 多 project：engine | website | dual-backend
    ├── auth.setup.ts             ← 真实登录拿 storageState
    ├── flows/                    ← 跨项目黄金流程
    │   ├── publish-flow.spec.ts   （发布闭环）
    │   └── lead-capture-flow.spec.ts （线索闭环）
    └── contract/                 ← 双后端契约一致性

各子项目（自洽 e2e，聚焦自身）
├── engine/luban/e2e/             ← W3 迁移自 cypress/e2e/，Playwright
├── web/luban-website/e2e/        ← W2 新增
└── ui/luban-ui（apps/luban-ui-e2e）← W3 统一 Playwright
```

### 2.2 跨项目黄金流程（主项目 e2e 覆盖的核心）

**流程 A — 发布闭环**（入口：engine 管理台）
```
engine 登录(真实账号) → 建站点 → 建页面 → designer 编排(schema) → 保存(POST BFF→backend)
  → 发布 → 切换到 website 访问该页(带 slug) → 断言 SSR 渲染 + SEO meta + hydration 无 mismatch
  断言点：schema 持久化(backend 可查)、website 公开页可见、title/meta/og 正确
```

**流程 B — 线索闭环**（入口：website）
```
website 公开页 → 表单提交(POST BFF /leads→backend 入库，含去重/加密)
  → 切换 engine 管理台 → 线索中心 → 断言该条记录可见、字段一致、脱敏正确
  断言点：全链路数据一致（姓名/手机号/UTM），去重生效，手机号脱敏 138****8000
```

**流程 C — 双后端一致性**（入口：workspace）
```
auth.setup 拿 token → 同一 BFF 请求分别打 Java 后端(8080) / Go 后端(:port)
  → 断言响应 status + body 结构等价（datasource/leads/pages 核心接口）
  依赖：docs/DUAL_BACKEND_PARITY.md 契约
```

**流程 D — 鉴权闭环**（入口：engine）
```
真实账号登录 → token 存 localStorage → BFF 透传 → backend 校验
  → 伪造/过期 token → 断言 401 + 跳登录页
  断言点：真实 token 链路（替代现有 mock-token 假绿）
```

### 2.3 不做（明确边界 / 后续迭代）

- **client-electron / client-flutter e2e**：子项目不存在，本期不涉及。待 client 子项目落地后另立 plan。
- **ai 包 e2e**：空，不涉及。
- **bff 独立 e2e**：bff 不直接对用户暴露页面，其契约由「流程 A/B/C」经 bff 间接覆盖；不为 bff 单独建浏览器 e2e，仅保留 Vitest unit。
- **后端 e2e（浏览器）**：Java/Go 已有 JUnit/go-test 集成测，浏览器层不重复；双端契约由「流程 C」覆盖。
- **压力/性能 e2e**：非本期目标。
- **视觉回归（screenshot diff）**：非本期目标，后续可加 Playwright `toHaveScreenshot`。

---

## §3 任务表（W0~W4）

| ID | 系统 | 任务 | 依赖 | 验收 |
|---|---|---|---|---|
| **W0-T1** | docs | 修订 `docs/E2E_AGENT_GUIDE.md`：删除不存在的目录/命令，加「现状 vs 目标态」对照表，标注 Playwright 统一口径与迁移说明 | — | 文档不再有幻觉目录；自检 §2.5 引用仍有效 |
| **W1-T1** | workspace | 新建根 `e2e/`：`package.json`(pnpm) + `playwright.config.ts`(多 project) + `auth.setup.ts`(真实登录，env 注入账号) + `tsconfig` + `.env.example` | W0-T1 | `pnpm i && pnpm exec playwright install chrome` 成功；空 spec 跑通 |
| **W1-T2** | workspace | 跨项目起服务编排：根 `docker-compose.e2e.yml` 或 `scripts/e2e/up-all.sh`（backend Java + Go + bff + engine + website，端口固定）+ `Makefile` 加 `e2e-up`/`e2e-down`/`e2e`/`e2e-cross` target | W1-T1 | `make e2e-up` 起齐 5 服务健康检查绿；`make e2e-down` 干净退出 |
| **W1-T3** | workspace | 流程 A 发布闭环 `e2e/flows/publish-flow.spec.ts`（真实登录→建站点→建页面→发布→website SSR 断言）；补 `scripts/e2e/engine-render-preflight.sh` 为真实预检（build 零 console error + schema 合规） | W1-T2 | `pnpm test:e2e --project=engine` 流程 A 绿；任一环节断（如停 backend）则红 |
| **W1-T4** | workspace | 流程 C 双后端一致性 `e2e/contract/dual-backend.spec.ts`（同请求打 Java/Go 等价断言） | W1-T2 | 双端均在线时绿；单端断言差异红（防 drift） |
| **W2-T1** | website | `packages/web/luban-website/` 加 Playwright：`playwright.config.ts`(webServer 自动起 dev) + `auth.setup` + `.env.example` | W0-T1 | `pnpm run install:e2e && pnpm run test:e2e` 骨架跑通 |
| **W2-T2** | website | website e2e：SSR 注入(`__INITIAL_STATE__`) + SEO meta(title/og) + hydration 无 mismatch | W2-T1 | 公开页 spec 绿；关 SSR 渲染断言红 |
| **W2-T3** | workspace | 流程 B 线索闭环 `e2e/flows/lead-capture-flow.spec.ts`（website 提交→engine 线索中心可见，字段/脱敏断言） | W1-T3, W2-T2 | 全链路绿；DB 无对应记录时红 |
| **W3-T1** | engine | engine `cypress/e2e/` → `e2e/`(Playwright) 迁移：login/navigation/sites/pages/leads 5 文件平移；**去 mock-token**，改 `auth.setup` 真实登录；删 cypress 依赖与 `cypress.config.ts` | W0-T1, W1-T1 | Playwright 等价用例绿；停 backend 时 leads/sites 红（证非假绿） |
| **W3-T2** | ui | `apps/luban-ui-e2e`：nx-cypress → Playwright；补物料渲染 e2e（物料挂载+props 透传+事件回调），对齐 `luban-low-code` 物料清单 | W0-T1 | designer 骨架 + 物料渲染 spec 绿 |
| **W4-T1** | ci | 各子仓 `.github/workflows/test.yml`：engine/website/ui 跑各自 Playwright（web/SSR 先于 electron 规则不适用，按 web-only）；backend 跑 mvn verify / go test | W3-T1, W2-T1, W3-T2 | PR 触发 workflow 绿 |
| **W4-T2** | ci | workspace 根 `.github/workflows/e2e-cross.yml`：起服务编排 → 跑 `e2e/flows/*`（流程 A/B/C），设为 PR 必过检查 | W1-T3, W1-T4, W2-T3 | PR 触发跨项目 e2e 绿；失败阻断合入 |

---

## §4 验收门禁（分级）

- **G1 — 真实性门禁（最高）**：无假绿。engine 任意 e2e 在 backend 停服时必须**红**（证明确实验证后端）。禁止 mock-token / 全 skip / 弱断言顶替。
- **G2 — 跨项目门禁**：流程 A（发布闭环）、B（线索闭环）、C（双后端一致性）三条均绿，且各自「断一环则红」可证。
- **G3 — 各端自洽门禁**：engine/website/ui 各自 `pnpm run test:e2e` 独立绿；website 不再零测试。
- **G4 — CI 门禁**：W4 workflow 在 PR 上自动跑且必过；跨项目 e2e 失败阻断合入。
- **G5 — 文档一致门禁**：`E2E_AGENT_GUIDE.md` 所列目录/命令与实现 1:1，无幻觉。

## §5 TDD 与执行约定

- 先测后码：新流程 spec 先写断言（红）→ 最小实现（绿）→ 补全。
- 首个失败即停（`maxFailures: 1`），禁止攒红。
- Console → Network → 后端日志排障顺序。
- 执行会话内测试冻结（§2.5.2），纯格式化豁免。
- Playwright 用本机 Chrome（`channel: 'chrome'`），CI 用 Playwright Chromium。

## §6 已定决策（round2 落定）

| 决策项 | 定论 |
|---|---|
| 框架统一 | **全栈 Playwright**；engine Cypress 随 W1 迁移，ui nx-cypress 随 W3 迁移 |
| 首交付 | **W1（主项目骨架 + 发布闭环）**，W2~W4 后续波次 |
| 真实账号 | 后端**预置专用 e2e 账号**，env 注入 `LUBAN_E2E_ACCOUNT` / `LUBAN_E2E_PASSWORD`；不共用 dev 账号、不硬编码 |
| 双后端（流程 C） | **Java(8080) + Go 同时在线**做等价断言（双后端 parity 关键验证） |
| 起服务方式 | **`docker-compose.e2e.yml`**（干净隔离，无残留进程） |
| engine 迁移时点 | **串行 W1→W2→W3**（避免同时改 engine 两套） |
| 任务图 SSOT | 已产出 `docs/superpowers/tasks/luban-e2e-strategy.json`（12 task） |

> 注：`scripts/verify-plan-ssot.mjs` 当前仍是 stub，SSOT 一致性由人工核对（task id 与本 plan §3 1:1）。

---

## §7 集成复用表（避免重复造轮子）

| 既有资产 | 位置 | 复用方式 |
|---|---|---|
| engine Cypress 用例断言 | `packages/engine/luban/cypress/e2e/*.cy.ts` | W3-T1 平移为 Playwright 断言（中文文案定位不变），不重写 |
| ui designer po/support | `apps/luban-ui-e2e/src/support/app.po.ts` | W3-T2 平移为 Playwright locator 封装 |
| luban-base/low-code 组件测 | `test/e2e/*.e2e.spec.ts`（实为 vitest mount） | W3-T2 正名为 `test/component/`，保留 vitest，不改语义 |
| 双后端契约定义 | `docs/DUAL_BACKEND_PARITY.md` | W1-T4 流程 C 断言口径以该文档为准 |
| contract-check 脚本 | `scripts/contract-check.sh` | W4-T2 CI 可复用为 PR 预检 |
| coverage-summary | `scripts/coverage/coverage-summary.sh` | W4 CI 沿用，不新建 |

## §8 数据隔离与清理（MUST）

- 流程 A/B 写入的站点/页面/线索记录：spec `afterAll` 软删除，前缀 `e2e-` 便于识别与清理。
- e2e 账号权限最小化（仅本测试租户/站点），不污染 dev 数据。
- docker-compose 用独立 volume / 端口，不与本地 dev 服务冲突。
- storageState（auth.setup 产物）不入 git，`.gitignore` 加 `e2e/.auth/`。

## §9 质量禁令自检（round2 定稿核对）

- [x] 无假绿：engine mock-token 在 W3-T1 强制移除，G1 门禁要求停服必红
- [x] 无静默跳过：client/ai 不涉及已列入 §2.3「明确不做」并说明理由
- [x] 无骨架占位：各流程 spec 必须有端到端断言，非只打开页面
- [x] 无 raw JSON 顶替用户页面：流程 A/B 断言落在 website 真实渲染页 + engine 真实管理台
- [x] 范围受控：视觉回归/性能 e2e/client e2e 列入「明确不做」，无镀金
