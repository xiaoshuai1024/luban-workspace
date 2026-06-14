# 服务器连接指南（SSH 环境）

> 当需要登录开发/生产服务器时，按本文件指引操作。通用模板，凭据通过 `.env` 文件管理。

## SSH 配置文件

| 环境 | 文件 | 说明 |
|------|------|------|
| **开发** | `.env.dev` | 开发/测试服务器，含 SSH、数据库、搜索引擎等连接信息 |
| **生产** | `.env.prod` | 生产服务器，需手动填写后使用 |

## 连接步骤

当需要登录开发服务器时：

```bash
# 1. 读取 .env.dev 获取连接信息
# 2. 用 sshpass 或 ssh 连接
sshpass -p "$DEV_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$DEV_SSH_USER@$DEV_SSH_HOST"
```

当需要登录生产服务器时：

```bash
set -a; source .env.prod; set +a
sshpass -p "$PROD_SSH_PASSWORD" ssh -o StrictHostKeyChecking=no "$PROD_SSH_USER@$PROD_SSH_HOST"
```

## 读取 .env 文件方式

```bash
# Source env file（仅读取不导入 shell）
set -a; source .env.dev; set +a
```

## 注意事项

- `.env.*` 已加入 `.gitignore`，不可提交
- 生产环境文件默认留空，需手动填写后再连接
- 数据库/搜索引擎等连接信息也在 `.env` 文件中，可直接 source 后用于连接
- **执行危险操作（删除、数据库迁移、强制部署）前必须先询问用户确认**
- 生产操作建议双人确认

## 安全规范

- 禁止将 `.env.prod` 内容粘贴到聊天/文档/提交信息中
- 密码/密钥变更后及时更新 `.env.prod`，并通知相关人
- SSH 连接建议配置跳板机，生产不开放公网直连
- 定期轮换服务器密码与服务账号凭证
