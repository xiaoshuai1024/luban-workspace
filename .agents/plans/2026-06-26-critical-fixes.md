---
featureId: critical-fixes
title: Wave 2: 15 项致命问题修复
parentProgram: production-readiness-program
createdAt: 2026-06-26
status: draft
---

# Wave 2: 15 项致命问题修复

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** 清零审查报告中 15 项 🔴 致命问题，使产品达到"可用"基线。

**Architecture:** Java 修复事务/tenant 隔离/校验；Engine 加路由守卫/状态持久化/mock 补齐；BFF 加 CORS/限流/JWT 守卫；Website 修复 SSR/404；UI 加 ErrorBoundary。

---

## §1 致命问题清单与 task 映射

| # | 模块 | 问题 | Task |
|---|------|------|------|
| 1 | Java | SiteService.delete 无 @Transactional | T1 |
| 2 | Java | PublicController 直接注入 SiteMapper | T2 |
| 3 | Java | 6 个 controller 缺 @Valid | T3 |
| 4 | Java | Ab/Datasource.test 缺 tenant 隔离 | T4 |
| 5 | Java | 5 处 catch(Exception ignored) 吞错误 | T5 |
| 6 | Engine | 无 admin 路由守卫 | T6 |
| 7 | Engine | user store 不持久化 | T7 |
| 8 | Engine | /auth/me 失败即强制登出 | T8 |
| 9 | Engine | Dashboard console.log + 无错误处理 | T9 |
| 10 | Engine | mock 缺 publish/unpublish/preview 处理器 | T10 |
| 11 | Engine | 硬编码颜色 → CSS 变量 | T11 |
| 12 | BFF | 无 CORS 配置 | T12 |
| 13 | BFF | 8 个路由缺 try/catch | T13 |
| 14 | BFF | JWT secret 默认值 fallback | T14 |
| 15 | Website | SSR ClientOnly 导致空 HTML | T15 |
| 16 | Website | 404 返回 HTTP 200 | T16 |
| 17 | UI | RuntimeRenderer 无 ErrorBoundary | T17 |
| 18 | UI | DesignRenderer 无 ErrorBoundary | T18 |

---

## §2 并行执行计划

```
Wave 2a（并行，3 组）:
  ├── Java 致命修复 (T1-T5)
  ├── Engine 致命修复 (T6-T11)
  └── BFF+Website+UI 致命修复 (T12-T18)

Wave 2b:
  └── 全栈验证
```

---

## Tasks（摘要级，详细代码在实现时给出）

### Java Backend (T1-T5)

**T1: SiteService.delete 加 @Transactional**
- Modify: `service/SiteService.java` — 在 `delete()` 方法加 `@Transactional(rollbackFor = Exception.class)`

**T2: PublicController 去除 SiteMapper 直接依赖**
- Modify: `controller/PublicController.java` — 将 `siteMapper.getBySlug()` 改为注入 `SiteService` 或 `PublicPageService`
- Modify: `architecture/LayerDependencyTest.java` — 恢复 controller→mapper 守护规则

**T3: 6 个 controller 加 @Valid**
- Modify: `UserController.java` — PUT 加 `@Valid`
- Modify: `dto/UserUpdateRequest.java` — 加 `@NotBlank`/`@Pattern` 校验
- Modify: `AbController.java` — createExperiment 加 `@Valid`
- Modify: `dto/AnalyticsEventInput.java` — 加 `@NotBlank eventType`
- Modify: `AnalyticsController.java` — LocalDate 解析加 try/catch
- Modify: `DatasourceController.java` — test 加 siteId

**T4: Ab/Datasource tenant 隔离**
- Modify: `AbController.java` — getExperiment/endExperiment 加 siteId 查询参数
- Modify: `DatasourceController.java` — test 加 siteId 路径参数

**T5: catch(Exception ignored) → log.warn**
- Modify: `LeadService.java`, `PublicController.java`, `PageService.java`, `PublicPageService.java` — 5 处改为 `log.warn("...", e)`

### Engine SPA (T6-T11)

**T6: admin 路由守卫**
- Modify: `router/index.ts` — `/users` 和 `/settings` 加 `meta: { requiresAdmin: true }`；`beforeEach` 检查 `userStore.isAdmin`

**T7: user store 持久化**
- Modify: `stores/user.ts` — 用 localStorage 持久化 username/name/role（或装 pinia-plugin-persistedstate）
- Modify: `package.json` — 加 `pinia-plugin-persistedstate` dep

**T8: /auth/me 失败处理**
- Modify: `main.ts` — getCurrentUser 失败时不清除 auth（只在 401 时清除），加 retry/backoff

**T9: Dashboard 修复**
- Modify: `views/Dashboard.vue` — 移除 console.log；加 try/catch + ElMessage.error；加 loading state

**T10: mock 补齐 publish/unpublish/preview/versions/rollback**
- Modify: `mocks/index.ts` — 加 5 个 API 路由的 mock 处理器

**T11: 硬编码颜色 → CSS 变量**
- Modify: `styles/_variables.scss` — 加完整 token 定义
- Modify: ~25 处 .vue 文件 — 将 `#409eff` 等替换为 `var(--el-color-primary)`

### BFF (T12-T14)

**T12: CORS 配置**
- Modify: `next.config.ts` — 加 `headers()` 返回 CORS 头

**T13: 8 个路由统一 try/catch**
- Modify: `users/route.ts`, `users/[id]/route.ts`, `users/[id]/status/route.ts`, `sites/route.ts`, `sites/[siteId]/route.ts`, `settings/route.ts`, `auth/me/route.ts`, `auth/login/route.ts` — 每个 handler 包 `try { ... } catch (e) { return toBackendResponse(e); }`

**T14: JWT secret fallback 修复**
- Modify: `lib/authToken.ts` — production 下 `AUTH_JWT_SECRET` 为空或默认值时 throw

### Website (T15-T16)

**T15: SSR 修复（移除 ClientOnly）**
- Modify: `views/DynamicPage.vue` — 移除 `<ClientOnly>` 包裹，让 LubanPage 在 SSR 渲染

**T16: 404 状态码**
- Modify: `views/DynamicPage.vue` — error/empty 分支调 `setResponseStatus(404)` 或 `throw createError({ statusCode: 404 })`

### UI 物料库 (T17-T18)

**T17: RuntimeRenderer ErrorBoundary**
- Create: `packages/luban-low-code/src/lib/ErrorBoundary.vue` — Vue onErrorCaptured + fallback slot
- Modify: `RuntimeRenderer.vue` — 每个 `<component :is>` 包裹 `<ErrorBoundary>`

**T18: DesignRenderer ErrorBoundary**
- Modify: `DesignRenderer.vue` — 同上，加 ErrorBoundary 包裹设计画布节点

---

## 验证

每个 task 完成后跑对应模块的测试：
- Java: `mvn -q test`
- Engine: `pnpm run lint && pnpm run build`
- BFF: `pnpm run build`
- Website: `pnpm run build`
- UI: `npx nx run-many --target=test --all`
