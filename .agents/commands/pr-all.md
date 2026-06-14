---
description: 先 /pull-all 同步默认分支并按项目约定解决冲突，再提交子模块 + 主仓库 gh pr create 到默认分支
---

# /pr-all

分两个阶段：**① 同步默认分支并解决冲突** → **② 提交 + 创建 PR**。第 ① 阶段未完成（仍有冲突/构建未过）前不得进入第 ② 阶段。

---

## 阶段 ①（MUST 前置）：同步默认分支并解决冲突

执行提交/PR 之前，**必须先**把 `origin/<默认分支>` 合并进当前各仓库分支，把冲突消化在本地，避免 PR 远端冲突：

```bash
bash scripts/git/pull-all-default.sh
```

（等价于 `/pull-all`：主仓 + 各子模块逐个 `fetch` + `merge origin/<默认分支>` 进当前分支，不换分支。各子仓默认分支按 `.gitmodules` 的 `branch` 字段，主仓 PR 默认目标 `main`。）

### 若 pull-all 产生冲突

按项目约定的冲突处理原则处理（见 `CLAUDE.md`「合并冲突处理原则」与 `/merge-conflict`）：

1. **默认保留双方代码** — 分析冲突双方逻辑；同一文件同一区域冲突时，判断两段是否解决不同问题——是则合并双方，实质相同则保留较完整一方、删除重复。**禁止直接 `--ours` / `--theirs` 丢弃另一方**。
2. **逐文件确认** — 每个冲突文件先展示冲突内容（`<<<<<<<` / `=======` / `>>>>>>>`）+ 推荐合并方案，**等待用户确认**后再执行；禁止批量自动合并。
3. **子模块指针冲突** — 主仓各子模块指针冲突时，先确认对应子模块 PR 是否已合并到默认分支，再 `git add <submodule>` 指向默认分支最新提交。
4. **合并后构建+测试** — 每个项目冲突解决后跑对应构建测试，失败先修复再继续：
   - Java 后端 `packages/backend/luban-backend` → `mvn -q verify`
   - Go 后端 `packages/backend/luban-backend-go` → `go test ./... -race -cover`
   - 引擎/BFF/UI/website（TS 包）→ `pnpm test && pnpm run build`
5. **无法确认时停下来询问用户**，给出冲突内容 + 推荐方案，不要猜。
6. 全部冲突解决并 `git commit` 完成合并后，才进入阶段 ②。

---

## 阶段 ②：提交 + 创建 PR（GitHub gh CLI）

阶段 ① 完成（工作区干净、与默认分支无冲突）后，在主仓库根目录执行：

```bash
bash scripts/github/pr-create-all.sh
```

可选统一标题与提交说明：

```bash
bash scripts/github/pr-create-all.sh -m "chore: 同步各端改动" -t "chore: 同步各端改动"
```

**行为：** 依次遍历各子模块 → 主仓库，每个仓库执行：
1. commit 本地改动
2. push 到远端当前分支（`feature/*`）
3. 调用 `gh pr create` 创建 PR 到各仓默认分支（gh 不自动合并，PR 创建后由 Reviewer 在页面合并）

**你必须：**
- 各仓库当前分支均符合 `feature/*`、`bugfix/*` 或 `hotfix/*`（否则脚本会跳过该子模块；主仓分支不符需先 rename）。
- 阶段 ① 的 pull-all 终端输出如实汇报；若有冲突，按上述约定逐文件处理完再继续。
- 执行阶段 ② 完整终端输出并汇总每个 PR 链接。

策略：GitHub（`gh` CLI）；禁止云效/MR。各子仓默认分支按 `.gitmodules`（master / main 并存）；主仓 PR 目标 `main`。
