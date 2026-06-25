---
name: "source-command-tdd"
description: "以 TDD 模式推进当前任务：红→绿→重构；失败按项目规范排查；缺服务则启动；跑通后汇报证据"
---

# source-command-tdd

Use this skill when the user asks to run the migrated source command `tdd`.

## Command Template

## 含义

**`/tdd`**：将**当前对话中的开发任务**锁定为 **TDD 工作模式**——先测后码、失败有证据、依赖服务可用，直至约定验证命令**全部跑通**后再向用户收口。

## Agent 必须遵守

### 1. TDD 铁律（MUST）

- 加载并遵循 `.agents/skills/test-driven-development/SKILL.md` 与 `docs/SUPERPOWERS.md` **§2 严格 TDD**（红 → 绿 → 重构）。
- 实现前须有**可失败**的测试；禁止先堆实现再补假绿断言。
- 与 E2E/方案门禁对齐时，另读 `.agents/rules/luban-e2e-execution-contract.md` 与 `docs/E2E_AGENT_GUIDE.md`（若当前任务属于方案/收尾类）。

### 2. 未跑通时：按项目规范排查（MUST）

- **测试分层与命令**：[AGENTS.md](AGENTS.md) 改码验证表、`.agents/rules/luban-testing-coverage.md`。
- **E2E 契约**：`.agents/rules/luban-e2e-execution-contract.md` 与 `docs/E2E_AGENT_GUIDE.md` §2.5：禁止假绿与降级已约定脚本；**已开始跑验收 E2E 后**非用户授权**不得**改测试语义（纯格式化除外）；**禁止**用不当 `SKIP_*` 冒充通过。
- **首个失败即停**：修当前红再重跑；与 `luban-testing-coverage` 一致。
- **引擎 / BFF / website E2E 类失败排查顺序**：[AGENTS.md](AGENTS.md)「前端测试 / 页面未按预期通过时」与 `docs/E2E_AGENT_GUIDE.md` §3（Console → Network → 后端日志、`requestId` / `ts=`）。
- **系统性排障**（栈迹、环境、根因不明时）：优先按 `.agents/skills/systematic-debugging/SKILL.md` 或 `.agents/skills/investigate/SKILL.md` 走证据链，再改代码。

### 3. 依赖服务：须探测、启动、排障后再测（MUST）

按**本次要跑的测试**列出依赖（示例：本机 **MySQL**、**Redis**（若启用）、Java 后端 **`8080`**、Go 后端（默认端口见各包配置）、引擎渲染 dev server、website SSR dev server、BFF dev server 等），**先探测**（健康请求、`lsof`、读 `terminals` 元数据等），**未就绪则须尝试启动**（典型：`packages/backend/luban-backend` 下 **`mvn spring-boot:run`**；`packages/backend/luban-backend-go` 下 `go run`；TS 包按各包 `pnpm dev`；其它见 [AGENTS.md](AGENTS.md)、各子项目文档）。

- **启动失败须排障**：读**启动日志**与终端输出（端口占用、Flyway、数据源、Redis 等），修复或收窄根因后再跑测；**禁止**未读日志就把失败归咎于「环境不行」并结束会话。
- **禁止**仅以「服务没起」「健康检查失败」为由**跳过合入门禁**、滥用 **`SKIP_*`**（除 `docs/E2E_AGENT_GUIDE.md` §4.1 与流水线文档允许的 **CI 豁免**，且 **PR/流水线说明已写明**）或依赖「全体 skip、退出码 0」冒充通过。
- **后端启动**：Java/Go 双后端独立配置；TDD 中若修改了任一后端源码或配置，再次跑依赖该后端的联调/E2E 前**须重启对应后端**。
- **引擎渲染 E2E**（`packages/engine/luban`）：按 `luban-testing-coverage` 与相关脚本；缺 Playwright 等不可在本机自动化补齐时，须写明**已做的预检与阻塞**，**不得**静默跳过冒充绿。
- 启动前避免重复起多套冲突端口。

### 4. 持续跑通与收口（MUST）

- 按当前任务所触达的子项目，在**对应包根**跑齐 [AGENTS.md](AGENTS.md) 规定的验证命令（例如 Java 后端的 `mvn -q verify`、Go 后端的 `go test ./... -race -cover`、引擎/BFF/website 的 `pnpm test` / `pnpm run build` / `pnpm run test:e2e` 等），直至**与本次改动相关的门禁全部通过**。
- 宣称完成前遵守 `.agents/skills/verification-before-completion/SKILL.md`：保留**命令 + 关键输出**（或日志路径）作为证据。

## 你必须向用户汇报

用简短列表说明：**当前任务**、**采用的测试/命令**、**探测了哪些依赖、是否执行过启动命令、启动/健康检查错误摘要（若有）及如何消除**、**最终通过哪些验证**（可附最后一条命令的退出码与一行摘要）。若仍有红或环境阻塞，明确写出**已尝试的启动与排障步骤**、**阻塞原因**与**下一步**（不假装已绿）。
