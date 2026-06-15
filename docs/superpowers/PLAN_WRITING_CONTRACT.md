# 方案编写契约（`writing-plans` 产出物）

本文档定义 **`docs/superpowers/plans/*.md`** 在「大规模编码前」**必须**包含的章节与质量条，与 [docs/SUPERPOWERS.md](../SUPERPOWERS.md)、[docs/dev/ssot-task-graph.md](../dev/ssot-task-graph.md)、[docs/dev/agent-workflow-constraints.md](../dev/agent-workflow-constraints.md)、`.agents/rules/luban-plan-contract.md`、`.agents/rules/luban-task-graph-ssot.md` 配合使用。

> 本契约由 kangdou-fullstack `PLAN_WRITING_CONTRACT.md`（2026-05-13 版）适配到 luban-workspace 的子系统、规则文件、分支策略与 task graph schema。

加载 **`writing-plans`** 编写或实质性修改 plan 时，须满足本契约；任务依赖与状态以 **`docs/superpowers/tasks/<featureId>.json`** 为唯一事实源（SSOT），schema 见 [docs/dev/ssot-task-graph.md](../dev/ssot-task-graph.md)。

### 产品交付硬约束（MUST，对齐 CLAUDE.md 硬约束）

编写或定稿 plan 前须阅读 [`CLAUDE.md`](../../CLAUDE.md)「硬约束」与 [`AGENTS.md`](../../AGENTS.md)。方案正文须可核对：**信息与代码必须真实，禁止推测/假信息**；**低代码引擎交付门槛**（`pnpm run build` 成功 + 渲染器零新增 console error + 物料 props schema 合规）；**双后端行为一致**（Java/Go 同接口契约一致，例外须显式声明并经用户确认）；**E2E 禁止跳过/假绿**；**数据与接口依赖**（§3、§4、§7）；定稿与上线前 **文档—实现全量功能审查** 的安排（不得仅主路径一句带过）。

### 推荐入口与 Agent 提醒（MUST）

- **用户**：编写或迭代 luban **全栈实现方案**时，**推荐**先发送 **`/plan-template`**。该流程约定 **第一轮仅讨论稿**（范围、假设、编号待确认问题、各系统拟增量、「明确不做（防膨胀）」草案等）→ **用户补充或拍板** → **第二轮**再按本契约输出可落盘 `docs/superpowers/plans/*.md` 定稿（含文首 `taskGraph`、§4.0 / §4.2 / §4.3、§7 等）。
- **Agent**：当用户表达 **写方案 / 技术方案 / 实现计划 / 做 plan / roadmap 落盘** 等意图，且**当轮对话未**显式使用 **`/plan-template`** 时，须在**作答开头或紧随其后的短段落**中 **主动建议**用户使用 **`/plan-template`**，并说明：**讨论稿先对齐范围**、**定稿再满足本契约**。用户已发送该命令、已明确拒绝、或已声明沿用其他经认可的方案流程时，**不必重复纠缠**。

### 方案阶段与两门禁 Skill（MUST）

大规模编码前，方案须**同时**可被 **[`architecture-review-e2e-tdd`](../../.agents/skills/architecture-review-e2e-tdd/SKILL.md)** 与 **[`ux-product-review`](../../.agents/skills/ux-product-review/SKILL.md)** 核对——不要求把对话全文贴进 plan，但须在下列章节给出**可对齐 skill 模板的结构化摘要**（见 **§4.0、§4.1、§4.2**、§6.1、**§7、§7.2**），并在验收阶段按 [docs/dev/agent-workflow-constraints.md](../dev/agent-workflow-constraints.md) 再做一轮收口。

| Skill | 方案阶段落点（本契约） | 推荐触发方式 |
|--------|------------------------|--------------|
| **architecture-review-e2e-tdd** | §3 业务逻辑、§4（含 **§4.0** 新增模块、**§4.2** 列表级交互链、**§4.3** 页面结构/原型）、§7（含 **§7.2** 脚本保障逻辑）、§6.1 架构与 E2E 门禁自检 | 写/改 plan 时加载该 skill，对照其 §2（计划须含业务逻辑、交互流、E2E 用例计划）自检 |
| **ux-product-review** | §4.1 UX 自检摘要；涉及用户可见流程时对照四主轴与 rubric | 可用 **`/super-pm`** 或显式加载 skill，将 **阻断 / 强烈建议 / 可选** 精简写入 plan |

---

## 0. 文首 YAML 与任务图

- 文首 YAML 须包含 **`taskGraph`**，指向本 feature 的 `docs/superpowers/tasks/<featureId>.json`。
- **同一变更批次**创建或更新该 JSON；提交前执行：  
  `node scripts/verify-plan-ssot.mjs validate <path-to-json>`（注：当前脚本为 stub，JSON 合规性人工保证，不宣称"校验通过"；本声明在脚本实现真校验后删除）。
- 任务图 JSON 须符合 [docs/dev/ssot-task-graph.md](../dev/ssot-task-graph.md) schema：`subsystem` 取值 `engine`/`bff`/`ui`/`web`/`backend-java`/`backend-go`/`client`/`cross`；`status` 取值 `pending`/`in_progress`/`completed`/`blocked`；`group` 标并行组（同 group 可并行，但同 group 内仍可存在串行依赖，执行以 `dependsOn` 为准），`dependsOn` 标依赖。可选 `wave` 数值字段与 `group` 须一致（人类可读波次）；schema 强制字段以 SSOT 为准。

### 0.1 分支与阶段（MUST，对齐 luban GIT_WORKFLOW §〇.4–〇.5）

方案须包含 **「分支与仓库」** 小节，明确 **方案编写阶段** 与 **执行阶段** 的分支策略，并与 [docs/GIT_WORKFLOW.md](../GIT_WORKFLOW.md) **§〇.4–〇.5** 一致：

| 阶段 | 须写明的内容 |
|------|----------------|
| **方案编写** | 撰写/迭代本 plan 时所在分支（主仓 `luban-workspace` 与各子模块）；luban 维护者通常已在工作分支中打开 workspace，plan 须声明当前分支。 |
| **执行（大规模编码）** | luban 策略：**用户分支优先，Agent 不自动新切分支**（§〇.4）。若需新建 `feature/<主题>`，须用户明确指令。禁止在默认分支（master/main）上直接开发式提交。 |

**多仓同名分支（MUST，§〇.5）**：跨子模块的多仓任务，各子模块（engine/bff/ui/website/backend-java 等）**必须使用同名工作分支**，与 [GIT_WORKFLOW.md](../GIT_WORKFLOW.md) §〇.5「任务级分支规则」对齐。

**执行纪律（Agent / 人）：** 进入执行、发生首次对 Git 跟踪文件的写入前，须按 [GIT_WORKFLOW.md](../GIT_WORKFLOW.md) §〇.4 在**被修改文件所属的 Git 仓库**内确认当前分支；默认留在用户当前分支，**不得自动 `checkout -b`**；分支不匹配时**先询问用户**。方案与实现分支**不得长期漂移**。

---

## 1. 需求溯源

- 链接 **《原始需求》SSOT** 路径（例如架构设计文档 `packages/docs/luban-architecture-design/`）；若无外部文件，说明需求来源（用户对话确认）并附关键摘录。
- **非目标**（明确不做）与 **变更记录**（相对 SSOT 的增补/裁剪）须可追踪。

---

## 2. 背景与目标

- 业务问题与用户/运营价值；可度量的成功标准或对账方式。

---

## 3. 业务逻辑与契约假设

- 领域对象、**状态变迁**、与后端/API 的假设（错误模型、多租户 siteId 隔离、权限边界）。
- **状态穷举**：涉及状态流转的功能（如 Lead 状态机、页面 status），须用表格列出**所有状态、合法转换、各转换的前置条件与后置效果**。
- **双后端契约**：新增/修改的每个接口须声明 Java 与 Go 两端实现状态（均实现 / Go 延后并标注）；响应体字段、错误码、状态机须一致。见 `.agents/rules/luban-dual-backend-parity.md`。
- **双后端声明标准模板**（MUST，plan §3 或 §9.2 须含此表）：

  | 方法 | 路径 | Java 状态 | Go 状态 | 差异原因 |
  |------|------|-----------|---------|----------|
  | GET  | /backend/x/y | 已实现 | 延后 | 本期范围外（经用户确认） |
  | POST | /backend/x/z | 已实现 | 已实现 | — |
- 影响多端的契约（PageSchema、物料 props schema）须写明版本或兼容策略。

---

## 4. 交互与界面设计摘要

- **主路径**：用户操作 → 系统响应（分步列表）。
- **入口表**：菜单 / 路由 / 页面 / 关键 API（与角色、siteId 相关时注明）。
- **加载 / 空 / 错态**要点。
- **UX 组件选型**：表单/筛选器中的集合选择项（状态、类型、角色等）须注明用 ElSelect/Dropdown 而非 ElInput；日期/时间须用 ElDatePicker。对齐 `.agents/rules/luban-frontend-ux-enum.md`。
- **枚举值显示方案**：所有 status/type/state 字段在 UI 上的中文映射方案须写明（如 `LEAD_STATUS_LABELS` 映射、`<dict-tag>`、或后端返回 `xxxLabel` 字段），禁止直接暴露原始英文值。

### 4.0 按系统的新增功能模块（MUST）

方案须包含 **「按系统的新增功能模块」** 小节，用 **表格** 按仓库/系统列出本特性**本批次新建**的承载物（与 §5「将触碰的现有模块」区分：§5 写复用与改造，本条写**新增**）：

| 系统 / 仓库 | 新增模块或承载物 | 职责简述 | 与任务图 JSON 的对应 |
|-------------|------------------|----------|----------------------|
| `packages/backend/luban-backend` | 新 Controller、新表、新枚举 | … | 任务 id |
| `packages/engine/luban` | 新页面路由、新 View、新 store/composable | … | … |
| `packages/ui/luban-ui` | 新物料、新设计器内核组件 | … | … |
| `packages/bff/luban-bff` | 新 API route、新 lib | … | … |
| `packages/web/luban-website` | 新 composable、新页面 | … | … |
| `packages/backend/luban-backend-go` | 与 Java 同接口的 handler/service/repo（双实现） | … | … |
| `packages/client/*` | electron/flutter/cross-platform 渲染/桥接 | … | … |

某仓库**本特性完全不涉及**时（如 `backend-go` 本期延后），表中须有一行 **「本特性不涉及」** 并写理由；**禁止**整表缺失或仅写「见代码」。

### 4.1 方案阶段 UX 自检（MUST）

在 plan 中增加一节 **「UX 自检摘要」**，按 [`.agents/skills/ux-product-review/SKILL.md`](../../.agents/skills/ux-product-review/SKILL.md) 的输出结构给出精简结果：

- **阻断**（若有则须先解决再大规模编码）
- **强烈建议**
- **可选**

若本特性涉及 **管理后台**（`packages/engine/luban` 内路由/菜单），摘要中须**显式**体现已对照 `.agents/rules/luban-frontend-ux-enum.md`（枚举中文映射、Select vs Input、日期选择器）；完整逐条对照可在 **`/super-pm`** 全量 rubric 展开，plan 内至少汇总不符合 MUST 的项及拟处理方式。

不要求粘贴全文 skill，但须体现已对照 **§「审查维度」与 rubric 标题**（摘要、阻断、强烈建议、可选、需求对照等）做过方案阶段审视；**阻断**项若有，须说明拟处理方式或为何可延后（默认：阻断未处理则不进入大规模实现）。

### 4.2 列表级交互链路（MUST）

在 **§4**「主路径」叙述之外，须对本特性涉及的 **每个关键列表 / 表格页**（引擎管理后台、website 若存在列表）分别给出 **列表级交互链**：从「进入该页」到「完成本特性相关目标」止，用 **有序列表或小表** 逐步写清 **用户操作 → 预期 UI 反馈 → 触发的读/写 API 或领域状态变化**（一步一响应，不得合并为单句口号）。

若某端**无数列表页**（仅单页表单等），须显式写 **「无数列表页」**，并给出该端 **唯一主界面** 的同等粒度交互链。

### 4.3 页面结构展示与高保真原型（MUST）

凡本批次 **新增或实质改动** 的 **引擎渲染 / website / 客户端** 页面，定稿须在 **§4** 内对 **每一受影响页面** 给出 **页面结构展示**，使实现方 **不依赖 Figma** 也能对齐版式与交互密度。须写清：主要区块与从上到下的信息顺序、列表/表单的关键列或字段、操作按钮/链接位置、空态与错态出现位置、与枚举/字典展示方案的衔接。**可用** Markdown 标题层级、列表、表格、简易 ASCII 线框等；**不得**仅用「按现有风格」一句替代。

若在方案阶段判定 **仅靠上述结构仍不足以约束** 复杂布局、多状态叠加或视觉层次，须在 **大规模编码前** 增加 **高保真原型**（与目标技术栈一致或可低成本迁入的 **可运行** 稿）。须写明：**原型如何访问**（路径/路由/启动方式）、**与正式页面的合并或下线条件**、以及 **不将 `pages/e2e/*` 专测页作为长期原型宿主**（与 [docs/E2E_AGENT_GUIDE.md](../E2E_AGENT_GUIDE.md) §1.1、`AGENTS.md` 一致）。

**本特性无前端变更** 时，须显式写 **「无前端页面」** 及理由，本小节不适用。

---

## 5. 集成与复用（必填表）

使用 **表格**列出：

| 将触碰的现有模块 / 服务 / 组件 / API | 复用方式或新建理由 |
|--------------------------------------|-------------------|

**禁止**空表无说明；若确实无集成点，写一行「无，纯局部 UI」并说明理由。

---

## 6. 架构与边界（方案阶段）

- 分层、模块边界、与现有架构的对齐说明（引擎渲染 → BFF 聚合 → 后端双实现）。
- 多租户 siteId 隔离、鉴权（X-User-ID/X-User-Role）、敏感展示（脱敏）vs 持久化（AES 加密）等（按特性启用）。

### 6.1 方案阶段架构 / E2E 自检（MUST）

在 plan 中增加一节 **「架构与 E2E 门禁自检」**，按 [`.agents/skills/architecture-review-e2e-tdd/SKILL.md`](../../.agents/skills/architecture-review-e2e-tdd/SKILL.md) 核对至少：

- 关键行为是否可由 **E2E 或稳定单测** 触发（避免脆弱选择器、无意义 sleep）。
- **用户旅程 → 拟映射的 E2E** 是否覆盖主路径与 P0 分支。
- 若涉及敏感读模型 / 脱敏（如 Lead 联系方式解密查看）：是否与架构审查 skill 中的 **脱敏回灌** 等红线对齐（适用则勾选已考虑项）。

---

## 7. E2E 测试计划

- **用户旅程** → 拟新增或修改的 spec 路径、`describe`/`it` 标题（可表格）。
- 区分 **P0（合并前必绿）** 与 P1+。
- 数据、fixture、环境依赖（含 skip 约定）须写明。
- **E2E 量化表**：按功能类型标注最少用例数（见 `.agents/rules/luban-testing-coverage.md`），并逐项确认在计划中已覆盖。

### 7.1 跨端 E2E 主路径（MUST，高优先级）

凡特性涉及 **多端或多系统**（例如 **website 访客提交 → BFF → backend-java**，或 **engine 设计器 → BFF 协作 → backend 版本** 等跨子仓库链路），本节须增加 **「E2E 主路径」** 小节（表格），每条路径至少包含：

| 列 | 必填内容 |
|----|-----------|
| **路径名** | 简短名称（如「留资提交闭环」「设计器协作」） |
| **入口端** | engine 路由 / website 路由 / API 起点 |
| **依赖服务** | backend-java `8080`、bff `3000`、engine `5173`（Vite）、website `4173`、MySQL、Redis、关键 schema.sql 版本等（端口来源：各子项目 `vite.config.ts` / `application.yml`；变更须同步本契约与 AGENTS.md） |
| **自动化命令** | 与 [docs/E2E_AGENT_GUIDE.md](../E2E_AGENT_GUIDE.md) 一致的**完整**命令（或明确写「尚无脚本，合入前须补」） |
| **P0 标记** | 是否合并前必绿 |

**禁止**仅用「会写 E2E」等笼统句替代可执行路径表。执行与合入门禁须遵守 `.agents/rules/luban-e2e-execution-contract.md`（禁止假绿、禁止降级已约定脚本、执行中测试冻结等）。

**含 UI 的特性（MUST）**：默认验收物为 **用户/管理员在界面上可完成的完整链路**；计划 §7 中 E2E 不得仅用后端 IT 或 REST 冒烟替代已承诺的 §4.2 交互链。

### 7.2 交互链路保障脚本逻辑（MUST）

对 **§7.1** 表中**每条**路径，须写清 **保障逻辑**（可在 §7.1 表格中**加列**扩写，或在本小节按路径逐条列出），至少包含：

| 要素 | 须写明的内容 |
|------|----------------|
| **覆盖的交互链** | 对应 **§4.2** 哪条列表链 / 主路径步骤编号或标题 |
| **前置数据与 fixture** | 谁创建、是否可重复跑、清理或隔离策略 |
| **关键断言** | 每步验证什么（HTTP、DB、UI 文案、禁止裸枚举英文、siteId 权限边界等）；何处 **失败即停** |
| **合并门禁** | 是否 P0 必绿；是否允许 skip 及条件 |

若脚本 **尚未落地**，「自动化命令」列仍须写 **「尚无，合入前须补」**，且 **本条不得省略**：须写 **拟** 保障逻辑（预期断言轮廓与数据依赖）。

---

## 8. TDD 与执行约定

- **分支：** 开始大规模编码前须完成 **§0.1** 所列「执行阶段」分支确认；与 [docs/GIT_WORKFLOW.md](../GIT_WORKFLOW.md) §〇.4–〇.5 一致（用户分支优先，不自动切）。
- 声明本特性遵循 [docs/dev/agent-workflow-constraints.md](../dev/agent-workflow-constraints.md)（先测后码、Console→Network→后端日志排查顺序、并行 subagent 条件）。
- 若使用并行 subagent，在 plan 中简述 **与 JSON 任务 id 的对应**及并行前提（契约冻结等）。

---

## 9. 风险、里程碑与开放问题

- 风险与缓解；未决依赖与责任人（若已知）。
- 里程碑：按任务图 wave/group 标注关键节点。

---

## 10. 验证命令引用

- 指向 `AGENTS.md` 与 `.agents/rules/luban-testing-coverage.md`；列出**本特性涉及子项目**须执行的命令子集（不必抄录全文）：
  - TS 仓（engine/bff/ui/website）：`pnpm install` / `pnpm test` / `pnpm run build` / `pnpm run test:e2e`
  - Java 后端：`mvn -q verify`（Surefire + Failsafe，Java 17）
  - Go 后端（若涉及）：`go test ./... -race -cover`
  - 全栈：`make test-coverage`

---

## 11. For agentic workers（推荐固定一句）

> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（推荐）或 `executing-plans`；按 checkbox 与任务图 JSON 推进；执行纪律见 [docs/dev/agent-workflow-constraints.md](../dev/agent-workflow-constraints.md)。

---

## 附录：定稿前 checklist

plan 写作者一键自检（逐项须打勾或注明不适用）：

| 章节 | MUST 自检项 |
|------|------------|
| §0 | YAML 含 `taskGraph` 指向真实 JSON；JSON 符合 `ssot-task-graph.md` schema（subsystem/status 合法） |
| §0.1 | 分支两阶段（方案编写/执行）；多仓同名分支 MUST；对齐 GIT_WORKFLOW §〇.4-〇.5 |
| §1 | 需求溯源（来源/摘录）+ 非目标（明确不做）+ 变更记录 |
| §2 | 背景与目标 + 可度量成功标准 |
| §3 | 状态穷举表（所有状态/合法转换/前置/后置）+ 双后端声明标准模板 |
| §4 | 主路径分步 + 入口表 + 加载/空/错态 + UX 选型（Select/DatePicker）+ 枚举中文映射 |
| §4.0 | 按系统新增功能模块表（覆盖 8 子系统，不涉及的显式声明） |
| §4.1 | UX 自检三档（阻断/强烈建议/可选）+ 运营后台枚举规范对照 |
| §4.2 | 每个关键列表/表格页的列表级交互链（操作→反馈→API/状态） |
| §4.3 | 每个受影响页面的页面结构展示（版式/列/字段/操作位/空错态） |
| §5 | 集成复用表（将触碰的现有模块 + 复用方式） |
| §6.1 | 架构与 E2E 门禁自检三要素（关键行为→测试/用户旅程→E2E/脱敏红线） |
| §7 | E2E 量化表 + P0 划分 + §7.1 跨端主路径表 + §7.2 保障脚本逻辑 |
| §8 | TDD 路径 + 分支确认 + 并行 subagent 与 task id 对应 |
| §9 | 风险、里程碑、开放问题 |
| §10 | 验证命令引用（涉及子项目命令子集） |
| §11 | For agentic workers 固定句 |

---

## 修订记录

| 日期 | 说明 |
|------|------|
| 2026-06-15 | 初版（luban 适配）：由 kangdou-fullstack `PLAN_WRITING_CONTRACT.md`（2026-05-13）适配到 luban-workspace 子系统（engine/bff/ui/website/backend-java/backend-go/client）、规则文件（luban-*）、分支策略（GIT_WORKFLOW §〇.4 用户分支优先）、task graph schema（subsystem + pending/in_progress/completed/blocked）。 |
