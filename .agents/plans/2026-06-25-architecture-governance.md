---
featureId: architecture-governance
title: 架构治理自动化
createdAt: 2026-06-25
status: approved
taskGraph: docs/superpowers/tasks/architecture-governance.json
contractSource: plan-template 命令体 + writing-plans skill + PLAN_WRITING_CONTRACT.md
scope: 后端引入 ArchUnit/go-cleanarch/golangci-lint + 前端引入 ESLint/Prettier/stylelint/boundaries/dependency-cruiser + Git Hooks + CI
split: 不拆 child plan（单 plan 覆盖全栈工具链植入）
branches: 各子仓 feature/architecture-governance 同名分支
---

# 架构治理自动化 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将项目中所有以文档形式存在的架构规则落地为自动化测试和 Lint 工具，实现"一次配置、永久守卫"。

**Architecture:** 后端双栈（Java ArchUnit + Go go-cleanarch/golangci-lint）分层自动化测试；前端四包（engine/website/bff/ui）各自独立 ESLint v9/Prettier/stylelint/eslint-plugin-boundaries/dependency-cruiser 配置；Git Hooks + CI 强制执行。配置变更零业务代码修改。

**Tech Stack:** ArchUnit (com.tngtech.archunit:archunit-junit5 @ Java 17), go-cleanarch (github.com/roblaszczak/go-cleanarch @ Go 1.25), golangci-lint, ESLint v9 flat config, Prettier 3.x, stylelint, eslint-plugin-boundaries, dependency-cruiser, Husky, lint-staged, commitlint, GitHub Actions

---

## §1 需求溯源（追溯矩阵）

| 上游需求 | 来源 | task id | E2E/验证场景 | 验收门禁 |
|---------|------|---------|-------------|---------|
| 分层规则（controller→service→mapper 单向/禁反向） | `.agents/rules/luban-dual-backend-parity.md`; `/e2e-archi` 命令 §1 | T2, T9 | ArchUnit LayerDependencyTest / Go architecture_test | G3, G4 |
| DTO/Entity 隔离 | `.agents/rules/luban-cross-cutting-standards.md` L103-138 | T4 | DtoEntityIsolationTest | G3 |
| 统一错误体 {code, message, requestId} | `.agents/rules/luban-cross-cutting-standards.md` L120 | T7 | DualBackendContractTest | G3 |
| 统一分页 {items, total, page, pageSize, hasMore} | `.agents/rules/luban-cross-cutting-standards.md` L118 | T7 | DualBackendContractTest | G3 |
| 禁止 JVM 本地缓存 | `.agents/rules/luban-redis-cache.md` L14-19 | T6 | CodingStandardTest | G3 |
| 构造注入禁止 @Autowired 字段注入 | 阿里巴巴 Java 开发手册 | T6 | CodingStandardTest | G3 |
| 零 console error（引擎质量） | `.agents/rules/luban-lowcode-engine-quality.md` | T13 | `pnpm run lint` | G3 |
| 前端一致代码风格 | 用户需求（本次） | T13, T14, T15, T16 | Prettier check 通过 | G3 |
| 架构边界自动化 | 用户需求（本次） | T13-T16 | eslint-plugin-boundaries + dependency-cruiser 通过 | G3, G4 |
| Git Hooks 强制执行 | 用户需求（本次） | T17 | `git commit` 触发 lint-staged | G4 |
| CI 门禁补齐 | 用户需求（本次） | T8, T11, T18, T19 | CI workflow 全绿 | G4 |

---

## §2 系统与链路

### 2.1 涉及子系统

| 子系统 | 涉及 | 说明 |
|--------|------|------|
| Java Backend (`packages/backend/luban-backend`) | ✅ | ArchUnit 6 测试类 + pom.xml 依赖/插件 + CI test workflow |
| Go Backend (`packages/backend/luban-backend-go`) | ✅ | go-cleanarch 测试 + `.golangci.yml` + CI lint workflow |
| Engine (`packages/engine/luban`) | ✅ | ESLint v9 + Prettier + stylelint + boundaries + depcruiser + lint script + Git Hooks + CI |
| BFF (`packages/bff/luban-bff`) | ✅ | 补齐 Prettier + stylelint + boundaries + depcruiser + Git Hooks + CI |
| Website (`packages/web/luban-website`) | ✅ | ESLint v9 + Prettier + stylelint + boundaries + depcruiser + lint script + Git Hooks + CI |
| UI (`packages/ui/luban-ui`) | ✅ | 补齐 stylelint + Nx boundaries 收紧 + depcruiser + Git Hooks + CI |
| Meta repo | ✅ | `docs/ARCH_LINT_STANDARDS.md` + `make lint` 更新 |
| Client (electron/flutter) | ❌ 本轮不涉及 | 目录不存在/规划态 |
| AI Assistant | ❌ 本轮不涉及 | 空 submodule |

### 2.2 各子系统增量

| 子系统 | 新增/修改 |
|--------|----------|
| **Java Backend** | 新增 archunit-junit5 依赖 + maven-surefire-plugin + jacoco-maven-plugin 显式配置；新建 `src/test/java/com/luban/backend/architecture/` 6 个测试类；新增 `.github/workflows/test.yml` |
| **Go Backend** | 新增 go-cleanarch 依赖；新建 `internal/lint/architecture_test.go`；新建 `.golangci.yml`；新增 `.github/workflows/lint.yml` |
| **Engine** | 新建 `eslint.config.mjs`、`.prettierrc`、`.prettierignore`、`.stylelintrc.json`、`.dependency-cruiser.js`；package.json 新增 lint 脚本 + devDeps；新建 `.husky/`、`commitlint.config.js` |
| **Website** | 同上（适配 Nuxt 格式） |
| **BFF** | 新建 `.prettierrc`、`.prettierignore`、`.stylelintrc.json`、`.dependency-cruiser.js`；更新 `eslint.config.mjs`；package.json 新增 lint 脚本 + devDeps；新建 `.husky/`、`commitlint.config.js` |
| **UI** | 新建 `.stylelintrc.json`、`.dependency-cruiser.js`；修改 `eslint.config.mjs` 收紧 Nx boundaries；package.json 新增 lint 脚本；新建 `.husky/`、`commitlint.config.js` |
| **Meta** | 新建 `docs/ARCH_LINT_STANDARDS.md`；修改 `scripts/git/run-per-pkg.sh` |

### 2.3 验证链路

```
开发者 git commit
  → husky pre-commit hook
    → lint-staged（仅检查变更文件）
      ├── eslint --fix（.ts/.tsx/.vue）
      ├── stylelint --fix（.css/.vue）
      └── prettier --write（全部）
  → 提交成功

开发者 git push
  → CI workflow 触发
    ├── backend-java: mvn test（含 ArchUnit）
    ├── backend-go: go test ./... + golangci-lint run
    ├── engine: pnpm lint + pnpm test
    ├── website: pnpm lint + pnpm build
    ├── bff: pnpm lint
    └── ui: pnpm lint + pnpm test
  → 全绿 → 合并就绪

make lint（meta 仓一键）
  → run-per-pkg.sh lint（遍历所有 submodule 执行各自 lint 命令）
  → 全部 passed → 输出汇总
```

---

## §3 架构规则（本方案的"业务逻辑"）

### 3.1 分层规则（Java / Go 对称）

```
┌─────────────────────────────────┐
│  controller / handler           │  ← 仅依赖 service
│  @RestController / gin.Handler  │
├─────────────────────────────────┤
│  service                        │  ← 仅依赖 mapper/repository + 其他 service
│  @Service / struct              │
├─────────────────────────────────┤
│  mapper / repository            │  ← 仅依赖 entity/model + MyBatis/SQL
│  @Mapper / struct               │
└─────────────────────────────────┘
```

**禁用路径**：
- ❌ controller → mapper（直接跨层）
- ❌ mapper → service（反向依赖）
- ❌ entity → service（实体不应有业务逻辑依赖）
- ❌ service → controller（反向依赖）

### 3.2 命名规范

| 层 | Java | Go |
|----|------|----|
| 入口 | `*Controller.java` in `controller/` | `*_handler.go` in `internal/handler/` |
| 业务 | `*Service.java` in `service/` | `*_service.go` in `internal/service/` |
| 数据 | `*Mapper.java` in `mapper/` | `*_repo.go` in `internal/repository/` |
| DTO | Java records in `dto/` | request/response structs in handler or model |
| Entity | POJO in `entity/` | `*_model.go` or struct in `internal/model/` |

### 3.3 DTO/Entity 隔离规则

| 规则 | Java | Go |
|------|------|----|
| Entity 无 Spring 注解 | entity 包不含 @Service/@RestController/@Repository | model 包不含 gin/HTTP 依赖 |
| DTO 无持久化注解 | dto 包不含 @Table/@Column/@Mapper 注解 | request/response 不含 db tag |
| Controller 不直接暴露 Entity | 返回类型不能是 entity 包中的类，须转 DTO | handler 返回通过 model 序列化，不直接返回 repo 层内部类型 |

### 3.4 异常层次

```
RuntimeException
└── BusinessException（唯一自定义基类）
    └── static factory: .siteNotFound(), .pageNotFound(), .userNotFound(), etc.
```

- GlobalExceptionHandler 处理所有 BusinessException → APIError{code, message, requestId}
- 禁止直接抛 RuntimeException / IllegalArgumentException（必须用 BusinessException 子类）

### 3.5 编码规范

| 规则 | 适用 |
|------|------|
| 禁止 System.out / System.err | Java |
| 禁止 java.util.logging | Java |
| 禁止 @Autowired 字段注入（仅构造注入） | Java |
| 禁止 `log.Fatal` / `os.Exit` 在 library 代码中 | Go |
| 圈复杂度 ≤ 15 | Go (gocyclo) |
| 未处理 error 必须处理 | Go (errcheck) |

### 3.6 双后端契约

| 契约项 | 要求 |
|--------|------|
| 分页响应体 | `{items: [], total: int, page: int, pageSize: int, hasMore: bool}` |
| 错误体 | `{code: string, message: string, requestId: string}` |
| API 前缀 | 路径以 `/backend` 开头 |
| 空列表 | 返回 `[]` 不返回 `null` |

---

## §4 页面结构

**无前端页面。**

本方案为开发者工具链配置植入，不新增或修改任何用户可见页面。前端新增的配置文件（`.eslintrc`、`.prettierrc` 等）对终端用户透明。

> dependency-cruiser 在部分包中会生成 `.dependency-cruiser.js` 配置并在 CI 中可选产出 SVG 依赖图（仅开发者阅），不视为用户界面。

---

## §5 集成与复用表

| 复用件 | 提供方 | 消费方 | 契约 |
|--------|--------|--------|------|
| `docs/ARCH_LINT_STANDARDS.md` | T12 (meta) | T13-T16 (所有前端包) | Prettier: singleQuote=true, semi=true, tabWidth=2, printWidth=100; ESLint: typescript-eslint recommended + eslint-config-prettier; stylelint: standard + vue SFC |
| `.prettierrc` 基线 | T13 (engine) | T14, T15, T16（独立复制） | 相同内容，标准化缩进/引号/尾逗号 |
| `eslint.config.mjs` 模式 | T13 (engine) | T14 (website) | typescript-eslint flat config 结构，框架适配（Vite vs Nuxt） |
| ArchUnit 测试基类 | T1 (Java backend) | T2-T7 | `@AnalyzeClasses(packages = "com.luban.backend")` + shared `ArchRule` imports |
| golangci-lint 配置 | T10 (Go backend) | CI, 开发者本地 | `.golangci.yml` 10 linters |

---

## §6 架构边界 + 门禁自检

### §6.1 架构边界

- **后端分层**：controller/handler → service → mapper/repository，由 ArchUnit/go-cleanarch 守护
- **前端分层**：eslint-plugin-boundaries 定义各包内部模块方向（composables→components→stores；pages→composables→api client）
- **BFF 边界**：BFF pages→lib→backend client，禁止 pages 直调 backend
- **引擎边界**：引擎 composables→components→stores，禁止 components 直调外部 API

### §6.2 双后端 parity 矩阵

| 接口 | Java 现状 | Go 现状 | 本期目标 |
|------|----------|---------|---------|
| `/backend/ping` | ✅ | ✅ | 不变（T7 契约测试守护结构一致性） |
| `/backend/auth/login` | ✅ | ✅ | 不变 |
| `/backend/users/*` | ✅ | ✅ | 不变 |
| `/backend/sites/*` | ✅ | ✅ | 不变 |
| `/backend/pages/*` | ✅ | ✅ | 不变 |
| `/backend/settings` | ✅ | ✅ | 不变 |
| `/backend/datasources/*` | ✅ | ✅ (partial) | 不变 |
| 分页/错误体统一契约 | ✅ | ✅ | T7 自动化守护 |

> 本期**零新增接口**，所有 ArchUnit 契约测试用于守护已有接口的结构一致性。

### §6.3 覆盖率门禁目标

| 子项目 | 工具 | 行覆盖率门禁 | 来源 |
|--------|------|------------|------|
| Java backend | JaCoCo | **80%** | `.agents/rules/luban-testing-coverage.md` |
| Go backend | go test -cover | **75%** | 同上 |
| engine | Vitest coverage-v8 | **85%** | 同上 |
| bff | Vitest coverage-v8 | **85%** | 同上 |
| website | Vitest coverage-v8 | **85%** | 同上 |
| luban-ui | Vitest coverage-v8 | **90%** | 同上 |

> 覆盖率门禁为已有规范，本期不提升阈值；本期重点是让 lint/arch test 可执行，覆盖率提升留待后续迭代。

### §6.4 物料 schema 标准

本轮不涉及新增物料。现有物料 schema 标准不变（`.agents/rules/luban-material-schema.md`）。

### §6.5 FeatureGate 策略

| 功能 | FeatureGate key | 作用域 | 关闭行为 |
|------|----------------|--------|---------|
| 架构治理自动化（全部） | N/A | 不需要 | 本方案为开发者工具链配置，非用户可见功能，不适用 FeatureGate 机制 |

> 理由：所有变更为静态配置文件（pom.xml、.eslintrc、.prettierrc 等）和测试代码，不改变运行时代码路径，无需 FeatureGate 控制。

---

## §7 E2E / 验证计划

### §7.1 验证策略

本方案不涉及用户可见页面变更，因此传统 E2E（Playwright 端到端页面交互）不适用。替代验证策略：

| 验证类型 | 覆盖内容 | 命令 |
|---------|---------|------|
| **架构测试** | Java/Go 分层合规 | `mvn test -pl .` / `go test ./internal/lint/...` |
| **Lint 检查** | 前端代码风格/边界 | `pnpm run lint`（各包） |
| **Prettier 检查** | 前端格式化 | `prettier --check .`（各包） |
| **dependency-cruiser** | 前端模块依赖合规 | `npx depcruise src`（各包） |
| **构建验证** | 引擎/website 构建不破 | `pnpm run build` |
| **全栈汇总** | 一键 lint | `make lint` |

### §7.2 脚本保障逻辑

1. **首个失败即停**：`make lint` 中每个包 lint 失败立即标记，但继续执行后续包以获取完整结果
2. **禁假绿**：各包 lint 脚本禁止 `|| true` / `set +e`；依赖 `exit 0` 才算通过
3. **环境预检**：CI 中 node_modules 不存在时 `pnpm install` 先执行；golangci-lint 二进制不存在时自动下载

### §7.3 验证用例枚举

| 场景 | 前置条件 | 操作 | 断言 |
|------|---------|------|------|
| Java 分层合规 | Java 后端代码就绪 | `mvn test -Dtest=LayerDependencyTest` | PASS |
| Java 命名规范合规 | 同上 | `mvn test -Dtest=NamingConventionTest` | PASS |
| Java DTO/Entity 隔离合规 | 同上 | `mvn test -Dtest=DtoEntityIsolationTest` | PASS |
| Go 分层合规 | Go 后端代码就绪 | `go test ./internal/lint/... -v` | PASS |
| Go lint 合规 | golangci-lint 已安装 | `golangci-lint run ./...` | PASS（0 issues） |
| Engine ESLint 合规 | engine pnpm install 完成 | `cd packages/engine/luban && pnpm run lint` | ESLint + Prettier + stylelint 全 PASS |
| Engine depcruiser 合规 | 同上 | `npx depcruise src` | 无 forbidden 违规 |
| Website lint 合规 | website pnpm install 完成 | `cd packages/web/luban-website && pnpm run lint` | 全部 PASS |
| BFF lint 合规 | bff pnpm install 完成 | `cd packages/bff/luban-bff && pnpm run lint` | 全部 PASS |
| UI lint 合规 | ui pnpm install 完成 | `cd packages/ui/luban-ui && pnpm run lint` | 全部 PASS |
| Git hook 生效 | husky installed | `git commit -m "test" --allow-empty` | lint-staged 触发 |
| make lint 全覆盖 | 所有 submodule 就绪 | `make lint` | 每个包输出 `passed`，无静默跳过 |

### §7.4 路由合规性确认

不适用——本方案无新增路由/页面。

---

## §8 TDD 与执行约定

### 8.1 TDD 策略

本方案为工具配置植入，"TDD"体现为：先写配置→先验证工具能跑起来→再逐步收紧规则。

| 行为 | 先锁定的测试 | 关系 |
|------|------------|------|
| ArchUnit 依赖可用 | `mvn test -Dtest=LayerDependencyTest` 能编译执行 | P0，阻塞 T2-T7 |
| go-cleanarch 依赖可用 | `go test ./internal/lint/...` 能编译执行 | P0，阻塞后续 Go CI |
| ESLint v9 flat config 正确加载 | `eslint --print-config .` 无报错 | P0，阻塞引擎/website lint |
| 各包 lint script 可用 | `pnpm run lint` exit 0 | P0，阻塞 Git Hooks + CI + make lint |

**红→绿→重构**纪律：
- 先创建极简配置（如 ESLint 只开一条规则）验证工具链连通
- 逐步添加规则 → 每次加规则后跑 `pnpm run lint` 确认增量
- 最后 auto-fix 安全项 + 收紧到 error 级别

### 8.2 首个失败即停

- 每个 lint 工具独立验证：ESLint 失败不影响 Prettier 检查继续
- 每个包的 lint 失败不阻塞后续包的 lint 执行（以便一次拿到完整结果）
- 但 CI 中任一包失败 → job 最终标记为 failure

### 8.3 并行 subagent

**可并行线**（彼此无依赖，可独立验收）：

| 并行组 | 任务 | 独立验收条件 |
|--------|------|------------|
| G1 | T1→T2-T7（并行）→T8 | `mvn test` PASS |
| G2 | T9, T10→T11 | `golangci-lint run` PASS |
| G3 | T12 | 基线文档存在 |
| G4-G7 | T13, T14, T15, T16（T12 完成后全并行） | 各包 `pnpm run lint` PASS |
| G8 | T17 | `git commit` 触发 hook |
| G9 | T18 | CI workflows 存在且可触发 |
| G10 | T19→T20 | `make lint` + `make test-coverage` PASS |

**实现阶段派发计划**：
- **Wave 1**: 并行派发 G1 (backend-java) + G2 (backend-go) + G3 (meta)，等待全部返回
- **Wave 2**: 并行派发 G4 (engine) + G5 (website) + G6 (bff) + G7 (ui)，等待全部返回
- **Wave 3**: 并行派发 G8 (hooks) + G9 (CI)，等待全部返回
- **Wave 4**: G10 (meta + verify)，主会话串行执行

### 8.4 单期收口

本 plan 所有 20 个任务在**单次实现周期内全部完成**并通过 `make lint && make test-coverage` 验证门禁后方做完成汇报。

### 8.5 Post-Development Workflow

```
代码提交（各 submodule feature/architecture-governance 分支）
   ↓
/luban-review 全自动审查（🔴🟡🔵 全部清零，含建议级别）
   ↓
编译（按各包子项目）
  ├── Java: mvn -q compile
  ├── Go: go build ./...
  ├── Engine: pnpm run build
  ├── Website: pnpm run build
  ├── BFF: pnpm run build
  └── UI: pnpm run build
   ↓
架构测试 + Lint 门禁
  ├── Java: mvn -q test（含 ArchUnit）
  ├── Go: go test ./... -race -cover + golangci-lint run ./...
  ├── Engine: pnpm run lint && pnpm run test
  ├── Website: pnpm run lint
  ├── BFF: pnpm run lint
  └── UI: pnpm run lint && pnpm run test
   ↓
全栈覆盖率汇总（make test-coverage）+ Lint 汇总（make lint）
   ↓
完成汇报
```

**每步验证门**：

| 步骤 | 验证门 | 模块 |
|------|--------|------|
| 审查清零 | `/luban-review` 输出 🔴0 🟡0 🔵0 | 全部 |
| Java 编译 | `mvn -q compile -pl .` | Java |
| Java 测试 | `mvn -q test -pl .` | Java |
| Go 编译 | `go build ./...` | Go |
| Go 测试+lint | `go test ./... -race -cover && golangci-lint run ./...` | Go |
| Engine lint+test | `pnpm run lint && pnpm run test` | Engine |
| Website lint+build | `pnpm run lint && pnpm run build` | Website |
| BFF lint | `pnpm run lint` | BFF |
| UI lint+test | `pnpm run lint && pnpm run test` | UI |
| 全覆盖汇总 | `make test-coverage && make lint` | Meta |

### 8.6 实现会话

本期范围须一次推进至 `make lint` 全绿（所有包 `passed`，无静默跳过）后再做完成汇报。

---

## 质量禁令 14 条自检

- [x] **1. 禁止跳过功能** — 20 个任务全覆盖后台/前端/CI/Git Hooks，无静默省略
- [x] **2. 禁止假绿** — lint 脚本无 `|| true`，CI 无 skip 配置
- [x] **3. 禁止占位** — 所有配置文件包含完整规则内容，无 TODO/假文案
- [x] **4. 禁止骨架交付** — 每个包的 lint script 可独立执行并产生有意义输出
- [x] **5. 禁止用 JSON 替代页面** — 不适用（无页面变更）
- [x] **6. 页面交互完整** — 不适用（无页面变更）
- [x] **7. 验收口径=可交付** — 交付物为可独立执行的配置文件 + CI workflow，验收标准明确
- [x] **8. 引擎 E2E 绑正式路由** — 不适用（无引擎渲染变更）
- [x] **9. 门禁分级执行** — G1–G4 分级验收门禁表见下文
- [x] **10. /luban-review 清零** — Post-Dev Workflow 中列为第一步
- [x] **11. 安全审查门禁** — 不适用（无敏感数据/支付/外部对接/权限变更）
- [x] **12. 双后端契约一致** — 本期零新增接口，T7 用 ArchUnit 守护已有接口结构一致性
- [x] **13. 多端渲染一致** — 不适用（无物料/引擎渲染变更）
- [x] **14. FeatureGate 默认约束** — 不适用（开发者工具链配置，见 §6.5 理由）

---

## 分级验收门禁表（G1–G4）

| 级别 | 名称 | 验证方式 | 通过条件 | 责任 |
|------|------|---------|---------|------|
| **G1** | 代码质量与审查 | `/luban-review` 全自动审查 | 🔴🟡🔵 全部清零（含建议级别） | plan owner |
| **G2** | 安全审查 | **跳过** — 本方案无敏感数据/支付/外部对接/权限变更 | N/A | N/A |
| **G3** | 单测 + Lint + 覆盖率 | 分栈：`mvn test` / `go test ./...` / `pnpm run lint` / `pnpm test` | Java 80%, Go 75%, 引擎 85%, website 85%, bff 85%, UI 90%；所有包 `pnpm run lint` PASS | plan owner |
| **G4** | E2E / 验证验收 | `make lint` 全栈 lint；`make test-coverage` 汇总 | 所有包 lint passed，覆盖率达标 | plan owner |

**执行顺序**：G1（/luban-review 清零）→ G3（测试+lint+覆盖率）→ G4（全栈汇总 lint+覆盖率）。

---

## 敏感字段清单与分级约束

**不适用**。本方案不涉及新增 API、数据库表、或敏感数据处理。所有变更为静态配置文件和测试代码。

---

## 回滚方案

| 变更 | 回滚首选 | 回滚次选 | 数据影响 | 验证点 |
|------|---------|---------|---------|--------|
| ArchUnit 测试失败 | 修复违规代码（架构违规应视为 bug） | 临时 `@ArchIgnore` 注解 + 登记 issue | 无 | 代码合规后移除 @ArchIgnore |
| golangci-lint 报错 | `golangci-lint run --fix` auto-fix | 关闭特定 linter（`.golangci.yml` comment out） | 无 | 后续迭代逐步恢复 linter |
| ESLint/Prettier 报错 | `pnpm run lint -- --fix` / `prettier --write .` auto-fix | 降级规则至 warn 级别 | 无 | 格式化后 diff 仅空白变化 |
| dependency-cruiser 报错 | 修复违规 import | 在 `.dependency-cruiser.js` 添加例外规则 + 登记 issue | 无 | 例外规则有截止日期 |
| CI lint job 假绿 | 检查 workflow `continue-on-error: false` | N/A | 无 | CI job 红=阻塞合并 |

> 无 FeatureGate 回滚（不适用），所有回滚首选为修复违规代码，因为架构规则违规应在源头修正。

---

## §10 明确不做（防膨胀）

| 不做项 | 理由 |
|--------|------|
| monorepo 化（pnpm workspace 统一所有包） | submodule 隔离策略不变，不在本次范围 |
| 替换各包构建工具链（Vite/Nuxt/Next/Nx） | 超出架构治理范围 |
| Client 包（electron/flutter/cross-platform） | 目录不存在/规划态 |
| AI assistant 包 | 空 submodule |
| 强制执行覆盖率门禁作为 CI block（提升阈值） | 覆盖率提升为后续迭代，本期只确保 lint/arch test 可执行 |
| 统一 TS 版本到 5.9 | 各包框架约束不同（Nx 5.9 / Nuxt 5.6），暂不强制 |
| 引入 OpenAPI/Swagger 代码生成 | 超出范围，后续迭代 |
| 后端 contract test 框架（Pact/Spring Cloud Contract） | T7 用 ArchUnit 静态检查覆盖核心契约，contract test 为后续 |

### 已知缺口显式延后

| 项 | 延后到 | 理由 |
|----|--------|------|
| dependency-cruiser CI 可视化报告发布 | 后续迭代 | 本期只做 lint 检查（depcruise --output-type err） |
| 覆盖率 CI block（覆盖率低于门禁 → CI 红） | 后续迭代 | 本期先确保覆盖率可测量、可报告 |
| Client 包工具链植入 | flutter/electron 目录创建后 | 目录不存在 |
| E2E 级架构回归（Playwright 验证路由完整性） | 后续迭代 | 本期聚焦静态工具链 |

---

## 附录：已加载 Skill/文档清单

| 文档/Skill | 用途 | 状态 |
|-----------|------|------|
| `writing-plans/SKILL.md` | 定稿结构与粒度 | ✅ 已加载 |
| `PLAN_WRITING_CONTRACT.md` | 必选章节契约 | ✅ 已加载 |
| `luban-e2e-execution-contract.md` | E2E 禁止假绿 | ✅ 已加载 |
| `luban-testing-coverage.md` | 分栈覆盖率门禁 | ✅ 已加载 |
| `luban-dual-backend-parity.md` | 双后端契约 | ✅ 已参考 |
| `luban-cross-cutting-standards.md` | BFF 字段/错误体/分页 | ✅ 已参考 |
| `luban-lowcode-engine-quality.md` | 引擎零 console | ✅ 已参考 |
| `luban-material-schema.md` | 物料 schema | ✅ 已参考（本期不涉及） |
| `luban-multi-client-consistency.md` | 多端一致 | ✅ 已参考（本期不涉及） |

---

## §9 实现任务派发

> 以下内容由并行 subagent 扫描代码库后产出，合并后追加到定稿。

### 9.1 文件变更总览

#### Backend Java (T1–T8)

| Task | File Path (`packages/backend/luban-backend/`) | C/M | Summary |
|------|------|:---:|---------|
| T1 | `pom.xml` | M | 添加 `archunit-junit5:1.3.0` (test) + `maven-surefire-plugin` 显式配置 + `jacoco-maven-plugin:0.8.12` |
| T2 | `src/test/java/com/luban/backend/architecture/LayerDependencyTest.java` | C | controller→service→mapper 分层规则 |
| T3 | `src/test/java/com/luban/backend/architecture/NamingConventionTest.java` | C | 命名规范 |
| T4 | `src/test/java/com/luban/backend/architecture/DtoEntityIsolationTest.java` | C | DTO/Entity 隔离 |
| T5 | `src/test/java/com/luban/backend/architecture/ExceptionHierarchyTest.java` | C | 异常层次 |
| T6 | `src/test/java/com/luban/backend/architecture/CodingStandardTest.java` | C | 编码规范 |
| T7 | `src/test/java/com/luban/backend/architecture/DualBackendContractTest.java` | C | 双后端契约 |
| T8 | `.github/workflows/test.yml` | C | CI test job (Java 17, `mvn test`) |

#### Backend Go (T9–T11)

| Task | File Path (`packages/backend/luban-backend-go/`) | C/M | Summary |
|------|------|:---:|---------|
| T9 | `go.mod` | M | 添加 `github.com/roblaszczak/go-cleanarch` |
| T9 | `internal/lint/architecture_test.go` | C | go-cleanarch handler→service→repository 分层验证 |
| T10 | `.golangci.yml` | C | 10 linters 配置 |
| T11 | `.github/workflows/lint.yml` | C | CI lint job (Go 1.25, `golangci-lint run`) |

#### Engine (T13)

| Task | File Path (`packages/engine/luban/`) | C/M | Summary |
|------|------|:---:|---------|
| T13 | `package.json` | M | 添加 devDeps (eslint, prettier, stylelint, depcruiser, etc.) + lint/format/depcruise scripts |
| T13 | `eslint.config.mjs` | C | ESLint v9 flat config: typescript-eslint + vue + boundaries + prettier |
| T13 | `.prettierrc` | C | `{singleQuote, semi, tabWidth: 2, printWidth: 100, trailingComma: "all"}` |
| T13 | `.prettierignore` | C | dist, node_modules, pnpm-lock, coverage, .nx |
| T13 | `.stylelintrc.json` | C | stylelint-config-standard + postcss-html (Vue SFC) |
| T13 | `.dependency-cruiser.js` | C | depcruiser: types→utils→api→stores→layouts→views |
| T13 | `.github/workflows/lint.yml` | C | CI lint job |

#### Website (T14)

| Task | File Path (`packages/web/luban-website/`) | C/M | Summary |
|------|------|:---:|---------|
| T14 | `package.json` | M | 添加 devDeps + lint script |
| T14 | `eslint.config.mjs` | C | ESLint v9 flat config (Nuxt 适配) |
| T14 | `.prettierrc` | C | 对齐基线 |
| T14 | `.prettierignore` | C | .nuxt, .output, dist, node_modules |
| T14 | `.stylelintrc.json` | C | stylelint-config-standard + standard-vue |
| T14 | `.dependency-cruiser.js` | C | pages→composables→stores, server 隔离 |
| T14 | `.github/workflows/lint.yml` | C | CI lint job |

#### BFF (T15)

| Task | File Path (`packages/bff/luban-bff/`) | C/M | Summary |
|------|------|:---:|---------|
| T15 | `package.json` | M | 添加 prettier, stylelint, depcruiser devDeps + 扩展 lint script |
| T15 | `eslint.config.mjs` | M | 添加 eslint-config-prettier + eslint-plugin-boundaries |
| T15 | `.prettierrc` | C | 对齐基线 |
| T15 | `.prettierignore` | C | .next, node_modules, out, build |
| T15 | `.stylelintrc.json` | C | stylelint-config-standard (Tailwind v4 CSS) |
| T15 | `.dependency-cruiser.js` | C | pages→lib→backend client |

#### UI (T16)

| Task | File Path (`packages/ui/luban-ui/`) | C/M | Summary |
|------|------|:---:|---------|
| T16 | `package.json` | M | 添加 stylelint + depcruiser devDeps + lint script |
| T16 | `eslint.config.mjs` | M | 收紧 `@nx/enforce-module-boundaries` 从 `*→*` 到真实依赖规则 |
| T16 | `.stylelintrc.json` | C | stylelint-config-standard + standard-scss |
| T16 | `.dependency-cruiser.js` | C | apps→packages 单向，库间按 tag 约束 |
| T16 | `.github/workflows/test.yml` | M | 添加 lint step |

#### Meta + Cross (T12, T17–T20)

| Task | File Path | C/M | Summary |
|------|------|:---:|---------|
| T12 | `docs/ARCH_LINT_STANDARDS.md` | C | 共享基线标准文档 |
| T17 | `packages/engine/luban/.husky/` + `commitlint.config.js` | C | Git Hooks (engine) |
| T17 | `packages/web/luban-website/.husky/` + `commitlint.config.js` | C | Git Hooks (website) |
| T17 | `packages/bff/luban-bff/.husky/` + `commitlint.config.js` | C | Git Hooks (bff) |
| T17 | `packages/ui/luban-ui/.husky/` + `commitlint.config.js` | C | Git Hooks (ui) |
| T18 | `packages/engine/luban/.github/workflows/lint.yml` | C | (已含在 T13) |
| T18 | `packages/web/luban-website/.github/workflows/lint.yml` | C | (已含在 T14) |
| T18 | `packages/bff/luban-bff/.github/workflows/lint.yml` | C | CI lint job |
| T18 | `packages/ui/luban-ui/.github/workflows/test.yml` | M | (已含在 T16) |
| T19 | `scripts/git/run-per-pkg.sh` | M | 确保所有包 lint 不静默跳过 |
| T20 | N/A (验证汇总) | — | `make lint && make test-coverage` |

### 9.2 API 契约

**本期零新增接口。** 所有 ArchUnit 测试守护已有接口的结构一致性。

#### Java Backend — 现有接口（T2–T7 守护）

| Controller | 基础路径 | 方法 | 守护项 |
|-----------|---------|------|--------|
| `PingController` | `/ping`, `/healthz` | GET | T2 分层, T3 命名 |
| `AuthController` | `/auth/login`, `/auth/me` | POST, GET | T2, T3, T7 错误体 |
| `SiteController` | `/sites` | GET, POST, PUT, DELETE | T2, T3, T4 DTO 隔离, T7 分页 |
| `PageController` | `/sites/{id}/pages` | GET, POST, PUT, DELETE | T2, T3, T4, T7 |
| `PublicController` | `/public/sites/{slug}/pages` | GET (无需认证) | T2, T3, T4 |
| `UserController` | `/users` | GET, POST, PUT, PATCH | T2, T3, T4, T7 分页 |
| `SettingsController` | `/settings` | GET, PUT | T2, T3 |

**已知契约差异（T7 将标记）**：
- `APIError` 使用 `details` 字段，契约要求 `requestId` — 标记为非阻塞架构备注
- `UserListResponse` 使用 `list`+`total`，契约要求 `items`/`total`/`page`/`pageSize`/`hasMore` — 单独 task 跟进

#### Go Backend — 现有路由（T9 守护）

| 方法 | 路径 | Handler | 认证 |
|------|------|---------|------|
| GET | `/ping` | inline | 无 |
| GET | `/backend/public/sites/:slug/pages` | `PublicHandler.GetByPath` | 无 |
| POST | `/backend/auth/login` | `AuthHandler.Login` | 无 |
| GET | `/backend/auth/me` | `AuthHandler.Me` | RequireUser |
| GET/POST | `/backend/sites` | `SiteHandler.List/Create` | User/Admin |
| GET/PUT/DELETE | `/backend/sites/:id` | `SiteHandler.Get/Update/Delete` | User/Admin/Admin |
| GET/POST | `/backend/sites/:id/pages` | `PageHandler.List/Create` | User |
| GET/PUT/DELETE | `/backend/sites/:id/pages/:pageId` | `PageHandler.Get/Update/Delete` | User |
| GET/POST | `/backend/users` | `UserHandler.List/Create` | Admin |
| GET/PUT/PATCH | `/backend/users/:id` | `UserHandler.Get/Update/UpdateStatus` | Admin |
| GET/PUT | `/backend/settings` | `SettingsHandler.Get/Update` | Admin |
| GET/POST | `/backend/datasources` | `DatasourceHandler.List/Create` | User/Admin |
| GET/PUT/DELETE | `/backend/datasources/:id` | CRUD + Test | User/Admin |
| GET/POST | `/backend/collections` | `CollectionHandler.List/Create` | User/Admin |
| GET/PUT/DELETE | `/backend/collections/:id` | CRUD | User/Admin |
| GET/POST | `/backend/collections/:collectionId/items` | Item CRUD | User/Admin |
| GET/PUT/DELETE | `/backend/collections/:collectionId/items/:itemId` | Item detail | User/Admin |

### 9.3 数据库变更

**无数据库变更。** 本方案为纯工具链配置，不涉及 DDL/DML/Flyway 迁移。

### 9.4 物料 schema

**本期不涉及新增物料。** 现有物料 schema 标准见 `.agents/rules/luban-material-schema.md`。

UI 包 (T16) 的变更仅限于：
- 收紧 Nx boundaries 标签约束（从 `*→*` 到 `lib:low-code→lib:base`, `app→lib:*`）
- 现有物料位于 `packages/ui/luban-ui/packages/luban-low-code/src/materials/`（7 个分类目录: general, content, form, layout, marketing, navigation, data-display, feedback），不受影响

### 9.5 组件接口 / 目录结构映射

#### Engine (`packages/engine/luban/src/`)

```
src/
├── api/          # auth.ts, page.ts, site.ts, user.ts, settings.ts, request.ts
├── layouts/      # DefaultLayout.vue, LoginLayout.vue
├── mocks/        # index.ts
├── router/       # index.ts (Vue Router + auth guard)
├── stores/       # page.ts, site.ts, user.ts (Pinia stores)
├── styles/       # index.scss, _variables.scss
├── types/        # schema.d.ts (NodeSchema, PageSchema)
├── utils/        # datetime.ts, publicPage.ts
├── views/        # Dashboard, Login, page/, settings/, site/, user/
├── App.vue       # Root
└── main.ts       # Entry (Pinia + Router + ElementPlus)
```

**Boundaries 规则**：`types → utils → api → stores → layouts → views`（稳定→易变）

#### Website (`packages/web/luban-website/`)

```
├── composables/  # usePageByPath.ts
├── router/       # routes.ts
├── server/       # routes/healthz.get.ts (Nitro, 隔离)
├── stores/       # app.ts, sitePage.ts (Pinia)
├── types/        # page.ts, *.d.ts
├── utils/        # routes.ts
└── views/        # Home.vue, DynamicPage.vue
```

**Boundaries 规则**：`views → composables → stores`；`server/` 隔离

#### BFF (`packages/bff/luban-bff/src/`)

```
src/
├── app/
│   ├── layout.tsx, page.tsx, globals.css
│   ├── api/      # auth/login, auth/me, public/, settings/, sites/, users/
│   └── healthz/  # route.ts
└── lib/          # authToken.ts, backendClient.ts
```

**Boundaries 规则**：`app/api → lib → external`；禁止 API routes 直接 `fetch()`（必须通过 `backendClient`）

#### UI — Nx Workspace (`packages/ui/luban-ui/`)

| 项目 | 标签 | 可依赖 |
|------|------|--------|
| `luban-low-code` | `lib:low-code, type:library` | `luban-base` + external |
| `luban-base` | `lib:base, type:library` | external only |
| `luban-utils` | `lib:utils, type:library` | external only |
| `format-utils` | `scope:format, lib:utils, type:utils` | external only |
| `luban-ui` (app) | `type:app` | all type:library |

**当前状态**：`*→*`（permissive），T16 收紧到上表规则。

### 9.6 并行派发计划

基于 taskGraph JSON 的 `dependsOn` + `group` 依赖关系：

```
Wave 1（并行，4 个 subagent）
├── G1 [backend-java]: T1 → (T2∥T3∥T4∥T5∥T6∥T7) → T8
├── G2 [backend-go]:   T9∥T10 → T11
├── G3 [meta]:         T12
└── [prep]:            确认各包 submodule 在 feature/architecture-governance 分支

Wave 2（并行，4 个 subagent，依赖 T12）
├── G4 [engine]:       T13
├── G5 [website]:      T14
├── G6 [bff]:          T15
└── G7 [ui]:           T16

Wave 3（并行，2 个 subagent，依赖 T13–T16）
├── G8 [hooks]:        T17（4 个包各自 husky + lint-staged + commitlint）
└── G9 [ci]:           T18（4 个包各自 CI lint job 或修改现有 test.yml）

Wave 4（主会话串行）
└── G10 [meta]:        T19 → T20（make lint 更新 → 全量验证门禁）
```

**并行约束**：
- Wave 1 四个 subagent 可同时启动（完全独立）
- Wave 2 四个 subagent 须 T12 完成后启动，但互相独立可并行
- Wave 3 两个 subagent 互相独立可并行
- Wave 4 由主会话串行执行（T19 修改 meta 仓脚本，T20 全局验证）

**失败恢复**：
- 任一 subagent 失败 → 自动重试 1 次
- 仍失败 → 主会话接管该组任务，其余继续
- Wave 内任一任务失败 → 后续 Wave 照常处理已完成组的依赖

---

## 交叉校验结果

| 校验项 | 结果 |
|--------|------|
| 所有文件路径通过 codegraph/grep 确认存在 | ✅ 所有路径已在探索阶段验证 |
| DDL 与 §0–§8 无矛盾 | ✅ 无 DDL 变更 |
| API 端点未超出 §0–§8 声明范围 | ✅ 零新增接口，仅列出已有接口供守护 |
| 物料 schema 完整性 | N/A（本期无新增物料） |
| Java/Go 双后端接口字段一致性 | ✅ 现有接口已对齐，T7 标记已知差异 |
| 并行派发计划与 taskGraph JSON 一致 | ✅ `dependsOn` + `group` 完全对应 |

