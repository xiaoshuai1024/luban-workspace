# Luban 项目规范

**🔴 系统优先级：** 低代码引擎可用性与物料合规 > 各端一致性 > 后端功能。能力受限时优先保障引擎渲染。

本文档为极简索引，详细规范通过引用组织。Agent 启动后加载本文档，按需读取详细文档。

**与维护者对话：** 汇报默认最简略，列粗粒度条目；除非要求细节，不展开逐文件清单。对用户常规回复简短：过程→结果→建议。

**并行子 agent（本仓 MUST）：** 任何工作只要能开 subagent 就尽量并行；主会话用 Task/Agent 拆并行子任务提速。

---

## 项目结构

```
luban-workspace/                  # meta 仓
├── .agents/                      # 跨工具共享（opencode/cursor/claude）
│   ├── rules/ commands/ skills/ plans/ ecc/
├── .claude/                      # Claude Code 专属
│   ├── settings.json mcp.json commands/ skills/ hooks/
├── docs/                         # 详细规范 + 技术经验（dev/）
├── harness/prompts/              # Prompt 模板
├── scripts/                      # git/coverage/github 编排
├── packages/                     # 11 子项目（git submodule）
└── CLAUDE.md AGENTS.md Makefile
```

---

## 规则索引（`.agents/rules/`）

每条规则顶部 HTML 注释含元数据（description / globs / alwaysApply）。

| 规则 | 用途 | 何时加载 |
|------|------|----------|
| `luban-no-speculation-no-blind-dev.md` | 禁止推测与无信息开发（alwaysApply） | 任何任务前 |
| `luban-testing-coverage.md` | 全栈单测/集成/E2E 强制范围 | 改码/新功能/修 bug 前 |
| `luban-e2e-execution-contract.md` | E2E：禁假绿/禁降级/会话内冻结 | 跑 E2E、宣称门禁通过前 |
| `luban-e2e-agent-guide.md` | E2E 执行门禁 | 运行/调试/编写 E2E 前 |
| `luban-git-merge-pull.md` | 禁自动合并/冲突询问/pull 前 commit | Git 合并/拉取时 |
| `luban-daily-main-sync.md` | 每日远端同步弹窗 | 会话启动（pending JSON） |
| `luban-task-graph-ssot.md` | 任务图 JSON 为 SSOT | 编写/修改 plans/tasks 前 |
| `luban-plan-contract.md` | 方案编写契约/必选章节 | 编辑 plans/*.md 时 |
| `luban-frontend-ux-enum.md` | 交互组件决策树 + 枚举中文映射（基准 luban-ui） | 编辑 .vue 时 |
| `luban-cross-cutting-standards.md` | BFF字段/引擎物料schema/多端一致/分页错误体 | 跨模块新功能、合入前 |
| `luban-lowcode-engine-quality.md` | 引擎门槛：零console/物料schema/各端渲染一致 | 编辑 engine/ui 时 |
| `luban-codegraph-usage.md` | 优先用 CodeGraph MCP 工具做代码结构查询（codegraph_*） | 查代码结构/调用链/影响分析前 |
| `luban-material-schema.md` | 物料注册/props schema/版本 | 编辑物料/引擎 schema 时 |
| `luban-multi-client-consistency.md` | electron/flutter/web 业务一致 | 编辑 client/* 时 |
| `luban-github-agile-agent.md` | gh CLI 优先/Issue/PR/label 约定 | 涉及 GitHub 时 |
| `luban-redis-cache.md` | 缓存命名/TTL/失效 | 编辑后端缓存时 |
| `luban-dev-no-prototype-docs.md` | 开发阶段禁改产品原型/设计目录 | 编辑设计目录时 |
| `luban-plan-agent-mode-triggers.md` | 识别方案/执行意图 | 用户表达方案意图时 |
| `luban-agent-hooks.md` | Hooks 配置与脚本卫生 | 编辑 hooks 时 |
| `self-improve.md` | 基于代码模式持续改进规则 | 发现新模式时 |

---

## 核心文档索引

| 文档 | 用途 |
|------|------|
| `docs/AGENT_RULES.md` | Agent 全部规则（§0–11：语言/Git/子任务/文档/API/后端Java/前端/RWD/多端/低代码/需求） |
| `docs/SUPERPOWERS.md` | 工作流：brainstorming→writing-plans→executing-plans |
| `docs/GIT_WORKFLOW.md` | Git 工作流（GitHub：分支/Commit/PR） |
| `docs/TESTING_SPEC.md` | 全栈测试规范（分栈覆盖率/分层/E2E） |
| `docs/E2E_AGENT_GUIDE.md` | E2E 执行单一指南（引擎渲染/website/多端） |
| `docs/LOWCODE_ENGINE_SPEC.md` | 低代码引擎/物料/schema 规范 |
| `docs/UI_SPEC.md` | luban 设计 token / 组件规范摘要 |
| `docs/SYSTEM_ARCHITECTURE.md` | **服务拓扑 SSOT**：各系统角色/端口/依赖/启动方式（Makefile dev-* target）/已知陷阱 |
| `docs/dev/INDEX.md` | 技术经验库索引（调试/安全/Java标准/后端日志/事故方法论等，从 kangdou 迁移） |

---

## 技术栈规范

- **前端/引擎/BFF/website**：TypeScript，统一 pnpm
- **UI 物料库**：Vue 3 + Vite，pnpm
- **后端 Java**：Spring Boot + Maven
- **单端权威**：Java 为唯一后端实现（Go 双后端战略已放弃，Q4=C，2026-06-28，见 `docs/DUAL_BACKEND_PARITY.md`）

### 改码后按包构建验证（MUST）
每在一个包改码后，在该包根执行构建+测试，无报错再结束。分层与覆盖率见 `.agents/rules/luban-testing-coverage.md`。

---

## 自定义命令（`.agents/commands/`）

`/10-bs` — 并行十轮头脑风暴
`/plan-template` — 全栈方案两轮（讨论稿→定稿）
`/super-pm` `/ux-product-review` — UX+产品专家审查（依 ux-product-review SKILL + rubric）
`/tdd` — TDD 模式（红→绿→重构，按包探测测试）
`/jx` — 继续当前任务（中断恢复）
`/luban-review` — 全自动审查循环（~20 并行 subagent + streaming 修复收敛）
`/e2e-archi` — 架构自检 + E2E TDD 覆盖分析 + 安全合规
`/engine-e2e` — 低代码引擎渲染 E2E
`/website-e2e` — SSR 站点 E2E
`/pull-all` — 各 submodule 同步默认分支
`/push-all` — 各 submodule commit+push（不建 PR）
`/pr-all` — 各 submodule + meta 仓 gh pr create
`/pr-engine` `/pr-bff` `/pr-ui` `/pr-website` `/pr-backend-java` `/pr-client` `/pr-workspace` — 按包提 PR
`/merge-branch` `/merge-conflict` — 分支合并/冲突处理
`/flyway-squash` — Java 后端 DB 迁移整理
`/prod-debug` `/prod-testing` — 生产调试/测试
`/prd` `/effort` `/write-ex` `/feishu-doc` — 辅助
`/pua` — 大厂 PUA 话术驱动 AI 穷尽方案再放弃（源自 [tanweai/pua](https://github.com/tanweai/pua)，本地化于 `.agents/skills/pua/`）
`/sprint-plan` `/sprint-import <featureId>` `/sprint-status` — 敏捷开发全流程（Sprint MCP，22 个 tool + HTTP 看板 :7777，与 `/plan-template` 任务图联动；`make sprint-up` 启动）

---

## 启动检查（MUST）

0. **信息完整性**：需求/信息有缺口须先询问（`luban-no-speculation`）
1. **每日远端同步检查**：pending JSON 弹窗
2. **进行中工作注入（自动）**：会话启动时 `SessionStart` hook 自动运行 `scripts/session/in-progress-summary.mjs`，从 SSOT `docs/superpowers/tasks/*.json` 抽取非终态任务摘要注入上下文——**开工无需手动喂进度**。优先处理「进行中/阻塞」，下一批看「待办」。承接某项用 `/jx`。
3. **优化待办扫描**：启动新迭代或排期规划前，扫描根目录 `TODO.md`，列出所有 `status ≠ done` 的条目并提示排进迭代
4. **加载核心文档**：`SUPERPOWERS` / `GIT_WORKFLOW`
5. **加载项目级 skills**：`.agents/skills/`
6. **协作粒度**：能开 subagent 就并行
7. **Git 分支检查**：第一次写入前；默认留用户当前分支
8. **Worktree 约定**：计划类用 `.worktrees/`
9. **低代码引擎提醒**：改 engine/ui/schema 时检查各端渲染一致
10. **非沙箱权限确认**：新会话执行非沙箱命令前询问

### 会话记忆闭环（MUST）

进度记忆**只存 SSOT，不靠对话**。完成/阻塞任何任务后：

1. 更新 `docs/superpowers/tasks/<featureId>.json` 对应 task 的 `status`（`in_progress`/`done`/`blocked`+`blockedReason`）与 `metadata.updatedAt`；
2. 下一会话 SessionStart hook 会自动读出——无需手动汇报"上次做到哪"；
3. 经验类教训（"不要再犯"）：先落对应 rule 文件 `.agents/rules/*.md`，成熟后由 `self-improve.md` 机制升级。

> 已废弃：早期配置的 memory MCP（`@modelcontextprotocol/server-memory`，D:/ 路径）已移除——知识图谱 JSONL 不进 git、与你"完成任务时间线"的需求不匹配。记忆统一走 task 图 JSON + rules 文件，皆 version-controlled。

### 会话记忆闭环（MUST）

进度记忆**只存 SSOT，不靠对话**。完成/阻塞任何任务后：

1. 更新 `docs/superpowers/tasks/<featureId>.json` 对应 task 的 `status`（`in_progress`/`done`/`blocked`+`blockedReason`）与 `metadata.updatedAt`；
2. 下一会话 SessionStart hook 会自动读出——无需手动汇报"上次做到哪"；
3. 经验类教训（"不要再犯"）：先落对应 rule 文件 `.agents/rules/*.md`，成熟后由 `self-improve.md` 机制升级。

> 已废弃：早期配置的 memory MCP（`@modelcontextprotocol/server-memory`，D:/ 路径）已移除——知识图谱 JSONL 不进 git、与你"完成任务时间线"的需求不匹配。记忆统一走 task 图 JSON + rules 文件，皆 version-controlled。

### 会话记忆闭环（MUST）

进度记忆**只存 SSOT，不靠对话**。完成/阻塞任何任务后：

1. 更新 `docs/superpowers/tasks/<featureId>.json` 对应 task 的 `status`（`in_progress`/`done`/`blocked`+`blockedReason`）与 `metadata.updatedAt`；
2. 下一会话 SessionStart hook 会自动读出——无需手动汇报"上次做到哪"；
3. 经验类教训（"不要再犯"）：先落对应 rule 文件 `.agents/rules/*.md`，成熟后由 `self-improve.md` 机制升级。

> 已废弃：早期配置的 memory MCP（`@modelcontextprotocol/server-memory`，D:/ 路径）已移除——知识图谱 JSONL 不进 git、与你"完成任务时间线"的需求不匹配。记忆统一走 task 图 JSON + rules 文件，皆 version-controlled。

---

## 规范演进
当用户说"记住这一点""不要再犯"时：分析→定位文档→添加→告知。禁止忽略反馈。
