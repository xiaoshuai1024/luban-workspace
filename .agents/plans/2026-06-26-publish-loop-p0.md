---
featureId: publish-loop-p0
title: P0 发布闭环：草稿/发布分离 + 发布/下线/预览 + 版本历史前端
createdAt: 2026-06-26
status: draft
taskGraph: docs/superpowers/tasks/publish-loop-p0.json
contractSource: plan-template 命令体 + writing-plans skill + PLAN_WRITING_CONTRACT.md
scope: Java 后端 published_pages 表 + 发布/下线/预览端点；BFF 透传；Engine 发布按钮+版本历史+草稿预览
split: 不拆 child plan（单 plan 覆盖发布闭环全链路）
branches: 各子仓 feature/publish-loop 同名分支
---

# P0 发布闭环 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完整的页面发布闭环——设计者可发布/下线/预览页面，访客只能看到已发布内容，编辑草稿不影响线上。

**Architecture:** 新增 `published_pages` 表存储发布快照（与 `pages` 草稿表分离）；发布 = INSERT...SELECT 从草稿拷贝到发布表；公开接口读 `published_pages`；预览走带认证的草稿查询。三态 status：draft / published / archived。

**Tech Stack:** Java 17 + Spring Boot 3.2.5 + MyBatis + Flyway；Next.js 16 BFF；Vue 3 + Vite Engine；Nuxt 3 Website

---

## §1 需求追溯

| 上游需求 | 来源 | task | E2E 场景 | 验收门禁 |
|---------|------|------|---------|---------|
| 页面可发布，访客可见 | 竞品分析 P0 | T3,T4,T8,T9 | 设计→保存→发布→访客可见 | G3,G4 |
| 草稿/发布数据分离 | Q1 选 B | T1,T2,T3 | 发布后继续编辑草稿，线上不变 | G3 |
| 草稿预览 | 竞品分析 P0 | T4,T11 | 预览未发布页面 | G3,G4 |
| 页面下线 | status archived | T3,T4,T9 | 下线→访客 404 | G3 |
| 版本历史 + 回滚前端 | 竞品分析 P1 | T5,T10 | 查看历史→回滚→草稿恢复 | G4 |
| status 白名单 | 预防拼写错误 | T4 | 非法 status 值被拒 | G3 |
| 发布时不影响草稿 | 草稿/发布分离 | T1,T3 | 发布→编辑→再发布，两版本独立 | G3 |

---

## §2 系统与链路

### 2.1 涉及子系统

| 子系统 | 涉及 | 说明 |
|--------|------|------|
| Java Backend (`luban-backend`) | ✅ | published_pages 表 + publish/unpublish/preview 端点 + status 白名单 |
| BFF (`luban-bff`) | ✅ | publish/unpublish/preview 透传端点 |
| Engine (`luban`) | ✅ | 发布按钮 + 版本历史抽屉 + 草稿预览路由 |
| Website (`luban-website`) | ⚠️ | 无需改动（公开接口读 published_pages，自动生效） |
| UI (`luban-ui`) | ❌ | 无改动 |
| Go Backend | ❌ | 已移除 |

### 2.2 发布链路

```
设计者在 PageEditor 编辑
  ↓ 保存草稿
PUT /backend/sites/:id/pages/:pageId  → pages 表 schema_json 更新
  ↓ 点击"发布"
POST /backend/sites/:id/pages/:pageId/publish
  → PageService.publish()
    → INSERT INTO published_pages (site_id, path, schema_json, ...) SELECT ... FROM pages WHERE id=?
    → UPDATE pages SET status='published', published_at=now()
    → PageVersionService.createSnapshot(summary="发布")
  ↓
访客访问 Website
  GET /api/public/sites/:slug/pages?path=...  (BFF 无认证)
    → Backend GET /backend/public/sites/:slug/pages?path=...
      → PublicPageService → PublishedPageMapper.getBySiteAndPath
        → SELECT FROM published_pages WHERE site_id=? AND path=?  ← 读发布快照
  ↓
设计者继续编辑草稿 → pages.schema_json 变化，published_pages 不变 → 线上稳定
  ↓ 点击"下线"
POST /backend/sites/:id/pages/:pageId/unpublish
  → DELETE FROM published_pages WHERE page_id=?
  → UPDATE pages SET status='archived'
  ↓
访客访问 → published_pages 无记录 → 404
```

### 2.3 预览链路

```
设计者在 PageEditor 点击"预览"
  ↓
新窗口打开 /sites/:siteId/pages/:pageId/preview (Engine 路由)
  ↓ 该页面调 GET /api/sites/:siteId/pages/:pageId/preview (BFF 带认证)
    → Backend GET /backend/sites/:id/pages/:id/preview
      → PageService.getPreview() → 直接返回 pages.schema_json（草稿，不走 published_pages）
  ↓
Engine 预览页用 <LubanPage :schema="draftSchema"> 渲染草稿内容
```

---

## §3 数据模型

### 3.1 新增表：`published_pages`

```sql
CREATE TABLE published_pages (
    id           VARCHAR(36) PRIMARY KEY,
    page_id      VARCHAR(36) NOT NULL,
    site_id      VARCHAR(36) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    path         VARCHAR(512) NOT NULL,
    schema_json  JSON NOT NULL,
    seo_json     JSON,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_by VARCHAR(36),
    UNIQUE KEY uk_pub_site_path (site_id, path),
    KEY idx_pub_page_id (page_id),
    CONSTRAINT fk_pub_page FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
);
```

### 3.2 pages 表变更

```sql
-- 新增发布审计字段
ALTER TABLE pages ADD COLUMN published_at TIMESTAMP NULL;
ALTER TABLE pages ADD COLUMN published_by VARCHAR(36) NULL;

-- status 增加约束（MyBatis 层校验白名单 draft/published/archived）
```

### 3.3 status 三态机

```
         publish()            unpublish()
draft ──────────────→ published ──────────────→ archived
  ↑                                              │
  └──────────── edit (no status change) ─────────┘
                   edit() 可从任意态回到 draft 编辑
```

| 状态 | 含义 | 公开可见 | 可编辑 |
|------|------|:---:|:---:|
| draft | 草稿 | ❌ | ✅ |
| published | 已发布（有 published_pages 快照） | ✅ | ✅（编辑草稿，不影响线上） |
| archived | 已下线（published_pages 记录已删） | ❌ | ✅ |

---

## §4 页面结构

### 4.0 入口表

| 页面 | 路由 | 变更类型 |
|------|------|---------|
| PageEditor | `/sites/:siteId/pages/:pageId` | 修改（加发布/预览按钮 + 版本抽屉） |
| PageList | `/sites/:siteId/pages` | 修改（加发布/下线操作 + 状态标签） |
| 草稿预览 | `/sites/:siteId/pages/:pageId/preview` | 新增 |

### 4.2 列表级交互链（PageList）

```
PageList 表格
  ├─ 列：name | path | status(Badge) | updatedAt | 操作
  ├─ 操作按钮：
  │   ├─ 编辑（→ PageEditor）
  │   ├─ 发布（v-if status !== 'published'）→ 调 publishPage → 刷新列表
  │   ├─ 下线（v-if status === 'published'）→ 确认弹窗 → 调 unpublishPage → 刷新列表
  │   ├─ 预览（v-if status === 'published'）→ 新窗口打开公开 URL
  │   └─ 删除
  └─ status Badge：draft=灰色 | published=绿色 | archived=红色
```

### 4.3 逐页结构

#### PageEditor（修改）

```
┌─────────────────────────────────────────────────┐
│ [页面名称输入] [路径输入]                         │
│ [保存草稿] [发布] [预览草稿] [版本历史] [返回]    │ ← 新增 3 按钮
├─────────────────────────────────────────────────┤
│ 状态指示：[● 已发布] 或 [● 草稿（未发布）]       │ ← 新增状态条
├─────────────────────────────────────────────────┤
│                                                 │
│              LubanDesigner 画布                  │
│                                                 │
└─────────────────────────────────────────────────┘

版本历史抽屉（点击"版本历史"右侧滑出）：
┌─────────────────────────┐
│ 版本历史                 │
├─────────────────────────┤
│ v12  发布  2026-06-26   │ ← 每行：版本号 + 操作类型 + 时间
│ v11  保存  2026-06-25   │
│ v10  回滚  2026-06-25   │
│ ...                      │
│ [查看] [回滚到此版本]    │ ← 操作按钮
└─────────────────────────┘
```

#### 草稿预览页（新增）

```
┌─────────────────────────────────────────────────┐
│ 🔍 草稿预览（未发布内容）          [返回编辑]    │
├─────────────────────────────────────────────────┤
│                                                 │
│        <LubanPage :schema="draftSchema">        │
│        （与 Website DynamicPage 相同渲染）        │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## §5 集成与复用

| 复用件 | 提供方 | 消费方 | 契约 |
|--------|--------|--------|------|
| `PublishedPage` 实体 + Mapper | T2 | T3 PublicPageService | 替代原 PageMapper.getBySiteIdAndPathPublished |
| `PageVersionService.createSnapshot` | 已有 | T5 publish 时调用 | summary="发布" |
| BFF `apiHandler` helpers | 已有 | T6 | authHeaders + toBackendResponse |
| Engine `request` HTTP client | 已有 | T7 | request.post/get |
| Website `usePageByPath` | 已有 | 无需改动 | 自动读 published_pages |

---

## §6 架构边界 + 门禁

### §6.1 架构边界

- publish/unpublish/preview 端点在 PageController 内（controller → service → mapper 分层不变）
- PublishedPageMapper 独立于 PageMapper（不同表，不同查询）
- 草稿编辑（PageService.update）不触碰 published_pages

### §6.2 双后端一致性

Go 后端已移除，本期 parity 规则降级为 Java 单端约束。后续 Go 恢复时需同步实现。

### §6.3 覆盖率门禁

| 子项目 | 门禁 |
|--------|------|
| Java backend | 80% line（含新 publish 端点测试） |
| Engine | 85% line |
| BFF | 85% line |

### §6.4 FeatureGate

| 功能 | key | 作用域 | 关闭行为 |
|------|-----|--------|---------|
| 发布闭环 | `publish-loop` | 全局 | 发布按钮隐藏，回退到仅保存草稿模式 |

回滚方案：关闭 FeatureGate → 发布按钮消失 → 现有保存功能不受影响。

---

## §7 测试计划

### §7.1 单元测试（Java）

| 测试类 | 覆盖 |
|--------|------|
| `PublishMigrationTest` | Flyway 迁移成功 + 已 published 页面回填到 published_pages |
| `PagePublishServiceTest` | publish 写 published_pages + 改 status；unpublish 删 published_pages + 改 archived |
| `PagePublishControllerTest` | POST /publish 返回 200；POST /unpublish 返回 200；非法 status 被 400 拒绝 |
| `PageVersionPublishTest` | 发布时 createSnapshot summary="发布" |

### §7.2 集成测试

| 测试 | 链路 |
|------|------|
| `PublishLoopIT` | 创建页面→保存草稿→发布→公开接口可见→编辑草稿→公开接口不变→下线→公开接口 404 |

### §7.3 E2E 场景

| 场景 | 操作 | 断言 |
|------|------|------|
| 发布闭环 | PageEditor 编辑→保存→点击发布 | status 变 published，预览按钮出现 |
| 草稿隔离 | 发布后编辑草稿→保存 | 线上内容不变（读 published_pages） |
| 下线 | PageList 点击下线 | status 变 archived，预览消失，公开 404 |
| 版本回滚 | 版本历史→选择旧版本→回滚 | 草稿 schema 恢复到旧版本 |

---

## §8 TDD 与执行

### 8.1 执行顺序（依赖链）

```
Wave 1: T1 (Flyway) → T2 (Entity/Mapper)
  ↓
Wave 2: T3 (Service) → T4 (Controller) + T5 (Version 对接)
  ↓
Wave 3: T6 (BFF) → T7 (Engine API) → T8,T9,T10,T11 (并行)
  ↓
Wave 4: T12 (集成测试)
```

### 8.2 Post-Development Workflow

```
代码提交 → /luban-review 清零 → mvn verify → pnpm build (engine/bff/website)
→ pnpm test (engine) → 集成测试 PublishLoopIT → 完成汇报
```

### 8.3 每步验证门

| 步骤 | 验证门 | 模块 |
|------|--------|------|
| Flyway 迁移 | `mvn -q test -Dtest=PublishMigrationTest` | Java |
| Entity/Mapper | `mvn -q compile` | Java |
| Service | `mvn -q test -Dtest=PagePublishServiceTest` | Java |
| Controller | `mvn -q test -Dtest=PagePublishControllerTest` | Java |
| BFF | `pnpm run build` | BFF |
| Engine API | `pnpm run lint` | Engine |
| Engine UI | `pnpm run build` | Engine |
| 集成测试 | `mvn -q test -Dtest=PublishLoopIT` | Java |

---

## 质量禁令自检

- [x] 1. 禁止跳过功能 — 12 个 task 覆盖后端+BFF+Engine 全链路
- [x] 2. 禁止假绿 — 测试含真实 DB 断言（H2），无 skip
- [x] 3. 禁止占位 — 所有端点/SQL/UI 按契约实现
- [x] 4. 禁止骨架 — 发布按钮真实调用 API 并刷新状态
- [x] 5-8. 不适用（无 JSON 页面/无引擎渲染变更/路由为正式路由）
- [x] 9. 门禁分级 — G1-G4 表见下
- [x] 10. /luban-review 清零 — Post-Dev Workflow 第一步
- [x] 11. 安全审查 — 预览端点需 admin 认证（见 §6.1）
- [x] 12. 双后端 — Go 已移除，Java 单端
- [x] 13. 多端渲染 — Website 自动生效，无需改动
- [x] 14. FeatureGate — `publish-loop` key，关闭=隐藏发布按钮

## 分级验收门禁

| 级别 | 名称 | 验证 | 通过条件 |
|------|------|------|---------|
| G1 | 代码审查 | /luban-review | 🔴🟡🔵 清零 |
| G2 | 安全 | 预览端点认证检查 | 非 admin 请求被 401 拒绝 |
| G3 | 单测+集成 | mvn test + pnpm test | Java 80%, Engine 85%, PublishLoopIT PASS |
| G4 | E2E | 发布→可见→下线→404 | 全链路通过 |

## 明确不做（防膨胀）

| 不做项 | 理由 |
|--------|------|
| Go 后端实现 | 已移除 |
| 定时发布 | P2 |
| A/B 测试 | P3 |
| 协作编辑 | P3 |
| 站点级批量发布 | 本期单页 |
| 模板系统 | P2 独立方案 |

## 回滚方案

| 变更 | 回滚 |
|------|------|
| FeatureGate | 关闭 `publish-loop` → 发布按钮消失 |
| Flyway 迁移 | published_pages 表保留（无副作用），status 回退逻辑可删 |
| published_pages 数据 | DELETE FROM published_pages + UPDATE pages SET status='draft' |

---

## §9 实现任务派发

### 9.1 文件变更总览

#### Backend Java (T1–T5)

| Task | File Path (`packages/backend/luban-backend/`) | C/M | Summary |
|------|------|:---:|---------|
| T1 | `src/main/resources/db/migration/V20260626000001__add_published_pages.sql` | C | published_pages 表 + pages 加 published_at/published_by + 回填 |
| T2 | `src/main/java/com/luban/backend/entity/PublishedPage.java` | C | 发布快照实体 |
| T2 | `src/main/java/com/luban/backend/mapper/PublishedPageMapper.java` | C | MyBatis mapper（upsert/getBySiteAndPath/deleteByPageId） |
| T2 | `src/main/java/com/luban/backend/entity/Page.java` | M | 加 publishedAt/publishedBy 字段 |
| T2 | `src/main/java/com/luban/backend/mapper/PageMapper.java` | M | SELECT 加 published_at/published_by 列 |
| T3 | `src/main/java/com/luban/backend/service/PageService.java` | M | 加 publish/unpublish/getPreviewDraft 方法 |
| T3 | `src/main/java/com/luban/backend/service/PublicPageService.java` | M | 改用 PublishedPageMapper 读发布快照 |
| T4 | `src/main/java/com/luban/backend/controller/PageController.java` | M | 加 POST /publish, POST /unpublish, GET /preview |
| T4 | `src/main/java/com/luban/backend/dto/PageStatusRequest.java` | C | status 白名单校验（如需独立 DTO） |
| T5 | `src/main/java/com/luban/backend/service/PageVersionService.java` | M | publish 时调 createSnapshot(summary="发布") |
| T1-T5 | `src/test/java/com/luban/backend/**/*PublishTest.java` | C | 单测 + 集成测试 |

#### BFF (T6)

| Task | File Path (`packages/bff/luban-bff/`) | C/M | Summary |
|------|------|:---:|---------|
| T6 | `src/app/api/sites/[siteId]/pages/[pageId]/publish/route.ts` | C | POST publish 透传 |
| T6 | `src/app/api/sites/[siteId]/pages/[pageId]/unpublish/route.ts` | C | POST unpublish 透传 |
| T6 | `src/app/api/sites/[siteId]/pages/[pageId]/preview/route.ts` | C | GET preview 透传（带认证） |

#### Engine (T7–T11)

| Task | File Path (`packages/engine/luban/`) | C/M | Summary |
|------|------|:---:|---------|
| T7 | `src/api/page.ts` | M | 加 publishPage/unpublishPage/previewPage + getVersions/rollback |
| T8 | `src/views/page/PageEditor.vue` | M | 工具栏加发布/预览/版本历史按钮 + 状态条 |
| T9 | `src/views/page/PageList.vue` | M | 操作列加发布/下线 + 状态标签 3 色 |
| T10 | `src/views/page/VersionHistoryDrawer.vue` | C | 版本历史抽屉组件 |
| T11 | `src/views/page/PagePreview.vue` | C | 草稿预览页面 |
| T11 | `src/router/index.ts` | M | 加 /preview 路由 |

### 9.2 API 契约

| 方法 | 端点 | 认证 | 请求体 | 响应 | 错误码 |
|------|------|:---:|--------|------|--------|
| POST | `/backend/sites/:id/pages/:pageId/publish` | User | `{}` | `PageResponse` (status=published) | PAGE_NOT_FOUND |
| POST | `/backend/sites/:id/pages/:pageId/unpublish` | User | `{}` | `PageResponse` (status=archived) | PAGE_NOT_FOUND |
| GET | `/backend/sites/:id/pages/:pageId/preview` | User | — | `PageResponse` (草稿 schema) | PAGE_NOT_FOUND |
| GET | `/backend/public/sites/:slug/pages?path=` | 无 | — | `PageResponse` (从 published_pages 读) | PAGE_NOT_FOUND |

### 9.3 数据库变更

```sql
-- V20260626000001__add_published_pages.sql

-- 1. 新增 published_pages 表
CREATE TABLE published_pages (
    id           VARCHAR(36) PRIMARY KEY,
    page_id      VARCHAR(36) NOT NULL,
    site_id      VARCHAR(36) NOT NULL,
    name         VARCHAR(255) NOT NULL,
    path         VARCHAR(512) NOT NULL,
    schema_json  JSON NOT NULL,
    seo_json     JSON,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_by VARCHAR(36),
    UNIQUE KEY uk_pub_site_path (site_id, path),
    KEY idx_pub_page_id (page_id),
    CONSTRAINT fk_pub_page FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. pages 表加发布审计字段
ALTER TABLE pages ADD COLUMN published_at TIMESTAMP NULL;
ALTER TABLE pages ADD COLUMN published_by VARCHAR(36) NULL;

-- 3. 回填：已 published 的页面拷贝到 published_pages
INSERT INTO published_pages (id, page_id, site_id, name, path, schema_json, seo_json, published_at)
SELECT REPLACE(UUID(), '-', ''), id, site_id, name, path, schema_json, seo_json, updated_at
FROM pages WHERE status = 'published';
```

### 9.4 组件接口

#### Engine `src/api/page.ts` 新增函数

```typescript
export function publishPage(siteId: string, pageId: string): Promise<PageMeta> {
  return request.post(`/sites/${siteId}/pages/${pageId}/publish`)
}
export function unpublishPage(siteId: string, pageId: string): Promise<PageMeta> {
  return request.post(`/sites/${siteId}/pages/${pageId}/unpublish`)
}
export function previewPage(siteId: string, pageId: string): Promise<PageMeta> {
  return request.get(`/sites/${siteId}/pages/${pageId}/preview`)
}
export function getPageVersions(siteId: string, pageId: string): Promise<PageVersion[]> {
  return request.get(`/sites/${siteId}/pages/${pageId}/versions`)
}
export function rollbackPage(siteId: string, pageId: string, versionId: string): Promise<PageMeta> {
  return request.post(`/sites/${siteId}/pages/${pageId}/versions/${versionId}/rollback`)
}
```

### 9.5 并行派发计划

```
Wave 1 (串行): T1 → T2
  ↓
Wave 2 (串行): T3 → T4 ∥ T5
  ↓
Wave 3 (串行): T6 → T7 → (T8 ∥ T9 ∥ T10 ∥ T11)
  ↓
Wave 4 (串行): T12
```

| Wave | 任务 | 并行度 | 阻塞条件 |
|------|------|:---:|---------|
| 1 | T1, T2 | 串行 | Flyway 必须先于 Entity |
| 2 | T3, T4, T5 | T3→T4 串行; T5 与 T4 并行 | Service 先于 Controller |
| 3 | T6→T7→(T8∥T9∥T10∥T11) | T8-T11 并行 | BFF/API 先于 UI |
| 4 | T12 | 串行 | 全部完成后集成测试 |
