# Windows 开发环境一键初始化指南

> 通用模板：如何用 PowerShell 脚本一键安装 Windows 开发环境。luban 项目可参考此模板实现自己的 `bootstrap-windows.ps1`。

## 适用范围

- Windows 10 / Windows 11
- 需要安装：Java、Node.js LTS、Go、Git、以及团队约定的编辑器（Cursor/VS Code）
- 适用于 luban 各子项目的本地开发环境准备

## 总入口

在仓库根目录执行：

```powershell
.\bootstrap-windows.ps1
```

如不想安装完成后自动打开编辑器：

```powershell
.\bootstrap-windows.ps1 -NoAutoStart
```

## 执行内容（参考）

脚本按顺序完成：

1. 检查当前仓库路径与子模块是否初始化
2. 安装 Chocolatey（如果未安装）
3. 安装 Java（Temurin）
4. 安装 Node.js LTS
5. 安装 Go（luban 有 Go 后端）
6. 安装 Git
7. 安装编辑器（Cursor / VS Code）
8. 生成编辑器基础配置
9. 默认打开编辑器并定位到当前仓库

## 前置条件

- 需要管理员权限或允许安装软件的终端权限
- 机器需要可访问外网
- 如果仓库使用子模块，建议先确保子模块已初始化

## 安装后验证

```powershell
java -version
node -v
go version
git --version
```

同时检查：
- 编辑器已安装
- 编辑器已打开并定位到仓库目录
- 编辑器配置文件已生成

## 常见问题

### 1. 提示找不到子模块目录
说明子模块可能还没有初始化，请先完成子模块拉取，再执行安装脚本。

### 2. Chocolatey 安装失败
通常是网络、代理或权限问题：
- 终端是否有管理员权限
- 外网是否可访问 `https://community.chocolatey.org`
- 公司网络是否拦截下载地址

### 3. 安装完成后命令不可用
某些软件安装后可能需要重新打开终端，才能在 PATH 中识别到新命令。

### 4. 已安装部分组件
总入口会自动跳过已安装项，可重复运行。

## 推荐使用方式

- 首次配置新 Windows 电脑：直接运行 `bootstrap-windows.ps1`
- 已安装过部分组件：仍可运行，自动跳过

## 脚本组织建议

- 总入口：`bootstrap-windows.ps1`（仓库根）
- 内部安装逻辑：`scripts/windows/install-dev-env.ps1`
- 编辑器初始化：`scripts/init-editor.ps1`

保留 `bootstrap-windows.ps1` 作为唯一入口，便于新成员一键上手。后续要支持更多环境项，在内部脚本扩展即可。
