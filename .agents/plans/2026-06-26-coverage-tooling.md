---
featureId: coverage-tooling
title: Wave 1: 覆盖率工具配置 + 阈值植入
parentProgram: production-readiness-program
createdAt: 2026-06-26
status: draft
---

# Wave 1: 覆盖率工具配置 + 阈值植入

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development

**Goal:** 所有 5 个模块的覆盖率工具正确配置 + 80% line 阈值植入 + CI 集成，建立量化基础。

**Architecture:** Java 修复 JaCoCo argLine bug + 加 check 规则；前端 4 包加 @vitest/coverage-v8 + thresholds 配置；CI 加覆盖率步骤。

**Tech Stack:** JaCoCo 0.8.15 (Java), @vitest/coverage-v8 (前端), GitHub Actions

---

## §1 需求追溯

| 需求 | 来源 | task |
|------|------|------|
| Java JaCoCo argLine bug 修复 | 审查报告 Java #4 | T1 |
| Java JaCoCo check 规则 80% | 用户要求 80% | T1 |
| Engine vitest coverage 配置 | 审查报告 Engine #1 | T2 |
| BFF vitest coverage 配置 | 审查报告 BFF | T3 |
| Website vitest coverage 配置 | 审查报告 Website | T4 |
| UI vitest thresholds 配置 | 审查报告 UI #5 | T5 |
| CI 覆盖率步骤 | 全项目集 | T6 |

---

## §2 文件结构

### Java Backend
- 修改: `packages/backend/luban-backend/pom.xml` — 修复 argLine + 加 check

### Engine
- 修改: `packages/engine/luban/package.json` — 加 @vitest/coverage-v8 dep + test:coverage script
- 修改: `packages/engine/luban/vitest.config.ts` — 加 coverage config + thresholds

### BFF
- 修改: `packages/bff/luban-bff/package.json` — 加 test:coverage script
- 修改: `packages/bff/luban-bff/vitest.config.ts` — 加 coverage config + thresholds

### Website
- 修改: `packages/web/luban-website/package.json` — 加 @vitest/coverage-v8 dep + test:coverage script
- 修改: `packages/web/luban-website/vitest.config.ts` — 加 coverage config + thresholds

### UI
- 修改: `packages/ui/luban-ui/packages/luban-base/vite.config.mts` — 加 thresholds
- 修改: `packages/ui/luban-ui/packages/luban-low-code/vite.config.mts` — 加 thresholds
- 修改: `packages/ui/luban-ui/packages/luban-utils/vitest.config.mts` — 加 thresholds
- 修改: `packages/ui/luban-ui/apps/luban-ui/vite.config.mts` — 加 thresholds

### CI
- 创建: `packages/backend/luban-backend/.github/workflows/test.yml` — 加覆盖率步骤
- 修改: 各前端包 CI lint workflow — 加覆盖率步骤

---

## Tasks

### Task 1: Java JaCoCo argLine 修复 + check 规则

**Files:**
- Modify: `packages/backend/luban-backend/pom.xml`

- [ ] **Step 1: 修复 surefire argLine（加 @{argLine} 前缀）**

读取 pom.xml 的 `<plugins>` 区域，找到 `maven-surefire-plugin` 配置。当前 argLine 缺少 `@{argLine}` 前缀，导致 JaCoCo agent 未注入。

将 surefire 的 `<argLine>` 改为：
```xml
<argLine>@{argLine} -Xmx1024m</argLine>
```

- [ ] **Step 2: 加 JaCoCo check 规则（80% line）**

在 jacoco-maven-plugin 的 `<executions>` 中加 check execution：
```xml
<execution>
    <id>check-coverage</id>
    <goals>
        <goal>check</goal>
    </goals>
    <phase>verify</phase>
    <configuration>
        <rules>
            <rule>
                <element>BUNDLE</element>
                <limits>
                    <limit>
                        <counter>LINE</counter>
                        <value>COVEREDRATIO</value>
                        <minimum>0.80</minimum>
                    </limit>
                </limits>
            </rule>
        </rules>
    </configuration>
</execution>
```

- [ ] **Step 3: 验证 JaCoCo 报告生成**

Run: `cd packages/backend/luban-backend && mvn -q verify`
Expected: `target/site/jacoco/index.html` 存在；如果覆盖率 < 80% 则 BUILD FAILURE（预期行为，因为当前覆盖率低）

- [ ] **Step 4: 临时降低阈值到当前水平（渐进式）**

当前覆盖率约 16%，先设为 0.15 让 verify 通过，后续 Wave 3 提升到 0.80：
```xml
<minimum>0.15</minimum>
```

- [ ] **Step 5: Commit**

```bash
cd packages/backend/luban-backend
git add pom.xml
git commit -m "fix(jacoco): wire @{argLine} into surefire + add check rule (progressive 15%)"
```

---

### Task 2: Engine vitest coverage 配置

**Files:**
- Modify: `packages/engine/luban/package.json`
- Modify: `packages/engine/luban/vitest.config.ts`

- [ ] **Step 1: 加 @vitest/coverage-v8 devDep + test:coverage script**

在 package.json devDependencies 加（匹配 vitest ^2.1.4 主版本）：
```json
"@vitest/coverage-v8": "^2.1.4",
```

在 scripts 加：
```json
"test:coverage": "vitest run --coverage",
```

- [ ] **Step 2: 加 coverage config + thresholds 到 vitest.config.ts**

在 `test:` 块内加（渐进式初始阈值 10%）：
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  reportsDirectory: './coverage',
  include: ['src/**/*.{ts,vue}'],
  exclude: ['src/**/*.spec.ts', 'src/**/*.d.ts', 'src/mocks/**'],
  thresholds: {
    lines: 10,
    functions: 10,
    branches: 10,
    statements: 10,
  },
},
```

- [ ] **Step 3: 修复 include glob（加 *.test.ts）**

将 `include` 改为同时匹配 spec 和 test：
```typescript
include: ['src/**/*.spec.ts', 'src/**/*.spec.tsx', 'src/**/*.test.ts'],
```

- [ ] **Step 4: 验证**

Run: `cd packages/engine/luban && pnpm install && pnpm run test:coverage`
Expected: coverage 报告生成，当前覆盖率 ~10-15%，阈值 10% 通过

- [ ] **Step 5: Commit**

```bash
git add package.json vitest.config.ts
git commit -m "feat(coverage): add vitest coverage-v8 + thresholds (progressive 10%)"
```

---

### Task 3: BFF vitest coverage 配置

**Files:**
- Modify: `packages/bff/luban-bff/package.json`
- Modify: `packages/bff/luban-bff/vitest.config.ts`

- [ ] **Step 1: 加 test:coverage script**

`@vitest/coverage-v8 ^3` 已在 devDeps 中，只需加 script：
```json
"test:coverage": "vitest run --coverage",
```

- [ ] **Step 2: 加 coverage config + thresholds**

在 vitest.config.ts 的 `test:` 块加：
```typescript
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'lcov'],
  include: ['src/**/*.ts'],
  exclude: ['src/**/*.spec.ts', 'src/lib/__tests__/**'],
  thresholds: {
    lines: 10,
    functions: 10,
    branches: 10,
    statements: 10,
  },
},
```

- [ ] **Step 3: 验证 + Commit**

```bash
pnpm run test:coverage
git add package.json vitest.config.ts
git commit -m "feat(coverage): add vitest coverage thresholds (progressive 10%)"
```

---

### Task 4: Website vitest coverage 配置

**Files:**
- Modify: `packages/web/luban-website/package.json`
- Modify: `packages/web/luban-website/vitest.config.ts`

- [ ] **Step 1: 加 @vitest/coverage-v8 devDep + script**

```json
"@vitest/coverage-v8": "^4.1.9",
"test:coverage": "vitest run --coverage",
```

- [ ] **Step 2: 加 coverage config + thresholds + 扩宽 include**

在 vitest.config.ts 加 coverage（同上格式），并将 include 扩宽为 `['**/*.spec.ts']`，排除 e2e：
```typescript
include: ['composables/**/*.spec.ts', 'stores/**/*.spec.ts', 'utils/**/*.spec.ts'],
exclude: ['node_modules', '.nuxt', 'dist', 'e2e/**'],
```

- [ ] **Step 3: 验证 + Commit**

---

### Task 5: UI vitest thresholds 配置

**Files:**
- Modify: 4 个 vite/vitest config 文件

- [ ] **Step 1: 给每个 config 加 thresholds + reporter**

在 `packages/luban-base/vite.config.mts`、`packages/luban-low-code/vite.config.mts`、`packages/luban-utils/vitest.config.mts`、`apps/luban-ui/vite.config.mts` 的 `test.coverage` 块中加：
```typescript
reporter: ['text', 'html', 'lcov'],
thresholds: {
  lines: 20,
  functions: 20,
  branches: 20,
  statements: 20,
},
```

- [ ] **Step 2: 加 test:coverage script 到 UI root package.json**

```json
"test:coverage": "nx run-many --target=test --all -- --coverage",
```

- [ ] **Step 3: 验证 + Commit**

---

### Task 6: CI 覆盖率步骤

**Files:**
- Modify: `packages/backend/luban-backend/.github/workflows/test.yml`
- Modify: 各前端包 `.github/workflows/lint.yml`

- [ ] **Step 1: Java CI 加 mvn verify（含 JaCoCo）**

在 test.yml 的 test job 中，将 `mvn -B test` 改为 `mvn -B verify`，并上传覆盖率报告 artifact。

- [ ] **Step 2: 前端 CI 加 test:coverage 步骤**

在各前端包的 lint.yml（或新建 test.yml）加：
```yaml
- name: Test with coverage
  run: pnpm run test:coverage
```

- [ ] **Step 3: Commit**

---

## 验证

```bash
# Java
cd packages/backend/luban-backend && mvn -q verify
# Engine
cd packages/engine/luban && pnpm run test:coverage
# BFF
cd packages/bff/luban-bff && pnpm run test:coverage
# Website
cd packages/web/luban-website && pnpm run test:coverage
# UI
cd packages/ui/luban-ui && pnpm run test:coverage
```

所有包应生成 coverage 报告并通过渐进式阈值（10-20%）。
