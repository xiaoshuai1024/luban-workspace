---
description: 禁止在本地/用户电脑启动 docker 服务及 docker compose；docker 仅运行于远端开发环境
globs:
alwaysApply: true
---

# luban-no-local-docker

**🔴 硬约束：docker 服务运行在远端开发环境，严禁在用户本地电脑启动。**

## 禁止行为
- ❌ 在本地执行 `docker compose up` / `docker run` / `docker start`
- ❌ 在本地执行 `Start-Process Docker Desktop` 或任何拉起 Docker Desktop 的命令
- ❌ 假设本地有 docker engine 可用并据此编排步骤

## 正确做法
- 需要容器化验证（6 容器 / /ai/chat 完整链路 / minio / postgres / milvus / langfuse）时：
  - 询问用户在远端开发环境执行，或由用户提供远端执行结果；
  - 不依赖容器的验证（单元测试、pytest、provider 直调 smoke）可在本地跑。

## 触发场景
- 联调、E2E、冒烟、健康检查涉及 docker compose 时；
- 看到 docker engine 未就绪 / pipe 找不到时，**不要**尝试启动 Docker Desktop。
