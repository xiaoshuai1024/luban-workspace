<!--
description: 跨领域标准：双后端契约 / BFF字段 / 引擎物料schema / 多端一致 / 分页错误体
globs: "**/*"
alwaysApply: false
-->

# 跨领域工作经验（MUST）

本规则汇总跨模块、跨子项目的横切标准。新功能、合入前必读。

## 经验：前后端权限种子与前端不一致导致按钮不可用

### 场景
某页面按钮始终不可点击，但后端 API 权限配置正确。

### 根因
后端权限种子只注册了粗粒度权限，但前端 `v-perm` 检查的是细粒度权限。两端不匹配。

### 预防
- 新增功能权限时，检查前端实际使用的 perm key
- 权限粒度统一用 RESTful 风格 `create/edit/delete`

---

## 经验：临时目录写满导致命令输出丢失

### 场景
启动大量 agent 时，默认 temp 目录写满报错。

### 根因
默认 temp 目录空间有限，`export` 只对单条命令生效不持久。

### 解决方案
在 `.claude/settings.local.json` 的 `env` 段中设置：
```json
{ "env": { "CLAUDE_CODE_TMPDIR": "/var/tmp/claude-code" } }
```

---

## 经验：Bean 同名冲突用注解 value 修复，不改文件名

### 场景
合并后 Spring 启动报 ConflictingBeanDefinitionException，两个类同名。

### 根因
新增了同名的 Controller/Service class，Spring 默认 bean name = 类名驼峰。

### 解决方案
不改文件名，只在注解上加 value：
```java
@RestController("uniqueControllerName")
@Service("uniqueServiceName")
```

### 预防
- Bean 冲突优先改注解 value，不动文件名

---

## 经验：DB 迁移 out-of-order 引用不存在的表

### 场景
部署时迁移报 Table 'xxx' doesn't exist。

### 根因
低版本迁移引用了高版本迁移才创建的表。

### 解决方案
在低版本迁移文件开头加 `CREATE TABLE IF NOT EXISTS`；外键约束去掉（应用层校验即可）。

### 预防
- out-of-order 迁移要自包含

---

## 经验：MySQL COLLATE 不匹配导致 JOIN 失败

### 场景
`INSERT ... SELECT` 报 Illegal mix of collations。

### 解决方案
新建表统一用 `COLLATE=utf8mb4_unicode_ci`，与关联表保持一致；或用 `CONCAT()` 绕过 collation 比较。

---

## 经验：拦截器不要提前销毁 session

### 场景
登录后请求被拦截 → session 被清 → 用户无法完成下一步 → 死循环。

### 解决方案
- 未完成必要步骤时仅拦当前请求，不销毁 session
- 终态拒绝时才清 session

### 预防
拦截器销毁 session 前确认用户没有挽回余地。

---

## 跨模块横切标准（luban MUST）

### 1. 双后端契约
同一接口契约，Java 与 Go 实现的响应体/错误码/状态机须一致。详见 [`luban-dual-backend-parity.md`](./luban-dual-backend-parity.md) 与 [`docs/DUAL_BACKEND_PARITY.md`](../../docs/DUAL_BACKEND_PARITY.md)。

### 2. BFF 字段规范
- BFF 聚合 Java/Go 后端能力，对前端（engine/website/client）暴露统一字段
- 字段名以 camelCase 为准（TS 生态）
- BFF 不应掩盖双后端差异，而是**抹平**差异

### 3. 引擎物料 schema
物料 props schema 须合规，详见 [`luban-material-schema.md`](./luban-material-schema.md) 与 [`docs/LOWCODE_ENGINE_SPEC.md`](../../docs/LOWCODE_ENGINE_SPEC.md)。

### 4. 多端一致
electron / flutter / web 三端业务一致，详见 [`luban-multi-client-consistency.md`](./luban-multi-client-consistency.md)。

### 5. 分页响应体
所有列表/分页接口统一响应结构：
```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "pageSize": 20,
  "hasMore": false
}
```
- 列表为空时返回 `items: []`，**禁止**返回 `null`
- 错误响应统一为 `{ "code": "<ERROR_CODE>", "message": "<中文消息>", "requestId": "<...>" }`

### 6. 错误体规范
非 2xx 响应为：
```json
{ "code": "<ERROR_CODE>", "message": "<中文消息>", "requestId": "<...>" }
```
常见错误码：`invalid_request`、`unauthorized`、`forbidden`、`not_found`、`internal_error`。

前端处理以 `error.response?.data?.code` 为主，勿假定响应体为 HTML 或非 JSON。
