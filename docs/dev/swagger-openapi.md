# Swagger / OpenAPI（后端）

> 后端如何通过 **SpringDoc** 暴露 **OpenAPI 3** 与 **Swagger UI**，保证新接口可被文档收录并支持 **Try it out** 联调。
> 适用：luban Java 后端（`packages/backend/luban-backend`）。Go 后端用 swag/gin-swagger 等等价方案，契约须一致。

---

## 1. 现状

- **依赖**：`springdoc-openapi-starter-webmvc-ui`（见 `pom.xml`）。
- **集中配置**：`OpenApiConfig` — 文档标题、安全方案说明（Bearer / 自定义请求头）、统一错误 Schema。
- **运行配置**：`application.yml` 中 `springdoc.*`；仅收录 `/api/**`；Swagger UI 启用持久化 Authorize。
- **生产**：`application-prod.yml` 默认关闭 `api-docs` 与 `swagger-ui`；本地 profile 正常可用。

---

## 2. 本地访问

启动后端（默认 `local` profile）后：

| 用途 | URL |
|------|-----|
| **Swagger UI（点击调试）** | `http://127.0.0.1:8080/swagger-ui.html` |
| **OpenAPI JSON** | `http://127.0.0.1:8080/v3/api-docs` |

端口不同请替换。

---

## 3. 新接口必须遵守

1. **Controller**
   - 类上 **`@Tag(name = "...", description = "...")`**：按领域分组。
   - 每个对外方法 **`@Operation(summary = "...")`**，必要时 **`description`**。
   - 路径参数、查询参数使用 **`@Parameter(description = "...")`**（必填项写明）。
2. **请求/响应模型**
   - 复杂 body 或返回 DTO 使用 **`@Schema`**（字段级中文说明 + 示例值）。
   - 列表/分页返回建议在 `@Operation` 的 description 中说明字段含义；能用专用 record/class 则不要用裸 `Map`。
3. **错误**
   - 业务抛统一异常 + 错误码枚举；文档层面错误形状见 OpenAPI Components → Schemas。
4. **安全（Swagger UI 调试）**
   - 需鉴权接口：在 UI 右上角 **Authorize** 填入 Bearer token。
   - 需上下文请求头的接口：同时配置对应 header。
   - 公开接口：通常无需 Authorize。

---

## 4. Try it out 不通过时的排查

| 现象 | 处理 |
|------|------|
| 401 / 未登录 | 先 Authorize Bearer；登录接口获取 token |
| 400 / 缺上下文 | 补充必要请求头 |
| 403 权限不足 | 当前账号缺少对应权限点 |
| CORS | 浏览器直连后端若被拦，属预期；Swagger UI 同源无此问题 |

---

## 5. luban 双后端契约对齐

Go 后端的 OpenAPI 文档（swag 注解生成）必须与 Java 侧的 SpringDoc 文档**契约一致**：

- 路由路径、HTTP method 一致
- 请求/响应字段名与类型一致
- 错误码与错误体格式一致
- Tag 分组命名一致

建议：以 Java 侧 SpringDoc 生成的 OpenAPI JSON 为基准，Go 侧的 swag 注解对照编写，CI 中可加 diff 检查。详见 `docs/DUAL_BACKEND_PARITY.md`。
