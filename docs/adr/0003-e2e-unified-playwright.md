# ADR 0003: E2E 统一 Playwright（弃 Cypress）

| 字段 | 值 |
|------|-----|
| 状态 | Accepted |
| 日期 | 2026-06-28 |
| 决策者 | 测试架构组 |
| 关联文档 | [docs/E2E_AGENT_GUIDE.md](../E2E_AGENT_GUIDE.md)、[.agents/rules/luban-e2e-execution-contract.md](../../.agents/rules/luban-e2e-execution-contract.md)、[.agents/rules/luban-e2e-agent-guide.md](../../.agents/rules/luban-e2e-agent-guide.md) |
| 回溯 | Yes（决策实际发生于项目早期，本篇为 2026-06-28 回溯记录） |

## 背景 (Context)

luban-workspace 是多语言多端的 meta 仓：引擎是 Vue3 SPA、BFF 是 Node、website 是 Nuxt SSR、后端有 Java 与 Go 双实现。要验证「一条业务能力从引擎渲染到后端落库再到站点 SSR 可见」的全流程，必须有跨子项目编排 E2E 的能力。

但现状留有严重隐患。engine 早期引入的 Cypress 通过 `loginWithToken` 向 localStorage 注入 `MOCK_TOKEN='mock-jwt-token'` 来绕过真实后端登录，后果是 `leads` / `sites` / `pages` 等 spec 在后端 Controller 根本不存在时依然全绿。这是 `luban-e2e-execution-contract` §假绿经验段与 `docs/E2E_AGENT_GUIDE.md` §2.5.1 明令禁止的「假绿」——它让绿条不再代表「功能真的可用」。在迁移完成前，engine Cypress 的结果一律不得当作后端已验收的证据。

此外，Cypress 的执行模型是页内运行，难以原生编排 engine→BFF→backend→website 这条多服务链路；引擎作为 Vue3 SPA，Cypress 在调试异步渲染、物料挂载时序时也较吃力。团队需要一个能跨进程编排、对真实浏览器栈更透明的工具。

## 决策 (Decision)

全栈 E2E 从 Cypress 统一迁移到 Playwright，所有 E2E 走真实登录与真实后端，移除 mock-token 假绿路径。

引擎渲染 E2E 的主断言路径须落在引擎调试页或真实产品页面（如 website 实际渲染路径），模拟真实用户「加载引擎 → 看到渲染结果」的操作链；禁止为通过自动化而新建仅存在于测试专区的「假渲染页」。在 workspace 根新建 `e2e/`（Playwright 多 project）编排全链路：发布闭环 spec（登录→建站点→建页面→发布→website SSR 断言）、线索闭环 spec（website 表单→backend 入库→engine 线索中心可见）、双后端一致性 spec（同请求打 Java/Go 等价断言）。执行入口：`make e2e-up`（起服务）→ `make e2e-cross`（跑跨项目流程）→ `make e2e-down`。整个过程受 E2E 执行契约约束：禁假绿、禁降级、执行会话内冻结测试代码，宣称门禁通过前必须真实跑通。

## 考虑过的备选方案 (Alternatives Considered)

### 备选 A：继续用 Cypress + 修假绿（仅 engine 范围内）
- 优点：零迁移成本，engine 团队已熟悉 Cypress API，现有 spec 不用重写。
- 缺点 / 代价：治标不治本——Cypress 页内运行模型依然不擅长编排 engine→BFF→backend→website 多服务链路，无法原生支撑「发布闭环」「线索闭环」这类黄金流程；引擎外其它端（website SSR、client Web 渲染层）本就走 Playwright，工具割裂长期存在；假绿根因（mock 整个 HTTP 层、断言不触达后端）在 Cypress 下需要逐 spec 审计，维护负担重。

### 备选 B：分端用不同工具（engine Cypress + website Playwright）
- 优点：各自端用各自最熟的工具，迁移面小。
- 缺点 / 代价：两套工具并存，CI 编排与依赖管理翻倍；跨端流程性 E2E 无所适从——「线索闭环」横跨 website 与 engine，到底用哪个工具跑、怎么串？断言语义、selector 策略、失败重试、报告格式都要维护两套；团队认知成本随端数线性增长，与 meta 仓「多端一致性」目标相悖。

## 后果 (Consequences)

- **正面**：单一工具栈显著降低 CI 与 helper 维护成本；真实登录 + 真实后端让绿条重新等同于「已验收」，根除 mock-token 假绿；跨项目 Playwright 多 project 原生支撑发布/线索/双后端三大黄金流程，与「禁假绿、禁降级、会话冻结」执行契约天然契合。
- **负面 / 代价**：engine 现有 Cypress spec 需整体重写为 Playwright（含拖拽、设计器 fixture 等 helper 迁移），一次性迁移工作量大；Playwright 对 Vue3 SPA 的异步渲染、物料挂载时序、shadow DOM 调试有学习曲线，团队需建立断言稳定性规范。
- **需要后续跟进**：完成 engine 全量 spec 迁移并下线 Cypress；验证 `loginAndGetToken` 真实登录路径在 CI 的稳定性；补齐跨项目三大流程 spec 的 P0 旅程覆盖率（见 [ADR 0009](./0009-test-layering-coverage-gates.md)）。

## 备注

此决策是 `docs/E2E_AGENT_GUIDE.md` §1.4「跨项目流程性 E2E」与 §2.5 执行契约的工具选型基础。推翻此决策需满足：出现对 Vue3 SPA + 多服务编排支持显著优于 Playwright 且生态成熟的新工具，并能无假绿地覆盖现有三大黄金流程。
