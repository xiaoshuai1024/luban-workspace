# 飞书 MCP 初始化指引（通用）

> 通用：如何在 AI 辅助开发中接入飞书 MCP，用于文档同步、知识库管理。
> 业务无关；luban 项目可参考此模板接入飞书作为团队协作/文档同步工具。

## 1. 创建飞书应用并获取凭证

1. 打开飞书开放平台：[https://open.feishu.cn/app](https://open.feishu.cn/app)
2. 点击「创建企业自建应用」。
3. 进入应用详情页，找到：
   - `App ID`（也叫 `cli_xxx`）
   - `App Secret`
4. 将这两个值填入对应 `.env`：

```env
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxxx
```

## 2. App ID 是否必须？

是，必须。

- MCP 启动鉴权依赖 `FEISHU_APP_ID + FEISHU_APP_SECRET` 成对使用。
- 只有 `Secret` 没有 `App ID` 无法完成应用身份校验。

## 3. 初始化和启动

```bash
# 初始化模板
bash scripts/feishu/init-feishu-mcp.sh

# 填写 .env 后启动
bash scripts/feishu/start-feishu-mcp.sh
```

## 4. 常见问题

- **报错：missing FEISHU_APP_ID or FEISHU_APP_SECRET**
  - 检查 `.env` 是否存在且变量不为空。
  - 检查是否有额外空格或引号导致解析失败。
- **变量填写后仍失败**
  - 重新打开终端或重新执行脚本，确保加载了最新 `.env`。

## 5. 用户令牌与高级 API

调用 Docx OpenAPI（如表格列宽 `batch_update`）时需要 **user_access_token**，否则可能出现 403。脚本通常自动按顺序尝试：

1. 环境变量 `FEISHU_USER_ACCESS_TOKEN`（若已手动配置）；
2. 本机 MCP OAuth 缓存文件；
3. 用缓存里的 refresh_token 刷新；
4. 最后才使用 tenant_access_token（在部分租户上对 wiki 正文 patch 会失败）。

因此：**先启动 MCP 并完成一次用户授权登录**，再跑文档同步脚本，通常不必单独配置 `FEISHU_USER_ACCESS_TOKEN`。

## 6. 知识库目录映射

文档同步命令（如 `/feishu-doc`）会把本地 Markdown 传到指定知识库子目录。

请复制 `wiki-dir-mappings.example.json` 为 `wiki-dir-mappings.json`（已加入 `.gitignore`），填写各目录的 `parent_node_token` 与 `aliases`。

**单页 wiki 空间**：列表里大量节点是「一页一篇」的云文档时，创建新文档仍需要**父 wiki 节点** `parent_node_token`。请在飞书内确认可挂子节点的父级，把该父节点的 `node_id` 写入映射，勿与已有文档的 `obj_token` 混淆。

### 用接口列出知识库节点（获取 parent_node_token）

```bash
# 列出默认 wiki 空间根下子节点
bash scripts/feishu/wiki-list-nodes.sh

# 列出某父文件夹下子节点
bash scripts/feishu/wiki-list-nodes.sh --parent <父节点 node_token>

# 按关键词搜索 wiki 节点
bash scripts/feishu/wiki-list-nodes.sh --search <关键词>
```

将输出 JSON 中作为父挂载点的 `node_id` 填入映射文件。

## 安全规范

- 禁止将飞书凭证粘贴到聊天/文档/提交信息
- 凭证变更后及时更新 `.env`，并通知相关人
- 企业空间上传文档前必须询问用户确认（空间选择 + 目录）
