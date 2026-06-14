<!--
description: 阿里巴巴 Java 开发规范（通用精简版），基于《阿里巴巴 Java 开发手册》核心条款，适配多端双后端项目
globs: **/*.java
alwaysApply: false
-->

# 阿里巴巴 Java 开发规范（通用精简版）

基于《阿里巴巴 Java 开发手册》，按通用后端项目精简。全部条款见官方手册。

> 适用：luban 双后端中的 Java 侧（`packages/backend/luban-backend`）。Go 侧见相应 Go 规范。

## 一、命名规范

1. **类名**：UpperCamelCase，如 `OrderService`、`MaterialController`
2. **方法名**：lowerCamelCase，如 `findByOrderNo()`、`createMaterial()`
3. **常量**：UPPER_SNAKE_CASE，如 `MAX_RETRY_COUNT`
4. **抽象类**：以 `Abstract` 开头，如 `AbstractBaseService`
5. **异常类**：以 `Exception` 结尾，如 `OrderNotFoundException`
6. **测试类**：以 `Test` 结尾（单测）或 `IT` 结尾（集成测）
7. **POJO 类中的布尔类型**：禁止加 `is` 前缀，如 `deleted` 而非 `isDeleted`
8. **包名**：全小写，按组织域名反写 + 模块分层（如 `com.luban.backend.{module}`）

## 二、常量与枚举

1. **魔法值**：禁止直接使用，必须定义常量
2. **枚举**：枚举字段用英文，展示用枚举方法转中文（见「状态/枚举必须映射为中文显示」约定）
3. **long/Long 赋值**：大整数后加 `L`（大写），如 `100L`

## 三、代码格式

1. **缩进**：4 空格（禁止 Tab）
2. **大括号**：左大括号不换行（K&R 风格）
3. **单行字符限制**：不超过 120 字符
4. **方法参数**：不超过 4 个，超则封装为对象

## 四、OOP 规范

1. **避免通过一个对象的引用访问其静态变量/方法**：直接通过类名访问
2. **覆写方法**：必须加 `@Override`
3. **可变参数**：放在参数列表最后
4. **禁止使用过时 API**：`@Deprecated` 类/方法不得使用
5. **equals**：常量写在前面，如 `"OK".equals(status)` 而非 `status.equals("OK")`

## 五、集合处理

1. **ArrayList 初始化**：指定预估容量，`new ArrayList<>(initialSize)`
2. **`toArray`**：用带空数组参数的方法，`list.toArray(new String[0])`
3. **`subList`**：不可序列化，不可修改原 list（`subList` 视图操作会反映到原 list）
4. **`keySet`/`values`** 遍历时禁止增加/删除元素

## 六、并发处理

1. **线程安全**：`SimpleDateFormat` 禁止定义为 `static` 变量（非线程安全），用 `DateTimeFormatter`
2. **同步锁**：`synchronized` 锁定共享资源时，锁对象不可变更
3. **`CountDownLatch`**：需设置超时时间，防止死等
4. **`ThreadPoolExecutor`**：禁止用 `Executors` 创建，需手动指定核心参数（corePoolSize、maxPoolSize、keepAliveTime、workQueue、handler）

## 七、控制语句

1. **`switch`**：必须有 `default` 分支；每个 `case` 必须有 `break` 或 `return`
2. **`if/else`**：超过 3 层嵌套用卫语句、策略模式或状态模式重构
3. **三目运算符**：避免嵌套使用

## 八、异常处理

1. **`catch` 后必须处理**：打印日志或抛出自定义异常，禁止空 catch
2. **自定义异常**：继承 `RuntimeException`，命名以 `Exception` 结尾
3. **事务中异常**：`@Transactional` 方法中 `try-catch` 后需要 `TransactionAspectSupport.currentTransactionStatus().setRollbackOnly()` 手动回滚
4. **禁止捕获 `Throwable`/`Error`**
5. **`finally`** 中禁止 `return`（会覆盖 try 中的 return）

## 九、日志规范

1. **SLF4J**：使用 `LoggerFactory.getLogger(getClass())`，禁止直接 `System.out`
2. **占位符**：使用 `logger.info("orderNo={}, status={}", orderNo, status)`，禁止字符串拼接
3. **异常日志**：`logger.error("message", exception)` — 把 exception 作为最后一个参数传入

## 十、数据库与 SQL

1. **表名**：snake_case，如 `luban_material`、`order_item`
2. **字段名**：snake_case，如 `material_status`、`total_amount_fen`
3. **索引名**：`idx_{表名}_{字段名}`，唯一索引 `uk_{表名}_{字段名}`
4. **SQL 关键字大写**：`SELECT`、`FROM`、`WHERE`、`JOIN`
5. **禁止 `SELECT *`**：必须明确列出字段
6. **分页**：使用 LIMIT 分页，禁止 OFFSET 过大（>1000 时用游标分页）

## 十一、工程规范

1. **依赖**：禁止循环依赖（A→B→A）
2. **分层**：Controller → Service → Repository，禁止 Controller 直接调用 Repository
3. **`@Transactional`**：只加在 Service 层方法上，不跨层传播
4. **DTO/VO 分离**：Controller 层用 `*DTO`，内部传递用领域对象，DO 对应数据库表

## 十二、双后端契约对齐（luban 特有）

Java 侧的每个对外接口，Go 侧必须有行为一致的对应实现：

- 路由路径、HTTP method 一致
- 请求/响应字段名与类型一致
- 错误码与错误体格式一致
- 状态机转换一致

详见 `docs/DUAL_BACKEND_PARITY.md`。任一侧变更须两端同步或显式标注差异。
