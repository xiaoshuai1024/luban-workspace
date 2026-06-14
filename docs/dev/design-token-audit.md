# Design Token 审计方法论

> 本文档是「如何对一套前端代码做 Design Token 缺口审计」的通用方法论。原应用于某一前端代码库的硬编码颜色/字号/圆角扫描，提炼为可复用流程。
> 适用：luban 的 luban-ui 物料库、luban-website SSR 站、electron/flutter/web 各端样式层。

---

## 1. 审计目标

识别「已定义 Design Token，但代码中仍存在硬编码值」的缺口，量化 token 覆盖率，输出可执行的补齐计划。

**核心判定**：代码里出现的每个硬编码值（`#hex`、`rgba()`、`font-size`、`border-radius`、`font-weight`、`line-height`、`box-shadow`）是否能映射到某个已定义 token；能映射的是「可直接替换」，不能映射的是「需新增 token」。

## 2. 量化指标

| 指标 | 说明 |
|------|------|
| 已定义 Design Token 数 | token 源文件中的变量总数 |
| 已使用 `var(--xxx)` 次数 | 代码中正确引用 token 的次数 |
| 硬编码 `#hex` / `rgba()` 处数 | 颜色类硬编码 |
| 硬编码 `font-size` / `radius` / `weight` / `line-height` / `shadow` 处数 | 排版与视觉类硬编码 |
| **Token 覆盖率** | `已使用 var 次数 / (已使用 + 可直接替换的硬编码)` |

## 3. 审计流程（五步）

### 第一步：扫描所有样式源文件

扫描 `.vue` / `.scss` / `.css` / `.ts`（styled）中的硬编码值。可用 ripgrep 或自研脚本。

```bash
# 颜色硬编码
rg '#[0-9a-fA-F]{3,8}' src/ --glob '*.vue' --glob '*.scss' --glob '*.css'
rg 'rgba?\(' src/ --glob '*.vue' --glob '*.scss' --glob '*.css'

# 排版硬编码
rg 'font-size:\s*\d' src/ --glob '*.vue' --glob '*.scss'
rg 'border-radius:\s*\d' src/ --glob '*.vue' --glob '*.scss'
rg 'font-weight:\s*\d' src/ --glob '*.vue' --glob '*.scss'
rg 'line-height:\s*[0-9.]' src/ --glob '*.vue' --glob '*.scss'
rg 'box-shadow:' src/ --glob '*.vue' --glob '*.scss'
```

### 第二步：建立「硬编码值 → token」映射表

对每个硬编码值，找最近的 token：

| 硬编码值 | 出现次数 | 最近 token | 缺口类型 |
|----------|---------|-----------|---------|
| `#fff` / `#ffffff` | N | surface / text-inverse | 可直接替换 |
| `#333` / `#1a1a1a` | N | text | 可直接替换 |
| `#999` / `#aaa` | N | text-tertiary | 可直接替换（灰色变体需评估） |
| ... | | | |

**缺口类型分类**：
- ✅ **可直接替换**：存在语义对应的 token
- 🔴 **高频缺失**：出现次数多但无对应 token → 优先新增
- ⚠ **需评估**：业务专属色，需评估是否 token 化

### 第三步：按类别统计缺口

分类汇总：颜色、字号、圆角、字重、行高、阴影。每个类别列出：
- 可直接替换数量（有对应 token）
- 需新增 token 数量（无对应 token）+ 建议的 token 名与值

### 第四步：识别高频缺失（P0）

找出出现次数 Top N 但无对应 token 的值（如某字号出现 60 次但 token 体系里没有），定为 P0 立即新增。

### 第五步：按文件统计重度违规

| 文件 | #hex | rgba | font-size | radius | ... | 总计 |
|------|------|------|-----------|--------|-----|------|

识别「硬编码 > 50 处」的重度违规文件，优先改造。

## 4. 改造策略（分阶段）

### 阶段一：补齐缺失 Token（1-2 天）
1. 在 token JSON 源文件中新增 P0/P1 token
2. 运行 build 脚本重新生成 CSS 变量
3. 验证构建通过

### 阶段二：批量替换可直接映射的硬编码（3-5 天）

按类别分批替换：
1. **颜色**：黑白灰、语义色（success/warning/danger/info）先替换
2. **字号**：已有对应 token 的先替换
3. **字重 + 圆角**
4. **行高 + 阴影**（新增 token 后替换）

### 阶段三：特殊视觉风格改造（2-3 天）
玻璃拟态、渐变等特殊效果，新增专用 token 系列。

### 阶段四：低频文件改造（按需）
剩余文件逐步改造，优先处理用户高频访问的页面。

## 5. 验收标准

- [ ] 所有 `.vue/.tsx` 文件中无硬编码 `#hex` 颜色（token 定义文件除外）
- [ ] 所有 `font-size` 使用 `var(--xxx-font-*)` token
- [ ] 所有 `font-weight` / `border-radius` / `box-shadow` / `line-height` 使用对应 token
- [ ] 新增 token 后运行 build 脚本重新生成
- [ ] 构建通过（如 TS 仓 `pnpm run build`）
- [ ] 无新增红色报错
- [ ] 视觉回归测试通过（关键页面截图对比）

## 6. luban 特化

- **多端一致**：同一 token 在 web/electron/flutter 各端的渲染值必须一致（见 `.agents/rules/luban-multi-client-consistency.md`）。
- **引擎消费**：物料库（luban-ui）的 token 是引擎渲染的基准，token 变更须验证引擎渲染无回归。
- **SSR**：luban-website 用 SSR，token 注入时机要在 hydration 之前，避免 FOUC（闪烁）。
- **dark mode**：如支持暗色主题，token 体系须包含 light/dark 两套，CSS 选择器在引擎容器与原生 page 上双写兼容。

## 7. 定期复扫

接入 build 流水线或 git pre-commit：
- 每次 build 后 `rg '{' generated/variables.css` 确认无未解析占位符
- 定期执行 token 检查脚本 `--all` 扫描硬编码颜色
- 新增 CSS class 选择器时评估多端兼容性
