---
featureId: luban-editor-wave1
title: Luban 编辑器第1波 — 核心增强 + 低代码三要素
createdAt: 2026-06-19
status: approved
taskGraph: docs/superpowers/tasks/luban-editor-wave1.json
contractSource: plan-template 命令体 + writing-plans SKILL + PLAN_WRITING_CONTRACT.md
scope: 编辑器交互四件套 + 数据/事件/动态渲染三要素 + 6 物料；样式面板延后
split: 单 plan 单期收口(W1-T1~T6)；W1-T7 样式面板显式延后第1.5波
branches: 各子仓 feature/luban-editor-wave1 同名分支
---

# Luban 编辑器第1波 — 核心增强 + 低代码三要素

> **验收口径(MUST)**：真实用户在编辑器中能完成 `撤销/重做 → 跨容器拖拽 → 绑定数据源 → 写表达式 visible/loop → 配事件动作 → 拖入 Table 看到数据` 全链路；五端覆盖率达标；双后端 datasource 行为一致；无骨架/占位/假绿。基于刚合并 master（T1/T2/T4 delivery-program 已完成）继续。

---

## §0 程序概览

luban 当前是"留资导向轻量搭建器"（编辑器 MVP、14 物料、无双后端数据源/事件/动态渲染）。本波补全**编辑器交互** + **低代码三要素（数据/事件/动态渲染）** + **6 核心物料**，使其具备通用低代码平台能力。`branchStrategy: feature/luban-editor-wave1`。

## §1 需求溯源（gap→task 矩阵）

| Gap（证据） | 层级 | task | E2E 场景 | 门禁 |
|---|---|---|---|---|
| 无撤销/重做（grep `undo\|history` 仅 vue-router） | L0 | W1-T3 | 撤销恢复 schema | G3/G4 |
| 无快捷键（grep `keydown` 空） | L0 | W1-T3 | Ctrl+S/Z/Y/Del | G4 |
| Sortable 无 group，跨容器拖拽失效（LubanDesigner.vue:67-75） | L0 | W1-T3 | 节点跨容器迁移 | G4 |
| 无 lock/hide（NodeSchema 无字段） | L1 | W1-T3 | 锁定节点不可拖/删 | G3 |
| 无数据源/表达式引擎/全局变量（grep `datasource\|expression` 空） | L0 | W1-T1/W1-T2 | 绑 API 到 Table | G3/G4 |
| 物料 events 运行时悬空（RuntimeRenderer 仅 form.submit） | L0 | W1-T4/W1-T5 | click 触发动作 | G4 |
| 无条件/循环渲染（grep `visible\|loop` 空） | L1 | W1-T4 | visible false 不渲染 / loop 多次 | G4 |
| 缺 Table/Menu/Tabs/Modal/Drawer/Toast（materials/ 无） | L1 | W1-T6 | Table 绑数据渲染 | G3 |
| NodeSchema 双定义 drift（engine schema.d.ts vs low-code schema.ts） | L0 | W1-T1 | single source 收口 | G3 |

无遗漏：所有探针 gap 映射到 W1-T1~T6。

## §2 系统与链路

**涉及子系统**：engine（编辑器+运行时）/ luban-low-code（NodeSchema+渲染器+Sortable）/ luban-ui（6 物料）/ bff（datasource 代理+外部 API 代理）/ Java 后端（datasource 表+CRUD+Flyway）/ Go 后端（同）。

**数据驱动主链路**：
```
用户配置 datasource(API: baseUrl+headers) → 存后端 datasources 表(双端)
  → 编辑器 PropertyPanel 选 datasource 绑到 Table → node.datasource={id,varName}
  → 预览/发布 → LubanPage 顶层拉 datasource query(bff 代理透传 X-User-*)
  → 注入表达式上下文 → RuntimeRenderer 按 node.visible/loop 求值渲染
  → Table v-for loop 渲染数据行 → node.events click 触发动作(跳转/弹窗/调API/设变量)
```

**datasource CRUD 链路**（列表分步）：
1. PropertyPanel 数据源区 → 点"管理数据源" → 弹层 GET /api/datasources（bff→后端）
2. 新建 → POST /api/datasources {siteId,name,type,config} → 201 或 409 NAME_CONFLICT
3. 测试连通 → POST /api/datasources/:id/test → {ok,message,latencyMs}
4. 选中绑定 → 写 node.datasource → 撤销栈记录

## §3 业务逻辑

**datasource 状态机**：无独立状态机（CRUD 实体）。`type` 枚举 `static|api`（白名单校验，非法→INVALID_ARGUMENT 400）。
**事务边界**：datasource CRUD 单表，无跨表事务。删除 datasource 不级联清 node.datasource 引用（运行时缺失→空数据+警告，不崩）。
**业务规则**：(site_id, name) 唯一（uk_datasources_site_name）；写操作 admin-only；slug 式 name 冲突→409。
**表达式沙箱规则**：仅允许属性访问/比较/算术/逻辑/三元；禁 `eval/Function/new/this/window/import`；AST 白名单求值。

## §4 页面结构

### §4.0 入口表
| 路由 | 视图 | 状态 |
|---|---|---|
| /sites/:siteId/pages/:pageId/edit | PageEditor（三栏+撤销/快捷键） | 重做 W1-T3 |
| PropertyPanel 数据源区 | 内嵌弹层 | 新增 W1-T5 |
| PropertyPanel 事件区 | 内嵌 | 新增 W1-T5 |

### §4.2 编辑器主交互链（增强后）
1. 拖物料→画布（root 或容器内，跨容器可迁移）→ pushHistory
2. Ctrl+Z 撤销 / Ctrl+Shift+Z 或 Ctrl+Y 重做 / Ctrl+S 保存 / Del 删选中 / Ctrl+D 复制
3. 选中节点→属性面板：基础/样式(延后)/事件/数据源 四区
4. 数据源区→选 datasource+varName→写 node.datasource
5. 事件区→按 meta.events 配动作表达式→写 node.events
6. 预览→RuntimeRenderer 按 visible/loop/datasource/events 渲染
7. 锁定节点(L)→不可拖/删/改；隐藏节点(H)→编辑态不渲染保留 schema

### §4.3 逐页结构（PropertyPanel 增强后）
```
┌─属性面板─────────────────────┐
│ [基础] [事件] [数据源]  ← 分区 │
├──────────────────────────────┤
│ 基础: 按 propsSchema(string/  │
│  number/boolean/select/json)  │
├──────────────────────────────┤
│ 事件: onClick ▼ [跳转/弹窗/   │
│  调API/设变量] 动作表达式___   │
├──────────────────────────────┤
│ 数据源: [选择▼] varName___     │
│  [管理数据源] [测试连通]       │
└──────────────────────────────┘
```
四态：加载(v-loading)/空(未选中提示)/错(表达式/连通失败+重试)/成功。

## §5 集成与复用
| 复用件 | 提供方 | 消费方 | 契约 |
|---|---|---|---|
| NodeSchema(扩展) | W1-T1(low-code) | T3/T4/T5/engine | visible/loop/events/datasource/locked/hidden 字段 |
| 表达式引擎 | W1-T1(low-code) | T4/T5 | evaluate(expr, ctx) 沙箱 |
| datasource API | W1-T2(双后端) | bff/engine | CRUD+test，X-User-* 透传 |
| useHistory/useKeyboard | W1-T3(engine composables) | PageEditor | undo/redo/push + 快捷键 |
| 6 物料 | W1-T6(ui) | engine/website | defineMaterial + propsSchema |

## §6 架构边界 + 门禁

### §6.1 分层
- 表达式引擎/datasource 定义：low-code canonical schema + engine 消费
- datasource 持久化：后端双端，bff 透传，无业务逻辑
- 外部 API 代理：bff 新建 proxy route + **SSRF 白名单防护**（无先例，必须新建）

### §6.2 双后端 parity（datasource）
| 接口 | Java | Go | 目标 |
|---|---|---|---|
| GET/POST/PUT/DELETE /datasources | 新建 | 新建 | 双端字段一致 |
| POST /datasources/:id/test | 新建 | 新建 | {ok,message,latencyMs} 一致 |
| 错误码 DATASOURCE_NOT_FOUND/DATASOURCE_NAME_CONFLICT/DATASOURCE_CONNECTION_FAILED | BusinessException | errors.go+error.go | 一致 |

### §6.3 覆盖率门禁
engine/bff/website 85% · UI 90% · Java 80% · Go 75%（make test-coverage 汇总）

### §6.4 物料 schema
defineMaterial({name,version,category,propsSchema(JSON Schema 含 default),events[],slots[]}) + materials/<category>/<name>/

### §6.5 FeatureGate
| 功能 | key | 作用域 | 关闭行为 |
|---|---|---|---|
| 撤销/重做 | editor.undo | engine | 隐藏撤销按钮 |
| 快捷键 | editor.shortcuts | engine | 不绑 keydown |
| 跨容器拖拽 | editor.cross_container_drag | low-code | 回退 root 级排序 |
| 数据源 | editor.datasource | engine+bff | 隐藏数据源区 |
| 表达式/条件/循环 | runtime.expression | low-code | 当字面量处理 |
| 事件编排 | editor.events | engine | 隐藏事件区 |
| 6 物料 | material.<name> | ui | 不注册 |

## §7 E2E（Playwright 绑正式路由 /sites/:siteId/pages/:pageId/edit）
1. 主链路：登录→建页→拖 Table→配 datasource→写 visible 表达式→配 click 事件→预览见数据→发布
2. 撤销/重做：拖3节点→Ctrl+Z×3→断言空→Ctrl+Y→断言恢复
3. 跨容器拖拽：Row>Col 内节点拖到另一 Col→断言迁移
4. 多租户隔离：A 站点 datasource B 站点不可见（GET /datasources 按 siteId 过滤）
- 路由合规：全正式路由，无 pages/e2e/* 新增
- 脚本保障：首失败即停/禁假绿/环境预检(MySQL+Java或Go+BFF)

## §8 TDD + 执行
- TDD：表达式引擎/撤销栈/datasource 双端 先单测红→绿
- 并行：W1-T1/T2/T3/T6 独立可并行；T4 等 T1；T5 等 T1/T2
- 单期收口：W1-T1~T6 单次实现周期全完成
- Post-Dev：代码提交→**/luban-review 清零**→编译→单测覆盖率→E2E(询问用户)→make test-coverage→汇报
- 验证门：engine `pnpm test && pnpm build` / ui `pnpm test` / bff `pnpm test && pnpm build` / java `mvn -q verify` / go `go test ./... -race -cover`

## §9 实现任务派发（基于 §9 subagent 调研）

### §9.1 文件变更总览（关键）
**engine**：`src/composables/useHistory.ts`(新) `useKeyboard.ts`(新) `src/views/page/PageEditor.vue`(接 history/keyboard/跨容器) `components/PropertyPanel.vue`(两新分区:事件/数据源) `components/ComponentTree.vue`(lock/hide 图标) `components/schemaTree.ts`(跨 parent move) `src/api/datasource.ts`(新) `src/types/schema.d.ts`(删,改 re-export low-code)
**luban-low-code**：`src/lib/schema.ts`(NodeSchema +visible/loop/events/datasource/locked/hidden) `src/lib/RuntimeRenderer.vue`(条件/循环/事件/datasource注入) `src/lib/DesignRenderer.vue`(lock/hide 过滤) `src/lib/LubanDesigner.vue`(Sortable group) `src/lib/expression.ts`(沙箱,新,共享,engine 仅消费导入)
**luban-ui**(实际落点: luban-ui monorepo → luban-low-code 子包)：`packages/luban-low-code/src/materials/{data-display/table,navigation/menu,tabs,feedback/modal,drawer,toast}/material.ts`(6新) + `index.ts` 注册
**bff**：`src/app/api/datasources/route.ts` `[id]/route.ts` `[id]/test/route.ts` `query/route.ts`(新) `src/app/api/proxy/fetch/route.ts`(SSRF 白名单,新) `src/lib/backendClient.ts`(复用)
**Java**：`db/migration/V20260619000001__add_datasources.sql` `entity/Datasource.java` `dto/{DatasourceSaveRequest,DatasourceResponse,DatasourceTestResult}.java` `mapper/DatasourceMapper.java` `service/DatasourceService.java` `controller/DatasourceController.java` `exception/BusinessException.java`(+3工厂) `auth/AuthFilter.java`(+ADMIN_DATASOURCES) `test/.../DatasourceContractTest.java`
**Go**：`dao/mysql.go`(+datasources DDL) `internal/model/datasource.go` `internal/repository/{datasource_repo.go,errors.go(+2)}` `internal/service/datasource_service.go` `internal/handler/{datasource_handler.go,error.go(+2case)}` `router/router.go`(+组装) + 对应 _test.go

### §9.2 API 契约（datasource，双端一致）
基础前缀 /backend。鉴权：全 RequireUser；写 RequireAdmin。
- GET /datasources → 200 []（按 siteId 过滤，多租户）
- POST /datasources {siteId,name,type(static|api),config} → 201 | 409 DATASOURCE_NAME_CONFLICT | 404 SITE_NOT_FOUND | 400 INVALID_ARGUMENT
- GET /datasources/:id → 200 | 404 DATASOURCE_NOT_FOUND（GET/PUT/DELETE `:id` 可带 `?siteId=` 多租户守卫，required=false）
- PUT /datasources/:id → 200 | 404 | 409 DATASOURCE_NAME_CONFLICT
- DELETE /datasources/:id → 204 | 404 DATASOURCE_NOT_FOUND
- POST /datasources/:id/test → 200 {ok,message,latencyMs} | 503 DATASOURCE_CONNECTION_FAILED
- POST /datasources/:id/query → 200 {data,status} | 400 INVALID_ARGUMENT | 502 DATASOURCE_UPSTREAM_ERROR | 504 DATASOURCE_UPSTREAM_TIMEOUT（**BFF-orchestrated, no backend route**；先 GET 后端 datasource 配置，再由 BFF 发起 SSRF 防护后的出站 fetch）
字段：id/siteId/name/type/config(object)/createdAt/updatedAt。Java record+@JsonFormat；Go struct+json tag；config 存 JSON（Java String/Go json.RawMessage）。

### §9.3 DDL（datasources，双端一致）
```sql
CREATE TABLE datasources (
  id VARCHAR(36) PRIMARY KEY, site_id VARCHAR(36) NOT NULL,
  name VARCHAR(255) NOT NULL, type VARCHAR(32) NOT NULL, config_json JSON NOT NULL,
  created_at DATETIME(3) NOT NULL, updated_at DATETIME(3) NOT NULL,
  UNIQUE KEY uk_datasources_site_name (site_id, name),
  CONSTRAINT fk_datasources_site FOREIGN KEY (site_id) REFERENCES sites(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```
Java Flyway: `V20260619000001__add_datasources.sql`；Go: `dao/mysql.go` initSchema 追加 IF NOT EXISTS 版。

### §9.4 物料 schema（6 个，见 W1-T6 落地时逐个 defineMaterial）
Table(data-display): columns[]/datasource/events(rowClick) · Menu(nav): items[]/mode · Tabs(nav): tabs[]/active · Modal(feedback): title/visible/width · Drawer(feedback): title/visible/placement · Toast(feedback): message/type/duration

### §9.5 组件接口
- useHistory<T>(current:Ref<T>): {undo,redo,canUndo,canRedo,push,reset}
- useKeyboard(handlers:{undo,redo,delete,save,duplicate}): 输入态屏蔽
- evaluate(expr:string, ctx:object):unknown（沙箱，禁 eval/Function）
- LubanDesigner/DesignRenderer：emit `move-node(nodeId,fromParentId,toParentId,idx)`

### §9.6 并行派发计划
- Wave0 并行：W1-T1(表达式+schema) ∥ W1-T2(datasource 双后端+bff) ∥ W1-T3(编辑器交互) ∥ W1-T6(6物料)
- Wave1：W1-T4(RuntimeRenderer 动态渲染,依赖T1) → W1-T5(PropertyPanel,依赖T1/T2)
- 主会话串行落盘 plan/taskGraph；实现阶段各线独立可验收

## §10 明确不做（防膨胀）+ 显式延后
**本期不做**（用户确认范围外，非静默跳过）：协作编辑/CRDT(第4波) · 出码/导出(第3波) · 模板库/区块库(第3波) · 版本历史/回滚/灰度(第3波) · i18n/主题切换(第3波) · 自定义物料上传/物料市场(第4波) · zoom/标尺/对齐线/多选/右键(第2波) · **样式属性面板(W1-T7,延后第1.5波,todo 见 `.agents/todos/2026-06-19-w1-t7-style-panel.md`)**

## 质量禁令 14 条自检
- [x]1 禁跳过功能(gap 全映射) - [x]2 禁假绿(E2E 真实) - [x]3 禁占位 - [x]4 禁骨架 - [x]5 禁JSON代页面 - [x]6 交互完整(§4.2) - [x]7 验收=可交付链路 - [x]8 E2E绑正式路由 - [x]9 门禁分级(G1-G4) - [x]10 /luban-review清零 - [x]11 安全(SSRF/沙箱/敏感字段) - [x]12 双后端一致 - [x]13 多端一致 - [x]14 FeatureGate

## 分级验收门禁
| 级 | 验证 | 通过 | 责任 |
|---|---|---|---|
| G1 | /luban-review | 🔴🟡🔵 全清零 | owner |
| G2 | OWASP自查+敏感字段+SSRF白名单+沙箱 | 无高中危 | owner |
| G3 | pnpm test/mvn verify/go test -race -cover | 达 §6.3 | owner |
| G4 | Playwright 主链路(正式路由) | 全绿无skip | owner |

## 敏感字段
datasource.config.headers(可能含凭证)→禁止入日志/响应透传; JWT secret 环境变量; X-User-* 内网不外泄(代理第三方时不透传)。

## 回滚
datasource 新功能→关 FeatureGate(editor.datasource/runtime.expression/editor.events); Flyway→手动回滚 SQL(staging 先验); NodeSchema 扩展→字段全 optional 向后兼容(已发布 page 不崩)。

## Post-Dev Workflow
代码提交→/luban-review 清零→编译→单测覆盖率→询问用户跑 E2E→make test-coverage→完成汇报。实现会话须一次推进至验证全绿后汇报,禁主路径收口即宣称完成。
