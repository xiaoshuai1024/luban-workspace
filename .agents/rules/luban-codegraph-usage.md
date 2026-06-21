<!--
description: 优先使用 CodeGraph MCP 工具（codegraph_*）做代码结构查询，而非 grep / 多文件盲读
globs: "**/*"
alwaysApply: false
-->

# CodeGraph 使用优先级（MUST）

**本仓已安装 CodeGraph MCP**（`codegraph-mcp` v0.18.6，45 工具，37 语言，本地 RocksDB 持久化）。
面对任何**代码结构性问题**，Agent 须**先用 `codegraph_*` 工具**，再考虑 grep / AST 脚本 / 文件遍历。

> 对齐 `luban-no-speculation-no-blind-dev.md`：禁止无信息开发 = 禁止盲读文件。CodeGraph 是"有信息"的首选入口。

---

## 何时用 CodeGraph（必选）

凡属于以下意图，**先查 graph，再动手**：

| 意图 / 问题 | 工具 |
|---|---|
| "谁调用了 X" | `codegraph_get_callers` |
| "X 调用了什么" | `codegraph_get_callees` |
| "改 X 会影响什么"（爆炸半径） | `codegraph_analyze_impact` |
| "从这里出发的调用链" | `codegraph_get_call_graph` |
| "模块级依赖图" | `codegraph_get_dependency_graph` |
| "图上跳 N 跳" | `codegraph_traverse_graph` |
| "按签名找函数" | `codegraph_find_by_signature` |
| "谁 import 了这个文件" | `codegraph_find_by_imports` |
| "找相似代码"（embedding 语义） | `codegraph_symbol_search`（语义搜，社区版通过向量召回） |
| "有什么没用" | `codegraph_find_dead_imports` |
| "有没有循环依赖" | `codegraph_find_circular_deps` |
| "入口点在哪" | `codegraph_find_entry_points` |
| "高复杂度热点" | `codegraph_find_hot_paths`、`codegraph_analyze_complexity` |
| "找这段代码的测试" | `codegraph_find_related_tests` |
| "找 trait/interface 实现者" | `codegraph_find_implementors` |
| "设计 gap / 架构文档" | `codegraph_design_gaps`、`codegraph_generate_architecture_doc` |
| "自然语言搜符号" | `codegraph_symbol_search` |
| "正则/模式搜" | `codegraph_search_by_pattern` |
| "按报错字符串定位" | `codegraph_search_by_error` |
| "搜文档源" | `codegraph_search_docs`、`codegraph_list_doc_sources` |
| "符号详情 + 位置" | `codegraph_get_symbol_info`、`codegraph_get_detailed_symbol` |
| "模块概览" | `codegraph_get_module_summary` |
| "复杂度指标" | `codegraph_analyze_complexity` |
| "PR 上下文（爆炸半径/测试缺口/陈旧文档/建议审查人）" | `codegraph_pr_context` |

> **工具总数**：42（社区版）。无 `find_similar` / `find_duplicates` / `find_unused_code`（Pro 版才有）。语义搜索通过 `symbol_search` 的向量召回实现。

---

## 编辑前必取上下文

**改任何源文件前**，先用上下文工具取**精简、去重的符号集**（imports + signatures + callsites），而非盲读多个文件：

- `codegraph_get_ai_context` — 通用 AI 编辑上下文
- `codegraph_get_edit_context` — 针对特定编辑点
- `codegraph_get_curated_context` — 策展上下文

---

## 本仓结构约束（meta 仓 + git submodule）

本仓是 meta 仓，实际代码在 `packages/{engine,bff,ui,web,backend}/*/` 下的 **git submodule** 里。
CodeGraph 已配置 `--exclude` 排除 `node_modules` / `.worktrees` / `.e2e-tmp` / `dist` / `.next` / `target`。

**工具调用注意：**

1. **路径基点 = 工作区根**：CodeGraph 以 `D:\codes\luban-workspace` 为 workspace，路径参数用相对或绝对均可。
2. **子模块独立仓**：每个 submodule（如 `packages/engine/luban/`）是独立 git 仓。跨包改动分析时，`codegraph_analyze_impact` 能跨子模块查，因为它们都在同一 workspace 下被索引。
3. **双后端对齐**（见 `luban-dual-backend-parity.md`）：查 Java/Go 同接口实现时，先 `codegraph_symbol_search` 同时定位两端，再比对——比 grep 两遍快且准。
4. **物料 schema 追溯**（见 `luban-material-schema.md`）：用 `codegraph_get_detailed_symbol` 找物料 props 定义来源，区分"引擎定义" vs "物料自带"。

---

## 记忆层（跨会话持久化）

发现值得记住的东西，用 `codegraph_memory_store` 存（`agentSource` 传你的 agent 名，如 `"zcode"` / `"claude"`），后续会话用 `codegraph_memory_search` / `codegraph_memory_context` 取回。

| Kind | 适用场景 | 必填字段 |
|---|---|---|
| `debug_context` | 调试出非显然的根因 | `problem`, `solution` |
| `architectural_decision` | 在 X 和 Y 之间选了 X，有理由 | `decision`, `rationale` |
| `known_issue` | 发现值得标记的 bug / 怪癖 | `description`, `severity` |
| `convention` | 项目特定风格 / 模式 | `name`, `description` |
| `project_context` | 主题级宽泛笔记 | `topic`, `description` |

> **记忆是按 workspace slug 隔离的**（本仓 slug = `luban-workspace-95f7`）。`.worktrees/` 下的隔离工作区有独立 slug，记忆不互通。

> **与 MCP `memory` server 的分工**：Claude Code 还装了 `@modelcontextprotocol/server-memory`（知识图谱 JSONL）。约定：**代码结构相关的记忆进 CodeGraph**（`codegraph_memory_*`），**跨项目/通用的概念记忆进 memory server**。避免双写。

---

## 何时不该用 CodeGraph

- 纯文本重排 / 行级编辑 → 用 Edit
- 读 prose 文档（`.md` / `.rst`）→ 用 Read
- git 历史 / diff → 用 `git log` / `git show`
- 跑测试 / 类型检查 → 用 Bash
- 构建编排 → 用 Bash（本仓 Makefile `dev-*` target）
- 规则/方案文档查询 → 读 `docs/` 与 `.agents/rules/`（CodeGraph 默认不索引 `.agents/`）

---

## 质量检查（调用 CodeGraph 前）

1. **必须先索引**：若 `codegraph_symbol_search` 对常见术语返回空 → 先 `codegraph_reindex_workspace`。
2. **索引状态文件**：本仓根有 `codegraph-sources.md` 记录已索引 workspace，新会话先看它。
3. **embedding 已开**：本仓配置 `--embedding-model bge-small`，`codegraph_find_similar` 等语义工具可用。首次调用会触发模型加载（~数百 MB 内存）。
4. **遥测已关**：`CODEGRAPH_TELEMETRY=off`，无数据外发。

---

## 与本仓其他规则的协同

| 场景 | 先看 | CodeGraph 辅助 |
|---|---|---|
| 双后端契约对齐 | `luban-dual-backend-parity.md` | `symbol_search` 定位两端实现 |
| 物料 schema 合规 | `luban-material-schema.md` | `get_detailed_symbol` 追 props 来源 |
| 引擎渲染一致 | `luban-lowcode-engine-quality.md` | `analyze_impact` 评估改动爆炸半径 |
| E2E 覆盖缺口 | `luban-testing-coverage.md` | `find_related_tests` 找缺失测试 |
| 跨端业务一致 | `luban-multi-client-consistency.md` | `get_callers` 追同一业务的多端调用 |
| 无信息开发禁令 | `luban-no-speculation-no-blind-dev.md` | CodeGraph = "有信息"查询的首选入口 |

---

## 参考链接

- CodeGraph 仓库：[codegraph-ai/CodeGraph](https://github.com/codegraph-ai/CodeGraph)
- MCP 包：`@astudioplus/codegraph-mcp`
- Agent rules 原版：[codegraph-rules-for-agents](https://github.com/codegraph-ai/codegraph-rules-for-agents)
- 本规则基于官方 `general-agents/AGENTS.md` 适配（中文 + meta 仓 + submodule + 双后端上下文）
