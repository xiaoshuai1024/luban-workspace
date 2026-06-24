---
name: "source-command-website-e2e"
description: "SSR 站点端到端（packages/web/luban-website，Playwright，依赖 BFF/后端；默认无头，TDD 与失败先收集再分析）"
---

# source-command-website-e2e

Use this skill when the user asks to run the migrated source command `website-e2e`.

## Command Template

在**主仓库根目录**或 **`packages/web/luban-website/`** 执行（需本机 BFF + 后端，或让 Playwright 自动 `webServer` 起 dev）。

**后端未监听或健康检查失败时**：`pnpm run test:e2e` 会非零退出（`globalSetup` 抛错），**禁止**依赖「未起后端 → 全体 skip → 退出码 0」。须先启动本地 BFF + 后端（Java `mvn spring-boot:run` 或 Go `go run`），待健康检查可用后再跑。**TDD 中若改过后端**，再次跑 E2E 前 **须重启对应后端**。

```bash
cd packages/web/luban-website && pnpm run install:e2e   # 首次：playwright install
cd packages/web/luban-website && pnpm run test:e2e
```

- **浏览器（MUST）**：website E2E **一律本机 Google Chrome**（`channel: "chrome"`），无头/有头相同；详见 `docs/E2E_AGENT_GUIDE.md` §4.0。CI 无 Chrome：`pnpm run test:e2e:ci`。
- **默认无头**（`playwright.config`）。需要**有界面**调试：`pnpm run test:e2e:headed`。
- **首个失败即停**：默认 `maxFailures: 1`；要看全部失败列表时设置 `NO_BAIL=1`（或包内约定的等价环境变量）。
- **API base**：`globalSetup` 探测 BFF/后端健康 URL；后端不在本机时设置 `WEBSITE_E2E_API_BASE`，须与 SSR 代理目标一致。
- **并行加速**：默认多 worker 跨 spec 文件并行。显式控制：`WEBSITE_E2E_WORKERS=6 pnpm run test:e2e`；强制串行排障：`pnpm run test:e2e:serial` 或 `WEBSITE_E2E_WORKERS=1`。详见 `docs/E2E_AGENT_GUIDE.md` §4.3。
- 已有 SSR dev server 且不想再起：`SKIP_WEBSITE_E2E_SERVER=1`。
- **`SKIP_WEBSITE_E2E=1`**：**仅**流水线等无法在 Job 内启动后端时使用（PR 须说明）；**禁止**本地/Agent 默认用来逃避联调；**禁止**将「全体 skip」当 website E2E 通过。

### 引擎渲染一致性门槛（MUST）

1. **零新增 console error**：SSR 渲染页面不得产生新的 console error。
2. **物料渲染一致**：website 渲染的物料须与引擎渲染、各 client 渲染一致（见 `.agents/rules/luban-multi-client-consistency.md`）。

### TDD 与失败处理（MUST）

1. 先**红**后**绿**：改行为前先补/调测试，再最小实现。任一条红则**先修该条**，单条/单文件重跑**绿**后再跑**完整** `pnpm run test:e2e`。
2. 失败时**先收集再分析**（与 `AGENTS.md` 一致）：**Console** → **Network** → **后端日志**（Java/Go；**优先 `requestId`**，`ts=` 含义见 `docs/E2E_AGENT_GUIDE.md` §3.1）；禁止未看证据就改断言。

**你必须：** 在 `packages/web/luban-website` 下执行并贴出**完整终端结果**；若红，按上条顺序说明已收集的线索再动代码或配置。

策略：GitHub/PR 与本地服务无关；不直接 `gh`。
