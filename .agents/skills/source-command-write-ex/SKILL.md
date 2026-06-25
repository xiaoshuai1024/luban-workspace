---
name: "source-command-write-ex"
description: "将当前会话中的排障经验归类追加到对应规则/经验文件，全程自动完成"
---

# source-command-write-ex

Use this skill when the user asks to run the migrated source command `write-ex`.

## Command Template

## 含义

**`/write-ex`**：自动完成两件事：

1. **团队共享** → 按主题归类追加到 `docs/dev/` 对应文件（提交 Git）
2. **个人记忆** → 由 MCP memory（`@modelcontextprotocol/server-memory`）或 Codex-mem 自动管理，**禁止**手动 Write `memory/*.md`

## 归类映射

| 标签关键词 | 目标文件 |
|-----------|---------|
| flyway, migration, sql, 迁移 | `docs/dev/luban-flyway-migration-standards.md` |
| e2e, testing, playwright | `docs/dev/luban-e2e-agent-guide.md` |
| e2e-contract, 假绿, 测试纪律 | `.agents/rules/luban-e2e-execution-contract.md` |
| git, merge, pull, conflict, 冲突 | `docs/dev/luban-git-merge-pull.md` |
| redis, cache, ttl | `.agents/rules/luban-redis-cache.md` |
| frontend, engine, ui, ux, enum, 中文显示, 枚举 | `.agents/rules/luban-frontend-ux-enum.md` |
| testing-coverage, 单测, 覆盖率 | `.agents/rules/luban-testing-coverage.md` |
| lowcode, engine, 引擎, schema, 物料 | `docs/LOWCODE_ENGINE_SPEC.md` |
| dev-prototype, 原型 | `.agents/rules/luban-dev-no-prototype-docs.md` |
| plan, superpowers, task-graph | `.agents/rules/luban-plan-contract.md` |
| plan-mode, agent-mode | `.agents/rules/luban-plan-agent-mode-triggers.md` |
| design-tokens, token, 样式 | `docs/UI_SPEC.md` |
| hooks | `.agents/rules/luban-agent-hooks.md` |
| cross-cutting, 全栈审查, 双后端 | `.agents/rules/luban-cross-cutting-standards.md` |
| github, gh, pr, issue | `.agents/rules/luban-github-agile-agent.md` |
| luban-review, review, 审查 | `docs/dev/luban-review-convergence-gate.md` |
| daily-dev, daily, 日常 | `docs/dev/luban-daily-main-sync.md` |
| speculation, blind-dev, 臆测 | `.agents/rules/luban-no-speculation-no-blind-dev.md` |
| alibaba, java-manual, 编码规范 | `docs/dev/alibaba-java-development-manual.md` |
| go, golang, go-后端 | `docs/dev/go-backend-standards.md` |
| dual-backend, 双后端一致 | `docs/DUAL_BACKEND_PARITY.md` |
| multi-client, 多端, electron, flutter | `.agents/rules/luban-multi-client-consistency.md` |
| material, 物料, schema | `.agents/rules/luban-material-schema.md` |
| task-graph-ssot | `.agents/rules/luban-task-graph-ssot.md` |
| experience, 经验教训, lessons | `docs/dev/luban-experience-lessons.md`（通用兜底） |
| 其他（未匹配） | `.agents/rules/self-improve.md` |

## Agent 执行步骤

### Step 1 — 提取经验

回顾当前会话的完整上下文，提取：

- **问题标题**：简短概括
- **场景**：什么操作触发了问题
- **根因**：为什么出现
- **解决方案**：如何修复（关键命令、SQL、代码修改）
- **预防措施**：以后怎样避免

### Step 2 — 写入团队规则/经验文件

1. 根据标签匹配目标文件（上表）
2. 读取文件末尾，追加 `## 经验：{问题标题}` 章节

格式：

```markdown
---

## 经验：{问题标题}

### 场景
{触发条件、错误表现}

### 根因
{为什么}

### 解决方案
```bash
{关键命令}
```
```sql
{关键 SQL}
```

### 预防
{检查清单、配置规范}
```

3. 若目标文件已有同名章节，追加 `### 案例 N`

### Step 3 — 个人记忆（MCP memory）

个人记忆通过 **MCP memory**（`@modelcontextprotocol/server-memory`）或 **Codex-mem** 自动管理，**禁止**手动写入本地 `memory/*.md` 文件。

记忆由 hooks 自动捕获（PostToolUse / UserPromptSubmit 等），无需手动调用 MCP 写入工具。

**只需做一件事**：确认本次经验中用户的具体偏好（如 UI 决策、命名习惯、工作流选择）已被写入 team docs，由 memory 在后续会话中自动从 team docs 提取上下文。

### Step 4 — 提交 Git（团队部分）

```bash
git add docs/dev/{匹配的文件} .agents/rules/{匹配的文件}
git commit -m "chore: add experience - {问题标题}"
```

> 提交前经用户确认。
