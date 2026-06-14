# 分布式 ID 生成：Snowflake

> 通用：何时从 UUID 迁移到 Snowflake，以及位段结构与多环境部署。
> 适用：luban 后端（Java/Go）任何需要趋势递增、可排序、高并发无碰撞的主键/业务编号场景。

## 为什么从 UUID 改为 Snowflake

| 对比项 | UUID 随机截断 | Snowflake |
|--------|--------------|-----------|
| 长度 | `prefix_` + 16 hex = 字符串 | `BIGINT` 整数，8 字节 |
| 排序 | 完全随机，无法按 ID 排序 | 趋势递增，天然时间序 |
| 数据库索引 | UUID 随机插入导致页分裂 | BIGINT 顺序插入，索引高效 |
| 时序可读 | 不可读 | 可反解出生成时间 |
| 并发 | 无碰撞风险 | 不同 workerId 无碰撞 |

## 位段结构（64-bit）

```
 0 | 0000000000 0000000000 0000000000 0000000000 0 | 00000 | 00000 | 000000000000
 ↑                          ↑                          ↑       ↑           ↑
符号位(1bit)           时间戳(41bit)              数据中心(5bit) 机器(5bit) 序列号(12bit)
始终为0              自定义纪元起的毫秒数         各 5 bit          同毫秒内自增，最多 4096 个
```

- **符号位**：1 bit，始终为 0（正数）
- **时间戳**：41 bit，从自定义纪元到当前毫秒差，可用约 69 年
- **数据中心 ID**：5 bit，最多 32 个数据中心
- **工作节点 ID**：5 bit，每个数据中心最多 32 台机器
- **序列号**：12 bit，同一毫秒内同一节点自增，到 4095 后等待下一毫秒

## 部署方案

**workerId 分配**（多环境隔离，避免碰撞）：

```yaml
local:    datacenterId=0, workerId=0   # 本地开发
dev:      datacenterId=0, workerId=1   # 测试环境
prod-01:  datacenterId=1, workerId=1   # 生产实例 1
prod-02:  datacenterId=1, workerId=2   # 生产实例 2
```

## 前端注意事项（关键）

JavaScript 的 `Number.MAX_SAFE_INTEGER`（2^53）小于 Snowflake 最大值的 2^63，因此：

- API 返回 Snowflake ID 时**必须使用字符串类型**传输
- 前端展示和复制也基于字符串
- TypeScript 类型定义为 `string` 而非 `number`

## luban 双后端特化

- Java 和 Go 后端的 Snowflake 实现**位段结构必须一致**（纪元、位段划分）。
- 同一业务实体在两端生成的 ID 不能碰撞 → workerId 分配方案两端共享配置。
- ID 字段在 API 响应中统一用字符串，两端序列化方式一致。

详见 `docs/DUAL_BACKEND_PARITY.md`。
