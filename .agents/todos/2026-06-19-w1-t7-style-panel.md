---
todoId: w1-t7-style-panel
title: W1-T7 样式属性面板（延后第1.5波）
createdAt: 2026-06-19
status: deferred
wave: 1.5
parentPlan: .agents/plans/2026-06-19-luban-editor-wave1.md
parentTask: W1-T7
---

# W1-T7 样式属性面板（延后第1.5波）

> 本 todo 记录 W1-T7 样式属性面板的范围与验收口径，第1波（wave 1）不实现，计划在第1.5波重新立项。

## 背景

`feature/luban-editor-wave1` 第1波已交付编辑器交互四件套 + 数据/事件/动态渲染三要素 + 6 物料。
样式属性面板（W1-T7）在 plan §10 中**显式延后**至第1.5波，本期 PropertyPanel 仅含基础/事件/数据源三分区。

## 范围

- **PropertyPanel 样式分区**：color / margin / padding / typography / border / background 等样式属性配置
- **样式 Schema**：NodeSchema 可能需扩展 `style` 字段（或复用 props.style）
- **实时预览**：配置后编辑器画布实时反映样式变更
- **撤销栈记录**：样式变更进入 useHistory

## 入口文件

- `packages/engine/luban/src/views/page/components/PropertyPanel.vue` — 新增样式分区
- `packages/ui/luban-ui/packages/luban-low-code/src/lib/schema.ts` — NodeSchema style 字段（如需）
- `packages/engine/luban/src/views/page/PageEditor.vue` — update:style 接线

## 验收口径

- 用户能在属性面板配置节点样式属性（颜色/字体/边距/边框/背景等）
- 配置后画布实时预览
- 撤销栈正确记录样式变更
- FeatureGate `editor.style` 可关闭样式分区

## 依赖

- W1-T5 PropertyPanel 已交付（基础/事件/数据源三分区）
- design token 系统（建议第1.5波前在 luban-base 落地 `$lb-*` token，避免物料/面板硬编码）
