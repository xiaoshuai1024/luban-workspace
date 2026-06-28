# Luban AI 助手 — 技术选型与架构设计

> **状态**:approved(技术选型阶段)
> **创建**:2026-06-28
> **范围**:本次仅产出**技术选型 + 架构设计**,实施计划由后续 writing-plans 产出
> **前置结论**:旧方案(`luban-ai-assistant-program/plan1`,2026-06-19,`status=implemented` 但 `packages/ai/luban-ai-assistant` 实为空目录)**废弃,推倒重来**。本设计替代旧 plan,旧 plan/task 文件须标记为 deprecated。

---

## §0 核心决策(用户多轮确认锁死)

| # | 决策项 | 选定 | 备选/演进 |
|---|--------|------|----------|
| 1 | **智能形态** | 自主 Agent(多步规划+工具调用)+ RAG | 单工具调用型为 MVP 起步形态 |
| 2 | **模型来源** | 国内云 API | 私有部署为高敏感场景备选 |
| 3 | **集成入口** | 复用 BFF(`/api/ai/*` 反代) | APISIX 独立网关为生产化阶段备选 |
| 4 | **交互协议** | SSE 流式 | WebSocket 仅在需要双向中断时引入 |
| 5 | **Agent 框架** | LangGraph(LangChain 生态) | — |
| 6 | **首发范围** | 全功能读写(含批量/发布),带二次确认+审计 | — |
| 7 | **向量库** | **Qdrant** | Milvus 为数据量爆发时演进 |
| 8 | **LLM 抽象** | **LiteLLM SDK**(内嵌,非 proxy server) | LiteLLM Proxy 为独立计费场景演进 |
| 9 | **LLM 首选** | **DeepSeek** | 后台可配切 GLM/通义 |
| 10 | **网关** | 先 BFF 反代 | APISIX 视生产化/成本治理需求再引 |

---

## §1 架构总览

### §1.1 拓扑

```
访客(C端)              运营(B端)
website:3000          engine:5173
    │                      │
    └────── BFF:3100 ──────┘   ← 唯一入口(JWT 鉴权/SSE 透传/限流)
            │       │
            │       └─ /api/ai/* ──┐  (SSE 反代, 复用 JWT)
            │                      ▼
   Java:8080 / Go:8081     Python AI 服务 :8100
   (业务实现)              (FastAPI + LangGraph + RAG)
                                │    │    │
                                │    │    └─ Qdrant(向量库,RAG 检索)
                                │    └─ 工具调用 ──→ BFF:3100 (回环, 复用现有业务 API)
                                └─ LLM 云 API(DeepSeek/GLM/通义, LiteLLM 路由)
```

### §1.2 服务拓扑(对齐 SYSTEM_ARCHITECTURE.md)

| 系统 | 角色 | dev 端口 | 部署 |
|------|------|---------|------|
| **Python AI 服务** `luban-ai-assistant` | AI 大脑:LangGraph 编排/RAG/工具调用/流式 | **8100** | 本机 dev 裸进程(uvicorn) |
| **Qdrant** | 向量库(物料知识/文档/对话历史 embedding) | 远端 dev 服务器 | 与 MySQL/Redis 并列 |
| Java/Go 后端 | 业务实现(不动) | 8080/8081 | 不变 |
| BFF | 统一入口,新增 `/api/ai/*` 反代 | 3100 | 不变 |
| engine/website | 前端集成 | 5173/3000 | 新增 AI 面板/组件 |

> 端口 8100 为新增,避让既有 5173/3000/3100/8080/8081/13306/16379。

### §1.3 与既有架构的边界

- **不动 Java/Go 后端**:AI 服务通过 BFF 的 API 间接访问业务,享受双后端契约抹平
- **不动 BFF 业务逻辑**:仅新增 `/api/ai/*` 反代路由(SSE 透传 + 服务间鉴权)
- **不新增公网入口**:AI 服务不直接暴露,BFF 是唯一入口
- **复用 luban JWT**:前端→BFF 用现有 `luban_token`;BFF→AI 服务用服务间 token

---

## §2 核心技术栈

### §2.1 Python AI 服务本体

| 组件 | 选型 | 版本 | 理由 |
|------|------|------|------|
| Web 框架 | **FastAPI** | 0.110+ | 原生 SSE(`StreamingResponse`)、async、Pydantic 校验、自动 OpenAPI |
| ASGI 服务器 | **Uvicorn + Gunicorn** | 0.30 / 22.0 | 生产用 gunicorn 多 worker 管 uvicorn worker |
| Python | **3.11** | — | 性能与生态最稳平衡点;3.12 部分库未跟进 |
| 依赖管理 | **uv** | latest | Rust 实现锁定文件,比 pip/poetry 快 10-100x |
| 配置 | pydantic-settings | 2.x | 环境变量 + `.env` 加载,类型校验 |

### §2.2 LLM 编排 + Agent

| 组件 | 选型 | 理由 |
|------|------|------|
| **Agent 框架** | **LangGraph** 0.2+ | 状态机/图式编排,可控性最高;LangChain 生态最大 |
| **模型抽象** | **LiteLLM SDK**(内嵌,非 proxy) | 一套接口调 100+ 厂商,统一计费/重试;换厂商只改配置;后台可热切换 DeepSeek/GLM/通义 |
| LangGraph 集成 | `ChatLiteLLM` 或 `init_chat_model` | LiteLLM 对 LangGraph 透明 |

**模型优先级**(均国内云 API):
1. **DeepSeek**(首选,性价比)
2. **通义千问 Qwen**(工具调用稳,备案齐全)
3. **智谱 GLM-4**(均衡备选)

### §2.3 RAG 知识检索

| 组件 | 选型 | 理由 |
|------|------|------|
| **向量库** | **Qdrant** | 单二进制 Rust,资源占用低;payload 过滤强(按 site_id/租户/文档类型);嵌入式→服务模式无缝升级;契合 luban 轻量拓扑 |
| **Embedding 模型** | 通义 `text-embedding-v3` 或 BGE-M3(开源) | 云 API 起步;token 成本失控再自部署 |
| **检索框架** | LangChain Retriever + 自实现重排 | 换向量库只换 Retriever 实现,业务零改 |
| **文档处理** | LangChain DocumentLoaders + RecursiveCharacterTextSplitter | 支持 PDF/Markdown/网页 |

**Qdrant 部署形态**:远端 dev 服务器(与 MySQL 13306/Redis 16379 并列),本机裸进程连远端。本地开发可用嵌入式模式零中间件。

### §2.4 前端集成(SSE 流式)

| 场景 | 实现 |
|------|------|
| engine(B 端运营) | `@microsoft/fetch-event-source`(支持自动重连/自定义 header)读 SSE |
| website(C 端访客) | Nuxt composable 封装 SSE,`<ClientOnly>` 包裹 |
| BFF 反代 | Next.js Route Handler 流式 `Response` 透传(chunk-by-chunk,非 fetch 等待) |

### §2.5 鉴权与安全

| 链路 | 方案 |
|------|-----|
| 前端→BFF | 复用现有 JWT(`luban_token`) |
| BFF→AI 服务 | **服务间 token**:env 配 `AI_SERVICE_TOKEN`,请求头 `X-Internal-Token`,AI 服务校验 |
| AI 服务→BFF(工具调用) | AI 服务带"AI 服务身份"标识(BFF 白名单/专用 key),用于审计 |
| PII 保护 | LLM 输入前脱敏(对齐 Java `maskPhone`/`maskEmail`);敏感字段不入向量库 |
| Prompt 注入 | 输入 guardrail(基础规则过滤);MVP 不引 WAF |

---

## §3 关键链路

### §3.1 完整鉴权/会话流

```
前端 ──Bearer JWT──▶ BFF:3100 /api/ai/chat
                       │ 1. 校验 JWT, 提取 userId/siteId
                       │ 2. 附加 X-Internal-Token
                       ▼
                  Python AI:8100
                       │ 3. 校验 X-Internal-Token
                       │ 4. LangGraph 编排 + 工具调用
                       │    └─ 工具调用回环 → BFF:3100 /api/* (带 AI 服务身份)
                       ▼ 5. SSE 流式
                  BFF 透传 ──SSE──▶ 前端打字机
```

### §3.2 工具调用回环(关键设计)

AI 服务要执行"建页面/改线索/发布"时,**调 BFF 的 API 而非直连 Java/Go**:
- 享受 BFF 双后端路由 + 字段抹平 + 错误码归一
- 不绕过契约层,不重复实现业务
- BFF 现有 contract test 自动覆盖 AI 调用路径

### §3.3 模型热切换(后台可配)

```
运营在 engine 设置页改 provider=glm → 存 luban settings 表
  → AI 服务每次请求读最新配置(短缓存 30s)
  → LiteLLM 路由到对应厂商 → 业务代码零改动
```

---

## §4 BFF 网关能力评估(回应"是否需要 APISIX")

### §4.1 能力对比

| 维度 | BFF(Next.js) | APISIX | 差距 |
|------|-------------|--------|------|
| 限流(集群级) | 手写,进程内 | Redis 集群级多维限流 | 🔴 BFF 弱 |
| 熔断降级 | 无 | 内置 circuit-breaker | 🔴 BFF 弱 |
| 动态配置 | 改代码→发版 | etcd 毫秒热更新 | 🔴 BFF 弱 |
| 并发性能 | Node 几千 QPS | LuaJIT 10万+ QPS | 🔴 差一个数量级 |
| 安全防护(WAF) | 基本无 | WAF/CC/IP 黑白名单 | 🔴 BFF 弱 |
| 可观测 | 要自己接 | 内置 Prometheus/OTel | 🟡 BFF 要写代码 |
| 鉴权(JWT) | ✅ 可做 | ✅ 插件化 | 🟢 持平 |
| 业务聚合 | ✅ 本职强项 | ❌ 不做 | 🟢 BFF 胜 |

### §4.2 结论

- **BFF 在流量治理维度确实简陋**,不能算专业网关的替代
- **正确架构是分层**:APISIX(流量层)+ BFF(业务层)并存,职责不重叠
- **MVP 阶段用 BFF 反代**(YAGNI,流量小、还在开发)
- **生产化前夕视情况引 APISIX**(限流/熔断/AI 成本治理变成刚需时)
- 决策权在用户:"先用 BFF,视情况再决定是否引入 APISIX"

### §4.3 演进触发条件(何时该引 APISIX)

| 触发信号 | 说明 |
|---------|------|
| LLM token 成本失控 | 需集群级按用户/IP/会话限流 |
| 云 LLM API 抖动致雪崩 | 需熔断降级防打穿 Java 后端 |
| 生产化部署 | 需统一 TLS/WAF/灰度 |
| AI 请求量大 | 需高性能反代 + 全链路 trace |

---

## §5 项目结构(新增子项目)

```
packages/ai/luban-ai-assistant/  ← 复用既有空目录(submodule,与 engine/bff 同级)
├── app/
│   ├── main.py                  # FastAPI 入口: /chat /tools /health
│   ├── api/                     # 路由层(SSE endpoint)
│   ├── agent/                   # LangGraph 图定义
│   │   ├── graph.py             # 状态机编排
│   │   ├── nodes/               # 节点(意图/工具调用/RAG/回复)
│   │   └── tools/               # 工具实现(调 BFF API)
│   ├── rag/                     # 文档加载/分块/检索(Qdrant)
│   ├── llm/                     # LiteLLM 封装 + 厂商配置
│   └── core/                    # 配置/日志/安全
├── tests/
├── pyproject.toml               # uv 管理
└── Makefile target: dev-ai      # :8100
```

**需同步更新**:
- `docs/SYSTEM_ARCHITECTURE.md`:加 §2.x Python AI 服务 + §5 端口表 :8100 + §2.x Qdrant
- `Makefile`:加 `dev-ai` target

---

## §6 演进项(MVP 不做,预留接入点)

| 项目 | 何时引 | 为什么 MVP 不引 |
|------|--------|----------------|
| APISIX 网关 | 生产化前夕 | YAGNI,先 BFF |
| LiteLLM Proxy Server | 需独立计费/A-B 测试 | SDK 形态够用 |
| 自部署 embedding/reranker | token 成本失控 | 云 API 起步省事 |
| Milvus 替换 Qdrant | 数据量到 TB 级 | Qdrant 抽象在 Retriever,切换成本低 |
| Redis 语义缓存(gptcache) | 重复 query 多 | 复用远端 Redis,演进项 |
| 全链路 trace(OTel) | 生产化 | MVP 结构化日志够 |
| WebSocket 双向 | 需服务端推中断信号 | SSE 大多数场景够 |

---

## §7 与旧方案的关系(废弃说明)

### §7.1 旧方案现状(已核实)

- `docs/superpowers/tasks/luban-ai-assistant-program.json`(approved)
- `docs/superpowers/tasks/luban-ai-assistant-plan1.json`(implemented)
- `docs/superpowers/tasks/luban-ai-assistant-plan2.json`
- `.agents/plans/2026-06-19-luban-ai-assistant-plan1/2/program.md`

**但 `packages/ai/luban-ai-assistant/` 实为空目录**,submodule 记录 `-70e79cc`(未初始化)。即:计划标记 implemented 但**代码从未真正落地**。

### §7.2 主要选型差异(本设计替代旧 plan)

| 维度 | 旧方案(废弃) | 本设计(新) |
|------|-------------|------------|
| 模型切换 | 自写 Provider 适配层 | **LiteLLM SDK** |
| 向量库 | Milvus + MinIO + etcd + PG(6 容器) | **Qdrant**(单二进制) |
| 集成入口 | 前端直连 AI 服务(共享 JWT) | **BFF 反代** `/api/ai/*` |
| LLM 首选 | GLM/DeepSeek/通义并列 | **DeepSeek 首选** |
| 范围 | 仅 B 端编辑器 | **B 端 + C 端** |
| 复杂度 | 6 容器 compose 无 GPU | **轻量**:AI 服务 + Qdrant 两件 |

### §7.3 后续动作(待 writing-plans 阶段执行)

- 旧 plan/task JSON 的 `status` 改为 `deprecated`,加 `deprecatedReason` + 指向本设计
- 旧 `.agents/plans/*.md` 头部加废弃声明
- 本设计为 AI 助手子系统的**新 SSOT**

---

## §8 风险与开放问题

| 风险 | 缓解 |
|------|------|
| BFF SSE 反代可能丢 chunk/缓冲 | 实现时验证 chunk-by-chunk 透传,禁用 BFF 端缓冲;列为首个联调验证项 |
| DeepSeek 工具调用偶不稳 | LiteLLM 路由层做 fallback 到 GLM/通义 |
| Qdrant 远端部署未就绪 | 本地嵌入式模式兜底开发 |
| 全功能读写范围大,初期过重 | writing-plans 阶段拆 wave:只读→有限写→全功能 |

---

## §9 后续

本设计为**技术选型 + 架构**,不含实现任务。下一步:
1. 用户审阅本 spec
2. 调用 writing-plans 产出实施计划(task graph + wave 拆分)
3. 处理旧 plan/task 文件(标记 deprecated)
