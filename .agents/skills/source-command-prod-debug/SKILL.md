---
name: "source-command-prod-debug"
description: "调试生产环境：后端以 prod profile 启动并修复问题，前端/BFF 域名切换为生产地址，重启全部服务"
---

# source-command-prod-debug

Use this skill when the user asks to run the migrated source command `prod-debug`.

## Command Template

## 含义

**`/prod-debug`**：将本地开发环境切换为生产调试模式。

1. **后端（Java/Go 双后端）**：以 `prod` profile 启动（连接生产 DB/Redis），诊断并修复启动问题
2. **BFF / 引擎渲染 / website**：API base 切换为生产地址
3. **重启全部服务**：杀死旧进程，按序拉起并验证健康

> ⚠️ **生产域名待定**：luban 暂无确定的生产域名。本命令中所有 `https://TODO-luban-prod-api.example` 均为占位，待 luban 部署确定后替换为真实生产 API 地址。请在执行前向用户确认或填入实际值。

## Agent 执行步骤

### Step 1 — 停止所有服务

```bash
# 停 Java 后端
make kill-backend-java 2>/dev/null
# 停 Go 后端
make kill-backend-go 2>/dev/null
# 停 BFF
kill $(lsof -t -i:<BFF端口>) 2>/dev/null
# 停 website SSR dev server
kill $(lsof -t -i:<website端口>) 2>/dev/null
# 确保端口释放
sleep 2
```

### Step 2 — 切换 BFF/引擎/website API 域名为生产地址

修改各 TS 包的环境变量 / 配置文件（按各包 `.env.prod` 或 `config` 约定），将 API base 切换为：

```
# TODO：待 luban 部署确定
PROD_API_BASE=https://TODO-luban-prod-api.example
```

> **注意**：若文件当前已是生产地址，不做重复修改。恢复本地开发地址需手动改回本地值。

### Step 3 — 以 prod profile 启动后端（Java + Go）

```bash
# Java 后端
cd packages/backend/luban-backend && make prod
# Go 后端（按包内 prod 启动方式）
cd packages/backend/luban-backend-go && <go-prod-cmd>
```

**启动后必须**：
- 等待各后端健康检查端点返回 `200`（最长 120 秒）
- 实时观察启动日志，诊断以下常见问题：
  - **DB 连接失败**：检查各后端 `prod` profile 的 DB 连接配置（Java/Go 独立配置，见各包 `application-prod.yml` / `config.prod.*`）
  - **Redis 连接失败**：检查 `REDIS_HOST`、`REDIS_PASSWORD`
  - **Flyway 迁移冲突**（Java）：`out-of-order: false`（生产），检查 `flyway_schema_history` 本地版本是否与生产不一致
  - **端口被占用**：`lsof -i:<端口>` 排查旧进程

修复后重新执行 Step 3 直至健康检查通过。

### Step 4 — 重启 BFF（指向生产 API）

```bash
cd packages/bff/luban-bff
PROD_API_BASE=https://TODO-luban-prod-api.example pnpm run dev
```

> BFF 将请求转发至生产后端。

### Step 5 — 重启 website / 引擎渲染（按需）

```bash
cd packages/web/luban-website
PROD_API_BASE=https://TODO-luban-prod-api.example pnpm run dev

# 引擎渲染 dev（若需）
cd packages/engine/luban
PROD_API_BASE=https://TODO-luban-prod-api.example pnpm run dev
```

### Step 6 — 最终验证

```bash
# 各后端健康
curl -s -o /dev/null -w "%{http_code}" http://localhost:<java-port>/actuator/health
curl -s -o /dev/null -w "%{http_code}" http://localhost:<go-port>/health
# BFF 可访问
curl -s -o /dev/null -w "%{http_code}" http://localhost:<bff-port>/
# website 可访问
curl -s -o /dev/null -w "%{http_code}" http://localhost:<website-port>/
```

全部返回 `200` 即可开始生产调试。

## 恢复本地开发

调试结束后，需要恢复本地开发环境：

1. 将各 TS 包的 API base 改回本地值
2. 重启各服务（不加 `PROD_API_BASE` 等生产环境变量）

---

**策略**：本命令不修改任何业务代码、不创建数据库迁移、不触发 CI/CD。所有生产域名/端口在 luban 部署确定前为占位 TODO。
