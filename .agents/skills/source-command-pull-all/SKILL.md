---
name: "source-command-pull-all"
description: "拉取目标分支（默认各子仓默认分支）代码到当前检出分支，不管当前是什么分支"
---

# source-command-pull-all

Use this skill when the user asks to run the migrated source command `pull-all`.

## Command Template

在主仓库根目录执行：

```bash
bash scripts/git/pull-all-default.sh [BRANCH]
```

`BRANCH` 默认为各子仓的**默认分支**（按 `.gitmodules` 的 `branch` 字段：6 个 master / 5 个 main）。可传入任意远端存在的分支名覆盖。

**行为简述**

1. 按 `.gitmodules` 路径逐个 `git submodule update --init`，初始化子模块目录。
2. **每个仓库（主仓 + 各子模块）**：
   - 检查 **detached HEAD** → 任一仓库处于 detached HEAD 立即报错退出
   - `git fetch origin <branch>` 拉取远端目标分支
   - 无论当前在什么分支，把 **`origin/<branch>` 合并进当前分支**
   - 若已经是最新则跳过
   - 合并冲突时 Git 会中止，需手动解决
3. **不换分支**。

**注意：** 
- 如果只是想把各子仓默认分支合并到当前分支，不管当前是否 `feature/*` 分支，直接 `bash scripts/git/pull-all-default.sh`
- 各子仓默认分支不统一（master / main 并存），脚本按 `.gitmodules` 逐仓解析

**你必须：** 在终端运行上述命令并回报汇总结果（含报错/warn）。
