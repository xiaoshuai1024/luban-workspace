# scripts/

luban-workspace 的测试门禁与 Git/GitHub 工作流脚本。全部 POSIX-ish bash（`#!/usr/bin/env bash` + `set -euo pipefail`），Windows git-bash 友好，严格模式但容错（子模块/工具缺失时 skip 不中断）。

## 脚本清单

### 覆盖率门禁

| 脚本 | 用途 | 入口 |
|------|------|------|
| `coverage/coverage-summary.sh` | 遍历 `packages/*` 各包，按技术栈（TS/Java/Go）收集覆盖率，输出汇总表 + 各 HTML 报告路径；任一存在测试的包未达标 → exit 1 | `make test-coverage` |

技术栈分发：
- **TS**（engine/bff/ui/website）→ `pnpm test:coverage`（回退 `pnpm test -- --coverage`），读 `coverage/coverage-summary.json` 的 `lines.pct`
- **Java**（luban-backend）→ `mvn -q verify`，读 `target/site/jacoco/jacoco.xml` 的 `<counter type="LINE">`
- **Go**（luban-backend-go）→ `go test ./... -coverprofile=coverage.out`，`go tool cover -func` 取 total

覆盖率目标（来自 CLAUDE.md）：TS 引擎/bff/website 85% · UI 90% · Java 80% · Go 75%。

### Git 工作流

| 脚本 | 用途 | 入口 |
|------|------|------|
| `git/pull-all.sh` | 各 submodule `fetch + merge origin/<默认分支>` 进当前检出分支（**不换分支**）；默认分支取每个 submodule 在 `.gitmodules` 的 `branch`（6 master + 5 main），BRANCH 参数兜底 | `make pull-all` |
| `git/push-all.sh` | 遍历 submodule + 主仓，有改动则按规范 commit + push 当前分支（**不建 PR**） | `make push-all` |
| `git/push-all-commit-msg.lib.sh` | push-all 的语义化提交说明生成库（按暂存文件路径推断 type/scope，可从方案 md 取标题）。**被 source，勿单独执行** | — |
| `git/pr-all.sh` | 各 submodule + meta 仓 `gh pr create --base <默认分支>`（替代云效 MR）。先子模块后 meta（便于 meta 含子模块指针更新） | `make pr-all` |
| `git/run-per-pkg.sh` | 通用按包执行命令（test/lint/install/build），按技术栈分发：TS→pnpm · Java→mvn · Go→go。工具/脚本缺失→SKIP | `make test` / `make lint` / `make install-deps` |

### GitHub 封装（`scripts/github/`）

| 脚本 | 用途 |
|------|------|
| `github/create-pr.sh` | 单仓库 `gh pr create` 封装：自动探测默认分支、源分支守卫（feature/* 等）、push + 建 PR |
| `github/list-prs.sh` | 列出各子模块 + 主仓的开放 PR（`gh pr list`），支持 `--mine` / `--json` |
| `github/check-ci.sh` | 检查各子模块 + 主仓当前分支最近 CI run 结论；`--watch` 轮询；任一 failure → exit 1 |

## harness/prompts/

会话级 prompt 模板库（纯文本，复制即用）。每个子目录有 `README.md`（触发场景）+ 主模板 `.md`：

- `prototype/` — 快速原型 / Spike，最小代价验证技术假设
- `plan/` — 实现方案两段式（讨论稿 → 定稿），luban 化自 kangdou PLAN_WRITING_CONTRACT
- `brainstorming/` — 头脑风暴 / 讨论稿，先发散后收敛
- `tdd/` — 红绿重构循环；含双后端契约对齐用法

## 依赖假设（必须已装）

| 工具 | 用于 | 缺失时行为 |
|------|------|-----------|
| `git` | 所有 git/* | 必需，缺失报错退出 |
| `gh` | github/* 、 pr-all.sh | 必需，缺失报错退出（已认证 xiaoshuai1024，https，scope repo/workflow） |
| `pnpm` | TS 包 test/lint/build/install + coverage | 该包 SKIP |
| `node` | TS 包 | 该包 SKIP |
| `mvn` + `java` | Java 包 test/lint/build/install + coverage | 该包 SKIP |
| `go` | Go 包 test/lint/build/install + coverage | 该包 SKIP |
| `python3` | check-ci.sh 解析 gh run json | check-ci 降级（结论默认 pending） |

子模块未初始化（空目录）/ 无对应 script / 无覆盖率报告 → 一律 SKIP 并提示，不中断。

## 首次提交后的人工项

1. **可执行位**：脚本已通过文件系统 `chmod +x`。提交时需确保 git 记录 `100755` 模式。由于这些文件当前 untracked，提交时执行：
   ```bash
   git add scripts/coverage/coverage-summary.sh scripts/git/*.sh scripts/github/*.sh
   git update-index --chmod=+x scripts/coverage/coverage-summary.sh
   git update-index --chmod=+x scripts/git/pull-all.sh scripts/git/push-all.sh scripts/git/pr-all.sh scripts/git/run-per-pkg.sh
   git update-index --chmod=+x scripts/github/create-pr.sh scripts/github/list-prs.sh scripts/github/check-ci.sh
   ```
   （`push-all-commit-msg.lib.sh` 是被 source 的库，无需 +x。）

2. **gh 认证**：`gh auth status` 确认已登录（xiaoshuai1024，https，scope 含 repo/workflow）。`pr-all.sh` / `github/*` 依赖此。

3. **JaCoCo 配置**：`packages/backend/luban-backend/pom.xml` 须配 `jacoco-maven-plugin` 才能产出 `target/site/jacoco/jacoco.xml`；否则该包 WARN（不 FAIL）。

4. **TS 覆盖率 reporter**：engine/bff/ui/website 的 `package.json` 须有 `test:coverage` script 且 reporter 输出 `coverage/coverage-summary.json`（vitest `coverage-v8` 或 `istanbul`）。否则该包 WARN。

5. **覆盖 SSOT 校验脚本迁移**：`harness/prompts/plan/README.md` 引用的 `scripts/verify-plan-ssot.mjs`（kangdou 有）尚未迁移到 luban。若启用两段式 plan 流程的 taskGraph SSOT 校验，需从 kangdou 迁移。

## 已知限制

- `push-all.sh` / `pr-all.sh` 在 meta 仓检测「有改动」时会把所有 untracked 文件计入（包括其他并行 agent 的产出）。多 agent 并发场景下，提交时机由统一的收口 agent 控制，不在本脚本职责内。
- `check-ci.sh` 的 `--watch` 默认轮询上限 30 次（每 60s），达上限即停。
- 子模块默认分支探测依赖 `.gitmodules` 的 `submodule.<path>.branch`；未登记则回退 `main`。
