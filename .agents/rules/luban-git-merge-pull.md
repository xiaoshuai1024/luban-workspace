<!--
description: Git 合并、拉取（pull-all / push-all / pr-all）的行为与注意事项（GitHub gh）
globs: "**/*"
alwaysApply: false
-->

# Git 合并与拉取规范

## pull-all.sh 行为要点

### 自动 `submodule update --init` → detached HEAD

`scripts/git/pull-all.sh`（luban 各 submodule 同步默认分支）第一步执行 `git submodule update --init`，**这会强制子模块进入 detached HEAD**（检出 superproject 记录的 commit hash）。脚本不会自动切回 feature 分支。

### 处理方式

```bash
# 运行 pull-all.sh 后，在每个子模块中切回 feature 分支：
cd packages/engine/luban && git checkout feature/你的分支
cd packages/bff/luban-bff && git checkout feature/你的分支
cd packages/ui/luban-ui && git checkout feature/你的分支
# ... 其余子模块同理
```

### 若子模块有未提交改动

```bash
# 运行 pull-all.sh 前：
cd packages/engine/luban && git stash   # 暂存本地改动
# 运行 pull-all.sh 后：
cd packages/engine/luban && git stash pop  # 恢复
```

### merged origin/<默认分支> 后子模块指针变动

主仓库 commit 的合并可能引入子模块指针更新。`git status` 会显示 `M packages/xxx`。此时需在主仓库提交指针更新（或通过 `/push-all` / `/pr-all` 处理）。

---

## 经验：pull-all.sh 后子模块 detached HEAD 处理

### 场景
运行 `bash scripts/git/pull-all.sh` 后，子模块报 `ERROR: detached HEAD — aborting`。

### 根因
脚本的 `git submodule update --init` 将子模块置于 detached HEAD。脚本设计为：detached HEAD 时仅更新本地默认分支，不执行合并。后续操作需手动处理。

### 解决方案
```bash
# 确认默认分支已是最新
git fetch origin <默认分支>
# 切回 feature 分支
git checkout feature/<name>
```

### 预防
- 在 `pull-all.sh` 输出中关注 detached HEAD 告警
- 拉取后批量检查所有子模块分支：在各子模块执行 `git branch`

---

## 经验：gh CLI 创建 PR — 逐个仓库 vs 全量模式

### 场景
`/pr-all` 在某些仓库创建 PR 失败（如默认分支名不一致、权限不足），但其它仓库成功。

### 根因
luban 11 个子项目默认分支不同（6 master + 5 main），全量脚本按统一目标分支时部分仓库会失败。

### 解决方案
失败时改用按包命令：
```bash
/pr-engine    # 仅 packages/engine/luban
/pr-bff       # 仅 packages/bff/luban-bff
/pr-ui        # 仅 packages/ui/luban-ui
/pr-website   # 仅 packages/web/luban-website
/pr-backend-java
/pr-backend-go
/pr-client
/pr-workspace # 仅 meta 仓
```

### 预防
- 优先使用按包 PR 命令，更稳定且可为不同仓库定制 commit 消息
- `/pr-all` 适合各仓库 commit 消息统一的简单场景
- 提 PR 前确认目标分支（master / main）与该子项目默认分支一致

详见 `docs/GIT_WORKFLOW.md`。
