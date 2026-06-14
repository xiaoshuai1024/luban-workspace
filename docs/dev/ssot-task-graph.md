# SSOT 任务图

任务图 JSON 文件是任务依赖与状态的**唯一事实源（SSOT）**。

> luban 规则 `.agents/rules/luban-task-graph-ssot.md` 定义何时加载本约束。

## 文件位置

`docs/superpowers/tasks/<featureId>.json`

## Schema

```json
{
  "featureId": "xxx",
  "title": "特性名称",
  "planPath": "docs/superpowers/plans/...md",
  "tasks": [
    {
      "id": "task-001",
      "title": "任务描述",
      "status": "pending",
      "dependsOn": ["task-000"],
      "group": "A",
      "subsystem": "backend"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `featureId` | string | 特性唯一标识 |
| `title` | string | 特性名称 |
| `planPath` | string | 关联方案文档路径 |
| `tasks[].id` | string | 任务唯一 ID |
| `tasks[].title` | string | 任务描述 |
| `tasks[].status` | enum | `pending` / `in_progress` / `completed` / `blocked` |
| `tasks[].dependsOn` | string[] | 前置依赖的任务 ID 列表，空数组=无依赖可并行 |
| `tasks[].group` | string | 并行组：同组可并行执行，A→B→C 表示先后顺序 |
| `tasks[].subsystem` | enum | 所属子系统 |

### luban subsystem 取值

- `engine` — 低代码引擎
- `bff` — BFF
- `ui` — UI 物料库
- `web` — SSR 站点
- `backend-java` — Java 后端
- `backend-go` — Go 后端
- `client` — 多端（electron/flutter/cross-platform）
- `cross` — 跨子系统

## 校验

```bash
node scripts/verify-plan-ssot.mjs validate <path-to-json>
```

## 原则

- **单一真相源**：任务状态只看任务图 JSON，不看聊天记录或散落的 markdown。
- **依赖驱动**：`dependsOn` 为空的任务可立即并行；有依赖的等待前置完成。
- **group 分组**：同 group 的任务并行执行，不同 group 按字母序先后。
- **跨子系统任务**：标 `cross`，需多端/双后端协同。

## 与方案文档的关系

- 方案文档（`plans/*.md`）描述「做什么、怎么做」。
- 任务图 JSON 描述「按什么顺序、谁来做、做到哪」。
- 方案通过 review 后，由主 agent 拆解为任务图 JSON，进入执行阶段。
