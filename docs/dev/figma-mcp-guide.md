# Figma MCP 使用指南（初始化 + 工作流 + 经验）

> 通用：如何在 AI 辅助开发中用 Figma MCP 进行原型设计与 Token 绑定。合并自初始化、工作流、经验三篇。

## 一、工具角色分工

同时使用两个 Figma MCP server，各有侧重：

| 工具 | 类型 | 核心能力 | 适用场景 |
|------|------|---------|---------|
| **figma-mcp-go** | 本地 | 73 个读写工具、变量绑定、Token 管理、截图导出 | 绑定设计 Token、精细修改、导出 |
| **官方 Figma MCP** | 云端 | Code to Canvas、get_design_context、设计读取 | HTML 组件生成、读取设计→生成代码 |

### 为什么需要两个

- **figma-mcp-go**：不能导入 SVG 图标，创建渐变填充等复杂样式困难
- **官方 MCP**：Code to Canvas 可以将 HTML（含 SVG / CSS 渐变）变成 Figma 可编辑图层
- **互补**：官方 MCP 负责「生成高品质图层」，figma-mcp-go 负责「绑定 Token + 精细操控」

## 二、初始化

### 步骤 1：写入 MCP 配置

```bash
# 添加 figma-mcp-go（本地，73 个读写工具）
claude mcp add -s project figma-mcp-go -- npx -y @vkhanhqui/figma-mcp-go@latest

# 添加官方 Figma MCP（云端，Code to Canvas）
claude mcp add --transport http figma-official https://mcp.figma.com/mcp
```

`.claude/mcp.json` 应包含：

```json
{
  "mcpServers": {
    "figma-mcp-go": {
      "command": "npx",
      "args": ["-y", "@vkhanhqui/figma-mcp-go@latest"]
    },
    "figma-official": {
      "type": "http",
      "url": "https://mcp.figma.com/mcp"
    }
  }
}
```

修改配置后**退出并重启会话**才能生效。

### 步骤 2：安装 figma-mcp-go 插件（必做）

```bash
gh release download --repo vkhanhqui/figma-mcp-go v0.1.3 --pattern "*.zip" --dir ~/Desktop/figma-plugin
```

导入到 Figma 桌面版：**Plugins → Development → Import plugin from manifest...** → 选 `manifest.json`。

### 步骤 3：授权官方 MCP（首次）

1. Claude 提示浏览器链接，打开它
2. 在 Figma 授权页面点击允许
3. 浏览器跳转到 `http://localhost:.../callback?code=...`
4. 若显示连接错误，从地址栏复制完整 URL 粘贴给 Claude

### 步骤 4：验证

```bash
get_metadata()      # 验证 figma-mcp-go 连接
whoami()            # 验证官方 MCP 连接
```

## 三、标准工作流

```
┌─────────────────────────────────────────────────────────────┐
│  Phase 1: 设计生成（官方 MCP → Code to Canvas）            │
│  ① 根据需求写 HTML 组件（含 SVG 图标、CSS 渐变、阴影）     │
│  ② HTML 注入 capture.js 脚本                                │
│  ③ 启动本地 HTTP server 提供服务                            │
│  ④ 浏览器打开 → capture.js 捕获页面结构                    │
│  ⑤ Figma 收到可编辑图层（矢量、文字、渐变均保留）           │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 2: Token 绑定（figma-mcp-go）                        │
│  ⑥ 在 Figma 中打开新文件 → 运行 figma-mcp-go 插件          │
│  ⑦ get_design_context → 读取图层结构                       │
│  ⑧ create_variable_collection → 创建变量集合               │
│  ⑨ bind_variable_to_node → 绑定颜色/圆角/间距变量          │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 3: 精修 + 组件化（人工）                              │
│  ⑩ 设计师调整图层细节                                       │
│  ⑪ 选中组件 → Create Component → 转为可复用组件           │
│  ⑫ 组件加入组件库面板                                       │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│  Phase 4: 开发还原（官方 MCP get_design_context）            │
│  ⑬ 读取布局、样式、Token 绑定                              │
│  ⑭ get_screenshot → 视觉对照                               │
│  ⑮ 确认 Token 值一致                                       │
│  ⑯ 生成代码（结构 + Token 引用 + 交互）                    │
└─────────────────────────────────────────────────────────────┘
```

### Phase 1 详细：生成 HTML 组件规范

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=375, initial-scale=1.0">
<script src="https://mcp.figma.com/mcp/html-to-design/capture.js" async></script>
<!-- ↑ 必须加 capture.js 才能被 Code to Canvas 识别 -->
<style>
  /* 使用 Token 的实际值（非 var()，因为 Figma 不解析 CSS 变量） */
  .component { background: #00B341; }
</style>
</head>
```

- 宽度按目标端锁定（如移动端 375px，桌面端 1440px）
- CSS 值直接用 token 的值（非 `var()`）
- SVG 图标内联（Code to Canvas 会转成矢量图层）

### Phase 1 启动本地服务器

```bash
python3 -m http.server 8899 --bind 127.0.0.1
# 或
npx http-server . -p 8899
```

### Phase 2 变量创建顺序

```javascript
// 1. 创建集合
create_variable_collection("color", "默认")
create_variable_collection("radius", "默认")

// 2. 创建变量
create_variable("color", "color/primary", COLOR, "#00B341")
create_variable("radius", "radius/lg", FLOAT, 10)

// 3. 绑定到节点
bind_variable_to_node("1:3", cornerRadius, "radius/lg")
bind_variable_to_node("1:24", fillColor, "color/primary")
```

## 四、经验与已知限制

### 工具能力对比

| 维度 | figma-mcp-go | 官方 MCP |
|------|--------------|----------|
| 读次数限制 | 无限制 | 免费版每月 6 次 |
| SVG 图标 | ❌ 无法导入 | ✅ 保留矢量 |
| CSS 渐变 | 只能近似 | ✅ 完整保留 |
| 真实图片 | ❌ | ✅ `<img>` 导入 |
| 变量绑定 | ✅ | 渐变不可绑定 |
| 截图导出 | ✅ | 受读次数限制 |

### 已知限制

- **只能绑定纯色填充**：渐变填充的节点无法绑定 COLOR 变量。需先 `set_fills` 改为纯色再绑定。
- **变量文件隔离**：Figma 变量按文件隔离，跨文件需重新创建。
- **captureId 一次性**：每个 captureId 不可重复使用。
- **免费版读次数**：官方 MCP 免费版读工具仅 6 次/月，写工具（generate_figma_design）不限。建议批处理减少 get 调用。

### 实际效果评估

| 维度 | 还原度 |
|------|--------|
| 颜色（通过 Token 绑定） | 100% |
| 间距/圆角 | 100% |
| SVG 图标 | 100% |
| 真实图片 | 100% |
| CSS 渐变 | ~95%（无法绑定变量） |
| 布局结构 | ~90%（HTML Flex → Auto Layout） |
| 原型交互 | 0%（需手动） |

## 五、常见问题

| 问题 | 解决 |
|------|------|
| figma-mcp-go 卡在旧文件 | 在新文件中重新 Run 插件 |
| 官方 MCP 说读次数用完 | 免费版每月 6 次。写工具不限 |
| Code to Canvas 没反应 | 确认 HTML 注入了 `capture.js`，且用 HTTP 服务而非 file:// |
| 渐变填充无法绑定变量 | 先用 `set_fills` 改为纯色再绑定 |

## 六、luban 特化

- luban-ui 物料库是引擎渲染的基准，Figma 变量集合命名须与 luban 的 Design Token 体系（见 `docs/UI_SPEC.md`）一致。
- 多端一致：同一 token 在 web/electron/flutter 各端渲染值一致，Figma 变量是 SSOT 之一。
- 物料 props schema 与 Figma Component 的属性对应，便于从设计到代码的自动化还原。
