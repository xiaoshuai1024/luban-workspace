---
description: 全自动审查循环：并行派发 ~20 个窄范围审查 subagent → 结果到达即派修复 → 持续循环直到零问题收敛（🔴 🟡 🔵 全部清零）
---

触发：**`/luban-review`**。

## 工作流

执行自动化审查 → **streaming 修复** → 再审查 → 收敛的循环，直到零问题。

核心思路：将变更拆成 ~20 个窄范围 bucket，**全部同时审查**，**第一个结果回来就立刻派修复**，审查和修复重叠执行，最大限度压缩 wall-clock time。

### 第 1 步：确定审查范围 & 拆分为 ~20 个窄范围 bucket

从上下文或用户输入确定审查对象：

- 若用户给出了具体的路径/功能名，使用之
- 否则默认审查当前分支上最近完成的功能改动（`git diff <默认分支>...HEAD --name-only`，各子仓按 `.gitmodules` 的 branch 字段确定默认分支）

然后自动将变更文件分组为以下 bucket，**有变更的才派发，无变更的跳过**：

**后端 Java (~5 个):**
1. Controller / API 层（契约、Swagger、错误体、与 Go 端一致性）
2. Service / 领域层（事务边界、幂等、TOCTOU、并发）
3. Repository / Mapper（SQL、N+1、索引）
4. IT 测试（覆盖度、fixture 去重、边界用例）
5. Flyway 迁移（版本顺序、COLLATE、schema 冲突）

**后端 Go (~4 个):**
6. handler / API 层（与 Java 端契约一致、错误码一致）
7. service / 领域层（事务、幂等、与 Java 行为一致）
8. repo / 数据访问（与 Java schema 对齐）
9. Go 测试（`go test`，与 Java IT 场景对齐）

**引擎 / BFF / website (~6 个):**
10. 引擎渲染核心（packages/engine/luban：零 console error、物料 schema、渲染正确性）
11. BFF 聚合层（packages/bff/luban-bff：字段规范、错误体、与后端契约）
12. website SSR（packages/web/luban-website：SSR 渲染、路由、与引擎渲染一致）
13. 物料库 luban-ui（props schema、token 使用、注册）
14. 多端一致（引擎 vs website vs 各 client 渲染一致）
15. TS 单测 + E2E（覆盖度、假绿、断言强度）

**横切 (~3 个):**
16. 跨端契约检查（BFF 字段 ↔ 后端接口；前端调用 ↔ 后端实现）
17. 配置与部署（各包 package.json、docker-compose、CI pipeline）
18. 横切规范（CLAUDE.md、全局规则、双后端一致性、注解一致性）

**client / 文档 (~2 个):**
19. client 子项目（electron/flutter/cross-platform，按规划态按需）
20. 文档与任务图（docs/、.agents/plans/、taskGraph JSON 一致）

若某个 bucket 涵盖大量文件，按以下策略处理以避免 agent context 超限：

- 每个审查 agent 的文件数建议控制在 **1–5 个**，超出则拆分为多个子 agent
- 拆分的子 agent 加入**待办队列**，在当前轮全部 agent 派发后、依序派发后续子 agent
- 在 `round-N.jsonl` 的 `review_start` 事件中记录每个文件的 `status: "pending"`，子 agent 完成后通过 `review_result` 事件标记 `"reviewed"`
- 如果当前轮塞不下（超时窗口不够），**剩余待审文件自动转入下一轮**的首批审查，不丢失不跳过

## 状态文件系统

所有持久化状态存储在项目根 `.luban-review/` 目录中，按分支隔离。会话启动时创建，每轮结束更新。

### 目录结构

```
.luban-review/
├── .gitignore              # 仅保留目录本身（已提交）
├── manifest.json           # 累积总清单（分支隔离）
├── round-001.jsonl         # 每轮状态（append-only JSONL）
├── round-002.jsonl
├── known-issues.json       # 已知问题注册表（🔵 建议去重）
└── reviews/
    ├── review-模块-YYYY-MM-DD-round-N.md
    └── review-模块-YYYY-MM-DD-convergence.md
```

### manifest.json

各轮次累积总清单，分支维度隔离。每轮结束更新 `cumulativeStats`、`convergence`、`rounds` 和 `fileStates`。

```json
{
  "branch": "feature/xxx",
  "sessionId": "<uuid>",
  "createdAt": "2026-06-14T10:00:00Z",
  "totalFiles": 42,
  "cumulativeStats": {
    "🔴": { "found": 3, "fixed": 3 },
    "🟡": { "found": 8, "fixed": 7 },
    "🔵": { "found": 5, "fixed": 1 }
  },
  "convergence": {
    "cleanContinuous": 0,
    "exited": false,
    "testGatePassed": false,
    "testGateFailures": []
  },
  "rounds": [
    { "round": 1, "reviewAgents": 4, "fixAgents": 3, "status": "completed" }
  ],
  "fileStates": {
    "packages/backend/luban-backend/src/.../FileA.java": {
      "status": "fixed",
      "consecutiveClean": 2,
      "lastRoundReviewed": 1,
      "lastRoundWithIssues": null
    }
  }
}
```

#### fileStates 字段

为每个文件维护独立追踪，支持增量审查决策。

| 字段 | 类型 | 说明 |
|------|------|------|
| `status` | pending丨reviewed丨fixed | 当前状态 |
| `consecutiveClean` | int | 连续零问题轮次（>= 2 时可跳过审查） |
| `lastRoundReviewed` | int | 最后一次审查的轮次号 |
| `lastRoundWithIssues` | int丨null | 最后一次发现问题的轮次号（null=从未有问题） |

### round-N.jsonl（单轮事件流，append-only）

JSONL 格式——每行一个独立 JSON 对象，`write` + `flush` 原子追加，无需文件锁。

**事件类型：**

| 事件 | 触发时机 | 关键字段 |
|------|---------|---------|
| `round_start` | 轮次开始 | round, agents, files[] |
| `review_start` | 审查 agent 启动 | agent, bucket, files[] |
| `review_result` | 审查 agent 完成 | agent, bucket, issues[], reviewedFiles[] |
| `fix_start` | 修复 agent 启动 | agent, issueIds[] |
| `fix_result` | 修复 agent 完成 | agent, fixed, fixedFiles[] |
| `round_end` | 轮次结束 | round, stats, convergence |
| `test_gate` | 测试门禁执行（提交前，见第 7 步） | layer, status, failures[], durationMs |

### known-issues.json

用于 🔵 级别建议的去重——同一建议在不同轮次重复上报时递增 `reportCount` 并更新 `lastReportedAt`，不新增条目。活跃问题在 `expiresAt` 后自动过期。

### 审查 MD 文件

审查 agent 完成时输出结构化审查报告。

- 命名：`reviews/review-{模块}-{YYYY-MM-DD}-round-{N}.md`
- 包含 YAML frontmatter：模块名、轮次、严重性统计
- 问题清单按 🔴/🟡/🔵 分组，每条含文件、行号、描述、建议修复方式

收敛报告（循环终止时输出）：
- 命名：`reviews/review-{模块}-{YYYY-MM-DD}-convergence.md`
- 所有轮次汇总 + 累计修复统计 + 最终状态声明

### 第 2 步：Streaming 派发 — 所有审查 agent 一次性并行启动

使用 `subagent-driven-development` 模式，**一次性并行启动所有有变更的 bucket**：

- 每个 agent **只审查少量文件**（建议 1–5 个），超出则拆分并由 reviewItems 追踪
- 每个 agent **独立工作**（`isolation: worktree`）
- 每个 agent **禁止修改文件**（review only）
- 每个 agent 执行：加载对应规则/技能 → 输出结构化报告（按 🔴/🟡/🔵 分级）
- 每个 agent 的 prompt 头部附加 `[effort=max] 已生效：本会话按 max 执行。` 以启用最大推理强度
- 所有 agent **并行启动**（`run_in_background: true`）
- **不等待全部完成** — 进入下一步 streaming 模式

### 第 3 步：Streaming 修复 — 结果到达即派修复 agent（🔴 阻断自动修复）

**关键优化：不要等全部审查完成。** 每个审查 agent 一返回结果就立即处理：

1. 收到结果后 **立即** 解析报告，提取 🔴、🟡 和 🔵 问题
2. **🔴 阻断问题一律直接修复，不询问用户、不等待确认**——包括但不限于：
   - 并发竞态、幂等缺失等数据安全问题
   - 鉴权/权限缺失
   - 非法 SQL 引用、编译阻断
   - 双后端契约不一致（Java 与 Go 同接口响应体/错误码不同）
   - 引擎渲染新增 console error（违反零 console 门槛）
   - 物料 props schema 不合规
   - 任何影响生产正确性的阻断级问题
   - Flyway 迁移冲突（重复/损坏）直接删除冗余版本或增加幂等条件
   - 当修复需要新增 DB 列（如幂等键）时，**同时创建 Flyway 迁移文件**并立即修复代码
3. **🟡 主要问题和 🔵 建议同理直接修复**——无需询问，按审查报告的建议方式修复
4. **立即** 派发一个**修复 agent**（`subagent-driven-development`，`isolation: worktree`）：
   - 包含审查 agent 发现的具体问题清单（文件路径、行号、期望修复方式、验证命令）
   - 🔵 建议按类型聚合为窄 scope 修复 agent（如"TS CSS 清理"、"后端死代码清理"、"命名统一"、"类型安全加固"），每个 agent 处理 1-5 个同类建议，避免碎片化
   - 修复 agent **禁止修改审查范围外的文件**
   - 修复 agent 的 prompt 头部附加 `[effort=max] 已生效：本会话按 max 执行。` 以启用最大推理强度
5. 多个修复 agent **可同时运行**（各自在独立 worktree 中）
6. **修复与剩余审查重叠执行** — 不等待还在跑的审查

这样 wall-clock time ≈ `max(all reviews) + max(all fixes)`，而非 `sum(reviews) + sum(fixes)`。

### 第 4 步：修复完成后记录

每个修复 agent 完成时：

1. 确认编译通过（或运行指定验证命令）
2. 记录修复摘要（修复了哪些问题、影响范围）
3. 更新 `round-N.jsonl` 中对应文件的 `status` 为 `"fixed"`（追加 `fix_result` 事件）

### 第 5 步：持续循环直到完全收敛（强规则：连续 3 轮零任何问题，🔴 自动修复不询问）

当**本轮所有审查 agent 返回结果** 且 **所有修复 agent 完成** 后：

1. 汇总本轮次的问题统计（🔴+🟡+🔵）
2. **统一计数**：只要本轮有任何一个问题（🔴 或 🟡 或 🔵）→ `clean_continuous` 清零；完全没有问题 → `clean_continuous` +1
3. 更新 `manifest.json`：
   - `convergence.cleanContinuous`
   - 将本轮有问题的文件 `consecutiveClean` 重置为 0，无问题的 +1
4. **退出条件**：`clean_continuous >= 3`
5. **至少 1 轮必须全量审查**：如果所有轮次都是增量审查，即使计数达标也不退出，强制安排下一轮为全量
   - 第二轮起只需重新审查**上一轮出过问题的 bucket**
   - 在 bucket 内部，利用 `fileStates.consecutiveClean` 跳过连续两轮零问题的文件
   - 跨轮去重：相同 bucket 且内部所有文件 `consecutiveClean >= 2` 时跳过该 bucket
   - 但每 5 轮或候选退出轮必须全量一次

### 第 6 步：收敛报告

输出：
- 总迭代轮数
- 每轮派发 agent 数（审查 + 修复）
- 每轮发现问题数（🔴/🟡/🔵）
- 每轮修复问题数
- 累计修复统计
- 最终审查状态（必须是"零问题"）

### 第 7 步：测试门禁（提交前强制 — 禁止跳过）

收敛报告生成后、提交前，**必须**对本次 luban-review 改动涉及的所有子项目执行完整测试。**测试不通过禁止提交**，失败自动派修复 agent 循环修复，全程无需人工介入。

#### 7.1 检测受影响的项目

根据各子仓 `git diff` 确定哪些项目有改动，仅对有改动的项目跑测试：

```bash
git diff --name-only HEAD~{lubanReviewCommitCount} HEAD   # 主仓
# 各子模块各自 git diff --name-only HEAD~{n} HEAD
```

#### 7.2 分层测试（按项目执行，全部必须 passed）

| 项目 | 测试命令 | 覆盖范围 |
|------|---------|---------|
| backend-java | `cd packages/backend/luban-backend && mvn -q verify` | Surefire 单测 + Failsafe 集成测 + JaCoCo 覆盖率门禁 |
| backend-go | `cd packages/backend/luban-backend-go && go test ./... -race -cover` | 单测 + 竞态 + 覆盖率 |
| engine | `cd packages/engine/luban && pnpm test && pnpm run build` | 单测 + 类型 + 构建 |
| bff | `cd packages/bff/luban-bff && pnpm test && pnpm run build` | 单测 + 构建 |
| ui | `cd packages/ui/luban-ui && pnpm test && pnpm run build` | 单测 + 构建 |
| website | `cd packages/web/luban-website && pnpm test && pnpm run build` | 单测 + 构建 |

每个项目独立判定，**任一项目失败即阻断提交**。项目间可并行执行以压缩 wall-clock time。仅跑有改动的项目，无改动的项目跳过。

#### 7.3 跨端契约检查（捕获 BFF/前端调用与后端不一致）

逐仓审查时无法发现「BFF/前端调用了后端不存在的端点」类问题。本层专门拦截此类跨端回归：

- 若 `scripts/contract-check.sh` 存在 → 执行 `bash scripts/contract-check.sh`
- 若不存在 → **主会话执行内联检查**：收集 BFF/website/引擎所有 API 调用的 URL 模式，与 Java + Go 后端所有 `@*Mapping` / handler 路由注解路径做 diff，列出无后端对应实现的调用作为 🔴 阻断问题
- **双后端契约一致性**：同一接口 Java 与 Go 的响应体字段、错误码须一致，diff 出差异作为 🔴 阻断

#### 7.4 E2E 最终确认（硬门禁，禁止跳过）

退出前跑一次 P0 E2E 作为最终确认，**E2E 失败同样阻断提交**：

- 引擎渲染：`cd packages/engine/luban && pnpm run test:e2e`
- website：`cd packages/web/luban-website && pnpm run test:e2e`（要求 BFF + 后端已启动）

> 按 CLAUDE.md「E2E 测试禁止跳过」硬约束：E2E 因环境限制（Playwright 不可用、后端未启动等）无法运行时，**禁止自动跳过、禁止写 `expect(true).toBe(true)` 占位测试**。记录到状态文件，收敛报告醒目标注 `🔴 E2E 未执行（环境不可用）`，**不提交**，等待用户处理环境后重跑。

#### 7.5 失败处理（自动修复，无人工介入）

任一层失败时：

1. **收集失败详情**：测试名、断言失败信息、堆栈、关联源文件路径
2. **映射到源文件**：从失败用例/堆栈定位到 Service / Controller / Vue / TS 文件
3. **派发修复 agent**（`subagent-driven-development`，`isolation: worktree`）：
   - 测试失败详情作为 🔴 阻断问题注入 prompt
   - 修复 agent 的验证命令为**重跑失败的测试**（非全量，快速反馈）
   - 失败测试转绿 + 编译通过后才算修复完成
4. **修复后重跑整层**：防止修复引入新回归
5. **最多 3 轮测试-修复循环**：仍失败则**中止提交**，写入 `.luban-review/test-gate-failures.md`（含全部失败详情 + 已尝试的修复），收敛报告标注 `🔴 测试门禁未通过，代码未提交未推送`，**不提交不推送**，等待用户介入

#### 7.6 状态记录

`round-N.jsonl` 追加 `test_gate` 事件；`manifest.json` 的 `convergence` 字段更新：`testGatePassed` 仅在 7.2/7.3/7.4 全部 passed 时置 `true`，`testGateFailures` 记录未通过层及失败项。`exited` 仅在 `cleanContinuous >= 3` **且** `testGatePassed == true` 时才置 `true`。

#### 7.7 全部通过

所有层（单测+集成测 / 合约检查 / E2E）全部 `passed` → `testGatePassed = true` → 进入第 8 步提交。

### 第 8 步：自动提交并推送（测试门禁通过后）

**前置条件**：第 7 步测试门禁全部通过（`testGatePassed == true`）。收敛条件达成（clean_continuous >= 3 且至少一轮全量审查）后，自动执行提交和推送：

1. **主仓库提交**：
   - 提交消息格式：
     ```
     chore(luban-review): {简单描述改动的业务性质}

     luban-review 收敛结果：{totalRounds} 轮 | 🔴 {fixed} 🟡 {fixed} 🔵 {fixed}
     ```
   - 其中描述从当前分支名和审查上下文推断

2. **子模块提交**（若有子模块改动）：
   - 对有改动的子模块逐个：`git add -A && git commit -m "chore: luban-review 修复"`（在子模块目录内）→ `git push origin HEAD:<当前分支名>`
   - 主仓库更新子模块指针：`git add <改动的子模块>` → `git commit -m "chore(workspace): 合并 luban-review 子模块指针"`

3. **主仓库推送**：
   - `git push origin HEAD:<当前分支名>`
   - 若推送失败（远程有新的提交），提示用户并建议 `git pull --rebase`

4. **推送成功后**，在收敛报告中附加提交 hash 与分支。

5. **回退机制**：若任一子模块提交或推送失败，记录具体失败原因到状态文件，**不阻塞推送已完成的部分**。在最终报告中列出推送失败的模块供用户手动处理。

### 终止条件（强规则 — 连续 3 轮零问题）

- 🔴/🟡/🔵：只要一轮中有任何一个问题 → `clean_continuous` 归零，循环继续
- **退出条件**：`clean_continuous >= 3`（连续 3 轮没有任何 🔴 和 🟡 和 🔵 问题）
- **至少 1 轮必须是全量审查**（不能全增量通过就退出）
- **禁止提前终止**——未达到上述条件就停止的，视为违反强规则
- **禁止中途暂停询问用户**——整个循环一口气跑完，所有 🔴 问题自动修复，所有决策点直接按最佳实践处理
- 连续 10 轮问题总量不减少 → 终止并告警（可能陷入死循环）
- **测试门禁是提交的硬前置**——即使 `clean_continuous >= 3`，也必须通过第 7 步测试门禁才能提交
- **收敛轮次优化**：
  - 第二轮起只需重新审查**上一轮出过问题的 bucket**
  - 利用 `fileStates.consecutiveClean` 跳过连续两轮零问题的文件
  - 每 5 轮必须全量一次（防止增量审查产生盲区）

## 重要约束

1. 所有审查 agent 使用 `isolation: worktree` 以避免干扰工作区
2. 修复 agent 同样使用 `isolation: worktree`
3. 禁止修改与审查范围无关的文件
4. **审查 agent 永远不修改文件**（review only）
5. **状态文件防并发**：写入 `.luban-review/` 使用 JSONL append-only 模式（每行独立原子写）
6. **E2E 测试是硬门禁**：退出（收敛）前必须跑一次 P0 E2E 作为最终确认，**E2E 失败阻断提交**

## 修复 agent 完成后强制验证

每个修复 agent 完成后，主会话必须执行**两层验证**：

### 第一层：编译验证（快速门禁，每个修复 agent 必跑）

1. 在对应包根执行编译验证：
   - Java 后端改动：`cd packages/backend/luban-backend && mvn -q compile`
   - Go 后端改动：`cd packages/backend/luban-backend-go && go build ./...`
   - TS 包改动：`cd packages/<pkg> && pnpm run build`
2. 若编译失败 → 立即派发新的修复 agent，带入编译错误信息
3. **最多重试 3 次**，仍失败则标记为 🔴 阻断问题进入下一轮

### 第二层：定向测试（快速回归反馈，推荐）

若修复涉及的文件有对应测试文件，**立即跑该测试**（非全量），验证修复未破坏既有行为。定向测试失败 → 同编译失败处理流程。

> 定向测试是快速反馈手段，**不替代**第 7 步的全量测试门禁。

## 修复 agent 约束

修复 agent 的 prompt **必须包含**以下语句：

```
## 修复约束
1. 最小改动原则：只改必须改的，禁止"顺便重构"或"顺手优化"
2. 禁止修改审查范围外的文件
3. 修复后必须在 worktree 内运行对应编译命令验证（Java: mvn -q compile；Go: go build ./...；TS: pnpm run build）
4. 若存在对应测试文件，编译后跑定向测试验证未破坏既有行为
5. 编译 + 定向测试均通过后再退出
6. 若涉及双后端接口契约，检查另一端是否需同步修改（Java/Go 行为一致）
```

## 与 /super-pm 和 /e2e-archi 的关系

- 每个窄范围审查 agent 内部决定执行 `super-pm`（产品 UX）立场的审查、`e2e-archi`（架构 E2E）立场的审查、或两者兼顾
- 对于 Controller/Service/handler 文件 → 侧重 e2e-archi（事务、安全、测试、双后端一致）
- 对于 Vue/页面文件 → 侧重 super-pm（UX、假功能、原型符合性、多端渲染一致）
- 对于测试文件 → 侧重 e2e-archi（假绿、覆盖度、纪律）
- 对于 API/类型/BFF 文件 → 两者兼顾
- 对于引擎/物料/schema 文件 → 侧重 luban-lowcode-engine-quality（零 console、schema 合规、多端一致）

## 高频问题模式（luban 通用）

| 类别 | 典型问题 | 根因 | 修复模式 |
|------|---------|------|---------|
| **statusLabel** | 英文枚举 default 分支 | switch 未覆盖所有 case | `default: return '未知状态'` |
| **false green** | `toBeDefined()` / `expect(true).toBe(true)` | 断言太弱 | `toBeTruthy()` + 具体断言 |
| **类型安全** | `Record<string, unknown>` 泛化 | API 层未定义具体类型 | 添加 Response 接口 |
| **审计缺失** | 验证失败路径无日志 | 只处理了 happy path | 每个 throw 前记录日志 |
| **引擎 console** | 渲染物料新增 console error | 物料未处理异常分支 | 补全错误处理，零 console |
| **双后端不一致** | Java/Go 同接口响应字段不同 | 两端独立实现未对齐 | 对齐响应体/错误码（DUAL_BACKEND_PARITY） |
| **物料 schema 缺失** | 新物料无 props schema | 注册时遗漏 | 补全 schema（luban-material-schema） |
