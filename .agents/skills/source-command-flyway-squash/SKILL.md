---
name: "source-command-flyway-squash"
description: "Java 后端 Flyway 迁移文件整理（squash）：评估可行性、在本地开发库执行 squash，或在共享库上安全操作；生产环境仅输出指导"
---

# source-command-flyway-squash

Use this skill when the user asks to run the migrated source command `flyway-squash`.

## Command Template

# Flyway Squash

> 仅适用于 **Java 后端**（`packages/backend/luban-backend`）。Go 后端无 Flyway。

## 快速判断

| 环境 | 可自动 squash？ | 方案 |
|------|:---:|------|
| **本地开发库** (Docker/local MySQL) | ✅ | 脚本自动 squash + reset |
| **共享开发库** (多人共用) | ⚠️ | 逐个环境手工操作脚本 |
| **预发布/生产** | ❌ | 见下文「生产环境」说明 |

---

## 一、可行性说明

### 为什么不能在全环境自动 squash

1. **`flyway_schema_history` 按数据库实例维护** — 各环境各有不同历史记录；无法原子化重置
2. **生产 `out-of-order: false`** — strict ordering，无法跳过已执行版本
3. **Repair 脚本是管理类修复**，**不代表 schema 状态**，不应收入 baseline
4. **活跃开发中** — 各 `feature/*` 分支持续新增 migration，squash 后新分支的版本号体系需要重新对齐
5. **Checksum 绑定** — Flyway 对每个已执行文件校验 checksum；新文件必定 checksum 不同，`flyway repair` 可覆盖但须逐环境手动

### 可行的方案

| 方案 | 风险 | 适用范围 |
|------|------|----------|
| **A: 本地库自动化 squash** | 低 | 个人本地开发库（可 DROP DATABASE） |
| **B: 共享库手工 squash** | 中 | 多人共用 dev 库 |
| **C: 新环境 baseline 文档** | 无 | CI/新成员从零搭建 |

---

## 二、本地开发库 Squash（推荐，有脚本）

```bash
# 以下命令在仓库根目录执行

# 第 1 步：确认当前状态
git status                          # 确保无未提交改动
ls packages/backend/luban-backend/src/main/resources/db/migration/V*.sql | tail -5   # 记下最新版本号（秒级时间戳）

# 第 2 步：归档旧 migration 文件
MIG=packages/backend/luban-backend/src/main/resources/db/migration
mkdir -p "${MIG}/archived"
mv "${MIG}"/V*__*.sql "${MIG}/archived/"
# （保留 archived/ 目录用于 git 追溯，不在 CI 加载路径中即可）

# 第 3 步：合并所有 DDL 为新 baseline（按版本升序）
# 需要确认：排除 repair/rollback 脚本
cd "${MIG}"
for f in $(ls archived/V*__*.sql | sort -t'V' -k2 -n); do
  echo "-- ========================================"
  echo "-- $(basename $f)"
  echo "-- ========================================"
  cat "$f"
  echo ""
done > V1__squashed_baseline.sql
cd -

# 第 4 步：重置本地数据库（库名按 Java 后端实际配置）
# ⚠️ 这将清空本地数据库全部数据！
mysql -u root -p -e "DROP DATABASE IF EXISTS luban_backend; CREATE DATABASE luban_backend;"

# 第 5 步：启动后端，让 Flyway 应用 V1（新建所有表）
cd packages/backend/luban-backend && mvn spring-boot:run
# 观察日志确认 flyway 成功应用 V1
```

**自动脚本**（执行上述流程）：`bash scripts/flyway-squash-local.sh`

> 注意：需要本地 MySQL root 权限；如果 MySQL 认证方式不同，可手工执行第 4 步的 DROP DATABASE。

---

## 三、共享开发库手工操作

**不能 DROP DATABASE**，需要更精细的步骤：

1. **归档 migration 文件**（同 §2 第 2 步）
2. **创建 consolidated baseline**（同 §2 第 3 步）
3. **`flyway repair`** 刷新 checksum：
   ```bash
   cd packages/backend/luban-backend
   mvn flyway:repair -Dflyway.url=jdbc:mysql://<host>:3306/luban_backend -Dflyway.user=<user> -Dflyway.password=<pass>
   ```
4. **验证**：启动后端确认无迁移错误

---

## 四、生产环境

**生产环境禁止自动 squash。** 推荐做法：

1. **什么都不做** — N 个 migration 对 Spring Boot 项目属于正常范围，Flyway 的启动开销在 ms 级别
2. **如确实需要整理**：联系 DBA，申请**生产维护窗口**，在维护窗口内执行 §3 手工步骤，执行后验证关键链路

---

## 五、替代方案（推荐优先考虑）

如果动机是「版本号管理混乱」，而非「文件太多」：

- **已有** 秒级时间戳版本号 `V{YYYYMMDDHHmmss}__desc.sql` → 新 migration 时间戳天然唯一，不会撞号
- **建议只有在以下情况才 squash**：本地库频繁出现 migration 冲突影响开发效率 / 需要给新成员提供「干净的起点」 / 团队决定重置版本号体系

---

## 六、完整操作手册

详见 `docs/dev/luban-flyway-squash-and-reset.md`（整理与重置全流程说明，含本地库自动、共享库手工、生产操作、整理后版本号体系）。
