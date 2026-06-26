# 经验教训（通用兜底）

> 本文件收录跨主题、不归入专门规则文件的通用排障经验。
> 专门主题请归入对应文件（git→luban-git-merge-pull.md，engine→LOWCODE_ENGINE_SPEC.md 等）。

---

## 经验：Windows cmd.exe + CRLF 下多行 `python -c` 补丁静默失效

### 场景
在 Windows `cmd.exe`（默认 shell）下，想用一条多行 `python -c "..."` 命令对文件做字符串替换补丁（修 mypy/ruff 问题）。命令"看起来执行了"但替换没生效，且无报错输出。

### 根因
两个因素叠加：
1. **CRLF 行尾**：文件是 `\r\n`，`python -c` 里写 `s.replace('old\n', ...)` 匹配的是 `\n`，匹配不到 `\r\n` 行。
2. **cmd.exe 多行 `-c`**：`cmd` 对引号/特殊字符的处理与 POSIX shell 不同，多行 `python -c` 的字符串可能被 cmd 截断或转义异常，导致 Python 抛 SyntaxError 但 stdout 被吞（无输出）。
3. **`open()` 默认 newline 转换**：Python 文本模式读 CRLF 文件会转成 `\n`，写回时 `open(w)` 又转回 `\r\n`——替换看似发生在内存但写入又还原，或替换串含 `\n` 导致错位。

### 解决方案
**不要在 cmd.exe 下用多行 `python -c` 做文件补丁**。改用以下任一稳健方式：

1. **写独立 .py 脚本文件**（最稳）：
   ```python
   # _patch.py
   P = "app/foo.py"
   s = open(P, "r", encoding="utf-8", newline="").read()  # newline="" 保留原始换行
   s = s.replace("old\r\n", "new\r\n")  # 明确匹配 CRLF
   open(P, "w", encoding="utf-8", newline="").write(s)    # newline="" 不二次转换
   ```
   跑 `python _patch.py && del _patch.py`。

2. **优先用专用工具**：文件编辑用 Edit/Write 工具（harness 管理），而非 shell 补丁。

3. **必须命令行时**：单行、显式 `\r\n`、用 `python -c` 单行表达式，并 `echo done` 确认 stdout 正常。

### 预防
- 检测换行：`python -c "print(open(p,'rb').read().count(b'\r\n'))"`
- 补丁后验证：`python -c "s=open(p,encoding='utf-8',newline='').read();print('applied:', 'new' in s)"`
- 若 `python -c` 多行无输出：大概率 cmd 截断了字符串，改用脚本文件
- 本项目（luban-workspace）文件多为 CRLF（Windows 团队），`replace` 须匹配 `\r\n`
- harness 的 Edit 工具偶有 "File has been modified since read" 误报（自身多次 Bash 调用被计为修改），遇此重 Read 后再 Edit，或用脚本文件原子写入

---

## 经验：ruff `noqa` 残留与 B008 误报

### 场景
迭代修 lint 时，手动加了 `# noqa: <code>`，但对应的规则没启用（如项目 ruff select 不含 `SLF`/`BLE`/`ARG`），导致 `RUF100: unused noqa`。另 FastAPI 的 `Depends()` 作函数默认参数会触发 `B008`，但这是 FastAPI 标准模式。

### 解决方案
- `ruff check --fix .` 自动清理无效 `noqa`（RUF100 可自动修）
- FastAPI 项目在 `pyproject.toml` 全局 `ignore = ["B008"]`
- 测试里 `pytest.raises(Exception)` 的 `B017` 用 `[tool.ruff.lint.per-file-ignores]` 对 `tests/*` 放行

### 预防
- 加 `noqa` 前确认规则在 select 列表内；不确定就用 `ruff check --fix` 兜底
- 项目 ruff 配置统一在 `pyproject.toml`，别散落在各文件

---

## 经验：ArchUnit 1.3.0 API 陷阱（@ArchTest 注解 + System.out 检查）

### 场景
引入 ArchUnit 做架构分层测试，编译报 `cannot find symbol: class ArchiTest`；`callSystemOut()` 在 1.3.0 不存在导致编译失败。

### 根因
1. ArchUnit 注解是 `@ArchTest`（大写 T），不是 `@ArchiTest`。多个教程/博客写法不一致。
2. `ClassesShould.callSystemOut()` / `callSystemErr()` 在 ArchUnit 1.3.0 **不存在**（可能是更高版本或不同模块的方法）。
3. `callCodeUnitWhere(lambda)` 需要显式 `DescribedPredicate<JavaCall<?>>`，不能直接传 lambda。

### 解决方案
```java
// ✅ 正确：@ArchTest（大写 T）
import com.tngtech.archunit.junit.AnalyzeClasses;
import com.tngtech.archunit.junit.ArchTest;

@AnalyzeClasses(packages = "com.luban.backend")
class LayerDependencyTest {
    @ArchTest
    static final ArchRule rule = classes()...;
}

// ✅ 正确：System.out 检查用 DescribedPredicate
import com.tngtech.archunit.base.DescribedPredicate;
import com.tngtech.archunit.core.domain.JavaCall;

@ArchTest
static final ArchRule no_System_out =
    noClasses().that().resideInAPackage("com.luban.backend..")
        .should().callCodeUnitWhere(new DescribedPredicate<JavaCall<?>>("call System.out/err") {
            @Override
            public boolean test(JavaCall<?> call) {
                return call.getTargetOwner().getName().equals("java.lang.System");
            }
        });
```

### 预防
- ArchUnit 测试用 `@ArchTest`（不是 `@ArchiTest`）
- 复杂谓词用 `DescribedPredicate` 匿名类，不用裸 lambda
- API 不确定时先 `javap -cp` 检查 jar 实际方法签名

---

## 经验：Next.js 16 dynamic route params 必须 async 化

### 场景
BFF（Next.js 16）build 失败，TypeScript 报：
```
Property 'id' is missing in type 'Promise<{ id: string; }>'
```

### 根因
Next.js 16（App Router）中，dynamic route 的 `params` 从同步对象改为 **`Promise<{...}>`**。旧代码：
```typescript
export async function GET(req, { params }: { params: { id: string } }) {
  const { id } = params;  // ❌ params 现在是 Promise
}
```

### 解决方案
```typescript
// ✅ Next.js 16 正确写法
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  // ...
}
```

### 预防
- Next.js 16 升级后，所有 `[param]` 路由的 handler 签名都要改 `params: Promise<...>` + `await params`
- 全局搜索：`grep -rn "params:" src/app/api/ --include="*.ts"` 逐一检查
- CI build 是第一道防线，build 通过即说明签名已修正

---

## 经验：husky pre-commit 在大变更提交时 OOM

### 场景
首次引入 husky + lint-staged，提交一个包含数百文件的大 commit（如 lint 工具链初始化 + auto-fix），pre-commit hook 中 eslint 对大量文件执行导致内存耗尽（KILLED）。

### 根因
lint-staged 虽然只检查 staged 文件，但首次提交涉及整个代码库的 auto-fix（prettier --write + eslint --fix），同时处理数百文件导致 Node.js 内存溢出。

### 解决方案
```bash
# 方案1：大变更提交用 --no-verify 跳过 hook
git commit --no-verify -m "feat(lint): initial tooling setup + auto-fix"

# 方案2：分批提交（每次 < 50 文件）
git add src/api/ && git commit -m "lint: fix api dir"
git add src/views/ && git commit -m "lint: fix views dir"
```

### 预防
- **首次引入 lint 工具时**，auto-fix 大 commit 用 `--no-verify`
- lint 验证应在 commit **之前**单独跑通（`pnpm run lint`），而非依赖 hook 兜底
- 后续小改动正常走 hook 即可
- lint-staged 配置可加 `maxArgLength` 或用 `git:*` 模式分批
