---
description: 低代码引擎渲染端到端（packages/engine/luban，Playwright，依赖 BFF/后端；含环境预检与 TDD）
---

**说明：** `/engine-e2e` 跑的是 **`packages/engine/luban` 低代码引擎渲染** 自动化（Playwright），**不是**后端的集成测。若需要 **Java/Go 后端接口集成测**，在对应后端包执行 `mvn -q verify` / `go test ./...`。

### 1. 环境初始化（Agent 须协助用户完成）

在 **`packages/engine/luban`** 下：

1. `pnpm install`
2. 安装/配置 **Playwright**（首次：`pnpm exec playwright install`，按需浏览器）
3. 启动引擎渲染 dev server（按包内 `pnpm dev` 或文档约定端口）
4. 按需启动 **BFF**（`packages/bff/luban-bff`）与 **后端**（Java `mvn spring-boot:run` 或 Go `go run`），引擎渲染依赖的数据来源
5. 国内网络：为终端设置 `HTTPS_PROXY` / `HTTP_PROXY`，并 `NO_PROXY=localhost,127.0.0.1,::1`

**预检（推荐先跑）** — 在主仓库根或引擎包：

```bash
bash scripts/e2e/engine-render-preflight.sh
# 或
cd packages/engine/luban && pnpm run e2e:preflight
```

通过后再跑 E2E。

### 2. 执行引擎渲染 E2E

在主仓库根或 `packages/engine/luban`：

```bash
cd packages/engine/luban && pnpm run test:e2e
```

可见窗口排障（可选）：

```bash
cd packages/engine/luban && pnpm run test:e2e:headed
```

### 引擎渲染门槛（MUST）

1. **零新增 console error**：渲染器渲染测试用例的物料时不得产生新的 console error（见 `.agents/rules/luban-lowcode-engine-quality.md`）。
2. **物料 schema 合规**：E2E 涉及的物料 props 须有完整 schema（见 `.agents/rules/luban-material-schema.md`）。
3. **各端渲染一致**：同一 schema 在 website、electron、flutter 渲染须一致（本命令聚焦引擎渲染，多端对照见 `/website-e2e` 与各 client E2E）。

### TDD 与失败处理（MUST）

1. **首个失败即停**。先修当前步，再全量重跑。
2. 失败时**先收集再分析**：**Playwright Trace / Console** → **Network**（API 失败、物料加载失败）→ **后端日志**（Java/Go）；**优先 `requestId`** 对齐，`ts=` 为服务端写日志时刻，见 `docs/E2E_AGENT_GUIDE.md` §3.1。禁止未看日志就改脚本断言。

**你必须：** 执行预检 + E2E 命令并贴**完整输出**；若红，按上条列出已收集的 Console/Network/日志要点。

策略：与 GitHub/PR 无关；不直接 `gh`。
