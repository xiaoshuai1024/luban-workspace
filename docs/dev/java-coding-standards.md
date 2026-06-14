# Java 后端编码标准

## 规范基线

- Java 编码规范以《阿里巴巴 Java 开发手册》为主。
- 项目内的后端开发在命名、异常处理、日志、安全、数据库访问等方面，默认遵循该手册。
- 详见 `docs/dev/alibaba-java-development-manual.md`（精简版条款）。

## 官方引用

- 阿里巴巴 P3C 仓库（含规则与发布说明）：<https://github.com/alibaba/p3c>
- 开发手册发布页（含 PDF 附件）：<https://github.com/alibaba/p3c/releases>

## 约束范围（落地执行）

- 代码提交前必须通过 `mvn -q verify`（单测 + 集成测 + 覆盖率门禁）。
- Java 代码中的异常处理、日志打印、SQL 访问、并发与集合使用等，按阿里手册进行 Code Review。
- 若手册条款与框架实现冲突，优先保证安全、可维护与可测试，并在 PR 中说明原因。

## luban 双后端对齐约束

- Java 侧的对外接口契约，Go 侧必须有行为一致实现（见 `docs/DUAL_BACKEND_PARITY.md`）。
- 覆盖率目标：Java 后端行覆盖 ≥ 80%（luban 差异化目标，见 `AGENTS.md`）。
- 改 Java 接口时，同步检查 Go 侧是否需要对应修改。
