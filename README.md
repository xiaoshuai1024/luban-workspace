# luban-workspace

luban 低代码平台的统一治理 meta 仓。通过 git submodule 管理 11 个子项目，统一 AI agent 规则、测试门禁、命令与工作流。规范骨架参照 `kangdou-fullstack`，经 luban 化改造。

## 快速开始

```bash
git clone --recurse-submodules <this-repo>
# 或已克隆后：
make clone-all          # 初始化所有 submodule
make install-deps       # 各包装依赖（pnpm/mvn/go）
make test-coverage      # 全栈覆盖率门禁
```

## 结构

| 目录 | 用途 |
|---|---|
| `.agents/` | 跨工具共享规范（rules / commands / skills / ecc） |
| `.claude/` | Claude Code 配置（settings / mcp / commands / skills / hooks） |
| `docs/` | 详细规范 + 技术经验库（`docs/dev/`） |
| `harness/prompts/` | Prompt 模板 |
| `scripts/` | git / coverage / github 编排脚本 |
| `packages/` | 11 个子项目（git submodule） |

## 子项目

| 包 | 仓 | 技术栈 |
|---|---|---|
| engine | luban | TS 低代码引擎 |
| bff | luban-bff | TS BFF |
| ui | luban-ui | Vue3 物料库 |
| web | luban-website | TS SSR |
| backend | luban-backend | Java Spring Boot |
| backend | luban-backend-go | Go |
| ai / client/* | （规划中） | AI 助手 / 桌面 / 移动 / 跨平台 |

## 常用命令

```bash
make {clone-all, pull-all, push-all, pr-all, test-coverage, test, dev}
```

自定义斜杠命令（`/pr-all` `/tdd` `/super-pm` `/luban-review` …）见 `AGENTS.md`。

## 文档
- 规范：`AGENTS.md` / `CLAUDE.md` / `docs/AGENT_RULES.md`
- 工作流：`docs/SUPERPOWERS.md`
- 测试：`docs/TESTING_SPEC.md` / `docs/E2E_AGENT_GUIDE.md`
- 技术经验库：`docs/dev/INDEX.md`

## 已知待办（初始化遗留）

- **4 个空仓 submodule 待接入**：`ai-assistant` / `electron` / `flutter` / `cross-plateform`（GitHub 上为空）。待各仓有初始提交后：
  ```bash
  bash scripts/git/add-empty-submodule.sh luban-ai-assistant packages/ai/luban-ai-assistant main
  bash scripts/git/add-empty-submodule.sh luban-electron packages/client/luban-electron main
  bash scripts/git/add-empty-submodule.sh luban-flutter packages/client/luban-flutter main
  bash scripts/git/add-empty-submodule.sh luban-cross-plateform packages/client/luban-cross-plateform main
  ```
- **功能 stub 脚本**：`scripts/{contract-check,verify-production}.sh`、`scripts/e2e/engine-render-preflight.sh`、`scripts/feishu/*`、`scripts/verify-plan-ssot.mjs` 等标 TODO，待各子项目落地后实现。
- **luban-ui 设计 token**：`docs/UI_SPEC.md` / `design-system/luban/MASTER.md` 的品牌色与 token 待从 `packages/ui/luban-ui` 提取。
- **MCP token**：`.claude/mcp.json` 的 github/figma token 为占位，需填实际值。
- **可执行位**：脚本已 chmod，提交时需 `git update-index --chmod=+x scripts/**/*.sh`（见 `scripts/README.md`）。

完整清单与设计依据见 `INIT-PLAN.md`。
