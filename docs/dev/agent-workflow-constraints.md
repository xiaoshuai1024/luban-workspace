# Agent 工作流约束

> 定义 TDD、并行 subagent、验证顺序等执行纪律。
> 通用约束，适用 luban 全部 agent。

## 1. 并行 subagent 优先

luban 强约束：**任何工作只要能开 subagent 就尽量并行**。主会话用 Task/Agent 拆并行子任务提速。

## 2. 改码前必须 Read

Edit/Write 任何文件前先 Read 确认当前状态，禁止凭记忆改。

## 3. 改动范围确认

涉及 3+ 文件或跨子仓改动时，必须先列出改动范围等待用户确认再执行。小改动（1-2 文件）直接执行无需确认。

确认格式：
> 改动涉及 2 个仓 4 个文件：A.java, B.vue, C.ts, D.sql。继续吗？

## 4. 阶段性编译验证

修改后须在阶段性节点（一组关联改动完成时）编译验证：
- TS 仓：`pnpm run build`
- Java 后端：`mvn -o -q compile`（`-o` 离线加速）
- Go 后端：`go build ./...`

核心目的：早发现错误、红状态不扩散——**红状态下禁止继续改其他文件**。

## 5. 测试门禁

改码后须在该包根目录执行构建+测试：
- TS 仓：`pnpm test && pnpm run build`
- Java 后端：`mvn -q verify`
- Go 后端：`go test ./... -race -cover`

详见 `docs/TESTING_SPEC.md`。

## 6. E2E 禁止跳过/假绿

所有 E2E 真实执行，禁止 `*.skip`/条件跳过；需跳过须用户明确同意；禁止「未起依赖 → 全 skip → 退出 0」冒充通过。

详见 `.agents/rules/luban-e2e-execution-contract.md` 与 `docs/E2E_AGENT_GUIDE.md`。

## 7. 双后端同步

编辑任一后端（Java/Go）时，检查另一端是否需要对应修改，保证契约一致。

详见 `docs/DUAL_BACKEND_PARITY.md`。

## 8. 工作流文档

详细的 brainstorming → writing-plans → executing-plans 工作流见 `docs/SUPERPOWERS.md`。
