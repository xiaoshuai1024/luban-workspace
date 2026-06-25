---
name: "source-command-e2e-archi"
description: "方案阶段架构自检 + E2E TDD 覆盖分析 + 安全合规审查 + 项目经验回归检查（架构分层、关键行为追踪、事务边界、测试矩阵、双后端一致性、安全合规、性能、可观测性、依赖治理、历史事故回归）"
---

# source-command-e2e-archi

Use this skill when the user asks to run the migrated source command `e2e-archi`.

## Command Template

触发：**`/e2e-archi`**。

## 角色预设

**角色**：资深后端架构师 + 安全合规专家

**专长**：
- 系统分层设计与架构合理性
- 事务边界与一致性保障
- API 契约与接口安全
- 安全架构与合规要求
- 测试策略与覆盖度
- 性能设计与容量规划
- 可观测性与运维友好性
- 依赖治理与技术债务
- 双后端（Java / Go）契约对齐
- 项目历史经验与事故回归检查

**关注点**：
- 架构合理性与技术债务
- 系统安全性与合规性
- 可测试性与自动化覆盖
- 数据安全与隐私保护
- 性能瓶颈与容量风险
- 系统可观测性与故障定位能力
- Java / Go 同接口行为一致性
- 引擎/website/各 client 多端渲染一致
- 历史事故回归与经验教训闭环

## Agent 必须执行

1. **读取并遵循** `.agents/rules/luban-e2e-execution-contract.md`、`.agents/rules/luban-e2e-agent-guide.md`、`docs/E2E_AGENT_GUIDE.md`、`.agents/rules/luban-dual-backend-parity.md`、`docs/DUAL_BACKEND_PARITY.md`（全文）。

2. **审查对象**：从上下文或用户提供获取：
   - 方案文档路径（若有）
   - 核心接口设计（REST API 清单，须双后端）
   - 数据模型（核心表结构）
   - E2E 测试用例设计（引擎渲染 / website / 各 client）
   - 安全合规相关设计文档

3. **输出结构**：

   ### 1. 架构自检
   - 分层检查（Java: Controller / Service / Repository / DTO；Go: handler / service / repo 对应层；引擎/BFF/website: 模块边界）
   - 关键行为可追踪性（用户操作 → E2E 用例映射）
   - 关键事务边界（幂等保证、补偿机制；Java 与 Go 实现须一致）
   - 跨端一致性（引擎产物在 website 与各 client 渲染一致）
   - 架构演进兼容性（与 meta 仓各子项目既有结构对齐）

   ### 2. E2E 测试覆盖分析

   #### 2.1 流程拆解（Flow Inventory）
   - 深入代码识别模块所有**独立的用户可操作流程**
   - 每个流程标注：入口（API 端点 / 页面路由）、类型（独立/前置依赖/基础设施）
   - 输出流程清单（1 ~ N 条），标注流程间的依赖关系

   #### 2.2 覆盖矩阵（Coverage Matrix）
   - 对每个流程，检查多种测试层次：
     - **Java 后端集成测试**（`*IT.java`）
     - **Go 后端测试**（`go test`，与 Java 同接口须覆盖相同场景）
     - **引擎渲染 E2E**（`packages/engine/luban`，Playwright）
     - **website SSR E2E**（`packages/web/luban-website`，Playwright）
     - **各 client E2E**（electron/flutter，按规划态）
   - 产出覆盖矩阵表格：

     ```
     ┌──────────────┬──────────┬──────────┬──────────┬──────────┐
     │ 流程          │ Java IT  │ Go test  │ 引擎E2E  │ website  │
     ├──────────────┼──────────┼──────────┼──────────┼──────────┤
     │ ① xxx        │ ✅/❌    │ ✅/❌    │ ✅/❌    │ N/A      │
     │ ② xxx        │ ✅/❌    │ ✅/❌    │ N/A      │ ✅/❌    │
     └──────────────┴──────────┴──────────┴──────────┴──────────┘
     ```

   - 对每个 ❌ 标注补齐方案和优先级

   #### 2.3 补齐策略（Gap Filling）
   - 后端：mock 全部外部依赖 → 每流程至少 1 成功 + 1 异常场景；Java 与 Go 两侧均须覆盖
   - 引擎/website E2E：页面可达验证 + 核心交互验证，容错条件执行
   - 各 client：按规划态，已有实现的端做交互验证

   #### 2.4 验证门禁
   - Java 后端：`cd packages/backend/luban-backend && mvn -q verify`
   - Go 后端：`cd packages/backend/luban-backend-go && go test ./... -race -cover`
   - 引擎/BFF/website：`pnpm test` + `pnpm run build`
   - 引擎渲染 E2E：`pnpm run test:e2e`（见 `/engine-e2e`）
   - website SSR E2E：`pnpm run test:e2e`（见 `/website-e2e`）

   #### 2.5 关键断言设计（示例代码）
   - 自动化命令设计（覆盖命令 + 前置条件）
   - 异常路径覆盖（网络失败、鉴权失败、外部依赖故障、接口 4xx/5xx）
   - 测试健康度检查（test.skip占比、env gate、跨端数据传递、负向场景、写回验证）
   - 引擎渲染专项检查（物料 schema 合规、各端渲染一致、零新增 console error）
   - 双后端一致性检查（同接口 Java 与 Go 响应体/错误码/状态机一致）
   - 测试环境一致性检查（mock 对齐、后端版本）
   - Flaky Test 治理（flaky 率门禁、标记机制、根因分析时效）
   - CI 集成检查（运行时长、并行策略、超时、失败告警）
   - 测试数据生命周期管理（schema 对齐、隔离、可重复性）
   - 并发/竞态测试要求（并发场景识别、竞态条件覆盖、幂等验证）
   - Feature Flag 组合测试（Flag 矩阵、灰度场景）

   ### 3. TDD 执行纪律检查
   - 分支策略（各子仓默认分支 + `feature/*`）
   - 禁止项检查（禁止假绿、禁止跳过 E2E 门禁等）
   - 验证命令清单（Java `mvn -q verify`、Go `go test ./... -race -cover`、引擎/website `pnpm test` + `pnpm run build` + `pnpm run test:e2e`）

   ### 4. API 契约设计
   - 核心接口清单（含路径、方法、说明）—— Java 与 Go 双实现须一致
   - Swagger/OpenAPI 标注要求
   - 错误码设计（与统一错误体对齐，见 `.agents/rules/luban-cross-cutting-standards.md`）
   - 接口版本化策略
   - BFF 聚合字段规范（见 `.agents/rules/luban-cross-cutting-standards.md` BFF 字段约定）

   ### 5. 数据模型
   - 核心表结构
   - Flyway 迁移计划（Java 后端，秒级时间戳 `V{YYYYMMDDHHmmss}`，见 `docs/dev/luban-flyway-migration-standards.md`）
   - Go 后端数据访问层（若共用 DB，须与 Java schema 对齐）
   - 物料 schema（引擎物料 props schema，见 `.agents/rules/luban-material-schema.md`）
   - 数据归档与清理策略

   ### 6. 安全审查
   - 认证与授权设计
   - 数据安全（加密、脱敏）
   - 接口安全（限流、防注入）
   - 敏感操作保护（最少二次弹窗确认）
   - 日志安全（禁止输出密钥/secret/完整 token/用户敏感标识）

   ### 7. 合规审查
   - 隐私合规（GDPR/个保法）
   - 数据安全合规
   - 行业监管要求

   ### 8. 性能与容量审查
   - 接口响应时间目标（P50/P99）
   - 数据库查询优化（索引设计、N+1 检查、慢查询防护）
   - 缓存策略（Redis 使用、缓存穿透/雪崩防护，见 `.agents/rules/luban-redis-cache.md`）
   - 批量操作与分页设计
   - 并发与锁策略（乐观锁/悲观锁选择；Java 与 Go 一致）
   - 容量预估（数据量增长、QPS 峰值）

   ### 9. 可观测性与运维审查
   - 日志规范（RequestId 贯穿、结构化日志）
   - 监控指标（业务指标 + 技术指标）
   - 告警设计（阈值、通知渠道、升级策略）
   - 健康检查端点
   - 故障定位路径（从用户报错到根因的最短路径）

   ### 10. 依赖与集成审查
   - 外部依赖清单（第三方 API、SDK、服务）
   - 依赖健康度（版本、维护状态、许可证）
   - 降级与熔断策略
   - 集成测试覆盖（外部服务 mock/真实切换）

   ### 11. 风险与缓解
   - 高/中风险项识别
   - 缓解措施建议

   ### 12. 项目经验回归检查

   **来源**：项目历史事故与修复经验（从 kangdou 迁移并去业务化）。以下检查项确保已出现过的问题不会再次引入。

   #### 12.1 后端通用陷阱
   - **TOCTOU 竞态条件**：区分 4 种 `FOR UPDATE` 模式（读后写 → FOR UPDATE + CAS，状态检查后变更 → FOR UPDATE 足够，幂等性检查 → FOR UPDATE 或 DuplicateKeyException，纯读取 → 无需 FOR UPDATE）。Java 与 Go 实现须采用等价的锁策略。
   - **双后端鉴权模式混淆**：统一鉴权入口，禁止 Java/Go 用不同 token 解析或权限模型导致同一接口两端行为不一致。
   - **IllegalArgumentException（或 Go 的 panic/errors）禁止用于业务逻辑**：返回 5xx + 非中文文本。必须替换为统一 AppException + ApiErrorCode（见 `.agents/rules/luban-cross-cutting-standards.md` 错误体）。
   - **后端错误信息枚举泄漏**：`throw new AppException(..., "state: " + status)` 枚举值泄漏到 API 响应。必须用 switch/map 映射为中文。
   - **ID 类型一致性**：Java 与 Go 同一资源 ID 须用相同类型（同为 BIGINT 或同为 VARCHAR），跨端调用时 grep 检查类型转换。
   - **禁止 JVM 本地业务缓存**：禁止 `ConcurrentHashMap`/`CopyOnWriteArraySet` 等 JVM 内存做业务缓存（Go 同理）。必须使用 Redis + DB 回退（WebSocket 会话管理、API 令牌缓存除外）。
   - **Flyway 菜单/字典 ID 硬编码陷阱**：`INSERT IGNORE` + 硬编码 ID 导致静默丢失。改用 `ON DUPLICATE KEY UPDATE` + 高位无冲突 ID，并在插入前 grep 历史迁移确认 ID 未被占用。

   #### 12.2 引擎/物料专项
   - **物料 props schema 完整性**：新增物料须注册 props schema，引擎渲染前校验。见 `.agents/rules/luban-material-schema.md`。
   - **多端渲染一致**：同一 schema 在 website、electron、flutter 渲染须一致。新增物料须在各端验证。
   - **引擎零 console error 门槛**：渲染器零新增 console error；违反即阻断。见 `.agents/rules/luban-lowcode-engine-quality.md`。

   #### 12.3 前端/测试基础设施
   - **ES2022 禁止特性**：`.at(-1)`、`Object.hasOwn()`、top-level await 在项目 TS 配置中不可用。用 `arr[arr.length-1]`、`Object.prototype.hasOwnProperty.call()` 等替代。
   - **状态/枚举中文显示**：所有状态/枚举字段必须映射为中文。禁止 `default: return status`、`return status || "--"` 等英文透传模式。
   - **E2E 测试零跳过**：禁止 `describe.skip`、`it.skip` 及任何条件跳过门控。环境不可用时报错而非跳过。
   - **假绿检测**：检测 E2E 全部 skip + 退出码 0、断言仅检查 200 状态码、`expect(true).toBe(true)` 占位测试。

   #### 12.4 审查过程自检
   - **全量审查轮次**：增量审查在连续 5 轮后必须执行一次全量审查（增量模式会遗漏新引入的问题）
   - **审查上下文传递**：多轮审查时，上一轮已修复的问题应在当前轮标记为「已验证修复」，避免重复报告

## 与 `/plan-template` 的区别

| 维度 | `/e2e-archi` | `/plan-template` |
|------|--------------|-------------------|
| 重点 | E2E 测试覆盖、TDD 纪律、安全合规、性能、可观测性、双后端一致、项目经验回归 | 全栈方案两轮（讨论稿→定稿） |
| 输出 | 测试矩阵、断言代码、安全合规报告、性能基线 | 方案 Markdown（§0-§9） |
| 时机 | 方案 → 执行前 | 需求 → 方案 |

策略：与 GitHub/PR 无关；不替代各子项目构建或 E2E 工程验证。

## 与 `/super-pm` 的职责划分

| 审查维度 | `/e2e-archi` | `/super-pm` |
|---------|-------------|-------------|
| 架构设计 | ✅ 负责 | ❌ 不负责 |
| 安全审查 | ✅ 负责 | ❌ 不负责 |
| 合规审查 | ✅ 负责 | ❌ 不负责 |
| 性能与容量 | ✅ 负责 | ❌ 不负责 |
| 可观测性 | ✅ 负责 | ❌ 不负责 |
| 依赖治理 | ✅ 负责 | ❌ 不负责 |
| 双后端一致性 | ✅ 负责 | ❌ 不负责 |
| 产品闭环 | ❌ 不负责 | ✅ 负责 |
| 用户体验 | ❌ 不负责 | ✅ 负责 |
| UI规范/样式统一 | ❌ 不负责 | ✅ 负责 |
| 原型符合性 | ❌ 不负责 | ✅ 负责 |
| 假功能排查 | ❌ 不负责 | ✅ 负责 |
| 项目经验回归检查 | ✅ 负责 | ❌ 不负责 |
