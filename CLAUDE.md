# CLAUDE.md

luban-workspace — luban 低代码平台的统一治理 meta 仓。Git superproject 通过 submodule 引入 11 个子项目，统一 AI agent 规则、测试门禁、命令与工作流。

本文件为 Claude Code 主入口。所有 agent 通用规范见 `AGENTS.md`。

## 项目概述

**luban 低代码平台（luban-workspace）** — meta 仓 + 11 子项目：

| 子项目 | 路径 | 技术栈 | 默认分支 |
|------|------|--------|--------|
| 低代码引擎 | `packages/engine/luban` | TypeScript | master |
| BFF | `packages/bff/luban-bff` | TypeScript / Node | master |
| 组件库/物料 | `packages/ui/luban-ui` | Vue 3 / Vite | master |
| SSR 站点 | `packages/web/luban-website` | TypeScript / SSR | master |
| 后端 Java | `packages/backend/luban-backend` | Java / Spring Boot / Maven | master |
| AI 助手 | `packages/ai/luban-ai-assistant` | （规划中） | main |
| 桌面端 | `packages/client/luban-electron` | Electron（规划） | main |
| 移动端 | `packages/client/luban-flutter` | Flutter（规划） | main |
| 跨平台 | `packages/client/luban-cross-plateform` | （规划） | main |
| 架构文档 | `packages/docs/luban-architecture-design` | 文档 | main |

非中文用户用英文交互，中文用户用中文。

## 🔴 硬约束（MUST）

### 1. 信息与代码必须真实，禁止推测/假信息
所有信息与代码须基于实际代码、官方文档或已验证事实。禁止凭空推测 API/签名/配置；禁止编造报错；不清楚时说"不确定"，先查代码/文档再答。违反者代码审查应被驳回。

### 2. 低代码引擎交付门槛（替代微信合规）
凡改动引擎/物料/schema，须满足：本地 `pnpm run build` 成功且渲染器零新增 console error；物料 props schema 合规（见 `.agents/rules/luban-material-schema.md`）；引擎产物在 `packages/web/luban-website`（SSR）及各端渲染一致；不确定行为标注"需验证"。

### 3. 后端单端权威（Java）
Java 后端 `packages/backend/luban-backend` 为唯一后端实现（Go 双后端战略已放弃，Q4=C，2026-06-28，见 `docs/DUAL_BACKEND_PARITY.md`）。不再要求双后端契约对齐。

### 4. E2E 禁止跳过/假绿
所有 E2E 真实执行，禁止 `*.skip`/条件跳过；需跳过须用户明确同意；禁止"未起依赖→全 skip→退出 0"冒充通过。见 `.agents/rules/luban-e2e-execution-contract.md`。

## 快速命令

### TS 仓（engine/bff/ui/website）— pnpm
```bash
pnpm install · pnpm test · pnpm run build · pnpm run test:e2e
```
### 后端 Java
```bash
mvn -q verify          # 单测 + 集成测
mvn spring-boot:run
```
### 全栈门禁
```bash
make test-coverage     # 一键分栈覆盖率汇总 + HTML 报告
```

## 包管理
- **TS 仓统一 pnpm**；禁用 npm install / yarn（CI/遗留除外）
- **Java 仓用 Maven**；禁用 Gradle

## 文件编码（MUST）
所有 `.ts/.vue/.js/.go/.java` 必须 **UTF-8 without BOM**。发现乱码立即修复，不得用 GBK/Latin-1。

## 架构概览
```
低代码引擎(luban) → BFF(luban-bff) → Java 后端(单端权威)
        ↑
  UI 物料库(luban-ui) + SSR 站点(luban-website) + 多端(electron/flutter) + AI 助手
```
- 引擎消费 luban-ui 物料的组件 + schema 渲染页面
- BFF 聚合后端（Java）能力，供引擎/website/多端调用

## 关键约定

### Git 工作流（GitHub）
- 分支：各子仓保留现有默认分支（6 master + 5 main）；新提交统一 `feature/*`
- 禁止直接 push 默认分支；多系统改动用同名 feature 分支
- 合并冲突：优先分析双方逻辑保留双方；禁止 `--ours/--theirs`；无法确认询问用户
- 常用：`/pr-all` `/pull-all` `/push-all`

### 测试门禁
- 每个子项目改码后在该包根目录执行构建+测试
- 覆盖率目标：TS 引擎/bff/website 85% · UI 组件库 90% · Java 后端 80%
- `make test-coverage` 汇总

### GitHub 集成（替代云效）
- 优先 gh CLI + GitHub MCP Server；PR/Issue/label 走 `scripts/github/`
- 工作项状态变更须先询问用户

### 改码前必须 Read
Edit/Write 任何文件前先 Read 确认当前状态，禁止凭记忆改。涉及 3+ 文件或跨子仓改动，先列范围等用户确认；小改动直接执行。

## 记忆系统（MUST）
用 MCP memory（`@modelcontextprotocol/server-memory`）或 claude-mem 管理。禁止手动 Write `memory/*.md`（重复存储）。决策/约束/踩坑类问题先检索 memory。

## Agent Rules
- 通用规范见 `AGENTS.md`（需加载）· 详细规则 `docs/AGENT_RULES.md`（§0–11）
- 工作流 `docs/SUPERPOWERS.md` · 低代码引擎规范 `docs/LOWCODE_ENGINE_SPEC.md`
- 测试规范 `docs/TESTING_SPEC.md`
- E2E 指南 `docs/E2E_AGENT_GUIDE.md` · 技术经验库 `docs/dev/`（见 `docs/dev/INDEX.md`）

## 启动检查（MUST）
Agent 开始任何任务前，见 `AGENTS.md`「启动检查」（10 步）。
