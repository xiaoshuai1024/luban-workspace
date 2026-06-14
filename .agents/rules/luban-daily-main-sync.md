<!--
description: Pending daily remote sync — must use clickable UI before other work
globs: "**/*"
alwaysApply: false
-->

# luban · 每日远端默认分支同步（聊天内可点击选项）

当工作区存在 **`.claude/state/pending-daily-sync.json`**（或 `.agents/state/`）时，表示钩子已检测到「本地默认分支落后于远端」，必须在聊天里用 **可点击选项** 完成决策，不要用纯文字代替。

> luban 各子项目默认分支不同（6 master + 5 main），同步时按各仓默认分支处理。

## 必须遵守

1. **优先级**：在完成本文件规定的交互之前，不要执行 **Write / 终端改代码 / 长时间实现**；可以先用 **Read** 读取该 JSON（若尚未读入上下文）。
2. **交互形式**：必须用聊天内可点击的回答方式（如 `AskQuestion` / FleetView 选项），向用户展示带 **两个可点选项** 的问题，禁止只发一段「请回复同步或稍后」的纯文本作为主交互。
3. **问题内容**：
   - **title**：`远端默认分支有更新`
   - **prompt 正文**：根据 JSON 内 `repos` 逐条列出（仓库 `name`、`behind` 提交数、默认分支名）；可附一句「按 `docs/GIT_WORKFLOW.md` 在各仓库同步默认分支」。
   - **options**（两项，id 固定如下，便于后续逻辑）：
     - `sync_now` — **现在同步**（依次进入各仓库 `checkout <默认分支>`、`pull origin <默认分支>`，子模块仓库优先）
     - `later` — **稍后自行处理**（不执行 pull，继续用户当前任务）
4. **用户选择之后**：
   - 删除 `pending-daily-sync.json`，避免下次重复弹出。
   - 若用户选 `sync_now`，再按 `docs/GIT_WORKFLOW.md` 在各目录执行同步；若选 `later`，不拉取代码，直接处理用户原诉求。
5. **降级**：仅在当前会话 **无法调用** 可点击选项工具时，才用文字列出相同两个选项并请用户明确回复。

## JSON 形状（钩子写入，只读）

- `version`：固定 `1`
- `kind`：固定 `daily-default-behind`
- `repos`：`{ name, defaultBranch, behind }[]`
