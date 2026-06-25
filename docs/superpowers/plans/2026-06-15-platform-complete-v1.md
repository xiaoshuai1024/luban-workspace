---
featureId: platform-complete-v1
title: luban 低代码平台完整可交付版（设计器+物料库+留资闭环+实时协作）
status: ready
branch: feature/platform-complete-v1
upstream:
  - docs/LOWCODE_ENGINE_SPEC.md
  - docs/UI_SPEC.md
  - .agents/rules/luban-material-schema.md
  - .agents/rules/luban-lowcode-engine-quality.md
  - packages/ui/luban-ui/CLAUDE.md
依据声明: |
  本 plan 依据「/plan-template 命令内联契约（§0-§9 + 14 质量禁令 + §9 派发 + 四级门禁）」
  + .agents/skills/writing-plans/SKILL.md + docs/superpowers/PLAN_WRITING_CONTRACT.md 编写。
  docs/superpowers/PLAN_WRITING_CONTRACT.md 已由 kangdou-fullstack 适配落盘（见该文件修订记录）。
  docs/dev/SSOT-TASK-GRAPH-PLAN.md 为 meta 仓遗留 stub（不存在，实际 schema 见 docs/dev/ssot-task-graph.md）；
  scripts/verify-plan-ssot.mjs 为 stub（仅打印 TODO）。
  故 taskGraph JSON 合规性由人工保证，不宣称"校验脚本通过"。
已加载 skill: writing-plans, ux-product-review（rubric 见附录 A）
架构决策:
  - 设计器：完整档（拖拽+属性面板+大纲树+撤销重做+快捷键+多设备预览+历史版本+右键菜单+对齐辅助线）
  - 协作：Yjs CRDT（乐观并发，无页面锁），服务端并入 BFF WebSocket
  - 海报：流式布局承载（固定宽度容器+导出图片），不引入绝对定位双模式内核
  - 后端：仅 Java；Go 延后并文档标注（与硬约束 §3 的显式例外，经用户确认）
  - 物料：营销+留资+网站搭建+海报四族，约 35 个新物料
taskGraph: docs/superpowers/tasks/platform-complete-v1.json
---

# luban 低代码平台完整可交付版 · 实现计划

> 本 plan 将 luban 从「MVP 级留资 + 空壳页面编辑器」升级为生产可用、可交付终端用户的完整低代码平台。
> 范围覆盖营销页/留资页/网站搭建/海报四大场景，含完整可视化设计器、~35 新物料、CRDT/OT 实时协作、
> 留资闭环全部阻断修复、页面版本系统、测试地基与一键 docker-compose。
> 单 plan，实现跨多个会话连续推进，全部门禁全绿后方可汇报完成。

---

## §0 范围与分支策略

### 0.1 本期范围
将 luban 升级为**可交付终端用户**的完整低代码平台：

1. **完整可视化设计器**：组件面板（拖入）+ 属性面板（可视化编辑 props）+ 大纲树 + 工具栏（撤销/重做/预览/发布/多设备/右键/对齐线）+ 键盘快捷键 + 历史版本
2. **~35 个新物料**：营销族（6）+ 网站搭建族（11）+ 留资族（6）+ 海报族（5）+ 表单补全（3），每个含 Vue 组件 + propSchema + 单测 + story
3. **CRDT/OT 实时协作**：多人同编一页（Yjs），在线用户 + 远程光标，服务端并入 BFF WebSocket
4. **页面版本系统**：发布即建版本，可查看/回滚
5. **留资闭环全阻断修复**：状态机/keyword 搜索/解密查看/去重策略/captcha/表单管理 UI/LeadDetail 完善
6. **质量地基**：BFF+Website 测试框架 + docker-compose + FeatureGate + 安全加固

### 0.2 分支与阶段（对齐 GIT_WORKFLOW §〇.4–〇.5）

| 阶段 | 分支策略 |
|------|----------|
| **方案编写** | 本 plan 在 `feature/platform-complete-v1` 分支编写（主仓 + 各子模块同名） |
| **执行（大规模编码）** | luban 策略：**用户分支优先，Agent 不自动新切分支**（GIT_WORKFLOW §〇.4）。当前工作分支 `feature/platform-complete-v1`；多仓任务各子模块（engine/bff/website/ui/backend-java）用**同名分支**。**禁止**在默认分支（master/main）直接开发式提交。若用户要求切其他分支，按指令执行并在此勘误。 |
| **backend-go** | 本期不实现（仅 Java），不动其分支 |

### 0.3 taskGraph SSOT
任务图 JSON：`docs/superpowers/tasks/platform-complete-v1.json`（47 task / 5 wave / 随本 plan 同步）。校验脚本为 stub，JSON 合规性人工保证。

### 0.4 架构决策定稿（经用户确认，四轮讨论收敛；架构 Q1-Q3 第三轮敲定）
| 决策点 | 选定 | 影响 |
|--------|------|------|
| 设计器深度 | 完整档（c） | 工作量大但产品完整 |
| 协作并发模型 | 纯 CRDT（无锁） | 乐观并发，Yjs 自动合并 |
| 协作服务端承载 | 并入 BFF | 不新增子项目，复用 BFF 鉴权 |
| 海报画布 | 流式布局承载 | 内核不改造，海报容器+导出图片 |
| 后端 | 仅 Java | Go 延后，文档标注（硬约束 §3 例外） |
| 物料范围 | 四族 ~35 新 | 覆盖营销/留资/网站/海报 |

---

## §1 需求溯源与追溯矩阵

| # | 需求 | Task ID | E2E 场景 | 验收门禁 |
|---|------|---------|----------|----------|
| R1 | 完整可视化设计器（面板+属性+大纲+工具栏+快捷键） | T-eng-1~6, T-ui-1~6 | E2E-D1~D5 | G3/G4 |
| R2 | ~35 新物料可拖拽+配置+渲染 | T-ui-7~13, T-web-1 | E2E-D2, E2E-W1 | G3/G4 |
| R3 | CRDT 实时协作（同编+光标+在线状态） | T-bff-1~2, T-eng-7 | E2E-C1 | G3/G4 |
| R4 | 页面版本（发布建版本+查看+回滚） | T-be-6, T-bff-3, T-eng-8 | E2E-V1 | G3/G4 |
| R5 | 留资状态机完整 + keyword 搜索 | T-be-1, T-be-3, T-eng-10 | E2E-L1,L2 | G3 |
| R6 | LeadDetail 解密查看真实联系方式 | T-be-5, T-eng-10 | E2E-L3 | G3/G4（含安全审查） |
| R7 | 去重 OVERWRITE/MERGE 策略 + captcha | T-be-4 | (单测+IT) | G3 |
| R8 | 表单管理 UI（FormList/FormEditor） | T-eng-9, T-ui-4 | E2E-F1 | G3/G4 |
| R9 | 留资提交全量校验 + UTM 透传 | T-ui-3, T-web-2 | E2E-W2 | G3/G4 |
| R10 | BFF + Website 测试覆盖 | T-bff-5~6, T-web-4 | (单测) | G3 |
| R11 | docker-compose 一键启动 | T-cross-1 | (手动验证) | G2 |
| R12 | FeatureGate 开关 | T-be-7, T-cross-2 | (单测) | G3 |
| R13 | 安全加固（密钥/脱敏） | T-be-8 | (安全审查) | G2 安全审查 |
| R14 | 质量地基与辅助修复（事务/隔离校验/keyword 透传/响应式标题/菜单修复/控制器 IT） | T-be-2,T-be-9,T-bff-4,T-web-3,T-eng-11 | (单测+IT) | G3 |

> R1-R14 仅列功能需求与质量地基；横切验收 task（T-cross-3 E2E 全量、T-cross-4 文档更新）见 §9.6 W5 收口，不纳入功能追溯矩阵。

### 明确不做（防膨胀，继承讨论稿共识，经用户确认）
- ❌ 多端（electron/flutter/cross-platform）渲染验证（本轮仅 website）
- ❌ 组件市场/第三方物料上架/NPM 发布流程
- ❌ AI 辅助生成页面
- ❌ 完整 RBAC 细粒度权限（沿用 admin/user 二级）
- ❌ Go 后端 lead-capture/版本/协作实现（仅 Java，Java API.md + Go 文档 `luban-backend-go/docs/` **双向标注**差异）—— **与硬约束 §3 的显式例外**
- ❌ 国际化 i18n 引擎（保留 token 基础）
- ❌ 付费/计费/订阅
- ❌ 海报绝对定位双模式内核（用流式布局承载）
- ❌ 页面级悲观锁（用纯 CRDT 乐观并发）
- ❌ Flyway 迁移（沿用 schema.sql 幂等）

---

## §2 系统与链路

### 2.1 涉及子系统
| 子系统 | 角色 | 本期增量 |
|--------|------|----------|
| backend-java | 主后端 | 留资修复（状态机/keyword/解密/去重/captcha）+ page_versions 表/API + FeatureGate + 安全加固 + 控制器测试 |
| bff | API 聚合 + **协作服务端** | Yjs WebSocket 协作 + 版本 API + keyword 透传 + 测试框架 |
| engine | 管理后台 | 完整设计器接线（面板/属性/大纲/工具栏/快捷键/协作/版本）+ FormList/FormEditor + Lead 完善 |
| luban-ui | 物料库 + 设计器内核 | 属性面板/撤销重做/校验引擎/大纲树 + ~35 新物料 + propSchema 补全 |
| website | 访客渲染 | 渲染全物料 + 留资校验完善 + 海报 SSR + 测试框架 |
| backend-go | ❌不涉及 | 仅文档标注差异，不实现 |
| client/* | ❌不涉及 | 规划态 |

### 2.2 端到端链路

**链路 D：可视化页面搭建（核心）**
```
管理员进入 PageEditor（designMode=true）
  → 左栏组件面板 getPaletteGroups() → 拖拽 LubanText 到画布
  → DesignRenderer 接收 drop → emit add-node → schema 追加节点
  → 点击节点 → emit select → 右栏 PropertyPanel 读 getComponentMeta(type).propSchema
  → 编辑 props → schema 更新 → useHistory 入栈（可撤销）
  → Ctrl+Z 撤销 / Ctrl+Shift+Z 重做
  → 多设备预览切换（PC/H5 viewport）
  → 保存 → savePage(schema) → bff → backend（published 时建 page_version）
```

**链路 C：实时协作（核心）**
```
用户 A 打开 PageEditor → 前端建 Yjs Y.Doc + Y.Map(schema)
  → WebSocket 连接 wss://bff/api/collab/:siteId/:pageId
  → bff 校验 JWT + siteId 归属 → 加入房间 → 广播在线用户
  → 用户 A 改 schema → Y.Doc 本地更新 → sync 到 bff 房间
  → bff 转发给同房间用户 B → B 端 Y.Doc applyUpdate → schema 响应式更新
  → 远程光标：YAwareness 同步 caret 位置 → 画布渲染他人光标
  → 用户 B 离开 → awareness remove → 在线列表更新
```

**链路 V：页面版本**
```
管理员点「发布」→ savePage(status=published)
  → bff PUT /api/sites/:siteId/pages/:pageId {status:'published'}
  → backend 建 page_version（快照当前 schema_json + 版本号自增）
  → 历史版本 UI：GET /api/.../versions → 列表
  → 点「回滚」→ POST /api/.../versions/:v/rollback → 复制快照为当前 + 建新版本
```

**链路 L3：线索解密查看（安全敏感）**
```
管理员在 LeadDetail 点「查看完整联系方式」
  → engine GET /api/leads/:id/contact?siteId= (token)
  → bff authHeaders → backend LeadController.getContact
  → backend: RequireUser + 写 audit_log（who/when/leadId/action=VIEW_CONTACT）
  → LeadService.decryptContact → 返回明文（仅本次响应，不缓存）
  → engine 弹窗展示（带水印/防截屏提示）
```

### 2.3 列表页分步链路

**设计器画布（PageEditor）**
1. 进入 `sites/:siteId/pages/:pageId` → 加载 schema → **画布渲染 DesignRenderer**
2. 画布空 → **空态**（"从左侧拖拽组件到此处"，dropzone 高亮）
3. 拖入组件 → schema 追加 → **节点渲染 + 选中态高亮**
4. 选中节点 → 右栏属性面板加载 → 编辑 props → 画布实时更新
5. 撤销 → 栈弹出 → 画布回退
6. 网络失败（保存）→ **错态**（toast + 重试）

**线索中心（LeadList）**
1. 进入 `sites/:siteId/leads` → GET → **加载态**
2. 空 → **空态**（"暂无线索"）
3. 数据 → 列表（联系人脱敏/表单/状态/渠道/时间/操作）
4. keyword 搜索 → GET(keyword) → 过滤结果
5. 点「详情」→ LeadDetail
6. 点「查看联系方式」→ 解密弹窗（链路 L3）

---

## §3 业务逻辑

### 3.1 Lead 状态机（修复后，状态穷举表）

> API.md §3.10 已声明完整状态空间（含 ASSIGNED→LOST / CONTACTING→INVALID）；现状是代码 `LeadStatusMachine.java` 漏了这两条转移。**T-be-1 仅修复代码与 API 既有契约的偏差，不扩展 API 契约。**

合法转移（与 API.md §3.10 一致）：

| from | to | 前置条件 | 后置效果 |
|------|-----|---------|---------|
| NEW | ASSIGNED | 请求带 assigneeId | assignee_id 写入 |
| NEW | INVALID | 无 | 终态 |
| ASSIGNED | CONTACTING | 无 | — |
| ASSIGNED | INVALID | 无 | 终态 |
| ASSIGNED | **LOST**（代码补齐，对齐 API.md §3.10） | 无 | 终态 |
| CONTACTING | CONVERTED | 无 | converted_at 写入，终态 |
| CONTACTING | LOST | 无 | 终态 |
| CONTACTING | **INVALID**（代码补齐，对齐 API.md §3.10） | 无 | 终态 |
| CONVERTED/INVALID/LOST | （任何） | 禁止 | 抛 LEAD_INVALID_TRANSITION (409) |

终态：CONVERTED / INVALID / LOST。同状态请求视为幂等放行。

页面 status 状态机：`draft → published`（发布建 page_version）；published 可回 draft 继续编辑。

**审计口径（统一）**：所有 Lead 状态转移写 `lead_audit_logs(action=STATUS_TRANSIT)`；解密查看写 `action=VIEW_CONTACT`（§2.2 链路 L3 + §9.3 DDL 一致）。

### 3.2 去重策略（修复 T-be-4）
| policy | 命中行为 |
|--------|----------|
| reject | 抛 LEAD_DUPLICATE (409) |
| mark | 插入新 Lead，status=invalid，dedup=true |
| overwrite | 删除旧 Lead（同 dedup_hash 窗口内），插入新 |
| merge | 旧 Lead.contact_json 合并新字段后更新 |

### 3.3 协作冲突解决（CRDT）
- schema 用 Y.Map 嵌套结构，每个节点是 Y.Map（id/type/props/children）
- props 字段级合并（Y.Map 自动 last-write-wins by client clock）
- children 用 Y.Array（支持插入/删除/移动，自动合并顺序）
- 光标/选区/在线状态用 YAwareness
- 无需手动冲突解决，Yjs 自动收敛
- **冲突示例**：A 删除节点 X 的同时 B 修改节点 X.props → Yjs 以 Y.Map 为单位合并，删除（Y.Array remove）与属性更新（Y.Map set）不冲突，最终 X 被删除（删除优先于后续孤立更新）；A、B 改 X 同一 prop → last-write-wins by client clock

### 3.4 页面版本
- 每次 `published` 状态变更 → 自增 version，快照 schema_json
- 回滚 = 复制目标版本 schema 为当前 + 建新版本（不改历史）
- 版本号单调递增，不复用

### 3.5 FeatureGate 开关
| key | 作用域 | 关闭行为 |
|-----|--------|----------|
| lead_capture | site | 表单提交返回 LEAD_DISABLED (503)，设计器隐藏留资物料族 |
| realtime_collab | site | 协作 WebSocket 拒绝连接，设计器单人模式 |
| page_versioning | site | 发布不建版本，历史版本 UI 隐藏 |
| poster_export | site | 海报导出按钮隐藏 |

---

## §4 页面结构与交互链路

### §4 文首：主路径、UX 选型与枚举显示

**主路径概要**：见 §2.2 四链路（搭建 D / 协作 C / 版本 V / 解密 L3）。加载/空/错态见各页 §4.3。

**UX 组件选型**（对齐 `.agents/rules/luban-frontend-ux-enum.md`）：
- 集合选择项（线索状态、表单状态、去重策略、物料分类）一律用 `ElSelect`，禁止 `ElInput`
- 日期/时间用 `ElDatePicker` / `ElTimePicker`（留资物料族 T-ui-9 含日期选择）
- 布尔开关用 `ElSwitch`
- 设计器物料面板分组用折叠列表 + 搜索 `ElInput`（搜索非枚举，可用 Input）

**枚举值显示方案**（禁止裸英文）：
- Lead 状态：复用 `LEAD_STATUS_LABELS`（new→新线索…）+ `LEAD_STATUS_COLORS`（ElTag type）
- Form status：`active/disabled` → 中文映射 `{active:'启用', disabled:'禁用'}`
- 去重策略：`reject/mark/overwrite/merge` → `{reject:'拒绝', mark:'标记', overwrite:'覆盖', merge:'合并'}`
- 物料分类：palette category `信息/表单` → 扩展 `营销/表单/网站/海报`

### §4.0 入口表与按系统新增模块

#### 4.0a 页面入口表
| 页面 | 路由 | 子系统 | 角色 |
|------|------|--------|------|
| 页面编辑器（设计器） | `sites/:siteId/pages/:pageId` | engine | 管理员搭建 |
| 新建页面 | `sites/:siteId/pages/new` | engine | 管理员新建 |
| 表单列表 | `sites/:siteId/forms` | engine | 管理员留资管理 |
| 表单编辑器 | `sites/:siteId/forms/:id` | engine | 管理员配置表单 |
| 线索列表 | `sites/:siteId/leads` | engine | 管理员线索中心 |
| 线索详情 | `sites/:siteId/leads/:id` | engine | 管理员跟进 |
| 访客动态页 | `/:site/:path*` | website | 访客浏览/提交 |
| 海报页 | `/:site/poster/:slug` | website | 访客查看/导出海报 |

#### 4.0b 按系统新增功能模块表（MUST）

| 系统 / 仓库 | 新增模块或承载物 | 职责简述 | 任务 id |
|-------------|------------------|----------|---------|
| `packages/ui/luban-ui` (luban-base) | ~35 新物料组件（营销6/网站11/留资6/海报5/表单3+海报导出） | 物料库扩展 | T-ui-7~11 |
| `packages/ui/luban-ui` (luban-low-code) | PropertyPanel / useHistory / validateAll / OutlineTree + LubanForm propSchema 补全 | 设计器内核 | T-ui-1~6 |
| `packages/ui/luban-ui` | registry/palette/componentMeta 全量注册 + 导出 | 物料注册 | T-ui-12 |
| `packages/engine/luban` | PageEditor designMode 接线 + 组件面板/属性面板/大纲树/工具栏/快捷键/协作UI/版本UI + FormList/FormEditor | 管理后台 | T-eng-1~11 |
| `packages/bff/luban-bff` | WebSocket 协作服务（y-websocket）+ 版本 API 路由 + keyword 透传 + 测试 | API 聚合+协作 | T-bff-1~6 |
| `packages/backend/luban-backend` | page_versions 表/API + FeatureGate + 解密查看 API + 状态机/去重/captcha 修复 + 安全加固 | 主后端 | T-be-1~9 |
| `packages/web/luban-website` | 全物料渲染 + 留资校验完善 + 海报页 + 测试 | 访客渲染 | T-web-1~4 |
| `packages/backend/luban-backend-go` | **本特性不涉及**（用户确认仅 Java，Go 延后并文档标注） | — | — |
| `packages/client/*` | **本特性不涉及**（规划态，多端延后） | — | — |
| 跨系统 | docker-compose + FeatureGate 前端消费 + E2E + 文档 | 基础设施 | T-cross-1~4 |

#### 4.0c 设计器布局（PageEditor 改造后）
```
┌─────────────────────────────────────────────────────────────┐
│ 工具栏：[撤销][重做] | [PC][H5] | [预览][发布] | [协作●3在线] │
├──────────┬────────────────────────────────┬─────────────────┤
│ 组件面板  │         画布（DesignRenderer）   │  属性面板/大纲   │
│          │                                │  ──[属性][大纲]──│
│ ▸ 营销    │  ┌──────────────────────────┐  │  字段名: [____] │
│  倒计时   │  │  [选中的节点 ◀ 高亮]      │  │  标签:  [____]  │
│  优惠券    │  │                          │  │  必填:  [☐]     │
│ ▸ 表单    │  │  [其他节点]               │  │  ...            │
│  输入框   │  └──────────────────────────┘  │                 │
│  手机号   │   (空态: 拖拽组件到此处)        │  大纲:           │
│ ▸ 网站    │                                │  ├ root         │
│  图片     │   [远程光标 👤A @pos]          │  │  ├ Text#1     │
│  标题     │                                │  │  └ Form#2     │
│ ▸ 海报    │                                │  │     ├ Input   │
│  海报容器  │                                │                 │
│ (搜索框)  │                                │                 │
├──────────┴────────────────────────────────┴─────────────────┤
│ 底部状态栏：未保存改动 | 上次保存 10:30 | 版本 v3            │
└─────────────────────────────────────────────────────────────┘
```
- **左栏组件面板**：分组（营销/表单/网站/海报）+ 搜索 + 可拖拽项（T-eng-2）
- **画布**：DesignRenderer，节点 hover/选中高亮，dropzone，远程光标，对齐辅助线（T-eng-1/T-eng-5）
- **右栏**：Tab 切换「属性」（PropertyPanel 消费 propSchema）/「大纲」（OutlineTree 树形）（T-eng-3/T-eng-4）
- **工具栏**：撤销/重做/多设备/预览/发布/协作在线数（T-eng-5）
- **空态**：画布无节点时显示 dropzone 引导
- **错态**：保存失败 toast + 重试；协作断线状态栏提示

### §4.1 UX 自检摘要（对齐 ux-product-review rubric）

**阻断**（须先解决再大规模编码）：
- 无。范围经四轮讨论收敛，架构决策（协作/海报/分支）已定。

**强烈建议**：
- 设计器画布交互密度高（拖拽+选中+属性+大纲+协作光标叠加），实现前用 §4.0c 线框 + §4.2 分步链约束；若实现中发现仍不可稳定约束，补高保真原型（隔离路由，禁用 `pages/e2e/*` 长期宿主）
- 管理后台枚举全走中文映射（§4 文首），已对照 `luban-frontend-ux-enum.md`
- LeadDetail 解密查看属敏感操作，须二次确认 + 审计日志 + 防截屏提示

**可选**：
- 设计器右键菜单可后续扩展（复制/粘贴/置顶/置底）
- 协作光标颜色按用户 hash 分配

（完整 rubric 对照见附录 A）

### §4.2 关键交互链路（列表级，§4.2 级分步）

**D1：拖拽搭建（核心）**
1. 左栏按住「输入框」拖动 → dragstart 设 dataTransfer
2. 拖到画布 dropzone → dragover 高亮 → drop
3. DesignRenderer emit add-node(type) → PageEditor 调 addNode(schema, type)
4. schema.children 追加新节点（id=uuid, defaultProps from componentMeta）
5. useHistory.push(snapshot) → 画布渲染新节点 + 自动选中
6. 右栏属性面板加载该节点 propSchema

**D2：属性编辑**
1. 点击节点 → emit select(nodeId) → selectedNodeId 更新
2. 右栏 PropertyPanel 读 getComponentMeta(type).propSchema
3. 按 propSchema 类型渲染编辑器（string→Input, select→Select, boolean→Switch, options→动态列表, json→代码框）
4. 改值 → updateNodeProps(nodeId, patch) → schema 更新 → useHistory.push
5. 画布实时反映新 props

**D3：撤销/重做**
1. Ctrl+Z → useHistory.undo() → schema 回退到上一快照
2. Ctrl+Shift+Z → useHistory.redo()
3. 工具栏按钮同步禁用态（栈空时 disabled）

**D4：协作（链路 C）**
1. 进入页面 → 建 Y.Doc + 连 WebSocket
2. 在线用户数显示在工具栏（awareness.getStates().size）
3. 他人编辑 → Y.Doc update → schema 响应更新 → 画布实时变
4. 他人光标 → awareness.caret → 画布渲染 👤 标记

**D5：多设备预览**
1. 工具栏点「H5」→ 画布容器宽度切 375px + device frame
2. 点「PC」→ 恢复 100%

**W1：访客留资提交（website DynamicPage 侧，列表级链路）**
1. 访客打开 `/:site/:path*`（published 页含 LubanForm）→ SSR 渲染表单 → **加载态**骨架
2. 表单字段渲染（含必填/格式规则）→ 访客填写 → **字段级实时校验**（错误内联提示）
3. 点提交 → `validateAll` 全量校验 → 有错误则 **拦截 + 聚焦首个错误字段**；通过则构造 payload（contact 值强制 string 化 + UTM/channelId/pageId 透传）
4. POST `/api/forms/:id/submit` → **提交中态**（遮罩"提交中…"）
5. 后端响应分支：200 成功 / 409 LEAD_DUPLICATE（重复提示）/ 429 LEAD_SPAM_BLOCKED（频繁提示）/ 503 LEAD_DISABLED（禁用提示）/ 400 校验失败（字段错误映射）
6. 成功按 `submitConfig.mode` 显示：redirect 跳转 / popup 弹窗 / toast 提示

### §4.3 逐页页面结构

**PageEditor（设计器）**：见 §4.1 线框。

**FormList（留资表单列表）**
```
┌────────────────────────────────────────────┐
│ 留资表单                    [+ 新建表单]    │
├────────────────────────────────────────────┤
│ 名称        │ 关联页面 │ 状态   │ 去重 │ 操作│
│ 春节留资    │ /spring  │ 启用   │ phone│ 编辑│
│ 试用申请    │ /trial   │ 禁用   │ email│ 编辑│
├────────────────────────────────────────────┤
│ (空态: 暂无表单，点击新建)                  │
└────────────────────────────────────────────┘
```

**FormEditor（表单配置）**
```
┌────────────────────────────────────────────┐
│ 表单名称: [___________]                     │
│ 关联页面: [选择页面 ▾]                      │
│ 状态: (○启用 ●禁用)                         │
├────────────────────────────────────────────┤
│ 字段配置 (fieldSchema.fields[])             │
│  [字段名][标签][类型▾][必填]  [↑][↓][×]    │
│  [+ 添加字段]                               │
├────────────────────────────────────────────┤
│ 提交配置 (submitConfig)                     │
│  成功行为: (○跳转 ●弹窗 ○提示)              │
│  跳转URL/弹窗标题/提示文案: [...]           │
├────────────────────────────────────────────┤
│ 去重配置                                    │
│  去重字段: [phone][email][+]                │
│  窗口: [86400]秒  策略: [reject▾]           │
├────────────────────────────────────────────┤
│ 防刷配置                                    │
│  频控: [10]次/[60]秒  验证码: [☐开启]       │
│                          [保存]             │
└────────────────────────────────────────────┘
```

**LeadDetail（解密查看增强）**
```
┌────────────────────────────────────────────┐
│ ← 返回   线索详情            [查看完整联系方式]│
├────────────────────────────────────────────┤
│ 联系人信息                  状态: [新线索]   │
│  phone: 138****8000                        │
│  name:  张*                                 │
│  (点查看完整联系方式 → 解密弹窗)             │
│ 来源表单: 春节留资   渠道: google            │
│ 分配给: [选择跟进人 ▾]   创建: 06-15 10:00  │
├────────────────────────────────────────────┤
│ 状态变更: [认领][开始跟进][标记成交][...]    │
├────────────────────────────────────────────┤
│ UTM: source=google campaign=spring_sale     │
└────────────────────────────────────────────┘
```

**解密弹窗（安全）**
```
┌──────────────────────────────┐
│ ⚠ 完整联系方式（敏感）       │
│  本次查看已记录审计日志       │
│  phone: 13812345678          │
│  name:  张三                 │
│  email: zhang@example.com    │
│            [我已知晓][关闭]   │
└──────────────────────────────┘
```

**PosterPage（访客海报页，`/:site/poster/:slug`）**
```
┌──────────────────────────────┐
│ [海报容器 1080×1920 流式渲染] │
│  ┌────────────────────────┐  │
│  │ 海报图片/文本/二维码    │  │
│  │ (流式布局, 非绝对定位)  │  │
│  └────────────────────────┘  │
│         [下载海报图片]        │
└──────────────────────────────┘
```
- SSR 渲染海报容器（固定宽度，内容流式）+ 导出按钮（html2canvas 导出 PNG）
- 空态：海报未发布 → "海报不存在"
- 错态：导出失败 → toast 重试

**错态统一约定（适用上述所有线框）**：每个列表/表单页的错态（加载失败/保存失败/权限不足）在原内容区域整页替换为「错误提示 + 重试按钮」；解密 API 403 在 LeadDetail 顶部 ElAlert 展示。具体错误场景见「错误场景清单」节。

> §4.3 线框足以约束开发，无需高保真原型。设计器画布交互复杂度高，但 §4.0c 线框 + §4.2 分步链路已可稳定约束；实现阶段若发现交互仍不可稳定约束，再补原型（禁用 `pages/e2e/*` 专测页作长期宿主）。

---

## §5 集成与复用表

| 复用物 | 来源 | 本期如何用 |
|--------|------|-----------|
| DesignRenderer | luban-low-code | 已支持容器嵌套拖拽/选中，PageEditor 接线即可 |
| componentMeta.propSchema | luban-low-code | PropertyPanel 消费，补 LubanForm 空 schema |
| getPaletteGroups | luban-low-code | 组件面板消费，新增物料自动出现 |
| LubanDesigner | luban-low-code | PageEditor 传 designMode=true |
| Sortable.js | luban-low-code | 大纲树排序复用 |
| validate/validation.ts | luban-low-code | 增强 validateAll 全表单校验 |
| LeadCryptoService | backend-java | 解密查看 API 复用 decrypt |
| AuthFilter | backend-java | 收窄 /backend/lead/forms 豁免 |
| BFF callBackend/authHeaders | bff | 协作 + 版本路由复用 |
| useLeadSubmit | website | 增强（校验+UTM+string 化） |

---

## §6 架构边界与门禁自检

### 6.1 架构边界
- **物料只存在于 luban-ui**：engine/website 通过 registry/palette 消费，不得各自实现
- **设计器内核（设计态渲染/属性面板/撤销重做）在 luban-low-code**：engine 只做接线 + 业务（保存/版本/协作 UI）
- **协作状态在 BFF WebSocket 房间**：不落 DB（Yjs 文档持久化另议，本期持久化靠页面保存触发版本快照）
- **解密查看走独立 API + 审计**：不混入 LeadResponse（列表永远脱敏）

### 6.1b 架构与 E2E 门禁自检（对齐 PLAN_WRITING_CONTRACT §6.1 三要素）

**(1) 关键行为 → E2E/稳定单测触发方式**（避免 sleep、脆弱选择器）：
| 关键行为 | 触发方式 | 稳定性保障 |
|----------|----------|-----------|
| 拖拽搭建 | Cypress `data-testid` 节点 + `trigger('drop')` | 用 testid 非 CSS 选择器 |
| 属性编辑 | 选中后断言属性面板输入框值 | 等 `getComponentMeta` 同步（nextTick） |
| 撤销/重做 | 快捷键后断言画布文本 | 无 sleep，断言 DOM 文本 |
| 协作同步 | 两 session，A 改后断言 B 画布 | 用 Yjs `update` 事件回调而非固定等待 |
| 状态机转移 | backend IT（真实 DB） | 不依赖时序 |
| 解密查看 | 断言弹窗明文 + audit_log DB 行 | DB 断言非 UI 猜测 |

**(2) 用户旅程 → 拟映射 E2E**（覆盖主路径与 P0 分支）：
| 用户旅程 | E2E spec | P0 |
|----------|----------|-----|
| 运营搭建营销页→发布 | E2E-D1/D2/D5 | 是 |
| 访客填写表单→留资提交 | E2E-W2 | 是 |
| 管理员查看线索→解密联系 | E2E-L3 | 是 |
| 两运营协作编辑同页 | E2E-C1 | 是 |
| 发布后回滚历史版本 | E2E-V1 | 是 |
| 多租户越权访问被拒 | §7.2 隔离 | 是 |

**(3) 脱敏回灌红线勾选**：
| 红线 | 状态 | 说明 |
|------|------|------|
| 列表/详情永远脱敏 | ✅ 已考虑 | LeadResponse 仅返 contactMasked |
| 解密走独立 API+审计 | ✅ 已考虑 | GET /leads/:id/contact 写 lead_audit_logs |
| 明文不进日志 | ✅ 已考虑 | GlobalExceptionHandler 500 脱敏（T-be-8） |
| 密钥强制 env | ✅ 已考虑 | LEAD_ENC_KEY 无默认值（T-be-8） |

### 6.2 门禁自检（14 质量禁令）
| # | 禁令 | 本 plan 对应 |
|---|------|-------------|
| 1 | 禁止跳过功能 | §1 R1-R13 全部有 task + E2E |
| 2 | 禁止假绿 | E2E 全真实执行，无 skip |
| 3 | 禁止占位 | 物料/面板/协作全实装，无 TODO 占位 |
| 4 | 禁止骨架交付 | 每页面含完整交互链路 |
| 5 | 禁止 JSON 替代页面 | 所有页面真实 UI |
| 6 | 页面交互完整 | §4.2 每链路有分步 + E2E 断言 |
| 7 | 验收以可交付为准 | 每特性真实页面业务链路 |
| 8 | E2E 绑定正式路由 | 无 `pages/e2e/*`，全正式路由 |
| 9 | 门禁分级 | G1-G4 表见下 |
| 10 | /luban-review 清零 | Post-Dev Workflow 含 |
| 11 | 安全审查 | G2 含敏感字段/鉴权/OWASP |
| 12 | 双后端一致 | **例外**：Go 延后，文档标注（已用户确认） |
| 13 | 多端渲染一致 | 声明：本期仅 website，多端延后 |
| 14 | FeatureGate | §3.5 四开关 |

---

## §7 E2E 测试计划

### 7.0 E2E 量化表与 P0 划分（对齐 luban-testing-coverage）

| 功能类型 | 最少用例 | P0（合并前必绿） | 已覆盖节 |
|----------|----------|------------------|----------|
| 设计器搭建+保存发布 | ≥8 | D1/D2/D3/D5 全 P0（D5=保存发布归此类目） | §7.1 |
| 实时协作 | ≥2 | C1 P0 | §7.1 |
| 页面版本 | ≥2 | V1 P0 | §7.1 |
| 留资提交 | ≥3 | W2 P0 | §7.1 |
| 线索管理 | ≥4 | L1/L2/L3 P0 | §7.1 |
| 表单管理 | ≥2 | F1 P0 | §7.1 |
| 多租户隔离 | ≥3 | 全 P0 | §7.2 |
| 多设备预览 | ≥2 | D4 P1 | §7.1 |

fixture 策略：各 E2E 自建测试数据（site/page/form/lead），用唯一前缀避免冲突，测后清理。skip 约定：仅环境硬限制可 skip，须注释原因，禁止假绿。

### 7.1 E2E 用例枚举

**E2E-D1：拖拽搭建**
| 前置 | 用例 | 断言 | 清理 |
|------|------|------|------|
| 登录+有页面 | 拖「文本」到画布 | 画布出现文本节点+自动选中 | 删节点 |
| 同上 | 拖「输入框」到表单容器 | 嵌套到 Form children | 删节点 |
| 同上 | 拖到空画布 dropzone | 节点加到 root.children | 删节点 |

**E2E-D2：属性编辑**
| 前置 | 用例 | 断言 |
|------|------|------|
| 有文本节点 | 选中→改 content | 画布文本变化 |
| 有输入框 | 选中→改 label+勾必填 | 画布标签变+必填标记 |
| 有选择框 | 选中→加选项 | 画布选项渲染 |

**E2E-D3：撤销/重做**
| 前置 | 用例 | 断言 |
|------|------|------|
| 有改动 | 改 content→Ctrl+Z | 回退原值 |
| 同上 | Ctrl+Shift+Z | 恢复 |
| 空栈 | Ctrl+Z | 无反应（按钮 disabled） |

**E2E-D4：多设备预览**
| 前置 | 用例 | 断言 |
|------|------|------|
| 设计器 | 点 H5 | 画布宽=375 |
| 同上 | 点 PC | 画布宽=100% |

**E2E-D5：保存+发布**
| 前置 | 用例 | 断言 |
|------|------|------|
| 有改动 | 点保存 | toast 成功+状态栏更新 |
| 同上 | 点发布 | 建 page_version+website 可见 |

**E2E-C1：协作**
| 前置 | 用例 | 断言 |
|------|------|------|
| 两浏览器登录 | A 改 content | B 画布实时变 |
| 同上 | A 离开 | B 在线数减 1 |

**E2E-V1：版本回滚**
| 前置 | 用例 | 断言 |
|------|------|------|
| 有 2 版本 | 查看版本列表 | 列表含 2 条 |
| 同上 | 回滚 v1 | 当前 schema=v1+建新版本 |

**E2E-L1：keyword 搜索**
| 前置 | 用例 | 断言 |
|------|------|------|
| 有线索 | 搜「张三」 | 只返回匹配 |
| 同上 | 搜不存在 | 空态 |

**E2E-L2：状态机**
| 前置 | 用例 | 断言 |
|------|------|------|
| new 线索 | assigned→lost | 成功 |
| contacting | →invalid | 成功 |

**E2E-L3：解密查看**
| 前置 | 用例 | 断言 |
|------|------|------|
| LeadDetail | 点查看联系方式 | 弹窗显示明文+审计日志写入 |

**E2E-F1：表单管理**
| 前置 | 用例 | 断言 |
|------|------|------|
| FormList | 新建表单+配字段 | 列表出现 |
| 同上 | 编辑去重策略 | 保存成功 |

**E2E-W1：访客渲染全物料**
| 前置 | 用例 | 断言 |
|------|------|------|
| 含全物料页面 | 访客打开 | 所有物料渲染无 console error |

**E2E-W2：留资提交**
| 前置 | 用例 | 断言 |
|------|------|------|
| 含表单页 | 填写+提交 | 成功 toast/popup |
| 同上 | 必填项空 | 校验拦截 |
| 同上 | 重复提交 | 409 提示 |

### 7.2 多租户隔离验证（MUST）
| 用例 | 断言 |
|------|------|
| siteA 用户 GET siteB 线索 | 404/403 |
| siteA 用户解密 siteB 线索 | 403 + 审计拒绝 |
| siteA 协作连 siteB 页面 | WebSocket 拒绝 |

### 7.3 E2E 路由合规性确认
所有 E2E 绑定正式路由（§4.0 入口表），无 `pages/e2e/*` 专测页。

### 7.4 跨端 E2E 主路径与脚本保障（对齐 PLAN_WRITING_CONTRACT §7.1/§7.2）

**§7.1 跨端主路径表：**

| 路径名 | 入口端 | 依赖服务 | 自动化命令 | P0 |
|--------|--------|----------|-----------|-----|
| 留资提交闭环 | website `/:site/:path*` | backend-java `8080` + bff `3000` + MySQL + Redis | `cd packages/web/luban-website && pnpm run test:e2e`（尚无，合入前须补） | 是 |
| 设计器搭建+发布 | engine `sites/:siteId/pages/:pageId` | engine `5173` + bff `3000` + backend `8080` | `cd packages/engine/luban && pnpm run test:e2e` | 是 |
| 设计器协作 | engine 设计器（两 session） | + bff WebSocket `3000` | `cd packages/engine/luban && pnpm run test:e2e -- --spec "**/collab*.spec.ts"`（尚无，合入前须补，含两 session fixture 策略） | 是 |
| 版本回滚 | engine 版本 UI | + backend `8080` page_versions | 同上 | 是 |
| 线索解密查看 | engine LeadDetail | + backend `8080` | 同上 | 是 |

**§7.2 脚本保障逻辑（逐路径）：**

| 路径 | 覆盖交互链 | 前置数据/fixture | 关键断言 | 合并门禁 |
|------|-----------|------------------|----------|----------|
| 留资提交 | §4.2 W1 + E2E-W2 | 自建 site+published page(含 LubanForm) | 提交→200→success toast；必填空→校验拦截；重复→409 | P0 必绿 |
| 设计器搭建 | §4.2 D1/D2/D3 | 自建 site+空 page | 拖入→节点出现+选中；改属性→画布更新；Ctrl+Z→回退 | P0 必绿 |
| 设计器协作 | §4.2 D4 + §2.2 链路C | 两 session 同页 | A 改→B 实时变；A 离开→在线数减 | P0 必绿 |
| 版本回滚 | §2.2 链路V + E2E-V1 | 2 个 published 版本 | 列表含 2 条；回滚→schema=v1+新版本 | P0 必绿 |
| 线索解密 | §2.2 链路L3 | 自建 lead | 点查看→弹窗明文；audit_log 写入 | P0 必绿 |

失败即停：与仓库 bail 约定一致（`--bail`）。禁止 skip 降级。

---

## §8 TDD 与执行约定

### 8.1 TDD 路径
| 关键行为 | 先锁定测试类型 | 门禁 |
|----------|---------------|------|
| LeadStatusMachine 转移 | 单测（Java） | G3 |
| keyword 搜索 | IT（Java，真实 DB） | G3 |
| 解密查看+审计 | IT | G3 |
| 去重 OVERWRITE/MERGE | 单测 | G3 |
| 协作冲突合并 | 单测（Yjs CRDT） | G3 |
| 设计器拖拽/属性/撤销 | E2E（Cypress） | G4 |
| 留资提交校验 | E2E | G4 |

### 8.2 执行约定
- **先测后码**：状态机/去重/校验引擎/CRDT 合并先写单测
- **首个失败即停**：修当前红用例时专注，修绿后继续至全量门禁
- **并行 subagent**：§9.6 派发计划按 wave 依赖，wave 内并发 Task
- **禁止分期收口**：本 plan 47 task 全完成后+全门禁绿才汇报

### 8.3 Post-Development Workflow（MUST）
```
代码提交 → /luban-review 全自动审查（🔴🟡🔵 清零）
→ 编译（pnpm run build ×4 + mvn -q compile）
→ 单测+覆盖率门禁（Java 80% / engine·bff·website 85% / ui 90%）
→ 询问用户后跑 E2E（Cypress + 多租户隔离）
→ 全栈覆盖率汇总 make test-coverage
→ 完成汇报（保留命令+关键输出证据）
```
/luban-review **先行**，未清零禁止跑验证。

---

## §9 实现任务派发（plan-template §9；风险里程碑见 §9b，对齐 PLAN_WRITING_CONTRACT §9）

> 基于 task graph SSOT（`docs/superpowers/tasks/platform-complete-v1.json`）+ 前置代码扫描（真实路径）汇总。codegraph 未初始化，路径经 Read/find 确认存在；新增文件标「新建」。

### 9.1 文件变更总览（按子系统）

**backend-java**（`packages/backend/luban-backend/src/main/java/com/luban/backend/`）
| task | 文件 | 新建/改 | 摘要 |
|------|------|---------|------|
| T-be-1 | `service/LeadStatusMachine.java` | 改 | EnumSet 补 LOST/INVALID |
| T-be-2 | `service/LeadService.java` `service/FormService.java` | 改 | @Transactional + siteId 校验 |
| T-be-3 | `controller/LeadController.java` `mapper/LeadMapper.java` | 改 | keyword 参数 + LIKE |
| T-be-4 | `service/DedupService.java` `service/LeadService.java` `service/AntiSpamService.java` | 改 | OVERWRITE/MERGE + captcha |
| T-be-5 | `controller/LeadController.java`（getContact）+ `service/LeadService.java` | 改 | 解密查看+审计 |
| T-be-6 | `entity/PageVersion.java` `mapper/PageVersionMapper.java` `service/PageVersionService.java` `controller/PageVersionController.java` `dto/PageVersionResponse.java` | 新建 | 版本领域 |
| T-be-7 | `entity/FeatureGate.java` `mapper/FeatureGateMapper.java` `service/FeatureGateService.java` `controller/FeatureGateController.java` | 新建 | 开关 |
| T-be-8 | `service/LeadCryptoService.java` `exception/GlobalExceptionHandler.java` `auth/AuthFilter.java` | 改 | 密钥强制 env + 脱敏 + 收窄 |
| T-be-9 | `src/test/.../controller/*IT.java` | 新建 | @WebMvcTest |
| T-be-6 | `src/main/resources/schema.sql` | 改 | 增 page_versions/feature_gates/lead_audit_log |

**ui**（`packages/ui/luban-ui/packages/`）
| task | 文件 | 新建/改 | 摘要 |
|------|------|---------|------|
| T-ui-1 | `luban-low-code/src/lib/PropertyPanel.vue` | 新建 | 消费 propSchema |
| T-ui-2 | `luban-low-code/src/lib/useHistory.ts` | 新建 | 撤销/重做 |
| T-ui-3 | `luban-low-code/src/lib/validation.ts` | 改 | validateAll + formState 初始化 |
| T-ui-4 | `luban-low-code/src/lib/componentMeta.ts` | 改 | LubanForm propSchema 补全 |
| T-ui-5 | `luban-base/src/lib/form/LubanCheckbox.vue` `LubanRadioGroup.vue` `LubanSwitch.vue` | 改 | error props |
| T-ui-6 | `luban-low-code/src/lib/OutlineTree.vue` | 新建 | 大纲树 |
| T-ui-7~11 | `luban-base/src/lib/{marketing,website,lead,poster,form}/*.vue` | 新建 | ~35 物料 |
| T-ui-12 | `luban-low-code/src/lib/registry.ts` `palette.ts` `componentMeta.ts` `luban-base/src/index.ts` | 改 | 全量注册 |
| T-ui-13 | `luban-base/test/unit/*.spec.ts` + story | 新建 | 每物料测试 |

**engine**（`packages/engine/luban/src/`）
| task | 文件 | 新建/改 | 摘要 |
|------|------|---------|------|
| T-eng-1 | `views/page/PageEditor.vue` | 改 | designMode=true + schema 工具 |
| T-eng-2~5 | `views/page/`（面板/大纲/工具栏组件）+ `composables/useDesigner.ts` | 新建 | 设计器三栏+工具栏 |
| T-eng-6 | `composables/useShortcut.ts` | 新建 | 快捷键 |
| T-eng-7 | `composables/useCollab.ts` | 新建 | Yjs 客户端 |
| T-eng-8 | `views/page/VersionHistory.vue` `api/pageVersion.ts` | 新建 | 版本 UI |
| T-eng-9 | `views/form/FormList.vue` `FormEditor.vue` `api/form.ts` `router/index.ts` | 新建/改 | 留资管理页 |
| T-eng-10 | `views/lead/LeadList.vue` `LeadDetail.vue` | 改 | 空态/assignee/keyword |
| T-eng-11 | `layouts/DefaultLayout.vue` | 改 | 菜单高亮修复 |

**bff**（`packages/bff/luban-bff/src/`）
| task | 文件 | 新建/改 | 摘要 |
|------|------|---------|------|
| T-bff-1 | `app/api/collab/[siteId]/[pageId]/route.ts` + `lib/collabServer.ts` | 新建 | y-websocket |
| T-bff-2 | `lib/collabAuth.ts` | 新建 | 房间鉴权 |
| T-bff-3 | `app/api/sites/[siteId]/pages/[pageId]/versions/route.ts` | 新建 | 版本路由 |
| T-bff-4 | `app/api/leads/route.ts` `leads/export/route.ts` `forms/[id]/submit/route.ts` | 改 | keyword/X-Site-ID/清理 |
| T-bff-5 | `lib/*.spec.ts` + vitest 配置 | 新建 | 测试 |
| T-bff-6 | `app/api/**/route.spec.ts` | 新建 | 路由测试 |

**website**（`packages/web/luban-website/`）
| task | 文件 | 新建/改 | 摘要 |
|------|------|---------|------|
| T-web-1 | （依赖 ui registry，无需改 DynamicPage） | — | 自动渲染新物料 |
| T-web-2 | `composables/useLeadSubmit.ts` `views/DynamicPage.vue` | 改 | 校验+UTM+string 化 |
| T-web-3 | `views/DynamicPage.vue` + `pages/poster/[slug].vue` | 改/新建 | useHead 响应式+海报页 |
| T-web-4 | `composables/*.spec.ts` + vitest | 新建 | 测试 |

### 9.2 API 契约（新增/修改）

**新增端点（backend-java，仅 Java；Go 延后）：**
| 方法 | 路径 | 鉴权 | 说明 | task |
|------|------|------|------|------|
| GET | `/backend/leads/:id/contact?siteId=` | RequireUser | 解密查看（写审计） | T-be-5 |
| GET | `/backend/sites/:siteId/pages/:pageId/versions` | RequireUser | 版本列表 | T-be-6 |
| GET | `/backend/.../versions/:v` | RequireUser | 版本详情 | T-be-6 |
| POST | `/backend/.../versions/:v/rollback` | RequireUser | 回滚 | T-be-6 |
| GET | `/backend/feature-gates?siteId=&key=` | RequireUser（管理端）| 读开关 | T-be-7 |

> FeatureGate 访客侧消费（website 需在提交前判断 lead_capture 是否禁用）走**公开读端点** `GET /backend/public/feature-gates?siteId=&key=`（无鉴权，仅返回布尔，T-be-7 一并实现），避免访客被 401 拦截。

**修改端点：**
| 路径 | 变更 | task |
|------|------|------|
| `GET /backend/leads` | 增 keyword 参数（解密 contact LIKE） | T-be-3 |
| `PATCH /backend/leads/:id/status` | 状态机补 ASSIGNED→LOST/CONTACTING→INVALID | T-be-1 |
| `POST /backend/lead/forms/:id/submit` | dedup OVERWRITE/MERGE 落地 + captcha 校验 | T-be-4 |

**错误码**：沿用 API.md §3.9-3.10（LEAD_DUPLICATE/LEAD_SPAM_BLOCKED/LEAD_INVALID_TRANSITION/LEAD_DISABLED）+ 新增 PAGE_VERSION_NOT_FOUND (404)、FEATURE_GATE_NOT_FOUND (404)。

**双后端声明**：上述端点 Go 端均未实现，API.md + Go 文档双向标注。

### 9.3 数据库变更（schema.sql 增表，幂等 IF NOT EXISTS）

> 已核对现有 `packages/backend/luban-backend/src/main/resources/schema.sql`：`page_versions` / `feature_gates` / `lead_audit_logs` 三表均为本期新建，无同名表冲突。

```sql
CREATE TABLE IF NOT EXISTS page_versions (
    id          VARCHAR(36) PRIMARY KEY,
    site_id     VARCHAR(36) NOT NULL,
    page_id     VARCHAR(36) NOT NULL,
    version     INT NOT NULL,
    schema_json JSON NOT NULL,
    operator_id VARCHAR(36),
    created_at  DATETIME(3) NOT NULL,
    UNIQUE KEY uk_page_version (page_id, version),
    KEY idx_pv_page (page_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS feature_gates (
    site_id  VARCHAR(36) NOT NULL,
    gate_key VARCHAR(64) NOT NULL,
    enabled  TINYINT(1) NOT NULL DEFAULT 1,
    updated_at DATETIME(3) NOT NULL,
    PRIMARY KEY (site_id, gate_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lead_audit_logs (
    id         VARCHAR(36) PRIMARY KEY,
    site_id    VARCHAR(36) NOT NULL,
    lead_id    VARCHAR(36) NOT NULL,
    actor_id   VARCHAR(36) NOT NULL,
    action     VARCHAR(32) NOT NULL,  -- VIEW_CONTACT / STATUS_TRANSIT
    detail     JSON,
    created_at DATETIME(3) NOT NULL,
    KEY idx_audit_lead (site_id, lead_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 9.4 物料 schema（关键示例）

**LubanForm propSchema 补全（T-ui-4）：**
```ts
propSchema: {
  formId: { type: 'string', label: '关联表单ID', required: true },
  submitConfig: { type: 'json', label: '提交配置' }, // {mode, redirectUrl, popupTitle, toastMessage}
  size: { type: 'select', label: '尺寸', default: 'medium', options: [...] },
}
```

**新物料族 propSchema 要点**（每物料完整 schema 在 T-ui-7~11 落地，对齐 `.agents/rules/luban-material-schema.md`）：
- 营销族：倒计时(deadline)、优惠券卡(code/discount)、弹窗(trigger)、轮播图(slides[])、导航栏(links[])、页脚(links[])
- 网站族：图片(src/alt)、标题(level/content)、链接(href/text)、卡片(title/desc)、分隔线、图标、列表(items[])、富文本(html)、视频(src)、标签页(tabs[])、折叠面板(panels[])
- 留资族：手机格式化输入(name/mask)、省市联动(name)、日期选择(name)、文件上传(name/accept)、评分(name/max)、滑块(name/min/max)
- 海报族：海报容器(width/height/exportable —— **width/height 仅指导出图片尺寸，内核仍走流式布局**，对齐 §0.4 决策)、海报文本、海报图片、形状(type)、二维码(value)
- 表单补全：日期范围、时间选择、标签输入

### 9.5 组件接口

| 组件/composable | props/emits/签名 | task |
|----------------|------------------|------|
| `PropertyPanel` | props: `{ nodeMeta: ComponentMeta, modelValue: Record<string,unknown> }`, emits: `update:modelValue` | T-ui-1 |
| `useHistory` | `(initial: PageSchema) => { current, push, undo, redo, canUndo, canRedo }` | T-ui-2 |
| `OutlineTree` | props: `{ schema: PageSchema, selectedId }`, emits: `select, delete, duplicate, reorder` | T-ui-6 |
| `validateAll` | `(schema, formState) => Record<string,string>`（全表单校验） | T-ui-3 |
| `useDesigner` (engine) | `(schema: PageSchema) => { addNode, select, reorder, history }` | T-eng-1 |
| `useCollab` (engine) | `(siteId, pageId) => { doc, awareness, onlineUsers }`（Yjs 客户端） | T-eng-7 |
| `useShortcut` (engine) | 注册 Delete/Ctrl+Z/Y/C/V | T-eng-6 |

### 9.6 并行派发计划（基于 task graph wave，主 agent 并发 Task 派发）

| wave | 并行 task 线 | 派发方式 | 收口验证 |
|------|-------------|----------|----------|
| W1 | T-be-1,T-be-2,T-be-6 / T-ui-1~6 / T-bff-4 / T-eng-11 / T-cross-1 | 按 subsystem 并发 Task（backend-java/ui/bff/engine/cross 各一路） | 各包 build+test |
| W2 | T-be-3~5,T-be-7 / T-ui-7~11 / T-eng-1 / T-bff-3 / T-cross-2 | 物料按族拆 5 路并发 + 后端/引擎各一路 | ui build；backend verify |
| W3 | T-be-8,T-be-9 / T-ui-12,T-ui-13 / T-eng-2~5,9,10 / T-bff-1,2 / T-web-1,2 | engine 设计器集成串行（有依赖）+ 其余并发 | 全栈 build |
| W4 | T-eng-6,7,8 / T-bff-5,6 / T-web-3,4 | 并发 | 测试地基全绿 |
| W5 | T-cross-3,4 | 串行收口 | E2E 全绿 + 文档 |

依赖规则：`dependsOn` 为空的 W1 task 立即并行；物料 T-ui-7/8/10 依赖 T-ui-4，**T-ui-9/11 同时依赖 T-ui-4 与 T-ui-5**（留资族/表单补全含表单控件 error props）；T-ui-12/13 依赖全部物料；T-eng-2~5 依赖 T-eng-1；协作 T-eng-7 依赖 T-bff-1。

> §9 生成说明：因 codegraph 未初始化，路径经 Read/find 确认（非编造）；DDL/物料 schema 为基于 API.md + 现有 componentMeta.ts 的设计稿，实现时以 `.agents/rules/luban-material-schema.md` 终校。

---

## §9b 风险、里程碑与开放问题（对齐 PLAN_WRITING_CONTRACT §9）

> 编号说明：plan-template 定义 §9 = 实现任务派发（见上节 §9.1-9.6）；PLAN_WRITING_CONTRACT 定义 §9 = 风险里程碑。两契约 §9 语义不同，本 plan 以 §9 承载派发、§9b 承载风险以消歧。

### 风险与缓解
| 风险 | 等级 | 缓解 |
|------|------|------|
| 范围量级大（47 task），单 plan 周期长 | 高 | 按 wave 推进，每 wave 收口验证；实现跨会话时每会话列进度 |
| CRDT 协作复杂（Yjs 集成+冲突+光标） | 高 | 先单测 Y.Doc 合并行为；协作 P0 E2E 两 session |
| ~35 物料测试门禁重（每物料单测+e2e） | 中 | 物料按族并行开发（wave2），测试随物料走 |
| Go 延后违反双后端硬约束 | 中 | 用户显式确认仅 Java；plan+API.md+Go 文档三处标注差异 |
| 设计器画布交互密度高难稳定约束 | 中 | §4.0c 线框+§4.2 分步；必要时补原型 |
| codegraph 未初始化（§9 生成依赖） | 低 | 退回 grep/Read 或先 `codegraph init` |

### 里程碑（按 wave）
- M1（wave1 完成）：内核基础+契约源头就绪（属性面板/撤销/校验/LubanForm schema/状态机修复/docker-compose）
- M2（wave2 完成）：物料全族+设计器接线+后端服务就绪
- M3（wave3 完成）：设计器三栏集成+协作服务+全物料渲染+留资管理页
- M4（wave4 完成）：协作 UI+版本 UI+测试地基全就绪
- M5（wave5 完成）：E2E 全绿+文档+完成汇报

### 开放问题
- 无（架构决策 Q1-Q3 已全部锁定）

## 分级验收门禁表

| 门禁 | 验证方式 | 通过条件 | 责任 |
|------|----------|----------|------|
| **G1 代码质量与审查** | `/luban-review` 全自动 | 🔴🟡🔵 全清零 | 主 agent |
| **G2 安全审查** | 敏感字段清单+鉴权覆盖+OWASP Top10 自查 | 解密 API 有审计、密钥强制 env、AuthFilter 收窄、LEAD_ENC_KEY 无默认值 | 主 agent |
| **G3 单测+覆盖率** | `mvn -q verify` + `pnpm test` 各包 | Java 80% / engine·bff·website 85% / ui 90% | 各子系统 |
| **G4 E2E 验收** | Cypress 全量（§7）+ 多租户隔离 | 全绿，无 skip，无假绿 | 主 agent |

## 敏感字段清单与分级约束
| 字段 | 存储 | 日志 | 前端展示 |
|------|------|------|----------|
| lead.contact.phone | AES-256-GCM 加密（contact_json TEXT） | 脱敏 138****8000 | 列表/详情脱敏；解密弹窗明文+审计 |
| lead.contact.email | 同上 | 脱敏 z***@example.com | 同上 |
| lead.contact.name | 同上 | 脱敏 张* | 同上 |
| lead.source_ip | 明文 | 脱敏 | 不展示访客侧 |
| lead.dedup_hash | 明文（sha256 派生，不可逆） | 可打印 | 不展示 |
| LEAD_ENC_KEY | env 注入 | 禁止打印 | N/A |
| AUTH_JWT_SECRET | env 注入 | 禁止打印 | N/A |

## 双后端契约一致性声明
- **例外声明**：本期 Go 后端不实现 lead-capture/page_versions/collab 接口。此为**与硬约束 §3 的显式例外**，经用户确认。
- Java 主后端完整实现上述接口；Go 端 API 文档（`luban-backend-go/docs/`）+ Java API.md 底部**双向标注**差异。
- 后续迭代须另起 plan 补齐 Go 端，届时行为须与 Java 一致（响应体/错误码/状态机）。

## 多端渲染一致性声明
- 本期仅验证 **website（SSR）** 端渲染。
- 声明：引擎产物（PageSchema）在 website 端渲染一致；electron/flutter 端延后（依赖 schema 冻结，本期物料 schema 视为 v1 冻结基准）。
- 新增物料在 website 端 E2E 验证（E2E-W1）零 console error。

## FeatureGate 开关设计
见 §3.5。回滚首选：关闭对应 FeatureGate（lead_capture/realtime_collab/page_versioning/poster_export）。

## 错误场景清单（每特性≥3 非正常路径）
- 设计器：保存失败/协作断线/拖拽到非法容器
- 协作：WebSocket 断开重连/房间满/权限不足
- 版本：回滚不存在版本/并发发布冲突
- 留资：状态机非法转移/keyword 搜索后端异常/解密 API 403
- 表单：创建重名/字段配置非法/关联页面不存在

## 回滚方案
- Flyway：无（沿用 schema.sql 幂等），回滚=还原 schema.sql 上一版
- 配置：FeatureGate 关闭为首选
- 协作：关闭 realtime_collab → 单人模式（设计器降级可用）
- 解密查看：关闭后 LeadDetail 隐藏按钮

## 实现会话声明
本期 47 task 须**连续推进至全部门禁全绿**后做完成汇报。实现跨多个会话时，每会话末须列出已完成 task / 进行中 / 阻塞项。**禁止**在仅完成部分子能力时以"主体已完成"收口。

## 每步验证门
- backend-java：`验证门: cd packages/backend/luban-backend && mvn -q verify`（Java 17）
- engine：`验证门: cd packages/engine/luban && pnpm run build && pnpm test && pnpm run test:e2e`
- bff：`验证门: cd packages/bff/luban-bff && pnpm run build && pnpm test`
- website：`验证门: cd packages/web/luban-website && pnpm run build && pnpm test`
- ui：`验证门: cd packages/ui/luban-ui && pnpm run build && pnpm test && pnpm test:e2e`
- 全栈：`验证门: make test-coverage`

---

## 附录 A：ux-product-review rubric 覆盖

### Luban 产品交付硬约束核对
- [x] 非 MVP：本期是完整可交付版，非最小可用
- [x] 引擎可用性优先：设计器接线优先（T-eng-1），物料其次
- [x] 完整业务链路：§2.2 四链路 + §4.2 分步
- [x] 真实页面交付：§4.3 逐页结构

### website 站点交互规范对照
- [x] DynamicPage 渲染全物料（T-web-1）
- [x] 留资提交完整校验+UTM（T-web-2）
- [x] useHead 响应式（T-web-3）
- [x] 海报页路由（T-web-3）

### 方案与系统入口/数据依赖对照
- [x] 设计器入口 PageEditor 已存在，本期接线
- [x] 表单/线索 API 已存在，本期补 UI + 修复
- [x] 协作新增 WebSocket 入口（BFF）

（需求对照：无外部 PRD，需求源于用户对话确认的四场景+完整档设计器+CRDT）

---

## §10 验证命令引用（对齐 AGENTS.md + luban-testing-coverage）

本特性涉及子项目须执行命令子集：
- **backend-java**：`cd packages/backend/luban-backend && mvn -q verify`（Java 17，Surefire+Failsafe）
- **engine**：`cd packages/engine/luban && pnpm run build && pnpm test && pnpm run test:e2e`
- **bff**：`cd packages/bff/luban-bff && pnpm run build && pnpm test`
- **website**：`cd packages/web/luban-website && pnpm run build && pnpm test`
- **ui**：`cd packages/ui/luban-ui && pnpm run build && pnpm test && pnpm test:e2e`
- **全栈覆盖率**：`make test-coverage`
- **一键环境**：`docker-compose up`（T-cross-1 产出）

覆盖率目标：backend-java 80% / engine·bff·website 85% / ui 90%。

---

## §11 For agentic workers

> **For agentic workers:** REQUIRED SUB-SKILL: `subagent-driven-development`（推荐）或 `executing-plans`；按 checkbox 与任务图 JSON（`docs/superpowers/tasks/platform-complete-v1.json`）推进；执行纪律见 [docs/dev/agent-workflow-constraints.md](../../docs/dev/agent-workflow-constraints.md)（先测后码、Console→Network→后端日志、并行 subagent 条件）。本期 47 task 须连续推进至 G1-G4 全绿（G1 luban-review 清零 / G2 安全审查 / G3 单测覆盖率 / G4 E2E）后方可汇报完成。
