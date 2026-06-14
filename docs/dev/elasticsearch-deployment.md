# Elasticsearch 部署文档（通用）

> ELK（Elasticsearch + Logstash + Kibana）通用部署与运维经验。适用：任何需要 MySQL → ES 增量同步的场景。

## 1. 概述

基于 ELK 构建搜索平台：

- **Elasticsearch**：数据存储与搜索
- **Logstash**：JDBC 增量同步 MySQL → ES
- **Kibana**：数据可视化（调试/分析）

| 环境 | 部署方式 | 说明 |
|------|----------|------|
| 开发 | `docker-compose.yml` + setup 脚本 | ES 可无密码便于联调 |
| 生产 | Docker 栈 / 独立集群 | 开启 xpack 安全，密码管理 |

## 2. 索引设计

每个业务实体一个索引（或按需合并），Logstash JDBC 每 30s 增量同步。

| 索引名 | 来源表 | 同步方式 | 用途 |
|--------|--------|----------|------|
| `<entity>_v1` | 业务主表 | Logstash JDBC | 业务搜索 |

## 3. 索引 Mapping 关键点

### 3.1 ID 字段类型陷阱（重点）

MySQL 自增主键（BIGINT）若直接作为 ES `_id` 或 `id` 字段，ES 会推断为 `long`。但应用层（Spring Data ES / Go 结构体）往往用 `String` 类型接收，导致反序列化失败、搜索降级为空。

**通用修复**：Logstash SQL 中用 `CAST(id AS CHAR) AS id` 强制字符串。

### 3.2 时间戳字段类型陷阱

MySQL `update_time`（int 时间戳）直接映射为 ES `updated_at` 时存为 long，应用层 `LocalDateTime` 反序列化失败。

**通用修复**：`FROM_UNIXTIME(update_time) AS updated_at`，JDBC 追踪列用原始 `update_time`。

### 3.3 keyword vs text

- 需要精确匹配过滤的字段（状态、类型）：定义为 `keyword`，用 `term` 查询
- 需要全文搜索的字段：定义为 `text` + 分词器（中文用 ik_max_word/ik_smart）

注意 keyword 字段没有 `.keyword` 子字段，写查询时不要画蛇添足。

## 4. Logstash 同步配置

### 4.1 字段完整性（已知坑）

Logstash JDBC 通过 SQL 语句手动选取字段，**字段列表必须与应用层的 Document 结构完全一致**。

如果 SQL 漏选字段：
- ES 索引将缺失该字段
- 该字段的 term/range 查询会因字段不存在而失败
- 对应过滤条件无法生效

**新增字段或修改类型时**：
1. 修改 pipeline `.conf` 并提交仓库
2. 执行重建索引脚本（删除索引与模板 → 注册模板 → 清空 JDBC sincedb → 重启 Logstash）
3. 验证 `_source` 字段值类型正确

### 4.2 索引模板陷阱

当后端启动时（Spring Data ES），会根据 `@Field` 注解自动创建/更新索引模板。如果初次启动时字段类型推断错误，该模板会持续影响后续索引。**删除索引不删除模板**的话，重建时仍用旧模板。

修复方式：`DELETE /_index_template/{index_name}` 后，下次后端启动重新创建模板。

### 4.3 ES 认证

ES 8.x 开启 xpack 时，Logstash output 须配置 `user => logstash_internal` 与 `password => ${LOGSTASH_INTERNAL_PASSWORD}`。

## 5. ES 日常运维

```bash
# 查看索引状态
curl -s http://localhost:9200/_cat/indices?v

# 查看索引 mapping
curl -s http://localhost:9200/{index_name}/_mapping?pretty

# 查看集群健康
curl -s http://localhost:9200/_cluster/health?pretty

# 查看 Logstash 日志
docker logs logstash --tail 50
docker logs logstash 2>&1 | grep -iE "error|exception|warn"

# 查看 Logstash JDBC 追踪时间戳
docker exec logstash cat /usr/share/logstash/data/plugins/inputs/jdbc/logstash_jdbc_last_run
```

## 6. Kibana

地址：`http://{服务器IP}:5601`

首次使用需创建 Index Pattern（`Management → Stack Management → Kibana → Index Patterns`）。

## 7. 后端 ES 配置

```yaml
spring:
  elasticsearch:
    uris: ${ES_HOSTS:http://127.0.0.1:9200}
    username: ${ES_USERNAME:}
    password: ${ES_PASSWORD:}
```

索引由 Logstash / 索引模板创建，应用侧 `@Document(createIndex = false)`，启动时不调 `indices.create`。

| 变量 | 说明 |
|------|------|
| `ES_HOSTS` | ES 地址 |
| `ES_USERNAME` / `ES_PASSWORD` | 集群开启 xpack 时必填；须与 ELK `.env` 中密码一致 |

## 8. 故障速查

| 现象 | 常见原因 | 处理 |
|------|----------|------|
| 搜索全空 + 降级标志 | 后端 ES_PASSWORD 与 ELK 不一致 | 对齐密码，重启后端 |
| 搜索空 | ES 中 `id` 为 long 或 `updated_at` 为数字 | 更新 pipeline，重建索引 |
| 索引不存在 | Logstash 写 ES 401 | 检查 `LOGSTASH_INTERNAL_PASSWORD` |
| `/actuator/health` DOWN | 凭证错或 ES 未启动 | 修凭证 / 检查容器状态 |

## 9. luban 特化

- luban 搜索能力由 BFF 聚合后端（Java/Go）提供，ES 部署在后端侧。
- Java 与 Go 后端的 ES 查询逻辑须行为一致（查询条件、排序、分页）。
- 搜索降级策略两端一致：ES 不可用时，Java 和 Go 都应返回降级响应而非崩溃。
