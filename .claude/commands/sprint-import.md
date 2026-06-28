---
description: 把 /plan-template 生成的任务图导入为当前 sprint 的 backlog stories
---

# /sprint-import <featureId> — 从 plan-template 导入

把 `docs/superpowers/tasks/<featureId>.json` 的 tasks 批量导入为当前 sprint 的 backlog stories，并建立 `taskRefs` 双向链接。

## 参数

- `featureId`（必填）：task graph 文件名（不含 `.json`），如 `publish-loop-p0`。

## 执行步骤

1. 调用 `sprint_manager`（action: `get_current`）找当前 active sprint。
   - 若无，先提示创建或用 `list` 选一个，再 `update`。
2. 调用 `import_from_plan`：
   - action: `from_taskgraph`
   - sprintId: 当前 sprint
   - featureId: 用户传入的
3. 每个 task → 一个 backlog story，自动填充 `taskRefs`（featureId/taskId/subsystem）。
4. task JSON 节点自动加 `sprintId` 反向指针。
5. 可选：若该 feature 有 journeys，再调用 `import_from_plan`（action: `from_journeys`）把 journey → epic。
6. 输出导入摘要：`✓ 导入 N 个 story 到 <sprintId>`，列出生成的 storyId 与对应 taskId。
7. 提示用户：看板 `http://127.0.0.1:7777` 已刷新，可用 `story_backlog`（add_to_sprint）排入迭代。

## 联动说明

导入后，task graph 与 sprint 建立双向链接：
- sprint story 的 `taskRefs[]` 指向 task（显式清单）
- task 节点的 `sprintId` 指向 sprint（反向指针）
- 后续 `plan_status_sync`（pull/push）可双向同步完成状态。
