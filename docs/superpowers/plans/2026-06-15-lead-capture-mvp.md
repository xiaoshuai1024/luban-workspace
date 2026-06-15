---
featureId: lead-capture-mvp
title: P0 留资闭环 MVP
status: ready
branch: feature/lead-capture-mvp
upstream:
  - docs/02.../architecture: packages/docs/luban-architecture-design/docs/00-platform-overview.md ~ 07-data-model.md
依据声明: |
  本 plan 依据「/plan-template 命令内联契约（§0-§9 + 14 质量禁令 + §9 派发 + 四级门禁）」
  + .agents/skills/writing-plans/SKILL.md + docs/SUPERPOWERS.md 编写。
  原因：仓库 docs/superpowers/PLAN_WRITING_CONTRACT.md、docs/dev/SSOT-TASK-GRAPH-PLAN.md
  为 meta 仓初始化遗留 stub（不存在）；scripts/verify-plan-ssot.mjs 为 stub（仅打印 TODO）。
  故 taskGraph JSON 合规性由人工保证，不宣称"校验脚本通过"。
taskGraph: ./tasks/lead-capture-mvp.json
---

# P0 · 留资闭环 MVP 实现计划

> 本 plan 是「营销留资平台」系列 plan 的第一份。P1（营销化）/P2（增长+多端）各自独立 plan，本份仅承诺 P0 范围，单次实现周期内全部完成至四级门禁全绿。

## §0 范围与分支策略

### 0.1 本期范围（P0）
让 luban 从"建站"具备**留资闭环**：运营搭建带表单的营销页 → 访客提交留资 → 去重/防刷 → 线索中心查看/流转/导出。

### 0.2 分支
- 主仓 `luban-workspace`：`feature/lead-capture-mvp`（已建）
- 各子项目：在各自子模块内建同名分支 `feature/lead-capture-mvp`（engine/bff/website/backend-java）
- backend-go：本期不实现（声明），不动其分支

### 0.3 taskGraph SSOT
任务图 JSON：`docs/superpowers/tasks/lead-capture-mvp.json`（随本 plan 同步）。校验脚本为 stub，JSON 合规性人工保证。

---

## §1 需求溯源与追溯矩阵

| # | 需求（来源 02-roadmap P0） | Task ID | E2E 场景 | 验收门禁 |
|---|---|---|---|---|
| R1 | LubanForm 物料可拖拽 + 字段配置 + 提交 | T-ui-1 | E2E-1 | G3/G4 |
| R2 | 表单提交 API 生成 Lead | T-bff-3,T-be-3 | E2E-2 | G3/G4 |
| R3 | Lead 领域 + 线索中心（列表/详情/状态流转/导出） | T-eng-2,T-be-2 | E2E-5,6,7 | G3/G4 |
| R4 | 去重（dedup_hash） | T-be-4 | E2E-3 | G3 |
| R5 | 防刷（频控 + 图形验证码） | T-be-5 | E2E-4 | G3/G4 |
| R6 | 留资 Webhook 通知 | T-be-6 | (单测) | G3 |
| R7 | 多租户隔离 | T-be-2,T-be-7 | E2E-8 | G3/G4 |

### 明确不做（防膨胀，继承讨论稿共识）
- ❌ P1：渠道/短链/活动/埋点/漏斗/营销物料（弹窗/倒计时/优惠券卡）
- ❌ P2：A/B、线索自动分配规则引擎、CRM 双向、短信/企微触达、线索打分
- ❌ 多端：Flutter 原生渲染器、uniapp 小程序渲染器（依赖 P0 schema 冻结）
- ❌ Go 后端同步实现（仅声明契约对齐基准）
- ❌ 短信验证码（仅图形验证码 + 频控）
- ❌ 异步导出任务（同步流式 Excel）
- ❌ Flyway 迁移（现状 schema.sql 幂等 + Java/Go 共用描述；P0 沿用，避免 baseline 风险）

---

## §2 系统与链路

### 2.1 涉及子系统
| 子系统 | 角色 | P0 增量 |
|---|---|---|
| backend-java | 主后端 | Form/Lead 领域 + 去重 + 防刷 + Webhook + schema.sql 增表 + API.md |
| bff | API 聚合 | forms/leads 路由 + 公开留资提交 + 防刷前置 |
| engine | 管理后台 | 线索中心（列表/详情/流转/导出）+ 表单配置 |
| website | 访客渲染 | 表单提交接入 BFF + 提交成功态 |
| luban-ui (luban-low-code) | 物料/运行时 | 复用现有 LubanForm；补"提交配置 + 提交运行时" |
| backend-go | 暂缓 | 仅声明契约基准，不实现 |

### 2.2 端到端链路

**链路 A：访客留资（核心）**
```
访客打开 website/:slug/* (published 页含 LubanForm)
  → 渲染 LubanPage(schema) → LubanForm 展示
  → 访客填写 → 点击提交
  → website useLeadSubmit(formId, payload, {pageId,channel,utm})
  → bff POST /api/forms/:id/submit  (免 token，BFF 频控前置)
  → bff callBackend POST /backend/lead/forms/:formId/submit
       header: X-Forwarded-For, X-Visitor-ID, X-Site-ID
  → backend-java:
       1. 防刷复核(IP/visitor 频控) → 命中返回 LEAD_SPAM_BLOCKED
       2. 图形验证码校验(若开启)
       3. 去重: dedup_hash = hash(formId + 去重键值)
            命中 → 按 policy(reject/overwrite/merge/mark) 处理
       4. 生成 Lead(status=new), phone/email 加密存储
       5. 异步: Webhook 通知
  → bff 返回 { leadId, status, dedup }
  → website 按 submitConfig.successAction 显示(跳转/弹窗/文案)
```

**链路 B：运营线索处理**
```
engine 登录 → 线索中心 /leads?siteId=&status=
  → bff GET /api/leads (token) → backend GET /backend/leads
  → 列表展示(分页/筛选)
  → 点详情 → 状态流转 PATCH → backend PATCH /backend/leads/:id/status
       状态机校验: new→assigned→contacting→{converted|lost}, →invalid
       非法转移返回 LEAD_INVALID_TRANSITION
  → 导出 → bff GET /api/leads/export → backend 流式 Excel
```

### 2.3 列表页分步链路（线索中心）
1. 进入 `/leads?siteId=X` → 发 GET → **加载态**（骨架）
2. 返回空 → **空态**（"暂无线索，去发布表单页收集"）
3. 返回数据 → 渲染列表（列：联系人/手机号(脱敏)/来源页面/渠道/状态/留资时间/操作）
4. 筛选 status=new → 发 GET（带参）→ 刷新列表
5. 点「认领」→ PATCH status=assigned → **成功 toast** + 行状态更新
6. 网络失败 → **错态**（重试按钮）

---

## §3 业务逻辑

### 3.1 Lead 状态机
```
new ──认领/分配──▶ assigned ──开始跟进──▶ contacting ──成交──▶ converted
 new\assigned\contacting ──▶ invalid (重复/无效)
 contacting ──▶ lost (流失)
```
- 非法转移（如 new→converted）→ `LEAD_INVALID_TRANSITION` (409)
- 转换由服务端校验，前端只发意图

### 3.2 去重
- `dedup_hash = sha256(formId + ":" + 去重键值)`，去重键默认 `phone`（可配 phone/email）
- 表唯一约束 `uk_form_dedup (form_id, dedup_hash)`
- 时间窗 `dedup_window`（默认 24h，表内 `created_at` 比较）
- policy：`reject`（默认，拒绝返回 LEAD_DUPLICATE）/ `mark`（仍入库 status=invalid reason=duplicate）/ `overwrite`/`merge`
- 强去重键 phone 跨 form 可选站点级（P0 先 form 级）

### 3.3 防刷
- 维度：IP（X-Forwarded-For）+ visitor_id（前端生成 cookie）
- Redis 滑动窗口：同 IP/form 60s 内 ≤N 次（可配，默认 5）；超额 → `LEAD_SPAM_BLOCKED` (429)
- 图形验证码（form.anti_spam.captcha=true 时要求）：提交带 captchaToken，后端校验
- 命中 spam → Lead 仍记录 status=invalid reason=spam（可审计），不进有效线索

### 3.4 敏感数据
- phone / email：**AES-256 加密存储**（密钥 env `LEAD_ENC_KEY`），展示时脱敏（138****1234）
- 日志：phone/email 一律脱敏输出，禁止明文入日志
- 导出：按角色权限，operator/sales 只导本站点

---

## §4 页面结构与交互（§4.0/§4.2/§4.3）

### §4.0 入口表
| 入口 | 路由 | 角色 | 说明 |
|---|---|---|---|
| 线索中心列表 | `/leads` (engine) | operator/sales/admin | R3 主界面 |
| 线索详情 | `/leads/:id` (engine) | 同上 | 状态流转 |
| 表单配置 | PageEditor 内 LubanForm 属性面板 | operator/admin | R1 |
| 访客表单页 | `/:slug/*` (website) | 公开访客 | R2 留资入口 |

### §4.2 列表级主交互链（线索中心）
加载→空/数据→筛选→行操作(认领)→反馈→错态重试（见 §2.3）

### §4.3 逐页页面结构

#### 页面 1：线索中心列表 `/leads`
```
┌─ 顶栏：站点选择 | [新建表单页] | [导出] ─────────────────┐
├─ 筛选条：状态(全部/new/assigned/contacting/converted/invalid/lost) │
│         来源页面 ▾  渠道 ▾  时间范围  [搜索联系人] [查询] │
├─ 统计卡：新线索 N | 待跟进 N | 已转化 N (本期可简)        │
├─ 列表（Element Plus el-table）                            │
│  列：联系人 | 手机号(脱敏) | 邮箱(脱敏) | 来源页面 |        │
│      渠道 | 状态(Tag) | 留资时间 | 操作[详情][认领]        │
├─ 分页：共 N 条  < 1 2 3 >  每页 20                         │
└─ 空态：📄 暂无线索 → [去搭建表单页]                        │
   错态：⚠ 加载失败 [重试]                                   │
```

#### 页面 2：线索详情 `/leads/:id`
```
┌─ 返回 [线索中心] ─────────────────────────────────────┐
├─ 基本信息卡：联系人/手机(脱敏,点"查看"显示明文[权限])/邮箱 │
│              来源页面(链接) / 渠道 / UTM / 留资时间 / IP   │
├─ 表单内容卡：提交的字段键值（fieldSchema 对应）            │
├─ 状态流转卡：当前状态 Tag + [认领][开始跟进][标记转化]    │
│              [标记无效][标记流失] + 流转历史时间线         │
├─ 跟进记录（P0 可占位为只读时间线，写入留 P1）              │
└─ 操作：[导出此条]                                          │
   错态：线索不存在 / 无权限查看                             │
```

#### 页面 3：表单配置（PageEditor 内 LubanForm 属性面板）
```
选中 LubanForm 节点 → 右侧属性面板：
├─ 字段配置：[+添加字段] 每字段：名称/类型(input/select/...)/必填/校验
├─ 提交配置 submitConfig：
│   ├ 成功行为：跳转URL / 弹窗文案 / 仅提示
│   ├ 提交按钮文案
│   └ 防刷：图形验证码 开/关
├─ 去重配置：去重键(phone/email) | 时间窗 | policy
└─ （字段配置映射到 form.field_schema_json）
```

#### 页面 4：访客表单页 `/:slug/*`（website）
```
LubanPage 渲染 schema（含 LubanForm 节点）
└─ LubanForm：
   ├ 加载态：提交按钮 loading
   ├ 校验失败：字段下红字提示（必填/格式）
   ├ 提交成功：按 submitConfig → 跳转 / 弹窗"提交成功" / 顶部 toast
   ├ 提交失败(去重)：提示"您已提交过"（policy=reject 时）
   ├ 提交失败(防刷)：提示"操作过于频繁，请稍后再试"
   └ 提交失败(网络)：提示"提交失败，请重试" [重试]
```

> 上述为文字+结构展示，约束力足够（标准列表/详情/表单形态），不需高保真原型。

---

## §5 集成与复用表

| 复用 | 来源 | P0 用途 |
|---|---|---|
| LubanForm/Input/Select 等物料 | luban-base（已注册于 luban-low-code registry.ts） | 表单渲染，**复用** |
| LubanPage 运行时渲染器 | luban-low-code | website 渲染，**复用** |
| LubanDesigner | luban-low-code | engine PageEditor，**复用** |
| callBackend / parseTokenFromRequest | bff/lib | 新 route 风格，**复用** |
| schema.sql 幂等建表 | backend-java | 增 forms/leads 表，**沿用** |
| X-User-ID/X-User-Role 注入 | backend-java 现有鉴权 | 管理端接口，**沿用** |
| Redis | backend-java 现有 | 防刷频控 + settings，**沿用** |
| Element Plus | engine | 线索中心 UI，**沿用** |
| UUID VARCHAR(36) | 现有表 | form/lead id，**沿用**（非 Snowflake） |

---

## §6 架构边界与门禁自检

### 6.1 边界
- 后端不直接面向客户端，一律经 BFF
- 公开留资路由（`/backend/lead/*`）免用户鉴权但强制防刷
- BFF 不持有业务状态权威（去重/状态机在后端）
- phone/email 加密只在后端，BFF/前端只收脱敏或明文透传（提交时明文，展示时脱敏）

### 6.2 门禁自检（详见分级门禁表）
- [x] 四级门禁已定义（G1 代码审查/G2 安全/G3 单测覆盖率/G4 E2E）
- [x] /luban-review 清零写入 Post-Dev Workflow
- [x] 敏感字段加密 + 日志脱敏
- [x] 双后端契约声明（§7.3）
- [x] 多端渲染声明（本期仅 web，§7.4）
- [x] FeatureGate 设计（§7.5）

---

## §7 验收与测试

### 7.1 分级验收门禁表
| 级别 | 内容 | 验证方式 | 通过条件 |
|---|---|---|---|
| **G1 代码审查** | `/luban-review` 全自动审查 | 派发 ~20 并行 subagent | 🔴🟡🔵 **全部清零**（含建议级）；未过不进 G2 |
| **G2 安全审查** | 敏感字段加密/日志脱敏/防刷/鉴权/OWASP Top10 | 安全清单逐项 + 单测断言 | 清单 ✅；phone/email 加密单测通过 |
| **G3 单测+覆盖率** | Java `mvn -q verify`；engine/bff/website `pnpm test`+build；ui `pnpm test` | 各包根执行 | Java≥80% · engine/bff/website≥85% · ui≥90% · 全绿 |
| **G4 E2E 验收** | engine-e2e（线索中心）+ website-e2e（留资提交） | Playwright 真实执行，正式路由 | §7.2 全用例通过，禁假绿 |

### 7.2 E2E 用例枚举（每场景一表）
| ID | 场景 | 前置 | 操作与断言 | 清理 |
|---|---|---|---|---|
| E2E-1 | 搭建表单页并发布 | site 存在、已登录 | PageEditor 拖入 LubanForm→配字段→保存→发布；断言 status=published | 删测试 page |
| E2E-2 | 访客提交留资 | E2E-1 的 published 页 | 访问 `/:slug/path`→填表→提交；断言 200 + leadId 生成 + 线索中心可见 | 删 lead |
| E2E-3 | 去重 | E2E-2 已留资 | 同手机号再提交；断言 reject policy 下返回 LEAD_DUPLICATE | 删 lead |
| E2E-4 | 防刷 | published 页 | 短时间高频提交；断言超阈值返回 LEAD_SPAM_BLOCKED(429) | — |
| E2E-5 | 线索列表筛选 | 存在多条 lead | 进 `/leads`→筛选 status=new；断言列表只含 new | — |
| E2E-6 | 状态流转 | 一条 new lead | 详情→认领→跟进→转化；断言状态依次变更 + 非法转移被拒 | 删 lead |
| E2E-7 | 导出 | 存在 lead | 点导出；断言 Excel 含正确行、手机脱敏/明文按权限 | 删 lead |
| E2E-8 | 多租户隔离 | site A、B 各有 lead | site A 用户查线索；断言看不到 site B 的 lead | 删 lead |
| E2E-9 | 表单校验错态 | published 页必填字段 | 空提交；断言字段红字提示、不发请求 | — |
| E2E-10 | Webhook 通知（单测替） | 配 Webhook URL | mock 端点；提交后断言被调用 + payload 正确 | — |

**E2E 路由合规性确认**：所有 E2E 用正式产品路由（`/:slug/*` 渲染、`/leads` 管理端、PageEditor），**无新增 `pages/e2e/*` 专测页**。

### 7.3 双后端契约一致性声明
| 接口 | Java | Go |
|---|---|---|
| `POST /backend/lead/forms/:id/submit` | ✅ 本期实现 | ⏸ 暂缓，按本契约对齐基准（响应体/错误码/状态机一致） |
| `GET/POST/PATCH /backend/forms` | ✅ | ⏸ |
| `GET /backend/leads`、`PATCH /backend/leads/:id/status`、`GET /backend/leads/export` | ✅ | ⏸ |

> 错误码统一：`LEAD_DUPLICATE`(409) / `LEAD_SPAM_BLOCKED`(429) / `LEAD_INVALID_TRANSITION`(409) / `LEAD_NOT_FOUND`(404) / `LEAD_FORBIDDEN`(403)。Go 未来接入须完全一致。

### 7.4 多端渲染一致性声明
- 本期仅 web（website SSR + engine 管理端），复用 `luban-low-code` 渲染器，**渲染一致性天然成立**。
- LubanForm 提交运行时本期仅实现 web 侧；**声明**：P2 多端（Flutter/uniapp）接入时须按同一 `submitConfig` 契约实现提交，保证行为一致。
- schema 冻结：P0 发布后 `LubanForm` 的 `field_schema` + `submitConfig` 变更须向后兼容（对齐 architecture-design/04）。

### 7.5 FeatureGate 开关设计
| key | 作用域 | 默认 | 关闭时行为 |
|---|---|---|---|
| `lead_capture` | 全局 | **关**（灰度） | 公开留资提交返回 503 `LEAD_DISABLED`；线索中心只读 |
| `lead_dedup` | 全局 | 开 | 关闭则不去重（仅测试用） |
| `lead_anti_spam` | 全局 | 开 | 关闭则跳过频控（危险，仅调试） |
| `lead_webhook` | 全局 | 开 | 关闭则不发 Webhook |

回滚首选：关闭 `lead_capture`（即时生效，无回滚风险）。

### 7.6 错误场景清单（每功能 ≥3 非正常路径）
- 留资提交：去重命中 / 防刷拦截 / 必填校验失败 / 网络失败 / FeatureGate 关闭
- 状态流转：非法转移 / 无权限 / 线索不存在
- 导出：无权限 / 空结果 / 超量

### 7.7 回滚方案
1. FeatureGate 关 `lead_capture`（首选，即时）
2. schema.sql 新增表不影响现有表（IF NOT EXISTS），无 DDL 回滚风险
3. Webhook 失败不影响留资主流程（异步、失败重试+日志）

---

## §8 TDD 与执行约定

### 8.1 TDD 落点
| 行为 | 测试类型 | 先行 |
|---|---|---|
| 去重 dedup_hash + policy | backend 单测 | ✅ 红→绿 |
| 防刷频控窗口 | backend 单测（Redis mock） | ✅ |
| 状态机非法转移 | backend 单测 | ✅ |
| phone/email 加密/脱敏 | backend 单测 | ✅ |
| 留资全链路 | E2E (E2E-2) | ✅ 红→绿 |
| 线索中心列表/流转 | E2E (E2E-5,6) | ✅ |
| 物料提交配置 | ui 单测 | ✅ |

### 8.2 执行约定
- 红→绿→重构；首个失败即停=专注当前红用例，修绿后继续至全量
- 并行 subagent：无依赖线并行（见 §9.6）
- 每包改后在该包根跑构建+测试
- 禁假绿/占位/骨架/JSON 替页面

### 8.3 Post-Development Workflow（MUST 顺序）
```
1. 各包代码完成 → 各子项目 feature/lead-capture-mvp 分支 commit
2. /luban-review 全自动审查 → 🔴🟡🔵 清零（未过不进 3）
3. 编译：TS pnpm build · Java mvn -q compile
4. 单测+覆盖率门禁 G3（Java 80 / TS 85 / UI 90）
5. 询问用户后跑 E2E G4（engine-e2e + website-e2e）
6. 全栈覆盖率汇总 make test-coverage
7. 完成汇报（一次推进至全绿，证据在先）
```

### 8.4 质量禁令自检表
- [x] 禁止跳过功能（无静默省略）
- [x] 禁止假绿（无不当 skip/空断言）
- [x] 禁止占位（无 TODO/假文案/mock 冒充）
- [x] 禁止骨架交付（路由非空壳）
- [x] 禁止 JSON 替页面
- [x] 页面交互完整（§4.2 分步链路 + E2E 断言）
- [x] 验收口径=可交付页面链路
- [x] E2E 绑定正式路由（无 pages/e2e/*）
- [x] 门禁分级（G1-G4）
- [x] /luban-review 清零
- [x] 安全审查门禁（敏感字段）
- [x] 双后端契约声明
- [x] 多端渲染声明
- [x] FeatureGate 默认约束
- [x] 单次完成本期范围（禁止分期/主路径收口即完成）

---

## §9 实现任务派发

> §9 由主 agent 基于已查证现状（Read/Grep/Bash）生成，关键文件路径已确认存在或标注 `[新建]`，不编造。codegraph MCP 工具本轮未就绪，改用文件系统查证（同等保证准确性）。

### 9.1 文件变更总览

#### [backend-java] `packages/backend/luban-backend/`（分支 feature/lead-capture-mvp）
| Task | 文件 | 新建/改 | 摘要 |
|---|---|---|---|
| T-be-1 | `src/main/resources/schema.sql` | 改 | 增 `forms`/`leads` 表（VARCHAR(36) UUID，IF NOT EXISTS） |
| T-be-2 | `entity/Form.java`,`entity/Lead.java` | 新建 | 领域实体（对齐 Page.java 风格） |
| T-be-2 | `mapper/FormMapper.java`,`mapper/LeadMapper.java` | 新建 | MyBatis mapper |
| T-be-2 | `service/FormService.java`,`service/LeadService.java` | 新建 | 领域服务 |
| T-be-4 | `service/DedupService.java` | 新建 | dedup_hash 计算 + policy |
| T-be-5 | `service/AntiSpamService.java` | 新建 | Redis 滑动窗口频控 + 验证码校验 |
| T-be-6 | `service/LeadNotifyService.java` | 新建 | Webhook 异步通知 + 重试 |
| T-be-3 | `controller/PublicLeadController.java` | 新建 | `POST /backend/lead/forms/:id/submit`（公开+防刷） |
| T-be-2 | `controller/FormController.java` | 新建 | 管理端 forms CRUD |
| T-be-2 | `controller/LeadController.java` | 新建 | 线索列表/详情/状态流转/导出 |
| T-be-7 | `dto/*`（LeadSubmitDTO,LeadListQuery,LeadStatusUpdate,LeadExportRow） | 新建 | |
| T-be-7 | `config/LeadSecurityConfig.java` | 新建 | AES 加密 bean（LEAD_ENC_KEY） |
| — | `exception` 领域错误码 | 改 | 增 LEAD_* 错误码 |
| — | `docs/API.md` | 改 | 增 form/lead 接口契约 |

#### [bff] `packages/bff/luban-bff/`
| Task | 文件 | 新建/改 | 摘要 |
|---|---|---|---|
| T-bff-1 | `src/app/api/forms/route.ts` | 新建 | GET list / POST create（token，注入 X-User-ID） |
| T-bff-1 | `src/app/api/forms/[id]/route.ts` | 新建 | GET / PATCH |
| T-bff-3 | `src/app/api/forms/[id]/submit/route.ts` | 新建 | POST 公开留资（免 token，防刷前置，注入 X-Forwarded-For/X-Visitor-ID） |
| T-bff-2 | `src/app/api/leads/route.ts` | 新建 | GET list（分页/筛选） |
| T-bff-2 | `src/app/api/leads/[id]/route.ts` | 新建 | GET / PATCH status |
| T-bff-2 | `src/app/api/leads/export/route.ts` | 新建 | GET 流式 Excel |
| T-bff-4 | `src/lib/antiSpam.ts` | 新建 | BFF 层前置频控（IP 维度，Redis 可选） |
| — | `src/lib/backendClient.ts` | 改 | 透传 X-Forwarded-For/X-Visitor-ID/X-Site-ID |

#### [engine] `packages/engine/luban/`
| Task | 文件 | 新建/改 | 摘要 |
|---|---|---|---|
| T-eng-2 | `src/views/lead/LeadList.vue` | 新建 | 线索中心列表（§4.3 页面1） |
| T-eng-2 | `src/views/lead/LeadDetail.vue` | 新建 | 详情+状态流转（§4.3 页面2） |
| T-eng-1 | `src/api/lead.ts` | 新建 | getLeads/getLead/updateLeadStatus/exportLeads |
| T-eng-1 | `src/api/form.ts` | 新建 | forms CRUD |
| — | `src/router/index.ts` | 改 | 增 `/leads` 路由 |
| — | `src/layouts/*` | 改 | 菜单增"线索中心" |
| T-eng-3 | `src/views/page/PageEditor.vue` | 改 | LubanForm 属性面板接 form 配置（字段/submitConfig/dedup/anti_spam） |

#### [website] `packages/web/luban-website/`
| Task | 文件 | 新建/改 | 摘要 |
|---|---|---|---|
| T-web-1 | `composables/useLeadSubmit.ts` | 新建 | 表单提交→BFF（携带 pageId/channel/utm） |
| T-web-2 | `plugins/lead-form.ts` 或 DynamicPage 增强 | 改 | 拦截 LubanForm 提交事件接入 useLeadSubmit + 成功态 |
| — | `utils/utm.ts` | 新建 | 解析 URL utm_* |

#### [ui / luban-low-code] `packages/ui/luban-ui/packages/luban-low-code/`
| Task | 文件 | 新建/改 | 摘要 |
|---|---|---|---|
| T-ui-1 | `src/lib/registry.ts` | 改（确认） | LubanForm 已注册（现状已存在），确认提交事件 |
| T-ui-2 | `src/lib/formSubmit.ts` + schema 增 submitConfig | 新建/改 | 表单提交运行时：emit submit + submitConfig 契约（endpoint/successAction/redirect/message） |
| — | `src/lib/schema.ts` | 改 | NodeSchema.props 增 submitConfig 类型（向后兼容，可选字段） |

### 9.2 API 契约（Java 实现，Go 暂缓按此对齐）

**公开留资**
```
POST /backend/lead/forms/{formId}/submit
 header: X-Forwarded-For, X-Visitor-ID, X-Site-ID
 body: { contact:{phone,email,name,...}, captchaToken?, pageId, channel?, utm? }
 → 200 { leadId, status, dedup:boolean }
   409 LEAD_DUPLICATE (policy=reject)
   429 LEAD_SPAM_BLOCKED
   400 LEAD_CAPTCHA_INVALID / LEAD_VALIDATION_FAILED
   503 LEAD_DISABLED (FeatureGate)
```

**管理端（鉴权，注入 X-User-ID/X-User-Role/X-Site-ID）**
```
GET    /backend/forms?siteId=&pageId=        → Form[]
POST   /backend/forms                         → Form
GET    /backend/forms/{id}                    → Form
PATCH  /backend/forms/{id}                    → Form
GET    /backend/leads?siteId=&status=&page=&size=&from=&to=  → {list,total,page,pageSize}
GET    /backend/leads/{id}                    → Lead (含字段值，phone/email 按权限脱敏)
PATCH  /backend/leads/{id}/status  {status}   → Lead  (状态机校验)
GET    /backend/leads/export?...              → application/vnd.ms-excel 流
```

### 9.3 DDL（沿用 schema.sql，VARCHAR(36) UUID）
```sql
CREATE TABLE IF NOT EXISTS forms (
    id                VARCHAR(36)  PRIMARY KEY,
    site_id           VARCHAR(36)  NOT NULL,
    page_id           VARCHAR(36)  NOT NULL,
    name              VARCHAR(255) NOT NULL,
    field_schema_json JSON         NOT NULL,
    submit_config_json JSON        NOT NULL,
    dedup_keys_json   JSON,
    dedup_window      INT          NOT NULL DEFAULT 86400,
    dedup_policy      VARCHAR(16)  NOT NULL DEFAULT 'reject',
    anti_spam_json    JSON,
    status            VARCHAR(32)  NOT NULL DEFAULT 'active',
    created_at        DATETIME(3)  NOT NULL,
    updated_at        DATETIME(3)  NOT NULL,
    CONSTRAINT fk_forms_site FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT fk_forms_page FOREIGN KEY (page_id) REFERENCES pages(id),
    KEY idx_forms_page (page_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS leads (
    id              VARCHAR(36)  PRIMARY KEY,
    site_id         VARCHAR(36)  NOT NULL,
    form_id         VARCHAR(36)  NOT NULL,
    page_id         VARCHAR(36)  NOT NULL,
    channel_id      VARCHAR(36),
    contact_json    JSON         NOT NULL,   -- phone/email AES 加密
    utm_json        JSON,
    status          VARCHAR(16)  NOT NULL DEFAULT 'new',
    assignee_id     VARCHAR(36),
    dedup_hash      VARCHAR(64)  NOT NULL,
    source_ip       VARCHAR(64),
    visitor_id      VARCHAR(64),
    converted_at    DATETIME(3),
    created_at      DATETIME(3)  NOT NULL,
    updated_at      DATETIME(3)  NOT NULL,
    UNIQUE KEY uk_form_dedup (form_id, dedup_hash),
    CONSTRAINT fk_leads_site FOREIGN KEY (site_id) REFERENCES sites(id),
    CONSTRAINT fk_leads_form FOREIGN KEY (form_id) REFERENCES forms(id),
    KEY idx_leads_site_status (site_id, status),
    KEY idx_leads_assignee (assignee_id, status),
    KEY idx_leads_created (site_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 9.4 物料 schema（LubanForm submitConfig）
```ts
// NodeSchema.props for type=LubanForm（向后兼容，新增可选字段）
interface LubanFormProps {
  fields: Array<{ name:string; type:'input'|'select'|'textarea'|...; label:string; required?:boolean; validate?:object }>;
  submitConfig: {
    successAction: 'redirect'|'popup'|'toast';
    redirectUrl?: string;
    message?: string;
    captcha?: boolean;            // 图形验证码
  };
}
// form.field_schema_json ← fields; form.submit_config_json ← submitConfig + dedup + anti_spam
```

### 9.5 组件/接口
- engine：`useLeads(query)` → `{list,total,loading,error,refetch}`；`LeadList`/`LeadDetail` props/emits
- website：`useLeadSubmit(formId, payload, meta)` → `{ submit, loading, error, result }`
- bff：`antiSpamCheck(ip, formId)` → boolean

### 9.6 并行派发计划（基于 taskGraph dependsOn）
```
第一波（无依赖，并行）：
  - backend-java：领域+schema.sql+去重+防刷+加密（T-be-1..7）  ← 契约源头，最先
  - ui：LubanForm submitConfig 运行时（T-ui-1,T-ui-2）
第二波（依赖后端契约，并行）：
  - bff：forms/leads routes（T-bff-1..4）
  - engine：线索中心（T-eng-2）+ 表单配置（T-eng-3）
第三波（集成，依赖前两波）：
  - website：表单提交接入（T-web-1,T-web-2）
  - E2E：engine-e2e + website-e2e 全用例
收口：
  - G1 /luban-review 清零 → G3 单测覆盖率 → G4 E2E → make test-coverage → 汇报
```

**并行 Task 线**：第一波 backend-java 与 ui 可同时启动；第二波 bff 与 engine 同时；主 agent 负责契约对齐与冲突汇总。

---

## 实现会话声明
进入实现后，在 P0 范围内**连续推进至 §8.3 全部门禁全绿**再做一次完成汇报；禁止"主体完成/先到这"式收口；遇用户决策阻塞或环境硬限制时列出残余项。
