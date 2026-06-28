---
featureId: e2e-coverage-comprehensive
title: Luban E2E 覆盖率全面提升（跨端链路 + 主仓兜底 + 假绿清理 + Go 暂停标记）
createdAt: 2026-06-28
status: draft
taskGraph: docs/superpowers/tasks/e2e-coverage-comprehensive.json
contractSource: plan-template 命令体 + writing-plans skill + PLAN_WRITING_CONTRACT.md
scope: 跨端链路覆盖 36%→85%、宽口径 67%→90%；消除假绿/契约违规；登记已交付功能的 journey 让门禁生效；Go 后端相关配置全部 @paused 标记
branches: 主仓 e2e/ 改动走当前分支 feature/test-coverage；子仓 spec 改动走 feature/e2e-coverage-<scope> 同名分支
---

# Luban E2E 覆盖率全面提升方案

> 正按 `writing-plans` skill + `PLAN_WRITING_CONTRACT.md` 输出。已全文加载 writing-plans skill。本方案为**纯测试/质量基础设施工作**，不改产品功能代码。

---

## §1 需求溯源（追溯矩阵）

| 上游需求 / gap | 证据 | task id | E2E 场景 | 验收门禁 |
|---|---|---|---|---|
| 跨端 X4 用量超限拦截 0 spec（商业化核心盲区） | `e2e/flows/billing.spec.ts` 仅读 plans/usage；盘点报告 §五-1 | T7 | quota-enforcement：超额 429 + engine 用量更新 | G4 |
| 跨端 X7 协作 CRDT 已交付但 0 spec 0 journey | `platform-complete-v1.json` T-eng-7/T-bff-1/T-bff-2 `done`；`packages/bff/luban-bff/server.ts` 实存 y-websocket | T8 | collab：双浏览器同步 + 在线列表 + IDOR 防越权 | G4 |
| J-designer-mode 代码模式 registry 唯一 `status:gap` | `docs/superpowers/tasks/journey-registry.json` L26 | T9 | designer-code-mode：JSON 编辑+校验+格式化 | G4 |
| 跨端 X5 AB 配置→website 变体渲染半覆盖 | `website/e2e/v02-funnel.spec.ts` 仅测 assign 端点 | T10 | ab：engine 配实验→访客渲染变体 schema | G4 |
| 跨端 X6 FeatureGate 仅 BFF 层，未走 engine UI | `e2e/flows/feature-gate-visitor.spec.ts` 仅公开端点 | T11 | feature-gate：engine 配置→访客行为变更 | G4 |
| 主仓对设计器 7 journey 零兜底（单仓依赖脆弱） | 盘点报告 §五-3；`e2e/flows/` 无 designer-* | T12 | designer-{canvas,select,prop,node-ops,history,device,panel} 镜像 | G4 |
| 主仓对管理类 6 journey 零兜底 | 同上；`e2e/flows/` 无 user-mgmt/settings/dashboard/nav/page-crud/page-version | T13 | 6 个 B 端 journey 兜底 | G4 |
| J-datasource 已实现未登记 journey | `platform-complete-v1.json` + BFF `/api/datasources/*` 实存 | T14 | datasource：CRUD+test+query | G4 |
| J-form-crud 已实现未登记 journey | `platform-complete-v1.json T-eng-9 completed`；`engine DatasourceManageDialog` wave15 R2 | T15 | form-crud：FormList+FormEditor+dedup 配置 | G4 |
| website SSR 主仓仅 1 断言点 | `publish-flow.spec.ts` L75-84 单点 | T16 | ssr：hydration/SEO meta/硬404/重定向 | G4 |
| website 留资提交后行为变体未覆盖 | journey-registry J-leads 场景 | T17 | lead：redirect/popup/toast 三态 | G4 |
| diag-leads.spec.ts 零断言恒绿假象 | `e2e/flows/diag-leads.spec.ts` 无 expect | T4 | 删或转正 | G4 |
| publish-api/ui-site-crud 建数据无清理（违 §11） | 盘点报告 §五-4 | T5 | afterAll 补齐 | G4 |
| ui-publish-loop 静默降级（违 §2.5.1） | `ui-publish-loop.spec.ts` L73/L90 `if visible.catch()` | T6 | 改硬断言 | G4 |
| 三套登录密码不一致 | `ui-login`/`ui-site-crud` `password123`；`ui-publish-loop`/`publish-api` `admin123`；env 第三套 | T3 | 统一 env | G4 |
| 僵尸 dual-backend 配置 | `playwright.config.ts` L56-64 + package.json + Makefile 指向已删文件 | T2,T18 | 标记 @paused | G4 |
| Go 后端配置全面暂停（用户决策） | commit `e9b0abc` Go 移除；用户 Q2 决策「全部标记暂停」 | T18 | @paused 标记 | G4 |
| 已交付功能未登记 journey 致门禁失效 | 盘点报告 §五-2；`journey-coverage` 对未登记功能无保护 | T20 | 登记 5 个新 journey | G4 |

**「无遗漏覆盖」声明**：盘点报告识别的全部 32 条用户操作链路 + 5 个假绿/契约违规 + Go 暂停需求，均已映射到 T1-T21，无静默跳过。

---

## §2 系统与链路

### §2.1 涉及子系统

| 子系统 | 本期增量 |
|---|---|
| `e2e/`（主仓） | 新增 8 个 spec + 重构 5 个现有 spec + fixtures/helpers + config 清理 |
| `packages/engine/luban/e2e/` | 补 designer-code-mode.spec.ts |
| `packages/web/luban-website/e2e/` | 补 ssr 深度 + lead 变体（或主仓代理） |
| `docs/` | journey-registry 登记 + style-guide 补章节 + Go 暂停标记 |
| **不涉及** | 产品功能代码（engine/bff/website/ui/backend-java 均不改业务逻辑） |

### §2.2 关键跨端链路（本期新增覆盖）

**X4 用量超限拦截（T7）**：
```
访客提交表单(website) → BFF /api/forms/:id/submit → Java QuotaService 累加 usage_counters
  → 超 plan quota → BFF 用量拦截中间件返回 429 + 友好错误体
  → 验证点1: submit 收到 429
  → 验证点2: engine GET /api/billing/usage 用量进度条数值增加
```

**X7 协作 CRDT（T8）**：
```
浏览器A打开 page(engine) → useCollab 连 BFF ws://.../api/collab/[site]/[page]
  → 浏览器B打开同 page → 两端 Yjs doc 同步
  → 验证点1: A 拖入组件 → B 画布实时出现
  → 验证点2: GET /api/collab/:site/:page 在线用户列表含 B
  → 验证点3: 越权访问他人 site 的 collab room → canAccessRoom 拒绝（403）
```

**X5 AB 全链（T10）**：
```
engine 创建 experiment(选 page/变体/权重) → BFF POST /api/ab/experiments → Java 持久化分桶
  → 访客 GET /api/public/ab/assign → website server middleware 注入 variantId
  → DynamicPage 渲染变体 schema
  → 验证点: 同 visitor 稳定分到同变体；website DOM 呈现变体内容
```

### §2.3 测试基础设施链路（T1-T6）

```
e2e/fixtures/auth.ts（login/token 统一）
  ← e2e/fixtures/data.ts（createSite/createPage/Form builder）
  ← 所有 spec 改用 fixture（消除 5+ 处重复 login）
  → playwright.config.ts 清理僵尸 project + Go 探活
  → 三套密码收敛为 LUBAN_E2E_PASSWORD
```

---

## §3 业务逻辑

### §3.1 状态机（无新增实体，本期复用现有）

本期不改产品状态机。测试覆盖的现有状态机：
- **page.status**: draft → published → archived（unpublish→archived）— T7/T16 验证
- **experiment.status**: running → ended（显著性达阈值自动/手动结束）— T10 验证
- **feature_gate.enabled**: true/false — T11 验证开关影响访客行为
- **collab room**: join/sync/leave — T8 验证

### §3.2 关键业务规则（测试守护对象）

| 规则 | 测试任务 | 断言 |
|---|---|---|
| 用量超 plan quota 拦截 | T7 | submit 返回 429 + 错误体含 `QUOTA_EXCEEDED` |
| lead 去重（同手机号） | 现有 lead-capture-flow | 409 `LEAD_DUPLICATE` |
| collab canAccessRoom 防 IDOR | T8 | 越权 site 返回 403 |
| AB 分桶一致性（同 visitor 稳定） | T10 | 多次 assign 返回同 variantId |
| FeatureGate fail-open | T11 增强 | 未知 key 返回 enabled:true |

### §3.3 事务边界

本期无跨表事务改动。用量累加的事务一致性由现有 `QuotaService`（ON DUPLICATE KEY UPDATE）保证，测试验证「并发提交不超计」。

---

## §4 页面结构

**§4 显式声明：无前端页面**

本方案为**纯测试/质量基础设施工作**。所有 spec 通过 Playwright 测试**现有**产品页面/路由，不新增、不改动任何引擎渲染/website/客户端界面。产品 SSOT 未声明本特性有任何 UI 增量。

- §4.3 不适用（无新增页面需逐页结构展示）
- §4.4 UX 自检不适用（无 UX 改动）

---

## §5 集成与复用表

| 复用件 | 提供方 | 消费方 | 契约 |
|---|---|---|---|
| `e2e/fixtures/auth.ts` login() | T1 | 所有 spec（T3 迁移） | `() => Promise<{token, headers}>`，读 env `LUBAN_E2E_ACCOUNT`/`LUBAN_E2E_PASSWORD` |
| `e2e/fixtures/data.ts` createSite() | T1 | T5/T7/T8/T10-T17 | `(token) => Promise<siteId>` + 自动清理注册 |
| `e2e/fixtures/data.ts` createPage() | T1 | T8/T16 | `(token, siteId, schema) => Promise<pageId>` |
| `e2e/fixtures/data.ts` createForm() | T1 | T7/T17 | `(token, siteId) => Promise<formId>` |
| `e2e/helpers/collab.ts` openCollabContext() | T8 | T8 | `(pageUrl) => Promise<BrowserContext>` 双浏览器 |
| auth.setup.ts storageState | 现有 | engine-flows project | 路径 `e2e/.auth/engine.json`（不变） |

---

## §6 架构边界 + 门禁自检

### §6.1 架构边界

- **测试只读产品代码**：本期不改 engine/bff/website/ui/backend-java 任何业务逻辑。若测试发现产品 bug，**单独立 issue**，不在本方案修产品代码（除非是测试必需的 minimal 可测性改造，须单列并说明）
- **e2e/ 作为主仓跨端测试唯一宿主**：跨端链路 spec 只在 `e2e/flows/`，不在子仓
- **子仓 spec 保持自治**：`packages/engine/luban/e2e/` 等子仓测试不动，主仓兜底 spec 是额外保护层
- **Go 暂停标记**：所有 Go 相关配置标记 `@paused`（注释 + 条件跳过），不删除，便于未来恢复

### §6.2 双后端 parity 矩阵

**本期声明：Go 后端全面暂停（用户 Q2 决策）**。无新增接口需双端实现。现有 Go 死配置处理：

| 配置项 | 现状 | 本期处理 |
|---|---|---|
| `playwright.config.ts` dual-backend project (L56-64) | 指向已删文件 | T2 标记 `@paused`（移除 project 注册，保留注释说明） |
| `package.json` test:contract/test:cross | 指向已删文件 | T18 脚本标记 `@paused`（注释 + echo 提示） |
| `Makefile` e2e-cross | 指向已删文件 | T18 target 标记 `@paused` |
| `global-setup.ts` Go 探活 (L14/L49) | 探活不存在的服务 | T2 移除探活代码（Go 已无服务可探） |
| `metadata.GO_API` (L73) | 遗留 | T2 移除 |
| `docs/E2E_AGENT_GUIDE.md` §1.4 引用 dual-backend | 文档过时 | T18 标注「Go 暂停」 |
| `e2e/README.md` L36 引用 | 文档过时 | T18 标注 |

**禁令 §12（双后端契约一致）说明**：本期无新增 API 接口，禁令适用条件不触发。Go 恢复时须按 `docs/DUAL_BACKEND_PARITY.md` 重建契约测试。

### §6.3 覆盖率门禁目标

本方案提升的是 **E2E 旅程覆盖率**，非代码行覆盖率（后者不改）。目标：
- **旅程覆盖率**：`make journey-coverage` P0=100%（现有 P0 全覆盖），P1/P2 缺口从报告变阻断（新登记 journey 后）
- **跨端链路覆盖**：36% → 85%（X4/X5/X6/X7/X8 补齐）
- **宽口径功能覆盖**：67% → 90%（登记 + 兜底）
- 代码行覆盖率门禁值（engine/bff/website 85% · UI 90% · Java 80%）**不变**，因本期不增减产品代码

### §6.4 物料 schema

不涉及（无新物料）。

### §6.5 FeatureGate 策略

**不涉及新增产品功能**，故无新 FeatureGate。本方案的 T11 是**测试现有** FeatureGate 链路，非新增开关。

---

## §7 E2E 测试计划

### §7.0 用户旅程覆盖声明

本期新增/涉及 6 个 journey（同步到 taskGraph JSON `journeys[]`，T20 落地）：

| 旅程 id | 标题 | 优先级 | 场景 | 入口端 |
|---------|------|--------|------|--------|
| `J-collab` | 实时协作 CRDT | P0 | 双浏览器同步/在线列表/IDOR 防越权 | engine |
| `J-quota-enforcement` | 用量上报→套餐超限拦截 | P0 | 超额 429/engine 用量更新/友好错误体 | website |
| `J-designer-mode` | 设计器模式切换 | P0 | 预览/代码模式 JSON 编辑（registry 现有，ref） | engine |
| `J-datasource` | 数据源管理 | P1 | CRUD/test/query | engine |
| `J-form-crud` | 表单管理 | P1 | FormList/FormEditor/dedup 配置 | engine |
| `J-contract-parity` | Java 后端契约自洽 | P2 | UserPassword/PublicPage/SlugConflict/Datasource/AuthMe | workspace |

**门禁**：`make journey-coverage` 收口前跑通，P0=100%。`J-designer-mode` 现为 ref（首次定义在 engine 仓），本期 T9 补 spec 使其从 gap→covered。

### §7.1 跨端主路径

主链路 E2E 绑定**正式产品路由**，无 `pages/e2e/*` 专测页：
- `/login` `/sites` `/sites/:id/pages` `/sites/:id/pages/:pageId/edit`（engine 设计器正式路由）
- `/:slug/:path`（website SSR 正式路由）
- `/sites/:siteId/leads`（engine 线索中心正式路由）

工具栈：统一 Playwright（废 Cypress，已完成）。

### §7.2 脚本保障逻辑

- **首个失败即停**：定位修复当前红用例，修绿后继续至全量门禁
- **禁假绿**：禁 `*.skip`/空断言/关 bail/无后端全 skip 仍宣称通过（本期专门清理此类）
- **环境预检**：MySQL + Java + BFF + engine + website 起齐才跑；缺服务明确报错
- **协作测试特殊**：双浏览器上下文需 `workers: 1`（已配置），WebSocket 等待用 `page.waitForFunction` 而非 `waitForTimeout`

### §7.3 E2E 用例枚举（每场景一张表）

#### 场景 T7：用量超限拦截（@J-quota-enforcement）
| 项 | 内容 |
|---|---|
| 前置 | Java 起齐；建 site + form；将测试 site 的 plan quota 调低（fixture 或 DB 直插） |
| 用例 | 1. 连续提交表单至接近 quota 2. 再提交一次 3. 断言响应 429 + body 含 `QUOTA_EXCEEDED` 4. GET /api/billing/usage 断言用量数值增加 |
| 清理 | afterAll 还原 quota / 删 site |
| 旅程 | J-quota-enforcement |

#### 场景 T8：协作 CRDT 双浏览器（@J-collab）
| 项 | 内容 |
|---|---|
| 前置 | engine + BFF(ws) 起齐；建 site + page（含 schema） |
| 用例 | 1. 浏览器A 打开 `/sites/:sid/pages/:pid/edit` 2. 浏览器B 同页 3. A 拖入组件 4. 断言 B 画布出现该组件（`waitForFunction` 轮询）5. GET /api/collab/:sid/:pid 断言在线用户含 2 6. 第三上下文用他人 token 访问 → 断言 403 |
| 清理 | close 两个 context；afterAll 删 site |
| 旅程 | J-collab |

#### 场景 T9：设计器代码模式（@J-designer-mode）
| 项 | 内容 |
|---|---|
| 前置 | engine 起齐；登录；建 page |
| 用例 | 1. 进设计器 2. 切换到代码模式 3. 编辑 JSON（加节点）4. 断言画布实时渲染新节点 5. 输入非法 JSON 断言校验提示 6. 格式化按钮断言输出规整 |
| 清理 | afterAll 删 page |
| 旅程 | J-designer-mode |

#### 场景 T10：AB 全链（@J-ab-test 增强）
| 项 | 内容 |
|---|---|
| 前置 | 建 site + page（两个变体 schema） |
| 用例 | 1. POST /api/ab/experiments 建实验 2. 多次 GET /api/public/ab/assign?visitorId=X 断言返回同 variantId 3. page.goto(website) 断言 DOM 呈现变体内容 |
| 清理 | afterAll 删 experiment + site |
| 旅程 | J-ab-test（现有，增强） |

#### 场景 T11：FeatureGate 全链（@J-feature-gate-visitor 增强）
| 项 | 内容 |
|---|---|
| 前置 | 建 site；engine 登录态 |
| 用例 | 1. PUT /api/feature-gates 关闭 lead_capture 2. 访客提交表单断言 `LEAD_DISABLED` 3. 重新开启断言可提交 |
| 清理 | afterAll 还原 gate + 删 site |
| 旅程 | J-feature-gate-visitor |

#### 场景 T12-T17：兜底/增强 spec（镜像子仓断言，分步同上从略）

### §7.4 E2E 路由合规性确认

所有 E2E 路由均为正式产品路由，**无新增 `pages/e2e/*`**：

| 路由 | 类型 | spec |
|---|---|---|
| `/login` `/sites` `/sites/:id` `/sites/:id/pages` `/sites/:id/pages/:pageId/edit` | engine 正式 | T8/T9/T12/T13 |
| `/:slug/:path` | website 正式 | T10/T16 |
| `/sites/:siteId/leads` | engine 正式 | T17 |

---

## §8 TDD 与执行约定

### §8.1 TDD 先行

本方案**本身就是 TDD 的补全**——为已交付功能补测试。执行纪律：
- 先写 spec（红：因需新 fixture/可能暴露产品问题）
- 再补 fixture/helper（绿）
- 重构现有 spec 迁移到 fixture（保持绿）
- 禁止先迁 fixture 再写新 spec（避免迁移期无保护）

### §8.2 首个失败即停

修当前红用例时专注该条，修绿后继续至**全量**门禁。T21 全量回归是收口前必跑。

### §8.3 并行 subagent（实现阶段）

可独立验收的线（定稿 §9.6 详列）：
- **Line A 基础设施**（T1/T2/T3）：串行（fixture 是其他依赖）
- **Line B 假绿清理**（T4/T5/T6）：依赖 A，三者可并行
- **Line C 跨端新 spec**（T7/T8/T10/T11）：依赖 A，可并行
- **Line D 引擎 spec**（T9/T12/T13/T14/T15）：依赖 A，可并行
- **Line E website spec**（T16/T17）：依赖 A，可并行
- **Line F 配置/文档**（T18/T19/T20）：无依赖，最早期可并行
- **T21 全量回归**：依赖 B/C/D/E 全完成

### §8.4 单期收口

本 plan 全部 T1-T21 在**单次实现周期**完成，通过 G1-G4 门禁后一次汇报。禁止分期。

### §8.5 Post-Development Workflow

```
代码提交
   ↓
/luban-review 全自动审查（🔴🟡🔵 清零）
   ↓
pnpm typecheck（e2e/ + 改动子仓）
   ↓
分栈单测（cd e2e && pnpm test / cd packages/engine/luban && pnpm test）
   ↓
询问用户后跑 E2E（make e2e-up && make e2e）
   ↓
make journey-coverage（P0=100%）+ 跨端链路覆盖统计
   ↓
完成汇报
```

---

## §10 明确不做（防膨胀）

| 项 | 理由 | 去向 |
|---|---|---|
| 不重建 Go 后端 | 用户决策「全部标记暂停」，不属本方案职责 | Go 恢复时另立 plan |
| 不补 AI 助手 E2E | `packages/ai` 空目录，无实现 | AI 落地后另立 |
| 不改产品功能代码 | 本方案纯测试/基础设施；发现产品 bug 另立 issue | — |
| 不做跨浏览器（webkit/firefox） | 现状仅 chromium，范围控制 | 后续质量提升迭代 |
| 不补 client 多端 E2E | 规划态目录空 | client 落地后另立 |
| 不重构为 Page Object 模式 | fixture helper 已足够降低重复，PO 过度工程化 | — |
| 不提升代码行覆盖率门禁值 | 本期不增减产品代码，门禁值维持 | — |

---

## 质量禁令自检表（14 条）

- [x] §1 禁止跳过功能（盘点 32 链路 + 5 违规 + Go 暂停全映射到 T1-T21，无静默省略）
- [x] §2 禁止假绿（T4/T6 专门清理零断言/静默降级；§7.2 写明禁假绿）
- [x] §3 禁止占位（所有 spec 真实断言，无 TODO/mock 冒充）
- [x] §4 禁止骨架交付（每个 spec 有完整操作+断言+清理）
- [x] §5 禁止用 JSON 替代页面（测试的是真实页面，非 JSON dump）
- [x] §6 页面交互完整（§7.3 每场景分步）
- [x] §7 验收口径=可交付（本方案交付物=可跑的 E2E 套件，本身就是验收）
- [x] §8 引擎 E2E 绑正式路由（§7.4 确认无 pages/e2e/*）
- [x] §9 门禁分级执行（G1-G4 见下表）
- [x] §10 /luban-review 清零（§8.5 Post-Dev 含此步）
- [x] §11 安全审查（本期不改产品代码/不涉敏感数据/不改权限模型；测试用的 token 走 env 不入库 → **本项标记「不适用，理由：纯测试工作无产品代码变更」**）
- [x] §12 双后端契约一致（本期无新增 API，Go 暂停；§6.2 已声明）
- [x] §13 多端渲染一致（本期不改物料/引擎渲染，不触发）
- [x] §14 FeatureGate（本期无新功能，T11 测现有开关；不触发）

---

## 分级验收门禁表（G1-G4）

| 级别 | 名称 | 验证方式 | 通过条件 | 责任 |
|------|------|---------|---------|------|
| **G1** | 代码质量与审查 | `/luban-review` 全自动审查 | 🔴🟡🔵 全部清零（含建议） | plan owner |
| **G2** | 安全审查 | **不适用**（纯测试工作，无产品代码/敏感数据/权限变更） | N/A（已声明理由） | — |
| **G3** | 单测+覆盖率 | `cd e2e && pnpm test` + `cd packages/engine/luban && pnpm test` | 新增 spec 全绿；现有 spec 迁移后不退化；旅程覆盖率 P0=100% | plan owner |
| **G4** | E2E 验收 | `make e2e-up && make e2e` + `make journey-coverage` | 跨端链路 8 条覆盖≥7；宽口径≥90%；无 `*.skip`/假绿 | plan owner |

**门禁执行顺序**：G1（/luban-review 清零）→ G3（单测+旅程覆盖）→ G4（E2E 全量）。G2 跳过（已声明不适用）。

---

## 回滚方案

| 变更 | 回滚首选 | 数据影响 | 验证点 |
|------|---------|---------|--------|
| e2e config 清理（T2/T18） | revert commit（标记 @paused 可逆，未删配置） | 无 | 现有非 Go 测试仍跑 |
| fixture 抽取（T1/T3） | revert + spec 回退内联 login | 无 | 旧 spec 恢复可跑 |
| journey 登记（T20） | 从 journey-registry.json 删新条目 | 门禁恢复旧口径 | `make journey-coverage` 不再阻断 |

**注**：本期无 Flyway 迁移、无外部 API 对接、无 FeatureGate 新增，回滚成本低（纯 revert）。

---

**§0-§8 已完成。同轮派发并行 subagent 扫描代码库填充 §9，结论如下。**

---

## §9 实现任务派发（subagent 代码库扫描结论）

> 派发了 2 个 Explore subagent 扫描 e2e/ 与 engine/website/bff/backend 现状。本节为合并去重后的产出。**两个 subagent 全部返回有效结果，无失败。**

### §9.0 ⚠️ 扫描发现的两个范围阻塞（必须如实告知，影响 T8/T14/T15）

| 阻塞 | 证据 | 影响 | 处置 |
|---|---|---|---|
| **T8 协作：`useCollab` 未接入设计器** | `packages/engine/luban/src/PageEditor.vue` 无 `useCollab`/`collab`/`online` 引用；`useCollab.ts` 存在但孤立（仅自身单测） | 「双浏览器内容同步」无法直接测——需先接线 engine 才能测实时同步；但 BFF ws 鉴权链 + 在线用户 HTTP + IDOR 防护**可独立测** | **拆 T8**：T8a（BFF/Java 协作端点契约，含 IDOR，可立即做）+ T8b（engine 接线 useCollab + 双浏览器 UI 同步，**降级为「显式延后」**，见 §10）|
| **T14/T15 datasource/form 管理端 UI 不存在** | `engine/src/router/index.ts` 未挂 datasource/form 路由；engine/src 下无 `DatasourceManageDialog`/`FormList`/`FormEditor` 组件；BFF+Java 实现完整 | 「engine UI 管理链路」无法测——无 UI | **拆 T14/T15**：T14a/T15a（BFF/Java API 契约层测试，可立即做）+ UI 部分降级为「显式延后」 |

**这两个发现证明「最完整策略」自检的必要性**：原盘点报告把 collab/datasource/form 列为"已交付"，实地扫描发现 engine 侧未接线。**本方案不掩盖、不静默跳过**——如实标注并拆分，UI 部分显式延后到「engine 接线」另立 plan。

### §9.1 文件变更总览（按 task）

| task | 文件路径 | 新建/修改 | 摘要 |
|---|---|---|---|
| T1 | `e2e/fixtures/auth.ts` | 新建 | 统一 login()：读 env，返回 `{token, headers}`，token 提取 `body.token ?? body.accessToken` |
| T1 | `e2e/fixtures/data.ts` | 新建 | createSite/createPage/createForm/createCollection builder + 自动清理注册（afterAll 钩子） |
| T1 | `e2e/fixtures/env.ts` | 新建 | 集中 BFF_BASE/ENGINE_BASE/WEBSITE_BASE 常量（消除各 spec 重复定义） |
| T2 | `e2e/playwright.config.ts` | 修改 | L57-64 删 `dual-backend` project 注册；L16/L72 移除 `GO_API`；保留 `// @paused: Go 后端已移除（commit e9b0abc）` 注释 |
| T2 | `e2e/global-setup.ts` | 修改 | L14/L35/L46/L49 移除 Go 探活（无服务可探） |
| T3 | `e2e/flows/*.spec.ts`（6 处） | 修改 | publish-api L4 删 ADMIN 硬编码→env；ui-publish-loop L19/L34；ui-login L22；ui-site-crud L14 改用 fixture |
| T4 | `e2e/flows/diag-leads.spec.ts` | **删除** | 零断言诊断脚本（grep `expect` 仅命中 import 行），恒绿假象 |
| T5 | `e2e/flows/publish-api.spec.ts` | 修改 | 补 afterAll 删 site（L12 建 site 无清理） |
| T5 | `e2e/flows/ui-site-crud.spec.ts` | 修改 | 补 afterAll 清理 UI 建的 site |
| T6 | `e2e/flows/ui-publish-loop.spec.ts` | 修改 | L73/L90 去 `if visible.catch()` 静默降级改硬断言；L114 去 `waitForTimeout(2000)`；补 afterAll |
| T7 | `e2e/flows/quota-enforcement.spec.ts` | 新建 | 见 §9.2（@J-quota-enforcement） |
| T8a | `e2e/flows/collab-contract.spec.ts` | 新建 | BFF ws 鉴权 + 在线用户 HTTP + IDOR（见 §9.2）|
| T9 | `packages/engine/luban/e2e/designer-code-mode.spec.ts` | 新建 | 见 §9.5（@J-designer-mode gap 填补） |
| T10 | `e2e/flows/ab-full-link.spec.ts` | 新建 | engine 配实验→website 渲染变体（@J-ab-test 增强） |
| T11 | `e2e/flows/feature-gate-full-link.spec.ts` | 新建 | engine 配置→访客行为（@J-feature-gate-visitor 增强） |
| T12 | `e2e/flows/designer-*.spec.ts`（7 个镜像） | 新建 | canvas/select/prop/node-ops/history/device/panel 镜像 engine 仓断言（复用 `.lb-*` 选择器） |
| T13 | `e2e/flows/{user-mgmt,settings,dashboard,nav,page-crud,page-version}.spec.ts` | 新建 | 6 个 B 端管理兜底 |
| T14a | `e2e/flows/datasource-api.spec.ts` | 新建 | BFF+Java datasource API 契约（@J-datasource，API 层） |
| T15a | `e2e/flows/form-api.spec.ts` | 新建 | BFF+Java form API 契约 + dedup/antiSpam 配置（@J-form-crud，API 层） |
| T16 | `e2e/flows/ssr-deep.spec.ts` | 新建 | hydration/SEO meta(title/og/canonical)/硬404/重定向（@J-ssr 增强） |
| T17 | `e2e/flows/lead-variants.spec.ts` | 新建 | redirect/popup/toast 提交后行为（@J-leads 增强） |
| T18 | `e2e/playwright.config.ts`/`package.json`/`Makefile`/`global-setup.ts`/`README.md`/`docs/E2E_AGENT_GUIDE.md`/`.env.example` | 修改 | Go 相关全标 `@paused`（注释 + 条件跳过，不删，见 §9.3） |
| T19 | `docs/dev/e2e-test-style-guide.md` | 修改 | 补「协作双浏览器规范」+「真实断言纪律」章节 |
| T20 | `docs/superpowers/tasks/journey-registry.json` | 修改 | 登记 J-collab/J-quota-enforcement/J-datasource/J-form-crud/J-contract-parity |
| T21 | — | 执行 | 全量回归（见 §9.6） |

### §9.2 API 契约（T7/T8a/T10/T11/T14a/T15a 涉及）

#### T7 用量超限（@J-quota-enforcement）
| 端点 | 方法 | 请求 | 响应 | 鉴权 | 错误码 |
|---|---|---|---|---|---|
| `POST /api/forms/:formId/submit` | POST | `{name,phone,...}` | 201 正常 / **429 超限** | 公开（BFF 频控 + Java） | `QUOTA_EXCEEDED` |
| `GET /api/billing/usage` | GET | — | `{plan, used, limit, ...}` | JWT | — |
- **造数策略**：fixture 调低测试 site 的 plan quota（需 Java 侧 QuotaService 暴露或 DB 直插 `subscriptions` 表 `plan` 字段为低额度 plan）。

#### T8a 协作契约（@J-collab，BFF/Java 层，**不含 UI 同步**）
| 端点 | 方法 | 请求 | 响应 | 鉴权 | 断言 |
|---|---|---|---|---|---|
| `ws://bff/api/collab/:siteId/:pageId?token=` | WS | query token | 101 握手 / **401 无 token** / **403 越权** | collabAuth 三步 | 越权→`X-Collab-Error` header；无 token→401 |
| `GET /api/collab/:siteId/:pageId` | GET | — | `{onlineUsers, connectionCount}` | JWT + canAccessRoom | 越权→403；正常→含在线数 |
- **IDOR 断言**：用户 A 的 token 访问用户 B 的 site/page → 403（`canAccessRoom` 调后端 `GET /sites/:sid/pages/:pid` 失败）。
- **注意**：因 useCollab 未接 engine，**无法测真实双浏览器内容同步**（降级 §10）。本 T8a 用 Playwright `request` 上下文 + 原生 ws 客户端测契约层。

#### T10 AB 全链（@J-ab-test）
| 端点 | 方法 | 鉴权 | 断言 |
|---|---|---|---|
| `POST /api/ab/experiments` | JWT | 建实验返回 experimentId |
| `GET /api/public/ab/assign?visitorId=&pageId=` | 公开 | 同 visitor 多次→同 variantId；page.goto(website)→DOM 呈现变体 |

#### T11 FeatureGate 全链（@J-feature-gate-visitor）
| 端点 | 方法 | 断言 |
|---|---|---|
| `PUT /api/feature-gates` | 关 lead_capture→访客 submit 返回 `LEAD_DISABLED` |
| `GET /api/public/feature-gates` | fail-open：未知 key→enabled:true |

#### T14a datasource API（@J-datasource，**仅 API 层，无 UI**）
| 端点 | 方法 | 鉴权 | 断言 |
|---|---|---|---|
| `GET/POST /api/datasources` | GET user / POST admin | CRUD 往返 |
| `POST /api/datasources/:id/test` | user | 返回连接结果 |
| `POST /api/datasources/:id/query` | user | type=api 走 SSRF 防护；超时→504 `DATASOURCE_UPSTREAM_TIMEOUT` |

#### T15a form API（@J-form-crud，**仅 API 层，无 UI**）
| 端点 | 方法 | 断言 |
|---|---|---|
| `GET/POST /api/forms` | CRUD；POST 创建带 dedup/antiSpam 配置 |
| `POST /api/forms/:id/submit` | 公开；dedup 策略验证；BFF 频控 |

### §9.3 Go 暂停标记清单（T18，精确到行）

全部**不删除**，标 `@paused` 注释 + 条件跳过：
| 文件:行 | 现状 | 标记方式 |
|---|---|---|
| `playwright.config.ts:16,57-64,72` | dual-backend project + GO_API | 删 project 注册，留 `// @paused Go 后端已移除（commit e9b0abc），恢复时见 docs/DUAL_BACKEND_PARITY.md` |
| `global-setup.ts:14,35,41,46,49` | Go 探活 | 删 probeOptional(GO_API)，留 `@paused` 注释 |
| `package.json:12-13` | test:contract/test:cross | 改为 `echo "@paused Go 后端已移除"`（脚本保留不报错） |
| `Makefile` e2e-cross target | 同上 | target 保留，body 改 echo 提示 |
| `.env.example:12` | GO_API 样例 | 注释 `# @paused` |
| `README.md:18,27,36` | 文档引用 | 标注「（Go 暂停）」 |

### §9.4 物料 schema
不涉及（无新物料）。

### §9.5 组件接口（T9 关键：CodeEditor + 设计器模式切换）

**T9 designer-code-mode 测试目标组件**：`packages/ui/luban-ui/packages/luban-low-code/src/lib/CodeEditor.vue`（已实现，279 行）
- **Props**：`modelValue?: PageSchema \| null`；`readOnly?: boolean`；`showLineNumbers?: boolean`
- **Emits**：`update:modelValue: [PageSchema]`；`validation-error: [string | null]`
- **行为**：textarea 输入→300ms 防抖解析+结构校验（root 须对象，须有 `root.id`/`root.type` 字符串）；"格式化"按钮→2 空格缩进
- **选择器**：`.lb-code-editor`、`.lb-code-editor__textarea`、`.lb-code-editor__btn`（格式化）、`.lb-code-editor__error`
- **模式切换接入点**：`PageEditor.vue:506-510` `onToolbarMode(m)`；工具栏按钮 `DesignerToolbar.vue:114-138` 文本 "{ } 代码"；激活类 `.lb-toolbar__btn--active`
- **测试步骤**（@J-designer-mode）：进设计器→点"{ } 代码"→断言 `.lb-code-editor` 可见→编辑 textarea 加节点→断言画布实时渲染→输非法 JSON 断言 `.lb-code-editor__error`→点格式化断言输出规整

**主仓兜底 spec 复用的选择器词汇表**（来自 engine 仓扫描）：
- 设计器：`.luban-designer`、`.luban-designer__canvas`、`.lb-component-panel__item`、`.lb-property-panel`、`.lb-outline-tree`、`.lb-toolbar`、`[data-lb-node]`、`[data-node-id]`
- Element Plus：`.el-tabs__item`、`.el-switch`、`.el-message`、`.el-dialog`、`.el-pagination`、`getByRole('button', {name})`

### §9.6 并行派发计划（基于 dependsOn + group）

```
Wave 0（无依赖，最早期，可并行）:
  Line F: T18(Go @paused) + T19(style-guide) + T20(journey 登记)

Wave 1（基础设施，串行，其他依赖）:
  Line A: T1(fixture) → T2(config 清理) → T3(凭据统一)

Wave 2（依赖 Wave 1，可并行 5 条线）:
  Line B: T4(删 diag) + T5(补清理) + T6(修降级)        — 假绿清理
  Line C: T7(quota) + T8a(collab 契约) + T10(ab) + T11(fg)  — 跨端新 spec
  Line D: T9(code-mode) + T12(designer×7) + T13(管理×6) + T14a(ds api) + T15a(form api) — engine/管理 spec
  Line E: T16(ssr deep) + T17(lead 变体)               — website spec

Wave 3（依赖 Wave 2 全完成）:
  T21: 全量回归 + journey-coverage P0=100% + 覆盖率汇总
```

**可独立验收的线**（实现阶段并发 Task 派发）：
- Wave 0 的 T18/T19/T20 彼此无依赖 → 3 个并行 Task
- Wave 2 的 Line B/C/D/E 四条线 → 4 个并行 Task（每线内部串行）
- T21 必须串行收口

### §9.7 门禁值确认
- 本期不改产品代码，代码行覆盖率门禁值**不变**（engine/bff/website 85% · UI 90% · Java 80%）
- **旅程覆盖率**：P0=100%（`make journey-coverage`）；新增 6 个 journey 登记后，缺口从"报告"变"阻断"

---

## §10 明确不做（防膨胀）— §9 扫描后的调整

基于 §9.0 扫描发现，**新增 2 条显式延后**（非静默跳过，有明确去向）：

| 项 | 理由 | 去向 |
|---|---|---|
| **T8b 协作 engine UI 接线 + 双浏览器内容同步** | `useCollab` 未接入 `PageEditor.vue`，engine 无在线用户 UI；需产品接线才能测（超出"纯测试"边界） | **显式延后**→ 另立 plan「engine 协作接线」（产品功能开发），落地后补 T8b |
| **T14b/T15b datasource/form 管理端 UI E2E** | engine 路由未挂载，无 `DatasourceManageDialog`/`FormList`/`FormEditor` 组件 | **显式延后**→ 另立 plan「engine 管理端 UI 补全」，落地后补 UI E2E |

**调整后的本期范围**：T8 拆为 T8a（契约层，本期做）+ T8b（延后）；T14/T15 拆为 T14a/T15a（API 层，本期做）+ UI（延后）。**J-collab/J-datasource/J-form-crud 仍登记**（T20），但场景标注「API 层已覆盖，UI 层延后」，门禁对 API 层生效。

> 这两条延后是 §9 实地扫描的产物，符合质量禁令 §1（不静默跳过）——有明确去向、有产品功能 plan 衔接。

---

## §11 定稿合规自检（reviewer 用）

- [x] §0 YAML 字段齐全，taskGraph JSON 存在且 `verify-plan-ssot.mjs validate` 通过
- [x] §1 追溯矩阵覆盖盘点全部 32 链路 + 5 违规 + Go 暂停，证据可追溯（盘点报告 + 文件:行号）
- [x] §2 系统与链路完整，跨端链路分步
- [x] §3 状态机/业务规则（复用现有，测试守护对象明确）
- [x] §4 显式声明「无前端页面」+ 理由（纯测试工作）
- [x] §5 复用件契约表（fixture/helper 契约明确）
- [x] §6 双后端矩阵（Go 暂停声明）+ 覆盖率门禁 + FeatureGate（不触发）
- [x] §7 E2E 绑正式路由 + 多租户用例（T8a IDOR）+ 脚本保障
- [x] §8 TDD + 单期收口 + Post-Dev Workflow（/luban-review 先行）
- [x] §9 实现任务派发（2 个 subagent 全返回，文件映射/API契约/组件接口/并行计划齐全）
- [x] 质量禁令 14 条自检逐条勾选
- [x] G1-G4 门禁表齐全（G2 声明不适用）
- [x] 敏感字段清单（不适用，纯测试）
- [x] 回滚方案（纯 revert）
- [x] 「明确不做」+ 显式延后（T8b/T14b/T15b 有去向）
- [x] 双后端一致性声明（无新接口，Go 暂停）
- [x] 多端渲染一致（不触发，无物料改动）

**合规判定：通过，可进入实现阶段。**

---

## 定稿完成

本 plan（§0-§9）已完整。校验命令：
```bash
node scripts/verify-plan-ssot.mjs validate docs/superpowers/tasks/e2e-coverage-comprehensive.json
```

实现阶段进入时，按 §9.6 Wave 0→1→2→3 派发，单期完成 T1-T21（含 T8a/T14a/T15a 调整后范围）并通过 G1/G3/G4 门禁后汇报。T8b/T14b/T15b 显式延后到 engine 接线 plan。
