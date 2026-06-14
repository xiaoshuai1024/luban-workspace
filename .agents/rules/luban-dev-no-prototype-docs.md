<!--
description: 开发阶段禁止修改产品设计/原型目录
globs: docs/products/**/*, docs/prototypes/**/*
alwaysApply: false
-->

- **约束：** 在本仓库进行功能开发、联调、Bug 修复、重构或任务执行时，**不得修改** `docs/products/` 与 `docs/prototypes/` 下**任何**文件（含 `.html`、`.md`、`.json`、静态资源、子目录等）。
- **例外：** 仅当用户**明确**要求修改该目录下的具体文件时，方可改动；默认一律视为禁止。
- **替代做法：** 原型/设计相关变更应落在独立分支/工单或由产品侧发起；实现代码放在 `packages/`、引擎调试页等非原型目录。
- **luban 调试页：** 引擎调试页（如 `packages/engine/luban/debug/`）用于运行时验证，不属于"产品原型目录"，允许在开发阶段修改；但调试页改动须在该仓根跑 `pnpm run build` 确认无 console error。
