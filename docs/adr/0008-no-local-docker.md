# ADR 0008: 禁止本地 Docker，中间件远端化

| 字段 | 值 |
|------|-----|
| 状态 | Accepted |
| 日期 | 2026-06-28 |
| 决策者 | 运维 + 架构组 |
| 关联文档 | [.agents/rules/luban-no-local-docker.md](../../.agents/rules/luban-no-local-docker.md)、docs/SYSTEM_ARCHITECTURE.md §2.6 |
| 回溯 | Yes（决策实际发生于项目早期，本篇为 2026-06-28 回溯记录） |

## 背景 (Context)

Luban 本地开发需 MySQL、Redis 等中间件，部分验证还需 6 容器（/ai/chat 完整链路、minio、postgres、milvus、langfuse）。若每个开发者本地 docker compose 起中间件，会带来三类问题：团队成员机器负担重（Docker Desktop 内存/CPU 占用高，多端裸进程同时跑时尤为明显）；本地环境漂移（版本、数据、端口因人而异，联调口径不一）；Agent 自动化时若假设本地有 docker engine 会频繁卡在"Docker Desktop 未启动"。

团队倾向用一份远端共享的 dev 中间件，让本机应用以裸进程方式连接。

## 决策 (Decision)

MySQL/Redis 等中间件常驻远端 dev 服务器（192.168.100.248），严禁在开发者本地启动 docker。

- 硬约束（luban-no-local-docker，alwaysApply）：禁止 `docker compose up` / `docker run` / `docker start` / 拉起 Docker Desktop；看到 docker engine 未就绪时不得尝试启动。
- 中间件：MySQL `192.168.100.248:13306`（db=luban, user=root）+ Redis `192.168.100.248:16379`；SSH user `john`。本机应用连接串必须指向远端，否则连不上。
- 端口设计：本机 dev 全部裸进程、端口互不冲突（engine 5173 / bff 3100 / web 3000 / Java 8080 / Go 8081）。
- 需要容器化验证（6 容器链路）时，询问用户在远端执行或由用户提供远端结果；不依赖容器的验证（单测、provider 直调 smoke）可在本地跑。

## 考虑过的备选方案 (Alternatives Considered)

### 备选 A：本地 docker compose 起中间件
- 优点：环境自包含、离线可用、每人隔离干净。
- 缺点 / 代价：Docker Desktop 资源占用高，多端裸进程同跑时机器卡顿明显；版本/数据/端口因人而异，联调口径漂移；Agent 自动化会被"Docker Desktop 未启动"反复打断。

### 备选 B：每人一份云开发环境（如 Cloud Workstation / Codespaces）
- 优点：环境完全隔离与标准化、随处可访问。
- 缺点 / 代价：每人常驻云环境成本高；网络往返延迟影响裸进程调试体验；与本地 IDE/Agent 工具链集成需额外配置；团队当前规模收益不抵成本。

## 后果 (Consequences)

- **正面**：本机负担轻、裸进程调试体验好；中间件口径统一、数据共享；Agent 不再被本地 docker 启停打断；治理规则 alwaysApply 保证一致性。
- **负面 / 代价**：依赖内网/VPN 可达远端；远端单点，并发或数据污染需约定；容器化验证不能本地自助跑，需用户介入远端。
- **需要后续跟进**：维护远端可用性与备份；约定多人共用中间件的数据隔离与清理责任；评估随团队规模是否演进到备选 B。

## 备注

推翻条件：团队规模或异地协作使得远端共享中间件成为瓶颈，或本地机器普遍具备富余资源且环境标准化手段成熟。
