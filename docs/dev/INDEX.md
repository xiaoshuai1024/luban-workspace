# 技术经验库索引（docs/dev/）

> 从 kangdou-fullstack 迁移并去业务化的通用技术/架构/方法论经验。所有文档已去除业务场景（微信/云效/多租户/交易/圈子/联合套卡），通用化为「luban 多语言多端架构下如何应用」。
>
> 编码：UTF-8 without BOM。命名：原 kangdou 业务名 → 通用技术名（kd-review → review；kangdou- 前缀去除）。

---

## 调试

| 文档 | 用途 |
|------|------|
| [debugging-protocol.md](./debugging-protocol.md) | 测试失败排查顺序：Console → 后端日志 → curl → 根因；禁止改测试让测试通过；含 Spring Boot 路由冲突经验 |

## Git / 工作流

| 文档 | 用途 |
|------|------|
| [luban-git-merge-pull.md](./luban-git-merge-pull.md) | submodule 多仓协作：squash 合并后指针稳定性、PR 合并顺序、feature 分支注册新 submodule |

## 通用经验

| 文档 | 用途 |
|------|------|
| [luban-experience-lessons.md](./luban-experience-lessons.md) | 跨主题通用兜底：Windows cmd/CRLF 下 python -c 补丁失效、ruff noqa 残留与 B008 误报 |

## 安全

| 文档 | 用途 |
|------|------|
| [auth-security-policy.md](./auth-security-policy.md) | 凭证交换禁止 mock/fallback、输入过滤与 XSS、Session 管理、双后端/多端安全一致 |

## Java 后端

| 文档 | 用途 |
|------|------|
| [alibaba-java-development-manual.md](./alibaba-java-development-manual.md) | 阿里巴巴 Java 开发规范精简版（命名/常量/格式/OOP/集合/并发/控制语句/异常/日志/SQL/工程/双后端契约） |
| [java-coding-standards.md](./java-coding-standards.md) | Java 后端编码标准基线（mvn verify 门禁 + 双后端对齐约束） |

## 后端通用

| 文档 | 用途 |
|------|------|
| [backend-logging-executable-plan.md](./backend-logging-executable-plan.md) | 后端日志方案：logfmt 单行、滚动降噪、MDC requestId、SSH 可查、Java/Go 等价实现 |
| [swagger-openapi.md](./swagger-openapi.md) | SpringDoc OpenAPI 3 + Swagger UI 规范、Try it out 排查、双后端契约对齐 |
| [snowflake-id.md](./snowflake-id.md) | 分布式 ID 从 UUID 迁移到 Snowflake 的位段结构与多环境部署（前端必须字符串传输） |

## 数据库

| 文档 | 用途 |
|------|------|
| [dev-mysql-setup.md](./dev-mysql-setup.md) | 开发环境 MySQL Docker Compose 标准化配置、种子数据、双后端共用 |
| [mysql-slow-query-config.md](./mysql-slow-query-config.md) | MySQL 慢查询日志配置（my.cnf + logrotate + pt-query-digest + 告警规则） |
| [elasticsearch-deployment.md](./elasticsearch-deployment.md) | ELK 部署、Logstash JDBC 同步、索引 mapping 陷阱（id/时间戳类型）、日常运维 |

## E2E 测试

| 文档 | 用途 |
|------|------|
| [e2e-test-style-guide.md](./e2e-test-style-guide.md) | E2E 编写规范：超时约定、禁止反模式、数据创建禁止 SQL、Tag 分档、列表页禁止 UI 假绿、数据清理纪律 |
| [e2e-data-assertion-rule.md](./e2e-data-assertion-rule.md) | 写操作三层断言（操作 → API 响应 → 数据持久化）、禁止 waitForTimeout、双后端验证 |
| [e2e-must-detect-backend-errors.md](./e2e-must-detect-backend-errors.md) | E2E 硬约束：必须检测后端错误、禁止静默失败/假绿、requestId 对齐、双后端健康检查 |
| [e2e-full-coverage-methodology.md](./e2e-full-coverage-methodology.md) | 新模块全流程覆盖方法论：流程拆解 → 覆盖矩阵 → 补齐 → 验证门禁 |

## 方法论

| 文档 | 用途 |
|------|------|
| [review-five-rounds-gate.md](./review-five-rounds-gate.md) | 多轮 review 收敛门禁：分色分离计数、大规模合并策略、跨层审查、方案文档 review、编译≠测试 |
| [load-test-methodology.md](./load-test-methodology.md) | 压测方法论：容量推算、场景设计（含高并发抢购专项）、监控采集、瓶颈分析、双后端/BFF/SSR 压测 |
| [design-token-audit.md](./design-token-audit.md) | Design Token 缺口审计方法论：扫描 → 映射 → 分级 → 改造策略，多端一致与 SSR FOUC |
| [fake-feature-definition.md](./fake-feature-definition.md) | 假功能定义与禁止清单（弹窗代替逻辑/占位入口/假数据/骨架页/演示版本/假价/硬编码/假绿/引擎物料特有） |
| [document-writing-spec.md](./document-writing-spec.md) | 文档编写规范：必含结构、风险章节、监控项定义、Mermaid 兼容、命名约定 |

## Agent 工作流

| 文档 | 用途 |
|------|------|
| [agent-workflow-constraints.md](./agent-workflow-constraints.md) | Agent 执行纪律：并行 subagent 优先、改码前 Read、范围确认、阶段性编译、测试门禁、E2E 禁假绿、双后端同步 |
| [local-multi-agent-orchestration.md](./local-multi-agent-orchestration.md) | 本地多 Agent 协作调度蓝图：任务真相源 + Git/PR 真相源 + 主/代理/子 agent 执行网络 |
| [ssot-task-graph.md](./ssot-task-graph.md) | 任务图 JSON 作为 SSOT 的 Schema、subsystem 取值、依赖驱动、与方案文档关系 |

## 部署

| 文档 | 用途 |
|------|------|
| [ssh-environments.md](./ssh-environments.md) | 服务器 SSH 连接指南、.env 凭据管理、危险操作确认、安全规范 |
| [windows-bootstrap.md](./windows-bootstrap.md) | Windows 开发环境一键初始化（Chocolatey + Java/Node/Go/Git + 编辑器） |

## 工具（MCP）

| 文档 | 用途 |
|------|------|
| [figma-mcp-guide.md](./figma-mcp-guide.md) | Figma MCP 双工具（figma-mcp-go + 官方）初始化 + 工作流 + 经验，Token 绑定 |
| [feishu-mcp-setup.md](./feishu-mcp-setup.md) | 飞书 MCP 接入：凭证获取、初始化、用户令牌、知识库目录映射 |
| [mcp-memory-setup.md](./mcp-memory-setup.md) | MCP Memory 本地部署（mcp-memory-service + SQLite 落盘）、多编辑器接入 |

## 事故复盘

| 文档 | 用途 |
|------|------|
| [incidents/incident-lessons-compiled.md](./incidents/incident-lessons-compiled.md) | 历史事故通用教训集（UI 假绿、误推保护分支、修复被冲掉、SQL 隔离） |
| [incidents/incident-postmortem-template.md](./incidents/incident-postmortem-template.md) | 事故复盘文档标准模板 |

---

## 与其他规范的关系

| 关联文档 | 关系 |
|---------|------|
| `docs/AGENT_RULES.md` | Agent 全部规则（§0–11），本文档库是技术经验补充 |
| `docs/TESTING_SPEC.md` | 全栈测试规范，E2E 类文档是其细化 |
| `docs/E2E_AGENT_GUIDE.md` | E2E 执行单一指南，dev/ 下 E2E 文档是其方法论支撑 |
| `docs/DUAL_BACKEND_PARITY.md` | 双后端契约对齐，多个 dev/ 文档引用 |
| `docs/LOWCODE_ENGINE_SPEC.md` | 低代码引擎规范，引擎/物料相关 dev/ 文档引用 |
| `.agents/rules/luban-*.md` | 规则文件（alwaysApply/globs），dev/ 文档是经验详述 |

## 迁移来源

本文档库从 kangdou-fullstack 的 `docs/` 与 `.claude/memory/` 迁移，逐个去业务化（去微信/云效/多租户/kddev/交易/圈子/联合套卡），保留技术/方法论内核。迁移日期：2026-06-14。
