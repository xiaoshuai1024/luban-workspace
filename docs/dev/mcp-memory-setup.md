# MCP Memory 部署指南（本地免费 / 落盘持久化）

> 通用：如何用社区成熟的 `mcp-memory-service` 在本机运行 memory MCP，供 Claude Code / OpenCode / Cursor 共享记忆。
> 适用：luban 任何需要跨会话记忆的 AI 辅助开发场景。

## 1. 方案概述

使用 `mcp-memory-service`（社区成熟方案）在本机以 `uvx + Python 3.11` 方式运行（不依赖 Docker）：

- MCP（Streamable HTTP）：`http://127.0.0.1:8765/mcp`
- 数据持久化：SQLite 向量库落盘

## 2. 启动 / 关闭

首次复制环境模板：

```bash
cp scripts/memory/.env.example scripts/memory/.env
```

启动：

```bash
bash scripts/memory/up.sh
```

关闭：

```bash
bash scripts/memory/down.sh
```

## 3. Claude Code 接入

项目在 `.claude/mcp.json` 配置：

- `memory` → `http://127.0.0.1:8765/mcp`

重启 Claude Code 后即可看到 memory 工具。

## 4. OpenCode 接入（两种）

### 4.1 作为 Remote MCP（推荐）

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "memory": {
      "type": "remote",
      "url": "http://127.0.0.1:8765/mcp",
      "enabled": true
    }
  }
}
```

### 4.2 使用 memory-awareness 插件（可选）

参考上游仓库，该插件会在会话开始时自动检索并注入 memory（当前主要读，不含自动写回）。

## 5. 验收

1. `curl -X POST http://127.0.0.1:8765/mcp -H 'Content-Type: application/json' -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'`
2. 工具中能看到 `memory_*` 工具（如 `memory_store`、`memory_search`）
3. 写入一条 memory 后重启服务进程，仍可检索到（验证落盘）

## 6. luban 使用约定

- 决策/约束/踩坑类问题**先检索 memory**，避免重复决策。
- 禁止手动 Write `memory/*.md`（重复存储，由 MCP 统一管理）。
- 跨会话的关键决策、技术选型、踩坑教训写入 memory，下次会话自动注入相关上下文。
- luban 多端/双后端的契约决策须写入 memory，保证 Java/Go 两端开发 agent 共享上下文。
