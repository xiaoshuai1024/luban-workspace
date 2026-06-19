---
featureId: luban-ai-assistant-program
title: Luban AI 助手项目集（Program）— 独立 Python AI 子项目
createdAt: 2026-06-19
status: approved
program: true
taskGraph: docs/superpowers/tasks/luban-ai-assistant-program.json
contractSource: plan-template 命令体 + writing-plans SKILL + PLAN_WRITING_CONTRACT.md
scope: 为 luban 低代码平台建独立 AI 助手子项目（Python 核心 + Vue3 前端集成），submodule 引入 packages/ai/luban-ai-assistant
split: 拆 plan-1（生成/编辑+引导+切换+集成）/ plan-2（设计稿转页面多模态）；本文件为聚合 program
branches: ai 子仓 feature/luban-ai-assistant-<plan>；engine 子仓 feature/luban-ai-assistant-<plan> 同名分支
---

# Luban AI 助手项目集（Program）

> **本文件是 program 聚合**：技术选型总纲 + 两份 child plan 的关联与依赖 + 共享基建。具体实现细节见各 child plan。本 program 不替代 child plan 的 §0-§9。

## 1. 项目定位

为 luban 低代码平台建独立 AI 助手子项目 `luban-ai-assistant`，通过 git submodule 引入 `packages/ai/luban-ai-assistant`（当前空目录，默认分支 main，可单独维护）。

- **语言分栈**：AI 核心 Python（生产级），前端画布集成 TS/Vue3 消费流式 API
- **部署**：用户测试服务器（已装 Docker，无 GPU），Docker Compose 一键起 6 容器
- **约束**：生产级 + 可扩展，不做 MVP/临时方案；只引入必要组件；全栈开源可本地部署（LLM 走云端付费已接受）

## 2. 技术选型定稿（锁死，多轮用户确认）

| 层 | 选型 | 关键决策 |
|---|---|---|
| 运行时 | Python 3.12 + uv | AI/ML 生态主流 |
| Web 服务 | FastAPI | SSE/WebSocket 流式 |
| Agent 编排 | LangGraph | 状态图 + checkpoint + HITL（重型） |
| LLM | 云端，默认智谱 GLM-4(+GLM-V)，可切 DeepSeek/通义 | LangChain ChatModel + provider 适配层，运行期单一不协同 |
| 结构化输出 | structured output + instructor + Pydantic v2 | 应用层逼近合法（已接受放弃 token 级约束解码） |
| RAG | Milvus + 云端 embedding + hybrid 检索 | 去独立 rerank |
| OSS | MinIO | 资产存储 + Milvus 内部存储复用 |
| Milvus 依赖 | etcd | standalone 必需 |
| 持久化 | PostgreSQL | checkpoint + 会话 + 元数据 + Langfuse |
| 可观测 | Langfuse（自托管） | trace/eval |
| 部署 | Docker Compose，6 容器，无 GPU | fastapi/postgres/milvus/etcd/minio/langfuse |

**已确认 trade-off**：放弃本地 vLLM（换短时间 + 免运维）→ 云端 API 付费 + "完全合法"降级为应用层逼近（structured output + Pydantic + 重试）。

**明确不引入**：本地 vLLM/GPU · 独立 OCR(PaddleOCR，用多模态替代) · 独立 Reranker · LiteLLM 多模型网关(provider 适配层替代) · LlamaIndex/RAGFlow 重框架(自写轻量) · Temporal(LangGraph checkpoint 替代) · Java/Go 后端改动 · website SSR/多端渲染 · 新增 luban-ui 物料。

## 3. Child Plan 关联与依赖

```
plan-1（生成/编辑 + 引导 + 切换 + 引擎集成）   wave 0
   │  交付共享基建：provider 适配层 / Pydantic schema 校验闸 /
   │  LangGraph agent / FastAPI 流式+JWT+guardrails / engine AI 面板 +
   │  画布 API 收口 / MinIO bucket / Langfuse
   ▼
plan-2（设计稿转页面多模态）                  wave 1，dependsOn: plan-1
      扩展：多模态 provider(图片输入) / design workflow /
      MinIO 图片存取 / 设计稿 UI / eval
```

| child plan | 文件 | taskGraph | 依赖 |
|---|---|---|---|
| **plan-1** | `.agents/plans/2026-06-19-luban-ai-assistant-plan1.md` | `docs/superpowers/tasks/luban-ai-assistant-plan1.json` | 无（首发） |
| **plan-2** | `.agents/plans/2026-06-19-luban-ai-assistant-plan2.md` | `docs/superpowers/tasks/luban-ai-assistant-plan2.json` | plan-1（共享基建就绪后启动） |

**关键约束**：plan-1 与 plan-2 是**两份独立 plan**（非分期同一方案，符合禁分期）。plan-2 复用 plan-1 的全部基建，只在 provider 加 image 能力、加 design workflow、加 MinIO 图片存取、加设计稿 UI、加 eval。

## 4. 共享基建（plan-1 交付，plan-2 复用）

| 基建 | plan-1 task | plan-2 复用方式 |
|---|---|---|
| LLM provider 适配层 | P1-T2 | P2-T1 扩展 `chat_with_image` |
| Pydantic schema 校验闸 | P1-T3 | P2-T2 直接复用 |
| RAG 物料检索 | P1-T4 | P2-T2 检索匹配物料 |
| LangGraph/checkpoint | P1-T5 | P2-T2 新增 design workflow 子图 |
| FastAPI/JWT/guardrails/Langfuse | P1-T6/T7 | P2-T3 复用端点骨架 |
| MinIO bucket ai-assets | P1-T1 预建 | P2-T1 启用图片存取 |
| engine AI 面板/画布 API/撤销栈/FeatureGate | P1-T8 | P2-T4 加"设计稿" tab |

## 5. 部署拓扑（两份 plan 共用）

```
Docker Compose（测试服务器，无 GPU）
├── fastapi       (AI 服务: LangGraph + provider + RAG + guardrails)  CPU
├── postgres      (checkpoint + ai_sessions + ai_design_jobs + Langfuse) CPU
├── milvus        (向量库: luban_materials collection)               CPU
├── etcd          (Milvus 依赖)                                       CPU
├── minio         (OSS: ai-assets bucket + Milvus 内部存储)           CPU
└── langfuse      (可观测: trace/eval/dataset)                        CPU
        │  HTTPS
        ▼  智谱/DeepSeek/通义 云 API（GLM 文本/VL 视觉/Embedding）
        │  SSE/WebSocket + JWT Bearer
        ▼
   engine/luban (Vue3: AI 面板 + 画布 API 收口 + 撤销栈)
```

### 部署通道（测试服务器）

```
开发者本地 / CI
   │  SSH（连接信息来自仓库根 .env.dev，运行时注入，禁硬编码）
   ▼
测试服务器（已装 Docker，无 GPU）
   │  docker compose up -d --wait
   ▼
6 容器（fastapi/postgres/milvus/etcd/minio/langfuse）
```

**SSH 凭证保密（MUST）**：
- 测试服务器 SSH 信息存于仓库根 `.env.dev`（已确认：被 `.gitignore` 的 `.env.*` 规则排除、未被 git 跟踪、未入仓 ✅）
- 部署脚本 `deploy/deploy.sh` 运行时 `source`/dotenv 加载 `.env.dev` 注入 SSH 连接信息，经 SSH/SCP/rsync 推送 compose 配置与服务到测试服务器
- **禁止**在 plan / 脚本 / 文档 / 日志 / git / 对话任何位置硬编码 SSH 明文（host / user / port / key / password）；一律运行时从 `.env.dev` 注入
- CI 部署时 SSH 凭证经 GitHub Secrets（或等价密钥管理）注入，不落盘明文；`.env.dev` 不得提交 / 截图 / 贴入对话

## 6. 验收口径（program 级）

- **plan-1 完成定义**：用户能自然语言生成/编辑页面、AI 引导、三家模型切换、引擎面板集成落地可撤销——全链路在正式编辑器路由跑通 + AI 服务单测 85% + engine 不退化
- **plan-2 完成定义**：用户能上传设计稿图片→多模态理解→生成→对照预览→确认落地——全链路 + 三家视觉冒烟 + eval 达标基线
- **统一门禁**：G1 /luban-review 清零 → G2 安全 → G3 单测覆盖率（ai 85%/engine 85%）→ G4 Playwright 正式路由 E2E

## 7. 模板适用性裁剪（program 级声明）

本 program 为独立 Python AI 子项目，对 plan-template 全栈契约裁剪：
- ❌ 不涉及：双后端（Java/Go）、多端渲染（website/electron/flutter）、Flyway、新增 luban-ui 物料、BFF 改动
- ✅ 完全适用：TDD、禁假绿、分级门禁、FeatureGate、安全审查、§9 并行派发、禁分期、E2E 绑正式路由（engine 侧）

## 8. 实施顺序

1. **plan-1 Wave0**：项目骨架 + Docker（P1-T1）→ provider 适配层（P1-T2）
2. **plan-1 Wave1**：schema 校验（P1-T3）∥ RAG（P1-T4）
3. **plan-1 Wave2**：LangGraph（P1-T5）→ API（P1-T6）∥ guardrails+Langfuse（P1-T7）
4. **plan-1 Wave3**：engine 集成（P1-T8）∥ 引导（P1-T9）→ 联调（P1-T10）
5. **plan-1 全部门禁通过 → plan-2 启动**
6. **plan-2 Wave0**：多模态 provider + MinIO（P2-T1）
7. **plan-2 Wave1**：design workflow（P2-T2）→ API（P2-T3）
8. **plan-2 Wave2**：engine 设计稿 UI（P2-T4）∥ eval（P2-T5）
9. **plan-2 全部门禁通过 → program 收口**
