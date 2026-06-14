# MySQL 慢查询配置（通用）

> MySQL 慢查询日志的配置方案：MySQL 服务端配置 + 应用层感知 + 日志解析 + 告警规则。
> 通用，适用 luban 后端（Java/Go）。

## 1. 简介

涵盖：
- MySQL 服务端 `my.cnf` 配置
- 应用层 slow query 感知（配置日志、阈值声明）
- 慢查询日志解析与持久化策略
- 告警规则

慢查询阈值建议 **500ms**（按业务 SLA 调整）。

## 2. MySQL 服务端配置（my.cnf）

```ini
[mysqld]
# 开启慢查询日志
slow_query_log = ON
# 慢查询日志文件路径（确保 MySQL 运行用户有写权限）
slow_query_log_file = /var/log/mysql/mysql-slow.log
# 慢查询阈值：超过 500ms 的 SQL 被记录
long_query_time = 0.5
# 记录未使用索引的查询
log_queries_not_using_indexes = ON
# 每分钟最多记录多少条未使用索引的查询（避免日志暴增）
log_throttle_queries_not_using_indexes = 60
# 记录慢管理语句（ALTER TABLE 等 DDL）
log_slow_admin_statements = ON
# 记录从库的慢查询
log_slow_slave_statements = ON
# 日志输出格式
log_output = FILE
```

### 配置文件位置

| 环境 | 推荐路径 | 备注 |
|------|---------|------|
| 开发联调 | 需联系 DBA | 共享库统一配置 |
| 生产 | `/etc/my.cnf` 或 `/etc/mysql/mysql.conf.d/mysqld.cnf` | 重启 MySQL 后生效 |

### 验证配置

```sql
SHOW VARIABLES LIKE 'slow_query%';
SHOW VARIABLES LIKE 'long_query_time';
SHOW VARIABLES LIKE 'log_queries_not_using_indexes';
```

### 运行时修改（无需重启）

```sql
SET GLOBAL slow_query_log = ON;
SET GLOBAL long_query_time = 0.5;
SET GLOBAL log_queries_not_using_indexes = ON;
SET GLOBAL log_throttle_queries_not_using_indexes = 60;
```

> 注意：`long_query_time` 的 `SET GLOBAL` 只对新连接生效，已有连接不受影响。可通过重连或 `SET SESSION` 立即生效。

## 3. 慢查询日志轮转

配合 Linux `logrotate` 配置 `/etc/logrotate.d/mysql`：

```
/var/log/mysql/mysql-slow.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 640 mysql mysql
    postrotate
        mysqladmin flush-logs -uroot -p[password] 2>/dev/null || true
    endscript
}
```

### 保留策略

| 环境 | 保留天数 |
|------|---------|
| 开发联调 | 3 天 |
| 生产 | 30 天 |

## 4. 分析工具

### pt-query-digest（推荐）

```bash
# 分析慢查询日志并按总耗时排序
pt-query-digest /var/log/mysql/mysql-slow.log

# 输出 JSON 格式
pt-query-digest --format json /var/log/mysql/mysql-slow.log > slow-query-report.json

# 只看最近 1 小时
pt-query-digest --since "1 hour ago" /var/log/mysql/mysql-slow.log
```

### mysqldumpslow（MySQL 自带）

```bash
mysqldumpslow -s t -t 10 /var/log/mysql/mysql-slow.log   # 按耗时 TOP 10
mysqldumpslow -s c -t 10 /var/log/mysql/mysql-slow.log   # 按执行次数 TOP 10
```

## 5. 应用层配置

### 设计决策

**MySQL 慢查询日志由 MySQL Server 侧配置和 pt-query-digest 分析，不在应用层通过 AOP/拦截器拦截 SQL。**

理由：
1. 应用层拦截器（MyBatis Interceptor / Go middleware）会带来额外性能开销（反射 + 字符串处理）
2. MySQL server 侧的慢查询日志更精准（含锁等待时间、扫描行数等真实执行信息）
3. `pt-query-digest` 的 SQL 指纹归一化能力远强于自研实现

### 慢查询阈值声明

在应用配置中声明阈值常量（供文档和团队参考）：

```yaml
app:
  datasource:
    slow-query-threshold-ms: 500
```

> 该配置仅为声明性配置，表示 MySQL `long_query_time` 目标值为 500ms。

## 6. 告警规则

| 规则 | 阈值 | 通知方式 | 说明 |
|------|------|---------|------|
| 单日新增慢查询超过阈值 | 10 条/天 | 团队通知 | 识别突发性能劣化 |
| 单条慢查询超过 5s | 1 次 | 紧急通知 | 严重影响用户体验 |
| 同一 SQL 指纹执行频率突增 | 较昨日增长 > 200% | 团队通知 | 识别新增全表扫描 |

## 7. 配置清单（部署检查项）

| # | 检查项 | 期望值 | 验证命令 |
|---|--------|-------|---------|
| 1 | slow_query_log | ON | `SHOW VARIABLES LIKE 'slow_query_log'` |
| 2 | long_query_time | 0.5 | `SHOW VARIABLES LIKE 'long_query_time'` |
| 3 | slow_query_log_file | 存在且可写 | `ls -la /var/log/mysql/mysql-slow.log` |
| 4 | log_queries_not_using_indexes | ON | `SHOW VARIABLES LIKE 'log_queries_not_using_indexes'` |
| 5 | logrotate 配置 | 测试通过 | `logrotate -d /etc/logrotate.d/mysql` |
| 6 | pt-query-digest | 版本正常 | `pt-query-digest --version` |
| 7 | 告警规则 | 已配置 | 告警平台确认 |

## 8. luban 双后端特化

- Java 和 Go 后端共用同一 MySQL（或各自独立），慢查询配置方案一致。
- 慢查询归因时，需区分是 Java 侧还是 Go 侧发起的查询（日志/连接标识区分）。
- 两端的 SQL 写法（索引使用、JOIN 条件）须保持一致优化水平，避免一端慢一端快。
