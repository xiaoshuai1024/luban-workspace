<!--
description: Java/Go 双后端同接口行为一致（响应体/错误码/状态机）
globs: packages/backend/**, packages/bff/**
alwaysApply: false
-->

# Java / Go 双后端契约对齐（MUST）

luban 后端是**同一业务的双实现**：`packages/backend/luban-backend`（Java / Spring Boot）与 `packages/backend/luban-backend-go`（Go）。两者必须满足**行为一致契约**。

详细规范见 [`docs/DUAL_BACKEND_PARITY.md`](../../docs/DUAL_BACKEND_PARITY.md)。

## 核心要求

### 1. 接口契约一致
对**同一接口**（HTTP 方法 + 路径 + 参数）：

| 维度 | 要求 |
|------|------|
| 路径 | 完全一致（如 `GET /api/v1/materials`） |
| 请求参数 | 字段名、类型、必填性一致 |
| 成功响应体 | 结构一致（字段名、嵌套、类型） |
| 错误响应体 | 错误码一致，message 可不同措辞但语义一致 |
| HTTP 状态码 | 一致（如 404 都返 404，不一个 404 一个 400） |
| 状态机 | 业务状态枚举值一致，转换规则一致 |

### 2. 同步变更（MUST）
- 凡改 Java 后端的接口契约，**必须同步改 Go 后端**（反之亦然）
- 同一 PR / 同一任务内完成两端改动，**禁止**只改一端
- 若确实需要差异化实现，须在 PR / 方案中**显式标注差异并说明理由**

### 3. Contract Test（推荐）
- 维护一份 contract test 套件：同一组请求分别打 Java 与 Go 后端，断言响应等价（结构、关键字段、错误码）
- BFF 层可消费 contract test 结果做降级路由

## 检查清单（改后端时 MUST）

改 `packages/backend/luban-backend/` 或 `packages/backend/luban-backend-go/` 任一端时：

- [ ] 接口路径在另一端是否存在？
- [ ] 响应体结构是否一致？
- [ ] 错误码是否一致？
- [ ] 状态机枚举值是否一致？
- [ ] 是否同步修改了另一端？
- [ ] 若有差异，是否在 PR 中标注？

## BFF 角色

`packages/bff/luban-bff` 是双后端的统一入口：

- BFF 可路由到 Java 或 Go 后端（按配置 / 灰度）
- BFF **不应**掩盖双后端的差异，而应**抹平**差异（如字段映射、错误码归一）
- BFF 测试须覆盖两路后端调用

## 常见差异陷阱

### 1. JSON 字段命名
- Java（Jackson）默认 camelCase；Go（encoding/json）也用 struct tag 控制
- 须统一为 camelCase（与 TS 生态一致），不要一端 snake_case 一端 camelCase

### 2. 数字类型
- Java 的 `Long` 序列化为字符串或数字（视配置）；Go 的 `int64` 默认数字
- 大整数（> 2^53）前端会丢精度，须统一为字符串传输

### 3. 空值表示
- Java 的 `null` vs Go 的零值（`""`、`0`、`false`）
- 须统一：可选字段为 null 表示"未提供"；零值表示"显式提供零值"

### 4. 时间格式
- 统一为 ISO 8601（RFC 3339）字符串，UTC + 时区
- 不要一端用 timestamp 一端用字符串

### 5. 错误响应结构
统一为：
```json
{ "code": "<ERROR_CODE>", "message": "<中文消息>", "requestId": "<...>" }
```

## 测试要求

- Java 后端：`mvn -q verify`（Surefire + Failsafe），覆盖率 80% line / 70% branch
- Go 后端：`go test ./... -race -cover`，覆盖率 75%
- 双后端 contract test：单独套件，断言响应等价
