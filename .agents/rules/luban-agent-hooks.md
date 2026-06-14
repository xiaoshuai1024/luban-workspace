<!--
description: Keep hooks 配置文件 and hook scripts in sync (avoid failClosed 127)
globs: .claude/settings.json, .claude/settings.local.json, .claude/hooks/**, scripts/hooks/**, scripts/verify_hooks.*
alwaysApply: true
-->

# Agent Hooks Hygiene（alwaysApply）

When editing **hooks 配置文件**（`.claude/settings.json` / `settings.local.json` 的 hooks 段）or adding/removing scripts under **hooks 脚本目录**（`.claude/hooks/` / `scripts/hooks/`）:

1. Every `command` path that points at a repo file **must exist** before you finish (missing files with `failClosed: true` can block tools with exit **127**).
2. **`beforeSubmitPrompt`** / **`UserPromptSubmit`** must return the harness-expected response shape. Do not reuse response shapes from other hook events.
3. After changes, run the repo's hooks verifier (e.g. `python3 scripts/verify_hooks.py` or `node scripts/verify-hooks.mjs`) and fix any reported missing paths.
4. Prefer **project-relative** commands like `hooks/my-hook.js` (workspace root is the cwd for project hooks).
5. Windows 注意：hook command 须兼容 Git Bash（POSIX sh），不要写 cmd.exe / PowerShell 专属语法（`.bat` / `Set-Variable` 等）。

## 与文档对齐

- `.claude/settings.json` 是 Claude Code 专属配置
- `.agents/` 是跨工具共享（opencode / cursor / claude）
- 修改 hooks 时同步检查两处是否一致
