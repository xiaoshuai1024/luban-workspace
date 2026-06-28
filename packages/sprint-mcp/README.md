# @luban/sprint-mcp

> Luban 敏捷开发全流程 MCP Server — Sprint / Epic / Story / Release / Retrospective，与 SSOT 任务图联动，含实时 HTTP 看板。

## 这是什么

在 luban-workspace 现有 SSOT 任务图（`docs/superpowers/tasks/*.json`）之上叠加完整的敏捷开发流程。数据存储为纯 JSON 文件（无数据库），与任务图通过 `task.sprintId` 反向指针 + `story.taskRefs` 双向链接。

**定位**：填补开源 MCP 生态空白——没有任何开源 MCP 实现了真正的 sprint/iteration 模型（全是纯 kanban）。本包参考 cardo（依赖+环检测+活动日志）、Sprintra（sprint/epic/story/release 概念）、bradrisse（manager+action 工具命名）自建，并把 SQLite 模型翻译为 JSON 文件持久化。

## 快速开始

```bash
# 1. 构建（首次或改码后）
make sprint-build

# 2. 后台启动 server（MCP stdio + HTTP 看板 :7777）
make sprint-up

# 3. 打开看板
make sprint-open          # 浏览器 → http://127.0.0.1:7777

# 4. 查看状态
make sprint-status        # 终端输出当前迭代摘要
```

Agent 会话内通过 `/sprint-status` `/sprint-import <featureId>` `/sprint-plan` 等命令操作。

## 架构

```
Agent ←──stdio MCP──→ Sprint MCP Server (Node/TS)
                         ├── 22 个 MCP tool
                         └── HTTP :7777 看板 (SSE 实时刷新)

数据层（纯 JSON，git version-controlled）:
  docs/superpowers/sprints/<sprintId>.json   # sprint 注册表（一个迭代一文件）
  docs/superpowers/sprints/releases.json     # 全局 release 注册表
  docs/superpowers/tasks/*.json              # 现有任务图（task 节点加 sprintId 反向指针）
```

## 22 个 MCP Tool（manager + action 模式）

| # | Tool | actions | 说明 |
|---|------|---------|------|
| 1 | `sprint_manager` | create start close cancel get list get_current update | 迭代生命周期 |
| 2 | `sprint_metrics` | burndown velocity readiness summary | 燃尽/速率/就绪度 |
| 3 | `sprint_carryover` | execute | 收尾：未完成 story 转入 backlog/下迭代 |
| 4 | `story_manager` | create update get move delete list | 用户故事 CRUD + 状态流转 |
| 5 | `story_backlog` | add_to_sprint remove_from_sprint list_backlog prioritize | backlog ↔ sprint |
| 6 | `story_context` | get | 聚合读（story+epic+taskRefs+comments+deps+activity） |
| 7 | `story_dependency` | add remove list graph | 依赖图（含环检测） |
| 8 | `story_comment` | add list | 评论 |
| 9 | `epic_manager` | create update get list delete | 史诗 |
| 10 | `acceptance_criteria` | add update_status verify list | 验收标准 |
| 11 | `release_manager` | create update get list attach_sprint release | 发布管理 |
| 12 | `release_notes` | generate | 生成 release notes |
| 13 | `board_view` | sprint backlog release | 看板视图 |
| 14 | `board_filter` | by_assignee by_epic by_subsystem by_status | 筛选 |
| 15 | `board_export` | csv markdown | 导出 |
| 16 | `plan_link` | link_story_to_task unlink list_links sync_status | 与任务图双向链接 |
| 17 | `plan_status_sync` | pull push | 双向状态同步 |
| 18 | `import_from_plan` | from_taskgraph from_journeys | 从 plan-template 导入 |
| 19 | `export_to_taskgraph` | sprint_to_tasks | 反向导出为 task 节点 |
| 20 | `sprint_retrospective` | start add_item close list | 复盘 |
| 21 | `activity_log` | list filter | 审计日志 |
| 22 | `git_branch_sync` | detect set_default | branch ↔ sprint 绑定 |

## 与 plan-template / 任务图联动（核心特性）

三种联动模式：

**A. 导入（plan → sprint）**：`/sprint-import <featureId>` 或 `import_from_plan`
```
docs/superpowers/tasks/feature-x.json 的 tasks[]
  → 每个 task 生成一个 backlog story
  → story.taskRefs 记录 featureId/taskId/subsystem
  → task 节点加 sprintId 反向指针
```

**B. 同步（双向）**：`plan_status_sync`
- `pull`：读 task.status 推导 story 完成度（所有 task done → story done）
- `push`：story.move 到 done → 所有 taskRefs 的 task.status 改为 done

**C. 导出（sprint → plan）**：`export_to_taskgraph`
- sprint stories 写回为 task 节点（carry-over 的另一种实现）

## 数据模型

详见 `src/types.ts`。核心实体：

- **Sprint**：迭代容器（status: planning→active→completed，含周期/容量/goal）
- **Epic**：史诗（含 acceptanceCriteria + journeyRef 关联）
- **Story**：用户故事（Fibonacci 点数，6 状态看板列，taskRefs 链接）
- **Dependency**：story 间依赖（blocks/branches/merges/sync，带环检测）
- **Release**：发布（聚合多个 sprint）

Story 状态流转（敏捷看板列）：
```
backlog → todo → in_progress → review → testing → done
                ↑___________________________________| (可回退)
```

## 开发

```bash
pnpm install          # 装依赖
pnpm test             # 跑测试（54 个，含端到端）
pnpm test:coverage    # 覆盖率
pnpm run build        # tsc 编译
pnpm run dev          # watch 模式
pnpm run typecheck    # 仅类型检查
```

## REST API（看板与外部脚本用）

```
GET  /healthz                              GET  /api/sprints
GET  /api/sprints/:id                      GET  /api/sprints/:id/board
GET  /api/sprints/:id/burndown             GET  /api/sprints/:id/metrics
GET  /api/backlog                          GET  /api/current
GET  /api/releases
PUT  /api/stories/:id/move  {sprintId,to}  # 拖拽改状态
GET  /api/events                           # SSE 实时推送
```

## 环境变量

| 变量 | 默认 | 说明 |
|------|------|------|
| `SPRINT_MCP_ROOT` | `.` | 仓库根（找 docs/superpowers/） |
| `SPRINT_MCP_PORT` | `7777` | HTTP 看板端口 |
| `SPRINT_MCP_NO_HTTP` | - | 设为 `1` 则仅启动 MCP（CI/headless） |

## 设计决策

- **纯 JSON 持久化**：无数据库，git 可追踪，符合「SSOT 只存 JSON」原则
- **独立 sprint 注册表**：不污染现有 17 个 task graph 文件，task 只加 `sprintId` 一个字段
- **不迁移 wave**：旧 wave 字段保留不动，新 sprint 系统独立运行
- **零额外运行时依赖**：仅 @modelcontextprotocol/sdk + zod + chokidar
