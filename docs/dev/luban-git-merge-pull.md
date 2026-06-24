# Git 合并/拉取经验（submodule 多仓协作）

> 索引：submodule squash 合并的指针稳定性、PR 合并顺序、本地主仓同步。

---

## 经验：submodule squash 合并后 meta 指针变 dangling

### 场景
多仓协作（meta + 多个 submodule）。engine 子仓在 `feature/luban-ai-assistant-plan1` 分支开发，push 后：
1. engine PR `--squash` 合并到 master，`--delete-branch` 删除 feature 分支
2. meta 仓此前已把 engine 指针指向 feature 分支的 HEAD commit `2c3dbf0`

合并后，meta 仓的 engine 指针 `2c3dbf0` 不在 master 历史里（squash 生成新 commit `a8b169a`），且 feature 分支已删除——`2c3dbf0` 变成 dangling commit（GitHub 会保留约 90 天，之后可能 gc）。

### 根因
squash 合并重写 commit 历史（新 hash），原 feature 分支 HEAD 不进主干。`--delete-branch` 又移除了唯一指向它的 ref。meta 的 submodule 指针指向的是一个"孤儿"commit。

### 解决方案
**合并顺序**：先合 submodule 的 PR，再把 meta 的 submodule 指针**更新到 squash 后的主干 HEAD**，最后合 meta PR。

```bash
# 1. 合 engine PR（squash）→ master 新 HEAD = a8b169a
gh pr merge <num> --repo <engine> --squash --delete-branch

# 2. 在 meta 仓更新 engine 子仓指针到稳定主干 commit
cd packages/engine/luban
git fetch origin master
git checkout master
git reset --hard origin/master   # 现在 HEAD = a8b169a（含 squash 内容）
cd -  # 回 meta
git add packages/engine/luban
git commit -m "chore: engine 指针更新至 master(squash 合并 a8b169a)"
git push                          # 更新 meta PR

# 3. 合 meta PR
gh pr merge <num> --squash --delete-branch
```

### 预防
- **squash 合并 submodule 后，meta 指针必须重新指向主干 HEAD**，不要保留指向 feature 分支 commit 的指针。
- 合并多仓 PR 的顺序：先叶子（submodule），后根（meta）；每合一个 submodule PR，立即更新 meta 指针再合 meta。
- 若已合 meta 但指针是 dangling commit：clone 仍能解析（GitHub 短期保留），但应尽快发 meta PR 把指针修正到主干。
- 判断指针是否稳定：`git -C <submodule> branch -a --contains <指针commit>`，若无任何 ref 包含则危险。

---

## 经验：本地主仓在 feature 分支时如何注册新 submodule

### 场景
main 已合并了新 submodule（如 `packages/ai/luban-ai-assistant`），但本地主仓当前在另一个 feature 分支（有未提交改动），该分支的 `.gitmodules` 和 index 都没有新 submodule 条目。直接 `git submodule update --init` 报 `pathspec did not match`。

### 根因
submodule 的注册由两部分构成：①`.gitmodules` 条目（声明）②index 中的 gitlink（mode 160000 + commit 指针）。feature 分支两者都没有，`git submodule update` 不知道要拉什么。

### 解决方案
从 main 只取这两个文件项到当前分支（不碰其他代码改动）：

```bash
git checkout main -- .gitmodules
git checkout main -- packages/ai/luban-ai-assistant   # 取 gitlink
git submodule update --init packages/ai/luban-ai-assistant
```

之后 `git diff --cached` 只显示 `.gitmodules` + gitlink 两项，单独 commit 即可，不影响 feature 分支的其他工作。

### 预防
- 新 submodule 合入 main 后，各 feature 分支 rebase/merge main 即可自然获得；不必手动 checkout。
- 若 feature 分支不方便 merge main，用上面的 `git checkout main --` 局部取件法（最小侵入）。
