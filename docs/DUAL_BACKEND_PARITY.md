# Java / Go 双后端契约对齐（luban-workspace）

luban 后端是**同一业务的双实现**：

- **Java 后端**：`packages/backend/luban-backend`（Spring Boot / Maven）
- **Go 后端**：`packages/backend/luban-backend-go`（go mod）

两者必须满足**行为一致契约**。本文档定义对齐规范、检查清单、常见陷阱。

**这是 luban 平台的硬约束**（见 `CLAUDE.md` 硬约束 3）。

---

## 1. 为什么要双后端？

luban 选择双后端架构的原因：

1. **技术栈多样性**：Java 生态成熟（企业级、ORM、事务），Go 性能优秀（高并发、低资源）
2. **风险评估**：单一技术栈的供应链风险（如 Log4Shell）通过双实现降低
3. **能力互补**：某些场景适合 Java（复杂业务逻辑），某些场景适合 Go（高 QPS 网关）
4. **演进灵活性**：未来可按场景路由到不同后端

**代价**：双后端意味着**所有接口契约必须两端同步维护**。

---

## 2. 契约维度

对**同一接口**（HTTP 方法 + 路径 + 参数），两端必须满足：

| 维度 | 要求 |
|------|------|
| 路径 | 完全一致（如 `GET /api/v1/materials`） |
| 请求参数 | 字段名、类型、必填性一致 |
| 请求体 | 结构一致（字段名、嵌套、类型） |
| 成功响应体 | 结构一致（字段名、嵌套、类型） |
| 错误响应体 | 错误码一致，message 可不同措辞但语义一致 |
| HTTP 状态码 | 一致（如 404 都返 404，不一个 404 一个 400） |
| 业务状态机 | 状态枚举值一致，转换规则一致 |
| 副作用 | 数据库变更、缓存失效、事件发布一致 |
| 幂等性 | 同一幂等键的行为一致 |

---

## 3. 同步变更（MUST）

- 凡改 Java 后端的接口契约，**必须同步改 Go 后端**（反之亦然）
- 同一 PR / 同一任务内完成两端改动，**禁止**只改一端
- 若确实需要差异化实现，须在 PR / 方案中**显式标注差异并说明理由**

### 检查清单（改后端时 MUST）

改 `packages/backend/luban-backend/` 或 `packages/backend/luban-backend-go/` 任一端时：

- [ ] 接口路径在另一端是否存在？
- [ ] 请求参数（字段名、类型、必填性）是否一致？
- [ ] 成功响应体结构是否一致？
- [ ] 错误响应体（错误码、message 语义）是否一致？
- [ ] HTTP 状态码是否一致？
- [ ] 状态机枚举值是否一致？
- [ ] 副作用（DB、缓存、事件）是否一致？
- [ ] 是否同步修改了另一端？
- [ ] 是否补充了 contract test？
- [ ] 若有差异，是否在 PR 中标注？

---

## 4. BFF 角色

`packages/bff/luban-bff` 是双后端的统一入口：

- BFF 可路由到 Java 或 Go 后端（按配置 / 灰度）
- BFF **不应**掩盖双后端的差异，而应**抹平**差异（如字段映射、错误码归一）
- BFF 测试须覆盖两路后端调用

### BFF 路由策略

```
client / engine / website
        │
        ▼
       BFF
        │
        ├──→ Java 后端（默认 / 复杂业务逻辑）
        └──→ Go 后端（高 QPS 路径 / 灰度）
```

- 默认路由到 Java 后端（成熟稳定）
- 高 QPS 路径可路由到 Go 后端（性能優势）
- 灰度发布：按用户/租户/特性开关路由
- 故障转移：一端不可用时切换到另一端

### BFF 抹平差异的边界

- BFF 可做的：字段重命名（`snake_case` ↔ `camelCase`）、错误码归一、响应结构包装
- BFF **不应**做的：补齐缺失字段（说明契约不对齐，应在后端修）、改业务语义

---

## 5. 常见差异陷阱

### 5.1 JSON 字段命名

- Java（Jackson）默认 camelCase；Go（encoding/json）用 struct tag 控制
- **约定**：统一为 **camelCase**（与 TS 生态一致）
- Java：`@JsonProperty("materialId")` 或 Jackson 默认
- Go：`json:"materialId"` struct tag

### 5.2 数字类型

- Java 的 `Long` 序列化为字符串或数字（视配置）；Go 的 `int64` 默认数字
- **大整数（> 2^53）前端会丢精度**
- **约定**：大数字（如 ID、时间戳）统一为**字符串**传输

```java
// Java
@JsonSerialize(using = ToStringSerializer.class)
private Long id;
```

```go
// Go
type Response struct {
    ID string `json:"id"` // 用字符串而非 int64
}
```

### 5.3 空值表示

- Java 的 `null` vs Go 的零值（`""`、`0`、`false`）
- **约定**：
  - 可选字段为 `null` 表示"未提供"
  - 零值表示"显式提供零值"
- Java：用 `Optional<T>` 或允许 null 的包装类型
- Go：用指针（`*string`、`*int`）区分"未提供"与"零值"

### 5.4 时间格式

- **约定**：统一为 **ISO 8601（RFC 3339）字符串，UTC + 时区**
  - 示例：`2026-06-14T10:30:00Z`
- 不要一端用 timestamp 一端用字符串
- Java：`@JsonFormat(shape = STRING, pattern = "yyyy-MM-dd'T'HH:mm:ssXXX", timezone = "UTC")`
- Go：`time.Time` 默认 RFC 3339 序列化

### 5.5 错误响应结构

统一为：

```json
{
  "code": "<ERROR_CODE>",
  "message": "<中文消息>",
  "requestId": "<request-id>",
  "details": { }  // 可选，额外上下文
}
```

- Java：统一 `@ControllerAdvice` 异常处理器
- Go：统一错误中间件

### 5.6 枚举值

- 状态枚举两端**字符串值必须一致**
- Java：`enum Status { ACTIVE, INACTIVE }` 序列化为 `"ACTIVE"`
- Go：`type Status string` + 常量
- **禁止**一端用 `"ACTIVE"` 一端用 `"active"` 或 `1`

### 5.7 分页响应

统一结构：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20,
  "hasMore": false
}
```

- 列表为空时 `items: []`，**禁止** `null`

### 5.8 幂等性

- 同一幂等键（如 `Idempotency-Key` header）的行为两端一致
- 重复请求返回相同结果（首次创建，后续返回首次结果）
- Java 与 Go 须用相同的幂等键存储（如共享 Redis）

### 5.9 并发与锁

- 同一资源的锁行为一致
- 乐观锁：版本号字段名一致（如 `version`）
- 悲观锁：`SELECT ... FOR UPDATE` 等价行为

### 5.10 事务边界

- 同一业务操作的事务边界一致
- Java：`@Transactional`
- Go：`db.Transaction(func(tx) { ... })`
- 失败回滚的行为一致

---

## 6. Contract Test（推荐 · 强烈建议 MUST）

维护一份 contract test 套件：

- 同一组请求分别打 Java 与 Go 后端
- 断言响应等价（结构、关键字段、错误码）
- BFF 层可消费 contract test 结果做降级路由

### Contract Test 结构示例

```typescript
describe("Material API contract", () => {
  const endpoints = [
    { method: "GET", path: "/api/v1/materials" },
    { method: "POST", path: "/api/v1/materials" },
    { method: "GET", path: "/api/v1/materials/:id" },
  ];

  for (const endpoint of endpoints) {
    it(`${endpoint.method} ${endpoint.path} - Java vs Go parity`, async () => {
      const javaRes = await callBackend("java", endpoint);
      const goRes = await callBackend("go", endpoint);

      // 断言结构等价
      expect(goRes.status).toBe(javaRes.status);
      expect(Object.keys(goRes.body).sort()).toEqual(Object.keys(javaRes.body).sort());
      // 关键字段断言
      expect(goRes.body.code).toBe(javaRes.body.code);
    });
  }
});
```

### Contract Test 范围

- 所有公开 API（BFF 暴露的接口）
- 错误路径（404 / 400 / 401 / 403 / 500）
- 边界值（空列表、超大 page、非法参数）
- 幂等性（重复请求）

---

## 7. 测试要求

- **Java 后端**：`mvn -q verify`（Surefire + Failsafe），覆盖率 80% line / 70% branch
- **Go 后端**：`go test ./... -race -cover`，覆盖率 75%
- **双后端 contract test**：单独套件，断言响应等价

详见 [`docs/TESTING_SPEC.md`](./TESTING_SPEC.md)。

---

## 8. 数据库

### 8.1 独立配置

- Java 后端**独立配置 MySQL**（不再共用 kangdou 的 `kddev`）
- Go 后端独立配置 MySQL（可与 Java 共用同一 DB 实例，或独立实例）
- 连接参数在各后端的 `application*.yml` / `config.yaml` 中声明

### 8.2 Schema 同步

- 两端操作的 DB schema 必须一致
- 迁移脚本（Flyway / goose / 等价工具）须两端共用或同步
- **约定**：迁移脚本统一在一处维护（建议 Java 端 Flyway），Go 端只读 schema

### 8.3 数据一致性

- 两端操作同一 DB 时，须保证数据一致性
- 共享缓存（Redis）的 key 规则一致（见 [`luban-redis-cache.md`](../.agents/rules/luban-redis-cache.md)）
- 事件发布（如领域事件）的格式一致

---

## 9. 日志与可观测

### 9.1 日志格式

- 两端日志须包含相同的关联字段：`requestId`、`userId`（如有）、`materialId`（如有）
- 结构化日志（Java logfmt / JSON；Go zap / slog）
- 日志级别语义一致（INFO / WARN / ERROR）

### 9.2 PII 脱敏

- 两端日志中手机号、邮箱、token 等 PII 必须脱敏
- Java：用 `maskPhone()` / `maskEmail()` 工具方法
- Go：等价工具

### 9.3 监控指标

- 关键指标（QPS、延迟、错误率）两端命名一致
- 上报到同一监控系统（如 Prometheus + Grafana）
- 告警规则覆盖两端

---

## 10. CI 与部署

### 10.1 CI

- 两端在 CI 中均须跑测试 + 覆盖率门禁
- contract test 在 CI 中跑（如有）
- PR 检查：改一端时检查另一端是否同步

### 10.2 部署

- 两端可独立部署（不同服务）
- 部署顺序：先部署后端，再部署 BFF，最后部署前端
- 灰度发布：按比例路由流量到 Go 后端

### 10.3 回滚

- 两端须支持独立回滚
- 契约破坏性变更须有回滚预案

---

## 11. 关联文档

- `.agents/rules/luban-dual-backend-parity.md` — 双后端规则（alwaysApply 触发条件）
- `.agents/rules/luban-cross-cutting-standards.md` — 跨领域标准
- `.agents/rules/luban-redis-cache.md` — 缓存命名/TTL/失效（双端对齐）
- `docs/TESTING_SPEC.md` — 测试规范
- `docs/LOWCODE_ENGINE_SPEC.md` — 引擎/BFF/后端的数据流

---

## 12. Agent 自检（改后端时）

1. 改的是哪一端？另一端是否需要同步？
2. 接口契约（路径、参数、响应、错误码、状态机）是否两端一致？
3. 是否补充了 contract test？
4. 大数字是否用字符串传输？
5. 空值表示是否两端一致（null vs 零值）？
6. 时间格式是否统一 ISO 8601？
7. 日志的 PII 是否脱敏？
8. 缓存失效逻辑是否两端一致？
9. DB schema 变更是否两端共用迁移脚本？
10. 若有差异，是否在 PR 中标注并说明理由？
