---
featureId: luban-ai-assistant-plan2
title: Luban AI 助手 P2 — 设计稿/截图转页面（多模态）
createdAt: 2026-06-19
status: deprecated
deprecatedReason: 被 .agents/plans/2026-06-28-luban-ai-assistant-2026.md 替代(2026-06-28)。依赖的 plan1 选型过时且未落地;新方案将多模态作为显式延后项(见 2026-06-28 plan §10)。
supersededBy: luban-ai-assistant-2026
taskGraph: docs/superpowers/tasks/luban-ai-assistant-plan2.json
contractSource: plan-template 命令体 + writing-plans SKILL + PLAN_WRITING_CONTRACT.md
scope: 多模态设计稿转页面能力；复用 P1 的 provider/schema/agent/api/面板基建
split: plan-2（本 plan）= 设计稿转页面多模态；前置 plan-1（生成/编辑+引导+切换+集成）；关联 program: luban-ai-assistant-program
branches: ai 子仓 feature/luban-ai-assistant-plan2；engine 子仓 feature/luban-ai-assistant-plan2 同名分支
---

# Luban AI 助手 P2 — 设计稿/截图转页面（多模态）

> **验收口径(MUST)**：真实用户在 luban 编辑器中能完成 `AI 面板选"设计稿"→ 拖入/粘贴/选择设计稿图片 → 流式看到多模态理解（布局/组件/文字）→ 生成 PageSchema → 原图↔schema 对照预览 → HITL 确认 → 落到画布可撤销` 全链路；三家视觉模型（GLM-V/DeepSeek-VL/Qwen-VL）切换均能跑通；eval 样本集合法率/还原度达标基线；无骨架/占位/假绿。

> **前置硬依赖**：本 plan 依赖 plan-1 已交付的 LLM provider 适配层、Pydantic schema 校验闸、LangGraph 基建、FastAPI 流式/JWT/guardrails、engine AI 面板与画布 API 收口、MinIO bucket（P1 预建 `ai-assets`）。plan-1 未完成则本 plan 不启动。

## 模板适用性裁剪声明

| 契约条款 | 本 plan 适用性 | 理由 |
|---|---|---|
| 双后端契约一致(§6.2/禁令12) | ❌ 不适用 | Python AI 服务，无 Java/Go |
| 多端渲染一致(禁令13) | ❌ 不适用 | 编辑器侧能力 |
| 物料 schema(§6.4) | ⚠️ 间接 | 不新增物料；生成 schema 须符合 propsSchema（复用 P1 校验闸） |
| E2E 绑正式路由(禁令8) | ✅ 适用 | engine 设计稿 UI 走正式编辑器路由 |
| 其余(TDD/禁假绿/门禁/FeatureGate/安全审查/§9/禁分期) | ✅ 完全适用 | — |

## §0 概览

在 P1 基础上新增"设计稿/截图转页面"能力：用户上传设计稿图片（Figma 截图/PDF 页/手绘/任意 UI 图），多模态视觉模型（GLM-V/DeepSeek-VL/Qwen-VL，随 P1 MODEL_PROVIDER 切换）直接读图理解布局、识别组件、提取文字（**不引入独立 OCR**，由 VLM 承担），映射到 luban 物料生成 PageSchema，经校验闸 + HITL 确认后落到画布。

## §1 需求溯源（gap→task 矩阵）

| Gap（证据） | 层级 | task | 验收 | 门禁 |
|---|---|---|---|---|
| 无设计稿转页面能力（P1 §10 显式延后至本 plan） | L0 | P2-T1~T4 | 上传→生成→落地链路 | G3/G4 |
| 无多模态能力（P1 provider 仅文本） | L0 | P2-T1 | 图片输入抹平三家 | G3 |
| 无图片存储（MinIO bucket P1 预建未用） | L0 | P2-T1 | 上传/presigned | G3 |
| 设计稿→物料映射规则未定义 | L0 | P2-T2 | 映射可测 | G3 |
| 无生成质量评测 | L1 | P2-T5 | eval 基线 | G3 |

无遗漏：用户确认能力②（设计稿转页面）全部映射 P2-T1~T5。

## §2 系统与链路

**涉及子系统**：luban-ai-assistant（Python，扩展）/ engine/luban（TS/Vue3 扩展 AI 面板）。不涉及 bff/website/ui/backend。

**主链路（设计稿转页面）**：
```
用户在 AI 面板选"设计稿" → 拖入/粘贴图片
  → engine 上传 multipart → POST /ai/design-to-page (SSE, Bearer JWT)
  → FastAPI 验 JWT + 图片类型/大小校验 → MinIO 存原图(presigned)
  → LangGraph design workflow:
      多模态理解(GLM-V 读图: 布局结构/组件类型/文字/层级)
      → RAG 检索匹配物料(把识别的组件映射到 luban 物料)
      → 生成 PageSchema(provider structured output)
      → Pydantic + 物料存在性/propsSchema/expression 沙箱 校验闸(复用 P1)
      → 失败回环重试
  → SSE 流式回传理解进度 + schema patch
  → 前端原图↔生成 schema 对照预览 → HITL 确认
  → usePageEditorApi 落地 + history.push(可撤销, 复用 P1)
```

## §3 业务逻辑

**design job 状态机**：`uploaded → understanding → generating → validating → awaiting_confirm → applied | rejected | failed`。
- understanding：多模态读图阶段（流式上报识别到的布局/组件）
- validating：校验闸（复用 P1）
- awaiting_confirm：HITL（整页生成须确认）
- failed：理解失败/校验回环超限/图片不合法

**事务边界**：同 P1——生成的是待确认 patch，确认后才落地；图片存 MinIO（原图保留供对照），job 元数据存 `ai_design_jobs` 表。

**业务规则（设计稿→物料映射）**：
- 布局容器（栅格/分栏/卡片）→ `LubanContainer`/`Row`/`Col`/`Card`
- 数据展示（表格/列表）→ `LubanTable`/`LubanList`（绑空 datasource 占位，标注"需配置数据源"）
- 表单（输入/选择/按钮）→ `LubanForm` 物料组
- 导航（菜单/标签）→ `LubanMenu`/`LubanTabs`
- **文字提取由 VLM 直接读**（替代 OCR）；识别不确定的组件→占位 + 标注"需人工确认"，不强行猜测
- 生成须符合物料 propsSchema（校验闸强制，复用 P1）
- 图片尺寸/类型白名单（jpg/png/webg/webp，≤10MB），非法→400 INVALID_ARGUMENT

**精度边界（诚实声明）**：多模态直接读图对常规设计稿精度足够；极端密集表格/极小字号/非标准组件，还原度可能下降——此时走"占位+标注待确认"，**不静默产出错误 schema**。这是用 VLM 替代独立 OCR 的已知 trade-off（用户已确认不引入独立 OCR）。

## §4 页面结构

### §4.0 入口表
| 路由 | 视图 | 状态 |
|---|---|---|
| /sites/:siteId/pages/:pageId/edit | PageEditor（AI 面板 + 设计稿 tab） | 改动 P2-T4（在 P1 面板上加 tab） |

### §4.2 设计稿交互链
1. AI 面板切"设计稿" tab（FeatureGate ai.design_to_page 关则隐藏）
2. 拖入/粘贴/选择图片 → 客户端预检（类型/大小）→ 上传进度
3. 上传完 → 流式显示理解进度（"识别到：页面标题 / 顶部导航 / 数据表格 / 分页…"）
4. 生成完 → 原图↔schema 对照预览（左原图缩略，右 schema 树形/预览）
5. [应用到画布] HITL 确认 / [拒绝] → 应用后入撤销栈

### §4.3 设计稿面板结构
```
┌─AI 助手 [对话] [引导] [设计稿] ─┐
├────────────────────────────────┤
│ ┌─拖入图片或点击上传──────┐     │
│ │  [图片预览缩略]          │     │
│ │  支持 jpg/png/webp ≤10M │     │
│ └──────────────────────────┘    │
│ 理解进度:                        │
│  ✅ 页面布局: 顶部导航+主体表格  │
│  ✅ 组件: Table(用户列表)/分页   │
│  ✅ 文字: 标题"用户管理"…        │
│  ⏳ 生成 schema…                 │
│ ┌─对照预览─────────────────┐    │
│ │ [原图]   ↔   [schema 树]  │    │
│ │ 缩略图        Page         │    │
│ │              ├ Menu        │    │
│ │              ├ Table       │    │
│ │              └ Pagination  │    │
│ └───────────────────────────┘    │
│ [应用到画布] [拒绝]               │
└────────────────────────────────┘
```
四态：加载(理解/生成 spinner)/空(上传提示)/错(图片不合法/理解失败+重试)/成功(对照预览+确认)。不确定组件→预览中黄色标注"待确认"。

## §5 集成与复用
| 复用件 | 提供方 | 消费方 | 契约 |
|---|---|---|---|
| LLM provider 适配层 | P1-T2 | P2-T1(扩展 image) | Provider 增 `chat_with_image(messages, image)` |
| Pydantic schema 校验闸 | P1-T3 | P2-T2 | 复用 PageSchema 校验/物料/沙箱 |
| RAG 物料检索 | P1-T4 | P2-T2 | 检索匹配物料 |
| LangGraph/checkpoint/FastAPI/JWT/guardrails/Langfuse | P1-T5/T6/T7 | P2-T2/T3 | 复用基建 |
| MinIO bucket ai-assets | P1-T1(预建) | P2-T1 | 图片存取 |
| AI 面板/usePageEditorApi/撤销栈/FeatureGate | P1-T8 | P2-T4 | 加 tab，复用落地 |
| PageSchema 形态 | luban-low-code | P2-T2 | 同 P1 |

## §6 架构边界 + 门禁

### §6.1 分层
- 多模态理解 + 映射 + 生成：luban-ai-assistant（Python 扩展）
- 上传 + 对照预览 + 落地：engine/luban（TS 扩展面板）
- 边界：multipart 上传 + SSE 流式 + JWT（复用 P1）

### §6.2 双后端 parity
**不适用**：Python AI 服务无 Java/Go。

### §6.3 覆盖率门禁
AI 服务 85% · engine 85%。

### §6.4 物料 schema
不新增物料。生成须符合既有 propsSchema（复用 P1 校验闸）。

### §6.5 FeatureGate
| 功能 | key | 作用域 | 关闭行为 |
|---|---|---|---|
| 设计稿转页面 | ai.design_to_page | engine+ai | 隐藏"设计稿" tab；/ai/design-to-page 返回 503 |

## §7 测试计划

### §7.1 主路径
**AI 服务侧（pytest）**：多模态 provider 图片消息抹平（mock 三家）/ MinIO 上传下载 presigned / design workflow 各节点 / 映射规则 / 校验闸复用 / 图片白名单 / SSE 流式 / JWT。
**engine 侧（Playwright 正式路由）**：上传 → 理解进度 → 对照预览 → 确认 → 落地 → 撤销；FeatureGate 关闭隐藏 tab。
**多租户隔离（MUST）**：A 用户设计稿/job B 不可见。

### §7.2 脚本保障
- 首个失败即停；禁假绿（VLM 调用 mock，eval 用真实样本集）
- 环境预检：AI 服务 + MinIO 起；engine E2E 全栈起齐

### §7.3 用例（节选）
| 场景 | 前置 | 操作与断言 | 清理 |
|---|---|---|---|
| 设计稿转页面 | 登录+建空页 | 上传图→流式→对照→确认→断言画布有 Table/Menu | 删页+删 job |
| 图片白名单 | - | 上传非图/超 10M → 断言 400 | - |
| 模型切换 | 三家视觉 key | 切 MODEL_PROVIDER 三家冒烟读图 | - |
| 不确定组件 | mock VLM 不确定 | 断言占位+待确认标注 | - |
| 多租户隔离 | A/B 用户 | A job B 不可见 | 删 job |

### §7.4 路由合规
engine E2E 全走正式路由 `/sites/:siteId/pages/:pageId/edit`，**无新增 pages/e2e/***。

## §8 TDD + 执行
- TDD：图片消息抹平/MinIO/映射规则/design workflow 节点/白名单 先单测红→绿
- 并行：Wave0 P2-T1 → Wave1 T2→T3 → Wave2 T4 ∥ T5
- 单期收口：P2-T1~T5 单次实现周期全完成
- **验证门**：
  - AI 服务：`uv run pytest --cov --cov-fail-under=85` + `ruff check` + `mypy app`
  - eval：`uv run python -m app.eval.runner`（样本集合法率/还原度达标基线）
  - engine：`pnpm test && pnpm build`
  - Docker：`docker compose up -d --wait`

## §9 实现任务派发

> 同 plan-1：luban-ai-assistant 为既有（P1 已建），本 plan 为扩展；文件路径基于 P1 结构增量。

### §9.1 文件变更总览
**luban-ai-assistant（Python，扩展）**：
`app/llm/provider.py`(+`chat_with_image` 抽象方法) · `app/llm/multimodal.py`(新，三家图片消息格式抹平: GLM-V/DeepSeek-VL/Qwen-VL image_url/base64 适配) · `app/storage/minio.py`(新，上传/下载/presigned/类型大小校验) · `app/agent/design_graph.py`(新，design workflow 状态图) · `app/agent/design_nodes.py`(新，understand_image/map_to_materials/generate/validate/hitl) · `app/agent/mapping_rules.py`(新，布局→物料映射规则) · `app/api/design.py`(新，POST /ai/design-to-page SSE multipart) · `app/api/assets.py`(新，GET /ai/assets/{key} presigned/代理) · `app/eval/dataset.py`(新，样本集加载) · `app/eval/runner.py`(新，Ragas/DeepEval 评测) · `app/eval/metrics.py`(新，合法率/还原度/物料正确性) · `tests/`(多模态/workflow/映射/eval，mock VLM) · `docs/design-to-page-mapping.md`(映射规则文档)

**engine/luban（TS/Vue3，扩展）**：
`src/views/page/components/AiAssistantPanel.vue`(+设计稿 tab) · `src/views/page/components/DesignUploader.vue`(新，拖拽/粘贴/选择+预检) · `src/views/page/components/DesignPreview.vue`(新，原图↔schema 对照) · `src/api/ai.ts`(+designToPage 上传+SSE 客户端) · `src/featuregates.ts`(+ai.design_to_page)

### §9.2 API 契约（扩展，复用 P1 鉴权/错误体）
- `POST /ai/design-to-page`（multipart/form-data，SSE）：req `{image:File, siteId, pageId, context?}` → 流式 event `{type:uploaded|understanding( {components:[...],layout,text})|generating|patch|confirm|done|error}`；400 INVALID_IMAGE（非图/超大）；401 UNAUTHENTICATED；503 AI_FEATURE_DISABLED
- `GET /ai/assets/{key}`：返回 presigned URL 或代理图片（仅 owner 可访问，按 job user_id 鉴权）
错误体复用 P1：INVALID_IMAGE / AI_DESIGN_UNDERSTAND_FAILED / AI_VALIDATION_FAILED。

### §9.3 数据库变更
```sql
CREATE TABLE ai_design_jobs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  site_id VARCHAR(36), page_id VARCHAR(36),
  image_key VARCHAR(255) NOT NULL,          -- MinIO key
  status VARCHAR(32) NOT NULL DEFAULT 'uploaded',  -- uploaded/understanding/generating/validating/awaiting_confirm/applied/rejected/failed
  result_schema_json JSONB,                 -- 生成结果（待确认）
  model_provider VARCHAR(32), model_name VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_ai_design_jobs_user ON ai_design_jobs(user_id);
```
MinIO：复用 P1 `ai-assets` bucket，图片 key 规则 `designs/{userId}/{jobId}.{ext}`。

### §9.4 物料 schema
不新增物料。

### §9.5 组件接口
- `Provider.chat_with_image(messages, image_bytes|url, structured?)`：抽象方法，三家实现抹平图片消息格式
- `upload_image(user_id, bytes, mime) -> {key, url}` / `presigned_get(key) -> url`（MinIO）
- design workflow 节点：`understand_image / map_to_materials / generate / validate / hitl`
- `DesignUploader.vue` props/emits：`emit('uploaded', {key,url})`、`emit('progress', event)`
- `DesignPreview.vue` props：`{imageUrl, schema, uncertainNodes[]}`

### §9.6 并行派发计划（与 taskGraph 一致）
- Wave0：P2-T1(多模态 provider + MinIO)
- Wave1：P2-T2(design workflow) → P2-T3(API)
- Wave2 并行：P2-T4(engine UI) ∥ P2-T5(eval)
- 跨 plan 依赖：整体等 plan-1 完成（provider/schema/agent/api/面板/MinIO bucket 就绪）
- 主会话串行落盘；实现阶段 ai 服务线 ∥ engine 线

## §10 明确不做（防膨胀）+ 显式延后
**本期不做**（非静默跳过）：
- 独立 OCR（PaddleOCR）→ 已定用多模态 VLM 替代（精度边界见 §3）
- PDF 多页解析 / Figma API 直连 / Sketch 格式 → 本期只支持图片（jpg/png/webp），多页/PDF 延后
- 设计稿→样式像素级还原（颜色/字号/间距精确复刻）→ 本期只还原结构与组件，样式精确还原延后
- 批量设计稿转页面 / 整站生成 → 延后（需 Temporal 长流程，P1/P2 均未引入）
- 视频/动效理解 → 延后

## 质量禁令自检（逐条）
- [x]1 禁跳过功能（能力②全映射 P2-T1~T5） - [x]2 禁假绿（VLM mock 单测，eval 真实样本） - [x]3 禁占位 - [x]4 禁骨架 - [x]5 禁 JSON 代页面（有对照预览） - [x]6 交互完整(§4.2) - [x]7 验收=可交付链路 - [x]8 E2E 绑正式路由 - [x]9 门禁分级(G1-G4) - [x]10 /luban-review 清零 - [x]11 安全(图片/PII/MinIO 访问控制) - [x]12 双后端一致（不适用） - [x]13 多端一致（不适用） - [x]14 FeatureGate

## 分级验收门禁
| 级 | 验证 | 通过 | 责任 |
|---|---|---|---|
| G1 | /luban-review | 🔴🟡🔵 全清零 | owner |
| G2 | OWASP 自查 + 图片上传安全(类型/大小/SSRF via image)+ MinIO 访问控制 + PII(截图数据) | 无高中危 | owner |
| G3 | ai `pytest --cov 85%`+`ruff`+`mypy`+eval 基线；engine `pnpm test 85%`+`pnpm build` | 达 §6.3 | owner |
| G4 | Playwright 正式路由设计稿主链路 + 三家视觉冒烟 | 全绿无 skip | owner |

## 敏感字段
- 设计稿图片：可能含业务数据/PII（截图带用户信息）→ MinIO 私有 bucket + presigned 限时访问 + 按 user_id 鉴权；进 Langfuse trace 前脱敏/降采样
- VLM API key：仅环境变量，禁明文日志
- 复用 P1：JWT/AUTH_JWT_SECRET/LLM key

## 回滚
- 设计稿功能异常 → 关 FeatureGate `ai.design_to_page`（隐藏 tab，**首选**）
- VLM 理解质量不达标 → 降级提示"请用自然语言描述"（回退 P1 对话生成）
- MinIO 故障 → 上传失败明确报错（不静默）
- 无 luban 业务库变更 → 无 DB 回滚负担；`ai_design_jobs` 为 AI 服务自有表，可清空重建

## Post-Dev Workflow
代码提交 → **/luban-review 清零** → 编译（ai `ruff`/engine `pnpm build`）→ 单测覆盖率 + eval 基线 → 询问用户跑 E2E（Playwright 设计稿链路 + 三家视觉冒烟）→ `make test-coverage` 汇总 → 完成汇报。实现会话须一次推进至验证全绿后汇报。

## 关联
- 上游 program：`2026-06-19-luban-ai-assistant-program.md`
- 前置 plan-1：`2026-06-19-luban-ai-assistant-plan1.md`（provider/schema/agent/api/面板/MinIO bucket 就绪后方可启动）
