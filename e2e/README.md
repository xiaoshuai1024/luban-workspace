# Luban 跨项目流程性 E2E

主项目编排 engine→BFF→backend→website 全链路的端到端测试。方案见
[`../.agents/plans/2026-06-19-luban-e2e-strategy.md`](../.agents/plans/2026-06-19-luban-e2e-strategy.md)。

> 各子项目自洽的 e2e 见各自子仓（engine/website/ui），本目录只做**跨项目流程**。

## 前置

1. `cp .env.example .env` 并填入 `LUBAN_E2E_ACCOUNT` / `LUBAN_E2E_PASSWORD`（后端预置专用账号）。
2. `pnpm install`
3. `pnpm run install:e2e`（首次，安装本机 Chrome）

## 跑

```bash
make e2e-up        # 起服务编排（docker-compose.e2e.yml）
make e2e-cross     # 跑跨项目流程（发布/线索/双后端）
make e2e-down      # 停服务编排
```

或直接：

```bash
pnpm test          # 全部
pnpm test:engine   # 仅引擎流程（发布/线索闭环）
pnpm test:contract # 仅双后端一致性
```

## 覆盖的流程

| 流程 | spec | 链路 |
|------|------|------|
| 发布闭环 | `flows/publish-flow.spec.ts` | 登录→建站点→建页面→发布→website SSR |
| 线索闭环 | `flows/lead-capture-flow.spec.ts` | website 表单→backend→engine 线索中心 |
| 双后端一致性 | `contract/dual-backend.spec.ts` | 同请求打 Java/Go 等价 |

## 纪律

遵守 `docs/E2E_AGENT_GUIDE.md` 与 `luban-e2e-execution-contract`：首个失败即停、禁止假绿、
服务未起须先 `make e2e-up` 排查而非 skip。
