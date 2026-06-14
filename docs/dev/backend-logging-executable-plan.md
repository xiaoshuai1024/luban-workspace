# 后端日志：可执行方案（自建 / 无付费 / P95 延后）

> **范围**：通用 Spring Boot 后端（luban Java 侧，`packages/backend/luban-backend`）。
> **原则**：不搞 P95/P99 指标（后续再接 Prometheus）；**不写死商业日志 SaaS**；**小盘友好**（滚动 + 总上限）；**人工 SSH 可查**（单行 **logfmt** 风格，便于 `grep`）。
> Go 侧（`packages/backend/luban-backend-go`）参考相同原则，用结构化日志库（如 zap/slog）实现等价字段。

---

## 目标与不做清单

| 目标 | 做法 |
|------|------|
| 人工查日志快 | 生产文件：**单行**、`key=value`，固定字段：`ts`、`level`、`requestId`、`logger`、`msg` |
| 磁盘可控 | `RollingFileAppender`：**按日 + 按大小**、`maxHistory`、`totalSizeCap` |
| 降噪 | 每条请求 **仅 1 条 INFO**（结束行含 `durationMs`）；**开始**降为 **DEBUG** |
| 可观测串联 | 前端继续传 `X-Request-Id`；服务端 **MDC**：`requestId`（以及业务相关的上下文 id） |
| 不落第三方付费 | 日志文件在 **本机或自建**；后续可选 **Loki + Grafana OSS**（本方案不强制部署） |

**本期不做**：Micrometer HTTP 直方图、Prometheus、OpenTelemetry（记录在「后续迭代」）。

---

## 落地项

| 项 | 位置（参考） |
|----|------|
| Logback：`local` 控制台 + `<service>-local.log`（logfmt）；非 prod 非 local 仅控制台；`prod` 文件 logfmt + `<service>-error.log` | `src/main/resources/logback-spring.xml` |
| 本地日志目录（可覆盖） | `application-local.yml` → `logging.file.path`（默认 `./logs`） |
| 生产日志目录（可覆盖） | `application-prod.yml` → `logging.file.path` |
| 请求追踪降噪 | `RequestTraceFilter`：`request start` → DEBUG，`request end` → INFO |
| 上下文进 MDC | 业务过滤器在校验通过后 `MDC.put("requestId", ...)` 等上下文字段，`finally` 清理 |

---

## 执行步骤（运维 / 发布）

### 1. 本地 / 联调（`spring.profiles.active=local`，且 ≠ prod）

- **双写**：控制台（易读，带 `[req:…]`）+ **`${logging.file.path:-logs}/<service>-local.log`**（与 prod 相同 **logfmt** 字段，便于 Agent `Read`/`grep`）。
- 本地滚动：**单文件约 20MB**、**保留约 3 天**、**总上限约 80MB**。
- 其它非 prod profile：仅控制台，集成测不写盘。

### 2. 生产（`spring.profiles.active=prod`）

1. **设置日志目录**（二选一）
   - 环境变量或配置：`logging.file.path`（可在 `application-prod.yml` 改为 `/var/log/<service>`）。
   - 确保进程用户对该目录 **可写**。

2. **目录权限示例**（Linux）
   ```bash
   sudo mkdir -p /var/log/<service>
   sudo chown <运行用户>:<组> /var/log/<service>
   ```

3. **部署后验收**
   - 产生访问后存在：`<service>-app.log`（全量 INFO+）、`<service>-error.log`（仅 ERROR，含栈）。
   - 检查目录总大小随时间是否被 `totalSizeCap` 约束。

### 3. 人工查询示例（免费、只 SSH）

```bash
# 按请求 ID（与前端 / 响应头一致）
grep 'requestId=abc123' /var/log/<service>/<service>-app.log

# 按路径关键词（msg 内仍有 method/path/status）
grep 'path=/api/materials' /var/log/<service>/<service>-app.log

# 只看错误文件（栈在 error 文件更集中）
tail -f /var/log/<service>/<service>-error.log
```

说明：**logfmt 不是 JSON**，无需 `jq`；若字段值将来含空格，再在编码器里做转义增强。

### 4. 临时打开「每条请求开始」DEBUG（排障）

在 `application-prod.yml` 覆盖（或用同一配置键通过环境变量注入）：

```yaml
logging:
  level:
    <package>.logging.RequestTraceFilter: DEBUG
```

排查完 **收回 INFO**，避免日志量翻倍。

---

## 后续迭代（本方案不实施，仅备忘）

| 优先级 | 内容 |
|--------|------|
| P | HTTP **P95/P99**：Micrometer + **自建 Prometheus**，与日志分离 |
| P | **日志采集**：Promtail / Vector 读 app log，推到 **自建 Loki** |
| P | **分布式追踪**：OpenTelemetry + Tempo/Jaeger，`traceparent` 与 `X-Request-Id` 并存 |
| P | **异步 MDC**：`@Async` / 线程池 TaskDecorator，避免子线程丢 `requestId` |

---

## 验收清单（合并前自检）

- [ ] `mvn -q verify` 通过
- [ ] `prod` 启一次：日志目录下生成滚动文件，且 **单条请求只有一条 INFO access 风格日志**（除非打开 DEBUG）
- [ ] 携带上下文 id 的请求日志中出现对应字段（grep 验证）

---

## Go 后端等价实现

Go 侧（`packages/backend/luban-backend-go`）用结构化日志库实现相同字段：

- 固定字段：`ts`、`level`、`requestId`、`logger`、`msg`、`durationMs`
- 单行 logfmt 或 JSON 输出
- 中间件注入 `requestId` 到 context，日志库从 context 读取
- 滚动策略用 lumberjack 等库
- Java 与 Go 的日志字段名必须一致，便于跨后端联查
