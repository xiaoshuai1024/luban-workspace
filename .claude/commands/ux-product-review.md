---
description: 加载 ux-product-review skill，按《LUBAN_PRODUCT_DELIVERY_CONTRACT》与 rubric 做产品/UX/交付审查（禁止 MVP、引擎可用性优先、多端渲染一致、website 入口、全量文档对照）
---

触发：**`/ux-product-review`**（与 **`/super-pm`** 共用同一 skill，输出模板一致）。

## Agent 必须执行

1. **读取并遵循**项目 skill：`.agents/skills/ux-product-review/SKILL.md`（全文）。
2. **读取**交付硬约束：`docs/superpowers/LUBAN_PRODUCT_DELIVERY_CONTRACT.md`。
3. 依 skill 的 **输入约定** 向用户索取或从上下文补齐：对象、角色与场景、需求原文（若有）、证据线索。
4. 输出必须使用 skill 内 **输出模板（rubric）** 的章节标题，**不得省略**：**「Luban 产品交付硬约束核对」**；凡涉及引擎/website/各 client 渲染须含 **「多端渲染一致对照」**；凡涉及 website 站点须含 **「website 站点交互规范对照」**（并读 `docs/dev/website-dev-standards.md`）；凡新功能/跨模块须含 **「方案与系统入口／数据依赖对照」**；有 PRD/方案时 **「需求对照」须全量逐条**。
5. **视觉／token**：委派 `ui-spec-enforcer` 与 `docs/UI_SPEC.md`（luban 设计 token / 物料规范摘要），在报告中注明即可。
6. **设计 Token 扫描**（若审查范围包含引擎/website/UI 物料页面）：运行 `node scripts/check-design-tokens.mjs --all`（exit code 2 → 报告违规清单；exit code 1 → 报告警告清单；exit code 0 → 注明「Token 合规通过」），结果写入 rubric **「Luban 设计 Token 合规」** 一节。
7. **物料 schema 合规**（若审查涉及 luban-ui 物料）：对照 `.agents/rules/luban-material-schema.md` 检查 props schema 完整性、版本、注册。

策略：不替代各子项目构建或 E2E 工程验证。
