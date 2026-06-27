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
      "subsystem": "backend",
      "journey": "J-publish"
    }
  ],
  "journeys": [
    {
      "id": "J-publish",
      "title": "发布闭环",
      "priority": "P0",
      "scenarios": ["发布", "下线", "版本回滚"],
      "entrySubsystem": "engine",
      "status": "covered"
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
| `tasks[].journey` | string? | （可选）关联的用户旅程 id，软引用 `journeys[].id` |
| `journeys[].id` | string | 旅程唯一 id，建议 `J-<语义短词>`（如 `J-publish`、`J-leads`），跨 plan 可复用 |
| `journeys[].title` | string | 旅程中文名 |
| `journeys[].priority` | enum | `P0`（阻断门禁）/ `P1` / `P2` |
| `journeys[].scenarios` | string[] | 旅程覆盖的场景（发布/下线/版本回滚…），用于断言密度评估 |
| `journeys[].entrySubsystem` | enum | 入口子系统（engine / website / workspace） |
| `journeys[].status` | enum | `declared` / `covered` / `gap`（声明、已绑定 spec、缺 spec） |
| `journeys[].ref` | boolean? | `true` 表示仅引用已在别处定义的旅程，不重复填 title/priority 等字段 |

### luban subsystem 取值

- `engine` — 低代码引擎
- `bff` — BFF
- `ui` — UI 物料库
- `web` — SSR 站点
- `backend-java` — Java 后端
- `backend-go` — Go 后端
- `client` — 多端（electron/flutter/cross-platform）
- `cross` — 跨子系统

## 旅程覆盖（Journey Coverage）

`journeys` 数组是 E2E 链路覆盖率的**结构化分母**。每个 plan 在 §7.0 声明本期旅程并同步到此 JSON；spec 侧通过标题后缀标签 `@J-<id>` 绑定到旅程（见 `docs/dev/e2e-test-style-guide.md` §4）。

**引用规则**：旅程**首次定义**在引入它的 plan（带完整字段）；后续 plan 引用同一 id 只写 `{"id":"J-publish","ref":true}`，聚合脚本以首次定义为准并合并 scenarios。

**全局旅程总盘** = 所有 taskGraph JSON 中 `journeys` 的并集（按 id 去重），作为 `journey-coverage` 报告的分母。无 `journeys` 字段的 plan（纯后端/纯修复）不计入分母，聚合时跳过。

**门禁**：`P0` 旅程若已声明却无任何 spec 绑定 `@J-<id>` → `journey-coverage` 脚本 exit 1（阻断合并）；`P1`/`P2` 仅在报告中显示覆盖率与缺口，不阻断。

## 校验

```bash
# 校验单个 JSON schema（含 journeys 可选字段、task.journey 引用合法性）
node scripts/verify-plan-ssot.mjs validate <path-to-json>

# 聚合所有 taskGraph JSON 的旅程总盘 + 扫描所有 spec 的 @J-xxx 标签 → 覆盖率矩阵
# P0 旅程无 spec 绑定 → exit 1
node scripts/verify-plan-ssot.mjs journey-coverage
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
