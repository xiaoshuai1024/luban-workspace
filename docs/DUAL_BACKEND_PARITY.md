# Java / Go 双后端契约对齐（已废弃 · 历史归档）

> ⚠️ **已废弃（Q4=C 放弃 Go 双后端，2026-06-28）。Java 为单端权威。本文档保留作历史归档，不再具有约束力。**

## 决策记录

- **决策**：放弃 Go 双后端战略（app-deeplink-backend-arch plan 决议 Q4=C，2026-06-28）
- **现状**：Go 后端（`packages/backend/luban-backend-go`）在本 checkout 不存在；双后端文档此前为空悬条款
- **替代**：Java 后端 `packages/backend/luban-backend` 为**唯一权威后端实现**
- **影响清理**：`DualBackendContractTest.java` 已删除（T23）；`docs/SYSTEM_ARCHITECTURE.md`、`AGENTS.md`、`CLAUDE.md`、`docker-compose.e2e.yml`、`scripts/e2e/up-all.sh` 中 Go/双后端条款已同步更新

## 历史背景（仅供回顾，不再生效）

luban 早期规划过"Java 主实现 + Go 高性能双实现"战略，并定义了接口契约同步、contract test、ArchUnit 对称守护等机制。Q4=C 决议评估后认为双实现维护成本不抵收益（Go 端始终为部分实现、缺 leads/forms），故放弃。原始条款已从文档体系移除，契约测试已删除，BFF 改为与后端实现解耦（见 `packages/docs/luban-architecture-design/docs/06-bff-strategy.md`）。

## 仍生效的跨技术栈约定（从原文档保留，与双后端无关）

以下约定原本写在"双后端对齐"语境下，但它们对**单后端 + BFF + 前端**同样适用，故保留：

- **JSON 字段命名**：统一 camelCase（与 TS 生态一致）
- **大数字传输**：ID、时间戳统一字符串传输（避免 JS 精度丢失）
- **时间格式**：ISO 8601（RFC 3339），UTC + 时区
- **错误响应体**：`{ code, message, requestId?, details? }`
- **分页响应**：`{ items: [], total, page, pageSize, hasMore }`（空列表用 `[]` 非 `null`）
- **空值表示**：可选字段 `null` 表"未提供"，零值表"显式提供零值"
