---
description: 查看当前 sprint 看板状态（进度/进行中/阻塞/燃尽）
---

# /sprint-status — Sprint 看板状态

调用 Sprint MCP 的 `board_view`（sprint 视图）和 `sprint_metrics`（summary），输出当前 active sprint 的看板摘要。

## 执行步骤

1. 调用 MCP tool `sprint_manager`（action: `get_current`）找当前 active sprint。
   - 若无 active sprint，提示用户先创建（`sprint_manager` action: `create`）。
2. 调用 `board_view`（action: `sprint`, sprintId: 当前 sprint）取看板列/卡。
3. 调用 `sprint_metrics`（action: `summary`, sprintId）取进度与燃尽。
4. 输出格式化表格：

```
当前迭代: <sprintId>「<name>」[active]  周期: <start> ~ <end>
进度: X/Y story done · 点数 done/total · ⛔阻塞 N
燃尽: on_track / at_risk / behind

看板列:
  待开始 (todo)      [N]:
    • ST-001 标题 (5pt, @assignee, 🔗2)
  进行中 (in_progress)[N]:
    • ST-003 ...
  ...
```

5. 若有阻塞 story，单独列出 `⛔` 段并附 blockedReason。
6. 末尾提示：浏览器看板 `http://127.0.0.1:7777`（若 server 未起，提示 `make sprint-up`）。
