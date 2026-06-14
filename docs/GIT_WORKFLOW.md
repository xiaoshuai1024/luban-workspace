# Git 工作流（luban-workspace · GitHub）

本文档定义 Agent 必须遵守的 Git 工作流规范。luban-workspace 是 Git superproject，通过 submodule 引入 11 个子项目。代码托管在 **GitHub**（替代云效/Codeup）。

---

## 〇、克隆与子模块：SSH 检测与 HTTPS 备选

仓库与子模块默认使用 **SSH**（见仓库根目录 `.gitmodules`）。在开始 `git clone` / `git submodule update` 前，Agent 与用户应先确认本机是否具备可用的 SSH 密钥；若克隆或子模块更新出现 `Permission denied (publickey)` 或类似认证失败，应优先引导完成 SSH 配置，而不是反复重试命令。

### 〇.0 交互式脚本（推荐）

在主仓库根目录执行：

```bash
./scripts/git-auth-setup.sh
```

脚本会：检测是否存在 `~/.ssh/id_ed25519.pub` 或 `id_rsa.pub`；若无公钥且你选择 SSH，则打印 GitHub SSH 配置步骤并退出（避免无效重试）；若选择 HTTPS，则提示按 GitHub 文档配置 HTTPS 克隆（Personal Access Token / `gh auth login`）；随后为本机设置各子项目 URL（**只改本地配置**，不修改已提交的 `.gitmodules`），并执行 `git submodule update --init --recursive`；失败时按协议给出对应文档链接。

非交互（CI 或脚本调用）：`GIT_AUTH_MODE=ssh ./scripts/git-auth-setup.sh` 或 `GIT_AUTH_MODE=https ./scripts/git-auth-setup.sh`。

### 〇.1 是否已配置 SSH 公钥（自检）

```bash
# 若文件存在且能打印出以 ssh-ed25519 或 ssh-rsa 开头的公钥，通常表示已生成密钥
test -f ~/.ssh/id_ed25519.pub && cat ~/.ssh/id_ed25519.pub
test -f ~/.ssh/id_rsa.pub && cat ~/.ssh/id_rsa.pub
```

可选连通性测试（需已把公钥添加到 GitHub）：

```bash
ssh -T git@github.com
```

### 〇.2 未配置或未在 GitHub 绑定公钥时的建议

1. **生成密钥（推荐 ED25519）**：`ssh-keygen -t ed25519 -C "你的邮箱或备注"`
2. **将公钥完整复制**（从 `ssh-` 开头到行末）。
3. **登录 GitHub** → 右上角头像 → **Settings** → **SSH and GPG keys** → **New SSH key** → 粘贴并保存。

官方步骤见 GitHub 文档：[Connecting to GitHub with SSH](https://docs.github.com/en/authentication/connecting-to-github-with-ssh)。

### 〇.3 子模块能否选择 SSH 或 HTTPS？

**Git 不会在每次操作时弹出「选 SSH 还是 HTTPS」的交互菜单。** 鉴权方式由 **远程 URL 的协议** 决定：

| 来源 | 作用 |
|------|------|
| **`.gitmodules`（提交到仓库）** | 记录团队默认的子模块 URL（本项目为 SSH）。所有人 `git submodule update --init` 时会按该 URL 拉取。 |
| **本地覆盖（推荐用于个人偏好）** | 不在仓库里改 `.gitmodules`，仅在当前克隆内改用 HTTPS，例如：`git submodule set-url packages/engine/luban <https-url>`，然后执行 `git submodule sync --recursive` 与 `git submodule update --init`。 |

因此：**可以让不同开发者在本机分别使用 SSH 或 HTTPS**，做法是各自在克隆主仓库后，用上述命令把子模块 URL 改成 HTTPS（或反过来改回 SSH），无需修改主仓库已提交的 `.gitmodules`。

与本项目路径一致的示例（主仓库与各子模块路径与 SSH 形态一致，仅协议与主机写法不同）：

```text
# SSH（默认，与 README / .gitmodules 一致）
git@github.com:<owner>/<repository>.git

# HTTPS（仅供未配置 SSH、选择 HTTPS 的用户在本地使用）
https://github.com/<owner>/<repository>.git
```

### 〇.4 Agent / 自动化修改代码前的分支（强制）

**背景**：本项目维护者通常已经在正确的工作分支中打开 workspace。Agent 自动新切 `feature/*` 分支会把改动写到错误位置，打断维护者的分支节奏。

**规则**：凡将变更写入 Git 跟踪的文件（含 `docs/`、`packages/`、`scripts/` 等），在**第一次保存/写入前**，必须在**被修改文件所属的 Git 仓库**内确认当前分支：

1. 先执行并汇报当前仓库路径与 `git branch --show-current`。
2. **用户分支优先**：默认留在用户当前工作分支写代码。
3. **不得自动新切分支**：除非用户在本轮对话中明确要求创建/切换分支，否则 Agent 不得执行 `git checkout -b feature/...`。
4. **分支不匹配时先问**：若当前分支不是用户指定分支，必须暂停并询问用户希望切到哪个分支或是否继续在当前分支写入。
5. **子模块**：若修改各子项目（`packages/engine/luban` 等）等独立子模块仓库，应在对应子模块仓库内分别确认分支；多仓任务默认使用用户指定的同名工作分支。
6. **禁止**：在**默认分支**（master / main）上直接开发式提交（热修复也须先取得用户明确指令并按 hotfix 流程）。
7. **例外**：用户明确要求「新建 feature 分支」「就在当前分支提交」等，按用户指令执行，并在回复中注明分支策略。

### 〇.5 任务级分支规则（MUST）

1. **单子项目任务**：任意任务开始前，确认该子项目仓库当前分支；默认在用户当前工作分支写入。
2. **多子项目任务**：涉及两个及以上子项目时，相关子项目默认使用用户指定的同名工作分支（`feature/<name>`）。
3. **任务切换**：不得因任务切换自动创建新分支；若 Agent 判断需要隔离分支，必须先说明原因并取得用户明确同意。
4. **执行顺序**：`git branch --show-current` → 确认是用户指定分支 → 开始首次写入。
5. **违规处理**：若发现已切到非用户指定分支或产生了新任务改动，必须立即停止继续开发，切回/迁移前先向用户说明并确认。

Agent 在开始写代码前应简要汇报：**当前仓库路径、`git branch --show-current` 显示的分支名**；若无法执行 git（只读沙箱等），须说明并请求用户确认分支后再继续。

### 〇.6 合并冲突与拉取（Agent MUST）

1. **禁止自动合并**
   - 不得在未获用户**逐步、明确**授权的情况下，自行完成会产生合并提交的 `merge` / `rebase` / `cherry-pick` 等并推送到远端。
   - 不得使用「自动接受某一方」类策略静默解决冲突并提交。

2. **发现冲突时**
   - **立即停止**相关 Git 写操作，向用户说明冲突涉及的大致路径与命令上下文。
   - **必须询问用户**希望如何处理（例如：保留本地、保留远端、逐文件手工、中止合并等）。
   - **在得到用户明确指示前**，不得提交合并结果、不得假定用户选择某一策略。

3. **用户要求 pull / 拉代码时**
   - 若当前仓库存在**未提交**的本地改动（含已暂存或未暂存）：**须先**与用户确认后完成 **`git commit`**（或用户**明确**要求时用 `stash` 等等价方式），**再**执行 `pull`；禁止在未处理工作区改动时直接 `pull`，以免丢失或产生难以追溯的冲突。
   - 若无任何可提交改动，可按常规流程 `pull`。

---

## 一、分支结构

luban 11 个子项目保留各自现有默认分支（6 master + 5 main）。新提交统一在 `feature/*` 分支进行。

```
各子项目默认分支（master / main）
  ↑
feature/<name>（同名分支跨子项目）
  ↑
hotfix/xxx（热修复）→ 直接合入默认分支
```

---

## 二、分支说明

| 分支 | 用途 | 生命周期 | 合并目标 |
|------|------|----------|----------|
| `<默认分支>`（master / main） | 各子项目的发布/主干 | 长期 | - |
| `feature/xxx` | 功能开发（同名跨子项目） | 短期 | 各子项目默认分支 |
| `hotfix/xxx` | 生产紧急修复 | 短期 | 默认分支 |
| `bugfix/xxx` | 非紧急缺陷修复 | 短期 | 默认分支 |
| `release/xxx` | 发版准备 | 短期 | 默认分支 |

---

## 三、工作流程

### 3.1 功能开发流程

```
1. 确认用户当前工作分支
   │
2. 在当前工作分支开发 + commit
   │
3. 功能完成 → 用户选择是否 push / 创建 PR
   │
   ├── [选项A] 保留在当前工作分支
   │   (Agent: "已 commit 到 feature/xxx，是否 push?")
   │
   └── [选项B] 创建 PR
       (Agent: "是否从 feature/xxx 创建到默认分支的 PR?")
```

### 3.2 热修复流程

```
1. 从默认分支切出 hotfix 分支
   │
2. 修复并 commit
   │
3. 提交 PR 到默认分支
```

---

## 四、Commit 规范

### 4.1 提交信息格式

```
<type>: <subject>

<body>

<footer>
```

### 4.2 Type 说明

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 缺陷修复 |
| `docs` | 文档 |
| `style` | 格式（不影响逻辑）|
| `refactor` | 重构 |
| `test` | 测试 |
| `chore` | 工具链、依赖 |
| `perf` | 性能优化 |
| `build` | 构建/依赖变更 |
| `ci` | CI 配置 |

### 4.3 示例

```
feat: 引擎新增物料版本治理

- 物料声明 semver 版本
- schema 引用记录版本
- 引擎做版本兼容性检查

Closes #123
```

---

## 五、Commit 提交时机

**禁止自动 commit**，除非满足以下条件之一：

1. **完成完整需求后** - 用户验收通过，发出提交询问
2. **用户明确要求提交** - 用户主动要求 commit 代码

## 六、Commit 时 Agent 行为

功能完成后，Agent 必须询问用户：

```
## 选项 A：保留在当前分支
> "已 commit 到 feature/xxx。是否 push 到远程？"

## 选项 B：创建 PR
> "是否从 feature/xxx 创建到默认分支的 PR？"
```

用户确认前，**禁止**执行 push 或创建 PR。

当用户在对话中明确提出「提交代码」「提交修改」或语义等价请求时，Agent 应按当前分支策略执行完整提交流程：`commit + push`（不只 commit 不 push）；若分支/远程状态不满足 push 前置条件，应先向用户说明并完成必要准备后再 push。

---

## 七、禁止行为

- 未经用户确认就 commit
- 未经用户确认就 push
- 直接提交到默认分支（master / main）
- 跳过 PR 直接合并
- 强制覆盖远程分支
- **在任何情况下 push 到默认分支**
- **MUST NOT 在任意时间直接 commit 到默认分支**（热修复也必须走 `hotfix/*` → PR 流程）

---

## 八、GitHub 集成：gh CLI + MCP 优先

### 8.1 总原则（所有 GitHub 相关能力）

凡涉及 **GitHub** 的操作（含 PR、Issue、代码库、Actions、Release 等），**优先使用 gh CLI + GitHub MCP Server**。仅在两者均不可用时，才回退到 GitHub REST API（`curl`），并在回复中**写明回退原因**。

### 8.2 PR 创建（在总原则之上）

当用户出现「提交PR / 创建PR」或语义等价表达时，Agent 必须：

1. **先做环境初始化确认**：询问是否协助检查/安装创建 PR 所需环境（`gh auth login`、GitHub MCP server 配置启用、token、组织权限）。
2. **优先走 gh CLI**：使用 `gh pr create` 创建 PR，并遵守用户指定源分支 -> 目标分支（各子项目默认分支）。
3. **仅在 gh 不可用时回退**：可回退到 GitHub REST API，并在回复中说明回退原因。
4. **禁止目标为默认分支直接推送**：除非用户明确要求并走 hotfix 例外流程。
5. **首次使用且未鉴权必须增强引导**：若检测到首次未完成 `gh auth login`，必须提供可点击入口 URL（GitHub token 创建页、gh 安装文档）+ 明确步骤后再继续。
6. **完成确认前不得继续创建**：用户未确认「gh 已鉴权并校验通过」前，不得进入 PR 创建动作。
7. **后续触发必须再次提醒**：同一会话或后续会话再次触发 PR 意图时，如历史上出现过「首次未鉴权」场景，仍需再次提醒初始化要点。

### 8.3 PR 合并

当用户需要 **合并已创建的 PR** 时：

1. **优先用 gh CLI**：
   ```bash
   gh pr merge <number> --squash --delete-branch
   ```
2. **合并方式**：默认 `--squash`（luban 约定，保持默认分支历史整洁）；rebase / merge commit 须用户明确指定
3. **删除源分支**：合并后默认删除 feature 分支

### 8.4 按包 PR 命令（luban 特有）

luban 11 个子项目默认分支不同，全量 `/pr-all` 可能部分失败。失败时改用按包命令：

| 命令 | 作用 |
|------|------|
| `/pr-engine` | 仅 `packages/engine/luban` |
| `/pr-bff` | 仅 `packages/bff/luban-bff` |
| `/pr-ui` | 仅 `packages/ui/luban-ui` |
| `/pr-website` | 仅 `packages/web/luban-website` |
| `/pr-backend-java` | 仅 `packages/backend/luban-backend` |
| `/pr-backend-go` | 仅 `packages/backend/luban-backend-go` |
| `/pr-client` | 仅 `packages/client/*` |
| `/pr-workspace` | 仅 meta 仓 |

---

## 九、多仓（子项目）

- 各子项目使用**用户指定的同名工作分支**（`feature/<name>`）
- 提交时同步通知相关子项目
- 跨子项目改动用同名 feature 分支

---

## 十、常用命令参考

```bash
# 确认当前分支
git branch --show-current

# 如需切到用户指定工作分支
git checkout feature/<name>

# 推送当前工作分支
git push origin feature/<name>

# 创建 PR（gh CLI）
gh pr create --title "feat: xxx" --body "..." --base master --head feature/xxx

# 同步所有子项目默认分支（luban）
/pull-all

# 各子项目 commit + push（不建 PR）
/push-all

# 各子项目 + meta 仓 gh pr create
/pr-all
```
