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
