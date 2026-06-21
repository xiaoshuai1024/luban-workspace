# CodeGraph sources for this workspace

> 本文件记录哪些 workspace 已被 CodeGraph 索引。新会话先看这里，避免重复 `reindex_workspace`。
> 工具与规则见 [`.agents/rules/luban-codegraph-usage.md`](./.agents/rules/luban-codegraph-usage.md)。

## 已索引 workspace

- **D:\codes\luban-workspace** — 索引于 2026-06-21，slug `luban-workspace-95f7`
  - 模型：`bge-small`（语义搜索已开启）
  - 排除：`node_modules` / `.worktrees` / `.e2e-tmp` / `dist` / `.next` / `target`
  - max-files: 8000
  - 覆盖：11 子模块（engine/bff/ui/web/backend 等），含 TS / Java / Go / Vue

## 首次调用前检查

若 `codegraph_symbol_search` 对常见术语（如 `LowcodeRenderer` / `LeadService`）返回空：
1. 调用 `codegraph_reindex_workspace` 重建索引
2. 更新本文件的索引日期
