---
featureId: luban-ai-assistant-plan1
title: Luban AI 助手 P1 — 自然语言生成/编辑页面 + 引导 + 模型切换 + 引擎集成
createdAt: 2026-06-19
status: approved
taskGraph: docs/superpowers/tasks/luban-ai-assistant-plan1.json
contractSource: plan-template 命令体 + writing-plans SKILL + PLAN_WRITING_CONTRACT.md
scope: Python AI 服务(FastAPI+LangGraph+Milvus+MinIO+Langfuse) + engine/luban AI 面板集成；设计稿转页面归 plan-2
split: 按用户确认方案 A 拆 plan-1(生成/编辑+引导+切换+集成) / plan-2(设计稿转页面多模态)；本 plan 为 plan-1，关联 program: luban-ai-assistant-program
branches: ai 子仓 feature/luban-ai-assistant-plan1；engine 子仓 feature/luban-ai-assistant-plan1 同名分支
---

# Luban AI 助手 P1 — 自然语言生成/编辑页面 + 引导 + 模型切换 + 引擎集成

> **验收口径(MUST)**：真实用户在 luban 编辑器中能完成 `打开 AI 面板 → 自然语言描述需求 → 流式看到 AI 生成/修改 → HITL 确认 → schema 落到画布且可撤销 → 切换 GLM/DeepSeek/通义 三家均能跑通 → AI 引导"下一步"` 全链路；AI 服务单测覆盖率≥85%；engine 不退化、零新增 console error；无骨架/占位/假绿。

## 模板适用性裁剪声明

plan-template 契约为 luban 全栈设计，本 plan（独立 Python AI 子项目 + engine 集成）做如下裁剪：

| 契约条款 | 本 plan 适用性 | 理由 |
|---|---|---|
| 双后端契约一致(§6.2/禁令12) | ❌ 不适用 | Python AI 服务，无 Java/Go 改动 |
| 多端渲染一致(禁令13) | ❌ 不适用 | AI 助手是编辑器侧能力，不涉发布渲染 |
| 物料 schema(§6.4) | ⚠️ 间接 | 不新增物料；AI 生成的 schema 须符合既有 propsSchema（在 P1-T3 校验闸体现） |
| E2E 绑正式路由(禁令8) | ✅ 适用 | engine AI 面板 E2E 走正式编辑器路由 `/sites/:siteId/pages/:pageId/edit` |
| 其余(TDD/禁假绿/门禁/FeatureGate/安全审查/§9/禁分期) | ✅ 完全适用 | — |

## §0 概览

为 luban 低代码平台建独立 AI 助手子项目 `luban-ai-assistant`（Python 核心 + Vue3 前端集成），通过 git submodule 引入 `packages/ai/luban-ai-assistant`（当前空目录，默认分支 main）。P1 交付：自然语言生成/编辑 PageSchema、AI 对话引导、模型可切换（GLM/DeepSeek/通义）、引擎 AI 面板集成。设计稿转页面归 P2。

**技术选型（用户多轮确认锁死，勿再讨论）**：Python 3.12 + uv / FastAPI(SSE+WS) / LangGraph(状态图+checkpoint+HITL) / 云端 LLM(LangChain ChatModel + provider 适配层切换) / instructor+Pydantic v2(应用层逼近合法，已接受放弃 token 级约束解码) / Milvus+云端 embedding+hybrid 检索(去 rerank) / MinIO(OSS+Milvus 内部存储) / etcd(Milvus 依赖) / PostgreSQL(checkpoint+会话+元数据+Langfuse) / Langfuse(自托管) / Docker Compose 6 容器无 GPU。

## §1 需求溯源（gap→task 矩阵）

| Gap（证据） | 层级 | task | 验收 | 门禁 |
|---|---|---|---|---|
| 无 AI 助手（packages/ai/luban-ai-assistant 空目录） | L0 | P1-T1~T10 | 全链路 | G3/G4 |
| 引擎无远程画布 API（PageEditor onAddNode 等为私有 setup 函数，调研确认） | L0 | P1-T8 | 画布 API 收口 | G3/G4 |
| stores/page.ts 与 PageEditor 局部 schema 分裂（调研确认状态分裂隐患） | L0 | P1-T8 | 收口统一 | G3 |
| 无模型切换能力（用户要 GLM/DeepSeek/通义 切换） | L0 | P1-T2 | 三家冒烟 | G3 |
| 无结构化生成保障（须生成合法 PageSchema） | L0 | P1-T3 | schema 校验闸 | G3 |
| 无物料知识检索（AI 须知道有哪些物料/props） | L0 | P1-T4 | RAG 召回 | G3 |
| 无 AI 引导能力 | L1 | P1-T9 | 引导场景 | G3 |
| 无 LLM 可观测 | L1 | P1-T7 | Langfuse trace | G3 |

无遗漏：用户确认的 4 项能力中，①生成/编辑→T2/T3/T5/T6/T8，③引导→T9，④切换→T2/T10；②设计稿转页面显式归 plan-2（§10）。

## §2 系统与链路

**涉及子系统**：luban-ai-assistant（Python，新）/ engine/luban（TS/Vue3 集成）。不涉及 bff/website/ui/backend。

**主链路（自然语言生成页面）**：
```
用户在 PageEditor 打开 AI 面板 → 输入"做一个用户列表页"
  → engine AI 面板 fetch SSE POST /ai/chat (Bearer JWT) → FastAPI 验 JWT
  → LangGraph agent: 理解意图 → RAG 检索相关物料(Table/Form 等)
  → provider 调云端 LLM(LangChain structured output) → 生成 PageSchema
  → Pydantic + 物料存在性/propsSchema/expression 沙箱 校验闸
  → 通过 → SSE 流式回传 schema patch + 工具调用进度 → 失败回环重试
  → 前端 HITL 确认 → usePageEditorApi 落地 schema + history.push(可撤销)
  → 画布渲染 → 用户可见
```

**编辑链路（增量改属性）**：选中节点 → AI 面板"把标题改成红色" → agent 生成单节点 patch → 校验 → 直接应用（单属性免确认，Q5 默认）+ history.push。

**模型切换链路**：改 `.env` MODEL_PROVIDER=glm|deepseek|qwen → AI 服务重启加载对应 ChatModel → 全链路不变。

## §3 业务逻辑

**会话状态机**：`idle → generating → awaiting_confirm → applied | rejected | failed`。
- generating：agent 执行中（流式）
- awaiting_confirm：HITL（整页生成/覆盖/删除须确认，Q5 默认）
- applied：落地画布；rejected：用户拒绝；failed：校验失败回环超限

**事务边界**：schema 变更非立即落库——AI 生成的是"待确认 patch"，确认后才写 PageEditor 局部 schema + history.push；持久化（savePage）仍是用户手动 Ctrl+S（复用 engine 现有 savePage PUT）。AI 服务侧 checkpoint 记录 agent 状态（可恢复），不直接写 luban 业务库。

**业务规则**：
- AI 生成的 NodeSchema.type 必须是 materialRegistry 已注册物料（校验闸）
- props 必须符合该物料 propsSchema（校验闸）
- visible/loop/events 表达式须符合 luban 自研沙箱规则（禁 eval/Function/new）—— AI 服务侧做规则校验（与 engine expression.ts 白名单对齐），不执行求值
- 新节点 id 用 uuid
- HITL 粒度：整页生成/覆盖/删除→确认；单属性编辑→直接应用（Q5）

## §4 页面结构

### §4.0 入口表
| 路由 | 视图 | 状态 |
|---|---|---|
| /sites/:siteId/pages/:pageId/edit | PageEditor（三栏 + AI 侧边面板） | 改动 P1-T8 |
| AI 侧边面板（PageEditor 内嵌右侧抽屉） | AiAssistantPanel.vue | 新增 P1-T8 |

### §4.2 AI 面板主交互链
1. 点工具栏 AI 图标 → 抽屉展开（FeatureGate ai_assistant_enabled 关则隐藏）
2. 输入框输入需求 → 发送 → 流式显示 agent 进度（"正在检索物料…正在生成…"）
3. 生成完成 → 展示待确认 schema 预览（树形/JSON 可切换，**非纯 JSON dump**，有结构化预览）
4. 整页/覆盖 → [应用] [拒绝] HITL 确认；单属性 → 直接应用 + toast
5. 应用 → 画布渲染变更 + 入撤销栈（Ctrl+Z 可撤销 AI 改动）
6. 引导态：空输入时 AI 主动给"下一步建议"（读当前 schema）

### §4.3 AI 面板结构
```
┌─AI 助手(右侧抽屉)──────────────┐
│ [对话] [引导]  ← 模式 tab        │
├────────────────────────────────┤
│ 消息流:                         │
│  user: 做一个用户列表页          │
│  ai: 🔍 检索到 Table/Form…(进度) │
│  ai: ✅ 生成待确认 [预览]        │
│      ┌ schema 预览(树形) ┐       │
│      │ Page                │     │
│      │ ├ Table(数据)       │     │
│      │ └ Pagination        │     │
│      └────────────────────┘     │
│      [应用到画布] [拒绝]          │
├────────────────────────────────┤
│ 输入框___________ [发送]         │
│ 模型: GLM-4 ▼ (只读,展示当前)    │
└────────────────────────────────┘
```
四态：加载(流式 spinner)/空(引导建议)/错(校验失败+重试/降级提示)/成功(预览+确认)。

> 模型选择前端只读展示当前部署模型（Q6 全局切换，不开放用户选）。切换由部署改配置。

## §5 集成与复用
| 复用件 | 提供方 | 消费方 | 契约 |
|---|---|---|---|
| PageSchema/NodeSchema 形态 | luban-low-code schema.ts(既有) | P1-T3(Pydantic 对齐) | {root:NodeSchema, formState?}；NodeSchema id/type/props/children/visible/loop/events/datasource |
| 物料清单 | luban-ui materialRegistry(既有) | P1-T4(同步入库) | getAll() → name/version/category/description/propsSchema |
| 画布操作函数 | PageEditor onAddNode 等(既有,私有) | P1-T8(收口) | usePageEditorApi() 暴露 add/updateProp/delete/duplicate/pushHistory |
| JWT 鉴权 | luban AUTH_JWT_SECRET(既有) | P1-T6(AI 服务自验) | payload {sub,username,role}；AI 服务读同密钥验签 |
| 撤销栈 | engine useHistory(既有) | P1-T8 | AI 变更 push 入栈 |
| 表达式沙箱规则 | luban-low-code expression.ts(既有) | P1-T3(规则校验,不执行) | AST 白名单（禁 eval/Function/new/this/window/import） |

## §6 架构边界 + 门禁

### §6.1 分层
- AI 大脑：luban-ai-assistant（Python）—— 理解/检索/生成/校验/HITL，不碰 luban 业务库
- 前端手足：engine/luban（TS）—— 流式消费 + 画布落地 + 撤销栈
- 边界：流式 API 契约（SSE/WS）+ JWT；前端直连 AI 服务（不动 BFF 流式，Q3 默认）

### §6.2 双后端 parity
**不适用**：Python AI 服务无 Java/Go。luban 既有后端（Java/Go）本 plan 不改动。

### §6.3 覆盖率门禁
AI 服务（Python pytest）**85%** · engine 85%（make test-coverage 汇总；Python 仓单独 `pytest --cov`）。

### §6.4 物料 schema
不新增物料。AI 生成须符合既有 `defineMaterial` propsSchema（JSON Schema，P1-T3 校验闸强制）。

### §6.5 FeatureGate
| 功能 | key | 作用域 | 关闭行为 |
|---|---|---|---|
| AI 助手面板 | ai_assistant_enabled | engine | 隐藏 AI 图标/抽屉，编辑器回归原状 |
| AI 生成 | ai.generate | ai 服务 | /ai/generate 返回 503，面板提示"功能未启用" |
| AI 引导 | ai.guidance | ai 服务 | 隐藏引导 tab |

## §7 测试计划

### §7.1 主路径
**AI 服务侧（pytest）**：provider 切换 / schema 校验闸 / RAG 检索 / LangGraph 状态图各节点 / checkpoint 恢复 / guardrails / SSE 流式 / JWT 鉴权。
**engine 侧（Playwright 绑正式路由 /sites/:siteId/pages/:pageId/edit）**：打开 AI 面板 → 生成 → 确认 → 落地 → 撤销；FeatureGate 关闭隐藏面板；AI 改动入撤销栈。
**多租户隔离用例（MUST）**：A 用户 JWT 调 AI 服务，checkpoint/会话按 user 隔离，B 用户不可见 A 的会话。

### §7.2 脚本保障
- 首个失败即停（修当前红，非提前收工）
- 禁假绿：禁 skip/空断言；AI 服务侧 LLM 调用用 mock（不依赖真实 API 跑单测），冒烟测试才用真实 API
- 环境预检：AI 服务单测需 postgres/milvus/minio 起（docker compose）；engine E2E 需 BFF+后端+AI 服务起齐

### §7.3 用例（节选）
| 场景 | 前置 | 操作与断言 | 清理 |
|---|---|---|---|
| 生成页面 | 登录+建空页 | 发"用户列表页"→流式→确认→断言画布有 Table | 删页 |
| 模型切换 | 三家 key 配好 | 切 MODEL_PROVIDER 三次冒烟生成→断言均成功 | - |
| 撤销 AI 改动 | 已应用 AI 生成 | Ctrl+Z→断言画布回退 | - |
| 校验失败回环 | mock LLM 产非法 schema | 断言回环重试→超限降级提示 | - |
| 多租户隔离 | A/B 两用户 | A 会话 B 不可见 | 删会话 |

### §7.4 路由合规
engine E2E 全走正式路由 `/sites/:siteId/pages/:pageId/edit`，**无新增 pages/e2e/***。AI 服务侧无前端路由（纯 API）。

## §8 TDD + 执行
- TDD：provider/schema 校验/RAG/LangGraph 节点/guardrails 先单测红→绿；engine 画布 API 收口先测
- 并行：Wave0 P1-T1→T2；Wave1 T3/T4 并行；Wave2 T5 后 T6/T7 并行；Wave3 T8/T9 并行 → T10 联调
- 单期收口：P1-T1~T10 单次实现周期全完成，禁分期
- **验证门**：
  - AI 服务：`uv run pytest --cov --cov-fail-under=85`
  - AI 服务 lint：`uv run ruff check && uv run mypy app`
  - engine：`pnpm test && pnpm build`（零 console error）
  - Docker：`docker compose config && docker compose up -d --wait`（6 容器健康）

## §9 实现任务派发

> §9 基于既有调研（引擎/BFF 已 Explore 深度调研）+ 新项目文件结构设计。luban-ai-assistant 为**新建空仓无既有代码可扫**，故无 codegraph 扫码环节，文件结构为设计产出。

### §9.1 文件变更总览
**luban-ai-assistant（Python，新建）**：
`pyproject.toml`(uv) · `docker-compose.yml` · `docker-compose.override.yml.example` · `.env.example` · `Dockerfile` · `app/main.py`(FastAPI) · `app/core/config.py`(MODEL_PROVIDER/三家 key/DB/OSS/Langfuse) · `app/api/chat.py`(SSE) · `app/api/generate.py` · `app/api/ws.py`(WebSocket) · `app/api/health.py` · `app/api/config.py`(模型配置只读端点) · `app/llm/provider.py`(Provider 抽象+切换) · `app/llm/zhipu.py`/`deepseek.py`/`tongyi.py`(三家适配) · `app/schemas/page_schema.py`(Pydantic 对齐 NodeSchema) · `app/schemas/validators.py`(校验闸) · `app/rag/sync_materials.py`(物料知识同步) · `app/rag/retriever.py`(Milvus hybrid) · `app/agent/graph.py`(LangGraph 状态图) · `app/agent/nodes.py`(各节点) · `app/agent/checkpoint.py`(PostgreSQL) · `app/guardrails/input.py`(injection/PII) · `app/guardrails/output.py`(Pydantic 校验) · `app/observability/langfuse.py` · `app/auth/jwt.py`(复用 luban 密钥验签) · `deploy/init.sh`(建库/collection/bucket 幂等) · `deploy/deploy.sh`(SSH 部署到测试服务器: `source` 仓库根 `.env.dev` 注入 SSH 凭证, SCP/rsync 推送 compose+服务, **禁硬编码任何 SSH 明文**) · `tests/`(pytest，mock LLM)

**engine/luban（TS/Vue3，改动）**：
`src/composables/usePageEditorApi.ts`(新，收口画布操作) · `src/views/page/components/AiAssistantPanel.vue`(新，AI 面板) · `src/views/page/PageEditor.vue`(挂面板+接线 usePageEditorApi，替换私有函数调用) · `src/api/ai.ts`(新，SSE/WS 客户端) · `src/stores/ai.ts`(新，会话状态) · `src/featuregates.ts`(+ai_assistant_enabled) · `vite.config`(+AI 服务代理/CORS)

### §9.2 API 契约（AI 服务，无双后端）
前缀 `/ai`。鉴权：全 `Authorization: Bearer <luban JWT>`，AI 服务自验（共享 AUTH_JWT_SECRET）。
- `POST /ai/chat`（SSE，text/event-stream）：req `{siteId, pageId, message, context?:{currentSchema}}` → 流式 event `{type:progress|tool|patch|confirm|done|error, ...}`；401 UNAUTHENTICATED
- `POST /ai/generate`（SSE）：req `{siteId, pageId, prompt}` → 流式生成 PageSchema patch
- `WS /ai/agent`（多步 agent，心跳+重连）：双向消息（用户消息/agent 事件/HITL 确认回执）
- `GET /ai/config`：`{model:{provider,name}, features:{generate,guidance}}` 只读
- `GET /healthz`：`{status, deps:{postgres,milvus,minio,langfuse}}`
错误体对齐 luban 风格 `{code, message, details?}`：UNAUTHENTICATED / AI_FEATURE_DISABLED / AI_GENERATION_FAILED / AI_VALIDATION_FAILED。

### §9.3 数据库变更（AI 服务自有 PostgreSQL）
```sql
-- agent checkpoint（LangGraph langgraph-checkpoint-postgres 自建表，不手写）
-- AI 服务业务表：
CREATE TABLE ai_sessions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,           -- 多租户隔离
  site_id VARCHAR(36), page_id VARCHAR(36),
  status VARCHAR(32) NOT NULL DEFAULT 'idle',  -- idle/generating/awaiting_confirm/applied/rejected/failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_sessions_user ON ai_sessions(user_id);
```
Milvus collection `luban_materials`（字段：name/category/description/props_schema_json + dense vector + sparse vector，hybrid 检索）。MinIO bucket `ai-assets`（P2 图片用，P1 预建）。

### §9.4 物料 schema
不新增物料（本 plan 不涉 ui 子系统任务）。

### §9.5 组件接口
- `usePageEditorApi(schema, history)`：`{addNode(type,parentId,props), updateProp(nodeId,key,value), updateEvent, deleteNode, duplicateNode, applyPatch(patch), select(id)}`——收口 PageEditor 现有私有函数
- `Provider`（Python 抽象基类）：`chat(messages, structured?:Pydantic) -> T` / `stream(messages) -> AsyncIterator`；`get_provider(config) -> Provider` 按 MODEL_PROVIDER 返回单例
- LangGraph 节点：`understand / retrieve / generate / validate / hitl / feedback`

### §9.6 并行派发计划（与 taskGraph 一致）
- Wave0：P1-T1(骨架+Docker) → P1-T2(provider)
- Wave1 并行：P1-T3(schema 校验) ∥ P1-T4(RAG)
- Wave2：P1-T5(LangGraph) → P1-T6(API) ∥ P1-T7(guardrails+Langfuse)
- Wave3 并行：P1-T8(engine 集成) ∥ P1-T9(引导) → P1-T10(联调)
- 主会话串行落盘 plan/taskGraph；实现阶段各线独立可验收（ai 服务线 ∥ engine 线，T8 等 T6 契约冻结）

## §10 明确不做（防膨胀）+ 显式延后
**本期不做**（用户确认范围外 / 已归 he plan，非静默跳过）：
- 设计稿/截图转页面（多模态）→ **显式归 plan-2**（`2026-06-19-luban-ai-assistant-plan2.md`）
- 本地 LLM 部署（vLLM/GPU）→ 已定走云端
- 独立 OCR（PaddleOCR）→ plan-2 用多模态替代
- 独立 Reranker → 用 Milvus hybrid
- LiteLLM 多模型网关 → provider 适配层替代
- LlamaIndex/RAGFlow 重框架 → 检索场景明确自写轻量
- Temporal 长流程 → LangGraph checkpoint 替代
- Java/Go 后端改动 → AI 项目不触双后端
- website SSR / 多端渲染 → 编辑器侧能力
- 新增 luban-ui 物料 → AI 消费现有物料
- 静态新手 tour（driver.js）→ 延后，本期只做 AI 对话引导（Q8）
- 模板库/区块库 RAG → 延后（本期 RAG 只索引物料清单 + 最佳实践）

## 质量禁令自检（逐条）
- [x]1 禁跳过功能（4 项能力 3 项在本 plan，②显式归 plan-2） - [x]2 禁假绿（AI 单测 mock LLM，冒烟才用真实 API） - [x]3 禁占位 - [x]4 禁骨架（面板有完整交互流） - [x]5 禁 JSON 代页面（AI 面板有结构化预览非 dump） - [x]6 交互完整(§4.2) - [x]7 验收=可交付链路 - [x]8 E2E 绑正式路由 - [x]9 门禁分级(G1-G4) - [x]10 /luban-review 清零 - [x]11 安全(JWT/API key/injection/PII) - [x]12 双后端一致（不适用，已声明） - [x]13 多端一致（不适用，已声明） - [x]14 FeatureGate

## 分级验收门禁
| 级 | 验证 | 通过 | 责任 |
|---|---|---|---|
| G1 | /luban-review | 🔴🟡🔵 全清零 | owner |
| G2 | OWASP 自查 + 敏感字段 + JWT 鉴权 + prompt injection + PII | 无高中危 | owner |
| G3 | ai: `pytest --cov 85%`+`ruff`+`mypy`；engine: `pnpm test 85%`+`pnpm build` | 达 §6.3 | owner |
| G4 | Playwright 正式路由主链路 + 三家模型冒烟 | 全绿无 skip | owner |

## 敏感字段
- **测试服务器 SSH 凭证**（host/user/port/key/password）：存仓库根 `.env.dev`（已确认：`.gitignore` 的 `.env.*` 排除、未被 git 跟踪、未入仓 ✅）；部署脚本运行时 `source` 注入；**禁入 plan/脚本硬编码/日志/git/对话**；CI 走 GitHub Secrets 注入，不落盘明文
- LLM API key（智谱/DeepSeek/通义）：仅 AI 服务 `process.env`，禁入库/日志/Langfuse 明文
- luban JWT/AUTH_JWT_SECRET：AI 服务读环境变量验签，禁外泄
- 用户输入（可能含 PII）：guardrails 脱敏后才进 LLM/Langfuse
- PageSchema 内容：可能含业务数据，Langfuse trace 需脱敏配置

## 回滚
- AI 面板异常 → 关 FeatureGate `ai_assistant_enabled`（engine 回归原状，**首选**）
- AI 服务故障 → 关 `ai.generate`/`ai.guidance`，面板提示功能未启用
- provider 切换出问题 → MODEL_PROVIDER 回退上一可用模型
- Milvus/MinIO 故障 → RAG 降级（全量物料 prompt 兜底）
- 无 Flyway/无 luban 业务库变更 → 无 DB 回滚负担

## Post-Dev Workflow
代码提交 → **/luban-review 清零** → 编译（ai: `ruff`/engine: `pnpm build`）→ 单测覆盖率（ai `pytest --cov`/engine `pnpm test`）→ 询问用户跑 E2E（Playwright + 三家冒烟）→ `make test-coverage` 汇总 → 完成汇报。实现会话须一次推进至验证全绿后汇报，禁主路径收口即宣称完成。

## 关联
- 上游 program：`2026-06-19-luban-ai-assistant-program.md`（聚合 plan-1/plan-2）
- 后续 plan-2：`2026-06-19-luban-ai-assistant-plan2.md`（设计稿转页面，依赖本 plan 的 provider/schema/agent/api/面板）
