<!--
description: CodeGraph MCP 使用规则（指向 .agents/rules/luban-codegraph-usage.md）
globs: "**/*"
alwaysApply: false
-->

# CodeGraph for Claude Code

本仓已配置 CodeGraph MCP（`codegraph-mcp` v0.18.6，45 工具，stdio，本地 RocksDB）。

**完整规则见 SSOT：[`.agents/rules/luban-codegraph-usage.md`](../../.agents/rules/luban-codegraph-usage.md)**

## 核心要点（Claude Code 会话内速查）

1. **代码结构问题优先用 `codegraph_*` 工具**，而非 grep / 多文件盲读。
   - "谁调用 X" → `codegraph_get_callers`
   - "改 X 会影响什么" → `codegraph_analyze_impact`
   - "找相似代码" → `codegraph_find_similar`（embedding 已开）
   - "PR 上下文" → `codegraph_pr_context`

2. **编辑前取上下文**：改源文件前先 `codegraph_get_edit_context` / `codegraph_get_ai_context`，拿精简符号集而非盲读。

3. **首次返回空 → 先索引**：`codegraph_reindex_workspace`。索引状态见 [`codegraph-sources.md`](../../codegraph-sources.md)。

4. **本仓是 meta 仓 + git submodule**：路径基点 = `D:\codes\luban-workspace`，跨子模块查同一 workspace。

5. **记忆分工**：代码结构记忆进 `codegraph_memory_*`（agentSource 传 `"claude"`），跨项目通用记忆进 MCP `memory` server。

详见 SSOT 规则文件。
