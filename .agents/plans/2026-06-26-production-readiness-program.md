---
featureId: production-readiness-program
title: 生产就绪质量提升项目集
createdAt: 2026-06-26
status: draft
taskGraph: docs/superpowers/tasks/production-readiness-program.json
split: 5 份子 plan（每份独立可交付）
---

# 生产就绪质量提升项目集 — 总览

> **For agentic workers:** 本项目集包含 5 份独立子 plan，按 Wave 顺序执行。每份 plan 可独立交付。

**Goal:** 将 Luban 从"demo 可用"提升到"精致且可交付"：所有模块单测 80% line 覆盖率、E2E 70% 覆盖率、15 项致命问题清零、架构守护测试全栈覆盖。

**审查基线：** 6 个并行 subagent 全栈审查（2026-06-26），发现 15 🔴 + 28 🟡 + 25 🔵 问题。

---

## 子 Plan 索引

| Wave | Plan 文件 | 目标 | 阻塞后续 |
|:---:|---------|------|:---:|
| 1 | `2026-06-26-coverage-tooling.md` | 覆盖率工具配置 + 阈值植入 | ✅ |
| 2 | `2026-06-26-critical-fixes.md` | 15 项致命问题修复 | ✅ |
| 3 | `2026-06-26-unit-test-80pct.md` | 单测覆盖率 → 80% | ❌ |
| 4 | `2026-06-26-e2e-70pct.md` | E2E 覆盖率 → 70% | ❌ |
| 5 | `2026-06-26-arch-guard-tests.md` | 架构守护测试完善 | ❌ |

> Wave 3-5 可部分并行（3 和 5 独立于 4，但都依赖 1+2）。

---

## 执行策略

```
Wave 1: 覆盖率工具（所有包）
  ↓ 阻塞
Wave 2: 致命修复（15 项）
  ↓ 阻塞
Wave 3 ∥ Wave 5: 单测 80% ∥ 架构守护
  ↓
Wave 4: E2E 70%
```

每个 Wave 完成后跑 `make lint && make test` 验证门禁。

---

## 模块就绪度目标

| 模块 | 当前 | 目标 | 关键提升 |
|------|:---:|:---:|---------|
| Java Backend | 70% | 95% | 事务修复 + tenant 隔离 + @Valid + 80% 覆盖 |
| Engine SPA | 40% | 90% | 路由守卫 + 状态持久化 + 响应式 + 80% 覆盖 |
| BFF | 60% | 90% | CORS + 限流 + 统一错误处理 + 80% 覆盖 |
| Website | 55% | 90% | SSR 修复 + 404 状态码 + SEO 完善 |
| UI 物料库 | 55% | 90% | ErrorBoundary + 物料测试 + Storybook |
| E2E | 35% | 85% | 真实登录 + UI CRUD + 发布流程 |

---

## 验收门禁（全项目集完成后）

| 门禁 | 验证命令 | 通过条件 |
|------|---------|---------|
| 单测覆盖率 | 各包 `test:coverage` | Java 80%, Engine 80%, BFF 80%, Website 80%, UI 80% |
| E2E 覆盖率 | `make e2e` | 70% 关键用户旅程覆盖 |
| Lint | `make lint` | 全部 0 errors |
| 架构守护 | `mvn test -Dtest=*Architecture*` + `npx depcruise` | 全部 PASS |
| /luban-review | 自动审查 | 🔴🟡🔵 清零 |
