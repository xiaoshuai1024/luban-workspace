---
featureId: unit-test-80pct
title: Wave 3: 单测覆盖率提升到 80%
parentProgram: production-readiness-program
createdAt: 2026-06-26
status: draft
---

# Wave 3: 单测覆盖率提升到 80%

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** 所有 5 个模块单测 line 覆盖率从当前 10-20% 提升到 80%，覆盖率阈值从渐进式（10-20%）提升到最终值（80%）。

**Architecture:** 按模块并行推进，每个模块的 subagent 负责：补齐缺失测试 → 跑覆盖率 → 调整到 80% → 提升阈值。

---

## §1 当前覆盖率缺口

| 模块 | 当前 | 目标 | 缺口（需补的测试） |
|------|:---:|:---:|---------|
| Java Backend | ~16% | 80% | 20 个 service 无测试（PageService, UserService, SiteService, SettingsService, AuthService, CollectionService, DatasourceService, AnalyticsService, FormService, AbService 等）；所有 controller 无单测 |
| Engine | ~13% | 80% | 9 个 .vue view 无测试；3 个 store 无测试；5 个 API 模块无测试 |
| BFF | ~10% | 80% | 46/47 路由无测试；仅 proxy/fetch 有测试 |
| Website | ~15% | 80% | DynamicPage, usePageByPath, useLeadSubmit, useFeatureGate 无测试 |
| UI | ~20% | 80% | 28/34 物料无测试；RuntimeRenderer, DesignRenderer 无测试 |

---

## §2 并行执行计划

```
Wave 3a（并行，5 个 subagent）:
  ├── Java: 补 service + controller 测试
  ├── Engine: 补 view + store + api 测试
  ├── BFF: 补路由测试
  ├── Website: 补 composable + view 测试
  └── UI: 补物料测试

Wave 3b:
  └── 全栈覆盖率验证 + 阈值提升到 80%
```

---

## Tasks（按模块）

### Java Backend (T1-T4)

**T1: Service 层测试补齐（优先 P0 service）**
为以下 service 写单测（Mockito mock mapper，验证业务逻辑）：
- `PageService` — create/update/delete/publish/unpublish/getPreviewDraft
- `PageVersionService` — list/get/rollback/createSnapshot
- `SiteService` — list/get/create/update/delete（含 @Transactional 验证）
- `UserService` — CRUD + status update
- `SettingsService` — get/update（含 Redis cache）
- `AuthService` — login/me
- `CollectionService` — CRUD + items
- `DatasourceService` — CRUD + testConnection

**T2: Controller 层测试补齐**
用 MockMvc 或 @WebMvcTest 测每个 controller 的端点：
- 输入校验（@Valid 失败 → 400）
- 错误映射（BusinessException → 正确 HTTP status）
- 认证检查

**T3: 覆盖率验证 + 阈值提升**
Run: `mvn -q verify` → 检查 jacoco 报告 → 如 < 80% 补测试 → 达标后将 pom.xml 阈值从 0.15 改为 0.80

**T4: Commit**

### Engine SPA (T5-T8)

**T5: Store 测试补齐**
- `stores/page.ts` — setPageList/setCurrentSchema
- `stores/site.ts` — setCurrentSite/setSiteList
- 补 `stores/user.ts` — isAdmin 计算属性、persist 行为

**T6: API 模块测试补齐**
为每个 API 模块写 mock 测试（vitest + axios mock）：
- `api/auth.ts`, `api/page.ts`, `api/site.ts`, `api/user.ts`, `api/settings.ts`
- 含 publish/unpublish/preview/versions/rollback

**T7: View 组件测试补齐**
用 @vue/test-utils mount 测试关键交互：
- `Login.vue` — 表单提交 + 错误提示
- `Dashboard.vue` — 统计数据加载
- `SiteList.vue` — CRUD 操作
- `PageList.vue` — 发布/下线操作
- `PageEditor.vue` — 保存/发布
- `UserList.vue` — CRUD
- `Settings.vue` — 保存
- `VersionHistoryDrawer.vue` — 列表 + 回滚
- `PagePreview.vue` — 草稿渲染

**T8: 覆盖率验证 + 阈值提升到 80%**

### BFF (T9-T10)

**T9: 路由测试补齐**
为每个 API 路由写测试（Next.js route handler testing）：
- 认证检查（无 token → 401）
- happy path（正确请求 → 200 + 正确 body）
- 后端错误映射（BackendHttpError → 正确 status）
- 优先覆盖：auth/login, auth/me, sites, pages (含 publish/unpublish), users, settings, leads, forms/submit

**T10: 覆盖率验证 + 阈值提升到 80%**

### Website (T11-T12)

**T11: Composable + View 测试补齐**
- `usePageByPath` — 成功/404/缓存
- `useLeadSubmit` — 提交 + 错误
- `useFeatureGate` — 开关查询
- `useAbAssign` — 分桶
- `DynamicPage.vue` — 渲染 + SEO meta + 404 状态

**T12: 覆盖率验证 + 阈值提升到 80%**

### UI 物料库 (T13-T15)

**T13: 物料组件测试补齐**
为 28 个无测试物料写 mount 测试（@vue/test-utils）：
- 验证 props 默认值
- 验证渲染输出（关键 DOM 结构）
- 验证交互（click/submit）
- 优先级：form 系物料（form, input, select, checkbox） > marketing 物料（hero, cta, lead-capture） > layout 物料

**T14: 渲染器测试补齐**
- `RuntimeRenderer` — 渲染正常 schema + 未知组件降级 + ErrorBoundary
- `DesignRenderer` — 渲染 + 选中 + ErrorBoundary

**T15: 覆盖率验证 + 阈值提升到 80%**

---

## §3 验证

```bash
# Java
cd packages/backend/luban-backend && mvn -q verify  # JaCoCo check 80%
# Engine
cd packages/engine/luban && pnpm run test:coverage  # vitest thresholds 80%
# BFF
cd packages/bff/luban-bff && pnpm run test:coverage
# Website
cd packages/web/luban-website && pnpm run test:coverage
# UI
cd packages/ui/luban-ui && pnpm run test:coverage
```

所有包覆盖率 ≥ 80% line，阈值 check 通过。
