# 多轮 Review 收敛门禁方法论

> 「审查 → 修复 → 再审 → 收敛」的多轮 review 通用方法论。原 kangdou 项目用 `/kd-review` 命令落地，提炼为通用模式，适用 luban 任意大规模 review 场景。
> 命名：原 `kd-review` → 通用 `review`（luban 可实现为 `/review` 或 `/code-review`）。

## 一、终止条件：分色分离计数

review 的终止条件采用分色分离计数（按问题严重程度分色）：

- **🔴 阻断**：连续 2 轮零即可收敛（阻断修复明确）
- **🟡 主要**：需要连续 3 轮零才收敛（主要问题偏设计/质量，需更多验证）
- 🔴 和 🟡 分开计数，互不影响
- 退出条件：`red_continuous >= 2` **且** `yellow_continuous >= 3`
- 至少 1 轮必须是全量审查
- 🔵 建议不影响终止判定
- **文件级追踪**：每个文件维护 `consecutiveClean`，连续两轮零问题的文件下一轮可跳过审查

### Why

1. 阻断问题修复明确，2 轮足够确认
2. 主要问题修复依赖判断，需要 3 轮
3. 问题类型分开计数，一次 🟡 不会清零 🔴 进度
4. 文件级 `consecutiveClean` 避免同一文件反复审查浪费 token

### How to apply

维护两个独立计数器。每轮汇总后：有 🔴→red=0，无🔴→red+1；有 🟡→yellow=0，无🟡→yellow+1。同时更新每个文件的 `consecutiveClean`。两者都达标才退出。文件 `consecutiveClean >= 2` 时可跳过审查。

## 二、大规模合并后的 review 策略（700+ 文件）

### 场景
合并大分支后，diff 显示数百文件，标准 ~20 bucket 全覆盖策略 agent context 超限。

### 解决方案
1. **优先级分层**：Controller/Service/Repository > Entity/DTO/Config > 测试 > 脚本
2. **文件聚焦**：每 agent 3-16 个最关键文件（而非试图覆盖所有），重点覆盖写操作路径
3. **两轮快收敛**：R1 多 agent 全覆盖 → R2 少量 agent 增量修复 → R3+ grep 验证（不再启动 agent）
4. **设计级变更单独处理**：标为「需单独方案」，不阻断合并
5. **审查深度与广度的 tradeoff**：安全（鉴权/XSS/越权）和事务（FOR UPDATE/幂等/并发）优先于 DTO 命名、测试覆盖度

## 三、跨层审查（前后端契约）

### 场景
前后端各由不同 agent 开发，类型契约容易不一致（字段名、类型、枚举值）。

### 解决方案
1. **多个并行审查 agent**（后端端点 + 后端测试 + 前端组件 + 跨层契约）
2. **Streaming 修复**：审查结果一到就派修复，不等待全部完成
3. **跨层审查 agent** 发现的关键问题：前后端字段名不一致、SQL 隔离遗漏、订单双算等

### 预防
- 涉及前后端契约时，必须包含跨层审查 agent
- 前后端 API 类型定义后先交叉比对再写消费代码
- 双重验证（后端编译 + 前端构建）

## 四、方案文档的 review（非代码 diff）

### 场景
对设计方案文档（.md）进行 review，而非对代码 diff。方案文档无 branch diff，无法按文件 bucket 拆分，且修复是在同一文档上 Edit（不能并行）。

### 解决方案
**Round 1（全量多维度并行审查）：**
- 拆分为 6 个维度 agent：架构设计、数据模型、安全合规、性能缓存、可维护性、API+前端设计
- 每个 agent 审查整个方案的对应维度，互不冲突
- 全部并行启动

**Round 2+（增量修复+再审）：**
- 主会话串行修复（同一文件不能并发 Edit）
- 修复完成后启动 1-4 个 agent 验证修复项

**关键差异：**

| 维度 | 代码审查 | 方案文档审查 |
|------|---------|------------|
| 审查单位 | 按文件 bucket | 按维度 |
| 修复方式 | 并行 worktree agent | 主会话串行 Edit |
| 收敛轮次 | 典型 5-7 轮 | 典型 5-6 轮 |

## 五、提交前必须跑通测试（编译通过 ≠ 测试通过）

### 核心教训
review 的修复 agent 完成后若只做编译验证（`mvn compile` / `pnpm build`），不跑测试，会漏掉：
- 删掉的代码、调不存在的端点
- 跨仓契约不一致
- 引入的新问题

### 解决方案
review 新增「测试门禁」步骤：
- 提交前强制执行分层测试：后端 `mvn verify` / `go test` · 前端 `pnpm test && pnpm build` · E2E
- 跨仓合约检查（API 路径 diff）
- 任一层失败 → 自动派修复 agent → 最多 3 轮 → 仍失败则中止提交不推送
- 全程无人工介入，但测试不过禁止提交

### 关键原则
`mvn compile` 通过 ≠ 代码正确。只有 `mvn verify`（含单测+集成测+覆盖率门禁）才能确认代码质量。

## 六、通用 review 检查维度（luban）

| 维度 | 检查点 |
|------|--------|
| 安全 | 鉴权（@RequirePerm 等价物）、SQL 注入、XSS、越权、WebSocket 认证 |
| 事务 | FOR UPDATE、幂等、并发保护、CAS 守卫 |
| 双后端一致 | Java/Go 同接口行为一致（见 `docs/DUAL_BACKEND_PARITY.md`） |
| 多端一致 | electron/flutter/web 业务一致 |
| 引擎/物料 | schema 合规、渲染零 console error |
| 数据 | 脱敏、租户/上下文隔离 |
| 审计 | 关键操作有审计日志 |
| 代码质量 | 命名、重复、死代码 |
| 测试 | 覆盖率、断言质量、无假绿 |

### 修复优先级
安全 > 数据 > 审计 > 双后端一致 > 多端一致 > 代码质量 > 测试

## 七、luban 特化

- review 命令可命名为 `/code-review` 或 `/review`（已有 built-in `code-review` skill）。
- 跨仓合约检查：luban 有 11 子仓，review 须包含跨仓 API 路径 diff。
- 双后端 review：每个接口在 Java 和 Go 两端的行为一致性是硬门禁。
- 引擎 review：物料 schema 合规、渲染一致是 luban 特有维度（见 `docs/LOWCODE_ENGINE_SPEC.md`）。
