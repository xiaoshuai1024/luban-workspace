---
name: ten-round-brainstorm
description: >-
  Runs ten parallel brainstorming perspectives on one proposition and writes merged conclusions into the active plan Markdown.
  Use when the user invokes /10-bs, or asks for 十轮并行头脑风暴、并行头脑风暴、把头脑风暴结论写入方案.
---

# 十轮并行头脑风暴（/10-bs）

## MUST

1. **全文遵循** 项目根 `.cursor/commands/10-bs.md`（单一事实源）。
2. **必须落盘**：结论写入用户指定的「当前正在执行的方案」Markdown；禁止仅在聊天输出长篇结论。
3. **并行含义**：十个**独立视角**同时审视同一命题，不是串行改稿十次。

若用户未给出方案路径，按命令文档中的优先级定位文件；无法唯一确定时 **询问一次**。

## 体例参考（仓库内）

- `docs/products/v1/租户小程序远程配置-十轮并行头脑风暴论证.md`
- `docs/architecture/backend-logging-十轮并行头脑风暴与结论.md`
