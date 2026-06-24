# TODO — 优化待办跟踪

> 🔴 **迭代规划前必须扫描本文件未完成项**（见 `AGENTS.md` 启动检查第 2 条）。
> Agent 在启动新迭代或排期规划时，须列出所有 `status ≠ done` 的条目并提示排进迭代。
>
> 新增条目：在下方「待办清单」表加一行，并在「详情」区补背景与验收标准。

---

## 状态约定

| 字段 | 取值 |
|------|------|
| 状态 `status` | `pending` 未开始 · `in-progress` 进行中 · `done` 已完成 |
| 优先级 `priority` | `high` / `medium` / `low` |
| 迭代 `iteration` | 未排期填 `未排期`，排入后改为 `vXX`。`feature/lead-capture-mvp` 分支 = v01 |
| ID 前缀 | `T-` 工程层（技术债/基建）· `P-` 产品层（商业化功能缺口）· `D-` 已交付（v01 收敛回写） |
| 模块 `scope` | `workspace` / `luban-ui` / `luban-engine` / `luban-bff` / `luban-website` / `backend-java` / `backend-go` / `product`（跨模块产品能力）等 |

---

## 待办清单

### v01 已交付（`feature/lead-capture-mvp` 分支收敛回写，2026-06-17 实测）

| ID | 状态 | 优先级 | 迭代 | 模块 | 标题 |
|----|------|--------|------|------|------|
| D-001 | done | high | v01 | backend-java | P0 留资闭环 Lead/Form 领域（状态机+加密+去重+防刷+审计+9 测试） |
| D-002 | done | high | v01 | backend-java | FeatureGate 套餐管控「锁」（gate_key: lead_capture/realtime_collab/page_versioning/poster_export） |
| D-003 | done | high | v01 | luban-engine | 留资中心 UI + 表单管理 + PageEditor（designMode/add-node/select/reorder）+ 版本历史 + useCollab 协作开关 + 5 个 Cypress E2E |
| D-004 | done | high | v01 | luban-ui | 设计器生产级升级 W1-W4（31 组件物料 + registry/palette/setters + 模板 + 校验引擎 + 33 测试） |
| D-005 | done | high | v01 | luban-bff | Lead/Form/FeatureGate/页面版本路由 + W5 协作 WebSocket 服务 + IDOR 越权修复 |
| D-006 | done | medium | v01 | luban-website | 表单提交 composable + DynamicPage 集成 + 访客侧 useFeatureGate |
| D-007 | done | medium | v01 | workspace | W1 平台基础设施（docker-compose 6 服务 + .env.example + scripts）+ taskGraph SSOT |

### 未交付 / 新迭代

| ID | 状态 | 优先级 | 迭代 | 模块 | 标题 |
|----|------|--------|------|------|------|
| T-001 | pending | medium | 未排期 | luban-ui | 评估 monorepo 管理工具：nx → 替代方案 |
| T-002 | pending | high | 未排期 | client | 初始化 Flutter 客户端子仓（packages/client/luban-flutter） |
| T-003 | pending | high | 未排期 | client | 初始化 Electron 客户端子仓（packages/client/luban-electron） |
| T-004 | pending | high | 未排期 | luban-bff | 补齐 BFF 测试（当前零测试文件，违反测试门禁） |
| T-005 | pending | high | v02 | luban-website | 补齐 website 测试（当前零测试文件，违反测试门禁）— v02 补 vitest + composables 单测止血 |
| T-006 | pending | medium | 未排期 | workspace | meta 仓 + 子仓 CI 补齐（meta 无 .github/workflows） |
| T-007 | pending | medium | 未排期 | backend-go | Go 后端修复 detached HEAD + 补测试 + 补 CI（v02 开 issue 追赶 v01+v02 parity） |
| T-008 | pending | low | 未排期 | workspace | docker-compose 端口暴露面核查（6 服务全开 ports） |
| P-001 | pending | high | v02 | product | 计费/订阅/支付闭环（billing/payment 当前 0 实现）— v02 做商业化骨架（三档 Plan 价格全 0 + 逻辑完整），支付后置 |
| P-002 | pending | high | 未排期 | product | 自定义域名 + CDN（cname/cdn 当前 0 实现，企业客户硬门槛） |
| P-003 | pending | high | v02 | product | 转化分析/归因/A·B 测试（analytics/tracking 当前 0 实现，此类产品卖点） |
| P-004 | pending | high | 未排期 | product | SEO 能力产品化（meta/OG/sitemap/结构化数据，当前薄弱） |
| P-005 | pending | medium | 未排期 | product | Lead → CRM/营销工具集成（crm/zapier/mailchimp 当前 0，仅 export） |
| P-006 | pending | medium | 未排期 | product | 团队/组织/协作/发布审批（invite/member/approval 当前 0） |
| P-007 | pending | medium | 未排期 | product | 隐私合规（GDPR/个人信息保护/Cookie 同意/数据保留） |
| P-008 | pending | medium | 未排期 | product | i18n 多语言（i18n/locale 当前 0） |
| P-009 | pending | low | 未排期 | product | 模板市场产品化（template 命中多但 marketplace 仅 1 处提及） |
| P-010 | pending | low | 未排期 | product | 通知体系扩展（sms=0；email/notification/webhook 有雏形待补全） |

---

## 详情

### T-001 评估 monorepo 管理工具：nx → 替代方案

- **状态**：pending（占位，候选方案待后续调研）
- **影响仓**：子仓 `packages/ui/luban-ui`（git submodule `xiaoshuai1024/luban-ui`，分支 `master`）
- **背景**：`nx` 仅用于 `luban-ui` 子仓（**非** 整个 workspace；meta 仓本身是 git submodule 聚合，无 nx）。luban-ui 内部是 pnpm workspace（`apps/*` + `packages/*`，共 5 个子包），nx 通过插件推导项目，**无 `project.json`**，配置集中在以下文件。

#### 相关文件路径（精确落点）

| 路径（相对 luban-workspace 根） | 作用 | 迁移影响 |
|------|------|------|
| `packages/ui/luban-ui/nx.json` | nx 核心：`namedInputs` 缓存、`targetDefaults`、5 个插件注册、`nxCloudId`（Nx Cloud 远程缓存） | 🔴 高 — 核心配置，替换时整体重写 |
| `packages/ui/luban-ui/package.json` | 13 个 `@nx/*` devDeps（`@nx/vite` `@nx/vitest` `@nx/cypress` `@nx/storybook` `@nx/vue` `@nx/js` `@nx/eslint` `@nx/web` `@nx/workspace` 等，均 22.5.4）；`scripts` 全部 `nx run/test/e2e/run-many` | 🔴 高 — 依赖与脚本全量替换 |
| `packages/ui/luban-ui/pnpm-workspace.yaml` | pnpm workspace 定义（`apps/*` `packages/*`） | 🟢 低 — pnpm 原生，可保留 |
| `packages/ui/luban-ui/vitest.workspace.ts` | vitest 多包配置 | 🟢 低 — 与 nx 解耦，可保留 |
| `packages/ui/luban-ui/tsconfig.base.json` | TS 路径映射（nx 项目引用基础） | 🟡 中 — nx 移除后需确认路径别名仍生效 |
| `packages/ui/luban-ui/eslint.config.mjs` | 引用 `@nx/eslint-plugin` flat config | 🟡 中 — 需替换 nx eslint 插件部分 |
| `packages/ui/luban-ui/.nx/cache/` | nx 本地缓存目录（含 `cloud/` `run.json` `terminalOutputs/`） | 🟢 低 — 删除即可 |
| `packages/ui/luban-ui/apps/luban-ui/` | 主应用（Vite + Vue 3） | 🟡 中 — dev/build/test/e2e 脚本改写 |
| `packages/ui/luban-ui/apps/luban-ui-e2e/` | Cypress E2E（`@nx/cypress` 推导） | 🟡 中 — e2e 入口脚本改写 |
| `packages/ui/luban-ui/packages/luban-base/` | 基础物料包（发版目标之一） | 🟡 中 — build/发布脚本改写 |
| `packages/ui/luban-ui/packages/luban-low-code/` | 低代码物料包（发版目标之一） | 🟡 中 — build/发布脚本改写 |
| `packages/ui/luban-ui/packages/luban-utils/` | 工具包 | 🟡 中 — build 脚本改写 |
| `packages/ui/luban-ui/Makefile` | 顶层编排（可能含 nx 调用） | 🟡 中 — 需同步检查 |
| `packages/ui/luban-ui/.github/` | CI（若调用 nx） | 🟡 中 — 需同步检查 |

#### 当前 nx 能力清单（迁移需对齐）
- **任务编排**：`nx run-many --target=build --projects=...`（发版 `release:packages`）
- **缓存**：`namedInputs`（`production` 输入集）+ `targetDefaults` 依赖链（`test dependsOn ^build`）
- **远程缓存**：Nx Cloud（`nxCloudId: 69b29660...`，`.nx/cache/cloud/`）
- **插件推导**：vite/vitest/cypress/storybook/vue/eslint 插件自动生成 `dev/build/test/e2e/serve` 等 target

- **目标**：评估是否将 luban-ui 的 nx 更换为更轻量方案（Turborepo / pnpm workspace 原生 / 裸 npm scripts + vitest），权衡迁移成本与收益（缓存、任务编排、发版流水线）。
- **待办（调研阶段，后续迭代展开）**：
  - [ ] 逐文件核对上表路径当前内容（迭代前刷新，避免指针漂移）
  - [ ] 盘点实际用到的 nx 能力：哪些是缓存/编排收益，哪些可被 pnpm scripts + turbo 替代
  - [ ] 列候选方案矩阵：Turborepo / pnpm 原生 / 裸 scripts，标注迁移代价
  - [ ] 评估 Nx Cloud 替代（本地缓存 vs turbo remote cache vs 放弃远程缓存）
  - [ ] PoC：在 `packages/luban-base` 跑通替代方案，回归 build/test/e2e
  - [ ] 检查 `packages/ui/luban-ui/.github/` 与 `Makefile` 是否调用 nx，纳入迁移
- **验收标准**：产出方案对比文档 + 迁移影响评估（以上表为基础），明确推荐结论后再进入实施。

---

### T-002 初始化 Flutter 客户端子仓

- **状态**：pending
- **影响路径**：`packages/client/luban-flutter/`（当前**不存在**）
- **背景**：`packages/client/` 目录整体缺失。README 规划 4 个空仓（`ai-assistant`/`electron`/`flutter`/`cross-plateform`），GitHub 上为空仓（无初始提交）。规则 `luban-multi-client-consistency.md` 明确要求 `packages/client/luban-flutter` 存在并与 web/electron 业务一致。`/pr-client` 命令与 `pr-create-package.sh client:flutter` 已就绪，但无实体可操作。
- **执行步骤**：
  1. 在 GitHub `xiaoshuai1024/luban-flutter` 创建空仓（若未建）
  2. 本地 `flutter create` 初始化项目 → 首次提交 → push 到 `main`（空仓必须先有 commit，否则 `git submodule add` 失败）
  3. 执行 `bash scripts/git/add-empty-submodule.sh luban-flutter packages/client/luban-flutter main` 接入
  4. 同步更新 `.gitmodules`
- **关键约束**：
  - 遵循 `luban-multi-client-consistency.md`：Flutter 与 web/electron 业务逻辑、数据契约、用户旅程一致
  - 引擎驱动渲染：消费同一 schema，差异仅限平台样式
- **验收标准**：`packages/client/luban-flutter` 可独立 `flutter run`；`add-empty-submodule.sh` 接入成功；`/pr-client client:flutter` 链路可用。

### T-003 初始化 Electron 客户端子仓

- **状态**：pending
- **影响路径**：`packages/client/luban-electron/`（当前**不存在**）
- **背景**：同 T-002，`client/` 目录缺失，electron 空仓待接入。Electron 复用 web 渲染层（Chromium），与 `packages/web/luban-website` 高度共享，初始化时应规划与 web 端的代码复用边界。
- **执行步骤**：
  1. GitHub `xiaoshuai1024/luban-electron` 创建空仓
  2. 初始化（建议 electron-vite / electron-forge + TypeScript）→ 初始提交 → push `main`
  3. `bash scripts/git/add-empty-submodule.sh luban-electron packages/client/luban-electron main`
  4. 更新 `.gitmodules`
- **关键约束**：
  - `luban-multi-client-consistency.md`：与 web/Flutter 一致，不得因 Chromium 环境省略功能
  - 明确与 `luban-website` 的复用边界（主进程 vs 渲染进程 vs 共享 BFF 调用）
- **验收标准**：`packages/client/luban-electron` 可独立启动；接入 submodule 成功；`/pr-client client:electron` 可用。

### T-004 补齐 BFF 测试

- **状态**：pending
- **影响路径**：`packages/bff/luban-bff/`（当前 **0 个测试文件**）
- **背景**：实测 engine 10 个、ui 29 个测试，但 **bff 零测试**，违反 `.agents/rules/luban-testing-coverage.md` 门禁。BFF 是前后端契约边界，无测试 = 契约无防护。`vitest.config` 在 bff 也缺失。
- **待办**：
  - [ ] 补 `vitest.config.ts`
  - [ ] 为现有接口/中间件/数据转换补单测，覆盖 BFF→后端契约映射
  - [ ] 接入 `scripts/coverage/coverage-summary.sh` 门禁
- **验收标准**：bff 测试覆盖率达到 `TESTING_SPEC.md` 分栈要求；`make test` 通过。

### T-005 补齐 website 测试

- **状态**：pending
- **影响路径**：`packages/web/luban-website/`（当前 **0 个测试文件**）
- **背景**：website 零测试。作为多端一致性基准端（`luban-multi-client-consistency.md` 以 web 为准），无测试会让其它端失去对照。
- **待办**：
  - [ ] 补测试配置（vitest / playwright 视框架而定）
  - [ ] 核心页面/组件单测 + 关键路径 E2E
  - [ ] 接入覆盖率门禁
- **验收标准**：达到 `TESTING_SPEC.md` 要求；`make test` 通过。
- **v01 实测注记（2026-06-17）**：v01 新增了 `useLeadSubmit` / `useFeatureGate` / `DynamicPage.vue` 表单集成等关键逻辑，仍零测试。**v02 P-003 将继续在 website 加埋点 SDK/plugin，测试债务会进一步扩大**——建议 v02 内顺手补 website vitest 配置 + composables 单测，避免雪崩。

### T-006 补齐 CI（meta 仓 + 子仓）

- **状态**：pending
- **影响路径**：`/.github/workflows/`（meta 仓**无**）；子仓 `luban-ui` 也无 workflow
- **背景**：meta 仓无 `.github/workflows`；7 个 submodule 中仅 backend-java/engine/bff/website 有 CI，**ui 0 workflow**、**backend-go 0 workflow**。测试门禁（`make test-coverage`）只在本地手动跑，无自动化保障。
- **待办**：
  - [ ] meta 仓加 workflow：submodule 同步检查 + 文档 lint
  - [ ] luban-ui 补 CI（build/test/e2e）
  - [ ] 统一各仓 CI 触发条件与缓存策略
- **验收标准**：所有子仓 + meta 仓有 CI；PR 合并需 CI 绿。

### T-007 修复 Go 后端（detached HEAD + 零测试 + 无 CI）

- **状态**：pending
- **影响路径**：`packages/backend/luban-backend-go/`
- **背景**：实测 Go 后端**不在任何分支**（detached HEAD）、**0 测试文件**、**无 CI workflow**。作为 Java 双实现（`luban-dual-backend-parity.md` 要求行为一致），当前无任何验证手段。
- **v01 实测注记（2026-06-17）**：本迭代 Go 后端**完全未被纳入**——本地 detached HEAD @ `eadf721`，远端仅有 `master`/`dev`/`feat/auth-middleware-role-guard`，**无 `feature/lead-capture-mvp` 分支**。grep 显示 Go 端连 Lead/UTM/visitor 都未实现（Java 端已完整交付 D-001）。parity 缺口随每轮迭代扩大。
- **待办**：
  - [ ] 检出/绑定分支（`git checkout master` 或对应分支）
  - [ ] 补 `_test.go`，对齐 Java 端接口契约做 parity 测试
  - [ ] 补 CI workflow（go test + vet）
  - [ ] **追赶 v01**：补齐 Lead/Form/FeatureGate/协作 WS 的 Go 实现（对齐 D-001/D-002/D-005）
- **验收标准**：Go 后端在正常分支；接口与 Java 行为一致测试通过；CI 绿。

### T-008 docker-compose 端口暴露面核查

- **状态**：pending
- **影响路径**：`docker-compose.yml`
- **背景**：6 个服务（mysql/redis/backend/bff/engine/website）全部 `ports:` 暴露。`.env.example` 标注 DEV-ONLY，但生产部署前需确认端口隔离。
- **待办**：
  - [ ] 区分 dev profile（全暴露）与 prod profile（仅 website/bff 暴露）
  - [ ] 数据库/中间件默认仅内部网络可达
- **验收标准**：生产 compose 配置下 mysql/redis/backend 不对外暴露端口。
- **备注**：dev 环境全暴露可接受，优先级 low；上生产前必须处理。

---

## 产品层缺口（P- 系列）

> 以下基于 2026-06-16 对各仓 `src` 的关键词实测（证据见各条「实测证据」）。产品定位经代码确认：**Lead Capture / 落地页建站 SaaS**（核心实体 Lead/Form/Site/Page），对标 Unbounce/Instapage，非泛低代码平台。
>
> 优先级按「能否商业化收费」排序：解锁付费 > 解锁企业客户 > 解锁续费 > 市场扩展。

### P-001 计费/订阅/支付闭环

- **状态**：pending
- **商业价值**：🔴 解锁付费（SaaS 商业化命脉）
- **实测证据**：`billing`/`payment`/`subscription`/`pricing` 在 `backend/src/main` **0 命中**（9 个 payment 命中均非实现）。已有 `FeatureGate`（实体+服务+控制器，45+53 行）—— 是套餐管控的「锁」，但缺付费就没有「钥匙」。
- **影响路径**：`packages/backend/luban-backend/src/main/java/com/luban/backend/`（新增 plan/subscription/payment 域）；BFF/website 新增计费 UI。
- **缺**：套餐（plan）定义、订阅生命周期、支付网关（Stripe / 支付宝 / 微信）、用量计费、发票、试用期、升降级/退款。
- **关键依赖**：与 P-003（转化分析）共享「用量」口径；FeatureGate 现有实现可直接复用为门禁。
- **验收标准**：客户可完成「注册→选套餐→支付→FeatureGate 按 plan 放行」全闭环；订阅状态变更可测。

### P-002 自定义域名 + CDN

- **状态**：pending
- **商业价值**：🔴 解锁企业客户（硬门槛）
- **实测证据**：`cname`=0、`cdn`=0。`domain`=32 命中（多为字段/配置）。
- **缺**：CNAME 验证、TLS 证书自动签发（Let's Encrypt/ACME）、边缘分发、自定义域名→site 路由。
- **影响路径**：新增边缘/网关层；website SSR 接收 host 路由；backend 加域名归属验证。
- **验收标准**：客户绑定自有域名后，访问该域名命中其 site，HTTPS 自动生效。

### P-003 转化分析 / 归因 / A·B 测试

- **状态**：pending
- **商业价值**：🔴 解锁续费（此类产品第一卖点，Unbounce 核心）
- **实测证据**：`analytics`=0、`tracking`=0、`conversion`=0、`funnel`=0。
- **v01 实测纠偏（2026-06-17，重要）**：
  - ❌ 原注「现有 `PageVersion` 可作为 A/B 分流的版本载体」**不成立**。PageVersion 是发布即快照的线性单调递增模型（唯一键 `page_id+version`，回滚=复制 schema 建新版本），**不支持多版本并存/按权重分流**。A/B 变体须新建 `ab_experiments`/`ab_variants`/`ab_assignments` 表。
  - ❌ FeatureGate 是纯布尔开关（`enabled TINYINT`），**无权重/分桶/变体**，不能直接做 A/B 门禁。只能复用做「A/B 功能总开关」(`gate_key='ab_testing'`)。
  - ✅ **可复用的真正资产**：Lead 表已落 `utm_json`/`channel_id`/`visitor_id`/`source_ip` 字段（D-001 交付），是漏斗终点事件源。但渲染端 `DynamicPage.vue` 当前**未解析 URL `?utm_*`、未生成 visitorId**——归因字段实际为空，P-003 必须先补这段。
  - ✅ 公开免鉴权入口模式可复用：`PublicLeadController` 的 IP 解析 + BFF `X-Visitor-ID`/`X-Forwarded-For` 透传链路。
- **子任务拆分（v02 排期基础）**：
  - 3.1 埋点采集 SDK + 注入（website Nuxt plugin + `app.vue`，**禁止侵入 engine/物料**）
  - 3.2 事件接收 + 存储（backend-java 新表 `analytics_events`，JSON payload + site_id 索引；Go 对齐）
  - 3.3 Lead 链路补归因字段（**隐性硬前置**：补 `DynamicPage.vue` 解析 UTM + 生成 visitorId cookie）
  - 3.4 A/B 分流引擎（新域 `ab`，一致性哈希 + 持久化分桶）
  - 3.5 转化漏斗 + 归因查询 API（聚合 leads + analytics_events，预聚合 `analytics_daily`）
  - 3.6 显著性检验 + 前端报表（Apache Commons Math χ² 检验；ui 新 Analytics 页）
  - 3.7 第三方集成（GA/Pixel/GTM 转发，可后置）
- **风险点**：
  - 🔴 与 P-001 共享「用量」口径（A/B 实验数/事件量/访问量都会成为计费用量），事件表设计时必须与 P-001 计量口径对齐，否则返工。
  - 🔴 website SSR 埋点对引擎渲染的影响：埋点必须放 website 顶层 plugin，**禁止侵入 engine/物料**（违反 AGENTS.md 「引擎可用性优先级最高」）。
  - 🟡 双后端对齐：当前 Go 端连 Lead 域都未实现（见 T-007），P-003 在 Go 端从零；v02 需评估是否本期 Java-only（需显式 parity 豁免）。
- **验收标准**：客户能看到「每页转化率 / 渠道归因 / A/B 显著性结论」。

### P-004 SEO 能力产品化

- **状态**：pending
- **商业价值**：🔴 解锁自然流量（落地页靠搜索 + 社交分发）
- **实测证据**：`seo`=5、`sitemap`=3、`robot`=19，薄弱；无 OG/结构化数据产品化封装。
- **缺**：每页自定义 meta/OG/Twitter Card、结构化数据（schema.org）、自动 sitemap、301/重定向、A/B 页 canonical/noindex 控制。
- **验收标准**：发布页面自动产出合规 meta + sitemap；社交分享预览正确。

### P-005 Lead → CRM / 营销工具集成

- **状态**：pending
- **商业价值**：🟡 补全获客闭环（线索进客户销售系统）
- **实测证据**：`crm`/`hubspot`/`salesforce`/`mailchimp`/`zapier`/`integration` 全 0；`export`=38（仅 CSV 导出）。`webhook`=1（有雏形可扩展）。
- **v01 实测注记（2026-06-17）**：`DefaultLeadNotifyService` 内已有 Webhook 投递占位点（`log.info("待投递")`），是 P-005 的天然接入点——但**仅日志占位、未真正 HTTP 投递，无重试/幂等**。P-005 实质仍未启动。
- **缺**：Webhook 推送扩展（真正 HTTP 投递 + 重试 + 幂等键）、原生 CRM 连接器、营销自动化触发、Zapier/n8n 接入。
- **验收标准**：Lead 提交后可自动推送到客户配置的 CRM/Webhook，失败可重试可观测。

### P-006 团队 / 组织 / 协作 / 发布审批

- **状态**：pending
- **商业价值**：🟡 解锁 B2B 团队采购
- **实测证据**：`invite`/`member`/`team`/`collaborat`/`approval` 全 0；`organization`=4（仅 ORG 前缀，非实体）。
- **缺**：组织/团队模型、邀请、角色细分（编辑/审核/管理员）、发布审批流。
- **关键依赖**：现有 `Role`（69 命中）可扩展为团队内角色。
- **验收标准**：一个组织内多人协作，发布需审核人批准。

### P-007 隐私合规（GDPR / 个人信息保护）

- **状态**：pending
- **商业价值**：🟡 解锁企业/出海客户（法务门槛）
- **实测证据**：密钥卫生 ✓（`.gitignore` 含 `*.key`/`secrets/`）、审计日志 ✓（`LeadAuditLog`）。但 Cookie 同意/数据保留/被遗忘权/DPA 未见。
- **缺**：Cookie 同意横幅、数据保留策略、被遗忘权（删除/匿名化）、数据处理协议（DPA）、隐私政策联动。
- **验收标准**：用户可导出/删除自己的数据；Lead 数据按策略自动清理。

### P-008 i18n 多语言

- **状态**：pending
- **商业价值**：🟡 解锁多地区市场
- **实测证据**：`i18n`/`locale`=0（website/ui 均无）。
- **缺**：文案抽取、语言切换、按地区默认语言、后端错误码多语言。
- **验收标准**：站点至少支持中/英切换，新增语言仅需补文案包。

### P-009 模板市场产品化

- **状态**：pending
- **商业价值**：🟢 降低上手 + 生态分发
- **实测证据**：`template`=196（命中多，可能是引擎物料模板），`marketplace`=1（仅提及）。
- **待确认**：先核实 196 处是引擎物料还是面向终端用户的落地页模板。
- **缺**（若面向终端）：模板分类/搜索/预览/一键使用/贡献者上架。
- **验收标准**：用户可从模板库一键创建站点。

### P-010 通知体系扩展

- **状态**：pending
- **商业价值**：🟢 用户触达与留存
- **实测证据**：`email`=9、`notification`=3、`webhook`=1、`sms`=0。有雏形但不完整。
- **缺**：短信通道、站内通知中心、邮件模板体系、通知偏好设置、事件驱动通知（新 Lead 到达提醒客户）。
- **验收标准**：Lead 到达/状态变更等关键事件可经用户偏好渠道触达。
