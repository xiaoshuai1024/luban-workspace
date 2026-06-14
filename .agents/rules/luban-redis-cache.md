<!--
description: 后端 Redis 缓存命名、TTL、失效与接入方式（Java / Go 双后端）
globs: packages/backend/**/*.java, packages/backend/**/*.go, packages/bff/**/*.ts
alwaysApply: false
-->

# Redis 缓存规范（Java / Go 双后端通用）

## 原则

- **读路径**：对「可接受短暂不一致、读明显多于写」的接口，在 Service 层用缓存（Java `@Cacheable` `sync = true` 防击穿；Go 用统一 cache helper），不要写在 Controller。
- **写路径**：凡持久化会改变缓存语义的数据，必须在同一业务事务提交成功后做**精确 key 失效**；不要只依赖 TTL 保证正确性。

- **分布式系统禁止本地内存缓存**：luban 后端为分布式部署，**禁止**在 Service 中使用 `ConcurrentHashMap`、`CopyOnWriteArraySet`、`HashMap`、`sync.Map` 等 JVM/进程本地缓存作为业务缓存层。所有缓存必须走 **Redis + DB 回退** 模式：
  - 读路径：Redis → 未命中 → DB → 写入 Redis（设 TTL）
  - 写路径：写入 DB → 删除 Redis key
  - 禁止启动时将全量数据加载到内存常驻
  - 例外：连接级别状态（WebSocket 会话、API 客户端 token）可维持内存（非业务缓存）
- **TTL**：仅作「上限」与兜底；默认值在各后端配置中声明；可按环境调大/调小。
- **键语义**：业务维度用业务 id（如 `materialId`）；多维度组合用 `|` 分隔（如 `materialId|version`）；**禁止**在业务 id 中随意使用 `|`，以免与组合键冲突。

## Java 后端（Spring Cache）

- 缓存名集中登记在 `LubanCacheNames`，per-cache TTL 在 `LubanCacheConfiguration` 中声明
- 失效用 `LubanCacheInvalidator` 做精确 key 失效
- 集成测试 profile 排除 Redis 时用 `ConcurrentMapCacheManager`，**仍须**走失效逻辑，避免「测到假绿」

## Go 后端

- 用统一的 cache helper（如 `pkg/cache/`），接口与 Java 对齐（cache name + key + TTL + invalidation）
- 失效逻辑必须与 Java 端**一致**（同一缓存名、同一 key 规则、同一失效时机）
- 详见 [`luban-dual-backend-parity.md`](./luban-dual-backend-parity.md)

## 已注册的缓存名（示例，实际以代码为准）

| 名称 | 用途 | 默认 TTL |
|------|------|----------|
| `materialManifest` | 物料清单（公开读） | 5m |
| `schemaValidation` | schema 校验结果 | 10m |
| `userInfo` | 用户基本信息 | 30m |

新增缓存名时：在 Java 的 `LubanCacheNames` 与 Go 的等价常量集中登记，并同步 per-cache TTL。

## 失效清单（与实现对齐）

- 物料注册/更新：失效 `materialManifest` + 相关 schema 缓存
- schema 变更：失效 `schemaValidation`
- 用户资料变更：失效 `userInfo`

若新增写库路径会影响上述读模型，必须扩展两端的失效调用点。

## 测试

- 集成测试 profile 排除 Redis 时，使用内存 cache manager；**仍须**走失效逻辑，避免「测到假绿」
- 双后端的缓存行为须做 contract test（同一 key 在两端写入/失效行为一致）

---

## 经验：本地缓存迁移 Redis 后的单元测试适配

### 场景
将本地 `ConcurrentHashMap` 缓存改为 Redis 后，原有单测失败。测试通过 `service.add()` 写入、`service.get()` 读取，但 mock 不维护 add/get 之间的状态。

### 根因
1. `add()` → `redisSet()` 被 stub 为无操作
2. `get()` → `redisGet()` 返回 null（mock 默认）
3. mock 不维护内部状态——add 和 get 是独立调用

### 解决方案
用 **Answer-based mock** 维护内存状态。

### 预防
1. 移除本地缓存前先检查测试是否依赖其内存状态
2. 分布式缓存整改必须在同一 PR 中更新测试（否则合并会还原测试 → 覆盖修复）
3. 双路径（Redis 优先、DB 降级）改造后，测试需覆盖两条路径

---

## 经验：缓存击穿与穿透

### 击穿（hot key expired）
- 用 `sync = true`（Java Spring Cache）或 singleflight（Go）让并发请求合并
- 不要让所有并发同时回源 DB

### 穿透（key not exist）
- 缓存空值（短 TTL，如 30s）
- 入口参数校验（非法 id 直接拒绝，不打 DB）
- 布隆过滤器（可选，海量 key 场景）

### 雪崩（mass expire）
- TTL 加随机抖动（`ttl + random(0, 60s)`）
- 不同缓存的 TTL 错开
