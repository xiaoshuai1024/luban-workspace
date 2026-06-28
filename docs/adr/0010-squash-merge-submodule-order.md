# ADR 0010: Squash 合并 + submodule PR 顺序

| 字段 | 值 |
|------|-----|
| 状态 | Accepted |
| 日期 | 2026-06-28 |
| 决策者 | 工程效率组 |
| 关联文档 | docs/dev/luban-git-merge-pull.md、docs/GIT_WORKFLOW.md |
| 回溯 | Yes（决策实际发生于项目早期，本篇为 2026-06-28 回溯记录） |

## 背景 (Context)

luban-workspace 采用 meta + submodule 的多仓结构（详见 ADR-0007）。各子仓（engine、bff、website、backend 等）有独立 PR 流程，最终通过 meta 仓的 submodule 指针串联成一个可部署的整体。

实际协作中发生过一次 incident：engine 子仓在 `feature/luban-ai-assistant-plan1` 分支开发，meta 仓先把 engine 指针指向该 feature 分支的 HEAD commit `2c3dbf0`。随后 engine PR 以 `--squash --delete-branch` 合并到 master，生成新 commit `a8b169a` 并删除了 feature 分支。结果 `2c3dbf0` 既不在 master 历史中（squash 重写了历史），也失去了唯一指向它的 ref，变成 dangling commit——GitHub 会保留约 90 天，之后可能被 gc，届时 meta 指针将彻底无法解析。

根因在于：squash 合并会重写 commit 历史（产生新 hash），原 feature 分支的 HEAD 不会进入主干；而 `--delete-branch` 又移除了唯一指向原 commit 的 ref。如果 meta 的 submodule 指针还指向那个被丢弃的 commit，整个 meta 仓就处于「能 clone 但根基不稳」的危险状态。

我们需要一套明确的合并策略与顺序约定，从根本上杜绝 dangling 指针。

## 决策 (Decision)

submodule PR 一律用 squash 合并，且合并顺序为「先叶（子仓）后根（meta）」；每合一个 submodule PR，立即把 meta 对应的 submodule 指针更新到该子仓主干 HEAD，再合 meta PR。

具体操作顺序：

1. 先合 submodule 的 PR（`gh pr merge --squash --delete-branch`），得到子仓主干的新 HEAD。
2. 在 meta 仓内进入该 submodule，`fetch` + `reset --hard` 到子仓主干 HEAD，回到 meta 仓 `git add` 该 submodule 并提交，推送以更新 meta PR。
3. 所有涉及的 submodule 指针都更新到位后，最后合 meta PR（同样 squash）。

判断指针是否稳定：`git -C <submodule> branch -a --contains <指针 commit>`，若无任何 ref 包含该 commit 则危险，必须修正。

## 考虑过的备选方案 (Alternatives Considered)

### 备选 A：merge commit 合并（保留原历史）
- 优点：feature 分支的 HEAD commit 原样进入主干，hash 不变，meta 指针天然稳定，dangling 问题从根本上不存在。
- 缺点 / 代价：主干历史被 merge commit与中间提交撑大，可读性下降；与项目「线性整洁历史」的偏好冲突；review 时难以快速识别一次改动对应的完整变更集。

### 备选 B：rebase 合并
- 优点：历史线性，且原 commit（rebase 后）进入主干，指针稳定性优于 squash。
- 缺点 / 代价：rebase 同样重写 hash（每个 commit 都变），meta 指针仍需重新指向 rebase 后的 HEAD，操作复杂度不低于 squash 却得不到 squash「单一变更集」的整洁度；force-push 协调成本高。

### 备选 C：squash 合并但不删 feature 分支
- 优点：保留指向原 commit 的 ref，meta 指针短期可解析，dangling 风险降低。
- 缺点 / 代价：feature 分支堆积成垃圾，仓库分支列表快速膨胀；原 commit 仍是「不在主干上的孤儿」，只是延缓而非解决问题；一旦有人误删分支或 GitHub 自动清理，dangling 立刻复现。治标不治本。

## 后果 (Consequences)

- **正面**：meta 与各子仓的主干历史线性整洁；dangling commit 根因被「先叶后根 + 立即更新指针」的顺序约定彻底封堵；每次合并对应一个干净的 squash 变更集，review 与回溯清晰。
- **负面 / 代价**：meta 指针维护有严格操作顺序，多仓 PR 不能随意穿插合并；操作者必须熟悉「合子仓 → 更新 meta 指针 → 合 meta」三步流程，心智负担高于单仓。
- **需要后续跟进**：CI 增加指针稳定性校验（对 meta 引用的每个 submodule commit 跑 `branch --contains` 检查，命中 dangling 即拦截）；将本顺序固化到合并脚本或 skill，减少人工出错。

## 备注

本决策与 ADR-0007（submodule 多仓）配套生效。若日后整体迁移到 monorepo（取消 submodule），本 ADR 应标 Deprecated。详细操作命令见 `docs/dev/luban-git-merge-pull.md`。
