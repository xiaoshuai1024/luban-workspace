<!--
description: 根据 luban 项目出现的模式和新经验持续改进 docs/dev/ 知识文档
globs: "**/*"
alwaysApply: false
-->

# 规则自我改进（Self-Improve）

## 触发条件

本文件收集未匹配到专项规则文件的跨域经验。以下为各次会话沉淀。

## 何时提示现有规则可能需要更新

1. **会话中反复出现同类型问题**（如双后端契约不一致、引擎渲染报错）
2. **修复方式与现有规则建议不一致**（说明规则过时了）
3. **新增技术栈或库**（如新引入的 Maven 插件、Go 库、引擎特性）
4. **用户主动纠正你的做法**（说明规则没有正确约束你的行为）
5. **代码审查中发现的高频问题模式**（5 次以上同类问题应考虑加到规则中）

## 分析流程

1. **定位规则文件**：按规则的归类映射表确定目标文件
2. **确认问题是规则缺失还是执行不力**：
   - 规则缺失 → 新增章节
   - 执行不力 → 在该规则文件中增加 hard constraint 标记
3. **检查已有规则是否矛盾**：新经验和现有规则冲突时，标记冲突并询问用户
4. **最小更新**：只追加必要内容，不重写整个文件

## 规则添加标准

| 条件 | 行动 |
|------|------|
| 用户在 ≥3 次不同会话中纠正同一件事 | 新增硬约束（MUST） |
| 代码审查连续 5+ 次发现同类问题 | 新增检查清单项 |
| 新引入的依赖/工具/模式 | 新增参考说明 |
| 单向破坏性操作（如删除表、改 schema） | 新增确认流程 |

## 规则过时判定

- 路径引用返回 404 → 更新路径
- 依赖的库/框架已升级 → 更新命令版本
- 用户明确说"不用再这样做" → 删除该规则
- 规则与当前 CLAUDE.md 或 `AGENTS.md` 矛盾 → 标记冲突

## 规则质量检查

- 必须包含 Java / Go / TS 的**具体命令或代码示例**
- 路径引用必须是 `.agents/rules/` 下的实际路径
- 避免泛泛而谈（如"注意安全"），要具体（如"使用 `@RequirePerm` 注解"）

---

## 经验：luban-review 全自动审查循环实践（待积累）

### 场景
执行功能模块开发后，通过 `/luban-review` 触发全自动审查循环。多个窄范围审查 agent 并行启动，Streaming 修复模式让修复与审查重叠执行。

### 关键发现（基于 kangdou kd-review 经验迁移）
1. **路径不匹配** — Filter / 拦截器拦截的路径与实际 Controller 路径不一致，必须通过 grep 或 Read 验证
2. **snake_case/camelCase 不匹配** — 后端返回的 Map key 是 SQL 列名（snake_case），前端 TS 类型用 camelCase 时运行时为 undefined
3. **queryForMap 空结果** — Java `JdbcTemplate.queryForMap()` 查不到数据时抛 `EmptyResultDataAccessException`，不返回 null
4. **缓存穿透** — 不存在的 key 不会被缓存，每次穿透到 DB
5. **日志 PII** — 日志直接输出手机号/邮箱违反个保法，必须脱敏

### 预防措施
1. 拦截器路径必须与 Controller 路径拼接结果完全一致，用 Read 验证后再提交
2. 后端返回字段时，前端 API 类型声明必须用对应的命名风格（或添加运行时映射层）
3. 所有 `queryForMap` 调用必须 catch `EmptyResultDataAccessException`
4. 本地缓存用 `computeIfAbsent()`（Java）/ `singleflight`（Go）原子操作，并缓存空集合防穿透
5. 日志中出现 PII 时必须脱敏

---

## 经验：双后端契约漂移（luban 特有）

### 场景
Java 与 Go 后端同一接口的响应字段命名或类型不一致，BFF 切换后端时出现 bug。

### 根因
两端独立开发，缺乏 contract test。

### 预防
- 维护 contract test 套件
- 接口契约变更必须两端同步（见 [`luban-dual-backend-parity.md`](./luban-dual-backend-parity.md)）
- 大数字统一字符串传输，避免前端精度丢失
- 空值表示统一（null vs 零值）

---

## 经验：引擎渲染物料时的常见坑（luban 特有）

### 1. 物料未注册
- schema 引用的物料名在引擎未注册 → 渲染时报 "material not found"
- **预防**：物料注册清单与 schema 引用做交叉校验

### 2. props schema 缺失
- 物料无 props schema → 引擎无法做字段裁剪和默认值填充
- **预防**：每个物料 MUST 声明 propsSchema

### 3. 循环引用
- 容器物料嵌套自身 → 渲染栈溢出
- **预防**：渲染前做循环检测，设最大嵌套深度

### 4. 版本不兼容
- schema 引用 `Button@1.0.0`，已注册的是 `Button@2.0.0`，props 接口已变更
- **预防**：物料声明 semver，引擎做版本兼容性检查

详见 [`luban-material-schema.md`](./luban-material-schema.md) 与 [`luban-lowcode-engine-quality.md`](./luban-lowcode-engine-quality.md)。

---

## 经验：多端渲染分叉（luban 特有）

### 场景
同一 schema 在 web 渲染正常，在 electron 或 flutter webview 中样式错乱。

### 根因
各端 CSS 引擎差异。

### 预防
- 物料样式用标准 CSS 子集
- 关键样式多端交叉验证
- 详见 [`luban-multi-client-consistency.md`](./luban-multi-client-consistency.md)

---

## 经验：UTF-8 without BOM（MUST）

### 场景
所有 `.ts / .vue / .js / .go / .java` 文件出现中文乱码（如 `绉熸埛绠＄悊` → `租户管理`）。

### 根因
文件以非 UTF-8 编码保存，UTF-8 字节被错误解释为 Latin-1。

### 解决方案
```python
content = open('file.ts', 'rb').read().decode('latin-1').encode('latin-1').decode('utf-8')
```

### 预防
1. 所有源码文件必须 **UTF-8 without BOM**
2. 中文文本写入后立即用 `grep` 验证，出现 `锟`、`绉`、`鍟`、`埛` 等字符说明编码损坏
3. Maven `.mvn/maven.config` 文件只含 ASCII 选项行，不加注释，不加 BOM

---

## 经验：Bean 同名冲突 / Go 包名冲突

### 场景
合并后 Spring 启动报 ConflictingBeanDefinitionException（Java）；或 Go 编译报 "redeclared in this block"。

### 解决方案
- Java：在注解上加 value（`@RestController("uniqueName")`）
- Go：用别名导入或重命名标识符

### 预防
冲突优先改注解 value / 别名，不动文件名。

---

## 经验：拦截器不要提前销毁 session

### 场景
登录后请求被拦截 → session 被清 → 用户无法完成下一步 → 死循环。

### 解决方案
- 未完成必要步骤时仅拦当前请求，不销毁 session
- 终态拒绝时才清 session
- 拦截器销毁 session 前确认用户没有挽回余地

---

## 经验：Nx 22.5 boundaries tags 不生效（apps/ 需要 project.json）

### 场景
收紧 `@nx/enforce-module-boundaries` 从 `*→*` 到真实 tag 规则后，`apps/luban-ui` 持续报 "A project without tags used in dependencies"，即使 package.json 已加 `"tags": ["type:app"]`。

### 根因
Nx 22.5.4 对 **不在 pnpm-workspace.yaml packages 列表中** 的项目（如 `apps/` 目录），不从 package.json 的 `tags` 字段读取 tags。需要：
1. 在包目录创建 `project.json`，显式声明 `tags`
2. 执行 `npx nx reset` + 重建 ProjectGraph（`npx nx graph --file .nx/graph.json`）

### 解决方案
```json
// apps/luban-ui/project.json
{
  "name": "@luban-ui/luban-ui",
  "projectType": "application",
  "sourceRoot": "apps/luban-ui/src",
  "tags": ["type:app"],
  "targets": {}
}
```
```bash
# 重建 ProjectGraph（Nx 缓存会导致旧 tags 残留）
npx nx reset
npx nx show projects  # 触发 graph 构建
npx nx run-many --target=lint --all  # 验证 boundaries 生效
```

### 预防
- Nx 项目 tags **优先放 project.json**（最可靠），package.json tags 作为备用
- 改 tags 后必须 `nx reset` + 重建 graph，否则 ESLint 用旧缓存
- 用 `npx nx graph --file .nx/graph.json` + python 脚本验证 tags 是否注入

---

## 经验：go-cleanarch 库不活跃，用标准库 ast 手写分层测试

### 场景
计划用 `github.com/roblaszczak/go-cleanarch` 做 Go 分层架构测试，发现库维护不活跃、API 复杂、文档少。

### 根因
go-cleanarch 最后更新较早，star 数少，且 API 设计偏重 rule set 而非简单的包级 import 检查。

### 解决方案
用 Go 标准库 `go/parser` + `go/token` 手写分层测试，零外部依赖：
```go
// internal/lint/architecture_test.go
func Test_NoReverseLayerDependencies(t *testing.T) {
    // 1. 用 parser.ParseFile 解析每个 .go 文件的 import
    // 2. 用 resolveLayer() 判断 import 属于哪个层
    // 3. 用 allowedDeps map 检查方向是否合法
    // 4. 白名单例外（如 error.go 跨层 error mapping）
}
```

### 预防
- Go 架构测试优先用标准库 ast，不引入不活跃的外部库
- 分层规则用 `map[string][]string`（source → allowed targets）表达，清晰可维护
- 已知跨层依赖用白名单 map 显式声明（如 error mapping），不要放宽全局规则

---

## 经验：子模块合并冲突策略（保留远端功能 + 叠加工具配置）

### 场景
架构治理配置提交到各子模块 dev 分支时，远端 dev 已有新提交（功能改进），merge 冲突涉及：
- Java pom.xml（远端加了 H2/failsafe，我们加了 ArchUnit）
- BFF route.ts（远端改了鉴权逻辑，我们改了 params async）
- Website package.json（远端加了测试脚本，我们加了 lint 配置）

### 根因
子模块 dev 分支并行开发，功能提交与工具配置提交在同一文件上冲突。

### 解决方案
```bash
# 策略：保留远端功能改进（theirs），手动叠加本次工具配置
git checkout --theirs <conflicted-file>  # 取远端版本
# 手动编辑：在远端基础上加回本次的 lint 配置
git add <conflicted-file>
git commit -m "merge: resolve conflict (keep remote feature + add lint tooling)"
```

### 预防
- 冲突时**先看远端改了什么**（`git diff HEAD...MERGE_HEAD <file>`），不要无脑 ours/theirs
- 功能代码（鉴权、业务逻辑）优先保留远端
- 配置代码（lint、CI、依赖）在远端基础上叠加
- merge 后必须跑 build + test 验证（`mvn compile` / `pnpm build`），不能假设合并正确
