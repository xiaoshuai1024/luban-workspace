---
description: Luban 全栈方案：验收以可交付页面与完整链路为准（禁占位）；含 UI 时 §4 须逐页页面结构展示（MUST、勿需 Figma），不足以约束效果则先高保真原型再大规模编码；禁主路径收口即宣称完成；单方案须一次完成已定范围全部功能（禁分期）；引擎渲染 E2E 须走正式产品路由、禁新增 e2e 专页；最完整交付+控膨胀；架构+产品+设计；禁假绿/骨架；/10-bs 与多 skill；对齐 E2E-TDD 与 super-pm；先讨论再定稿；可行范围内尽量并行 Task/subagent；定稿须含实现阶段派发与收口；实现会话倾向一次做完本期范围并跑齐全量验证后再收口汇报；门禁含安全审查与 /luban-review 清零；FeatureGate 默认约束；双后端契约一致；多端渲染一致；敏感字段清单与加密约束；§9 实现任务派发（定稿时并行派发 subagent 填充文件映射/API契约/DDL/组件接口，统一输出）
---

触发：**`/plan-template`**。

**Agent 索引**：若用户用自然语言要求写实现方案却**未**发送本命令，须**主动建议**发送 **`/plan-template`**；义务、话术要点与例外见 **`docs/superpowers/PLAN_WRITING_CONTRACT.md`**「推荐入口与 Agent 提醒」。

## 角色预设（Luban workspace，Agent 默认扮演）

同时以三种视角工作（输出中可分区落笔，但决策须 **三者一致**、不得只顾一层）：

| 视角 | 职责 |
|------|------|
| **全栈架构师** | 分层与边界、API/领域/数据、双后端契约（Java/Go）、BFF 聚合、引擎/物料 schema、可测性、与现有子项目的集成与演进；对齐 `AGENTS.md`、`docs/` 与各包规范。 |
| **产品专家** | 需求闭环、角色与场景、验收标准、范围取舍（砍 scope 须 **显式** 写入「不做项」并待用户确认，**禁止静默跳过功能**）。 |
| **高级设计师（UI/UX）** | 信息架构、关键交互与状态（加载/空/错/成功）、可读性与一致性；**不凭空发明 token**——疑虑对照 `ui-spec-enforcer` 与 `docs/UI_SPEC.md`（luban 设计 token / 物料规范摘要）；website 相关须对照 `docs/dev/website-dev-standards.md`；**页面结构展示义务**见下文 **「前端页面结构与设计展示」**。 |

**项目技术栈（方案中须默认以此为准，勿混用包管理器或错误栈假设）：**

- **低代码引擎**：`packages/engine/luban` — **TypeScript**；引擎渲染与构建/E2E 门槛见 **`AGENTS.md`** 与 **`docs/LOWCODE_ENGINE_SPEC.md`**；包管理 **`pnpm`**。
- **BFF**：`packages/bff/luban-bff` — **TypeScript / Node**；聚合后端（Java/Go）能力；包管理 **`pnpm`**。
- **UI 物料库**：`packages/ui/luban-ui` — **Vue 3 / Vite**；物料 props schema 见 `.agents/rules/luban-material-schema.md`；包管理 **`pnpm`**。
- **SSR 站点**：`packages/web/luban-website` — **TypeScript / SSR**；包管理 **`pnpm`**。
- **后端 Java**：`packages/backend/luban-backend` — **Spring Boot / Maven**；**Flyway**、**`mvn -q verify`**（Surefire + Failsafe）；规范见 **`docs/dev/alibaba-java-development-manual.md`**。
- **后端 Go**：`packages/backend/luban-backend-go` — **Go**；`go test ./... -race -cover`；与 Java 同接口须行为一致，见 **`docs/DUAL_BACKEND_PARITY.md`**。
- **客户端**：`packages/client/*`（luban-electron / luban-flutter / luban-cross-plateform，部分规划态）。
- **工作流与计划**：Superpowers plan 契约 **`docs/superpowers/PLAN_WRITING_CONTRACT.md`**；执行约束 **`docs/dev/AGENT_WORKFLOW_CONSTRAINTS.md`**；任务图 SSOT **`docs/dev/SSOT-TASK-GRAPH-PLAN.md`**。

默认须纳入视野的 **子项目 / 承载物**（本轮若明确不涉及某行，须在讨论稿中写 **「本轮不涉及」+ 原因**，勿静默省略）：

| 子项目 | 路径 / 说明 | 定稿方案中须写清的能力增量 |
|--------|-------------|------------------------------|
| 低代码引擎 | `packages/engine/luban` | 引擎渲染、物料 schema 消费、构建与 E2E 门槛（见 `AGENTS.md`） |
| BFF | `packages/bff/luban-bff` | 聚合后端字段、错误体、与后端契约 |
| UI 物料库 | `packages/ui/luban-ui` | 新增物料 props schema、token 使用、注册 |
| SSR 站点 | `packages/web/luban-website` | 列表/详情/筛选、SSR 渲染、E2E |
| Java 后端 | `packages/backend/luban-backend` | API、领域与表、Flyway、单测/集成测与 `mvn verify` |
| Go 后端 | `packages/backend/luban-backend-go` | 与 Java 同接口的双实现，`go test`，行为一致 |
| 客户端 | `packages/client/*` | electron/flutter/cross-platform，按规划态按需 |
| 文档与任务图 | `.agents/plans/`、`docs/superpowers/tasks/` | 与 **PLAN 契约**、**SSOT 任务图**一致 |

定稿落盘默认：`.agents/plans/YYYY-MM-DD-<feature-name>.md`（用户指定路径时从其约定）。

---

## 前端页面结构与设计展示（本命令下 MUST）

凡本特性 **新增或实质改动** 的 **引擎渲染 / website / 客户端** 界面，**定稿**须在 **`docs/superpowers/PLAN_WRITING_CONTRACT.md` §4**（及 **§4.3**）中 **逐页** 写清 **页面结构展示**——使读者 **不读实现代码** 也能理解版式分区、组件层级、列表列与操作位、表单字段与校验/提示、空态与错态出现位置等。**不要求** Figma 或设计工具出图作为门禁。

1. **可接受的展示形式**：Markdown 分区标题 + 有序/无序列表、表格列定义、简易 ASCII/线框、或等价的分层文字结构；须与 **§4.0 入口表**、**§4.2 列表级/主界面交互链** 可交叉检索对应。
2. **不足以约束开发效果时（MUST）**：若判定 **仅靠上述文字与结构仍无法稳定约束** 复杂布局、多状态叠加或视觉层次，须在 **大规模编码前** 先完成 **高保真原型**（须与目标栈一致或可低成本迁入）。plan 须在 **§4.3** 或「实现 / 执行说明」中写明：**原型路径或路由**、**与正式页面的关系**、**合并进产品或删除的里程碑**；并遵守本文 **「引擎渲染 E2E 须绑定正式路由」**——**禁止**将 **`pages/e2e/*`** 专测页作为新增特性的 **长期** 原型宿主。
3. **纯 API / 无 UI** 特性：若产品 SSOT 已声明且无界面增量，§4 中显式写 **「无前端页面」** 及理由，本小节不适用。

---

## 最完整策略与功能膨胀控制（本命令下 MUST）

1. **最完整可交付**：在**已确认的本期范围**内，按契约写全 **§4.0 / §4.2 / §4.3**、E2E 与 TDD 路径，实现阶段不得用「先跳过再说」省略该范围内的用户可见能力或主链路分支。
2. **全系统默认验收口径（MUST）**：凡涉及 **引擎渲染 / website / 客户端** 的特性，**默认交付物**为 **用户在界面上可完成的一条或多条完整业务链路**（含加载/空/错/成功）；**不得以**「仅后端 REST 可用」「仅 `*IT` 通过」作为该特性已交付的结论，除非产品 SSOT 已显式声明「无 UI、纯 API」且用户已确认。
3. **禁止静默跳过功能**：未实现的需求子项须 **实现**；**唯一允许**不做的情形是 **产品 SSOT（或已签章 PRD）中已存在的「非目标」条款**，且须在 plan **「明确不做（防膨胀）」** 中 **逐条引用原文标题或编号** 并获用户确认。
4. **控制功能膨胀**：凡**非**需求原文 / 本期目标所必需的能力（过度配置、无关重构、顺手加字段/接口/页面），须拒绝或单列「**明确不做（防膨胀）**」并简述理由；**禁止无边界镀金**扩大范围。

---

## 质量与交付禁令（本命令下 MUST）

与 **`.agents/rules/luban-e2e-execution-contract.md`**、**`.agents/rules/luban-testing-coverage.md`** 及 E2E 门禁对齐，**禁止**下列行为：

1. **禁止跳过功能**（与上节「静默跳过」同罚则）。
2. **禁止假绿**：测试不得靠不当 `skip`、空断言、关 bail 攒红、或无后端全 skip 仍宣称通过；见 **`.agents/rules/luban-e2e-execution-contract.md`**。
3. **禁止占位**：禁止用 `TODO`、假固定文案、无契约的 mock 数据冒充已接入的真实行为。
4. **禁止骨架交付**：禁止仅保留路由/空壳页面/无反馈按钮即宣称功能完成。
5. **禁止用 JSON 替代页面**：禁止以「整页只渲染 raw JSON / 调试 dump」代替真实 UI 与交互。
6. **页面交互完整**：每个承诺的用户可见流程须在方案中有 **§4.2 级** 分步链路，并在实现/E2E 中有对应断言。
7. **验收口径以可交付为准（MUST）**：凡写入本期范围的 **用户可见能力**，合入与「完成」汇报的默认口径为 **真实页面上的完整业务链路**。
8. **引擎渲染 E2E 须绑定正式路由（MUST）**：计划中 §7 所列引擎渲染 E2E 路径须对应 **正式产品页面/路由**；**禁止**将 **`pages/e2e/*`** 专测页作为**新增**特性的主 E2E 载体。
9. **门禁分级执行**：定稿方案须包含 **分级验收门禁表**（建议五级：代码质量与审查 → 安全审查 → 单测+代码行覆盖率门禁 → **旅程覆盖率门禁（P0=100%）** → E2E 验收），每级写明验证方式、通过条件、责任人。**禁止**无门禁定义的方案进入实现阶段。
10. **/luban-review 清零门禁**：定稿方案须写明在实现阶段完成后的 **Post-Development Workflow** 中包含 **`/luban-review` 全自动审查** 步骤，且要求 **🔴 🟡 🔵 全部清零**（含建议级别问题）方可进入验证阶段。
11. **安全审查门禁**：涉及敏感数据（手机号/身份证/地址/余额/凭证）、支付结算、外部 API 对接、权限模型变更的方案，须在门禁表中增加 **安全审查级**。安全审查内容须包含：敏感字段清单与加密存储策略、鉴权覆盖、OWASP Top 10 自查。**禁止**方案在未通过安全审查的情况下进入实现阶段。
12. **双后端契约一致性声明**：定稿方案须对新增/修改的每个接口声明 Java 与 Go 两端均须实现且行为一致（响应体字段、错误码、状态机一致）。**禁止**新增接口只声明单端实现。
13. **多端渲染一致性声明**：定稿方案须声明引擎产物在 website、electron、flutter 等端渲染一致；新增/修改物料须在各端验证。
14. **FeatureGate 默认约束**：每个新增用户可见功能须默认设计 FeatureGate 开关，写明开关 key、作用域、关闭时的行为契约。回滚方案中须将 FeatureGate 关闭列为首选回滚手段。不使用开关的功能须在方案中写明理由。

---

## 与 **`/10-bs`**（十轮并行头脑风暴）的衔接（MUST）

- 当用户需要对**同一命题**做**多维度审视**且要把**合并后的结论写入当前 plan 文件**时，须按 **`.agents/commands/10-bs.md`** 执行 **`/10-bs`**：
  - **落盘**：在目标 `.agents/plans/*.md`（或用户 `@` 指定的方案路径）中新增/替换 **`## 十轮并行头脑风暴与结论`** 体例，**仅**收录说明 + **综合结论**。
  - **配套 skill**：执行前加载 **`.agents/skills/ten-round-brainstorm/SKILL.md`**（其 MUST 指向 `10-bs.md`）。
- **与 `/plan-template` 的推荐顺序**：需求含混或重大取舍前，可先 **`/10-bs`** 落盘综合结论，再进入本命令 **第一轮讨论稿**；若用户未要求十轮结论，则跳过。

---

## 编写方案时可按需调用的 Skills（除 writing-plans 定稿必读外）

| 用途 | Skill / 命令 |
|------|--------------|
| 定稿结构与粒度（定稿必读） | `.agents/skills/writing-plans/SKILL.md` |
| 需求模糊、创新功能、改行为前 | `.agents/skills/brainstorming/SKILL.md` |
| 多维论证须写入 plan 正文 | **`/10-bs`** + `.agents/skills/ten-round-brainstorm/SKILL.md` |
| E2E + TDD 门禁、计划内测试计划 | `.agents/rules/luban-e2e-execution-contract.md`、`docs/E2E_AGENT_GUIDE.md` |
| 产品闭环、UX、website 规范 | `.agents/skills/ux-product-review/SKILL.md`（与 **`/super-pm`** 一致） |
| 双后端契约一致 | `docs/DUAL_BACKEND_PARITY.md`、`.agents/rules/luban-dual-backend-parity.md` |
| 低代码引擎/物料规范 | `docs/LOWCODE_ENGINE_SPEC.md`、`.agents/rules/luban-material-schema.md`、`.agents/rules/luban-lowcode-engine-quality.md` |
| 多端一致 | `.agents/rules/luban-multi-client-consistency.md` |
| 按任务图执行、并行子任务、§9 自动生成 | `.agents/skills/subagent-driven-development/SKILL.md`、`.agents/skills/dispatching-parallel-agents/SKILL.md`、`.agents/skills/executing-plans/SKILL.md` |
| 宣称完成前 | `.agents/skills/verification-before-completion/SKILL.md` |

定稿时 **始终全文加载** **`.agents/skills/writing-plans/SKILL.md`**（上表第一行）；其余为 **按需叠加**，须在 plan 或对话中说明「已加载哪些 skill」以免遗漏门禁。

---

## 与 **`/super-pm`**、E2E 门禁的衔接（MUST）

- **E2E + TDD**：全文加载并遵循 **`.agents/rules/luban-e2e-execution-contract.md`** 与 **`docs/E2E_AGENT_GUIDE.md`**（计划中须含业务逻辑、交互流、**E2E 用例计划**、§7.2 脚本保障逻辑；执行阶段红→绿、**首个失败即停**指「修当前红用例时先专注该条」，**不是**在仍有未实现范围或未跑齐门禁时提前收工）。
- **产品 + UX + website 规范 + 交付硬约束**：当需求涉及体验、闭环、**website 站点路由**、**引擎可用性优先**、或**禁止 MVP** 时，须全文加载 **`.agents/skills/ux-product-review/SKILL.md`**（与 **`/super-pm`**、**`/ux-product-review`** 命令一致），输出或 plan 附录中须覆盖该 skill 规定的 **rubric**（含 **「Luban 产品交付硬约束核对」**、触发条件下的 **「多端渲染一致对照」**、**「website 站点交互规范对照」**、**「方案与系统入口／数据依赖对照」**、有 PRD 时的 **全量「需求对照」**）。
- 用户已显式执行 **`/super-pm`** 时，本命令产出须与其结论 **无矛盾**；若有冲突须在讨论稿中列出并让用户裁定。

---

## 用户对方案的硬要求（本命令下 MUST）

1. **TDD 先行**
   - **方案阶段**：写明关键行为由哪类测试先锁定（E2E / 单测 / IT），P0 与合并门禁关系。
   - **执行纪律**：先测后码、红→绿→重构；对齐 `docs/dev/AGENT_WORKFLOW_CONSTRAINTS.md`。

2. **并行 subagent（方案 + §9 + 实现；仓库偏好：尽量多用）**
   - **方案阶段**：**鼓励**用并行 `Task` 做 **信息收集**（多路径检索、对照文档与既有实现、只读探索等），再汇总到主会话写讨论稿/定稿；与 **`AGENTS.md`**「尽量并行子 agent」一致。
   - **定稿 Markdown 的连贯章节**（同一 `.agents/plans/*.md` 内连续段落、文首 `taskGraph` 等）：默认 **主会话串行落盘**，避免多子 agent 同时改同一文件。
   - **§9 生成阶段**（§0-§8 写完后，同一轮内）：派发**每子系统一个 subagent**（backend-java / backend-go / engine / bff / website / ui / client），各自使用 codegraph 搜索代码库，并行产出文件映射、API 契约、DDL、组件接口。主 agent 待所有 subagent 返回后合并追加到 plan 文件。
   - **实现阶段**（按 plan 写代码 / 跑测）：凡可拆成 **彼此无依赖、可独立验收** 的线，定稿中须**显式标出**，并写明主会话如何 **并发 `Task` 派发** 与 **汇总收口**。执行接续可配合 **`/jx`**。
   - 调用 **`Task` 时默认不传 `model`**。

3. **系统与链路写全**
   定稿须包含（与 **`docs/superpowers/PLAN_WRITING_CONTRACT.md`** 的 **§4.0 / §4.2 / §4.3** 对齐，不得用一句「主路径」代替）：
   - **涉及哪些子系统**（引擎/BFF/UI/website/Java后端/Go后端/client，含 DB/消息等若适用）；
   - **各子系统新增什么**（模块、接口、页面、表/migration、物料 schema、配置、脚本）；
   - **端到端链路**：操作 → 请求/消息 → 响应或状态 → 落库或副作用；**列表页**须 **分步**（操作→反馈→API/状态），不得仅概括。

4. **先讨论，再给方案**
   - **第一轮**：**禁止**直接输出可落盘的完整 `.agents/plans/*.md` 正文。第一轮只输出 **讨论稿**：范围与假设、**待你确认的问题（编号）**、各子系统 **拟** 增量一行级摘要、风险与依赖、可选方案 A/B、**「明确不做（防膨胀）」草案**。
   - **第二轮**：在用户补充或明确「按某方向定稿」之后，再 **全文加载** **`.agents/skills/writing-plans/SKILL.md`**，并按 **`docs/superpowers/PLAN_WRITING_CONTRACT.md`** 必选章节输出可执行 plan（含文首 `taskGraph`、与任务图 JSON 的同步说明、校验命令）。

5. **一次完成本期范围 + 跑齐全量验证后再做「完成」汇报（维护者偏好，MUST）**
   - **定稿中**须在「实现 / 执行说明」或验收章节写明完整的 **Post-Development Workflow**，包含：代码提交 → **`/luban-review` 全自动审查（🔴🟡🔵 清零）** → 编译 → 单测+覆盖率门禁 → 询问用户后跑 E2E → 全栈覆盖率汇总 → 完成汇报。
   - **`/luban-review` 先行**：所有验证步骤前必须先执行 `/luban-review` 并清零，**禁止**在未通过代码审查的情况下跑验证。
   - 按本 plan 进入**实现会话**时，须在 **已确认的本期范围** 内 **连续推进至全部就绪**，**禁止**在仅完成部分子能力、或验证命令尚未全部跑通之前，以「先到这儿」「主体已完成」等**结束实现并等同交付收口**。
   - **禁止主路径收口即宣称完成（MUST）**。
   - **禁止分期交付同一方案（MUST）**：同一 `.agents/plans/*.md` 定稿所承诺的本期功能，须在**单次实现周期内全部完成**并通过验证门禁。若确需分文件推进，须拆成 **多份独立 plan**。
   - **完成汇报**默认指：**本期范围内代码与配置已齐** + **与本 plan 相关的各子项目约定验证命令均已通过**（保留命令与关键输出证据）后的 **一次汇总**。
   - **与 TDD 的关系**：**首个失败即停**用于 **定位并修复当前失败用例**，修绿后继续直至 **全量** 门禁通过。
   - **例外**：用户**显式**要求暂停/缩小范围、遇须用户决策的阻塞、或环境/配额硬限制无法继续时，须列出**残余项与下一步**，**禁止**假装已全量完成。

---

## §9 实现任务派发 — 第二轮定稿时并行生成（本命令下 MUST）

第二轮定稿包含 **两阶段**：第一阶段按 `PLAN_WRITING_CONTRACT.md` 写出 §0-§8（**含 taskGraph JSON**），**之后在同一轮内**并行派发 subagent 扫描代码库填充 §9（文件→任务映射、API 契约、DDL 草图、组件接口、并行派发计划），追加到同一 plan 文件后输出完整 plan。§9 是定稿的**标准章节**，非可选附加。

### 工作流

```
第二轮第一阶段：主 agent 串行写入 §0-§8
  ├─ 创建或更新 docs/superpowers/tasks/<featureId>.json（与 plan 文首 taskGraph 一致）
  └─ 执行 scripts/verify-plan-ssot.mjs validate <path> 确保 JSON 合法

第二轮第二阶段：
  Step 1: 读取 taskGraph JSON，tasks 按子系统分组
  Step 2: 并行派发 subagent（backend-java / backend-go / engine / bff / website / ui / client）
          各自用 codegraph 搜索代码库，产出文件映射/API/DDL/组件接口
          ⚠️ 某 subagent 失败 → 自动重试 1 次；仍失败则跳过该组并在报告中标记
  Step 3: 主 agent 合并所有结果 → 去重 → 一致性校验 → 追加 §9
  Step 4: 输出完整 plan（§0-§9）+ 汇总表格
```

### Step 1：分组

读取 plan 文首 YAML 的 `taskGraph` → `docs/superpowers/tasks/<featureId>.json`。将所有 tasks 按子系统分组：

| 分组 | 筛选条件 |
|------|---------|
| `[backend-java]` | 标题含 Java/后端Java/Service/Controller/Flyway |
| `[backend-go]` | 标题含 Go/后端Go/handler |
| `[engine]` | 标题含 引擎/engine/渲染/schema |
| `[bff]` | 标题含 BFF/聚合 |
| `[website]` | 标题含 website/SSR/站点 |
| `[ui]` | 标题含 物料/ui/组件/luban-ui |
| `[client]` | 标题含 client/electron/flutter |
| `[cross]` | 跨子系统，加入所有相关组 |

如果某组 task 数为 0，显式写「无该子系统任务」并 skip 对应的 subagent 派发。

### Step 2：并行派发 subagent

每子系统一个 subagent，并行启动。每个 agent 接收对应任务列表 + prompt（使用 codegraph 工具搜索代码库），产出：

- **9.1 文件变更总览**：task ID / 文件路径 / 新建or修改 / 摘要
- **9.2 API 契约**（backend agent 专用）：端点、方法、请求响应字段、错误码、鉴权。**双后端**：Java 与 Go 同接口须字段一致。先 codegraph_search 找同级 Controller/handler 作为风格参考。
- **9.3 数据库变更**（backend agent 专用）：完整 CREATE TABLE / ALTER TABLE。Flyway 版本用秒级时间戳 `V{YYYYMMDDHHmmss}__desc.sql`。
- **9.4 物料 schema**（ui agent 专用）：新增物料的 props schema（见 `.agents/rules/luban-material-schema.md`）。
- **9.5 组件接口**（engine/website/client agent 专用）：组件 props/emits 类型、composable 签名。

### Step 3：主 agent 合并 → 去重 → 校验 → 追加 §9

**3a. 收集与去重**
- 合并所有 subagent 的产出
- 跨子系统共享文件以后端 agent 的版本为准
- **交叉校验**：BFF/website/引擎 agent 列出的 API 调用字段，必须能在后端 agent 的 API 契约中找到对应定义
- **双后端校验**：Java 与 Go agent 的同一接口字段须一致，否则标记冲突待用户裁定

**3b. 一致性校验**
- 每一条文件路径，要么通过 codegraph 确认存在，要么已标注 `[待确认]`
- DDL 的表名字段名不可与 plan §0-§8 矛盾
- API 端点列表不可超出 plan §0-§8 中声明的接口范围
- 物料 schema 须完整（props 类型、默认值、必填）

**3c. 失败处理**
- 若某 subagent 重试 1 次仍失败：跳过该组，在汇总报告中标记为 `❌ 未生成`
- 若全部 subagent 失败：§9 输出简版（仅 9.6 并行计划，其余节写「subagent 未就绪，须人工补充」）

**3d. 追加 §9**（含 9.1-9.6，9.6 为并行派发计划，基于 taskGraph JSON 的 `dependsOn` 依赖关系分组）。

### §9 质量要求

1. **禁止编造文件路径** — 须通过 codegraph 确认存在；搜索不到时写 `[待确认]` + 原因
2. **双后端一致** — §9.2 中 Java 与 Go 同接口字段须一致
3. **物料 schema 完整** — §9.4 每个物料须有完整 props schema
4. **多端渲染一致** — 涉及物料/引擎的任务须声明各端验证
5. **Flyway 版本** — 统一用秒级时间戳
6. **并行派发计划** — 必须与 taskGraph JSON 的 `dependsOn` + `group` 完全一致
7. **门禁值** — Java 行 80%, Go 行 75%, 引擎/bff/website 行 85%, UI 行 90%（见 `.agents/rules/luban-testing-coverage.md`）

---

## Agent 必读索引（第二轮定稿前逐项核对）

| 文档 / Skill | 用途 |
|----------------|------|
| `.agents/skills/writing-plans/SKILL.md` | 定稿结构与粒度 |
| `docs/E2E_AGENT_GUIDE.md` §1.1 | 引擎渲染 E2E 与正式页面路径（禁专测页作主载体） |
| `docs/superpowers/PLAN_WRITING_CONTRACT.md` | 必选章节、§4.0 / §4.2 / **§4.3**、§7 E2E |
| `docs/dev/AGENT_WORKFLOW_CONSTRAINTS.md` | TDD、并行 subagent、验证顺序 |
| `docs/dev/SSOT-TASK-GRAPH-PLAN.md` | 任务图 JSON schema 与校验 |
| `.agents/rules/luban-e2e-execution-contract.md` | E2E 执行契约 |
| `.agents/rules/luban-dual-backend-parity.md` | 双后端契约对齐 |
| `docs/DUAL_BACKEND_PARITY.md` | 双后端行为一致 |
| `.agents/rules/luban-material-schema.md` | 物料 schema |
| `.agents/rules/luban-lowcode-engine-quality.md` | 引擎零 console / 渲染一致 |
| `.agents/rules/luban-multi-client-consistency.md` | 多端一致 |
| `.agents/rules/luban-cross-cutting-standards.md` | BFF 字段 / 错误体 / 分页 |
| `.agents/skills/ux-product-review/SKILL.md` | 与 **`/super-pm`** 一致 |
| `AGENTS.md` | 各子项目构建与测试命令表 |
| `codegraph` MCP tools | §9 生成时搜索现有文件结构 |
| `scripts/verify-plan-ssot.mjs` | 任务图 JSON 校验脚本 |

---

## 建议输出骨架

**第一轮（讨论稿）**
- 一句话背景与目标
- 待确认问题（编号，可勾选）
- 子系统涉及表 + 每系统 **拟** 增量（各不超过数行）
- **「明确不做（防膨胀）」** 与 **「建议后续迭代」**
- 风险、外部依赖、与现有文档/接口冲突
- 请用户选择或补充后再进入第二轮

**第二轮（定稿 plan，含 §0-§8）**
- 开场一句：正按 `writing-plans` + `PLAN_WRITING_CONTRACT` 输出
- **需求追溯矩阵**：将上游文档每条功能需求映射到 task id + E2E 场景 + 验收门禁
- **明确不做（防膨胀）**：从第一轮讨论稿继承已达成共识的「不做项」
- 完整契约章节 + **§4.3 逐页页面结构** + 任务勾选 + E2E/TDD + **实现阶段**并行 Task 线说明 + **质量禁令自检表**
- **分级验收门禁表**（五级：代码质量与审查 → 安全审查 → 测试覆盖率门禁 → 旅程覆盖率门禁 → E2E 验收）
- **敏感字段清单与分级约束**：列出新增 API/表中所有敏感字段，标明加密存储策略、日志脱敏规则、前端展示规则
- **双后端契约一致性声明**：每个新增接口声明 Java 与 Go 均实现且行为一致
- **多端渲染一致性声明**：声明引擎产物在 website、electron、flutter 渲染一致
- **FeatureGate 开关设计**：每个新增功能写明开关 key、作用域、关闭时行为
- **E2E 用例枚举**：每场景一张表（前置条件、逐条用例操作与断言、清理方案、**绑定旅程 id**）
- **用户旅程覆盖声明（§7.0，MUST）**：凡有 E2E 增量的方案须列旅程声明表（id/标题/优先级/场景/入口端），同步到 taskGraph JSON `journeys[]`；P0 旅程须有 spec 绑定 `@J-<id>`
- **E2E 路由合规性确认**：所有引擎渲染 E2E 须为正式路由，无新增 `pages/e2e/*` 专测页
- **错误场景清单**：每个新增功能列出至少 3 种非正常路径
- **回滚方案**：涉及 Flyway 迁移、配置变更、外部 API 对接的任务，写明回滚步骤（FeatureGate 关闭列为首选）
- **Post-Development Workflow**：代码提交 → `/luban-review` 清零 → 编译 → 单测+覆盖率门禁 → 询问用户后跑 E2E → 全栈覆盖率汇总 → 完成汇报
- **实现会话**：写明本期范围须 **一次推进至验证全绿** 后再做完成汇报
- **每步必须定义验证门**：`验证门: <命令>`。分散在多个模块的改动须为每个模块分别定义验证门。

**§0-§8 写完后 → 在同一轮内进入 §9 生成**：派发并行 subagent 填充文件映射/API契约/DDL/物料schema/组件接口/并行派发计划，追加到同一 plan 文件后输出完整 plan（§0-§9）。

策略：本命令不替代各子项目构建或 E2E 的实际执行；定稿中的命令须与 `AGENTS.md` 一致；实现时遵守 **硬要求 §5**，避免「做一半就停」式收口。
