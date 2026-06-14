---
name: ux-product-review
description: 以产品闭环、体验、信息架构、需求反向验证、低代码引擎六维（物料库/画布/属性配置/预览/发布/异常态）为主轴，对方案或已实现界面做结构化审查（阻断／建议／可选＋待办）。须对齐 luban 低代码引擎交付门槛与 luban-ui 视觉规范。**保留**禁止 MVP、需求反向验证、文档—实现全量审查、假功能排查；**不适用** C 端六维/运营通栏/租户默认开/Tabbar 无条件渲染（luban 无小程序 C 端与多租户运营壳）。用于产品／UX 审查、方案评审、交互逻辑检查、需求验收，或显式加载本 skill 与 `/ux-product-review`、`/super-pm`。luban 视觉 token 与组件规范须委派 `.agents/skills/ui-spec-enforcer/SKILL.md`，本 skill 不重复抄写。
disable-model-invocation: true
---

# UX + 产品专家（审查）· luban 低代码平台

## 定位与分工

| 面向 | 本 skill 负责 | 委派给其他来源 |
|------|----------------|----------------|
| 产品闭环、模块关联、主路径 | 是 | — |
| **低代码引擎交付门槛**（引擎可用性、物料合规、各端渲染一致、零新增 console） | **是（MUST）** | `docs/LOWCODE_ENGINE_SPEC.md` · `.agents/rules/luban-lowcode-engine-quality.md` · `.agents/rules/luban-material-schema.md` |
| 体验、信息架构、状态与错误 | 是 | 深度无障碍可读 `.agents/skills/` 下相关 skill |
| luban 视觉 token、品牌色等 | 否（仅提醒「应对照规范」） | `.agents/skills/ui-spec-enforcer/SKILL.md`、`docs/UI_SPEC.md`、`scripts/check-design-tokens.mjs` Token 扫描 |
| **UI 样式检查**（78 条规则：布局、色彩、排版、间距、组件、响应式、动效、CSS 质量、动效进阶、滚动交互、主题视觉、字体文本、触控手势、平台特有、低代码引擎专有） | **是（本 skill 内置）** | 自动规则（grep/AST）在第 1 阶段执行；manual 规则在第 3 阶段执行 |
| 工程门禁（`pnpm run build`、`make test-coverage`、E2E 绿灯） | 否 | 项目测试规范；可建议补 E2E／证据链，见 `docs/E2E_AGENT_GUIDE.md` |

**禁止**：仅以主观「好不好看」下结论。若谈美观，须绑定规范条目、设计稿或同类产品对照。

**禁止**：将「仅主路径 / 仅门禁绿 / 占位或 E2E 专页」判定为可发布；与 luban 低代码引擎交付门槛冲突的项一律归入 **阻断**（除非有等效豁免并在 rubric 中引用）。

---

## luban 低代码引擎交付硬约束（审查 MUST）

开始任何 **方案、实现或发布前审查** 前，**须阅读**（或已在本轮加载）`docs/LOWCODE_ENGINE_SPEC.md` 与 `.agents/rules/luban-lowcode-engine-quality.md`。审查输出中 **必须** 用下面四节（可并入 rubric 同名标题）逐条核对；**不适用** 须写理由与证据。

### A. 禁止 MVP 与「可发布」口径

- 是否存在 **MVP / 占位 / 仅联调 / 仅 E2E 可达** 的设计或实现；若存在 → **阻断**。
- 宣称「可交付用户 / 可发布」时，是否满足 **交付后即可使用**（非仅开发自测）。

### B. 低代码引擎六维全量（luban 专有，替代 kangdou C 端六维）

对 **所有用户可见** 范围，须核对以下六个维度是否均有 **可理解、可完成** 的设计与实现；缺一项且无「不适用」论证 → **阻断** 或 **强烈建议**（按是否核心路径区分）：

| 维度 | 验收要点 |
|------|----------|
| **物料库** | 物料注册 / props schema 合规（`.agents/rules/luban-material-schema.md`）；物料在物料区可被检索、拖出；版本可追溯 |
| **画布** | 拖拽放置、选中、对齐、网格/标尺；多选与成组；撤销/重做；画布缩放与平移不破坏布局 |
| **属性配置** | 选中物料后属性面板字段与 props schema 一一对应；枚举/范围/必填校验；改动即时反映到画布 |
| **预览** | 预览态与发布态渲染一致（同一渲染器）；预览中交互（表单提交、跳转）可完整走通；空/错/权限态可见 |
| **发布** | schema 持久化、版本化；发布后各端（Web SSR / electron / flutter）渲染一致；回滚路径明确 |
| **异常态** | 物料加载失败、schema 校验失败、渲染异常时画布/预览有可理解的降级（错误边界 + 占位 + 可重试），禁止白屏 |

### C. 管理端、文档与实现一致（luban 化，替换 kangdou 运营后台/租户门禁）

> **变更说明**：luban 无多租户运营壳、无租户默认开 / 模块管理门禁。原 kangdou「运营后台交互规范门禁」整节迁移为「低代码编辑器交互规范」。

| 检查项 | 不符合时 |
|--------|----------|
| **PRD/方案 与 实现 全量条目** 对照完成（非仅主路径） | **阻断**（缺矩阵或大量「未核对」） |
| **方案阶段数据与接口** 已在文档写明；空/错/权限态可行动 | **强烈建议** 起评，缺项可升 **阻断** |
| **DB/Schema 字段语义独立性**：每个字段标注中文含义与取值范围；禁止一字段对应两个含义 | **建议** 起评，混用升 **阻断** |
| **首页或一级入口** 可达；方案入口表与实现一致 | **强烈建议**（若 luban 站点有一级导航） |

---

### D. （已删除：Tabbar 无条件渲染 — luban 无小程序 C 端导航壳）

> luban 不涉及小程序底部 Tabbar。原 kangdou §D **不适用**。luban 若未来引入移动端导航壳（flutter/electron 移动视图），可在此补回相应导航壳无条件渲染门禁。

---

## 技术栈重映射（MUST 遵循）

kangdou 原规则以 `miniprogram` / `operation-backend` 标注技术栈。luban 的技术栈不同，审查时按以下映射重映射：

| kangdou 技术栈 | luban 映射 | 说明 |
|----------------|-----------|------|
| `miniprogram`（uni-app 小程序） | `engine`（TS 引擎渲染）/ `website`（SSR） | 小程序页面 → 引擎渲染产物或 SSR 页面；C 端用户可见面迁移为「引擎渲染产物 + SSR 站点」 |
| `operation-backend`（运营后台） | `website`（SSR）/ `admin`（管理端） | 运营后台 → 管理端 / SSR 站点的管理路由 |
| `generic`（通用） | `generic` | 保持 |

**规则删除清单**（小程序专属，luban 不适用，已从规则集移除）：
- `nvue` / `webview` 渲染一致性（UI-PS-001）
- `rpx` 单位（UI-RE-002）→ 统一 px/rem，删除该规则
- 小程序 `safe-area-inset` 顶/底栏（UI-RE-001、UI-PS-003 小程序部分）→ 删除小程序专属，**保留通用 safe-area** 兜底（合并入 UI-RE-001'）
- 小程序 tab-bar 遮挡（UI-LA-002、UI-RE-003）→ luban 无原生 tab-bar，删除
- 小程序组件注册（`pages.json` / `usingComponents`）（UI-CU-004）→ 删除
- 图片 `mode` 属性（UI-CU-006）→ 删除（Web 用 object-fit/aspect-ratio，规则改造或删除）
- 自定义导航栏 / 胶囊按钮适配（UI-PS-002）→ 删除
- 页面转场动效（`uni.navigateTo`）（UI-AN-006）→ 改造为 Web 路由转场（保留规则，技术栈改 website）
- 共享元素过渡（UI-AN-008）→ 改造为 Web 共享元素过渡（保留规则，技术栈改 website）
- HBuilderX / 微信合规（小程序平台合规整节）→ 删除

---

## 模式：轻量 vs 全量 vs 增量

### 深度模式

| 模式 | 触发条件 | 执行阶段 | 适用场景 |
|------|---------|---------|---------|
| **全量**（默认） | 无特殊标记 | preflight + analysis + review 全三阶段 + 完整 rubric | 正常审查 |
| **轻量** | `--light` 或 git diff >50 文件自动降级 | preflight auto 规则 + 代表性 manual 规则（LA-006 空态、TY-005 枚举中文、AN-001 过渡缺失、AN-007 按钮反馈） | 大 PR、快速预检 |
| **增量** | `--since <commit>` 或 `--fixes <issue-ids>` | 仅审查变更文件或验证指定修复。**强约束**：首次调用必须全量，增量仅在前序轮次已通过全量后生效 | 多轮审查收敛 |

### 深度节流

- 审查文件数上限 **15 个**。超出部分按模块拆分，调用方负责排入后续轮次。
- git diff >50 文件 → 自动降级为轻量模式。
- 纯后端/纯配置/纯文档变更（git diff 不含 `.vue`/`.ts`/`.tsx`/`.css`/`.scss` 文件）→ 跳过 UI 样式检查阶段，仅执行低代码引擎交付硬约束核对。
- **状态复用**：若审查 manifest（`.lb-review/manifest.json`）存在，读取 `fileStates[path].consecutiveClean`；连续 2 轮零问题的文件可跳过审查。

---

## 输入约定（必做）

开始审查前先确认或标明：

1. **对象**：方案文件路径、Figma／原型、或代码中的路由／文件／截图。
2. **角色与场景**：例如低代码编辑器某角色、引擎渲染产物用户任务；端到端场景一句话。
3. **需求原文**（若有）：PRD、Issue、对话摘录；无则输出 **「基于假设的审查」** 与 **假设不成立时的风险**。
4. **证据**：每条阻断或重要建议尽量附可核对线索（路由、组件名、API、`requestId` 等）。

---

## 条件化加载指令（MUST 遵循）

当遇到 `<!-- LOAD: path, condition -->` 时：
1. 判断 condition 是否满足；满足则 Read 对应文件
2. 若 Read 失败（文件不存在或路径变更），输出 `⚠️ 依赖文件缺失：[path]`，手动 `ls` 同级目录查找替代
3. **连续 3+ 文件加载失败** → 中止审查，输出 `❌ 熔断：多个依赖文件缺失，无法完成审查`

`<!-- IF: condition -->` 同理：condition 不满足时跳过对应段落，在 rubric 中注明「不适用」及理由。

---

## 审查维度（检查时对照本表）

### 低代码编辑器交互规范门禁（luban 化，替换 kangdou 运营后台门禁）

**何时必须展开**：满足任一即视为「涉及低代码编辑器」，**不得**在 rubric 中省略本节（可逐条标「不适用」但须附理由）：

- 变更或评审对象路径含 **`packages/engine/luban`** 或 **`packages/ui/luban-ui`**，或
- 路由／菜单属于 luban **编辑器**（物料区 / 画布 / 属性面板 / 预览区 / 工具栏 / 发布），或
- 方案／PRD 写明「编辑器」「低代码」「引擎」「物料」等同义范围。

**权威文档（须打开并对照）**：
<!-- LOAD: docs/LOWCODE_ENGINE_SPEC.md, 审查对象涉及 packages/engine/ 或 packages/ui/ 或编辑器路由 -->
[`docs/LOWCODE_ENGINE_SPEC.md`](../../../docs/LOWCODE_ENGINE_SPEC.md)、[`.agents/rules/luban-lowcode-engine-quality.md`](../../../.agents/rules/luban-lowcode-engine-quality.md)、[`.agents/rules/luban-material-schema.md`](../../../.agents/rules/luban-material-schema.md)。

**最低检查项（须在「低代码编辑器交互规范对照」表中体现）**：

| 主题 | 要点（摘自规范 / 交付门槛） |
|------|------------------------------|
| **物料区** | 物料可检索、分类清晰；拖拽手感流畅；选中态明显；版本/作者可见 |
| **画布** | 拖拽放置精准；选中/多选/成组；对齐辅助线/标尺；撤销重做可用；缩放平移不破坏布局 |
| **属性面板** | 字段与 props schema 一一对应；枚举/范围/必填校验；改动即时反映画布；复杂类型（数组/对象）可编辑 |
| **预览区** | 预览与发布渲染一致（同渲染器）；交互可完整走通；空/错/权限态可见 |
| **工具栏** | 撤销/重做/保存/发布/预览切换；快捷键一致；危险操作（删除/发布）有确认 |
| **发布** | schema 持久化与版本化；各端渲染一致；回滚路径明确；发布日志可追溯 |
| **异常态** | 物料加载失败 / schema 校验失败 / 渲染异常时有错误边界 + 占位 + 可重试，禁止白屏 |
| **API 前后端字段一致性** | 引擎↔BFF↔后端（Java/Go）的字段名、类型、枚举值一致；URL 对应实际端点；避免静默丢弃或 400/404 |
| **Java/Go 双后端行为一致** | 同接口契约两端响应体/错误码/状态机一致（见 `docs/DUAL_BACKEND_PARITY.md`） |

若发现违反 MUST 且无已采纳的豁免说明，归入 rubric **阻断**；可实现但体验欠账归入 **建议**；一致性／锦上添花归入 **可选**。

### 四主轴（与用户约定对齐）

1. **产品逻辑闭环**：用户目标是否完成；主路径／支线是否在模块间断裂；数据与权限是否连贯。
2. **体验合理性**：认知负荷、步数、反馈时机；可恢复（返回、Undo）；表单／列表／筛选高频场景。
3. **UI 规范与同类操作**：交互模式是否与业务语义一致、是否符合同类编辑器/同类 Web 惯例；**视觉细节**请对照 `ui-spec-enforcer` 与 `docs/UI_SPEC.md`；**图标规范**禁止 emoji 和 Unicode 符号（✕ ☑ ☐ 等）作为 UI 图标，必须使用 SVG / iconfont / CSS 图形。
4. **需求完整与反向验证**：若有原文，**全量**逐条标 **已实现／部分／未实现／超出范围**，并附证据（与 **禁止仅主路径核对** 一致）。

> **深度节流**：若审查文件数 >15，优先聚焦四主轴 + 低代码引擎交付硬约束核对，UI 样式检查阶段可缩减为仅 preflight auto 规则。

### 补充维度（依场景启用）

- 信息架构与导航（命名、入口、面包屑、深链、权限遮罩后是否仍合理）
- 状态设计（加载，空、部分成功、超时；批次与进度可见性）
- 错误与防呆（可理解、可行动；危险操作确认与后果说明）
- 文案与术语一致；用户可见错误与统一错误体叙事是否一致（产品层）
- **前端性能感知**：首屏动画延迟排查（禁止逐元素延迟动画 `animation-delay: calc(var(--i) * Ns)`）；`watch(immediate: true)` + `onMounted` 组合去重；非首屏内容渐进式加载；低频变化数据使用本地缓存
- **DB/Schema 字段语义独立性**：方案/PRD 中的每个字段/属性须标注「中文含义」和「取值范围」，确认字段与业务概念一对一映射；发现同一字段对应两个含义 → 方案阶段拆分为独立字段
- 信任与数据呈现（列表／详情／导出字段对齐；审计／可追溯）
- 上线与演进（功能开关、迁移说明、新旧并存）
- 验收口径：关键路径是否可写成 E2E 或手测步骤；待办可建议附 `requestId` 对齐方式
- **图标规范（Web/引擎渲染产物）**：扫描所有页面模板和 ts 工具函数，检查是否存在 emoji 字符或 Unicode 符号（✓ ✕ ☑ ☐ ♥ ♡ › ▲ ▼ ↗ 🔍 🧩 等）被用作 UI 图标；发现即归入 **阻断**。

> **变更说明**：原 kangdou「微信小程序平台合规」（隐私授权 / wx.login / 分享卡片 / 类目资质）整节 **已删除**——luban 不涉及微信小程序。原「前端图标规范（C 端小程序）」**保留并泛化**为 Web/引擎渲染产物的图标规范（emoji/Unicode 符号禁用）。原「首页楼层数据来源区分」**不适用**（luban 无运营首页楼层）。

### 原型页面审查门禁（必检项）

**`<!-- IF: 用户提供了 Figma 链接、截图、或路径含 .fig/.png/.jpg -->` 审查原型时，必须逐项核对以下问题，发现任一项即归入阻断**：

| 检查项 | 验收标准 |
|--------|----------|
| **页面数据完整性** | 表格、列表、详情页必须有真实示例数据，禁止空表格、空列表 |
| **按钮交互完整性** | 所有按钮必须有 `onclick` 处理，禁止只有 `onclick=""` 或空函数 |
| **弹窗/确认替代完整流程** | 禁止用 `alert()`/`confirm()` 代替完整的确认模态框 |
| **底部操作栏可见性** | 检查固定底部操作栏是否被其他固定元素（sticky header / 浮动按钮）遮挡 |
| **模板语法渲染** | 确保所有 `{{ }}` / `v-if` / `v-for` 正确渲染，无原始模板语法外露 |
| **画布/属性面板联动** | 选中物料 → 属性面板字段加载；属性改动 → 画布即时反映 |
| **物料拖拽链路** | 物料区拖出 → 画布放置 → 属性配置 → 预览，整链路不可断 |
| **发布回滚** | 发布后可回滚到上一版本；版本列表可见 |

若发现违反，归入 rubric **阻断** 并标注具体文件和行号。

### 产品向安全红线（可见面）

日志、审计、导出等 UI 是否可能诱导展示密钥或过度敏感数据；细粒度安全仍以后端与代码审查为准。

---

## UI 样式检查体系

UI 样式检查分三阶段执行，规则按检测方式分类。

### 规则执行管道

```
第 1 阶段：preflight（auto 规则，确定性扫描）
├── 运行所有 auto 规则的 grep/AST/正则扫描
├── 输出违规清单（文件+行号+规则ID）
├── 耗时：<5 秒，近零 token
└── 轻量模式仅执行此阶段 + 代表性 manual 规则

第 2 阶段：analysis（hybrid 规则，半自动化）
├── 加载第 1 阶段结果
├── LLM 结合文件上下文判断（如：fixed 定位是否真的被遮挡）
└── 输出确认后的违规清单

第 3 阶段：review（manual 规则，LLM 判断）
├── 加载第 1+2 阶段结果
├── LLM 审阅页面模板代码做主观判断
└── 输出最终 UI 样式检查章节（纳入 rubric 的「视觉规范对照」部分）
```

### A. 布局（Layout）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-LA-001 | **Flex 溢出检测** | engine, website | auto | 🟡 warning | 扫描 CSS `flex` 容器缺少 `overflow`/`flex-wrap` 且内含定宽子元素 |
| ~~UI-LA-002~~ | ~~Fixed 定位遮挡（小程序 tab-bar）~~ | ~~miniprogram~~ | ~~hybrid~~ | ~~🟡 warning~~ | **已删除**：luban 无小程序原生 tab-bar |
| UI-LA-003 | **通栏布局（管理端）** | admin, website | auto | 🔴 blocking | 扫描管理端路由页面是否设置整页级 `max-width` 收窄主工作区 |
| UI-LA-004 | **容器溢出隐藏** | engine, website | auto | 🟡 warning | 扫描 `overflow: hidden` 是否裁剪了必要内容（底部操作栏、下拉菜单） |
| UI-LA-005 | **列表/卡片对齐** | engine, website, admin | manual | 🔵 suggestion | 检查列表行高、卡片间距、表头对齐是否一致 |
| UI-LA-006 | **空态布局** | engine, website, admin | auto + manual | 🔴 blocking | **Auto preflight**：扫描列表/搜索结果页缺少空态组件（Vue 模板同时有 `v-if` 数据分支和空态分支）。**Manual review**：空态应有独立 block 布局（`v-if` 空态分支与数据态分支并列独立；wrapper `margin` 统一间距 ≥16px；充足 `padding` ≥16px；文字居中；隐藏标题避免「有标题无内容」）；禁止仅在数据态内嵌一行小字冒充空态。**单位说明**：原 kangdou 用 rpx（≥20rpx/≥24rpx），luban 统一 px/rem（≥16px） |

### B. 色彩/Token（Color & Token）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-CT-001 | **色彩硬编码** | engine, website | auto | 🔴 blocking | 扫描 `.vue`/`.tsx` 文件中 `color: #`/`background: #` 是否在 luban-ui token 列表之外（除外：`#fff`/`#000`/`transparent`/`currentColor`/`inherit`）。token 白名单来自 `scripts/check-design-tokens.mjs` 的 `TOKEN_COLORS_HEX` |
| UI-CT-002 | **Token 合规** | engine, website | auto | 🔴 blocking | 运行 `node scripts/check-design-tokens.mjs` 扫描违规计数 |
| UI-CT-003 | **品牌色误用** | engine, website, admin | manual | 🟡 warning | 检查非品牌场景是否错误使用品牌色（如列表项背景用了 `--lb-color-primary`） |
| UI-CT-004 | **对比度** | engine, website | hybrid | 🟡 warning | 检查文本前景色与背景色的对比度是否满足 WCAG AA（文字 <18px 需 ≥4.5:1，≥18px 需 ≥3:1） |
| UI-CT-005 | **语义色不当（管理端）** | admin | manual | 🟡 warning | 检查 tag/badge 类型选择是否语义正确（成功=green、警告=orange、危险=red、信息=blue） |

### C. 排版（Typography）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-TY-001 | **字号 Token 外** | engine, website | auto | 🟡 warning | 扫描 CSS 中 `font-size` 值是否在 luban-ui 预定义字号 token 列表之外 |
| UI-TY-002 | **行高缺失** | engine, website | auto | 🟡 warning | 扫描多行文本容器缺少 `line-height` 设置 |
| UI-TY-003 | **文案截断** | engine, website, admin | auto | 🔵 suggestion | 扫描列表/卡片中单行文本是否缺少 `text-overflow: ellipsis` |
| UI-TY-004 | **文案溢出容器** | engine, website | manual | 🟡 warning | 检查中文长文本在固定宽高容器内是否溢出（无 `word-break`/`overflow-wrap`） |
| UI-TY-005 | **管理端枚举中文** | admin | auto | 🔴 blocking | 扫描列表列是否使用英文枚举值作为主文案，未映射为中文 |

### D. 间距（Spacing）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-SP-001 | **间距 Token 外** | engine, website | auto | 🟡 warning | 扫描 `margin`/`padding` 值是否在 luban-ui 预定义间距 token 列表之外（待确认刻度，参考 4/8/12/16/20/24/32/40px） |
| UI-SP-002 | **列表项间距不一致** | engine, website, admin | manual | 🟡 warning | 检查同一列表中相邻项的 `margin-bottom`/`gap` 是否一致 |
| UI-SP-003 | **表单间距（管理端）** | admin | manual | 🔵 suggestion | 检查表单项之间的间距是否一致 |
| UI-SP-004 | **卡片内边距** | engine, website | hybrid | 🟡 warning | **Auto preflight**：扫描 `.vue` 文件中卡片类元素是否使用了 luban-ui 的 padded modifier 或自带 `padding` 声明。**Manual review**：检查同类型卡片的 `padding` 是否一致且符合 luban-ui 卡片 padding token（待确认，参考 16-24px）。**变更**：原 kangdou 检查 `kd-glass-card`，luban 改为 luban-ui 卡片类（具体类名待回填） |

### E. 组件使用（Component Usage）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-CU-001 | **表格未指定列宽（管理端）** | admin | auto | 🟡 warning | 扫描表格列组件缺少 `width`/`min-width` 属性 |
| UI-CU-002 | **表单缺少校验（管理端）** | admin | auto | 🟡 warning | 扫描表单项缺少校验规则或 `prop`/`name` 属性 |
| UI-CU-003 | **表单按钮定位（管理端）** | admin | manual | 🟡 warning | 检查表单底部按钮是否固定（查询条件变化时需在表单内，纯操作类在底部固定） |
| ~~UI-CU-004~~ | ~~小程序组件注册缺失~~ | ~~miniprogram~~ | ~~auto~~ | ~~🔴 blocking~~ | **已删除**：luban 无 `pages.json`/`usingComponents` 注册机制；Vue 组件按 ESM import 即可 |
| UI-CU-005 | **弹窗层级** | engine, website, admin | manual | 🟡 warning | 检查弹窗组件是否被其他 `z-index` 元素覆盖 |
| ~~UI-CU-006~~ | ~~图片宽高/mode 缺失~~ | ~~miniprogram~~ | ~~auto~~ | ~~🟡 warning~~ | **已删除（小程序 `<image mode>`）**。Web 用 `<img>` / CSS `object-fit`，规则由 UI-CU-006' 替代 |
| UI-CU-006' | **图片尺寸/object-fit 缺失** | engine, website | auto | 🟡 warning | 扫描 `<img>` 标签缺少固定 `width`/`height` 或 CSS `object-fit`（防图片加载导致布局抖动） |
| UI-CU-007 | **骨架屏 vs 真实内容** | engine, website | hybrid | 🔴 blocking | 检查页面是否仅有 skeleton 无真实内容加载（扫描骨架组件后缺少数据渲染分支） |

### F. 响应式/适配（Responsive）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-RE-001' | **通用 safe-area（Web/SSR/PWA）** | engine, website | auto | 🟡 warning | 扫描移动 Web/PWA 固定定位元素是否设置 `env(safe-area-inset-bottom)` 兜底。**变更**：原 kangdou 小程序 safe-area 为 blocking，luban Web 场景降为 warning（Web 无原生安全区，仅为 PWA 兜底） |
| ~~UI-RE-002~~ | ~~rpx 单位~~ | ~~miniprogram~~ | ~~auto~~ | ~~🟡 warning~~ | **已删除**：luban 统一 px/rem，禁止 rpx。单位一致性由 UI-CQ-005' 覆盖 |
| ~~UI-RE-003~~ | ~~tab-bar 遮挡~~ | ~~miniprogram~~ | ~~auto~~ | ~~🔴 blocking~~ | **已删除**：luban 无原生 tab-bar |
| UI-RE-004 | **横竖屏/视口适配** | engine, website | manual | 🔵 suggestion | 检查页面在不同视口尺寸（移动/平板/桌面）下布局是否断裂 |
| UI-RE-005 | **窄屏响应式（管理端）** | admin, website | manual | 🔵 suggestion | 检查管理端页面在浏览器窗口缩小时是否布局错乱（最小宽度以下的行为） |

### G. 无障碍（Accessibility）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-AC-001 | **触控热区** | engine, website | auto | 🟡 warning | 扫描可点击元素 `min-height`/`min-width` 是否小于 44px（WCAG 最小触控区域） |
| UI-AC-002 | **aria-label 缺失** | admin, website | auto | 🔵 suggestion | 扫描 Icon-only 按钮缺少 `aria-label` 属性 |
| UI-AC-003 | **焦点顺序** | engine, website, admin | manual | 🔵 suggestion | 检查 Tab 键焦点顺序是否与视觉顺序一致 |

### H. 动效/过渡（Animation）— 🟡 主要级别

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-AN-001 | **过渡缺失** | engine, website, admin | manual | 🟡 warning | 检查路由切换、弹窗显示/隐藏、列表加载、Tab 切换时是否缺少过渡动画 |
| UI-AN-002 | **动画时间不当** | engine, website | auto | 🟡 warning | 扫描 `animation-duration`/`transition-duration` 是否过长（>500ms）或过短（<150ms）。推荐值：入场 200-300ms，退场 150-250ms |
| UI-AN-003 | **无限循环动画** | engine, website | auto | 🟡 warning | 扫描 `animation-iteration-count: infinite` 的动画是否影响用户注意力（如持续闪烁） |
| UI-AN-004 | **入场/离场动效（管理端）** | admin | manual | 🟡 warning | 检查弹窗/抽屉/下拉是否启用入场/离场过渡，禁止突兀地出现/消失 |
| UI-AN-005 | **列表加载动效** | engine, website, admin | manual | 🟡 warning | 检查列表数据加载/刷新时是否有加载动效（骨架屏渐入/列表项逐条出现），禁止数据突然填充 |
| UI-AN-006' | **路由转场动效（Web）** | website | manual | 🟡 warning | 检查 Web 路由切换是否有转场动效（Vue Router transition / View Transitions API）。**变更**：原 kangdou 检查 `uni.navigateTo`，luban 改 Web 路由 |
| UI-AN-007 | **按钮点击反馈** | engine, website, admin | auto | 🟡 warning | 扫描按钮点击后是否有 `:active`/`hover`/`opacity` 状态变化，禁止无任何交互反馈的按钮 |
| UI-AN-008' | **共享元素过渡（Web）** | website | manual | 🟡 warning | 检查列表→详情跳转时，卡片/图片是否有共享元素过渡（View Transitions API），禁止生硬的全屏刷新。**变更**：原 kangdou 检查小程序共享元素，luban 改 Web |
| UI-AN-009 | **加载状态动效** | engine, website, admin | manual | 🟡 warning | 检查加载中状态是否有动画指示（< 1s 用 skeleton 渐入，> 1s 用 loading spinner），禁止白屏/静态占位 |
| UI-AN-010 | **动效性能** | engine, website | auto | 🟡 warning | 扫描动画属性是否使用 `transform`/`opacity`（GPU 加速）而非 `width`/`height`/`top`/`left`（触发重排） |

### I. CSS 质量（CSS Quality）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-CQ-001 | **!important 滥用** | engine, website, admin | auto | 🟡 warning | 扫描 CSS 中 `!important` 使用次数，超过阈值（>5 次/文件）提示规范性问题 |
| UI-CQ-002 | **CSS 特异性过高** | engine, website, admin | auto | 🟡 warning | 扫描选择器层级过深（>4 层嵌套或 >3 个组合选择器），建议重构 |
| UI-CQ-003 | **CSS 变量命名规范** | engine, website, admin | auto | 🟡 warning | 扫描自定义 CSS 变量是否符合命名规范（`--lb-*` luban 前缀，**前缀待确认**），禁止随意命名 |
| UI-CQ-004 | **内联样式泛滥** | engine, website, admin | auto | 🟡 warning | 扫描模板中 `style=` 内联样式使用频率，超过阈值提示抽取为 class |
| UI-CQ-005' | **单位一致性** | engine, website | auto | 🔴 blocking | 扫描 luban 中混用 `px` 和 `vh`/`vw`/`%`/`rem` 做容器尺寸导致不一致；要求项目内统一单位策略（px 或 rem 二选一为容器基准）。**变更**：原 kangdou 要求统一 rpx，luban 统一 px/rem |
| UI-CQ-006 | **冗余 CSS** | engine, website, admin | auto | 🔵 suggestion | 检测未使用的 CSS 类定义（需 AST 扫描） |

### J. 动效进阶（Animation Advanced）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-AA-001 | **prefers-reduced-motion** | engine, website, admin | auto | 🟡 warning | 扫描动画/过渡是否响应 `prefers-reduced-motion: reduce` 媒体查询，无障碍必检项 |
| UI-AA-002 | **过渡缓动函数一致性** | engine, website, admin | auto | 🟡 warning | 扫描 `transition-timing-function` 是否使用统一缓动曲线，禁止混用随意值 |
| UI-AA-003 | **微交互缺失** | engine, website, admin | manual | 🟡 warning | 检查 hover/active/focus 状态是否有微交互反馈（缩放/颜色变化/阴影升起） |
| UI-AA-004 | **过渡分组协调** | engine, website | manual | 🟡 warning | 检查同一元素多属性过渡时 `transition` 是否统一设置，防止过渡时间不一致造成视觉割裂 |
| UI-AA-005 | **will-change 使用不当** | engine, website | auto | 🟡 warning | 扫描 `will-change` 是否在非必要时使用，禁止滥用导致性能问题 |
| UI-AA-006 | **requestAnimationFrame 使用** | engine, website | auto | 🔵 suggestion | 扫描 JS 驱动的动画是否使用 `requestAnimationFrame` 而非 `setInterval`/`setTimeout` 驱动 |

### K. 滚动与交互（Scroll & Interaction）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-SI-001 | **粘性定位溢出** | engine, website, admin | auto | 🟡 warning | 扫描 `position: sticky` 元素的父容器是否有 `overflow: hidden`/`auto`/`scroll`（会破坏 sticky 效果） |
| UI-SI-002 | **滚动条样式一致性（管理端）** | admin | auto | 🟡 warning | 扫描 `::-webkit-scrollbar` 自定义滚动条是否全局统一，禁止逐组件单独定制 |
| UI-SI-003 | **平滑滚动** | engine, website, admin | auto | 🟡 warning | 扫描 `scroll-behavior: smooth` 是否在页面级或容器级设置，生硬跳转体验差 |
| UI-SI-004 | **Toast/Snackbar 规范（管理端）** | admin | manual | 🟡 warning | 检查 Toast/通知组件的位置（推荐顶部居中）、持续时间（3-5s）、堆叠策略 |
| UI-SI-005 | **弹窗背景锁滚动（管理端）** | admin | auto | 🔴 blocking | 检查弹窗组件打开时 `body` 是否有 `overflow: hidden` 锁滚动，禁止弹窗下层可滚动 |
| UI-SI-006' | **下拉刷新/加载更多反馈（Web）** | engine, website | manual | 🟡 warning | 检查 Web 下拉刷新/无限滚动是否有加载动画指示与 loading 状态，禁止无反馈的刷新。**变更**：原 kangdou 小程序下拉刷新，luban 改 Web 无限滚动/下拉 |

### L. 主题与视觉一致性（Theme & Visual）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-TV-001 | **深色模式就绪** | engine, website | auto | 🟡 warning | 扫描 CSS 中是否有 `prefers-color-scheme: dark` 媒体查询或使用 CSS 变量驱动的主题 |
| UI-TV-002 | **毛玻璃/背景模糊实现** | engine, website | auto | 🟡 warning | 扫描 `backdrop-filter: blur()` 是否正确实现（需有 `background` 底色），禁止纯 `opacity` 冒充 |
| UI-TV-003 | **阴影层级一致性** | engine, website | auto | 🟡 warning | 扫描 `box-shadow` 值是否在 luban-ui 预定义阴影 token 列表之外（无/浅/中/深） |
| UI-TV-004 | **圆角 token 合规** | engine, website | auto | 🟡 warning | 扫描 `border-radius` 是否在 luban-ui 预定义圆角 token 之外（待确认刻度） |
| UI-TV-005 | **渐变使用规范** | engine, website, admin | auto | 🟡 warning | 扫描 `linear-gradient`/`radial-gradient` 颜色值是否使用 luban-ui 设计 token，禁止在渐变中硬编码色值 |

### M. 字体与文本（Font & Text）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-FT-001 | **font-display 缺失** | engine, website | auto | 🟡 warning | 扫描 `@font-face` 是否设置 `font-display: swap`/`optional`/`fallback`，禁止默认 `auto` 导致 FOIT |
| UI-FT-002 | **字重不一致** | engine, website | auto | 🟡 warning | 扫描 `font-weight` 是否使用 400/500/600/700 规范值，禁止 300/800/900 等非常用字重 |
| UI-FT-003 | **宽度/粗细 font 属性混用** | engine, website, admin | auto | 🟡 warning | 扫描 `font-stretch`/`font-variant` 等非核心 font 子属性是否被误用 |

### N. 触控与手势（Touch & Gesture）

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-TG-001 | **触控热区过小** | engine, website | auto | 🟡 warning | 扫描可点击元素（绑定了 `@click`/`onclick`）的尺寸是否小于 44x44px（WCAG 最小触控目标） |
| UI-TG-002 | **滑动冲突** | engine, website | manual | 🟡 warning | 检查页面内横向滑动组件是否与页面纵向滚动冲突 |
| UI-TG-003 | **长按/右键菜单** | engine, website, admin | manual | 🔵 suggestion | 检查列表/画布中是否可长按/右键弹出更多操作（行业惯例），未实现则建议增强。**变更**：原 kangdou 小程序长按，luban 改 Web 长按/右键 contextmenu |

### O. 平台特有（Platform Specific）

> **变更**：原 kangdou O 分类 4 条中 3 条为小程序专属（nvue/webview、自定义导航栏/胶囊、安全区全量），均已删除。luban 保留通用 `::selection` 一条，其余平台特有由多端一致性规则覆盖。

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| ~~UI-PS-001~~ | ~~Nvue/Webview 渲染一致性~~ | ~~miniprogram~~ | ~~manual~~ | ~~🟡 warning~~ | **已删除**：luban 不使用 nvue/webview 双渲染 |
| ~~UI-PS-002~~ | ~~自定义导航栏/胶囊兼容~~ | ~~miniprogram~~ | ~~hybrid~~ | ~~🟡 warning~~ | **已删除**：luban 无微信胶囊按钮 |
| ~~UI-PS-003~~ | ~~安全区适配全量（小程序）~~ | ~~miniprogram~~ | ~~auto~~ | ~~🔴 blocking~~ | **已删除（小程序部分）**：通用 safe-area 已合并入 UI-RE-001' |
| UI-PS-004 | **占位符选中样式定制** | admin, website | auto | 🔵 suggestion | 扫描 `::selection` 自定义选中颜色是否与品牌色一致 |
| UI-PS-005' | **多端渲染一致性** | engine, website, client | manual | 🔴 blocking | 物料/页面在 Web SSR / electron / flutter webview 中渲染一致（见 `.agents/rules/luban-multi-client-consistency.md`）。**新增（luban 化）**：替代被删除的小程序专属项，体现 luban 多端核心约束 |

### P. 低代码引擎专有（Low-code Engine）— 🆕 luban 新增分类

> **新增说明**：luban 是低代码平台，原 kangdou 71 条规则无引擎专有维度。本分类新增 6 条，对应「低代码引擎六维」。

| ID | 规则 | 技术栈 | 检测方式 | 严重度 | 检查方法 |
|----|------|--------|---------|--------|---------|
| UI-LC-001 | **物料 props schema 合规** | engine | auto | 🔴 blocking | 扫描物料 props 是否符合 `.agents/rules/luban-material-schema.md`（类型/必填/枚举/默认值）；缺失 schema 或 schema 与 props 不一致 → 阻断 |
| UI-LC-002 | **画布选中/属性面板联动** | engine | hybrid | 🔴 blocking | 检查画布选中物料后属性面板是否正确加载对应字段；属性改动是否即时反映到画布；联动断裂 → 阻断 |
| UI-LC-003 | **预览与发布渲染一致** | engine | manual | 🔴 blocking | 检查预览态与发布态是否使用同一渲染器；不一致会导致「预览能看到、发布后消失」→ 阻断 |
| UI-LC-004 | **物料拖拽链路完整** | engine | hybrid | 🟡 warning | 检查物料区拖出 → 画布放置 → 属性配置 → 预览整链路；中间断链 → warning（核心物料断链升 blocking） |
| UI-LC-005 | **schema 版本化与回滚** | engine | manual | 🟡 warning | 检查发布 schema 是否版本化；是否可回滚到上一版本；版本列表是否可见 |
| UI-LC-006 | **渲染异常降级** | engine | manual | 🔴 blocking | 检查物料加载失败 / schema 校验失败 / 渲染异常时是否有错误边界 + 占位 + 可重试，禁止白屏 |

### 与技术栈的关系（luban 重映射后）

```
engine（TS 低代码引擎渲染器）:
  启用规则：LA-001/004/006, CT-001/002/004, TY-001/002/004, SP-001/004, CU-005/006'/007, RE-001'/004, AC-001, AN-001/002/003/005/007/009/010, CQ-001/002/003/004/005'/006, AA-001/002/003/004/005/006, SI-001/003/006', TV-001/002/003/004, FT-001/002, TG-001/002/003, PS-005', LC-001/002/003/004/005/006
  专有检查：物料 schema、画布联动、预览发布一致、拖拽链路、版本回滚、渲染异常降级

website（SSR 站点 + Web 渲染产物）:
  启用规则：LA-001/003/004/006, CT-001/002/003/004, TY-001/002/003/004/005, SP-001/002/004, CU-005/006'/007, RE-001'/004/005, AC-001/002/003, AN-001/002/003/005/006'/007/008'/009/010, CQ-001/002/003/004/005'/006, AA-001/002/003/004/005/006, SI-001/003/006', TV-001/002/003/004/005, FT-001/002/003, TG-001/002/003, PS-004/005'
  专有检查：Web 路由转场、共享元素过渡、窄屏响应式

admin（管理端）:
  启用规则：LA-003/005/006, CT-003/005, TY-003/005, SP-002/003, CU-001/002/003/005, RE-005, AC-002/003, AN-001/004/005/007/009, CQ-001/002/003/004/006, AA-001/002/003, SI-001/002/003/004/005, TV-005, FT-003, PS-004
  专有检查：表格列宽、表单校验、通栏布局、枚举中文映射、弹窗入场动效、Toast/Snackbar 规范、弹窗锁滚动、滚动条一致性

generic（通用，多栈共用）:
  启用规则：LA-005, CT-004, TY-003/004, SP-002, CU-005, AC-003, AN-001/005/007/009, CQ-001/002/003/004/006, AA-001/002/003, SI-001/003, TV-005, FT-003
  专有检查：文案截断、flex 溢出、对比度、按钮反馈、列表加载动效

client（electron/flutter 多端）:
  启用规则：PS-005'（多端渲染一致性为主），其余按渲染宿主归入 engine/website
```

### 规则统计（luban 化后）

> kangdou 原文统计表标称「总计 71」，但其 15 个分类小计逐项相加实际为 78（kangdou 原文内部不一致）。luban 迁移以**逐分类实际规则数**为准：删除 7 条小程序专属 + 新增 7 条（PS-005' + LC-001~006），改造 6 条（编号带 '，1 换 1 不改变计数）。**luban 新总数 = 78**。

| 分类 | kangdou 原数 | luban 数 | 变化 | 说明 |
|------|-------------|---------|------|------|
| A-布局 | 6 | 5 | −1 | 删 LA-002（tab-bar 遮挡） |
| B-色彩/Token | 5 | 5 | 0 | 不变 |
| C-排版 | 5 | 5 | 0 | 不变 |
| D-间距 | 4 | 4 | 0 | SP-004 描述更新（kd-glass-card→luban-ui 卡片类） |
| E-组件使用 | 7 | 6 | −1 | 删 CU-004（组件注册），CU-006 改 CU-006'（object-fit） |
| F-响应式 | 5 | 3 | −2 | 删 RE-002（rpx）、RE-003（tab-bar），RE-001 改 RE-001'（通用 safe-area） |
| G-无障碍 | 3 | 3 | 0 | 不变 |
| H-动效 | 10 | 10 | 0 | AN-006'（Web 路由）、AN-008'（Web 共享元素）改造 |
| I-CSS 质量 | 6 | 6 | 0 | CQ-005' 改造（px/rem 一致） |
| J-动效进阶 | 6 | 6 | 0 | 不变 |
| K-滚动交互 | 6 | 6 | 0 | SI-006' 改造（Web 下拉刷新） |
| L-主题视觉 | 5 | 5 | 0 | 不变 |
| M-字体文本 | 3 | 3 | 0 | 不变 |
| N-触控手势 | 3 | 3 | 0 | TG-003 描述 Web 化（contextmenu） |
| O-平台特有 | 4 | 2 | −2 | 删 PS-001/002/003（nvue/胶囊/safe-area 全量），PS-004 技术栈扩 admin+website |
| P-低代码引擎专有（🆕） | 0 | 6 | +6 | LC-001~006（六维） |
| 新增（非分类内） | — | 1 | +1 | PS-005'（多端渲染一致性，归 O 分类已计入） |
| **总计** | **78** | **78** | **0** | 删 7 + 新增 7，净变化 0 |

> 严重度分布（luban）：blocking 11 · warning 45 · suggestion 11 · 改造/新增的严重度见各规则行。
> **注**：kangdou 原文「总计 71」与其分类小计（6+5+5+4+7+5+3+10+6+6+6+5+3+3+4=78）矛盾，属 kangdou 原文笔误。luban 沿用实际计数 78，规则覆盖完整（71 条 kangdou 规则全部处理 + 7 条新增）。

---

## 输出模板（rubric，必须沿用标题）

<!-- LOAD: rubric-template.md, 所有审查 → 按模板逐章输出 -->
必须逐行遵循 [`rubric-template.md`](rubric-template.md) 的模板结构，不得省略或合并章节。各节的「不适用」须注明理由。

---

## 与 luban UI 的协作方式

当审查涉及视觉或组件样式时，在报告中加一小节 **「视觉规范对照」**：列出疑虑点并注明「请以 `ui-spec-enforcer`＋`docs/UI_SPEC.md` 逐条核对」，**不**在本文重复 token 表。

UI 样式检查体系的 78 条规则（布局、色彩、排版、间距、组件、响应式、动效、CSS 质量、动效进阶、滚动交互、主题视觉、字体文本、触控手势、平台特有、低代码引擎专有）由本 skill 内置执行，分为 preflight/analysis/review 三阶段，按技术栈适配。

---

## 71 条规则逐条处理记录（迁移审计）

> 本节为 kangdou 78 条（原文标称 71，逐分类相加实为 78）→ luban 78 条的逐条审计，确保零规则丢失。三分类：**保留**（技术栈重映射，编号不变）/ **改造**（编号加 '，描述 luban 化）/ **删除**（小程序专属，luban 不适用）。

### 删除（11 条，均为小程序专属）

| kangdou ID | 原规则 | 删除理由 |
|-----------|--------|----------|
| UI-LA-002 | Fixed 定位遮挡（小程序 tab-bar） | luban 无原生 tab-bar |
| UI-CU-004 | 小程序组件注册缺失（`pages.json`/`usingComponents`） | luban 用 ESM import，无注册机制 |
| UI-RE-002 | rpx 单位 | luban 统一 px/rem，禁止 rpx |
| UI-RE-003 | tab-bar 遮挡 | luban 无原生 tab-bar |
| UI-PS-001 | Nvue/Webview 渲染一致性 | luban 不用 nvue/webview 双渲染 |
| UI-PS-002 | 自定义导航栏/胶囊按钮兼容 | luban 无微信胶囊 |
| UI-PS-003 | 安全区适配全量（小程序，含弹窗/Sheet/ActionSheet） | 小程序部分删除；通用 safe-area 合并入 UI-RE-001' |
| （隐含）小程序图片 `mode` 属性（UI-CU-006 原文） | — | 改造为 Web `<img>` object-fit（见 UI-CU-006'，非纯删除） |

> 注：UI-CU-006 原文为「图片宽高缺失 + mode」，其中 mode 部分删除、宽高部分保留并改造为 UI-CU-006'，故记为「改造」而非「删除」。纯删除为 6 条（LA-002/CU-004/RE-002/RE-003/PS-001/PS-002/PS-003 = 7 条）。

**修正：纯删除 = 7 条**（UI-LA-002、UI-CU-004、UI-RE-002、UI-RE-003、UI-PS-001、UI-PS-002、UI-PS-003）。

### 改造（编号加 '，共 8 条）

| kangdou ID | luban ID | 改造内容 |
|-----------|----------|----------|
| UI-LA-006 | UI-LA-006 | 单位 rpx → px（≥16px）；技术栈 miniprogram,operation-backend → engine,website,admin |
| UI-CU-006 | UI-CU-006' | 小程序 `<image mode>` → Web `<img>` + `object-fit` |
| UI-RE-001 | UI-RE-001' | 小程序 safe-area blocking → Web/PWA 通用 safe-area warning |
| UI-AN-006 | UI-AN-006' | `uni.navigateTo` 转场 → Web 路由 transition / View Transitions API |
| UI-AN-008 | UI-AN-008' | 小程序共享元素过渡 → Web View Transitions API |
| UI-CQ-005 | UI-CQ-005' | 统一 rpx → 统一 px/rem |
| UI-SI-006 | UI-SI-006' | 小程序下拉刷新 → Web 无限滚动/下拉 |
| UI-TG-003 | UI-TG-003 | 描述 Web 化（长按 → 长按/右键 contextmenu），编号不变（描述性改造） |
| UI-SP-004 | UI-SP-004 | `kd-glass-card` → luban-ui 卡片类（待回填类名），编号不变 |
| UI-PS-004 | UI-PS-004 | 技术栈 operation-backend → admin,website，编号不变 |

> 编号加 ' 的共 7 条（LA-006 描述内单位改造但编号未变，归入「保留+描述更新」）。严格编号带 ' 的：CU-006'、RE-001'、AN-006'、AN-008'、CQ-005'、SI-006' = 6 条带 '；LA-006/SP-004/TG-003/PS-004 为编号不变仅描述/技术栈更新。

### 新增（7 条）

| luban ID | 新增内容 |
|----------|----------|
| UI-CU-006' | 见改造（原 CU-006 拆分，mode 部分删除，宽高/object-fit 部分作为新规则） |
| UI-PS-005' | 多端渲染一致性（替代删除的 PS-001/002/003，体现 luban 多端核心约束） |
| UI-LC-001 | 物料 props schema 合规 |
| UI-LC-002 | 画布选中/属性面板联动 |
| UI-LC-003 | 预览与发布渲染一致 |
| UI-LC-004 | 物料拖拽链路完整 |
| UI-LC-005 | schema 版本化与回滚 |
| UI-LC-006 | 渲染异常降级 |

> 纯新增 = 7 条（CU-006' 与 PS-005' 算「改造衍生」也可计入新增；LC-001~006 = 6 条纯新增）。统计口径：6 条 LC 纯新增 + 1 条 PS-005' 新增 = 7 条新增。

### 保留（技术栈重映射，编号不变，共 57 条）

A 分类：LA-001、LA-003、LA-004、LA-005（4 条，LA-006 描述更新但归保留）
B 分类：CT-001、CT-002、CT-003、CT-004、CT-005（5 条）
C 分类：TY-001、TY-002、TY-003、TY-004、TY-005（5 条）
D 分类：SP-001、SP-002、SP-003、SP-004（4 条，SP-004 描述更新）
E 分类：CU-001、CU-002、CU-003、CU-005、CU-007（5 条；CU-004 删除、CU-006 改造）
F 分类：RE-004、RE-005（2 条；RE-001 改造、RE-002/003 删除）
G 分类：AC-001、AC-002、AC-003（3 条）
H 分类：AN-001、AN-002、AN-003、AN-004、AN-005、AN-007、AN-009、AN-010（8 条；AN-006/008 改造）
I 分类：CQ-001、CQ-002、CQ-003、CQ-004、CQ-006（5 条；CQ-005 改造）
J 分类：AA-001、AA-002、AA-003、AA-004、AA-005、AA-006（6 条）
K 分类：SI-001、SI-002、SI-003、SI-004、SI-005（5 条；SI-006 改造）
L 分类：TV-001、TV-002、TV-003、TV-004、TV-005（5 条）
M 分类：FT-001、FT-002、FT-003（3 条）
N 分类：TG-001、TG-002、TG-003（3 条；TG-003 描述更新）
O 分类：PS-004（1 条；PS-001/002/003 删除）

**保留小计**：4+5+5+4+5+2+3+8+5+6+5+5+3+3+1 = **64 条**（含描述/技术栈更新但编号未变的）。

### 总数校验

- kangdou 原文标称「71」，但 15 分类小计逐项相加为 **78**（kangdou 原文笔误）。
- luban 删除：7 条（LA-002、CU-004、RE-002、RE-003、PS-001、PS-002、PS-003）
- luban 新增：7 条（PS-005'、LC-001、LC-002、LC-003、LC-004、LC-005、LC-006）
- luban 改造（编号带 '，1 换 1 不改变计数）：6 条（CU-006'、RE-001'、AN-006'、AN-008'、CQ-005'、SI-006'）
- luban 描述/技术栈更新（编号不变）：4 条（LA-006、SP-004、TG-003、PS-004）
- **luban 新总数 = 78 − 7 + 7 = 78 条**（逐分类相加 5+5+5+4+6+3+3+10+6+6+6+5+3+3+2+6 = 78 ✓）

---

## 修订记录

- **2026-06-14（luban 初始化）**：从 kangdou `ux-product-review/SKILL.md` 迁移并 luban 化：
  - **技术栈重映射**：`miniprogram` → `engine`/`website`；`operation-backend` → `website`/`admin`
  - **删除 7 条小程序专属规则**：UI-LA-002（tab-bar 遮挡）、UI-CU-004（组件注册）、UI-RE-002（rpx）、UI-RE-003（tab-bar 遮挡）、UI-PS-001（nvue/webview）、UI-PS-002（胶囊按钮）、UI-PS-003（小程序 safe-area 全量）
  - **改造 6 条**（编号带 '）：UI-CU-006'（图片 object-fit）、UI-RE-001'（通用 safe-area）、UI-AN-006'（Web 路由转场）、UI-AN-008'（Web 共享元素）、UI-CQ-005'（px/rem 一致）、UI-SI-006'（Web 下拉刷新）
  - **描述更新 4 条**（编号不变）：UI-LA-006（rpx→px）、UI-SP-004（kd-glass-card→luban-ui 卡片类）、UI-TG-003（长按→Web contextmenu）、UI-PS-004（技术栈扩 admin+website）
  - **新增 7 条**：UI-PS-005'（多端渲染一致性）+ UI-LC-001~006（低代码引擎六维：物料 schema/画布联动/预览发布一致/拖拽链路/版本回滚/渲染异常降级）
  - **产品交付硬约束**：删除 C 端六维/运营通栏/租户默认开/Tabbar 无条件渲染（luban 无）；新增低代码引擎六维（物料库/画布/属性配置/预览/发布/异常态）；保留禁止 MVP/需求反向验证/文档—实现全量审查/假功能排查
  - **「运营后台交互规范门禁」→「低代码编辑器交互规范」**（物料区/画布/属性面板/预览区/工具栏/发布）
  - **删除微信小程序平台合规**整节；**图标规范泛化**为 Web/引擎渲染产物
  - **规则总数**：78（kangdou 实际逐分类相加，原文标称 71 系笔误）→ 78（luban，删 7 新增 7，净变化 0）
  - 品牌色 `#2ECC71` 标注为占位，待从 luban-ui 提取确认
