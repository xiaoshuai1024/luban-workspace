# ADR 0009: 测试分层与覆盖率门禁

| 字段 | 值 |
|------|-----|
| 状态 | Accepted |
| 日期 | 2026-06-28 |
| 决策者 | 测试架构组 + 各子项目 owner |
| 关联文档 | [docs/TESTING_SPEC.md](../TESTING_SPEC.md)、[.agents/rules/luban-testing-coverage.md](../../.agents/rules/luban-testing-coverage.md) |
| 回溯 | Yes（决策实际发生于项目早期，本篇为 2026-06-28 回溯记录） |

## 背景 (Context)

luban-workspace 是 meta 仓，子项目横跨多个技术栈：引擎与 BFF 是 TypeScript、UI 物料库是 Vue3、website 是 SSR、后端是 Java 与 Go、client 覆盖 Electron/Flutter 等多端。质量风险高度集中在「全流程是否真正跑通」——单靠单元测试验证不了「引擎渲染 → BFF 聚合 → 后端落库 → 站点 SSR」这条链路，正如 [ADR 0003](./0003-e2e-unified-playwright.md) 揭示的假绿教训。

同时，不同栈的覆盖率能力天然不同：TypeScript 用 Vitest coverage-v8 可精确到行/分支；Java 用 JaCoCo 需排除 config 包与 main 类；Go 的 `go test -cover` 主看行覆盖、分支口径较弱；组件库（UI 物料）质量优先，门槛应更高。一刀切的统一门禁会要么对某栈过松、要么对另一栈不可达。需要一套分层优先级 + 分栈门禁的体系，且由 CI 强制执行，避免「单元测试够了」成为跳过端到端的借口。

## 决策 (Decision)

确立 **E2E > 集成 > 单元** 的测试优先级，禁止以「单元测试够了」为由跳过端到端测试；按子项目设定差异化覆盖率门禁（行/分支），CI 强制阻断，一键全栈跑 `make test-coverage`。

分栈门禁如下：低代码引擎 Vitest coverage-v8 行 85% / 分支 75%；BFF 85% / 75%；UI 物料库 90% / 80%（组件库质量优先）；SSR 站点 85% / 75%；后端 Java JaCoCo 80% / 70%；后端 Go `go test -cover` 行 75%；client 各端原生工具 85% / 75%。豁免原则：Java `config/` 与 `Application.class`（main 类）全局豁免，纯 POJO/DTO/VO 有 `@lombok.Generated` 自动豁免；TS `*.d.ts` 豁免，路由/配置样板在 vitest.config 排除；不可实现分支用 `/* istanbul ignore next */` 标记；其余豁免须在 PR 说明。E2E 维度另以旅程覆盖率度量（P0 须 100% 有 spec 绑定），与代码行覆盖率正交，任一阻断即整体阻断。

## 考虑过的备选方案 (Alternatives Considered)

### 备选 A：只设单元测试、不要求 E2E
- 优点：执行最快、反馈最即时，CI 资源消耗最低，单测易于 TDD 循环。
- 缺点 / 代价：完全无法覆盖跨服务链路，单元测试 mock 掉 HTTP 层后，后端 Controller 不存在也能全绿（即 ADR 0003 的假绿根因）；「单元测试够了」会让团队在合入时产生虚假信心，问题延迟到线上才暴露，定位成本远高于 E2E。直接违背平台「端到端是验证全流程唯一可靠手段」的优先级原则。

### 备选 B：统一覆盖率门禁、不分栈（如全栈统一 85%/75%）
- 优点：规则简单、一句话能讲清，无需维护分栈表格。
- 缺点 / 代价：与各栈真实能力错配——Go 的分支覆盖工具链薄弱，强设 75% 分支门槛会逼出「为达标而写」的低价值测试或大量 ignore 标记；Java 后端排除了 config 与 main 类后实际可测面更窄，统一高线会不可达；组件库本应更高（90%）却被拉低到 85%，质量水位下降。一刀切要么过严要么过松，无法适配差异，最终门禁会被迫到处开例外，反而失去强制力。

## 后果 (Consequences)

- **正面**：E2E 优先级写入契约，全流程正确性有可靠保障，假绿风险被结构性降低；分栈门禁贴合各栈能力，可达且不掺水；CI 强制 + `make test-coverage` 汇总让覆盖率成为合入门禁的一等公民；旅程覆盖率补齐了「代码行覆盖看不见的链路盲区」。
- **负面 / 代价**：分栈表格本身需随技术栈演进维护（新增栈须补行）；CI 跑全栈覆盖率（尤其 E2E + 旅程）耗时较长，需分层调度避免拖慢 PR；Go 分支覆盖口径薄弱，需以行覆盖为主、辅以人工评审关键分支。
- **需要后续跟进**：在 CI 中将 `make test-coverage` 与 `make journey-coverage` 接为门禁步骤；定期复核豁免清单是否被滥用；与 [ADR 0003](./0003-e2e-unified-playwright.md) 协同，确保 E2E 真实登录路径稳定以支撑覆盖率可信度。

## 备注

此决策是 `.agents/rules/luban-testing-coverage.md`「分栈覆盖率门禁」「旅程覆盖率门禁」两节的依据，与 ADR 0003（E2E 工具与执行契约）共同构成测试体系骨架。调整任一子项目门禁阈值须在该子项目 PR 中由 owner 说明理由并更新本 ADR 关联表。
