---
featureId: v02-analytics-billing
title: v02 转化分析 + 商业化骨架
status: ready
branch: feature/v02-analytics-billing
upstream:
  - TODO.md P-001 / P-003 / T-005（2026-06-17 收敛回写）
  - feature/lead-capture-mvp 分支（v01 已交付 Lead/FeatureGate/PageVersion 基础）
依据声明: |
  本 plan 依据「/plan-template 命令内联契约（§0-§9 + 14 质量禁令 + §9 派发 + 四级门禁）」
  + .agents/skills/writing-plans/SKILL.md + docs/superpowers/PLAN_WRITING_CONTRACT.md 编写。
  taskGraph: docs/superpowers/tasks/v02-analytics-billing.json。
  校验脚本 scripts/verify-plan-ssot.mjs 为 stub，JSON 合规性人工保证，不宣称"校验脚本通过"。
taskGraph: ./tasks/v02-analytics-billing.json
---

# v02 · 转化分析 + 商业化骨架实现计划

> 本 plan 是 luban 系列第二份。v01（lead-capture-mvp）已交付留资闭环 + FeatureGate「锁」+ 设计器升级。
> 本期承诺 **P-003 转化分析主链路 + 商业化骨架**（三档 Plan，价格全 0，逻辑完整），单次实现周期内全部完成至四级门禁全绿。

---

## §0 范围与分支策略

### 0.1 本期范围

**A. P-003 转化分析主链路**（子任务 3.1–3.6，Java-only）
- 归因字段补全（3.3，**隐性硬前置**）→ 埋点采集 SDK（3.1）→ 事件存储（3.2）→ 漏斗/归因查询（3.5）→ A/B 分流引擎（3.4）→ 显著性检验 + 报表（3.6）
- 3.7（GA/Pixel/GTM 转发）列入「时间够则做」，否则推 v03

**B. 商业化骨架**（价格全 0，逻辑完整，支付后置）
- Plan 三档（Free/Starter/Growth，价格=0）+ 用户绑 plan + plan→gate 放行
- 用量统计 + 超限拦截
- 试用期 14 天 Starter 试用 + 到期降 Free

**核心收益**：让「按套餐管控功能 + 按用量限额 + 试用降级」逻辑跑通；未来接支付只改价格，不动逻辑。

### 0.2 分支

- 主仓 `luban-workspace`：新建 `feature/v02-analytics-billing`（**执行前须用户确认**，主会话不自动切）
- 各子项目：同名分支 `feature/v02-analytics-billing`（backend-java / bff / website / engine）
- **backend-go**：本期 parity 显式豁免（**不切分支、不实现**，开 GitHub issue 追赶 v01+v02）
- **client**：本期不涉及（`packages/client/` 不存在）

### 0.3 taskGraph SSOT

任务图 JSON：`docs/superpowers/tasks/v02-analytics-billing.json`（已随本 plan 同步）。校验脚本为 stub，JSON 合规性人工保证。

---

## §1 需求溯源与追溯矩阵

### 1.1 需求来源
- **产品层 SSOT**：`TODO.md` P-001（计费/订阅/支付闭环）、P-003（转化分析/归因/A·B 测试）、T-005（website 测试补齐）
- **v01 已交付基础**（见 TODO.md D-001~D-007）：Lead 领域已落 `utm_json/channel_id/visitor_id/source_ip` 字段；FeatureGate 实体/服务/控制器齐备；website 已有 `useLeadSubmit/useFeatureGate` composable
- **用户决策（2026-06-17）**：不收费（支付/订阅生命周期/发票后置）；Plan 三档价格全 0，逻辑完整

### 1.2 需求追溯矩阵

| # | 需求（来源） | Task ID | E2E 场景 | 验收门禁 |
|---|---|---|---|---|
| R1 | 归因字段补全（UTM/visitorId 透传到 Lead） | T-web-1 | E2E-6 | G3/G4 |
| R2 | 埋点采集（pageview/form_expose/form_submit） | T-web-2 | E2E-6 | G3/G4 |
| R3 | 事件接收 + 存储（AES 脱敏 source_ip） | T-be-6 | E2E-6 | G3 |
| R4 | 转化漏斗 + 归因查询 | T-be-8,T-bff-3 | E2E-1 | G3/G4 |
| R5 | A/B 分流引擎（一致性哈希 + 持久化分桶） | T-be-9,T-be-10 | E2E-2 | G3/G4 |
| R6 | 显著性检验（χ²） + 报表 | T-be-11,T-eng-2 | E2E-1,2 | G3/G4 |
| R7 | Plan 三档 + 用户绑 plan | T-be-2,T-bff-1 | E2E-3 | G3 |
| R8 | plan→gate 放行改造（向后兼容） | T-be-3 | E2E-3 | G3 |
| R9 | 用量统计 + 超限拦截（429） | T-be-4,T-bff-5 | E2E-4 | G3/G4 |
| R10 | 试用期 14 天 + 到期降级 | T-be-5 | E2E-5 | G3 |
| R11 | ab 实验管理页（创建/结束/查看显著性） | T-eng-3 | E2E-2 | G4 |
| R12 | 套餐用量展示 + 升级引导（非支付） | T-eng-4 | E2E-3 | G4 |
| R13 | website 测试止血（T-005） | T-web-4 | (单测) | G3 |
| R14 | 多租户隔离（site A 看不到 site B） | T-be-2,T-be-9 | E2E-7 | G3/G4 |

### 1.3 明确不做（防膨胀，继承讨论稿共识）

| 不做项 | 理由 | 出处 |
|---|---|---|
| ❌ 支付网关（Stripe/支付宝/微信） | 用户指示「不收费」 | 用户决策 |
| ❌ 订阅生命周期（升降级/退款/续费/扣费） | 同上 | 用户决策 |
| ❌ 发票 | 同上 | 用户决策 |
| ❌ Go 后端本期实现 | parity 显式豁免（Go 端 v01 Lead 域都未实现） | 用户决策 + T-007 实测 |
| ❌ 客户端（electron/flutter） | `packages/client/` 不存在，T-002/T-003 留 v03 | 讨论稿 |
| ❌ 热力图 | P-003 验收不要求 | 讨论稿 |
| ❌ ClickHouse OLAP | 上轮已定 MySQL 起步（`analytics_events` + `analytics_daily` 预聚合） | 用户决策 |
| ❌ P-004 SEO 产品化（sitemap/OG/结构化数据） | 独立迭代，留 v03 | Q10 |
| ❌ 可选埋点事件（click/scroll/dwell） | 必采够用，可选推 v03 | Q6 |
| ❌ Flyway 引入 | 避免镀金；沿用 schema.sql 幂等加载 | Q1 |
| ❌ 3.7 GA/Pixel/GTM 转发 | 时间够则做，否则推 v03 | 讨论稿 |
| ❌ luban-ui 新增图表物料 | 图表是 engine 报表组件，非终端落地页物料；engine 内引 ECharts 即可 | §9 ui 判断 |
| ❌ PageVersion 复用做 A/B 载体 | 破坏快照不变式；新建 `ab_*` 三表 | P-003 实测纠偏 |

### 1.4 变更记录
- 2026-06-17 初版：基于 v01 收敛 + P-003 落点调研 + 用户 Q1–Q10 决策

---

## §2 系统与链路

### 2.1 涉及子系统

| 子系统 | 角色 | v02 增量 |
|---|---|---|
| backend-java | 主后端 | billing 域（Plan/Subscription/Trial/Quota/Usage）+ analytics 域（Event 接收/Daily 预聚合/查询）+ ab 域（Experiment/Variant/Assignment + χ²）+ FeatureGate 改造 + 用量拦截 + schema.sql 增 8 表 |
| bff | API 聚合 | billing/analytics/ab 路由（管理端 + 访客公开）+ 用量拦截中间件 |
| website | 访客渲染 | 归因字段补全 + 埋点 SDK + ab 分流接入 + vitest 止血；**禁止侵入 engine/物料** |
| engine | 管理后台 | Analytics 一级菜单 + 报表页 + ab 实验管理页 + 套餐用量展示 |
| luban-ui | 物料库 | **本特性不涉及**（图表在 engine 内用 ECharts，非终端落地页物料） |
| backend-go | 暂缓 | 本期 parity 显式豁免，开 issue 追赶 |
| client | 暂缓 | 本期不涉及 |

### 2.2 端到端链路

**链路 A：访客埋点采集（核心）**
```
访客打开 website/:slug/* (SSR 首屏)
  → server/middleware/visitorId.ts set visitor_id cookie (HttpOnly+SameSite=Lax)
  → DynamicPage.vue SSR 取 schema (经 usePageByPath → BFF → backend)
  → plugins/analytics.client.ts 初始化 + 自动采集 page_view
  → 表单进入视口 → useAnalytics.track('form_expose')
  → 访客填写提交 → useLeadSubmit(已补 UTM/visitorId/channelId)
  → POST BFF /api/public/analytics/events (page_view/form_expose 事件批量)
  → BFF 限流 + POST backend /public/analytics/events
  → backend AES 脱敏 source_ip → INSERT analytics_events
  → 定时任务聚合 analytics_events → analytics_daily
```

**链路 B：A/B 分流渲染**
```
访客打开 website/:slug/* (SSR)
  → server middleware 调 BFF GET /api/public/ab/assign?siteId=&pageId=&visitorId=
  → BFF → backend /public/ab/assign
  → backend 一致性哈希(visitor_id) → 查/建 ab_assignments → 返回 variant_id
  → server middleware 把 variant_id 注入 schema fetch 请求 (query/header)
  → DynamicPage 收到变体 schema → 渲染对应变体
  → (变体产生的 page_view/Lead 事件带 variant_id → 归因到变体)
```

**链路 C：转化漏斗 + 归因报表**
```
客户在 engine 进入 Analytics 菜单
  → api/analytics.getOverview/getFunnel/getAttribution/getTrend
  → BFF /api/analytics/* → backend /analytics/*
  → backend 聚合 analytics_daily + leads (按 site_id/page_id/variant_id)
  → 返回转化率/漏斗/归因/趋势数据
  → engine 报表页渲染 (ECharts)
```

**链路 D：A/B 实验管理 + 显著性**
```
客户在 engine 进入 A/B 实验管理页
  → 创建实验 (选 page + 变体 page_version_id + 权重) → POST /api/ab/experiments
  → 实验运行 (visitor 分流持续累计)
  → 查看显著性 → GET /api/ab/experiments/:id/significance
  → backend χ² 检验 (Apache Commons Math) → 返回 p-value/置信区间/转化率
  → 结束实验 → POST /api/ab/experiments/:id/end (status→ended)
```

**链路 E：套餐用量 + 试用降级**
```
用户登录 → engine 读 GET /api/billing/me (plan/quota/usage)
  → 显示套餐标识 + 用量进度条 (Lead 数/页面数/访问量)
  → 用量超限 → bff 中间件返回 429 + 友好错误体
  → 新用户注册 → 默认绑 Free plan + 触发 14 天 Starter 试用
  → 定时任务扫描 trial_records → 到期 → Subscription 降 Free (数据保留)
```

---

## §3 业务逻辑与契约假设

### 3.1 领域对象

**billing 域**
- `Plan`（plan_code PK）：套餐定义。Free/Starter/Growth，价格=0，含配额（leads/pages/visits 月度上限）+ gates（放行的 gate_key 集合）+ trial_days
- `Subscription`（user_id PK）：用户当前订阅。status: `active/trialing/expired`，关联 plan_code + 时间戳
- `TrialRecord`（user_id PK）：试用记录。trial_plan_code + started_at + ends_at + converted_to（降级去向）
- `UsageCounter`（user_id+period_month+metric 唯一）：月度用量计数。原子累加

**analytics 域**
- `AnalyticsEvent`：原始事件。site_id/visitor_id/session_id/event_type/event_payload(JSON)/page_id/variant_id/utm_json/client_ts/server_ts/source_ip_hashed
- `AnalyticsDaily`：预聚合。site_id+date+page_id+variant_id 唯一，聚合 views/submissions/conversions

**ab 域**
- `AbExperiment`：实验。site_id/page_id/name/status(draft/running/paused/ended)/traffic_pct
- `AbVariant`：变体。experiment_id/label(A/B)/page_version_id/weight/is_control
- `AbAssignment`：分桶。visitor_id+experiment_id 唯一 → variant_id（稳定分桶）

### 3.2 状态穷举

**Subscription.status 状态机**

| 当前状态 | 事件 | 目标状态 | 前置条件 | 后置效果 |
|---|---|---|---|---|
| (无) | 注册 | trialing | 新用户 | 绑 Free + 建 TrialRecord(starter, +14d) |
| trialing | 到期 | active(Free) | now >= trial_ends_at | Subscription.plan→Free, status→active |
| active | 切换 plan | active | 管理端调用 | plan_code 更新（价格=0 无扣费） |
| active | - | active | - | 正常使用 |

**AbExperiment.status 状态机**

| 当前状态 | 事件 | 目标状态 | 前置条件 | 后置效果 |
|---|---|---|---|---|
| draft | 启动 | running | 至少 2 variants + 单页无其他 running | 开始分流 |
| running | 暂停 | paused | - | 停止分流（已分桶 visitor 保持） |
| paused | 恢复 | running | - | 恢复分流 |
| running/paused | 结束 | ended | - | 停止分流，锁定数据 |
| ended | - | ended | - | 只读，可查看显著性 |

**FeatureGate 改造（plan 放行）**

| gate 查询路径 | 旧逻辑（v01） | 新逻辑（v02） |
|---|---|---|
| 访客公开 `/public/feature-gates` | 按 site 读 enabled | 按 site → site.owner.plan.gates 判定（site 级 enabled 仍可 override 关闭，不可 override 开启） |
| 管理端 `/feature-gates` | CRUD enabled | 同上 + 显示「受 plan 限制」标记 |

向后兼容：旧 `gate_key`（lead_capture/realtime_collab/page_versioning/poster_export）保留语义，按 plan.gates JSON 判定是否放行；Free 档默认全放行（因不收费），Starter/Growth 档配额差异通过 QuotaInterceptor 实现，不通过 gate 卡。

### 3.3 多租户与鉴权

- siteId 隔离：所有 analytics/ab 查询强制 `WHERE site_id = ?`，复用现有 `TenantGuardService`（v01 已有）
- 访客公开路由（`/public/analytics/events`、`/public/ab/assign`）：免鉴权 + IP 限流（复用 AntiSpamService 模式）
- 管理端路由：需 `X-User-ID`/`X-User-Role`（bff 注入，复用 authToken 模式）
- source_ip 处理：采集 → AES 哈希（复用 LeadCryptoService）→ 只存哈希，不存原 IP

### 3.4 双后端契约一致性声明

| 方法 | 路径 | Java 状态 | Go 状态 | 差异原因 |
|------|------|-----------|---------|----------|
| GET | /billing/plans | 已实现 | 延后 | 本期 parity 显式豁免（Go 端 v01 Lead 域都未实现，追赶不现实，开 issue） |
| GET | /billing/me | 已实现 | 延后 | 同上 |
| POST | /billing/subscribe | 已实现 | 延后 | 同上 |
| GET | /billing/usage | 已实现 | 延后 | 同上 |
| POST | /public/analytics/events | 已实现 | 延后 | 同上 |
| GET | /analytics/overview | 已实现 | 延后 | 同上 |
| GET | /analytics/funnel | 已实现 | 延后 | 同上 |
| GET | /analytics/attribution | 已实现 | 延后 | 同上 |
| GET | /analytics/trend | 已实现 | 延后 | 同上 |
| POST | /ab/experiments | 已实现 | 延后 | 同上 |
| GET | /ab/experiments | 已实现 | 延后 | 同上 |
| POST | /ab/experiments/:id/end | 已实现 | 延后 | 同上 |
| GET | /public/ab/assign | 已实现 | 延后 | 同上 |
| GET | /ab/experiments/:id/significance | 已实现 | 延后 | 同上 |

**parity 豁免声明**：本期 Go 端全部接口延后。理由：Go 端 detached HEAD @ eadf721，v01 的 Lead/Form/FeatureGate/协作 WS 均未实现（见 TODO.md T-007 实测注记），追赶 v01+v02 需独立迭代。本期开 GitHub issue `luban-backend-go: parity 追赶 v01+v02`，列出待补接口清单。

---

## §4 交互与界面设计摘要

### 4.0 按系统的新增功能模块

| 系统 / 仓库 | 新增模块或承载物 | 职责简述 | 任务 ID |
|-------------|------------------|----------|---------|
| backend-java | billing 域（entity/mapper/service/controller/dto） | Plan 三档 + Subscription + Trial + Quota + Usage | T-be-2 |
| backend-java | analytics 域（entity/mapper/service/controller） | 事件接收 + Daily 预聚合 + 查询 | T-be-6,T-be-7,T-be-8 |
| backend-java | ab 域（entity/mapper/service/controller） | 实验/变体/分桶 + χ² 显著性 | T-be-9,T-be-10,T-be-11 |
| backend-java | FeatureGate 改造 + QuotaInterceptor + Trial 定时任务 | plan 放行 + 用量拦截 + 试用降级 | T-be-3,T-be-4,T-be-5 |
| backend-java | schema.sql 追加 8 表 | DDL | T-be-1 |
| bff | api/billing/* + api/analytics/* + api/ab/* + 用量中间件 | 聚合 + 透传 + 限流 + 429 | T-bff-1~5 |
| website | plugins/analytics.client.ts + server/middleware/{visitorId,abAssign}.ts + composables/{useUtm,useAnalytics,useAbAssign}.ts + DynamicPage 改造 + vitest | 归因 + 埋点 + 分流 + 测试止血 | T-web-1~4 |
| engine | api/{billing,analytics,ab}.ts + views/analytics/* + views/ab/* + 套餐用量组件 + 路由菜单 | 报表 + 实验管理 + 用量展示 | T-eng-1~4 |
| luban-ui | **本特性不涉及** | 图表在 engine 内用 ECharts，非终端落地页物料 | （无） |
| backend-go | **本特性不涉及**（parity 豁免） | 开 issue 追赶 | （无） |
| client | **本特性不涉及** | packages/client 不存在 | （无） |

### 4.1 UX 自检摘要（对照 ux-product-review rubric）

**阻断**（须先解决再大规模编码）
- 无。本特性范围明确，无遗留阻断项。

**强烈建议**
- Analytics 报表页与 ab 管理页须有明确的加载/空/错态（§4.3 已落点）
- 套餐用量进度条超限时用 `ElProgress` + 警示色，不用裸文字（对齐 luban-frontend-ux-enum）
- A/B 实验状态、Subscription status、event_type 在 UI 须有中文映射（`EXPERIMENT_STATUS_LABELS`、`SUBSCRIPTION_STATUS_LABELS`），禁止裸枚举英文

**可选**
- Analytics 报表页支持时间范围筛选（近 7/30/90 天），日期用 `ElDatePicker` range 模式
- ab 显著性结论用文案「置信度 95%，B 组转化率高于 A 组 X%」而非只贴 p-value

**管理后台枚举规范对照**（luban-frontend-ux-enum）
- Subscription.status、AbExperiment.status：用 `ElSelect`（创建表单）+ `dict-tag`（列表展示），禁止 `ElInput`
- 时间范围筛选：`ElDatePicker`（range），禁止文本输入
- 套餐切换：`ElSelect`（下拉选 plan_code），禁止输入

### 4.2 列表级交互链路

#### 4.2.1 Analytics 报表页（engine，T-eng-2）

1. 用户点「Analytics」一级菜单 → 路由 `/analytics` → 页面挂载
2. 顶部站点筛选 `ElSelect` 默认选当前 site → 触发 `api/analytics.getOverview(siteId)`
3. 概览卡片渲染（访问量/转化率/Lead 数/实验数），**加载中**显示骨架屏，**空**显示「暂无数据，请先发布页面」，**错**显示重试按钮
4. 时间范围 `ElDatePicker range` 默认近 7 天 → 触发 `getTrend(siteId, range)` → 趋势图（ECharts）
5. 漏斗 tab：`getFunnel(siteId, range)` → 渲染 page_view→form_expose→form_submit 三段漏斗
6. 归因 tab：`getAttribution(siteId, range)` → 渲染 UTM 来源/媒介/活动表格
7. A/B tab：跳转 ab 实验管理页（§4.2.2）

#### 4.2.2 A/B 实验管理页（engine，T-eng-3）

1. 用户进入 `/ab` → `api/ab.listExperiments(siteId)` → 表格渲染
2. 列：实验名 / 页面 / 状态（dict-tag）/ 变体数 / 创建时间 / 操作（查看/结束）
3. **空态**：「暂无实验，点击新建」按钮
4. 点「新建」→ 抽屉表单：选 page（ElSelect）→ 选变体 page_version_id（A/B 各一，ElSelect）→ 权重（ElInputNumber，默认 50/50）→ 流量比例（ElSlider，默认 100%）
5. 提交 → `createExperiment` → 成功 toast → 列表刷新；**错**（如该 page 已有 running 实验）→ 表单内联错误
6. 点「查看」→ 详情抽屉：变体转化率对比 + 显著性结论（`getSignificance` 返回 p-value/置信区间/文案）
7. running 状态点「结束」→ 确认弹窗 → `endExperiment` → status→ended

#### 4.2.3 套餐用量展示（engine，T-eng-4）

1. 用户菜单显示当前 plan 标识（dict-tag，如「Starter 试用中」）
2. 点击 → 弹出用量面板：3 个 `ElProgress`（Lead 数/页面数/访问量），已用/上限，超限警示色
3. 「升级套餐」按钮 → 跳转 `/settings/billing`（套餐对比表，三档，价格全显示 ¥0，按钮文案「切换」而非「购买」）

### 4.3 页面结构展示

#### Analytics 报表页（`/analytics`）
```
┌─ 顶栏：[Site Select ▾] [时间范围 DatePicker] ──────────────────┐
├─ 概览卡片行：[访问量] [转化率] [Lead 数] [实验数]              │  ← 加载骨架/空/错态
├─ Tab：[趋势] [漏斗] [归因] [A/B 实验→跳转]                     │
├─ 趋势图：ECharts 折线（page_view/转化 by day）                 │
├─ 漏斗（选中时）：page_view → form_expose → form_submit（三段） │
├─ 归因（选中时）：表格 [来源/媒介/活动/访问/转化/转化率]         │
└─ 空态：「暂无数据」+「去发布页面」CTA                           │
```

#### A/B 实验管理页（`/ab`）
```
┌─ 操作栏：[+ 新建实验]                                          ┐
├─ 表格：[实验名|页面|状态|变体|创建|操作]                        │
│   状态列：dict-tag（草稿/运行/暂停/已结束）                     │
│   操作列：[查看] [结束(running 才显示)]                          │
├─ 空态：「暂无实验」+ [新建] 按钮                                │
├─ 新建抽屉：[页面 Select][变体A page_version Select][变体B ...]  │
│            [权重 InputNumber][流量 Slider]                      │
└─ 详情抽屉：[变体对比表 A/B 转化率][显著性结论文案][p-value]     │
```

#### 套餐用量面板（用户菜单弹出）
```
┌─ 当前套餐：[Starter 试用中 dict-tag] ─────────────────────────┐
├─ Lead 数：[████████░░] 800/1000  ← 进度条，超限红色             │
├─ 页面数：[██░░░░░░░░] 3/10                                    │
├─ 访问量：[██████░░░░] 6k/10k                                  │
└─ [切换套餐 →] （跳 /settings/billing，非支付）                  │
```

---

## §5 集成与复用

| 将触碰的现有模块 / 服务 / 组件 / API | 复用方式或新建理由 |
|--------------------------------------|-------------------|
| `LeadCryptoService`（backend-java） | 复用 AES 加密逻辑，用于 source_ip 哈希脱敏 |
| `AntiSpamService`（backend-java） | 复用 IP 限流模式，用于 analytics 事件接收限流 |
| `PublicLeadController` / `PublicController`（backend-java） | 复用免鉴权 + IP 解析模式，用于 `/public/analytics/events`、`/public/ab/assign` |
| `TenantGuardService`（backend-java） | 复用 siteId 多租户隔离，用于 analytics/ab 查询 |
| `FeatureGateService` / `FeatureGateController`（backend-java） | 改造：从「按 site enabled」改为「按 plan.gates 判定」 |
| `schema.sql`（backend-java） | 追加 8 张新表（不改现有表结构，向后兼容） |
| `backendClient.ts` / `apiHandler.ts`（bff） | 复用 callBackend + 错误体封装 |
| `composables/useLeadSubmit.ts`（website） | 改造：补 UTM/visitorId/channelId 透传（3.3 硬前置） |
| `composables/useFeatureGate.ts`（website） | 复用访客侧公开接口调用模式，写 useAnalytics/useAbAssign |
| `views/DynamicPage.vue`（website） | 改造：表单提交补归因字段；ab 分流渲染变体（不动 LubanPage 内部） |
| `composables/useCollab.ts`（engine） | 复用异步加载 + 错误处理风格 |
| `api/lead.ts` / `api/featureGate.ts`（engine） | 复用 api 封装风格，写 billing/analytics/ab api |
| `router/index.ts` + layout 菜单（engine） | 加 Analytics + ab 一级菜单 |
| `cypress/e2e/leads.cy.ts`（engine） | 复用 E2E 风格，写 analytics.cy.ts/ab.cy.ts |

---

## §6 架构与边界

### 6.1 分层与边界

```
访客（website）
  ├─ server/middleware/visitorId.ts    ← SSR 首屏 set cookie
  ├─ server/middleware/abAssign.ts     ← SSR 调 ab/assign 注入变体
  ├─ plugins/analytics.client.ts       ← 客户端 SDK 初始化
  ├─ composables/useAnalytics.ts       ← track() 接口
  └─ views/DynamicPage.vue            ← 渲染变体（不动 LubanPage 内部）
        ↓
BFF（聚合/限流/429）
  ├─ api/public/analytics/events       ← 限流 + 透传
  ├─ api/public/ab/assign              ← 透传
  ├─ api/analytics/* + api/ab/*        ← 管理端透传
  ├─ api/billing/*                     ← 管理端透传
  └─ 用量拦截中间件                    ← 读 plan quota → 429
        ↓
backend-java（主）
  ├─ billing 域   ← Plan/Subscription/Trial/Quota/Usage
  ├─ analytics 域 ← Event 接收 + Daily 预聚合 + 查询
  ├─ ab 域        ← Experiment/Variant/Assignment + χ²
  ├─ FeatureGate 改造（plan 放行）
  └─ schema.sql（8 表）
        ✗
backend-go（本期豁免，开 issue 追赶）
```

### 6.2 关键边界约束

- **引擎可用性优先**：埋点/分流仅放 website 顶层 plugin/server middleware，**禁止侵入 engine/LubanPage/LubanForm 内部**。DynamicPage 改造仅在外层透传参数。
- **多租户隔离**：所有 analytics/ab 查询强制 `site_id` 过滤，复用 TenantGuardService。
- **source_ip 处理**：采集后 AES 哈希（复用 LeadCryptoService），只存哈希；前端不展示 IP。
- **用量计数原子性**：`INSERT ... ON DUPLICATE KEY UPDATE count = count + 1`（MySQL 原子），避免并发竞争。
- **ab 分流稳定性**：visitor_id + experiment_id → 一致性哈希 → 持久化 ab_assignments，同一 visitor 多次访问命中同一变体。

### 6.3 架构与 E2E 门禁自检（对照 architecture-review-e2e-tdd）

- ✅ 关键行为可由 E2E 触发：埋点落库（website→bff→backend 断言 analytics_events 行）、ab 分流（断言变体渲染）、用量超限（断言 429）、试用降级（断言 Subscription 状态）
- ✅ 用户旅程 → E2E 映射：见 §7
- ✅ 脱敏红线：source_ip 仅哈希存储，E2E 断言「原 IP 不出现在响应/日志」
- ✅ 避免 fragile selector：E2E 用 `data-testid`（engine 现有规范）+ 文案断言（中文，非英文枚举）

---

## §7 E2E 测试计划

### 7.0 E2E 量化表（对照 luban-testing-coverage）

| 功能类型 | 最少用例数 | 本期覆盖 | task |
|---|---|---|---|
| 转化分析（报表/归因） | 3+ | E2E-1（概览+漏斗+归因） | T-e2e |
| A/B 实验（创建/分流/显著性） | 4+ | E2E-2（创建+分流+显著性+结束） | T-e2e |
| 套餐用量 + 超限拦截 | 2+ | E2E-3,E2E-4 | T-e2e |
| 试用降级 | 1+ | E2E-5 | T-e2e |
| 埋点采集 + 归因 | 2+ | E2E-6 | T-e2e |
| 多租户隔离 | 1+ | E2E-7 | T-e2e |

### 7.1 跨端 E2E 主路径

| 路径名 | 入口端 | 依赖服务 | 自动化命令 | P0 |
|---|---|---|---|---|
| 埋点采集闭环 | website `4173` `/site-slug/*` | backend-java `8080`、bff `3000`、MySQL、Redis | `cd packages/engine/luban && pnpm test:e2e -- --spec analytics.cy.ts`；website 侧 `cd packages/web/luban-website && pnpm test:e2e`（**尚无脚本，合入前须补** website e2e 配置） | ✅ P0 |
| A/B 分流 + 显著性 | website + engine | 同上 + ab 数据 | engine `pnpm test:e2e -- --spec ab.cy.ts`；website 断言变体渲染 | ✅ P0 |
| 套餐用量 + 超限 | engine + bff | backend `8080`、bff `3000` | engine `pnpm test:e2e -- --spec billing.cy.ts` | ✅ P0 |
| 试用降级 | engine + backend | backend `8080` + 定时任务 mock | engine `pnpm test:e2e -- --spec trial.cy.ts` 或后端 IT | ✅ P0 |
| 多租户隔离 | engine | backend `8080` | engine `pnpm test:e2e -- --spec analytics-isolation.cy.ts` | ✅ P0 |

> **website E2E 补齐**：website 当前 0 e2e 配置（T-005），本期 T-web-4 补 vitest 单测；website E2E（playwright）若合入前补不齐，则在 engine 端用 cy.request 直接打 backend 验证 analytics_events 落库（不阻断 P0，但 website e2e 配置须 v03 补齐并列入「明确不做」补丁）。

### 7.2 交互链路保障脚本逻辑

| 路径 | 覆盖交互链 | 前置数据/fixture | 关键断言（失败即停） | 合并门禁 |
|---|---|---|---|---|
| E2E-1 Analytics 报表 | §4.2.1 全链 | seed: site A + 2 published pages + analytics_daily 样本 + leads 样本 | 概览卡片数字非零；漏斗三段渲染；归因表格有 UTM 行；中文文案不出现裸英文 status | P0 必绿，禁 skip |
| E2E-2 ab 实验 | §4.2.2 全链 | seed: site A + page + 2 page_versions | 创建成功；分流后 ab_assignments 有行；显著性返回 p-value；结束后 status=ended（中文 dict-tag） | P0 必绿 |
| E2E-3 套餐用量 | §4.2.3 | seed: user 绑 Free + usage 接近上限 | 进度条渲染；超限时 ElProgress 警示色 | P0 必绿 |
| E2E-4 超限拦截 | §4.2.3 + 用量中间件 | seed: usage 已达上限 | 新建 Lead 触发 429 + 友好错误体（不裸露英文） | P0 必绿 |
| E2E-5 试用降级 | Subscription 状态机 | seed: user trialing + trial_ends_at 过期 | 定时任务后 Subscription.plan=Free；数据保留（Lead 仍在） | P0 必绿 |
| E2E-6 埋点采集 | §2.2 链路 A | seed: published page + form | 访问页面 → analytics_events 有 page_view 行；表单曝光有 form_expose；提交后 form_submit + Lead 带正确 utm_json/visitor_id；**source_ip 原值不出现在 DB/日志** | P0 必绿 |
| E2E-7 多租户隔离 | §6.2 | seed: site A + site B 各有 analytics/ab | site A 用户查询只返回 site A 数据；site B 同理；**断言不出现跨站数据** | P0 必绿 |

---

## §8 TDD 与执行约定

### 8.1 TDD 路径

- **backend-java**：先测后码。billing/analytics/ab 域每个 service 配 `*Test`（单测）+ `*IT`（集成测，MyBatis + H2/MySQL）。状态机（Subscription/AbExperiment）用单测穷举转换。χ² 检验用单测断言已知输入的 p-value。
- **bff**：route handler 配单测（mock callBackend），断言透传字段 + 限流 + 429 错误体。
- **website**：composables 配 vitest 单测（T-web-4，T-005 止血）。useUtm 各 URL 解析 case；useAnalytics 事件触发；useAbAssign 分桶稳定。
- **engine**：api/view 配单测；E2E 覆盖主链路（cy）。
- **P0 门禁**：所有 §7.1 P0 路径合并前必绿。

### 8.2 分支确认

- 进入实现前，主会话**询问用户**是否切 `feature/v02-analytics-billing`（不自动切，对齐 GIT_WORKFLOW §〇.4）
- 各子模块（backend-java/bff/website/engine）在各自仓内切同名分支（§〇.5 多仓同名）
- backend-go 不动分支

### 8.3 并行 subagent 与 task id 对应

执行阶段按 wave 派发并行 subagent（对齐 subagent-driven-development）：

| wave | 并行组 | task id |
|---|---|---|
| W1 | backend-java 基础 + website 归因 | T-be-1~5（内部串行，依赖链）+ T-web-1（与 backend 并行） |
| W2 | backend-java analytics + bff billing + website SDK + engine api | T-be-6~8 + T-bff-1,2,5 + T-web-2,4 + T-eng-1,4 |
| W3 | backend-java ab + bff ab + website 分流 + engine 报表 | T-be-9~11 + T-bff-3,4 + T-web-3 + T-eng-2,3 + T-ui-1(无 luban-ui 改动，engine 引 ECharts) |
| W4 | 全栈 E2E | T-e2e（依赖前面全绿） |

**并行前提**：契约冻结（API 路径/字段在 W1 末锁定）。同仓内文件串行（避免冲突）；跨仓并行。

---

## §9 实现任务派发（文件映射 / API 契约 / DDL / 组件接口）

> §9 由主会话基于路径实测生成（4/6 subagent 超时，转主会话直写；所有路径已 grep/ls 验证）。

### 9.1 文件变更总览

#### backend-java（`packages/backend/luban-backend/src/main/java/com/luban/backend/`）

| task | 文件路径 | 新建/修改 | 摘要 |
|---|---|---|---|
| T-be-1 | `src/main/resources/schema.sql` | 修改 | 追加 8 张表（plans/subscriptions/trial_records/usage_counters/analytics_events/analytics_daily/ab_experiments/ab_variants/ab_assignments） |
| T-be-2 | `entity/{Plan,Subscription,TrialRecord,UsageCounter}.java` | 新建 | billing 域 4 实体（Lombok，对齐 Lead.java 风格） |
| T-be-2 | `mapper/{PlanMapper,SubscriptionMapper,TrialRecordMapper,UsageCounterMapper}.java` | 新建 | MyBatis mapper（对齐现有注解风格） |
| T-be-2 | `service/{PlanService,SubscriptionService,TrialService,UsageService}.java` | 新建 | billing 服务（事务，对齐 LeadService 风格） |
| T-be-2 | `controller/BillingController.java` | 新建 | billing 路由（对齐 FeatureGateController 风格） |
| T-be-2 | `dto/{PlanResponse,SubscriptionResponse,UsageResponse,SubscribeRequest}.java` | 新建 | DTO（对齐现有 dto 风格，Validation 注解） |
| T-be-3 | `service/FeatureGateService.java` | 修改 | 改造为按 plan.gates 判定 + 向后兼容 |
| T-be-3 | `service/FeatureGateController.java` | 修改 | 显示「受 plan 限制」标记 |
| T-be-4 | `service/QuotaInterceptor.java`（或 `web/` 包下） | 新建 | 用量拦截中间件 |
| T-be-5 | `service/TrialScheduler.java` | 新建 | `@Scheduled` 定时任务，扫描到期试用降级 |
| T-be-6 | `entity/AnalyticsEvent.java` + `mapper/AnalyticsEventMapper.java` + `service/AnalyticsEventService.java` + `controller/PublicAnalyticsController.java` | 新建 | 事件接收（免鉴权+限流+AES 脱敏） |
| T-be-7 | `entity/AnalyticsDaily.java` + `mapper/AnalyticsDailyMapper.java` + `service/AnalyticsAggregationService.java` | 新建 | Daily 预聚合（`@Scheduled`） |
| T-be-8 | `service/AnalyticsQueryService.java` + `controller/AnalyticsController.java` | 新建 | 漏斗/归因/趋势查询 |
| T-be-9 | `entity/{AbExperiment,AbVariant,AbAssignment}.java` + `mapper/*` + `service/AbService.java`（含一致性哈希） | 新建 | ab 域 + 单页单 running 约束校验 |
| T-be-10 | `controller/{AbController,PublicAbController}.java` | 新建 | 管理端 CRUD + 访客分流 |
| T-be-11 | `service/SignificanceService.java`（Apache Commons Math χ²） | 新建 | 显著性检验 |
| — | `pom.xml` | 修改 | 加 `org.apache.commons:commons-math3:3.6.1` |
| — | `src/test/java/com/luban/backend/`（多个） | 新建 | 每域 *Test + *IT（对齐 v01 的 9 个测试风格） |

#### bff（`packages/bff/luban-bff/src/app/api/`）

| task | 文件路径 | 新建/修改 | 摘要 |
|---|---|---|---|
| T-bff-1 | `billing/route.ts` + `billing/me/route.ts` + `billing/subscribe/route.ts` + `billing/usage/route.ts` | 新建 | billing 路由（对齐 leads/route.ts 风格） |
| T-bff-2 | `public/analytics/events/route.ts` | 新建 | 事件接收（限流，对齐 public/sites 风格） |
| T-bff-3 | `analytics/overview/route.ts` + `analytics/funnel/route.ts` + `analytics/attribution/route.ts` + `analytics/trend/route.ts` + `ab/experiments/[id]/significance/route.ts` | 新建 | 查询路由 |
| T-bff-4 | `public/ab/assign/route.ts` + `ab/experiments/route.ts` + `ab/experiments/[id]/route.ts` + `ab/experiments/[id]/end/route.ts` | 新建 | ab 路由 |
| T-bff-5 | `src/middleware.ts`（根级 Next middleware）或各管理路由内联检查 | 新建 | 用量拦截 → 429 |

#### website（`packages/web/luban-website/`）

| task | 文件路径 | 新建/修改 | 摘要 |
|---|---|---|---|
| T-web-1 | `composables/useUtm.ts` + `server/middleware/visitorId.ts` | 新建 | UTM 解析 + visitorId cookie set |
| T-web-1 | `composables/useLeadSubmit.ts` + `views/DynamicPage.vue` | 修改 | 透传 utm/visitorId/channelId（**不动 LubanPage 内部**） |
| T-web-2 | `plugins/analytics.client.ts` + `composables/useAnalytics.ts` | 新建 | 埋点 SDK + track 接口 |
| T-web-3 | `server/middleware/abAssign.ts` + `views/DynamicPage.vue`（外层） | 新建/修改 | SSR 调 ab/assign + 注入变体 |
| T-web-4 | `vitest.config.ts` + `composables/__tests__/{useUtm,useAnalytics,useAbAssign}.spec.ts` | 新建 | T-005 止血 |

#### engine（`packages/engine/luban/src/`）

| task | 文件路径 | 新建/修改 | 摘要 |
|---|---|---|---|
| T-eng-1 | `api/billing.ts` + `api/analytics.ts` + `api/ab.ts` | 新建 | api 封装（对齐 api/lead.ts 风格） |
| T-eng-2 | `views/analytics/{AnalyticsOverview,FunnelChart,AttributionTable}.vue` + 路由 + 菜单 | 新建 | Analytics 报表页 |
| T-eng-3 | `views/ab/{ExperimentList,ExperimentCreate,ExperimentDetail}.vue` + 路由 + 菜单 | 新建 | ab 实验管理页 |
| T-eng-4 | `components/UserUsagePanel.vue`（用户菜单弹出） | 新建 | 套餐用量展示 |
| — | `package.json` | 修改 | 加 `echarts` + `vue-echarts` |
| — | `cypress/e2e/{analytics,ab,billing,trial,analytics-isolation}.cy.ts` | 新建 | E2E |

#### luban-ui
**本特性不涉及。** 图表在 engine 内用 ECharts。T-ui-1 重新定义为「engine 内引入 ECharts」（见上 engine package.json）。

#### backend-go
**本特性不涉及（parity 豁免）。** 开 GitHub issue：`luban-backend-go: parity 追赶 v01+v02`，待补接口：Lead/Form/FeatureGate/协作 WS（v01）+ billing/analytics/ab（v02）。

### 9.2 API 契约

#### billing
| 方法 | 路径 | 鉴权 | 请求字段 | 响应字段 | 错误码 | task |
|---|---|---|---|---|---|---|
| GET | `/billing/plans` | 用户 | - | `[{planCode,name,priceMonthly,quotaLeads,quotaPages,quotaVisits,gates[],trialDays}]` | - | T-be-2 |
| GET | `/billing/me` | 用户 | - | `{planCode,planName,status,usage:{leads,pages,visits},quota:{leads,pages,visits},trialEndsAt?}` | - | T-be-2 |
| POST | `/billing/subscribe` | 用户 | `{planCode}` | `{subscription:SubscriptionResponse}` | 400(无效 plan) | T-be-2 |
| GET | `/billing/usage` | 用户 | `?period=YYYY-MM` | `{leads,pages,visits,period}` | - | T-be-2 |

#### analytics
| 方法 | 路径 | 鉴权 | 请求字段 | 响应字段 | 错误码 | task |
|---|---|---|---|---|---|---|
| POST | `/public/analytics/events` | 无（限流） | `{events:[{eventType,pageId?,variantId?,payload?,clientTs}]}` | `{accepted:n}` | 429(限流) | T-be-6 |
| GET | `/analytics/overview` | 用户+site | `?siteId&from&to` | `{views,conversions,leads,experiments}` | - | T-be-8 |
| GET | `/analytics/funnel` | 用户+site | `?siteId&from&to&pageId?` | `{stages:[{name,count}]}（page_view→form_expose→form_submit）` | - | T-be-8 |
| GET | `/analytics/attribution` | 用户+site | `?siteId&from&to` | `{rows:[{source,medium,campaign,views,conversions,rate}]}` | - | T-be-8 |
| GET | `/analytics/trend` | 用户+site | `?siteId&from&to&metric` | `{points:[{date,value}]}` | - | T-be-8 |

#### ab
| 方法 | 路径 | 鉴权 | 请求字段 | 响应字段 | 错误码 | task |
|---|---|---|---|---|---|---|
| POST | `/ab/experiments` | 用户+site | `{siteId,pageId,name,variants:[{label,pageVersionId,weight,isControl}],trafficPct}` | `{experiment}` | 409(单页单 running) | T-be-10 |
| GET | `/ab/experiments` | 用户+site | `?siteId&status?` | `{items:[experiment]}` | - | T-be-10 |
| GET | `/ab/experiments/:id` | 用户+site | - | `{experiment,variants[],significance?}` | 404 | T-be-10 |
| POST | `/ab/experiments/:id/end` | 用户+site | - | `{experiment}` | 409(非 running) | T-be-10 |
| GET | `/public/ab/assign` | 无 | `?siteId&pageId&visitorId` | `{variantId,variantLabel,pageVersionId}` | - | T-be-10 |
| GET | `/ab/experiments/:id/significance` | 用户+site | - | `{pValue,confidenceInterval,controlRate,variantRate,winner?}` | - | T-be-11 |

**错误体规范**：对齐 `.agents/rules/luban-cross-cutting-standards.md`，`{code,message,details?}`，中文 message，不裸露英文枚举。

### 9.3 数据库变更（schema.sql 追加，幂等）

```sql
-- ===== v02: billing 域 =====
CREATE TABLE IF NOT EXISTS plans (
  plan_code VARCHAR(32) PRIMARY KEY,
  name VARCHAR(64) NOT NULL,
  price_monthly BIGINT NOT NULL DEFAULT 0,
  quota_leads INT NOT NULL DEFAULT 0,
  quota_pages INT NOT NULL DEFAULT 0,
  quota_visits INT NOT NULL DEFAULT 0,
  gates JSON,
  trial_days INT NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscriptions (
  user_id VARCHAR(64) PRIMARY KEY,
  plan_code VARCHAR(32) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'active',
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  trial_started_at TIMESTAMP NULL,
  trial_ends_at TIMESTAMP NULL,
  CONSTRAINT fk_sub_plan FOREIGN KEY (plan_code) REFERENCES plans(plan_code),
  KEY idx_sub_status (status)
);

CREATE TABLE IF NOT EXISTS trial_records (
  user_id VARCHAR(64) PRIMARY KEY,
  trial_plan_code VARCHAR(32) NOT NULL,
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ends_at TIMESTAMP NOT NULL,
  converted_to VARCHAR(32) NULL,
  CONSTRAINT fk_trial_plan FOREIGN KEY (trial_plan_code) REFERENCES plans(plan_code),
  KEY idx_trial_ends (ends_at)
);

CREATE TABLE IF NOT EXISTS usage_counters (
  id VARCHAR(64) PRIMARY KEY,
  user_id VARCHAR(64) NOT NULL,
  period_month CHAR(7) NOT NULL,
  metric VARCHAR(32) NOT NULL,
  count BIGINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_usage (user_id, period_month, metric),
  KEY idx_usage_user (user_id, period_month)
);

-- ===== v02: analytics 域 =====
CREATE TABLE IF NOT EXISTS analytics_events (
  id VARCHAR(64) PRIMARY KEY,
  site_id VARCHAR(64) NOT NULL,
  visitor_id VARCHAR(64) NOT NULL,
  session_id VARCHAR(64),
  event_type VARCHAR(32) NOT NULL,
  event_payload JSON,
  page_id VARCHAR(64),
  variant_id VARCHAR(64),
  utm_json JSON,
  client_ts TIMESTAMP NULL,
  server_ts TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  source_ip_hashed VARCHAR(128),
  CONSTRAINT fk_ae_site FOREIGN KEY (site_id) REFERENCES sites(id),
  KEY idx_ae_site_ts (site_id, server_ts),
  KEY idx_ae_event (site_id, event_type, server_ts)
);

CREATE TABLE IF NOT EXISTS analytics_daily (
  id VARCHAR(64) PRIMARY KEY,
  site_id VARCHAR(64) NOT NULL,
  date DATE NOT NULL,
  page_id VARCHAR(64),
  variant_id VARCHAR(64),
  views BIGINT NOT NULL DEFAULT 0,
  submissions BIGINT NOT NULL DEFAULT 0,
  conversions BIGINT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_ad (site_id, date, page_id, variant_id),
  KEY idx_ad_site_date (site_id, date)
);

-- ===== v02: ab 域 =====
CREATE TABLE IF NOT EXISTS ab_experiments (
  id VARCHAR(64) PRIMARY KEY,
  site_id VARCHAR(64) NOT NULL,
  page_id VARCHAR(64) NOT NULL,
  name VARCHAR(128) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'draft',
  traffic_pct INT NOT NULL DEFAULT 100,
  start_at TIMESTAMP NULL,
  end_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ab_site FOREIGN KEY (site_id) REFERENCES sites(id),
  KEY idx_ab_site (site_id, status),
  KEY idx_ab_page (page_id, status)
);

CREATE TABLE IF NOT EXISTS ab_variants (
  id VARCHAR(64) PRIMARY KEY,
  experiment_id VARCHAR(64) NOT NULL,
  label VARCHAR(8) NOT NULL,
  page_version_id VARCHAR(64) NOT NULL,
  weight INT NOT NULL DEFAULT 50,
  is_control TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_abv_exp FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id) ON DELETE CASCADE,
  UNIQUE KEY uk_abv (experiment_id, label)
);

CREATE TABLE IF NOT EXISTS ab_assignments (
  id VARCHAR(64) PRIMARY KEY,
  visitor_id VARCHAR(64) NOT NULL,
  experiment_id VARCHAR(64) NOT NULL,
  variant_id VARCHAR(64) NOT NULL,
  assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_aba (visitor_id, experiment_id),
  KEY idx_aba_exp (experiment_id, variant_id),
  CONSTRAINT fk_aba_exp FOREIGN KEY (experiment_id) REFERENCES ab_experiments(id) ON DELETE CASCADE
);
```

### 9.4 物料 schema
**不适用。** luban-ui 本期不新增物料（图表归 engine 内部报表组件，非终端落地页物料）。

### 9.5 组件接口

#### website composables
```ts
// composables/useUtm.ts
export function useUtm(): {
  utm: ComputedRef<{ source?: string; medium?: string; campaign?: string; term?: string; content?: string }>
}
// 解析 window.location.search 的 ?utm_*，SSR 用 useRequestURL

// composables/useAnalytics.ts
export function useAnalytics(): {
  track(eventType: 'page_view' | 'form_expose' | 'form_submit', payload?: Record<string, unknown>): Promise<void>
}
// 内部：批量化、beacon 上报 POST /api/public/analytics/events

// composables/useAbAssign.ts
export function useAbAssign(): {
  getVariant(pageId: string): Promise<{ variantId?: string; pageVersionId?: string }>
}
// 内部：读 visitor_id cookie → GET /api/public/ab/assign
```

#### DynamicPage.vue 改造点（仅外层，不动 LubanPage 内部）
- `useUtm()` 注入 → `useLeadSubmit` payload 带 utm
- `useAnalytics().track('page_view')`（ClientOnly 外，app.vue 层更佳）
- `useAbAssign().getVariant(pageId)` → schema fetch 时注入 `?variantId=` → backend 返回变体 schema

#### engine api
```ts
// api/billing.ts
getPlans(): Promise<Plan[]>
getMyPlan(): Promise<MyPlanInfo>
subscribe(planCode: string): Promise<Subscription>
getUsage(period?: string): Promise<Usage>

// api/analytics.ts
getOverview(siteId, range): Promise<Overview>
getFunnel(siteId, range, pageId?): Promise<{stages: Stage[]}>
getAttribution(siteId, range): Promise<{rows: AttrRow[]}>
getTrend(siteId, range, metric): Promise<{points: Point[]}>

// api/ab.ts
listExperiments(siteId, status?): Promise<Experiment[]>
createExperiment(payload): Promise<Experiment>
getExperiment(id): Promise<ExperimentDetail>
endExperiment(id): Promise<Experiment>
getSignificance(id): Promise<SignificanceResult>
```

### 9.6 并行派发计划（与 taskGraph dependsOn + group 一致）

| wave | 并行组 | task id | 前置 |
|---|---|---|---|
| W1 | backend-java（schema+billing+gate 改造+quota+trial）串行 + website（归因）并行 | T-be-1→2→3→4→5；T-web-1 并行 | T-be-1 无依赖 |
| W2 | 4 路并行：backend analytics（T-be-6→7→8）+ bff billing/quota（T-bff-1,5）+ website SDK（T-web-2→4）+ engine api（T-eng-1,4） | T-be-6 依赖 T-be-1；T-bff-1 依赖 T-be-2；T-web-2 依赖 T-web-1；T-eng-1 依赖 T-bff-1 | 契约在 W1 末冻结 |
| W3 | 4 路并行：backend ab（T-be-9→10→11）+ bff ab/analytics 查询（T-bff-3,4）+ website 分流（T-web-3）+ engine 报表/ab 页（T-eng-2,3）+ engine 引 ECharts | T-be-9 依赖 T-be-1；T-bff-3 依赖 T-be-8；T-web-3 依赖 T-bff-4 | — |
| W4 | 全栈 E2E（T-e2e） | T-e2e 依赖 T-eng-2,3 + T-web-3 全绿 | — |

---

## §10 风险、里程碑与开放问题

### 10.1 风险与缓解

| 风险 | 级别 | 缓解 |
|---|---|---|
| website SSR 埋点侵入 engine | 🔴 | SDK 仅放 website plugin/server middleware；DynamicPage 改造仅外层透传，E2E 断言 LubanPage 内部无埋点代码 |
| Lead 链路归因字段补全是硬前置（3.3） | 🔴 | 列为 W1 第一任务（T-web-1），阻塞 W2 埋点 |
| FeatureGate 改造影响 v01 兼容 | 🟡 | 新模型保留 gate_key 语义；v01 的 4 个 gate_key 按 plan.gates 判定 + 加迁移测试；Free 档全放行（不收费） |
| ab 分流与 SSR 缓存冲突 | 🟡 | 分流决策在 server middleware 完成（SSR 时），不依赖客户端 JS |
| 用量计数并发竞争 | 🟡 | `INSERT ... ON DUPLICATE KEY UPDATE count=count+1` 原子 |
| visitor_id 隐私合规 | 🟡 | HttpOnly cookie，source_ip AES 哈希，不存原值 |
| website E2E 配置缺失（T-005 范围） | 🟡 | 本期补 vitest 单测；website playwright E2E 若补不齐，engine 端用 cy.request 验证落库，website e2e 列入 v03 |
| Go parity 豁免 | 🟡 | 本期显式豁免 + 开 issue 追赶，不阻塞 v02 |

### 10.2 里程碑

- **M1（W1 末）**：billing 域后端通 + website 归因字段通；契约冻结
- **M2（W2 末）**：埋点采集闭环通（website→bff→backend 落库）；报表 API 通
- **M3（W3 末）**：A/B 引擎通；报表页/管理页 UI 通
- **M4（W4）**：全栈 E2E 全绿 → 四级门禁

### 10.3 开放问题

- website E2E（playwright）配置是否本期补齐，还是 v03？倾向 v03（本期 vitest 单测够止血）
- 3.7（GA/Pixel/GTM 转发）时间够则做，否则 v03

---

## §11 验证命令引用

涉及子项目验证命令（来自 AGENTS.md）：

```bash
# backend-java（Java 17, Maven）
cd packages/backend/luban-backend && mvn -q verify

# bff (TS, pnpm)
cd packages/bff/luban-bff && pnpm install && pnpm test && pnpm run build

# website (TS, Nuxt)
cd packages/web/luban-website && pnpm install && pnpm test && pnpm run build

# engine (TS, Vue + Cypress)
cd packages/engine/luban && pnpm install && pnpm test && pnpm run build && pnpm run test:e2e

# ui (本期不涉及，但完整性)
# cd packages/ui/luban-ui && pnpm install && pnpm test

# 全栈覆盖率
make test-coverage
```

---

## §12 分级验收门禁表

| 级别 | 验证方式 | 通过条件 | 责任 |
|---|---|---|---|
| **G1 代码质量与审查** | `/luban-review` 全自动审查（~20 并行 subagent + streaming 修复收敛） | 🔴🟡🔵 全部清零（含建议级别） | 主会话 |
| **G2 安全审查** | OWASP Top 10 自查 + 敏感字段清单核对 | source_ip 仅哈希存储；访客公开路由限流；鉴权覆盖；XSS 自查 | 主会话 |
| **G3 单测+覆盖率门禁** | `mvn -q verify`（backend-java 行 80%）+ `pnpm test`（bff/website/engine 行 85%） | 各子项目达分栈门禁值 | 主会话 |
| **G4 E2E 验收** | engine `pnpm test:e2e`（analytics/ab/billing/trial/isolation）+ website 落库验证 | §7.1 所有 P0 路径必绿，禁 skip/假绿 | 主会话（询问用户后跑） |

### 敏感字段清单与分级约束

| 字段 | 位置 | 加密/脱敏策略 | 日志规则 | 前端展示 |
|---|---|---|---|---|
| source_ip（采集） | analytics_events.source_ip_hashed | AES 哈希后存储（复用 LeadCryptoService） | 禁止打印原 IP | 不展示 |
| visitor_id | analytics_events/ab_assignments visitor_id | 明文（first-party cookie，非个人信息主体） | 可打印 | 不展示 |
| utm_json | analytics_events.utm_json/leads.utm_json | 明文（归因数据） | 可打印 | Analytics 归因表展示 |
| 手机号/邮箱（Lead） | leads（v01 已加密） | v01 已 AES 加密（D-001） | v01 已脱敏 | v01 已脱敏展示 |

### 多端渲染一致性声明
本特性 analytics/ab 数据为后端报表，**不涉及引擎 schema/物料变更**，因此 website/electron/flutter 渲染一致性约束**不适用**（luban-ui 无物料改动）。website 端仅做埋点采集与 ab 分流注入，不改 schema 消费逻辑。

### FeatureGate 开关设计

| 开关 key | 作用域 | 关闭时行为 | task |
|---|---|---|---|
| `analytics` | plan 级（plan.gates） | 关闭则埋点 SDK 不采集（website 读 useFeatureGate 决定是否 init） | T-be-3,T-web-2 |
| `ab_testing` | plan 级 | 关闭则不分流（website 读 gate，关闭时走 control 变体） | T-be-3,T-web-3 |

**回滚方案**：FeatureGate 关闭列为首选回滚手段。若 v02 上线后异常，关闭 `analytics`/`ab_testing` gate 即可停止采集与分流，不影响 v01 留资闭环。

---

## §13 Post-Development Workflow（MUST）

实现阶段完成后，按顺序执行（**禁止跳步**）：

1. **代码提交**：各子模块在 `feature/v02-analytics-billing` 分支提交；主仓更新 submodule 指针
2. **`/luban-review` 全自动审查**：🔴🟡🔵 全部清零（含建议级别）——**所有后续验证步骤前必须先清零**
3. **编译**：各子项目 `pnpm run build` / `mvn -q compile`
4. **单测+覆盖率门禁**：G3
5. **询问用户后跑 E2E**：G4（用户确认后执行）
6. **全栈覆盖率汇总**：`make test-coverage`
7. **完成汇报**：一次汇总（本期范围内代码与配置已齐 + 各子项目验证命令已通过 + 关键输出证据）

### 实现会话约束（MUST）
- 进入实现会话后，在**已确认的本期范围**内**连续推进至全部就绪**
- **禁止**在仅完成部分子能力、或验证命令尚未全部跑通之前，以「先到这儿」「主体已完成」等**结束实现并等同交付收口**
- **禁止主路径收口即宣称完成**
- **禁止分期交付同一方案**：本期 P-003 + 商业化骨架须在**单次实现周期内全部完成**
- 例外：用户显式暂停/缩小范围、遇须用户决策的阻塞、环境硬限制 → 列出残余项与下一步

---

## §14 For agentic workers

> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（推荐）或 `executing-plans`；按本 plan checkbox 与 `docs/superpowers/tasks/v02-analytics-billing.json` 推进；执行纪律见 [docs/dev/agent-workflow-constraints.md](../../dev/agent-workflow-constraints.md)；每步须定义验证门（§11 命令）。

---

## §15 质量禁令自检表（逐条勾选）

| # | 禁令 | 自检 |
|---|---|---|
| 1 | 禁止跳过功能 | ✅ §1.2 R1–R14 全映射到 task + E2E |
| 2 | 禁止假绿 | ✅ §7.2 明确禁 skip，失败即停 |
| 3 | 禁止占位 | ✅ 无 TODO/假文案/mock 冒充 |
| 4 | 禁止骨架交付 | ✅ §4.2 列表级交互链分步到 API |
| 5 | 禁止 JSON 替代页面 | ✅ §4.3 报表/管理页有完整 UI 结构 |
| 6 | 页面交互完整 | ✅ §4.2 三页分步链路 |
| 7 | 验收口径以可交付为准 | ✅ §12 G4 用户可见链路 |
| 8 | 引擎渲染 E2E 绑正式路由 | ✅ 无新增 pages/e2e/*；报表在 /analytics 正式路由 |
| 9 | 门禁分级执行 | ✅ §12 G1-G4 四级 |
| 10 | /luban-review 清零门禁 | ✅ §13 步骤 2 |
| 11 | 安全审查门禁 | ✅ §12 G2 + 敏感字段清单 |
| 12 | 双后端契约一致性声明 | ✅ §3.4（Go 本期显式豁免 + 开 issue） |
| 13 | 多端渲染一致性声明 | ✅ §12（本特性不涉及物料/schema 变更） |
| 14 | FeatureGate 默认约束 | ✅ §12（analytics/ab_testing 两开关 + 回滚方案） |
