# 开发环境 MySQL 配置（Docker Compose）

> 通用：开发环境 MySQL 的标准化配置。**禁止在开发机安装非 Docker 管理的 MySQL**（避免版本与线上不一致）。
> 适用：luban 后端（Java/Go）开发联调。

## 一、启动

```bash
# 部署 MySQL（版本与生产一致）
docker compose -f docker-compose.mysql.yml up -d

# 验证
mysql -h <host> -P 3306 -u root -p<pwd> -e "SELECT VERSION()"
```

## 二、停止 & 重置

```bash
# 停止（保留数据）
docker compose -f docker-compose.mysql.yml down

# 完全重置（删数据卷）
docker compose -f docker-compose.mysql.yml down -v
docker compose -f docker-compose.mysql.yml up -d
```

## 三、首次部署后播种数据

Docker MySQL 启动后是空库，需要后端建表 + 手动播种种子数据。

### 3.1 启动后端（自动跑迁移）

```bash
cd <backend>
# Java 侧
mvn spring-boot:run -Dspring-boot.run.profiles=local

# 或 Go 侧（按项目迁移机制）
go run ./cmd/...
```

> 迁移工具配置 `baseline-on-migrate=false`，让迁移从第一个版本完整执行。

### 3.2 播种管理员 + 权限

```sql
-- 管理员账号（密码哈希按项目加密规则生成）
INSERT IGNORE INTO sys_user (id, username, password_hash, display_name, is_super, status)
VALUES ('u_admin_001','admin','<bcrypt-hash>','Administrator',1,1);

-- 权限点
INSERT IGNORE INTO sys_permission (perm_key, perm_name) VALUES
('perm:sample','示例权限');
```

### 3.3 修复 schema 兼容问题（按需）

零日期兼容：JDBC 连接串加 `&zeroDateTimeBehavior=convertToNull`，无需改 DB。

## 四、验证

```bash
# 登录验证
curl -s http://127.0.0.1:8080/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"<pwd>"}' | python3 -m json.tool
```

## 五、FAQ

**Q: 为什么必须用 Docker Compose 管理？**
A: 保证环境一致，避免本地安装的 MySQL 版本与线上行为差异。

**Q: 数据会丢失吗？**
A: 持久化卷目录，`docker compose down` 不会丢数据。只有 `down -v` 会清空。

**Q: 如何备份？**
A: `docker exec <mysql-container> mysqldump -uroot -p<pwd> <dbname> > backup.sql`

## 六、luban 双后端特化

- Java 和 Go 后端共用同一开发 MySQL 实例（联调方便）。
- 迁移脚本：Java 侧用 Flyway（或其他），Go 侧用对应迁移工具，**两端迁移版本与 schema 必须一致**。
- 种子数据脚本两端共享，避免重复维护。
- 字段命名两端一致（snake_case）。
