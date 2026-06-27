---
title: Luban 方案编写契约（PLAN_WRITING_CONTRACT）
createdAt: 2026-06-14
status: active
contractSource: .agents/commands/plan-template.md（权威源）+ .agents/skills/writing-plans/SKILL.md
audience: 所有写 .agents/plans/*.md 定稿的 agent（/plan-template 第二轮、writing-plans skill）
---

# Luban 方案编写契约（PLAN_WRITING_CONTRACT）

> **本文件是什么**：所有 child plan / program plan 定稿的**契约源**。`/plan-template` 命令、`writing-plans` skill、各 child plan 均向本契约对齐。本文件被反复引用（plan-template 第 7/28/137/143/243 行、delivery-program 第 8 行），但**此前缺失**，由 T3 补建。
>
> **权威源**：`.agents/commands/plan-template.md`（27KB）。本文件从其中**提取并结构化**契约要求，不改其语义。若命令体与本契约冲突，以**命令体**为准并回写本文件。
>
> **本文件不是**：不是 plan 模板，不是某一期的方案；它是「一份 plan 要被认定为合规定稿，必须写哪些章节、每章写什么、如何验收」的**规则集**。

---

## 0. 适用范围与判定流程

### 0.1 谁要对齐本契约
- 写 `/plan-template` 第二轮定稿的主 agent（命令体第 144 行要求全文加载本文件）
- 加载 `writing-plans` skill 的 agent（skill 第 17 行指本文件为必选章节源）
- `.agents/plans/*.md` 的 reviewer（用本契约 §11 验收清单做合规判定）

### 0.2 一份 plan 是否合规的判定
- 必选章节 §0–§8 齐全（§9 为定稿阶段并行 subagent 自动填充，允许在 §0–§8 写完后同轮追加）
- §4（含 UI 时）含 §4.3 逐页页面结构展示
- 质量禁令 14 条自检逐条勾选
- 分级验收门禁表（G1–G4）齐全
- 双后端一致性声明 / 多端一致声明 / 敏感字段清单 / 回滚方案齐备

### 0.3 推荐入口与 Agent 提醒（MUST）
若用户用自然语言要求写实现方案却**未**发送 `/plan-template`，agent 须**主动建议**发送 `/plan-template`。
- 话术要点：「这个需求看起来需要写实现方案。建议发送 `/plan-template`，它会按完整契约（§0–§9 + 14 条质量禁令 + G1–G4 门禁）产出定稿，避免后期返工。你也可以直接说『继续讨论稿』，我先出第一轮范围与待确认问题。」
- 例外：用户已显式要求用其他命令（如 `/prd`），或需求明显是产品需求文档而非实现方案（无技术选型/无子系统改动）时，不强推 `/plan-template`。

---

## §0 文首 YAML + 分支策略

### 0.1 必须包含什么
定稿 `.agents/plans/*.md` 文件**首部**必须有 YAML front matter（`---` 包裹），含以下字段：

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `featureId` | string | 特性唯一 id（kebab-case） | `luban-delivery-program` |
| `title` | string | 中文标题 | `Luban 可交付治理项目集（Program Plan）` |
| `createdAt` | date | 定稿日期 YYYY-MM-DD | `2026-06-14` |
| `status` | enum | `draft` / `approved` / `in-progress` / `done` | `draft` |
| `program` | bool | 是否为 program（多 child plan 聚合） | `true`（仅 program plan） |
| `taskGraph` | path | 任务图 SSOT，指向 `docs/superpowers/tasks/<featureId>.json` | `docs/superpowers/tasks/luban-delivery-program.json` |
| `contractSource` | string | 契约来源声明（含本文件） | `plan-template 命令体 + writing-plans skill` |
| `scope` | string | 本期范围一句话 | `完整治理全量达标` |
| `split` | string | 若拆 child plan，写拆分依据（§5 强制） | `按 plan-template 硬要求§5 拆 6 child plan / 4 wave` |
| `branches` | string | 分支策略（feature 同名分支） | `各子仓 feature/luban-delivery-<wave> 同名分支` |

### 0.2 分支策略约定
- 各子仓默认保留现有默认分支（6 master + 5 main）
- 新提交统一 `feature/*`；多系统改动用**同名 feature 分支**（便于跨仓追对应）
- **禁止直接 push 默认分支**
- 合并冲突：优先分析双方逻辑**保留双方**；禁止 `--ours/--theirs`；无法确认**询问用户**

### 0.3 验收要点
- [ ] YAML 字段齐全，无空值
- [ ] `taskGraph` 指向的 JSON 实际存在且通过 `node scripts/verify-plan-ssot.mjs validate` 校验
- [ ] `featureId` 与文件名 `<date>-<featureId>.md` 一致
- [ ] 分支策略不违反「禁 push 默认分支」硬约束

---

## §1 需求溯源（追溯矩阵）

### 1.1 必须包含什么
**追溯矩阵表**，将上游需求逐条映射到 task id + E2E 场景 + 验收门禁。每行至少 4 列：

| 列 | 内容 |
|----|------|
| 上游需求 | PRD 条目 / SSOT 功能项 / 用户确认的 gap（含**证据文件路径或行号**） |
| task id | 在 taskGraph JSON 中的节点 id（如 T1/T2/具体子任务号） |
| E2E 场景 | 该需求对应的 E2E 用例编号或场景描述（见 §7.1） |
| 验收门禁 | G1–G4 中至少 1 项（多对多允许） |

### 1.2 证据要求
- 每条 gap 须**标注证据**：文件路径:行号 / grep 结果 / 探针报告引用
- **禁止凭空列需求**——所有需求须有上游来源（PRD / 用户确认 / 探针发现）
- 「无遗漏覆盖」声明：所有上游需求 / 探针发现的 gap 须映射到 task，无静默跳过

### 1.3 验收要点
- [ ] 矩阵覆盖**所有**上游需求（逐条对应，无遗漏）
- [ ] 每条 task 至少关联 1 条上游需求（防止镀金）
- [ ] 证据可追溯（路径真实存在）
- [ ] gap 有层级标注（L0 阻塞 / L1 重要 / L2 增强），便于排期

---

## §2 系统与链路

### 2.1 必须包含什么
1. **涉及哪些子系统**：engine / BFF / UI / website / Java 后端 / Go 后端 / client（含 DB / 消息队列等若适用）
2. **各子系统新增什么**：模块、接口、页面、表/migration、物料 schema、配置、脚本——每项一行级摘要
3. **端到端链路**：操作 → 请求/消息 → 响应或状态 → 落库或副作用，用流程图或编号步骤表达
4. **列表页须分步**（操作→反馈→API/状态），不得仅用一句「主路径」概括

### 2.2 链路表达形式（可接受）
- ASCII 流程图（推荐，可读性高）
- Mermaid sequenceDiagram
- 编号步骤列表
- 三者混用：宏观链路用图，关键分支用列表

### 2.3 验收要点
- [ ] 端到端链路从用户操作起点到落库终点完整，无断点
- [ ] 每个子系统的增量逐项列出，不概括
- [ ] 列表页交互分步，非一句「列表 + CRUD」
- [ ] 跨子系统数据流方向清晰（谁调谁、传什么字段）

---

## §3 业务逻辑

### 3.1 必须包含什么
- **状态机**：每个有状态的实体（如 page.status、user.status、order.status）画状态转换图，标注触发条件与目标态
- **领域实体表**：实体名 / 表名 / 状态字段 / 负责端（Java/Go/前端）
- **事务边界**：哪些操作必须原子（如「发布 = 改 status + 记审计」），跨表/跨服务时如何保证一致性
- **关键业务规则**：白名单校验、权限矩阵、幂等性、唯一性约束（如 slug 冲突）

### 3.2 对齐 architecture-review-e2e-tdd
- 业务逻辑须可被 E2E 测试覆盖（每条规则映射到 §7 至少一个用例）
- 状态机的每条转换边都要有测试守护
- 事务失败的回滚行为要写明（不能 silent fail）

### 3.3 验收要点
- [ ] 状态机图覆盖所有合法转换 + 非法转换的拒绝
- [ ] 事务边界明确（哪些必须原子、如何保证）
- [ ] 业务规则有对应测试用例（§7 引用）
- [ ] 错误场景（非正常路径）每功能至少 3 种（见输出骨架）

---

## §4 页面结构（§4.3 逐页展示，含 UI 时 MUST）

> 本节是 `/plan-template` 的核心交付约束之一。凡本特性**新增或实质改动**的引擎渲染 / website / 客户端界面，§4 须逐页写清结构展示，使读者**不读实现代码**也能理解版式、组件层级、交互、空错态。

### §4.0 入口表
- 表格：路由 / 视图（组件名）/ 来源端 / 状态（新增/重做/已有验证）
- 覆盖所有本期涉及的前端入口
- 与 §4.2 / §4.3 可交叉检索对应

### §4.1 信息架构
- 页面分区、导航层级、信息密度
- 关键交互模式（拖拽 / 抽屉 / 模态 / 内联编辑）

### §4.2 列表级与主界面交互链（分步）
- 用户操作 → 系统反馈 → API/状态变更，**分步编号**
- 列表页：筛选 → 排序 → 分页 → 行操作，每步独立
- 不得概括为「列表 CRUD」

### §4.3 逐页页面结构展示（MUST，不读代码也能理解）
- **版式分区**：用 ASCII 线框图 或 Markdown 分区标题表达布局
- **组件层级**：每个区块用了什么组件（LubanButton / Container / Table 等）
- **列与操作位**：表格的列定义、行操作按钮位置
- **表单字段与校验**：每个字段的 label / type / required / 校验规则 / 提示文案
- **空错态位置**：加载态 / 空态 / 错态分别出现在哪个区块、文案是什么

**可接受形式**：Markdown 分区标题 + 有序/无序列表、表格列定义、简易 ASCII/线框、或等价的分层文字结构。**不要求** Figma / 设计工具出图作为门禁。

**不足以约束开发效果时（MUST）**：若判定仅靠文字仍无法稳定约束复杂布局 / 多状态叠加，须在**大规模编码前**先完成高保真原型，并在 §4.3 或「实现 / 执行说明」写明：原型路径或路由、与正式页面的关系、合并进产品或删除的里程碑。

**引擎渲染 E2E 须绑定正式路由（MUST）**：禁止将 `pages/e2e/*` 专测页作为新增特性的长期原型宿主或主 E2E 载体（见禁令 §8）。

**纯 API / 无 UI 特性**：若产品 SSOT 已声明且无界面增量，§4 中显式写「无前端页面」+ 理由，本小节不适用。

### §4.4 UX 自检（对齐 /super-pm）
- 加载/空/错/成功四态齐全
- 可读性、一致性、可访问性（键盘 / 焦点 / 对比度）
- 不凭空发明设计 token——疑虑对照 `docs/UI_SPEC.md` 与 `ui-spec-enforcer`

### §4 验收要点
- [ ] §4.0 入口表覆盖所有本期前端入口
- [ ] §4.2 交互链分步，列表页分步
- [ ] §4.3 逐页结构，每页可独立读懂（不读代码）
- [ ] 四态（加载/空/错/成功）位置与文案明确
- [ ] 引擎渲染 E2E 路由均为正式产品路由

---

## §5 集成与复用表

### 5.1 必须包含什么
**跨子系统共享件契约表**：

| 列 | 内容 |
|----|------|
| 复用件 | 组件 / 接口 / 类型 / schema / util 的名称 |
| 提供方 | 哪个子系统 / 哪个 task 实现 |
| 消费方 | 哪些子系统 / task 消费 |
| 契约 | props / emits / API 字段 / schema 形态 / 类型签名 |

### 5.2 验收要点
- [ ] 跨子系统共享件逐个列契约（不能只写名字）
- [ ] 提供方与消费方任务编号明确
- [ ] 复用件有版本/兼容策略（重构时如何不破下游）
- [ ] BFF 透传字段、错误体、分页格式须对齐 `.agents/rules/luban-cross-cutting-standards.md`

---

## §6 架构边界 + 门禁自检

### §6.1 架构边界
- 分层与边界声明：哪些逻辑在哪一层（前端 / BFF / 后端）
- 与现有子项目的集成与演进路径（不破坏现有契约）
- 引擎 / BFF / 后端各自的职责切分

### §6.2 双后端 parity 矩阵（MUST）
表格：每个接口的 Java 现状 / Go 现状 / 本期目标。

| 接口 | Java 现状 | Go 现状 | 本期目标 |
|------|----------|---------|---------|
| ... | ✅ / 🔴 / ⚠️ + 描述 | 同 | 字段对齐 / 行为一致 |

- 响应体字段、错误码、状态机须一致
- **禁止新增接口只声明单端实现**（见禁令 §12）
- 由 Contract Test 守护

### §6.3 覆盖率门禁目标
对齐 `.agents/rules/luban-testing-coverage.md`：
- engine / bff / website：**85%**
- UI 物料库：**90%**
- Java 后端：**80%**
- Go 后端：**75%**
- `make test-coverage` 一键汇总 + HTML 报告

### §6.4 物料 schema 标准
对齐 `.agents/rules/luban-material-schema.md`：
- `defineMaterial({ name, version(semver), category, propsSchema(JSON Schema), events[], slots[] })`
- `materials/<category>/<name>/` 目录 + manifest
- 所有字段声明 default
- props schema 合规（type / required / 默认值齐全）

### §6.5 FeatureGate 策略（每个新功能 MUST）
表格：每个新增用户可见功能写 FeatureGate 开关。

| 功能 | FeatureGate key | 作用域 | 关闭行为 |
|------|----------------|--------|---------|

- 回滚方案中须将 FeatureGate 关闭列为**首选回滚手段**
- 不使用开关的功能须写明理由

### §6 验收要点
- [ ] 双后端矩阵覆盖所有新增/修改接口
- [ ] 覆盖率门禁目标数值对齐规范（不降低）
- [ ] 物料 schema 标准（若涉及 UI）对齐
- [ ] 每个 new feature 有 FeatureGate 设计
- [ ] 架构边界清晰，不破坏现有契约

---

## §7 E2E 测试计划

### §7.0 用户旅程覆盖声明（MUST）

凡本期**新增或修改 E2E 链路**的方案，定稿须在本节声明本期引入/涉及的用户旅程，并同步到 taskGraph JSON 的 `journeys[]` 字段（见 `docs/dev/ssot-task-graph.md`「旅程覆盖」）。**无 E2E 增量的纯后端/纯修复方案**可写「本期无 E2E 增量」并跳过本节。

**旅程声明表**（每条旅程一行）：

| 旅程 id | 标题 | 优先级 | 场景 | 入口端 |
|---------|------|--------|------|--------|
| `J-<语义短词>` | 中文名 | P0/P1/P2 | 场景1、场景2… | engine/website/workspace |

**约束**：
- 旅程 id 跨 plan 全局复用：**首次定义**在引入它的 plan（带完整字段），后续 plan 引用同一 id 只写 `{"id":"J-xxx","ref":true}`（见 ssot-task-graph.md「引用规则」）。
- `priority=P0` 的旅程**必须有至少 1 条 spec 绑定** `@J-<id>` 标签（见 `docs/dev/e2e-test-style-guide.md` §4），否则 `journey-coverage` 阻断合并。
- §7.3 场景表的每行须注明「绑定旅程 id」（多对多），与 §1 追溯矩阵的 `E2E 场景` 列互相引用。

**门禁**：`make journey-coverage`（或 `node scripts/verify-plan-ssot.mjs journey-coverage`）须在收口前跑通，P0=100%。P1/P2 缺口仅报告不阻断。

### §7.1 跨端主路径（绑正式路由，禁 pages/e2e/* 专测页）
- **主链路 E2E**：登录 → 建站 → 建页面 → 拖组件 → 改属性 → 预览 → 发布 → 访客看到 published → 多端一致
- **路由合规（MUST）**：所有引擎渲染 E2E 须对应**正式产品页面/路由**（如 `/sites/:siteId/pages/:pageId/edit`）
- **禁止**将 `pages/e2e/*` 专测页作为新增特性的主 E2E 载体
- 工具栈：统一 **Playwright**（废 Cypress）
- 多端 E2E：website / electron / flutter 渲染冒烟一致
- **§7 E2E 至少包含一条多租户隔离验证用例**（writing-plans skill §3 要点）

### §7.2 脚本保障逻辑
- **首个失败即停**：定位修复当前红用例，修绿后继续至全量门禁（非提前收工）
- **禁假绿**：禁 `*.skip` / 空断言 / 关 bail / 无后端全 skip 仍宣称通过
- **环境预检**：MySQL + Java(或 Go) + BFF 起齐才跑；缺服务明确报错，不静默 skip
- 对齐 `.agents/rules/luban-e2e-execution-contract.md` 与 `docs/E2E_AGENT_GUIDE.md`

### §7.3 E2E 用例枚举（每场景一张表）
- 前置条件 / 逐条用例操作与断言 / 清理方案
- **每行须注明「绑定旅程 id」**（对应 §7.0 声明的 `J-xxx`，多对多）
- 每场景独立可重跑

### §7.4 E2E 路由合规性确认
- 列出所有 E2E 使用的路由，逐条确认是正式产品路由
- 无新增 `pages/e2e/*`

### §7 验收要点
- [ ] 主链路 E2E 绑正式路由，无专测页
- [ ] 至少 1 条多租户隔离用例
- [ ] 每场景有前置/操作/断言/清理
- [ ] 脚本保障逻辑（首失败即停 / 禁假绿 / 环境预检）写入
- [ ] 路由合规性确认章节齐全
- [ ] §7.0 旅程声明表存在且与 taskGraph JSON `journeys[]` 一致
- [ ] P0 旅程均有 spec 绑定 `@J-<id>`（`make journey-coverage` 绿）

---

## §8 TDD 与执行约定

### 8.1 TDD 先行
- **方案阶段**：写明关键行为由哪类测试先锁定（E2E / 单测 / IT），P0 与合并门禁关系
- **执行纪律**：先测后码、红→绿→重构
- 对齐 `docs/dev/AGENT_WORKFLOW_CONSTRAINTS.md`

### 8.2 首个失败即停（语义澄清）
- 指「**修当前红用例时先专注该条**」，**不是**在仍有未实现范围或未跑齐门禁时提前收工
- 修绿后继续直至**全量**门禁通过
- 例外：用户显式要求暂停、遇须用户决策的阻塞、环境/配额硬限制——须列出残余项与下一步，禁止假装全量完成

### 8.3 并行 subagent（仓库偏好：尽量多用）
- **方案阶段**：鼓励并行 `Task` 做信息收集（多路径检索 / 对照文档 / 只读探索），汇总到主会话写定稿
- **定稿 Markdown 连贯章节**：默认主会话串行落盘（避免多子 agent 同时改同一文件）
- **§9 生成阶段**：派发每子系统一个 subagent（backend-java / backend-go / engine / bff / website / ui / client），并行产出文件映射 / API 契约 / DDL / 组件接口
- **实现阶段**：凡可拆成彼此无依赖、可独立验收的线，定稿中显式标出，主会话并发 `Task` 派发 + 汇总收口（可配合 `/jx`）
- 调用 `Task` 时**默认不传 `model`**

### 8.4 单期收口（plan-template 硬要求 §5）
- 同一 `.agents/plans/*.md` 定稿承诺的本期功能，须在**单次实现周期内全部完成**并通过验证门禁
- **禁止主路径收口即宣称完成（MUST）**
- **禁止分期交付同一方案（MUST）**——若确需分文件推进，须拆成多份独立 plan
- 完成汇报默认指：本期范围代码与配置已齐 + 相关各子项目约定验证命令均通过（保留命令与关键输出证据）后的一次汇总

### 8.5 Post-Development Workflow（MUST，每 plan 完成时）
```
代码提交
   ↓
/luban-review 全自动审查（🔴🟡🔵 全部清零，含建议级别）
   ↓
编译（pnpm build / mvn compile / go build）
   ↓
单测 + 覆盖率门禁（pnpm test / mvn verify / go test -race -cover）
   ↓
询问用户后跑 E2E（Playwright 主链路）
   ↓
全栈覆盖率汇总（make test-coverage）
   ↓
完成汇报
```
- **/luban-review 先行**：所有验证步骤前必须先 `/luban-review` 清零，禁止未过审查跑验证
- **每步必须定义验证门**：`验证门: <命令>`，分散在多个模块的改动须为每个模块分别定义

### §8 验收要点
- [ ] TDD 关键行为锁定（每 P0 行为有对应测试类型）
- [ ] 「首个失败即停」语义正确（非提前收工）
- [ ] 并行 subagent 计划标出独立可验收线
- [ ] 单期收口声明，无分期
- [ ] Post-Development Workflow 齐全（含 /luban-review 清零）
- [ ] 每步验证门定义

---

## §9 实现任务派发（定稿阶段并行 subagent 自动填充）

> §9 是定稿的**标准章节**，非可选附加。在 §0–§8 写完后**同一轮内**生成。

### 9.1 工作流（两阶段）
```
第二轮第一阶段：主 agent 串行写入 §0–§8
  ├─ 创建/更新 docs/superpowers/tasks/<featureId>.json（与文首 taskGraph 一致）
  └─ node scripts/verify-plan-ssot.mjs validate <path> 校验 JSON

第二轮第二阶段：
  Step 1: 读 taskGraph JSON，tasks 按子系统分组
  Step 2: 并行派发 subagent（backend-java / backend-go / engine / bff / website / ui / client）
          各自用 codegraph 搜索代码库，产出文件映射 / API / DDL / 组件接口
          ⚠️ 某 subagent 失败 → 自动重试 1 次；仍失败则跳过并在报告标记
  Step 3: 主 agent 合并 → 去重 → 一致性校验 → 追加 §9
  Step 4: 输出完整 plan（§0–§9）+ 汇总表
```

### 9.2 分组规则
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

某组 task 数为 0 → 显式写「无该子系统任务」并 skip 对应 subagent 派发。

### 9.3 §9 子节产出（9.1–9.6）
- **9.1 文件变更总览**：task ID / 文件路径 / 新建或修改 / 摘要
- **9.2 API 契约**（backend 专用）：端点 / 方法 / 请求响应字段 / 错误码 / 鉴权；**双后端字段一致**；先 codegraph 找同级 Controller/handler 作风格参考
- **9.3 数据库变更**（backend 专用）：完整 CREATE TABLE / ALTER TABLE；Flyway 版本用秒级时间戳 `V{YYYYMMDDHHmmss}__desc.sql`
- **9.4 物料 schema**（ui 专用）：新增物料 props schema（对齐 `.agents/rules/luban-material-schema.md`）
- **9.5 组件接口**（engine/website/client 专用）：props/emits 类型、composable 签名
- **9.6 并行派发计划**：基于 taskGraph JSON 的 `dependsOn` + `group` 依赖关系分组

### 9.4 一致性校验
- 每条文件路径须通过 codegraph 确认存在或标注 `[待确认]`
- DDL 表名字段名不可与 §0–§8 矛盾
- API 端点列表不超出 §0–§8 声明的接口范围
- 物料 schema 须完整（props 类型 / 默认值 / 必填）
- BFF/website/引擎 agent 列的 API 调用字段，须在后端 agent 的 API 契约中找到对应
- Java 与 Go agent 同接口字段须一致，否则标记冲突待用户裁定

### 9.5 §9 质量要求
1. **禁止编造文件路径** — 须 codegraph 确认；搜不到写 `[待确认]` + 原因
2. **双后端一致** — 9.2 中 Java 与 Go 同接口字段一致
3. **物料 schema 完整** — 9.4 每个物料有完整 props schema
4. **多端渲染一致** — 涉及物料/引擎的任务声明各端验证
5. **Flyway 版本** — 统一秒级时间戳
6. **并行派发计划** — 与 taskGraph JSON 的 `dependsOn` + `group` 完全一致
7. **门禁值** — Java 80%, Go 75%, 引擎/bff/website 85%, UI 90%

### 9.6 失败处理
- 某 subagent 重试 1 次仍失败：跳过该组，汇总报告标记 `❌ 未生成`
- 全部 subagent 失败：§9 输出简版（仅 9.6 并行计划，其余写「subagent 未就绪，须人工补充」）

---

## 质量禁令 14 条（MUST，逐条自检勾选）

> 对齐 `.agents/rules/luban-e2e-execution-contract.md` 与 `.agents/rules/luban-testing-coverage.md`。定稿须含**质量禁令自检表**，逐条勾选，不得跳过。

| # | 禁令 | 说明 |
|---|------|------|
| 1 | **禁止跳过功能** | 未实现的需求子项须实现；唯一允许不做的是产品 SSOT 中已存在的「非目标」条款，且须在 plan「明确不做」逐条引用原文并获用户确认（与「静默跳过」同罚则） |
| 2 | **禁止假绿** | 测试不得靠不当 `skip`、空断言、关 bail 攒红、或无后端全 skip 仍宣称通过 |
| 3 | **禁止占位** | 禁止 TODO / 假固定文案 / 无契约 mock 数据冒充已接入真实行为 |
| 4 | **禁止骨架交付** | 禁止仅保留路由 / 空壳页面 / 无反馈按钮即宣称功能完成 |
| 5 | **禁止用 JSON 替代页面** | 禁止以整页只渲染 raw JSON / 调试 dump 代替真实 UI 与交互 |
| 6 | **页面交互完整** | 每个承诺的用户可见流程须有 §4.2 级分步链路，并在实现/E2E 中有对应断言 |
| 7 | **验收口径=可交付** | 凡写入本期范围的用户可见能力，合入与「完成」汇报默认口径为真实页面上的完整业务链路；不得以「仅后端 REST 可用」/「仅 IT 通过」作为交付结论，除非产品 SSOT 显式声明「无 UI、纯 API」且用户确认 |
| 8 | **引擎 E2E 绑正式路由** | §7 引擎渲染 E2E 须对应正式产品页面/路由；禁止 `pages/e2e/*` 专测页作为新增特性主载体 |
| 9 | **门禁分级执行** | 定稿须含分级验收门禁表（四级：G1 代码审查 → G2 安全 → G3 单测+覆盖率 → G4 E2E），每级写明验证方式 / 通过条件 / 责任人；禁止无门禁方案进入实现 |
| 10 | **/luban-review 清零** | 实现阶段 Post-Dev Workflow 须含 `/luban-review` 全自动审查，🔴🟡🔵 全部清零（含建议级别）方可进验证阶段 |
| 11 | **安全审查门禁** | 涉及敏感数据（手机号/身份证/地址/余额/凭证）、支付结算、外部 API 对接、权限模型变更的方案，门禁表加安全审查级；含敏感字段清单 + 加密策略 + 鉴权覆盖 + OWASP Top 10 自查；禁止未过安全审查进实现 |
| 12 | **双后端契约一致** | 新增/修改的每个接口须声明 Java 与 Go 两端均实现且行为一致（响应体字段、错误码、状态机一致）；禁止新增接口只声明单端 |
| 13 | **多端渲染一致** | 引擎产物在 website、electron、flutter 等端渲染一致；新增/修改物料须在各端验证 |
| 14 | **FeatureGate 默认约束** | 每个新增用户可见功能须默认设计 FeatureGate 开关，写明 key / 作用域 / 关闭行为；回滚方案中 FeatureGate 关闭列为首选；不用开关须写理由 |

**自检表格式**（定稿附录）：
```
- [x] 禁止跳过功能（所有 gap 映射到 task，无静默省略）
- [x] 禁止假绿（E2E 真实执行契约，见 §7.2）
... 逐条
```

---

## 分级验收门禁表（G1–G4，MUST）

> 定稿须含此表（可放附录）。每级写明验证方式 / 通过条件 / 责任。**禁止无门禁定义的方案进入实现阶段。**

| 级别 | 名称 | 验证方式 | 通过条件 | 责任 |
|------|------|---------|---------|------|
| **G1** | 代码质量与审查 | `/luban-review` 全自动审查 | 🔴🟡🔵 全部清零（含建议级别） | plan owner |
| **G2** | 安全审查 | OWASP Top 10 自查 + 敏感字段清单 + 鉴权覆盖检查 | 无高危 / 中危遗留；敏感字段加密；无注入点 | plan owner（涉及敏感数据/支付/外部对接/权限变更时**必选**，否则可选） |
| **G3** | 单测 + 覆盖率门禁 | 分栈：`pnpm test` / `mvn -q verify` / `go test ./... -race -cover` | 达 §6.3 门禁值（engine/bff/website 85% · UI 90% · Java 80% · Go 75%） | plan owner |
| **G4** | E2E 验收 | Playwright 主链路（绑正式路由） | 全绿、无 `*.skip`、无假绿 | plan owner |

**门禁执行顺序**：G1（/luban-review 清零）→ G2（安全）→ G3（单测覆盖率）→ G4（E2E）。**/luban-review 先行**，禁止未过审查跑后续验证。

---

## 敏感字段清单与加密约束（MUST，安全相关 plan 必选）

涉及敏感数据的方案须列敏感字段表：

| 字段 | 位置 | 处理 |
|------|------|------|
| `user.password` | Java/Go User 表 | 仅存 hash（bcrypt），禁止明文/日志 |
| `JWT secret` | BFF `AUTH_JWT_SECRET` | 环境变量，禁止入库 |
| `X-User-*` header | BFF→backend | 内网可信，禁止外泄到响应 |
| 手机号/身份证（若有） | 相关表 | 加密存储 + 日志脱敏 + 前端掩码展示 |

**约束**：
- 敏感字段**禁止**出现在明文日志 / 异常堆栈 / 调试 dump
- 前端展示须脱敏（如手机号 `138****1234`）
- 凭证类（token / secret）仅存环境变量，不入库不入仓
- 对齐 OWASP Top 10 自查（注入 / 失效认证 / 敏感数据泄露 / XXE / 失效访问控制 / 安全配置错误 / XSS / 反序列化 / 已知漏洞组件 / 日志监控不足）

---

## 回滚方案模板（涉及迁移/配置/外部对接时 MUST）

每个涉及 Flyway 迁移、配置变更、外部 API 对接、FeatureGate 的任务须写回滚步骤。

**回滚表模板**：
| 变更 | 回滚首选 | 回滚次选 | 数据影响 | 验证点 |
|------|---------|---------|---------|--------|
| 新功能开关 | **关 FeatureGate**（无需回滚代码/DB） | revert 代码 commit | 无 | 关闭后行为符合 §6.5 契约 |
| Flyway 迁移 | `flyway undo` / 手动回滚 SQL（须先 staging 验证） | baseline 回退 | 可能有（须评估） | staging 跑通后才上 prod |
| 外部 API 对接 | 关 FeatureGate + 切回旧链路 | revert commit | 无 | 旧链路功能不退化 |
| 物料 schema 重构 | 保留旧 ComponentMeta 兼容期，灰度切换 | revert | 兼容期内无 | 下游消费方不破 |

**回滚首选 = FeatureGate 关闭**（见禁令 §14）。无 FeatureGate 的变更须写理由并评估回滚成本。

---

## §10 明确不做（防膨胀）

### 10.1 必须包含什么
- 凡非需求原文 / 本期目标所必需的能力（过度配置 / 无关重构 / 顺手加字段接口页面），须拒绝或单列「明确不做（防膨胀）」并简述理由
- 唯一允许「不做」的情形：产品 SSOT（或已签章 PRD）中已存在的「非目标」条款，须**逐条引用原文标题或编号**并获用户确认

### 10.2 显式延后（非静默跳过）
- 延后到后续迭代的功能须单列「已知缺口显式延后」表：项 / 延后到 / 理由
- 与「静默跳过」严格区分——延后须有去向（哪个后续 plan / 哪期迭代）

### 10.3 验收要点
- [ ] 「明确不做」逐条引用 SSOT 原文
- [ ] 延后项有明确去向，非静默省略
- [ ] 砍 scope 已获用户确认（有对话/PRD 证据）

---

## §11 定稿合规验收清单（reviewer 用）

reviewer 判定一份 plan 是否合规定稿，逐项核对：

- [ ] §0 YAML 字段齐全，taskGraph JSON 存在且校验通过
- [ ] §1 追溯矩阵覆盖所有上游需求，证据可追溯
- [ ] §2 系统与链路完整，列表页分步
- [ ] §3 状态机 / 事务边界 / 业务规则齐全
- [ ] §4（含 UI 时）§4.3 逐页结构展示，四态明确
- [ ] §5 复用件契约表齐全
- [ ] §6 双后端矩阵 + 覆盖率门禁 + 物料标准 + FeatureGate
- [ ] §7 E2E 绑正式路由 + 多租户用例 + 脚本保障逻辑
- [ ] §8 TDD + 单期收口 + Post-Dev Workflow
- [ ] §9 实现任务派发（§0–§8 写完后同轮生成）
- [ ] 质量禁令 14 条自检逐条勾选
- [ ] G1–G4 分级验收门禁表齐全
- [ ] 敏感字段清单（涉及安全时）
- [ ] 回滚方案（涉及迁移/配置/外部对接时）
- [ ] 「明确不做（防膨胀）」+ 显式延后
- [ ] 双后端一致性声明（无单端接口）
- [ ] 多端渲染一致性声明

**任一未达标 → 退回修改，不得进入实现阶段。**

---

## 附录 A：建议输出骨架（来自 plan-template 命令体）

**第一轮（讨论稿）**：
- 一句话背景与目标
- 待确认问题（编号，可勾选）
- 子系统涉及表 + 每系统拟增量（各不超过数行）
- 「明确不做（防膨胀）」与「建议后续迭代」
- 风险、外部依赖、与现有文档/接口冲突
- 请用户选择或补充后再进入第二轮

**第二轮（定稿 plan，含 §0–§9）**：
- 开场一句：正按 `writing-plans` + `PLAN_WRITING_CONTRACT` 输出
- 需求追溯矩阵（§1）
- 明确不做（防膨胀）（§10）
- 完整契约章节 §0–§8 + §4.3 逐页页面结构 + 任务勾选 + E2E/TDD + 实现阶段并行 Task 线说明
- 质量禁令自检表
- 分级验收门禁表（G1–G4）
- 敏感字段清单与分级约束
- 双后端契约一致性声明
- 多端渲染一致性声明
- FeatureGate 开关设计（§6.5）
- E2E 用例枚举（每场景一张表）
- E2E 路由合规性确认（无新增 `pages/e2e/*`）
- 错误场景清单（每功能至少 3 种非正常路径）
- 回滚方案
- Post-Development Workflow（§8.5）
- 实现会话须一次推进至验证全绿后做完成汇报
- 每步必须定义验证门：`验证门: <命令>`（多模块改动为每模块分别定义）

**§0–§8 写完后 → 同轮进入 §9 生成**：派发并行 subagent 填充文件映射/API契约/DDL/物料schema/组件接口/并行派发计划，追加到同一 plan 后输出完整 plan（§0–§9）。

---

## 附录 B：与其它命令/skill 的衔接

| 触发 | 衔接 |
|------|------|
| 需求模糊 / 创新功能 / 改行为前 | `.agents/skills/brainstorming/SKILL.md` |
| 多维论证须写入 plan 正文 | `/10-bs` + `.agents/skills/ten-round-brainstorm/SKILL.md`，落 `## 十轮并行头脑风暴与结论` 体例 |
| E2E + TDD 门禁 | `.agents/rules/luban-e2e-execution-contract.md` + `docs/E2E_AGENT_GUIDE.md` |
| 产品闭环 / UX / website 规范 | `.agents/skills/ux-product-review/SKILL.md`（与 `/super-pm` 一致） |
| 双后端契约 | `docs/DUAL_BACKEND_PARITY.md` + `.agents/rules/luban-dual-backend-parity.md` |
| 低代码引擎 / 物料 | `docs/LOWCODE_ENGINE_SPEC.md` + `.agents/rules/luban-material-schema.md` + `.agents/rules/luban-lowcode-engine-quality.md` |
| 多端一致 | `.agents/rules/luban-multi-client-consistency.md` |
| 任务图执行 / 并行子任务 / §9 生成 | `.agents/skills/subagent-driven-development/SKILL.md` + `.agents/skills/dispatching-parallel-agents/SKILL.md` + `.agents/skills/executing-plans/SKILL.md` |
| 宣称完成前 | `.agents/skills/verification-before-completion/SKILL.md` |
| 定稿结构与粒度（必读） | `.agents/skills/writing-plans/SKILL.md` |

定稿时**始终全文加载** `.agents/skills/writing-plans/SKILL.md`；其余为按需叠加，须在 plan 或对话中说明「已加载哪些 skill」以免遗漏门禁。

---

## 附录 C：维护说明

- **权威源**：`.agents/commands/plan-template.md`（27KB）。本文件从其中提取并结构化。
- **冲突解决**：若命令体与本契约冲突，以**命令体**为准并回写本文件。
- **更新触发**：plan-template 命令体变更 / writing-plans skill 变更 / 新增质量禁令 / 门禁值调整时同步更新本文件。
- **校验脚本**：`node scripts/verify-plan-ssot.mjs validate <plan-path>` 校验文首 taskGraph JSON 合法性。
- **覆盖范围声明**：本契约适用于所有 `.agents/plans/*.md`（child plan / program plan）。`docs/superpowers/plans/*.md` 若存在同样适用（writing-plans skill 第 22 行）。
