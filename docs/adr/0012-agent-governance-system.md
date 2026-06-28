# ADR 0012: Agent 治理体系（rules + skills + 记忆闭环）

| 字段 | 值 |
|------|-----|
| 状态 | Accepted |
| 日期 | 2026-06-28 |
| 决策者 | 工程效率组 |
| 关联文档 | [AGENTS.md](../../AGENTS.md)、[.agents/rules/](../../.agents/rules/)、docs/SUPERPOWERS.md、ADR-0005 |
| 回溯 | Yes（决策实际发生于项目早期，本篇为 2026-06-28 回溯记录） |

## 背景 (Context)

Luban 由多个 Agent 跨多个会话协作开发，这些 Agent 来自不同工具（opencode/cursor/claude 等）。若治理靠人记忆与口头约定，会出现：禁止推测、测试覆盖率、E2E 契约、Git 合并、SSOT 任务图、双后端对齐、引擎质量等约束在不同会话里被各自理解甚至遗忘；经验教训散落在对话里无法沉淀；进度口径因 Agent 而异。团队需要一套分层、可自动加载、可跨工具共享、可自我改进的治理体系。

## 决策 (Decision)

建立分层 Agent 治理：rules（按 globs/alwaysApply 自动加载的硬约束）+ skills（可复用工作流与命令）+ SSOT 任务图记忆闭环。

- rules 层（`.agents/rules/`，22 条）：每条规则顶部 HTML 注释含元数据（description/globs/alwaysApply），Agent 按文件 glob 或 alwaysApply 自动加载；覆盖禁止推测、测试覆盖率、E2E 契约、Git 合并、SSOT 任务图、双后端对齐、引擎质量、禁止本地 docker 等。`.agents/` 被 opencode/cursor/claude 共用，`.claude/` 为 Claude Code 专属。
- skills 层（`.agents/skills/` + 插件）：brainstorming/writing-plans/executing-plans/TDD/systematic-debugging 等工作流；自定义命令（/plan-template、/luban-review、/e2e-archi 等）。
- 记忆闭环：进度只存 SSOT（任务图 JSON）不靠对话；完成/阻塞后写 JSON，下会话 SessionStart hook（scripts/session/in-progress-summary.mjs）自动读出。经验类教训落对应 rule 文件，成熟后由 self-improve 机制升级。
- 启动检查清单：信息完整性/每日远端同步/进行中工作注入/优化待办扫描/加载核心文档/加载 skills/并行 subagent/Git 分支/worktree/双后端/低代码/非沙箱权限。

## 考虑过的备选方案 (Alternatives Considered)

### 备选 A：靠人记忆与口头约定
- 优点：零基建、灵活。
- 缺点 / 代价：约束随人/会话漂移；经验无法沉淀与复用；新人/新 Agent 上手无凭；违规只能事后复盘，无前置阻断。

### 备选 B：单一巨型 prompt
- 优点：一处定义、加载简单。
- 缺点 / 代价：上下文成本高、维护噩梦；无法按文件 glob 精准加载（无关规则白白占用 token）；难以增量演进与部分禁用；不同工具/Agent 间复用困难。

## 后果 (Consequences)

- **正面**：多 Agent 跨会话行为一致可控；约束按需自动加载，token 高效；经验沉淀可累积且可自我改进；新人/新 Agent 上手有明确入口。
- **负面 / 代价**：规则与 skill 数量增长带来维护成本；自动加载逻辑依赖工具对元数据的正确解析；过度规则化可能抑制 Agent 灵活性。
- **需要后续跟进**：定期 review rules 命中与过期情况（self-improve）；监控启动检查清单的实际执行率；平衡规则数量与上下文成本。

## 备注

推翻条件：出现更统一的原生 Agent 治理标准（如行业 facts/rules 格式标准化），或维护成本超过一致性收益。SSOT 记忆闭环依赖 ADR-0005。
