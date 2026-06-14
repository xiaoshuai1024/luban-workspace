<!--
description: 高优先级 — E2E 禁止假绿与降级；执行会话内测试代码冻结；plan 须列跨端主流程；详文见 docs/E2E_AGENT_GUIDE.md §2.5
globs: "**/*"
alwaysApply: false
-->

# E2E 执行契约（高优先级 · MUST）

本规则与 [`docs/E2E_AGENT_GUIDE.md`](../../docs/E2E_AGENT_GUIDE.md) §2.5、[`.agents/rules/luban-testing-coverage.md`](./luban-testing-coverage.md)、`docs/SUPERPOWERS.md` 计划章节一致；执行 E2E、写 plan、TDD 收口时**必须**遵守。冲突时以**更严格**条文为准。

## 摘要（Agent 不可跳过）

1. **已纳入合入门禁或文档默认路径的 E2E**：不得**降级**（关 bail、滥用 `SKIP_*`、批量 skip、弱化断言、改默认账号、用子集命令冒充全量等）。
2. **一旦为当前验收任务开始执行**约定 E2E 命令：在**用户明确书面允许**前，**不得**改 `tests/e2e/**`、`**/e2e/**`、与断言/超时/skip 相关的 Playwright 配置及测试辅助逻辑（**纯格式化除外**，见 §2.5.3 详文）。
3. **仅新开聊天窗口、同一分支同一需求**：**不**视为解除冻结；须**用户换任务声明**或**授权改测**才可改测试代码。
4. **红**：先排环境与实现（后端服务、DB、引擎渲染、Console→Network→日志），**禁止**未排查就以改测骗绿。
5. **Plan**：须含跨端 **E2E 主路径**（若涉及多端）及脚本保障逻辑。

完整条款、示例与汇报要求见 [`docs/E2E_AGENT_GUIDE.md`](../../docs/E2E_AGENT_GUIDE.md) §2.5。

---

## 经验：E2E 假绿 — 测试全绿但功能不存在

### 场景
某能力宣称已实现，但 E2E 报告全绿，部署后发现后端 Controller 或引擎物料未注册。

### 根因
1. **API 层测试 mock 了整个 HTTP 层**：单测只验证 URL 拼接，不发真实请求，后端不存在时仍通过
2. **E2E 测试未覆盖该模块**
3. **单元测试不验证后端存在性**

### 预防
- API 层测试至少验证后端路由存在性（HTTP 200/401 而非 404），而非纯 mock
- 合约一致性检查脚本自动比对 BFF URL ↔ 后端路由
- 每个新能力至少一条 Playwright 冒烟用例（页面能打开 + 列表能加载）
- 引擎新物料至少一条渲染 E2E（物料挂载成功 + props 透传）

---

## 经验：E2E 测试禁止以环境/数据问题为借口中断

### 规则

| 借口 | 正确的排查/修复方式 |
|------|-------------------|
| "后端没启动" | `cd packages/backend/luban-backend && mvn spring-boot:run`（Java）或 `go run`（Go） |
| "MySQL 不可达" | 各后端独立配置 MySQL，检查连接参数 |
| "Redis/其它中间件不可用" | 排查端口、配置；必要时本地起容器 |
| "缺少测试数据" | 通过 BFF/后端接口创建 / SQL INSERT / 测试 fixture |
| "引擎渲染不出来" | 检查物料注册、schema 校验、console 报错 |
| "Playwright 没装" | `pnpm exec playwright install chromium` |

三不原则：不跳过、不绕行、不找借口——先排查再说话。

---

## 经验：双后端 E2E 路由不一致

### 场景
Java 与 Go 后端同一接口返回不同错误码或响应体结构，E2E 在切换后端时失败。

### 根因
契约未在两端对齐，见 [`docs/DUAL_BACKEND_PARITY.md`](../../docs/DUAL_BACKEND_PARITY.md)。

### 预防
- 凡 E2E 依赖后端的断言，必须以**双后端一致**的契约为准
- 引入 contract test：同一组请求分别打 Java 与 Go 后端，断言响应等价
- E2E 通过 `BFF` 间接访问后端，BFF 不应掩盖两端差异
