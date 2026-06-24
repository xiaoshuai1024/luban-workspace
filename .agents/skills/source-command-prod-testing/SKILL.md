---
name: "source-command-prod-testing"
description: "生产快速验证 — API 冒烟 + website/引擎渲染页面冒烟"
---

# source-command-prod-testing

Use this skill when the user asks to run the migrated source command `prod-testing`.

## Command Template

# /prod-testing

执行生产环境快速验证。支持快速模式和完整模式。

> ⚠️ **生产域名/账号待定**：luban 暂无确定的生产部署。本命令中所有生产 URL、测试账号、密钥均为占位 TODO，待 luban 部署确定后替换。请在执行前向用户确认或填入实际值。

## 用法

```
/prod-testing [--mode=quick|full]
```

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--mode` | `quick` | `quick`=仅 API（~3min）, `full`=API+页面（~12min） |
| `--local` | — | 本地模式：指向本地后端 + 本地 website，使用本地账号 |
| `--no-cleanup` | — | 跳过测试数据清理 |

## 配置方式

脚本自动读取仓库根目录的 `.env.prod`（与后端 prod profile 共用）。需在该文件中添加：

```bash
# 生产验证配置（待 luban 部署确定后填入）
PROD_API_URL=https://TODO-luban-prod-api.example       # 后端 API 地址
PROD_WEBSITE_URL=https://TODO-luban-prod-web.example   # website 地址
PROD_VERIFY_KEY=<部署时设置的密钥>
PROD_PASSWORD=<运营/测试账号密码>
```

也可通过环境变量覆盖。

## 关于引擎渲染/website 页面测试

生产环境的 website（SSR）和引擎渲染产物须可访问。如需本地起 dev 指向生产 API：

```bash
cd packages/web/luban-website
PROD_API_BASE=https://TODO-luban-prod-api.example pnpm run dev &

# 运行 website E2E（指向本地 dev + 生产 API）
PROD_WEBSITE_URL=http://localhost:<port> \
  pnpm run test:e2e -- --config=<prod-config>
```

## 测试账号（待 luban 部署确定）

| 账号 | 密码 |
|------|------|
| TODO 测试账号 | TODO |

## 执行流程

```
Layer 1: API 冒烟（核心接口，按 luban 后端实际接口清单）
  ├─ Java 后端核心接口
  ├─ Go 后端核心接口（与 Java 同接口须一致）
  └─ BFF 聚合接口

Layer 2: website 页面（完整模式）
  ├─ 关键页面可达性
  └─ 引擎渲染物料一致性

Layer 3: 引擎渲染（完整模式）
  ├─ 物料渲染零 console error
  └─ 各端渲染一致
```

> **双后端提醒**：API 冒烟须同时覆盖 Java 与 Go 后端的同接口，验证响应体/错误码一致（见 `docs/DUAL_BACKEND_PARITY.md`）。

## 数据清理

验证脚本完成后默认**不自动清理**测试数据（避免误删生产库）。如需清理，按 luban 后端实际 DB 配置手动执行。

## 示例

```bash
# 快速验证（仅 API）
bash scripts/verify-production.sh --mode=quick

# 完整验证（API + 页面）
PROD_PASSWORD=xxx PROD_VERIFY_KEY=xxx bash scripts/verify-production.sh --mode=full

# 本地开发验证
bash scripts/verify-production.sh --local --mode=quick

# 跳过清理
bash scripts/verify-production.sh --mode=quick --no-cleanup
```

> ⚠️ `scripts/verify-production.sh` 及 `.env.prod` 中的生产配置均为占位，待 luban 部署确定后补全。
