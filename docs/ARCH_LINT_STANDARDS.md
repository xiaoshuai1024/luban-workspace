# Luban 前端 Lint 与架构边界共享基线

> 本文档定义 Luban workspace 中所有 TypeScript/Vue 前端子包的共享 Lint 最低标准。
> 各包独立实现配置，但须对齐本文档基线。
>
> 最后更新：2026-06-25

---

## 1. Prettier 基线

所有前端包统一使用以下 Prettier 配置：

```json
{
  "singleQuote": true,
  "semi": true,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "all",
  "arrowParens": "always",
  "endOfLine": "lf",
  "bracketSpacing": true,
  "vueIndentScriptAndStyle": false
}
```

### .prettierignore 标准条目

```
dist/
node_modules/
pnpm-lock.yaml
*.timestamp-*
coverage/
```

各包按框架追加：
- Engine: 无额外
- Website: `.nuxt/`, `.output/`
- BFF: `.next/`, `out/`
- UI (Nx): `.nx/cache`, `.nx/workspace-data`

---

## 2. ESLint v9 基线

所有包使用 ESLint v9 flat config（`eslint.config.mjs`）。

### 共享 rules 基线

```js
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  // TypeScript 严格推荐
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  // Prettier 关闭冲突规则（放最后）
  prettierConfig,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // 架构边界由 eslint-plugin-boundaries 管理（见 §3）
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
);
```

### 框架适配

| 包 | 额外 extends | 说明 |
|----|-------------|------|
| Engine (Vite + Vue 3) | `eslint-plugin-vue` flat/recommended | `.vue` SFC 支持 |
| Website (Nuxt 3) | `@nuxt/eslint-config` | Nuxt auto-imports, server/ 目录 |
| BFF (Next.js 16) | `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` | 已有，追加 prettier + boundaries |
| UI (Nx + Vue 3) | `@nx/eslint-plugin` + `eslint-plugin-vue` | 已有，收紧 boundaries |

### Vue 文件特殊规则

```js
// 所有含 .vue 的包加：
{
  files: ['**/*.vue'],
  languageOptions: {
    parserOptions: {
      parser: tseslint.parser,
    },
  },
  rules: {
    'vue/multi-word-component-names': 'off', // 允许单字组件
    'vue/no-v-html': 'warn',
  },
}
```

---

## 3. 架构边界 Lint（eslint-plugin-boundaries）

### 通用规则

所有包使用 `eslint-plugin-boundaries` 强制模块方向：

```js
import boundaries from 'eslint-plugin-boundaries';

export default [
  {
    plugins: { boundaries },
    settings: {
      'boundaries/elements': [
        // 见各包独立定义
      ],
    },
    rules: {
      'boundaries/no-unknown': 'error',
      'boundaries/no-ignored': 'error',
      'boundaries/element-types': 'error',
    },
  },
];
```

### 各包 elements 定义

#### Engine

| Element | Pattern | Allowed from |
|---------|---------|-------------|
| `types` | `src/types/**` | (leaf) |
| `utils` | `src/utils/**` | `types` |
| `api` | `src/api/**` | `types`, `utils` |
| `stores` | `src/stores/**` | `types`, `api` |
| `layouts` | `src/layouts/**` | `stores`, `api` |
| `views` | `src/views/**` | `stores`, `api`, `types`, `utils`, `layouts` |

#### Website

| Element | Pattern | Allowed from |
|---------|---------|-------------|
| `types` | `types/**` | (leaf) |
| `utils` | `utils/**` | `types` |
| `composables` | `composables/**` | `types`, `utils`, `stores` |
| `stores` | `stores/**` | `types`, `utils` |
| `views` | `views/**` | `composables`, `stores`, `types`, `utils` |
| `server` | `server/**` | (isolated) |

#### BFF

| Element | Pattern | Allowed from |
|---------|---------|-------------|
| `lib` | `src/lib/**` | (leaf) |
| `pages` | `src/app/**` | `lib` |
| `api` | `src/app/api/**` | `lib` |

---

## 4. stylelint 基线

所有包统一使用 `stylelint` + 框架适配：

```json
{
  "extends": ["stylelint-config-standard"],
  "rules": {
    "selector-class-pattern": null,
    "no-descending-specificity": null,
    "at-rule-no-unknown": null
  }
}
```

| 包 | CSS 类型 | 额外 extends |
|----|---------|-------------|
| Engine | SCSS (Vue SFC) | `postcss-html` customSyntax |
| Website | 内嵌 CSS (Vue SFC) | `stylelint-config-standard-vue` |
| BFF | Tailwind v4 CSS | 无额外 |
| UI | SCSS (packages) + CSS (apps) | `stylelint-config-standard-scss` + `postcss-html` |

---

## 5. dependency-cruiser 基线

所有包使用 `dependency-cruiser` 检查模块依赖：

```js
// .dependency-cruiser.js
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-orphans',
      severity: 'warn',
      from: { orphan: true, pathNot: '\\.(spec|test|d)\\.ts$' },
      to: {},
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      dot: { collapsePattern: 'node_modules/[^/]+' },
      archi: { collapsePattern: 'node_modules/[^/]+' },
    },
  },
};
```

各包仅需调整 `tsConfig.fileName` 路径（Nuxt 用 `.nuxt/tsconfig.json`，Nx 用 `tsconfig.base.json`）。

---

## 6. Git Hooks 基线

所有前端包统一使用：

- **husky** v9：`pre-commit` hook
- **lint-staged**：仅检查变更文件
- **commitlint**：`@commitlint/config-conventional`

### lint-staged 配置

```json
{
  "lint-staged": {
    "*.{ts,tsx,vue}": ["eslint --fix"],
    "*.{css,scss,vue}": ["stylelint --fix"],
    "*.{ts,tsx,vue,css,scss,json,md,yml,yaml}": ["prettier --write"]
  }
}
```

### commitlint 配置

```js
export default { extends: ['@commitlint/config-conventional'] };
```

---

## 7. 版本约束

| 工具 | 最低版本 |
|------|---------|
| ESLint | ^9.0.0 |
| Prettier | ^3.6.0 |
| stylelint | ^16.0.0 |
| typescript-eslint | ^8.0.0 |
| eslint-plugin-vue | ^9.16.0 |
| eslint-config-prettier | ^10.0.0 |
| eslint-plugin-boundaries | ^5.0.0 |
| dependency-cruiser | ^16.0.0 |
| husky | ^9.0.0 |
| lint-staged | ^15.0.0 |
| commitlint | ^19.0.0 |

---

## 8. 合规验证

各包完成配置后验证：

```bash
# 在包根目录执行
pnpm run lint          # ESLint + Prettier + stylelint
npx depcruise src      # dependency-cruiser (按包调整入口路径)
```

Meta 仓全局验证：

```bash
make lint              # 遍历所有 submodule 执行 lint
```
