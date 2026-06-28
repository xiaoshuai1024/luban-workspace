---
description: 启动/创建 sprint 迭代（敏捷开发全流程入口）
---

# /sprint-plan — Sprint 敏捷流程编排

端到端编排一个 sprint 迭代：创建 → 规划 backlog → 启动 → 收尾。这是敏捷开发的主入口命令。

## 子动作（根据用户意图选择）

### 创建新 sprint
1. 询问/确认：sprintId（如 `S-2026-07-W1`）、名称、目标、起止日期、团队容量。
2. 调用 `sprint_manager`（action: `create`）创建。
3. 提示：用 `/sprint-import <featureId>` 导入已有 plan 任务。

### 启动迭代
1. 调用 `sprint_manager`（action: `start`）planning → active。
2. 输出：`✓ <sprintId> 已启动`。

### 规划 backlog（排期）
1. 调用 `board_view`（action: `backlog`）列出未排入的 story。
2. 与用户确认要排入哪些，调用 `story_backlog`（action: `add_to_sprint`）逐个排入（backlog → todo）。
3. 可选 `story_backlog`（action: `prioritize`）重排序。

### 收尾迭代
1. 调用 `sprint_metrics`（action: `summary`）看完成度。
2. 调用 `sprint_carryover`（action: `execute`）把未完成 story 转入 backlog 或下个 sprint。
3. 调用 `sprint_manager`（action: `close`）active → completed。
4. 调用 `sprint_retrospective`（action: `start`）开复盘，`add_item` 收集 keep/start/stop。
5. 可选 `release_manager`（action: `create` + `attach_sprint`）挂到发布。

## 流程图

```
create → import tasks → [规划 backlog] → start → 开发(move story) → 
metrics → carryover → close → retrospective → (release)
```

## 看板

任何时候：`make sprint-up` 启动 server，浏览器访问 `http://127.0.0.1:7777` 拖拽改状态。
