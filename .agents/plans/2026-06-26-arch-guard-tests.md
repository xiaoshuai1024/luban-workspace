---
featureId: arch-guard-tests
title: Wave 5: 架构守护测试完善
parentProgram: production-readiness-program
createdAt: 2026-06-26
status: draft
---

# Wave 5: 架构守护测试完善

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** 架构守护测试从"分层规则"扩展到"全栈合规守护"：Java @Valid 覆盖、前端 boundaries CI 强制、dependency-cruiser 致命违规阻断。

**Architecture:** Java ArchUnit 加 controller 校验规则；前端 eslint-plugin-boundaries 从 warn 升 error；dependency-cruiser 加 no-circular + no-reverse-layer CI 门禁。

---

## Tasks

### Java ArchUnit 扩展 (T1-T3)

**T1: Controller @Valid 守护规则**
- Modify: `architecture/CodingStandardTest.java` — 加规则：所有 `@PostMapping`/`@PutMapping` 方法的 `@RequestBody` 参数必须有 `@Valid` 注解

```java
@ArchTest
static final ArchRule post_put_body_params_should_be_valid =
    methods().that().areAnnotatedWith("org.springframework.web.bind.annotation.PostMapping")
        .or().areAnnotatedWith("org.springframework.web.bind.annotation.PutMapping")
        .should(haveValidatedBodyParameter)
        .because("所有 POST/PUT 的 @RequestBody 必须加 @Valid 做输入校验");
```

**T2: Service @Transactional 守护规则**
- Modify: `architecture/CodingStandardTest.java` — 加规则：所有 service 的 public write 方法（名含 create/update/delete/save/publish/unpublish/insert）必须有 `@Transactional`

**T3: Tenant 隔离守护规则**
- Create: `architecture/TenantIsolationTest.java` — 验证 Lead/Datasource/Collection/Ab 的 controller 方法签名都包含 siteId 参数

### 前端 boundaries CI 强制 (T4-T6)

**T4: Engine boundaries 从 warn 升 error**
- Modify: `packages/engine/luban/eslint.config.mjs` — `boundaries/no-unknown` 和 `boundaries/element-types` 从 `'warn'` 改为 `'error'`

**T5: BFF/Website boundaries 从 warn 升 error**
- Modify: `packages/bff/luban-bff/eslint.config.mjs` — 同上
- Modify: `packages/web/luban-website/eslint.config.mjs` — 同上

**T6: dependency-cruiser CI 门禁**
- Modify: 各前端包 CI workflow — 加 `npx depcruise src --config --output-type err` 步骤（err 输出非零退出码阻断 CI）

### UI 物料架构守护 (T7)

**T7: 物料完整性守护**
- Create: `packages/luban-low-code/src/materials/material-integrity.spec.ts`
  - 验证所有注册物料都有 propsSchema
  - 验证所有注册物料都有 ErrorBoundary
  - 验证所有注册物料都有 Story（如果 Wave 3 补了 stories）

---

## 验证

```bash
# Java ArchUnit
cd packages/backend/luban-backend && mvn -q test -Dtest="com.luban.backend.architecture.**"

# 前端 boundaries
cd packages/engine/luban && npx eslint .  # 应 0 errors
cd packages/bff/luban-bff && npx eslint .
cd packages/web/luban-website && npx eslint .

# dependency-cruiser
cd packages/engine/luban && npx depcruise src --output-type err
cd packages/bff/luban-bff && npx depcruise src --output-type err
```
