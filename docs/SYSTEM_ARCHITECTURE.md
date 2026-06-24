# Luban 系统架构与服务拓扑

> 本文档记录 luban-workspace 各子系统的**角色、端口、依赖、配置文件、启动方式**。
> 是本地开发、联调、E2E 排查的单一事实来源（SSOT）。
> 最后更新：2026-06-21。如端口/配置变更，请同步更新本文与 `Makefile`。

---

## 1. 系统总览（谁是谁）

```
                        ┌─────────────────────────────────────────────────────┐
                        │            中间件层（远端 dev 服务器）                  │
                        │   192.168.100.248                                    │
                        │     MySQL :13306  (db=luban, user=root)             │
                        │     Redis :16379                                     │
                        └───────────────▲─────────────────────▲───────────────┘
                                        │                     │
                          ┌─────────────┴────────┐  ┌─────────┴──────────┐
                          │  Java 后端 :8080      │  │  Go 后端 :8081      │  ← 双后端契约对齐
                          │  /backend/*           │  │  /backend/*         │     (Go 为部分实现)
                          └─────────────▲────────┘  └─────────▲──────────┘
                                        │                     │
                          ┌─────────────┴──────────────────────┴──────────┐
                          │           BFF :3100  (Next.js)                  │  ← 聚合/鉴权/转码
                          │  BACKEND_BASE_URL → http://127.0.0.1:8080/backend│
                          └──────────▲──────────────────────▲──────────────┘
                                     │                      │
            ┌────────────────────────┴────┐     ┌───────────┴────────────────┐
            │  engine :5173 (Vue SPA)      │     │  website :3000 (Nuxt SSR)  │
            │  运营后台 + /designer 设计器   │     │  访客公开站点（SSR 渲染）    │
            │  /api → proxy → BFF:3100     │     │  bffBaseUrl → BFF:3100     │
            └──────────────────────────────┘     └────────────────────────────┘
                     ▲                                       ▲
                     │ Cypress :5173                         │ Playwright :3000
                     └───────────── E2E ─────────────────────┘
```

**5 个应用服务 + 2 个中间件**：

| # | 系统 | 角色 | 本机 dev 端口 | 部署形态 |
|---|------|------|--------------|----------|
| 1 | **engine** (`luban`) | Vue 3 SPA — 运营后台 + 全屏设计器 `/designer` | **5173** | 本机 dev 裸进程 |
| 2 | **bff** (`luban-bff`) | Next.js BFF — 鉴权/聚合/转码，转调后端 | **3100** | 本机 dev 裸进程 |
| 3 | **website** (`luban-website`) | Nuxt 3 SSR — 访客公开站点 | **3000** | 本机 dev 裸进程 |
| 4 | **Java 后端** (`luban-backend`) | Spring Boot REST — 主实现 | **8080** (ctx `/backend`) | 本机 dev 裸进程 (mvn) |
| 5 | **Go 后端** (`luban-backend-go`) | Gin 双实现 — 契约对齐 | **8081** | 本机 dev 裸进程 |
| 6 | MySQL | 共享 RDBMS | **13306**（远端 dev 服务器） | 192.168.100.248 |
| 7 | Redis | 缓存/会话 | **16379**（远端 dev 服务器） | 192.168.100.248 |

> **端口设计原则**：本机 dev 全部用裸进程，端口互不冲突（5173/3100/3000/8080/8081）。**禁止本机起 docker**；中间件在远端 dev 服务器，本机应用的连接串指向远端。

---

## 2. 各系统详解

### 2.1 engine — 运营后台 / 设计器

| 项 | 值 | 配置来源 |
|----|----|---------|
| 包名 | `luban` | `packages/engine/luban/package.json:2` |
| 角色 | Vue 3 + Vite SPA；运营后台（站点/页面/线索/用户）+ 全屏设计器 | — |
| dev 端口 | **5173**（vite 默认，无 port flag） | `vite.config.ts:19` |
| preview 端口 | 4200 | `vite.config.ts:15` |
| API 入口 | `/api`（axios baseURL = `VITE_API_BASE_URL ?? '/api'`） | `.env:1`、`src/api/request.ts:17` |
| dev 代理 | `/api` → `http://localhost:3100`（BFF） | `vite.config.ts:21-26` |
| 鉴权 | localStorage key `luban_token`，axios 拦截器加 `Bearer` | `src/api/request.ts:3,25-28` |
| 路由 | `/login`、`/`（DefaultLayout 后台）、`/designer`（DesignerLayout 全屏设计器） | `src/router/index.ts` |
| Cypress baseUrl | `http://localhost:5173` | `cypress.config.ts:5` |

**关键路由**：
- `/sites/:siteId/pages` → 页面列表（设计器唯一入口）
- `/sites/:siteId/pages/:pageId` → in-admin 编辑器（PageEditor）
- `/designer/sites/:siteId/pages/:pageId` → 全屏设计器（DesignerLayout，无侧边栏）
- `/sites/:siteId/leads` → 线索中心

---

### 2.2 bff — 聚合层

| 项 | 值 | 配置来源 |
|----|----|---------|
| 包名 | `luban-bff` | `packages/bff/luban-bff/package.json:2` |
| 角色 | Next.js 16 BFF；鉴权(JWT)、聚合后端、公开 submit 端点 | — |
| dev 端口 | **3100**（须显式 `-p 3100`，否则 next 默认 3000 与 website 冲突） | 本文档约定（见 §4 启动） |
| 后端地址 | `BACKEND_BASE_URL ?? "http://127.0.0.1:8080/backend"` | `src/lib/backendClient.ts:3-4` |
| 后端超时 | 15000ms | `src/lib/backendClient.ts:8` |
| next.config | 仅 `output: "standalone"`，无 rewrite/proxy | `next.config.ts:1-7` |

**API 端点**（App Router `src/app/api/`）：
- 鉴权：`auth/login`、`auth/me`
- 站点/页面：`sites`、`sites/[siteId]`、`sites/[siteId]/pages`、`sites/[siteId]/pages/[pageId]`
- 用户：`users`、`users/[id]`、`users/[id]/status`
- 线索：`leads`、`leads/[id]`、`leads/[id]/status`、`leads/export`
- 数据源：`datasources`、`datasources/[id]`、`datasources/[id]/query`、`datasources/[id]/test`
- 表单（公开留资）：`forms`、`forms/[id]`、`forms/[id]/submit`（website 提交 lead）
- 公开页面：`public/sites/[slug]/pages`、`public/sites/[slug]/pages/by-path`
- 代理：`proxy/fetch`（含 `src/lib/ssrfGuard.ts`）
- 设置：`settings`

---

### 2.3 website — 访客 SSR 站点

| 项 | 值 | 配置来源 |
|----|----|---------|
| 包名 | `luban-website` | `packages/web/luban-website/package.json:2` |
| 角色 | Nuxt 3 SSR；渲染已发布页面 + 提交留资 | — |
| dev 端口 | **3000**（nuxt 默认） | — |
| BFF 地址 | `NUXT_PUBLIC_BFF_BASE_URL ?? "http://127.0.0.1:3000"` ⚠️ 默认值错误 | `nuxt.config.ts:13` |
| 默认站点 | `defaultSiteSlug ?? "default"` | `nuxt.config.ts:15` |

> ⚠️ **已知配置陷阱**：`nuxt.config.ts:13` 的 `bffBaseUrl` 默认值为 `http://127.0.0.1:3000`（指向自己），但 BFF 实际在 **3100**。本地 dev 必须设 `NUXT_PUBLIC_BFF_BASE_URL=http://127.0.0.1:3100`，否则 website SSR 拉不到页面（`fetch failed`）。`.env.example:5` 写对了但默认值未对齐。

**路由**（`router/routes.ts:16-27`）：
- `/` → Home
- `/:site/:path*` → DynamicPage（SSR 渲染已发布 schema，含 `<ClientOnly>` 包表单）

**留资提交**：`composables/useLeadSubmit.ts:42-46` 读 `bffBaseUrl`，POST `${bffBase}/api/forms/${formId}/submit`（:71-78）。

---

### 2.4 Java 后端（主实现）

| 项 | 值 | 配置来源 |
|----|----|---------|
| 包路径 | `packages/backend/luban-backend` | — |
| 角色 | Spring Boot + MyBatis + Flyway REST | — |
| 端口 | `${APP_PORT:8080}` | `application.yml:2` |
| context-path | `/backend`（所有路由前缀） | `application.yml:4` |
| MySQL | `jdbc:mysql://${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}` | `application.yml:10` |
| Redis | host `${REDIS_HOST}` port `${REDIS_PORT}` db 0 | `application.yml:20-26` |
| Flyway | enabled，`classpath:db/migration`，baseline-on-migrate | `application.yml:27-31` |

**启动脚本**（`start-mvn.bat` / `start-e2e.bat`）内置远端 dev 中间件连接：
- `APP_PORT=8080`、`MYSQL_HOST=192.168.100.248`、`MYSQL_PORT=13306`、`MYSQL_USER=root`、`MYSQL_PASSWORD=yanhuo123`、`MYSQL_DB=luban`
- `REDIS_HOST=192.168.100.248`、`REDIS_PORT=16379`、`REDIS_PASSWORD=""`
- `start-mvn.bat`：`mvn -q spring-boot:run`（读源码 + Flyway 迁移）
- `start-e2e.bat`：`java -jar target/luban-backend-0.0.1-SNAPSHOT.jar`（预编译）

**Java 21** + Maven 3.9.16（`C:\tools\apache-maven-3.9.16`，`C:\Program Files\Eclipse Adoptium\jdk-21...`）。

---

### 2.5 Go 后端（双实现，契约对齐）

| 项 | 值 | 配置来源 |
|----|----|---------|
| 包路径 | `packages/backend/luban-backend-go` | — |
| 角色 | Gin 双实现；与 Java 同接口行为一致（部分实现） | — |
| 端口 | `APP_PORT=8080`（容器内），主机映射 **8081** | `config/config.go:54`、`.env:2` |
| context-path | `/backend`（与 Java 一致） | `router/router.go:50` |
| MySQL/Redis | 同 Java（192.168.100.248:13306/16379） | `.env:7-17` |

> **Go 是部分实现**：路由含 `/ping`、`/backend/public/sites`、`/backend/auth`、`/backend/sites`、`/backend/users`、`/backend/settings`、`/backend/datasources`。**缺 `/leads`、`/forms`**（lead-capture 在 Go 端明确不做，见 lead-capture plan §0.2）。契约测试须按此 scope。

---

### 2.6 中间件（远端 dev 服务器）

| 中间件 | 远端 dev（日常） | 本地 E2E compose（仅远端可起 docker） |
|--------|------------------|----------------------------------------|
| MySQL | `192.168.100.248:13306` db `luban` root/`yanhuo123` | `mysql:8.0` 主机 3307 |
| Redis | `192.168.100.248:16379` 无密码 | `redis:7-alpine` 主机 6380 |

**SSH**（仓库根 `.env.dev`）：`192.168.100.248`，user `john`。

> **本机禁起 docker / 中间件**。本机应用的 MySQL/Redis 连接串必须指向 `192.168.100.248:13306/16379`，否则连不上（易错点）。

---

## 3. 依赖关系与数据流

### 3.1 启动依赖顺序（先下后上）

```
MySQL/Redis (192.168.100.248，已常驻)
   ↑
Java :8080  (依赖 MySQL/Redis；Flyway 自动迁移)
   ↑
BFF :3100   (依赖 Java :8080/backend)
   ↑
engine :5173  (dev proxy /api → BFF :3100)
website :3000 (bffBaseUrl → BFF :3100)
```

**最小可联调集**：Java + BFF + engine（运营后台基础链路）。
**完整闭环**（含访客留资 SSR）：再加 website。
**双后端契约**：再加 Go :8081（仅 contract 测试场景）。

### 3.2 关键数据流

**设计器发布闭环**（D15-F3 验证）：
```
设计器拖组件 → engine 保存 schema (PUT /api/sites/:sid/pages/:pid via BFF→Java)
  → 发布 (status=published)
  → 访客访问 website /:slug/:path
  → website SSR (bffBaseUrl) GET /api/public/sites/:slug/pages/by-path (via BFF→Java)
  → DynamicPage 渲染 schema (RuntimeRenderer)
```

**LeadCapture 留资提交**（D15-E3 链路）：
```
访客填 LeadCapture 表单 → emit('submit', fields)
  → RuntimeRenderer @submit → provide('lubanFormSubmit') handler
  → useLeadSubmit.submit(formId, contact)
  → POST ${bffBaseUrl}/api/forms/:formId/submit (BFF)
  → callBackend /lead/forms/:id/submit (Java)
  → 落库 + 去重(dedup 手机号) + 加密
```

---

## 4. 启动方式（Makefile 快捷命令）

本机 dev 全部裸进程。**Makefile 已提供一键启动 target**（见 `Makefile` §dev）。

### 4.1 单服务启动

| 命令 | 启动 | 端口 | 说明 |
|------|------|------|------|
| `make dev-java` | Java 后端 | 8080 | `start-mvn.bat`，含远端中间件 env，mvn spring-boot:run |
| `make dev-go` | Go 后端 | 8081 | `APP_PORT=8081 go run .`（可选，契约测试用） |
| `make dev-bff` | BFF | 3100 | `PORT=3100 next dev`（显式 3100，避免与 website 3000 冲突） |
| `make dev-engine` | engine | 5173 | `vite`（proxy /api → 3100） |
| `make dev-website` | website | 3000 | `NUXT_PUBLIC_BFF_BASE_URL=http://127.0.0.1:3100 nuxt dev`（修正默认值错误） |

### 4.2 全栈一键启动

```bash
make dev-apps          # 并行起 Java + BFF + engine + website（4 个核心应用，trap 统一清理）
```

### 4.3 启动顺序（手动分步）

```bash
# 1. 先起 Java（Flyway 自动建表，~30-60s）
make dev-java
# 等 http://localhost:8080/backend/actuator/health 返回 UP

# 2. 起 BFF（依赖 Java）
make dev-bff
# 等 http://localhost:3100 可访问

# 3. 起 engine + website（并行）
make dev-engine &
make dev-website
```

### 4.4 健康检查

```bash
make dev-check         # 探测 Java/BFF/engine/website 是否 UP（200/302/404 = OK）
```

### 4.5 E2E 运行

```bash
# 前置：dev-apps 全起 + 中间件远端可达
cd packages/engine/luban
set CYPRESS_NO_V8_COMPILE_CACHE=1     # Node24 必须，绕 Cypress v8 cache 问题
npx cypress run --browser electron     # Cypress 15+ 兼容 Node24
```

---

## 5. 端口速查表

| 端口 | 服务 | 进程 | 备注 |
|------|------|------|------|
| **5173** | engine | `vite` | dev；preview=4200 |
| **3100** | bff | `next dev -p 3100` | 必须显式 3100 |
| **3000** | website | `nuxt dev` | nuxt 默认 |
| **8080** | Java 后端 | `mvn spring-boot:run` | ctx `/backend` |
| **8081** | Go 后端 | `go run .` | 双后端契约测试 |
| **13306** | MySQL | 远端 192.168.100.248 | db `luban` |
| **16379** | Redis | 远端 192.168.100.248 | 无密码 |

---

## 6. 已知问题与陷阱

1. **bff vs website 默认都 3000** — Makefile 的 `dev-bff` 显式 `-p 3100` 已修复；勿直接 `pnpm dev`（会撞 website）。
2. **website `bffBaseUrl` 默认值错误**（`nuxt.config.ts:13` 写 3000 应为 3100）— Makefile 的 `dev-website` 用 env 覆盖；根因待修（建议直接改默认值）。
3. **engine proxy 锁定 3100**（`vite.config.ts:23`）— 所以 BFF 必须在 3100，不能 3000。
4. **Go 缺 `/leads` `/forms`** — 契约测试 scope 须排除这两个。
5. **本机禁 docker / 中间件** — 连接串指向 192.168.100.248，勿用 localhost。
6. **Node24 + Cypress** — 须 Cypress ≥15 + `CYPRESS_NO_V8_COMPILE_CACHE=1`；Cypress 13/14 的 Electron smoke-test 在 Node24 下崩溃。
7. **`e2e/.env` 头注释 stale** — 写 engine=4200，实际 LUBAN_E2E_ENGINE_URL=5173。

---

## 7. 环境变量清单

| 变量 | 作用 | 默认值 | 谁用 |
|------|------|--------|------|
| `APP_PORT` | Java/Go 端口 | 8080 | Java `application.yml`、Go `config.go` |
| `MYSQL_HOST` / `MYSQL_PORT` / `MYSQL_DB` / `MYSQL_USER` / `MYSQL_PASSWORD` | MySQL 连接 | localhost:3306（dev 脚本覆盖为 192.168.100.248:13306） | Java/Go |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis 连接 | localhost:6379（dev 脚本覆盖为 192.168.100.248:16379） | Java/Go |
| `BACKEND_BASE_URL` | BFF 转发后端地址 | `http://127.0.0.1:8080/backend` | BFF `backendClient.ts` |
| `BACKEND_TIMEOUT_MS` | BFF 调后端超时 | 15000 | BFF |
| `VITE_API_BASE_URL` | engine API 入口 | `/api` | engine |
| `NUXT_PUBLIC_BFF_BASE_URL` | website 调 BFF 地址 | `http://127.0.0.1:3000` ⚠️（应为 3100） | website |
| `LUBAN_E2E_ACCOUNT` / `LUBAN_E2E_PASSWORD` | E2E 登录账号 | `e2e` / `e2e@2026` | Cypress `cypress.config.ts` |
| `CYPRESS_NO_V8_COMPILE_CACHE` | Node24 绕 Cypress v8 cache | （须设 1） | Cypress runner |
| `PORT` | Next.js / Node 服务端口 | 3000 | BFF（须设 3100） |

---

## 8. 维护约定

- 端口/配置变更 → **同步更新本文档 + Makefile**（两者必须一致）。
- 新增服务 → 在 §2 加详情、§5 加端口、Makefile 加 `dev-<name>` target。
- 中间件地址变更 → 更新 Java/Go 启动脚本 + §2.6 + §7。
