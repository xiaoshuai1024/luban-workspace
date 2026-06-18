---
featureId: luban-delivery-program
title: Luban 可交付治理项目集（Program Plan）
createdAt: 2026-06-14
status: draft
program: true
taskGraph: docs/superpowers/tasks/luban-delivery-program.json
contractSource: plan-template 命令体 + .agents/skills/writing-plans/SKILL.md（PLAN_WRITING_CONTRACT.md 当前缺失，由 T3 补建）
scope: 完整治理全量达标（用户 2026-06-14 确认）
split: 按 plan-template 硬要求§5 拆 6 child plan / 4 wave
branches: 各子仓 feature/luban-delivery-<wave> 同名分支
---

# Luban 可交付治理项目集（Program Plan）

> **验收口径（MUST）**：真实用户能跑完 `登录 → 建站 → 建页面 → 拖组件 → 改属性 → 预览 → 发布 → 访客在 website 看到 published 页面 → 多端渲染一致`；且五端覆盖率达标、Java/Go 双后端全量一致、无骨架/占位/假绿。**禁止以"仅后端可用"/"按钮可见"作为完成结论。**

---

## §0 程序概览

### §0.1 目标
把 luban 从"半成品"（渲染器/物料/后端 CRUD 真实存在，但编辑器空壳、无发布闭环、engine 全 mock、五端零测试、双后端不一致、文档子仓空、客户端未建）优化到"**完整治理、全量达标、可交付最终用户**"。

### §0.2 拆分依据（§5 强制）
单 plan 体量评估 ≈ 9–12 sprint。plan-template 硬要求 §5 明令"同一 plan 须单期收口，否则拆多份独立 plan"。故本项目集拆 **6 child plan / 4 wave**（DAG 见 §9）。**每个 child plan 单期收口、自带门禁，禁止分期交付同一 child。**

### §0.3 已确认范围（用户 2026-06-14，含 pua:pro 拉通后定稿）
| 决策项 | 定稿 |
|--------|------|
| 范围深度 | 完整治理全量达标 |
| 双后端 | **全量一致**（Java/Go 所有接口对齐 + Contract Test） |
| 测试门禁 | 五端覆盖率全量达标 + 主链路 E2E |
| 物料 schema | 重构到 `defineMaterial` + JSON Schema + version |
| 客户端/多端 | 初始化骨架 + 完成技术验证 |
| engine 去 mock | **做**（交付前提） |
| E2E 工具栈 | 统一 Playwright（绑正式路由，废 Cypress） |
| SSR ClientOnly | 延后到 T5 评估（不阻塞用户能用） |

---

## §1 需求溯源（gap → child plan 矩阵）

证据来源：2026-06-14 五路并行探针报告（engine / ui / bff+backend / website+client / docs）。

| Gap（证据文件） | 层级 | → Child Plan |
|----------------|------|--------------|
| PageEditor 未传 designMode，画布不可拖拽（`engine/src/views/page/PageEditor.vue:118-125`） | L0 | **T4** |
| 无属性面板/组件树（grep 全空，componentMeta 325 行已存在可驱动） | L0 | T4（依赖 T1 的 schema） |
| 发布闭环断：engine 无发布按钮，website 只渲染 published（`api/page.ts` / `views/DynamicPage.vue`） | L0 | T4（发布按钮调 PUT status）+ T2（Go status 白名单 + 修 base64/密码 bug） |
| engine 默认走 mock（`engine/src/api/request.ts:25` + `src/mocks/index.ts`） | L0 | T4 |
| 物料 componentMeta 与 Vue props 漂移（Banner/Input/Text） | L1 | **T1** |
| 物料未用 defineMaterial + JSON Schema（偏离 LOWCODE_ENGINE_SPEC） | L1 | T1 |
| 物料缺 data-display/navigation/feedback 类别 | L2 | T1（标注后续迭代子项） |
| Go 缺 `/public/sites/:slug/pages` | L1 | **T2** |
| `/auth/me` Java 完整 vs Go 仅 `{id,role}` | L1 | T2 |
| slug 冲突错误码 Go 漏映射 | L1 | T2 |
| Go `/users/:id` PUT 不处理 password | L1 | T2 |
| Java 无 Flyway（用 spring.sql.init，pom 无 flyway-core） | L2 | T2 |
| 五端零测试（Java/Go/BFF/website 0；engine cypress 仅按钮可见；low-code e2e 是 vitest 冒充） | L1 | **T5** |
| E2E 工具栈 Cypress vs 文档 Playwright | L1 | T5 |
| SSR ClientOnly 首屏空 | L1 | T5 评估 |
| PLAN_WRITING_CONTRACT.md / FEATURES.md / INIT-PLAN.md 缺失（README 死链） | L2 | **T3** |
| 架构文档子仓仅 70B README（拼写错误 architec） | L2 | T3 |
| 设计 token 全占位 | L2 | T3 |
| 4 个 client/ai 子项目未建 submodule（.gitmodules 7 vs CLAUDE.md 称 11） | L2 | **T6** |

**无遗漏覆盖**：所有探针发现的 gap 均映射到 T1–T6，无静默跳过。

---

## §2 程序级系统与链路（端到端可交付主链路）

```
用户登录(engine app /api/auth/*)
   ↓
建站(/api/sites POST) → 建页面(/api/sites/:id/pages POST, status=draft)
   ↓
进入 PageEditor【T4 重做三栏：物料区｜画布(designMode=true)｜属性面板】
   ↓ 拖入物料(luban-ui registry【T1 defineMaterial】) → 画布 DesignRenderer 渲染选中态
   ↓ 选中节点 → 属性面板读 componentMeta.propsSchema【T1】 → 改 props → v-model 回写 schema
   ↓ 预览(designMode=false 切 RuntimeRenderer 只读)
   ↓ 保存草稿(PUT /api/sites/:id/pages/:pageId, schema_json 持久化【T2 MySQL】)
   ↓ 发布(POST publish → status: draft→published【T2 状态机 + Contract Test 双端一致】)
   ↓
访客访问 website /:site/:path  → useFetch BFF /api/public/sites/:slug/pages/by-path
   → BFF 透传后端(JAVA + GO【T2 /public 双端】) → 取 status=published schema
   → <LubanPage :schema> RuntimeRenderer 渲染【四态:loading/empty/error/success】
   ↓
多端一致【T6】: 同一 schema 在 website / electron / flutter 渲染冒烟一致
```

**子系统新增/改动一览**：engine app(PageEditor重做+属性面板+组件树+预览+发布) · luban-low-code(designMode接通点暴露+PropertyPanel+ComponentTree) · luban-ui(defineMaterial重构) · BFF(补 sites/:id、users/:id 主路由 + publish 透传) · Java(PageController发布状态机+Flyway+测试) · Go(/public+auth/me+slug+password+测试) · website(主链路E2E) · client(三端骨架)。

---

## §3 业务逻辑与领域

### §3.1 publish 状态机（§9.7-#1 修正：无独立端点，走 PUT status）
```
[draft] --PUT status=published--> [published] --PUT status=draft--> [draft]
[draft/published] --DELETE--> (deleted, 访客侧立即 404)
```
- **实现**：T4 发布按钮调 `PUT /sites/:id/pages/:pageId` body `{status:'published', name, path, schema}`（现有接口，**后端无需新端点**）
- 访客侧：website/BFF 按 `status='published'` 过滤（`PublicPageService` 已实现）
- 双端一致：Java/Go 的 PUT 均接受 status；**Go 须补 `draft|published` 白名单校验**（§9.7-#1）
- 错误码：`PAGE_NOT_FOUND` / `PERMISSION_DENIED`（沿用现有）

### §3.2 领域实体
| 实体 | 表 | 状态字段 | 负责端 |
|------|----|---------|--------|
| Site | sites | — | Java/Go |
| Page | pages | status(draft/published) | Java/Go |
| User | users | status(enabled/disabled) | Java/Go |
| Material | （前端 registry，无后端表本期） | — | T1 前端 |

---

## §4 页面结构（§4.3 逐页）

> 本项目集 UI 增量集中在 **T4 编辑器闭环**与 **T6 客户端渲染页**。website DynamicPage 已存在四态，本期仅验证不重做。

### §4.0 入口表
| 路由 | 视图 | 来源端 | 状态 |
|------|------|--------|------|
| `/sites/:siteId/pages/:pageId/edit` | PageEditor（三栏） | engine app | **T4 重做** |
| `/:site/:path*` | DynamicPage | website | 已有，T5 验证 |
| electron/flutter 入口页 | 渲染 published schema | client | **T6 新增骨架** |

### §4.2 主界面交互链（编辑器核心闭环）
1. 进入 PageEditor → 拉取 page(schema+status) → 画布按 designMode=true 渲染 DesignRenderer（选中/拖拽/重排可用）
2. 从左侧物料区拖物料到画布 → schema.children 追加节点 → 画布即时渲染
3. 点画布节点 → 触发 select 事件 → 右侧属性面板读该节点 componentMeta.propsSchema → 渲染表单
4. 改属性面板字段 → v-model 回写 schema.props → 画布重渲
5. 点"预览" → designMode=false → RuntimeRenderer 只读渲染（所见即访客）
6. 点"保存草稿" → PUT schema（status 不变）→ toast 成功/失败
7. 点"发布" → POST publish（draft→published）→ 二次确认 → toast → 状态徽标变 published
8. 新开隐身窗访客 website `/:site/:path` → 看到 published 渲染（验证闭环）

### §4.3 逐页页面结构展示

**页面 A — PageEditor 三栏设计器（T4，核心）**
```
┌──────────────────────────────────────────────────────────────────┐
│ 顶栏: [←返回列表] 页面名____  路径____  [预览▼] [保存草稿] [发布] │
├────────────┬────────────────────────────────┬───────────────────┤
│ 物料区      │ 画布(designMode=true)           │ 属性面板           │
│ ─信息      │  ┌──────────────────────────┐  │ (选中节点时显示)    │
│  ·Banner   │  │  Container               │  │ 组件: LubanButton   │
│  ·Text     │  │   ├─ Button[选中] ◀━━━━━━│━━│ ─────               │
│ ─表单      │  │   └─ Text                │  │ variant: [primary▼] │
│  ·Input    │  │                          │  │ color:    [#0078d4] │
│  ·Select   │  │  [+ 拖入占位区]           │  │ disabled: [  ]      │
│  ·Switch   │  └──────────────────────────┘  │ content:  [按钮文案] │
│ ...        │  组件树(大纲)▶                │ ─────               │
│            │  ├─ Container                 │ [删除节点]          │
│            │  │  ├─ Button                 │                     │
│            │  │  └─ Text                   │ (未选中→空态提示)    │
├────────────┴────────────────────────────────┴───────────────────┤
│ 状态: 草稿 / 已发布(徽标)    最后保存: 2026-06-14 16:20         │
└──────────────────────────────────────────────────────────────────┘
```
- **空态**：画布无节点 → 显示"拖入物料开始编辑"占位
- **错态**：拉取 page 失败 → 画布区显示错误 + 重试按钮（非 catch{} 静默）
- **加载态**：拉取/保存/发布中 → 按钮 loading + 禁用
- **属性面板空态**：未选中节点 → "选中画布组件以编辑属性"

**页面 B — 发布确认弹窗（T4）**
```
┌─────────────────────────────┐
│ 发布页面              [×]   │
│ 发布后访客可立即通过         │
│ /mysite/home 访问。         │
│ 当前: 草稿 → 目标: 已发布    │
│        [取消]   [确认发布]   │
└─────────────────────────────┘
```

**页面 C — website DynamicPage（已有，T5 仅验证四态）**
- loading：骨架/spinner · empty：`status!=published` 或 path 不存在 → "页面未发布或不存在" · error：BFF/后端 5xx → 错误页 + 重试 · success：`<LubanPage :schema>` 渲染

**页面 D — 客户端渲染页（T6 骨架，electron/flutter）**
- 窗口/页面拉取指定 slug+path 的 published schema → RuntimeRenderer 渲染（与 website 一致）

> **约束（MUST）**：T4 画布、预览、website 访客页**共用同一 RuntimeRenderer**，保证编辑器所见 = 访客所见（渲染一致硬约束）。属性面板字段源 = T1 重构后的 `defineMaterial` propsSchema。

---

## §5 集成与复用

| 复用件 | 提供方 | 消费方 | 契约 |
|--------|--------|--------|------|
| `defineMaterial` propsSchema | T1(luban-ui) | T4 属性面板、T6 各端 | JSON Schema，含 type/default/required |
| RuntimeRenderer | luban-low-code（已有） | T4 画布预览、website、T6 各端 | schema → Vue 组件树 |
| DesignRenderer | luban-low-code（已有） | T4 画布 | +select/drag/reorder 事件 |
| BFF 透传层 | bff（已有） | engine app、website | `/api/*` → backend，X-User-* header |
| publish 状态机 | T2(Java/Go) | T4 发布按钮、website 渲染门 | status: draft/published |
| 设计 token | T3(回填) | luban-ui、website | `_variables.scss` + MASTER.md |

---

## §6 架构边界 + 跨切契约

### §6.1 双后端 parity 矩阵（T2 落地，Contract Test 守护）
| 接口 | Java 现状 | Go 现状 | T2 目标 |
|------|----------|---------|---------|
| POST /auth/login | ✅ | ✅ | 字段对齐（user 完整对象） |
| GET /auth/me | ✅ 完整 | 🔴 仅{id,role} | **Go 补齐完整字段** |
| /sites 全套 | ✅ | ✅ | 一致 |
| /sites/:id/pages 全套 | ✅ | ✅ | 一致 |
| GET /public/sites/:slug/pages | ✅ | 🔴 缺 | **Go 新增** |
| publish（PUT status） | ✅ PUT 接受 status | ⚠️ PUT 接受任意 status | **Go 补 draft\|published 白名单**（无新端点，§9.7-#1） |
| Page schema 序列化 | ✅ JsonNode 嵌套对象 | 🔴 `[]byte`→c.JSON 输出 base64 | **Go 改 `json.RawMessage`**（§9.7-#2，数据正确性 P0） |
| User PUT 密码 | ✅ patch + updatePassword 独立 SQL | 🔴 Update SQL 含 password 列→PUT 清空密码 | **Go 移除 password 列 + 拆 UpdatePassword**（§9.7-#3，数据损坏 P0） |
| User PUT 语义 | ✅ patch（非 null 覆盖） | 🔴 put（全字段覆盖） | **Go 改 Get-then-merge**（§9.4） |
| /users 全套 + PUT password | ✅ | ⚠️ 漏 password | **Go 补 password** |
| slug 冲突错误码 | ✅ SLUG_CONFLICT | 🔴 漏映射 | **Go writeError 补 case** |
| DB 迁移 | spring.sql.init | initSchema | **双端统一 Flyway** |

### §6.2 覆盖率门禁目标（T5）
engine/bff/website 85% · UI 物料 90% · Java 80% · Go 75% · `make test-coverage` 汇总

### §6.3 物料 schema 标准（T1）
`defineMaterial({ name, version(semver), category, propsSchema(JSON Schema), events[], slots[] })` + `materials/<category>/<name>/` 目录 + manifest。所有字段声明 default。

### §6.4 FeatureGate 策略（每个 T4/T6 新功能）
| 功能 | FeatureGate key | 作用域 | 关闭行为 |
|------|----------------|--------|---------|
| 编辑器 designMode | `editor.design_mode` | engine app | 画布只读（回退现状） |
| 属性面板 | `editor.property_panel` | engine app | 隐藏右侧栏 |
| 发布按钮 | `page.publish` | engine app | 隐藏发布，仅保存草稿 |
| 客户端渲染 | `client.<platform>` | 各 client | 不拉取 schema，显空态 |

回滚首选 = 关 FeatureGate（无需回滚代码/DB）。

---

## §7 E2E 策略

### §7.1 主链路 E2E（T4/T5，Playwright，**绑正式路由**）
```
登录 → 建站 → 建页面(draft) → 拖入 Button + Text → 改 Button.variant
→ 预览(断言只读) → 保存草稿 → 发布 → 断言 status=published
→ 访客 website /:site/:path → 断言渲染 Button+Text 内容一致
```
- **路由合规（MUST）**：编辑器 E2E 绑 `/sites/:siteId/pages/:pageId/edit`（正式产品路由）；访客 E2E 绑 `/:site/:path`。**禁止新增 `pages/e2e/*` 专测页作为特性主载体。**
- 工具：Playwright（T5 统一，废 engine 现有 Cypress）

### §7.2 脚本保障逻辑
- 首个失败即停（专注定位当前红用例，修绿后继续至全量门禁）
- 禁假绿：禁 `*.skip`/空断言/关 bail/无后端全 skip
- 环境预检：MySQL + Java(或Go) + BFF 起齐才跑（缺服务明确报错，不静默 skip）

---

## §8 TDD 与执行约定

- **TDD 先行**：每个 child plan 关键行为先定测试（E2E/单测/IT），红→绿→重构
- **单期收口（§5）**：每 child plan 在单次实现周期内完成全部门禁，禁止"做一半即停"
- **首个失败即停**：定位修复当前红，修绿后继续至全量绿（非提前收工）
- **并行 subagent**：每个 child plan 的实现阶段，可独立验收的线显式标出，主会话并发 Task 派发 + 汇总收口（调用 Task 默认不传 model）
- **Post-Development Workflow（每 child plan 完成时）**：
  ```
  代码提交 → /luban-review 全自动审查(🔴🟡🔵 清零) → 编译
  → 单测+覆盖率门禁 → 询问用户后跑 E2E → 全栈覆盖率汇总 → 完成汇报
  ```
- **/luban-review 先行**：所有验证步骤前必须先 `/luban-review` 清零，禁止未过审查跑验证

---

## §9 child plan 拆分与实现任务派发

> ⏳ **本节由并行 subagent 填充（backend-java / backend-go / engine / bff / website / ui / client）**，产出文件→任务映射、API 契约、DDL、物料 schema、组件接口、并行派发计划。下一轮 merge 进本节。

### §9.0 DAG（已定，来自 taskGraph JSON）
```
Wave 0 (并行):  T1(物料)  T2(后端)  T3(文档)
                    \      /  |
Wave 1:              T4(编辑器闭环) ← 核心
                       /        \
Wave 2:          T5(测试门禁)    \
Wave 3:                          T6(客户端骨架)
```

### §9.1 文件变更总览（7 探针合并）

#### T2 — backend-java（luban-backend）
| 文件 | 操作 | 摘要 |
|------|------|------|
| `pom.xml` | 修改 | +flyway-core/flyway-mysql(runtime) +surefire/failsafe/jacoco（当前全无） |
| `application.yml` | 修改 | 删 `spring.sql.init`，加 `spring.flyway.{enabled,locations,baseline-on-migrate,baseline-version=0}` |
| `db/migration/V20260614000000__init_schema.sql` | 新建 | baseline：sites/pages/users/system_settings 四表平移自 schema.sql（去 IF NOT EXISTS） |
| `db/migration/V20260614000001__pages_publish_status_index.sql` | 新建 | `idx_pages_site_path_status` 复合索引 |
| `schema.sql` | 迁移后删 | 内容已入 Flyway |
| `src/test/.../*ContractTest.java`（5）+ `LubanBackendApplicationTests` | 新建 | Contract Test（auth/me、public、slug、password、publish 状态）+ smoke；src/test 当前为零 |
| `src/test/resources/application-test.yml` | 新建 | Testcontainers MySQL（方言一致） |

> **修正**：原拟 `PageController publish/unpublish` 端点**不建**（见 §9.7-#1），publish 走 PUT status。

#### T2 — backend-go（luban-backend-go）
| 文件 | 操作 | 摘要 |
|------|------|------|
| `internal/model/page.go` | 🔴修改 | `Schema []byte` → `json.RawMessage`（修 base64 bug，§9.7-#2） |
| `internal/repository/user_repo.go` | 🔴修改 | Update SQL 移除 password 列 + 新增 `UpdatePassword`（修清密码 bug，§9.7-#3） |
| `internal/handler/error.go` | 修改 | writeError 补 `SLUG_CONFLICT`(409) + `SETTINGS_NOT_FOUND`(404) case |
| `internal/handler/auth_handler.go` + `service/auth_service.go` | 修改 | `/auth/me` 返回完整 user（当前仅 `{id,role}`） |
| `internal/handler/public_handler.go` + `service/public_service.go` | 新建 | `/public/sites/:slug/pages?path=`（router 加 public 组，不挂 RequireUser） |
| `internal/repository/site_repo.go` + `page_repo.go` | 修改 | 新增 `GetBySlug` + `GetPublishedBySiteAndPath` |
| `internal/handler/user_handler.go` + `service` | 修改 | PUT 改 patch 语义（Get-then-merge）+ 处理 password |
| `service/page_service.go` | 修改 | status 白名单 `draft\|published`（可选增强） |
| `dao/mysql.go` | 修改 | 命名约束对齐 Java；迁移方案 A（共享 DDL 文本，不引 golang-migrate） |
| `internal/**/*_test.go`（15+） | 新建 | 当前 0 个 _test.go；go.mod 加 testify/sqlmock |

#### T4 — engine（luban + luban-low-code 消费）
| 文件 | 操作 | 摘要 |
|------|------|------|
| `engine/src/views/page/PageEditor.vue` | 重做 | 静态 import 替换动态 import+shallowRef；传 `:design-mode="true"`；三栏布局；预览切换；发布按钮（调 PUT status） |
| `engine/src/views/page/components/PropertyPanel.vue` | 新建 | 消费 select + propsSchema，v-model 回写 props |
| `engine/src/views/page/components/ComponentTree.vue` | 新建 | 树形大纲，选中/删除/移动 |
| `engine/src/views/page/components/schemaTree.ts` | 新建 | findNode/findParent/removeNode/moveChild（root 级复用 reorderRootChildren） |
| `engine/src/api/page.ts` | 修改 | `publishPage` = PUT status:'published'（语义化）；status 字面量类型 |
| `engine/src/api/request.ts` + `src/mocks/index.ts` | 修改/删 | 去 mock（开关已 false，清死代码） |
| 5 个 view（Dashboard/PageList/SiteList/SiteDetail/Settings） | 修改 | catch{} 静默 → 可见错误态（11 处 catch 聚焦 fetch 类） |
| `engine/cypress` → Playwright 迁移 | 重做 | T5 统一；编辑器闭环 E2E |

#### T1 — ui 物料（luban-ui/packages/luban-low-code）
| 文件 | 操作 | 摘要 |
|------|------|------|
| `src/lib/material/defineMaterial.ts` | 新建 | 工厂 + MaterialDefinition（JSON Schema propsSchema + version + events/slots） |
| `src/lib/material/compat.ts` | 新建 | JSON Schema → 旧 PropSchemaItem 适配（@deprecated，保下游不破） |
| `src/lib/material/registry.ts` | 新建 | MaterialRegistry（name→def 单一源） |
| `src/lib/registry.ts` + `componentMeta.ts` | 改写 | 326 行内联 meta → materials/ 聚合；保导出签名不变（接口稳定锁） |
| `src/materials/<category>/<name>/material.ts`（13） | 新建 | 逐物料 defineMaterial；修 Banner/Input/TextArea/Text/Row 漂移；补 SidePanel |
| `src/lib/palette.ts` + `constants.ts` | 修改 | 派生自 MaterialRegistry |
| `test/unit/material-props-parity.spec.ts` | 新建 | Vue props ↔ propsSchema 漂移回归（防复现） |

#### T3 — 治理文档（meta 仓 + docs 子仓）
| 文件 | 操作 | 摘要 |
|------|------|------|
| `docs/superpowers/PLAN_WRITING_CONTRACT.md` | 新建 | 补当前缺失的契约文件（§0-§8 必选章节） |
| `docs/FEATURES.md` + `INIT-PLAN.md` | 新建 | 功能真相源 + 清 README 死链 |
| `packages/docs/luban-architecture-design/**` | 新建 | 填充架构设计（当前 70B README） |
| `design-system/luban/MASTER.md` + `scripts/check-design-tokens.mjs` | 修改 | 设计 token 回填（当前占位 #2ECC71） |

#### T5 — 测试门禁（全栈）
| 文件 | 操作 | 摘要 |
|------|------|------|
| `engine` Playwright 迁移 | 重做 | 废 cypress，绑正式路由 |
| `website` vitest + playwright 基建 | 新建 | 当前零测试、无 lockfile |
| `bff` vitest 基建 | 新建 | 当前零测试、无 test script |
| Java/Go 测试 | 见 T2 | 五端覆盖率 → 门禁 |

#### T6 — 客户端（meta 仓 + 3 子仓）
| 文件/submodule | 操作 | 摘要 |
|---------------|--------|------|
| `packages/client-electron/` `packages/client-flutter/` | 删 | 孤儿目录，统一到 `packages/client/luban-*` |
| 4 远程仓首提交（GitHub 侧） | 前置 | 空仓 `git submodule add` 失败，须先首提交 |
| `.gitmodules` + `packages/client/luban-{electron,flutter,cross-plateform}` | 新建 | `scripts/git/add-empty-submodule.sh` 注册 |
| electron 骨架（Vue3+electron-vite+luban-low-code npm） | 新建 | 复用 website `<LubanPage>` 路径 |
| flutter 骨架（webview_flutter 套壳，**非原生转译**） | 新建 | 加载 website `/:site/:path` |
| cross-plateform | ⚠️阻塞 | 定位未定义（§9.7-#13），待用户决策 |

### §9.2 API 契约（双后端 parity，修正后）

**publish 真相（§9.7-#1）**：无独立端点。发布 = `PUT /sites/:id/pages/:pageId` body `{status:'published', name, path, schema}`。双端均如此，website/BFF 按 `status='published'` 过滤。

**PageResponse 字段对齐**（Java ↔ Go，须修 Go Schema 类型）：
| 字段 | Java | Go（目标） | 状态 |
|------|------|-----------|------|
| schema | JsonNode（嵌套对象） | `json.RawMessage`（当前 `[]byte` 输出 base64 🔴） | T2 修 |
| 其余 id/siteId/name/path/status/createdAt/updatedAt | 一致 | 一致 | ✅ |

**错误码对齐**（Go 须补）：
| code | Java | Go | 处置 |
|------|------|----|------|
| SLUG_CONFLICT 409 | ✅ | 🔴 漏映射落 500 | T2 补 |
| SETTINGS_NOT_FOUND 404 | ✅ | 🔴 缺 | T2 补 |
| 其余（SITE/PAGE/USER_NOT_FOUND、PATH/USERNAME_CONFLICT、INVALID_CREDENTIALS、USER_DISABLED、UNAUTHENTICATED、PERMISSION_DENIED、INVALID_ARGUMENT） | ✅ | ✅ | 一致 |

### §9.3 DDL / 迁移
- **Java**：Flyway V1 baseline（四表平移）+ V2 publish 索引；删 spring.sql.init
- **Go**：方案 A——`initSchema` 保留，命名约束对齐 Java，**共享同一份 DDL 文本**（字面一致）；不引 golang-migrate（Java 当前也非 Flyway，T2 同步迁 Java 到 Flyway 后双端可考虑共享，长期评估）
- **无 schema 变更**：publish 复用 status 列；public 接口复用 sites+pages 表

### §9.4 物料 schema（defineMaterial 草案，代表性 3 物料已逐字段对照 Vue props）

```ts
// 通用形态
defineMaterial({
  name, version: '1.0.0', category, description,
  component, isContainer?, acceptTypes?,
  propsSchema: { type:'object', properties:{...每个字段含 default...}, required? },
  events: [{name, description}], slots: [{name, description}],
})
```
- **Button**：content/variant/color/type/disabled/block（修：补 type）
- **Banner**（漂移修复）：src/alt/href/height/objectFit（旧 meta 错声明 content）
- **Input**（漂移修复）：+helperText/error/errorMessage（旧 meta 缺）
- **Row**（额外漂移）：删 stretch/around 枚举（Vue 组件无）
- **SidePanel**：新建 meta + registry 注册

### §9.5 组件接口（关键契约）

**PropertyPanel.vue**：`props:{node, meta, readonly?}` · `emits:{'update:prop':[nodeId,key,value], 'delete':[nodeId], 'duplicate':[nodeId]}` · 按 propsSchema type 渲染控件

**ComponentTree.vue**：`props:{schema, selectedId, readonly?}` · `emits:{select, delete, move:[parentId,fromIdx,toIdx]}`

**PageEditor ↔ luban-low-code 接通点**（探针确认全部已暴露）：
- `:design-mode="true"`（LubanDesigner 已有此 prop）· `v-model:schema` · `@select` · `@add-node(type,parentId?)` · `@reorder` · `getPaletteGroups()` · `getComponentMeta(type).defaultProps` · `canAcceptChild/isContainerType`
- **缺口**：子节点重排/删除 Designer 不 emit → PageEditor 自管（schemaTree.ts）；toolbar slot 有但建议按钮放外部 header

**Client**：electron 复用 website `<LubanPage>`；flutter = WebView 加载 `/:site/:path`（官方规则已定）

### §9.6 并行派发计划（按 child plan 内部 wave）

| Child Plan | Wave 内并行拓扑 | 峰值并行 |
|-----------|----------------|---------|
| **T2** | Go：P1 错误码 ∥ P2 Schema类型 ∥ P3 迁移文档 → P4 public全链路 ∥ P5 user密码+patch → P6 auth/me ∥ P7 status白名单 → P8 测试(3 agent)；Java：A Flyway ∥ B(publish删) ∥ D pom测试 → C Contract Test | 3 |
| **T1** | Wave0 defineMaterial+Registry+compat(串行锁) → Wave1 13 物料 meta 全并行(5-6 槽) → Wave2 registry/componentMeta/palette 串行 → Wave3 测试 | 6 |
| **T4** | 线1 schemaTree ∥ 线2 PropertyPanel ∥ 线3 api/page ∥ 线4 去mock+错误态 → PageEditor 收口 + 单测 + E2E | 4 |
| **T5** | website：P1 纯函数单测 ∥ P2 测试基建 ∥ P3 README纠错 → P5 composable/view 单测 → P6 主链路 E2E(强依赖 T1/T2/T4) | 3 |
| **T6** | Wave0 治理(删孤儿+首提交+注册 submodule) → Wave1 electron ∥ flutter(spike 先) ∥ cross-plateform[阻塞] → Wave2 多端冒烟 | 3 |

### §9.7 🔴 关键发现与计划修正（探针产出，已回写 §1/§3/§6）

| # | 发现 | 修正动作 |
|---|------|---------|
| 1 | publish 无独立端点（Java/Go 均无，走 PUT status） | T2 删 publish/unpublish 端点；T4 发布按钮调 PUT status；§3.1/§6.1 已改 |
| 2 | 🔴 Go `model.Page.Schema []byte` 序列化 base64 | T2 P0 改 json.RawMessage |
| 3 | 🔴 Go `UserRepository.Update` SQL 含 password 列 → PUT 清空密码 | T2 P0 移除 password 列 + 拆 UpdatePassword |
| 4 | BFF sites/:id、users/:id 主路由已存在 | BFF 范围缩为鉴权一致性修复 + Next16 async params + 测试 |
| 5 | designMode 已暴露 + mock 已关 | T4 比预估简单（传 true + 清死代码） |
| 6 | 物料 meta 当前零下游消费 | T1 重构是安全窗口（T4 才首次接入） |
| 7 | Row meta 额外漂移（stretch/around Vue 无） | T1 补修 + compat 降级映射 |
| 8 | materials/ 目录落点：spec 写 luban-ui/src/（无 src/） | **[待确认]** 落 luban-low-code/src/materials/？ |
| 9 | 4 个 client/ai 远程仓空仓 | T6 前置：GitHub 侧首提交后才能 submodule add |
| 10 | Flutter = WebView 路线（官方规则定） | T6 flutter 骨架走 webview_flutter，非原生转译 |
| 11 | cross-plateform 定位未定义 | **[待确认]** T6-E 阻塞，需用户决策 |
| 12 | PLAN_WRITING_CONTRACT.md 缺失 | T3 补建（契约源暂用命令体） |

---

## 附录 A — 分级验收门禁表（每 child plan 继承）
| 级别 | 验证方式 | 通过条件 | 责任 |
|------|---------|---------|------|
| G1 代码质量与审查 | `/luban-review` | 🔴🟡🔵 全清零 | child plan owner |
| G2 安全审查 | OWASP 自查 + 敏感字段清单 | 鉴权覆盖、敏感字段加密、无注入 | child plan owner |
| G3 单测+覆盖率 | 分栈 `pnpm test` / `mvn verify` / `go test` | 达 §6.2 门禁值 | child plan owner |
| G4 E2E 验收 | Playwright 主链路（绑正式路由） | 全绿、无 skip | child plan owner |

## 附录 B — 质量禁令自检（逐条勾选，禁止跳过）
- [x] 禁止跳过功能（所有 gap 映射到 T1–T6，无静默省略）
- [x] 禁止假绿（E2E 真实执行契约，见 §7.2）
- [x] 禁止占位（无 TODO/mock 冒充，engine 去 mock 是 T4 硬项）
- [x] 禁止骨架交付（T4 画布须 designMode=true 真可拖拽）
- [x] 禁止 JSON 替代页面（RuntimeRenderer 真渲染，非 dump）
- [x] 页面交互完整（§4.2 八步链路 + E2E 断言）
- [x] 验收口径=可交付（§0 验收口径）
- [x] 引擎 E2E 绑正式路由（§7.1，无新增 pages/e2e/*）
- [x] 门禁分级执行（附录 A 四级）
- [x] /luban-review 清零（§8 Post-Dev）
- [x] 安全审查门禁（附录 A G2）
- [x] 双后端契约一致（§6.1 矩阵，禁止单端）
- [x] 多端渲染一致（T6 + §5 RuntimeRenderer 复用）
- [x] FeatureGate 默认约束（§6.4）

## 附录 C — 双后端契约一致性声明（MUST）
本项目集**所有新增/修改接口**（publish 状态流转、`/public` Go 端、`/auth/me` Go 端字段、slug 映射、password 更新）**Java 与 Go 双端均须实现且行为一致**（响应体字段、错误码、状态机一致），由 Contract Test 守护。**无任何接口只声明单端。**

## 附录 D — 多端渲染一致性声明（MUST）
引擎产物（schema → RuntimeRenderer）在 **website / electron / flutter** 渲染一致。T4 画布预览、website 访客页、T6 客户端页**共用同一 RuntimeRenderer**，由 T5 多端 E2E 验证。

## 附录 E — 敏感字段清单与加密约束
| 字段 | 位置 | 处理 |
|------|------|------|
| user.password | Java/Go User | 仅存 hash（bcrypt），禁止明文/日志 |
| JWT secret | BFF AUTH_JWT_SECRET | 环境变量，禁止入库 |
| X-User-* header | BFF→backend | 内网可信，禁止外泄到响应 |
| 手机号/身份证（本期无） | — | 本期无此字段，未来新增须加密+脱敏展示 |

## 附录 F — 回滚方案
| 变更 | 回滚首选 |
|------|---------|
| T4 编辑器新功能 | 关 FeatureGate（§6.4） |
| T2 Flyway 迁移 | `flyway undo` / 手动回滚 SQL（须先在 staging 验证） |
| T1 物料重构 | 保留旧 ComponentMeta 兼容期，灰度切换 |
| T2 publish 状态机 | 关 `page.publish`，回退仅草稿 |

## 附录 G — 已知缺口显式延后（非静默跳过）
| 项 | 延后到 | 理由 |
|----|--------|------|
| 物料类别补全（data-display/navigation/feedback） | T1 后续迭代子项 | 本期先重构架构，类别增量单列 |
| SSR ClientOnly 首屏优化 | T5 评估 | 不阻塞用户能用，SEO 优化独立 |
| AI 助手(luban-ai-assistant) | 项目集外 | 规划态，独立立项 |
| 页面历史版本/草稿发布分离表 | 项目集外 | 功能扩展，非交付硬约束 |

## 附录 H — 明确不做（防膨胀）
- 不重构 BFF 框架（Next.js Route Handlers 透传层保留）
- 不引入新后端语言/框架
- 不做物料市场/发布流水线（后端 material 域本期不建表）
- 不改 meta 仓 git submodule 拓扑（仅 T6 补建缺失 submodule）
