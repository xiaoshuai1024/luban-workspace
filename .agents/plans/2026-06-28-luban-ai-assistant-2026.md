---
featureId: luban-ai-assistant-2026
title: Luban AI 助手 2026 — FastAPI+LangGraph+Qdrant+LiteLLM+BFF反代
createdAt: 2026-06-28
status: approved
taskGraph: docs/superpowers/tasks/luban-ai-assistant-2026.json
contractSource: writing-plans SKILL + PLAN_WRITING_CONTRACT.md + 2026-06-28-ai-assistant-design.md(spec)
scope: 独立 Python AI 子项目(FastAPI+LangGraph+Qdrant+LiteLLM SDK) + BFF 反代 /api/ai/* + engine AI 面板/模型配置 + website C 端助手
split: 单 plan(本期一次性收口 B 端核心链路 + C 端基础;设计稿转页面多模态显式延后)
branches: ai 子仓 feature/luban-ai-2026；engine/bff/website 子仓 feature/luban-ai-2026 同名分支
---

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> 正按 `writing-plans` + `PLAN_WRITING_CONTRACT` 输出。技术选型 SSOT = `docs/superpowers/specs/2026-06-28-ai-assistant-design.md`。本 plan **替代并废弃** `2026-06-19-luban-ai-assistant-program/plan1`(已标 implemented 但 packages/ai 实为空目录,未真正落地)。

**Goal:** 为 luban 低代码平台建独立 Python AI 服务(FastAPI+LangGraph+Qdrant+LiteLLM),通过 BFF 反代集成,服务 B 端运营(配置页面)与 C 端访客(功能辅助)。

**Architecture:** AI 服务作为 BFF 下游(:8100),工具调用回环 BFF 享受双后端契约抹平;不新增网关,BFF 作唯一入口;SSE 流式;模型走 LiteLLM SDK 内嵌(DeepSeek 首选,后台可热切 GLM/通义);Qdrant 向量库支撑 RAG。

**Tech Stack:** Python 3.11 + uv / FastAPI + Uvicorn+Gunicorn / LangGraph / LiteLLM SDK / Qdrant / LangChain Retriever + 通义 embedding / Next.js BFF(Route Handler SSE 透传)/ Vue3 engine + Nuxt3 website

---

## §0 概览

为 luban 低代码平台建独立 AI 助手子项目 `luban-ai-assistant`(Python 核心 + Vue3/Nuxt3 前端集成),复用既有空 submodule 目录 `packages/ai/luban-ai-assistant`(当前空,默认分支 main)。本期交付:自然语言建/改页面、查/改线索、批量/发布、AI 引导、模型后台热切换、BFF 反代集成、engine AI 面板、website C 端基础助手。**设计稿转页面多模态显式延后**(§10)。

**技术选型(用户多轮确认锁死,详见 spec §0,勿再讨论)**:Python 3.11 + uv / FastAPI(SSE) / LangGraph(状态图+checkpoint+HITL) / **LiteLLM SDK 内嵌**(非 proxy;DeepSeek 首选,后台可切 GLM/通义) / **Qdrant**(向量库,远端服务模式+本地嵌入式兜底) / LangChain Retriever + 通义 text-embedding-v3 / instructor+Pydantic v2(应用层逼近合法) / **BFF 反代 `/api/ai/*`**(SSE chunk 透传,服务间 X-Internal-Token,不新增网关) / 复用 luban settings 表存 ai_model_config。

**与旧方案核心差异(本期替代 2026-06-19 旧 plan)**:
| 维度 | 旧方案(废弃) | 本期 |
|---|---|---|
| 模型切换 | 自写 Provider 适配层 | **LiteLLM SDK** |
| 向量库 | Milvus+MinIO+etcd+PG(6 容器) | **Qdrant**(单二进制/嵌入式) |
| 集成入口 | 前端直连 AI 服务(共享 JWT) | **BFF 反代** `/api/ai/*` |
| 范围 | 仅 B 端编辑器 | **B 端 + C 端** |
| 复杂度 | 6 容器 compose 无 GPU | **轻量**:AI 服务 + Qdrant 两件 |

---

## §1 需求溯源(gap→task 矩阵)

| Gap(证据) | 层级 | task | E2E 场景 | 门禁 |
|---|---|---|---|---|
| 无 AI 助手(packages/ai/luban-ai-assistant 空目录,旧 plan 标 implemented 但未落地) | L0 | T1~T9 | 全链路 | G3/G4 |
| 无模型可切换能力(用户要 DeepSeek/GLM/通义 后台热切换) | L0 | T2 | J-ai-model-switch | G3 |
| 无 RAG 检索(AI 须知道物料/产品文档) | L0 | T3 | — | G3 |
| 无 Agent 编排(自主多步+工具调用回环) | L0 | T4 | J-ai-b-config | G3 |
| 无流式输出(SSE)+ 输入防护 | L0 | T5 | J-ai-b-config | G3 |
| BFF 无 AI 反代路由(旧 plan §7 明确"不涉 BFF",本期核心改动) | L0 | T6 | J-ai-b-config | G3 |
| engine 无 AI 面板 | L0 | T7 | J-ai-b-config | G3/G4 |
| 无后台模型配置 UI + website 无 C 端助手 | L1 | T8 | J-ai-c-assist | G3/G4 |
| 无端到端验证 + 旧方案未归档 | L0 | T9 | 全旅程 | G4 |

无遗漏:用户确认的能力 ①建/改页面→T4/T7,②模型切换→T2/T8,③引导+辅助→T5/T7/T8,④B+C 双端→T7/T8;设计稿转页面显式延后(§10)。

---

## §2 系统与链路

**涉及子系统**:luban-ai-assistant(Python,新)/ bff(改:加 /api/ai/*)/ engine(改:AI 面板+设置页)/ website(改:C 端助手)。**不动 Java/Go 后端**(AI 经 BFF 间接访问业务)。

**各子系统增量**:
- **ai**:FastAPI 应用(LiteLLM 抽象/Qdrant RAG/LangGraph Agent/SSE 端点/guardrails/JWT 自验/healthz)
- **bff**:新增 `src/app/api/ai/[...path]/route.ts`(SSE 反代 + X-Internal-Token)
- **engine**:`AiAssistantPanel.vue` + `useAiChat`(SSE 客户端) + 设置页模型配置区块 + FeatureGate
- **website**:C 端 `AiAssistant.vue` + `useAiChat` composable(ClientOnly)

**主链路(运营自然语言配置页面)**:
```
运营在 PageEditor 打开 AI 面板 → 输入"给这个表单加手机号必填项"
  → engine fetch SSE POST /api/ai/chat (Bearer JWT) → BFF 校验 JWT
  → BFF 反代到 AI:8100/chat (附加 X-Internal-Token, chunk 透传)
  → AI 服务验 JWT + X-Internal-Token → LangGraph agent:
      意图识别(改属性) → RAG 检索相关物料(Form/Input 规则)
      → 工具调用回环: 调 BFF GET /api/sites/:sid/pages/:pid 取当前 schema
      → LiteLLM 调 DeepSeek 生成 patch → Pydantic 校验闸
      → SSE 流式回传 patch + 进度
  → engine HITL 确认 → 应用 patch 到画布 + history.push(可撤销)
  → 用户 Ctrl+S 持久化(复用 engine 现有 savePage)
```

**模型热切换链路**:
```
运营在 设置页 改 provider=glm → PUT /api/settings (BFF→Java 落库)
  → AI 服务下次请求读 settings(30s 短缓存) → LiteLLM 路由到 GLM → 全链路不变
```

**C 端访客助手链路**:
```
访客在 website 点 AI 助手 → 输入"这个产品怎么预约"
  → website SSE POST /api/ai/chat (访客 token, 限 RAG 问答, 禁工具调用)
  → BFF 反代 → AI 服务 LangGraph(仅 RAG 节点, 不进工具调用节点)
  → 流式回答 + 推荐填表
```

---

## §3 业务逻辑

**会话状态机**:`idle → generating → awaiting_confirm → applied | rejected | failed`
- generating:agent 执行中(SSE 流式)
- awaiting_confirm:HITL(整页生成/覆盖/删除/批量/发布 须确认;单属性编辑免确认)
- applied:落地画布;rejected:用户拒绝;failed:校验失败回环超限

**事务边界**:AI 生成的是"待确认 patch",确认后才写 PageEditor 局部 schema + history.push;持久化(savePage)仍是用户手动 Ctrl+S。AI 服务侧 checkpoint 记 agent 状态(可恢复),不直接写 luban 业务库。工具调用回环 BFF 时,AI 服务带身份标识供审计。

**关键业务规则**:
- AI 生成的 NodeSchema.type 必须是 materialRegistry 已注册物料(校验闸)
- props 须符合该物料 propsSchema(校验闸)
- 表达式(visible/loop/events)须符合 luban 沙箱规则(禁 eval/Function/new,AST 白名单对齐 engine expression.ts)
- 新节点 id 用 uuid
- **C 端访客禁工具调用**:仅 RAG 问答,无写权限(鉴权层按 role 拦截)
- HITL 粒度:整页/覆盖/删除/批量/发布→确认;单属性→直接应用

**错误场景(每功能≥3 种)**:
- 校验失败回环:LLM 产非法 schema → 回环重试≤N → 超限降级提示
- LLM 超时:LiteLLM fallback 到备选厂商(GLM→通义→DeepSeek)
- 工具调用回环失败:BFF 返错 → agent 反馈给用户 + 不落地
- 鉴权失败:JWT 过期/无效 → 401;访客尝试写操作 → 403

---

## §4 页面结构(含 UI,MUST)

### §4.0 入口表
| 路由 | 视图 | 端 | 状态 |
|---|---|---|---|
| /sites/:siteId/pages/:pageId/edit | PageEditor(+ AI 抽屉) | engine | 改动 T7 |
| /settings(或现有设置入口) | SettingsPage(+ AI 模型配置区块) | engine | 改动 T8 |
| /:site/:path(C 端任意页) | DynamicPage(+ AI 助手浮窗) | website | 改动 T8 |

### §4.1 信息架构
- B 端 AI 面板:右侧抽屉,对话+引导双 tab,消息流+待确认预览
- 设置页:现有设置项下新增"AI 模型配置"分区
- C 端:右下角悬浮按钮 → 弹出对话窗(ClientOnly)

### §4.2 B 端 AI 面板主交互链(分步)
1. 点工具栏 AI 图标 → 抽屉展开(FeatureGate `ai_assistant_enabled` 关则隐藏)
2. 输入需求 → 发送 → 流式显示 agent 进度("正在检索物料…正在生成…")
3. 生成完成 → 展示待确认 schema 预览(树形/JSON 可切换,**非纯 JSON dump**)
4. 整页/覆盖/批量/发布 → [应用][拒绝] HITL;单属性 → 直接应用+toast
5. 应用 → 画布渲染变更 + 入撤销栈(Ctrl+Z 可撤销 AI 改动)
6. 引导态:空输入时 AI 主动给"下一步建议"(读当前 schema)

### §4.3 B 端 AI 面板结构(逐页)
```
┌─AI 助手(右侧抽屉)──────────────┐
│ [对话] [引导]  ← 模式 tab        │
├────────────────────────────────┤
│ 消息流:                         │
│  user: 给表单加手机号必填项      │
│  ai: 🔍 检索到 Form/Input…(进度) │
│  ai: ✅ 生成待确认 [预览]        │
│      ┌ schema 预览(树形) ┐       │
│      │ Form                │     │
│      │ └ Input(手机号,必填)│     │
│      └────────────────────┘     │
│      [应用到画布] [拒绝]          │
├────────────────────────────────┤
│ 输入框___________ [发送]         │
│ 模型: DeepSeek-V3 ▼ (只读展示)    │
└────────────────────────────────┘
```
四态:加载(流式 spinner)/空(引导建议)/错(校验失败+重试/降级)/成功(预览+确认)。

### §4.3 设置页 AI 模型配置区块
```
┌─AI 模型配置─────────────────────┐
│ 服务商: [DeepSeek ▼]             │  ← 下拉: DeepSeek/智谱GLM/通义
│ 模型:   [deepseek-chat ▼]        │  ← 跟随服务商联动
│ Temperature: [0.7] ───●─────     │
│ API Key: [••••••••••] [测试]     │  ← 脱敏显示, 测试按钮冒烟调用
│            [保存]                 │
└────────────────────────────────┘
```

### §4.3 C 端 AI 助手浮窗
```
                    ┌─AI 助手──────────┐
                    │ 消息流(仅问答)    │
                    │ user: 怎么预约     │
                    │ ai: 您可以…        │
                    ├──────────────────┤
                    │ 输入___ [发送]    │
                    └──────────────────┘
                              [💬](悬浮按钮)
```

### §4.4 UX 自检
- 四态齐全(加载/空/错/成功)
- 模型选择前端只读展示当前部署模型(C 端不显示模型)
- API Key 脱敏(`sk-****abcd`),禁明文
- 对齐 docs/UI_SPEC.md 设计 token,不凭空发明

---

## §5 集成与复用表

| 复用件 | 提供方 | 消费方 | 契约 |
|---|---|---|---|
| PageSchema/NodeSchema | luban-low-code schema.ts(既有) | T4 Pydantic 对齐 | {root:NodeSchema};Node id/type/props/children/visible/loop/events |
| 物料清单 | luban-ui materialRegistry(既有) | T3 RAG 同步入库 | getAll()→name/version/category/description/propsSchema |
| 画布操作 | PageEditor onAddNode 等(既有) | T7 收口 usePageEditorApi | add/updateProp/delete/applyPatch/pushHistory |
| JWT 鉴权 | luban AUTH_JWT_SECRET(既有) | T4 AI 服务自验 | payload {sub,username,role};AI 读同密钥验签 |
| 撤销栈 | engine useHistory(既有) | T7 | AI 变更 push 入栈 |
| 表达式沙箱规则 | luban expression.ts(既有) | T4 规则校验(不执行) | AST 白名单(禁 eval/Function/new/this/window/import) |
| luban settings 表 | Java 后端(既有) | T2 存 ai_model_config | 复用 PUT /api/settings,key=ai_model_config |
| BFF 鉴权中间件 | BFF parseTokenFromRequest(既有) | T6 反代前校验 | payload.sub/role 注入 X-User-* header |

---

## §6 架构边界 + 门禁

### §6.1 分层
- **AI 大脑**:luban-ai-assistant(Python)—— 理解/检索/生成/校验/HITL,不碰 luban 业务库
- **业务入口**:BFF —— /api/ai/* 反代 + 服务间鉴权 + SSE 透传,不做 AI 逻辑
- **前端手足**:engine/website —— 流式消费 + 画布落地 + 撤销栈
- **边界**:SSE 契约 + JWT(前端→BFF)+ X-Internal-Token(BFF→AI)

### §6.2 双后端 parity
**不适用**:Python AI 服务无 Java/Go。AI 经 BFF 间接访问业务,享受既有双后端契约抹平。本期不动 Java/Go。

### §6.3 覆盖率门禁
- AI 服务(python pytest):**85%**
- engine:**85%**(不退化)
- bff:**85%**
- website:**85%**
- `make test-coverage` 汇总(Python 仓单独 `pytest --cov`)

### §6.4 物料 schema
不新增物料。AI 生成须符合既有 propsSchema(T4 校验闸强制)。

### §6.5 FeatureGate
| 功能 | key | 作用域 | 关闭行为 |
|---|---|---|---|
| B 端 AI 面板 | ai_assistant_enabled | engine | 隐藏 AI 图标/抽屉,编辑器回归原状 |
| C 端 AI 助手 | ai_visitor_assistant_enabled | website | 隐藏悬浮按钮 |
| AI 工具调用 | ai.tool_calling | ai 服务 | /chat 仅 RAG 问答,禁写操作 |
| AI 模型配置 | ai_model_config | engine settings | 隐藏配置区块 |

---

## §7 E2E 测试计划

### §7.0 用户旅程覆盖声明(MUST)
| 旅程 id | 标题 | 优先级 | 场景 | 入口端 |
|---------|------|--------|------|--------|
| J-ai-b-config | 运营 AI 配置页面 | P0 | 建/改页面、查/改线索、批量/发布 | engine |
| J-ai-c-assist | 访客 AI 使用辅助 | P1 | 产品问答、表单辅助 | website |
| J-ai-model-switch | 后台模型热切换 | P0 | DeepSeek/GLM/通义 切换 | engine |

(已同步 taskGraph JSON `journeys[]`。P0 旅程须有 spec 绑定 `@J-xxx`。)

### §7.1 主路径(绑正式路由,禁 pages/e2e/*)
**engine E2E**(Playwright,正式路由 `/sites/:siteId/pages/:pageId/edit`):登录→打开 AI 面板→自然语言"做用户列表页"→流式→确认→落地画布有 Table→Ctrl+Z 撤销→模型切换设置→再次生成成功。
**website E2E**:访客访问→点 AI 助手→产品问答→断言流式回答。

### §7.2 脚本保障
- 首个失败即停(修当前红,非提前收工)
- 禁假绿:禁 skip/空断言;AI 服务侧 LLM 调用用 mock,冒烟才用真实 API
- 环境预检:AI 服务 + Qdrant + BFF + Java 起齐才跑;缺服务明确报错
- 对齐 luban-e2e-execution-contract.md

### §7.3 用例(节选)
| 场景 | 旅程 | 前置 | 操作与断言 | 清理 |
|---|---|---|---|---|
| 生成页面 | J-ai-b-config | 登录+建空页 | 发"用户列表页"→流式→确认→断言画布有 Table | 删页 |
| 模型切换 | J-ai-model-switch | 三家 key 配好 | 设置页切 provider 三次冒烟生成→断言均成功 | - |
| 撤销 AI 改动 | J-ai-b-config | 已应用 AI 生成 | Ctrl+Z→断言画布回退 | - |
| 校验失败回环 | J-ai-b-config | mock LLM 产非法 schema | 断言回环重试→超限降级提示 | - |
| 多租户隔离 | J-ai-b-config | A/B 两用户 | A 会话 B 不可见 | 删会话 |
| C 端问答 | J-ai-c-assist | 访客访问 | 点助手→问"怎么预约"→断言流式回答 | - |
| C 端禁写 | J-ai-c-assist | 访客 token | 尝试"帮我建页面"→断言被拒(仅问答) | - |

### §7.4 路由合规
engine E2E 全走正式路由 `/sites/:siteId/pages/:pageId/edit` + `/settings`,**无新增 pages/e2e/***。website 走正式 DynamicPage 路由。

---

## §8 TDD + 执行约定

- **TDD**:LiteLLM 抽象/schema 校验/RAG/LangGraph 节点/guardrails/反代透传 先单测红→绿;engine 画布收口先测
- **并行**:Wave0 T1→T2;Wave1 T3;Wave2 T4→T5;Wave3 T6→(T7);Wave4 T8;Wave5 T9 联调。ai 服务线 ∥ engine 线(T7 等 T6 契约冻结)
- **单期收口**:T1~T9 单次实现周期全完成,禁分期
- **验证门**:
  - AI 服务:`uv run pytest --cov --cov-fail-under=85` + `uv run ruff check && uv run mypy app`
  - BFF:`pnpm test`(覆盖率≥85%)
  - engine:`pnpm test && pnpm build`(零 console error,覆盖率≥85%)
  - website:`pnpm test`(覆盖率≥85%)
  - 全栈:`make test-coverage`

### §8.5 Post-Development Workflow(MUST)
```
代码提交 → /luban-review 清零(🔴🟡🔵) → 编译(ai ruff/mypy, engine/bff pnpm build)
  → 单测覆盖率(ai pytest 85%, engine/bff/website 85%) → 询问用户跑 E2E(Playwright + 三家冒烟)
  → make test-coverage 汇总 → 完成汇报
```

---

## §9 实现任务派发

> 本 plan 为新建 Python 子项目 + 跨子系统改动。§9 基于既有调研(SYSTEM_ARCHITECTURE/spec)+ 新项目文件结构设计。

### §9.1 文件变更总览

**luban-ai-assistant(Python,新建)**:
`pyproject.toml`(uv) · `.env.example` · `app/main.py`(FastAPI) · `app/core/config.py`(pydantic-settings) · `app/core/logging.py`(结构化日志) · `app/api/health.py` · `app/api/chat.py`(SSE) · `app/api/config.py`(模型配置只读端点) · `app/llm/provider.py`(LiteLLM 封装+配置驱动切换) · `app/rag/retriever.py`(LangChain Retriever+Qdrant) · `app/rag/sync_materials.py`(物料知识同步) · `app/rag/embeddings.py`(通义 text-embedding-v3) · `app/agent/graph.py`(LangGraph 状态图) · `app/agent/nodes.py`(各节点) · `app/agent/tools.py`(调 BFF API 回环) · `app/agent/checkpoint.py`(会话状态) · `app/guardrails/input.py`(PII/injection) · `app/guardrails/output.py`(Pydantic 校验) · `app/auth/jwt.py`(复用 luban 密钥) · `app/schemas/page_schema.py`(Pydantic 对齐 NodeSchema) · `app/schemas/validators.py`(校验闸) · `app/bff_client.py`(调 BFF API) · `deploy/init_qdrant.py`(建 collection 幂等) · `tests/`(pytest,mock LLM)

**engine/luban(TS/Vue3,改动)**:
`src/views/page/components/AiAssistantPanel.vue`(新) · `src/composables/useAiChat.ts`(新,SSE 客户端) · `src/composables/usePageEditorApi.ts`(新,收口画布操作) · `src/views/page/PageEditor.vue`(挂面板) · `src/api/ai.ts`(新) · `src/stores/ai.ts`(新,会话状态) · `src/views/settings/components/AiModelConfig.vue`(新) · `src/featuregates.ts`(+ai_assistant_enabled) · `vite.config`(+AI 代理走 BFF)

**bff/luban-bff(TS/Next.js,改动)**:
`src/app/api/ai/[...path]/route.ts`(新,SSE 反代+X-Internal-Token) · `src/lib/aiProxy.ts`(新,反代逻辑+服务间鉴权) · `.env.example`(+AI_SERVICE_URL/AI_SERVICE_TOKEN)

**web/luban-website(TS/Nuxt3,改动)**:
`components/AiAssistant.vue`(新) · `composables/useAiChat.ts`(新,SSE) · `nuxt.config`(FeatureGate)

### §9.2 API 契约(AI 服务,无双后端)

前缀 `/ai`(BFF 反代到 :8100,前端实际调 `/api/ai/*`)。鉴权:全 `Authorization: Bearer <luban JWT>`(BFF 校验)+ `X-Internal-Token`(BFF→AI 服务间)。

- `POST /ai/chat`(SSE,text/event-stream):req `{siteId, pageId, message, context?:{currentSchema}, role:'admin'|'visitor'}` → 流式 event `{type:progress|tool|patch|confirm|done|error, ...}`;401 UNAUTHENTICATED;403(visitor 尝试写)
- `GET /ai/config`:`{model:{provider,name}, features:{tool_calling,guidance}}` 只读
- `GET /ai/healthz`:`{status, deps:{qdrant, llm}}`

错误体对齐 luban `{code, message, details?}`:UNAUTHENTICATED / AI_FEATURE_DISABLED / AI_GENERATION_FAILED / AI_VALIDATION_FAILED / AI_FORBIDDEN(visitor 写)。

**工具调用回环**(AI→BFF,带 AI 身份头 `X-AI-Service: luban-ai`):
- 复用 `GET /api/sites/:sid/pages/:pid`(读 schema)
- 复用 `PUT /api/sites/:sid/pages/:pid`(写,经 HITL 确认后由前端执行,非 AI 直接写)
- 复用 `GET /api/leads`、`PUT /api/leads/:id/status`(查/改线索)

> 注:AI 服务不直接写 luban 业务库,写操作经 HITL 确认后由前端用用户态 JWT 执行。AI 仅生成 patch + 读当前 schema 辅助生成。

### §9.3 数据库变更
**AI 服务自有 Qdrant**(非 SQL):
- collection `luban_materials`(字段:name/category/description/props_schema_json + dense vector + payload{site_id?,version})
- collection `luban_docs`(产品文档/FAQ,payload{site_id,type,source})

**luban settings 表**(既有,复用):
- 新增 key `ai_model_config`:value `{provider, model, temperature, api_key_enc}`(api_key 加密存)

无 Flyway 变更(复用既有 settings 表)。

### §9.4 物料 schema
不新增物料(本期不涉 ui 子系统)。

### §9.5 组件接口
- `useAiChat(endpoint, token)`:返回 `{messages, send(text), stream, error, abort()}`;基于 @microsoft/fetch-event-source
- `usePageEditorApi(schema, history)`:`{addNode, updateProp, deleteNode, applyPatch, pushHistory}` 收口 PageEditor
- `LiteLLMProvider`(Python):`chat(messages, structured?) -> T` / `stream(messages) -> AsyncIterator`;`get_provider(config) -> Provider` 按配置返回
- LangGraph 节点:`understand / retrieve / tool_call / generate / validate / hitl / feedback`
- `aiProxy(targetPath, req, internalToken)`:BFF 反代函数,流式透传 Response

### §9.6 并行派发计划(与 taskGraph 一致)
- Wave0:T1(骨架) → T2(LiteLLM)
- Wave1:T3(Qdrant+RAG)
- Wave2:T4(LangGraph+工具+JWT) → T5(SSE+guardrails)
- Wave3:T6(BFF 反代) → T7(engine AI 面板)(T7 等 T6 契约冻结)
- Wave4:T8(设置页+C端助手)
- Wave5:T9(联调+E2E+旧文件废弃)
- ai 服务线 ∥ engine 线可并行(T7 依赖 T6 不依赖 T2-T5 实现,可 mock)

---

## §10 明确不做(防膨胀)+ 显式延后

**本期不做**(已确认范围外):
- 设计稿/截图转页面(多模态)→ **显式延后**到后续 plan(依赖本期 provider/RAG/agent 基建)
- 本地 LLM 部署(vLLM/GPU)→ 走云端
- APISIX 独立网关 → MVP 用 BFF 反代,生产化前夕视情况引
- LiteLLM Proxy Server → SDK 形态够用,独立计费场景再引
- 自部署 embedding/reranker → 云 API 起步
- Milvus 替换 Qdrant → 数据量爆发再迁(Retriever 抽象隔离)
- Redis 语义缓存(gptcache)→ 重复 query 多再引
- 全链路 trace(OTel)→ MVP 结构化日志够
- WebSocket 双向 → SSE 够,SSE 不够再引
- 新增 luban-ui 物料 → AI 消费现有物料
- Java/Go 后端改动 → AI 经 BFF 间接访问

**显式延后表**:
| 项 | 延后到 | 理由 |
|---|---|---|
| 设计稿转页面多模态 | 后续独立 plan | 依赖本期基建,本期范围已满 |
| APISIX 网关 | 生产化前夕 | YAGNI,流量小 |
| OTel 全链路 trace | 生产化 | 结构化日志够 |

---

## 质量禁令自检(逐条)
- [x]1 禁跳过功能(B+C 核心能力全在本 plan,设计稿显式延后) - [x]2 禁假绿(AI 单测 mock LLM,冒烟才真 API) - [x]3 禁占位 - [x]4 禁骨架(面板完整交互流) - [x]5 禁 JSON 代页面(结构化预览) - [x]6 交互完整(§4.2) - [x]7 验收=可交付链路 - [x]8 E2E 绑正式路由 - [x]9 门禁分级(G1-G4) - [x]10 /luban-review 清零 - [x]11 安全(JWT/X-Internal-Token/PII/injection/API key 加密) - [x]12 双后端一致(不适用,已声明) - [x]13 多端一致(不适用,已声明) - [x]14 FeatureGate

---

## 分级验收门禁(G1-G4)
| 级 | 验证 | 通过 | 责任 |
|---|---|---|---|
| G1 | /luban-review | 🔴🟡🔵 全清零 | owner |
| G2 | OWASP 自查 + JWT + X-Internal-Token + prompt injection + PII + API key 加密 | 无高中危 | owner |
| G3 | ai:`pytest --cov 85%`+`ruff`+`mypy`;engine/bff/website:`pnpm test 85%`+`pnpm build` | 达 §6.3 | owner |
| G4 | Playwright 正式路由主链路 + 三家模型冒烟 + 多租户隔离 | 全绿无 skip | owner |

---

## 敏感字段
- **AI_SERVICE_TOKEN**(BFF→AI 服务间):env 配,禁入库/日志/git
- **LLM API key**(DeepSeek/GLM/通义):AI 服务 process.env,settings 表存加密后;禁明文日志/对话
- **luban JWT/AUTH_JWT_SECRET**:AI 服务读 env 验签,禁外泄
- **用户输入(可能含 PII)**:guardrails 脱敏后才进 LLM
- **PageSchema 内容**(可能含业务数据):LLM 输入前评估是否需脱敏

---

## 回滚
- AI 面板异常 → 关 FeatureGate `ai_assistant_enabled`(engine 回归原状,**首选**)
- C 端助手异常 → 关 `ai_visitor_assistant_enabled`
- AI 服务故障 → 关 `ai.tool_calling`,面板提示功能未启用 / 降级纯 RAG
- 模型切换出问题 → 设置页回退上一可用 provider
- Qdrant 故障 → RAG 降级(全量物料 prompt 兜底)
- 无 Flyway/无 luban 业务库变更 → 无 DB 回滚负担

---

## Post-Dev Workflow
代码提交 → **/luban-review 清零** → 编译(ai ruff/mypy,engine/bff/website pnpm build)→ 单测覆盖率(ai pytest 85%,engine/bff/website pnpm test 85%)→ 询问用户跑 E2E(Playwright + 三家冒烟)→ `make test-coverage` 汇总 → 完成汇报。实现会话须一次推进至验证全绿后汇报,禁主路径收口即宣称完成。

---

## 关联
- 技术选型 SSOT:`docs/superpowers/specs/2026-06-28-ai-assistant-design.md`
- 任务图 SSOT:`docs/superpowers/tasks/luban-ai-assistant-2026.json`
- 废弃:`2026-06-19-luban-ai-assistant-program/plan1/plan2`(T9 标记 deprecated)
