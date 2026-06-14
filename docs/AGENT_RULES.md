# Agent 遵守的规则（luban-workspace）

本文档整理 luban-workspace 开发过程中 Agent 需要遵守的核心规则，按类别组织。详细内容见各引用文档。

---

## 0. 语言

- 向用户**提问、确认、弹窗选项**默认**中文**；**禁止用英文询问**，除非用户明确要求英文。详见 `AGENTS.md` 与 `docs/interaction-preferences.md`（如存在）。

---

## 1. Git 与分支

详见 `docs/GIT_WORKFLOW.md`。

- 分支结构：各子项目保留现有默认分支（6 master + 5 main）；新提交统一 `feature/*`
- 每次 commit/push/PR 前必须**用户确认**
- 禁止直接 push 默认分支

### 合并与拉取（MUST）

- **禁止自动合并**：不得擅自完成 merge/rebase 并提交合并结果；发现冲突须**停手、说明、询问用户**再按指示操作。
- **用户要求 pull 前**：若工作区有未提交改动，须先与用户确认并完成 **commit**（或用户明确要求的 stash 等），再 `pull`。详见 `docs/GIT_WORKFLOW.md` 〇.6。

### GitHub 规则（MUST）

**全文见 [`luban-github-agile-agent.md`](../.agents/rules/luban-github-agile-agent.md)** 与 `docs/GIT_WORKFLOW.md`。

摘要：
- **gh CLI + GitHub MCP 优先**：GitHub / PR / Issue / Actions / Release 默认走 gh CLI + MCP Server
- **工作项写入**：Issue 创建/关闭、PR 合并、label 变更须先询问用户
- **PR 创建**：默认通过 `gh pr create` 或按包命令（`/pr-engine` / `/pr-bff` / ...）
- **缓存**：`.claude/state/github/`（不提交 Git）

---

## 2. 子任务执行

- **默认**：任何工作，只要能开启 subagent 进行，就尽可能多的开启 subagent 并行执行（**优先并行**，见 `AGENTS.md`「并行子 agent」）
- **拆分原则**：将任务拆分为多个独立的子任务，每个子任务有明确的范围、目标和交付物，无共享状态或顺序依赖
- **拆分场景**（包括但不限于）：
  - 多个文件的编辑（不同目录/模块）
  - 多个独立测试的修复
  - 多子项目（engine / bff / ui / website / backend / client）的并行开发
  - 方案阶段的并行信息收集与对读
  - 问题排查阶段的并行调查
- **主 agent** 负责拆分决策、编排与结果汇总
- 所有 agent（含 subagent）执行前必须先检查并加载 `.agents/skills/` 目录中的项目级技能文件
- 计划阶段前置收敛用户决策项；开发执行阶段默认持续推进，仅在阻塞时中断询问

### Task / Agent 工具与模型参数

- 调用 **`Task` / `Agent`** 工具派发子 agent 时，可以根据任务需要自由指定模型参数
- 可以直接使用 `model` 参数为不同的 subagent 选择合适的模型

---

## 3. 文档与计划

- **功能真相源**：以 `docs/FEATURES.md`（如存在）记录已实现、部分实现与未实现能力
- **计划文件**：阶段执行完毕后，将结论收敛到 `docs/FEATURES.md`，并删除对应 plan 文件
- **多仓**：各子项目（submodule）的说明需一致或指回主文档

### Superpowers 工作流（交叉引用）

实现类计划与执行的**技能级约定**见 **`docs/SUPERPOWERS.md`**（含 `brainstorming` → `writing-plans` → `executing-plans` 等触发条件）。

---

## 4. API 与通信

- **统一响应格式**：成功为业务 JSON；非 2xx 响应为：
  ```json
  { "code": "<ERROR_CODE>", "message": "<中文消息>", "requestId": "<...>" }
  ```
- **错误码**：`invalid_request`、`unauthorized`、`forbidden`、`not_found`、`internal_error` 等
- **分页响应**：`{ items, total, page, pageSize, hasMore }`，列表为空时 `items: []`，禁止 null
- **前端处理**：以 `error.response?.data?.code` 为主，勿假定响应体为 HTML 或非 JSON

---

## 5. 后端规则（Java — `packages/backend/luban-backend`）

- **本地运行**：修改 `packages/backend/luban-backend/`（Java、Flyway/迁移脚本、`application*.yml`、资源等）后，**必须重启**本地 Spring Boot（结束占用 `server.port` 的旧进程后再启动；常见 `SPRING_PROFILES_ACTIVE=local` + `mvn spring-boot:run`）。
- **接口与表结构**：新增或变更 REST 字段时须与迁移脚本及实际连接库对齐；禁止「缺列仍 200、数据没落库」。
- **日志**：
  - 第三方 API 调用必须打日志（INFO 摘要 + WARN/ERROR 失败日志）
  - 禁止输出密钥、`secret`、完整 `access_token`、用户敏感标识
- **接口测试与交工前验证（MUST）**：新增/修改接口须同步 `MockMvc` / `*IT` 等可执行测试，合并前 `mvn -q verify` 须通过；宣称完成或提交 PR 前，还须完成至少一项**可观测**的接口验证（Swagger Try it out、curl、或消费端 Network 确认）。
- **Swagger 约束（架构级）**：新增接口必须同时补齐 Swagger 信息，不得"先上接口后补文档"
- **包管理**：Java 仓用 Maven，禁用 Gradle
- **覆盖率**：80% line / 70% branch（JaCoCo，排除 config 包与 main 类）

---

## 6. 后端规则（Go — `packages/backend/luban-backend-go`）

luban 的 Go 后端与 Java 后端是**同一业务的双实现**，必须满足**行为一致契约**。

- **本地运行**：修改 `packages/backend/luban-backend-go/` 后，须重启 Go 服务（`go run` 或等价命令）
- **接口契约**：与 Java 端**完全一致**（路径、参数、响应体、错误码、状态机），详见 [`docs/DUAL_BACKEND_PARITY.md`](./DUAL_BACKEND_PARITY.md)
- **同步变更（MUST）**：改 Java 端的接口契约必须同步改 Go 端（反之亦然）；同一 PR 内完成两端改动
- **包管理**：Go 仓用 `go mod`
- **测试**：`go test ./... -race -cover`，覆盖率 75%
- **日志**：与 Java 端日志规范对齐（结构化、requestId 关联、PII 脱敏）

---

## 7. 前端规则（TS 仓：engine / bff / ui / website）

- **包管理**：所有 TS 仓统一 **pnpm**（`pnpm install`；勿默认使用 `npm install`）；禁用 yarn
- **依赖脚本**：不要使用 `npx`，命令须声明在 `dependencies` / `devDependencies`
- **枚举显示**：禁止直接显示英文原值，必须通过中文映射函数渲染（见 [`luban-frontend-ux-enum.md`](../.agents/rules/luban-frontend-ux-enum.md)）
- **组件库**：统一使用 `packages/ui/luban-ui` 注册的物料，禁止各端自造重复组件
- **覆盖率**：
  - engine / bff / website：85% line / 75% branch
  - luban-ui 物料库：90% line / 80% branch

---

## 8. 响应式设计 (RWD)

- **移动优先**：所有页面须在 320px ~ 1024px+ 下可用
- **断点**：
  - ≤960px：单列布局
  - ≤1100px：双列改单列
  - ≤520px：单列压缩
- **导航可达性**：窄屏下必须能到达核心业务能力
- **横向溢出**：表格须包在 `overflow-x: auto` 容器内

---

## 9. 多端一致性（luban 特有）

luban 通过低代码引擎驱动多端渲染（web / electron / flutter），同一业务能力必须各端一致。

- **业务逻辑一致**：可用功能集、状态机、权限边界、错误处理一致
- **数据契约一致**：各端消费的 BFF API 一致
- **UI 表现一致**（容许样式微调）：信息架构、操作入口、状态展示一致
- **用户旅程一致**：同一任务在各端的步骤数、关键节点一致

详见 [`luban-multi-client-consistency.md`](../.agents/rules/luban-multi-client-consistency.md)。

---

## 10. 低代码引擎合规（luban 最高优先级）

**这是 luban 平台的核心约束**（见 `CLAUDE.md` 硬约束 2）。

凡改动 `packages/engine/luban/` 或 `packages/ui/luban-ui/`：

- **构建门禁**：合并前 `pnpm run build` 必须通过
- **渲染零 console error**：交付后引擎渲染器不得出现因本次改动引入的 console error
- **物料 props schema 合规**：每个物料 MUST 声明 propsSchema（JSON Schema），详见 [`luban-material-schema.md`](../.agents/rules/luban-material-schema.md) 与 [`docs/LOWCODE_ENGINE_SPEC.md`](./LOWCODE_ENGINE_SPEC.md)
- **各端渲染一致**：引擎产物在 website（SSR）及多端渲染一致

详见 [`luban-lowcode-engine-quality.md`](../.agents/rules/luban-lowcode-engine-quality.md)。

---

## 11. 需求信息完整性（MUST）

### 11.1 禁止推测与无信息开发

任何开发或设计任务开始前，必须先确认需求和信息的完整性。详见 [`luban-no-speculation-no-blind-dev.md`](../.agents/rules/luban-no-speculation-no-blind-dev.md)。

### 11.2 必须明确的信息清单

开始编码前，必须确认以下信息已明确：

| 信息类别 | 检查项 |
|---------|--------|
| **需求背景** | 用户要解决什么问题？为谁解决？业务价值是什么？ |
| **功能范围** | 明确要做什么？**明确不做什么**？ |
| **用户流程** | 用户如何操作？每一步的输入、输出、系统响应是什么？ |
| **边界条件** | 异常情况如何处理？极限值、错误状态、权限边界？ |
| **验收标准** | 如何算完成？验收清单是什么？ |
| **技术方案** | 引擎能力、物料 schema、API 契约、双后端行为是否明确？ |

### 11.3 信息缺失时的处理流程

1. **立即暂停**：发现信息缺口时，立即停止当前工作
2. **结构化询问**：提供清晰的问题和选项
3. **等待确认**：在用户回复前，不进行推测性开发
4. **记录假设**：如用户授权可按经验处理，必须在代码/计划中明确记录假设

### 11.4 红线与例外

**红线（必须遵守）**：
- 需求只有一句话，没有用户故事 → 必须询问
- 技术方案存在多种选择 → 必须询问
- 验收标准缺失 → 必须询问
- 对用户意图有任何疑问 → 必须询问

**例外（可处理）**：
- 用户明确授权："你看着办"
- 极小的、不影响核心的细节（文案措辞等）
- 已有明确的先例或规范可复用

### 11.5 与 Superpowers 工作流的配合

- 新需求必须先经过 `brainstorming` 或 `/plan-template` 澄清
- 禁止跳过设计阶段直接编码
- 执行阶段必须有书面计划（见 `docs/SUPERPOWERS.md`）
