# luban-workspace — 全栈编排入口
# 用法见 README.md 与 docs/SYSTEM_ARCHITECTURE.md（服务拓扑 SSOT）
#
# 端口约定（本机 dev 裸进程，互不冲突；中间件在远端 dev 服务器）：
#   engine    :5173   (vite; /api → proxy → bff:3100)
#   bff       :3100   (next dev -p 3100; 显式 3100 避免与 website 3000 冲突)
#   website   :3000   (nuxt dev; bffBaseUrl env 修正为 3100)
#   Java      :8080   (mvn spring-boot:run; ctx /backend)
#   Go        :8081   (可选; 双后端契约测试)
#   MySQL     :13306  (远端 192.168.100.248)
#   Redis     :16379  (远端 192.168.100.248)
# 本机禁起 docker / 中间件。

BRANCH ?= main
PKG_DIRS := packages/engine/luban packages/bff/luban-bff packages/ui/luban-ui packages/web/luban-website \
            packages/backend/luban-backend

.PHONY: clone-all pull-all push-all pr-all sync-submodules \
        test test-coverage journey-coverage lint \
        dev-engine dev-bff dev-website dev-java dev-apps dev-check \
        install-deps clean \
        e2e-up e2e-down e2e e2e-cross e2e-install e2e-report

# --- E2E 服务编排 + 跨项目流程性 E2E ---
COMPOSE_E2E := docker-compose.e2e.yml

# 起 E2E 服务编排（MySQL/Redis/后端/bff/engine/website）
e2e-up:
	@bash scripts/e2e/up-all.sh

# 停 E2E 服务编排
e2e-down:
	@bash scripts/e2e/down-all.sh

# 安装 Playwright 浏览器（首次）
e2e-install:
	cd e2e && pnpm install && pnpm run install:e2e

# 跑全部跨项目流程（需先 e2e-up）
e2e:
	cd e2e && pnpm test

# 跑跨项目黄金流程（发布/线索/双后端一致性）
e2e-cross:
	cd e2e && pnpm test:cross

e2e-report:
	cd e2e && pnpm report


# 首次：初始化所有 submodule
clone-all:
	@git submodule update --init --recursive

# 同步 submodule 指针到各仓远端最新
sync-submodules:
	@git submodule update --remote --merge

# 各 submodule 同步默认分支（主仓 + 子仓 fetch+merge，不换分支）
pull-all:
	@bash scripts/git/pull-all.sh "$(BRANCH)"

# 各 submodule commit + push 当前分支（不建 PR）
push-all:
	@bash scripts/git/push-all.sh

# 各 submodule + meta 仓 gh pr create
pr-all:
	@bash scripts/git/pr-all.sh "$(BRANCH)"

# 一键全栈覆盖率门禁（汇总表 + HTML 报告）
test-coverage:
	@bash scripts/coverage/coverage-summary.sh

# 旅程覆盖率门禁（E2E 链路维度：聚合 journeys SSOT + 扫 @J-xxx 标签；P0 阻断）
journey-coverage:
	@bash scripts/coverage/journey-coverage.sh

# 校验单个 taskGraph JSON schema（含 journeys 字段）
verify-plan:
	@node scripts/verify-plan-ssot.mjs validate $(JSON)

# 各包测试（按技术栈）
test:
	@bash scripts/git/run-per-pkg.sh test

# 各包 lint
lint:
	@bash scripts/git/run-per-pkg.sh lint

# 各包装依赖（TS pnpm install / Java mvn / Go go mod download）
install-deps:
	@bash scripts/git/run-per-pkg.sh install

# ============================================================
# 本地开发启动（单服务 / 全栈）—— 见 docs/SYSTEM_ARCHITECTURE.md
# 端口：engine 5173 / bff 3100 / website 3000 / Java 8080 / Go 8081
# 中间件 MySQL 13306 / Redis 16379 在远端 192.168.100.248
# ============================================================

# --- 单服务启动 ---

# Java 后端（Spring Boot；start-mvn.bat 内置远端中间件 env + Flyway 自动迁移）
# 启动慢（~30-60s），健康检查：http://localhost:8080/backend/actuator/health
dev-java:
	cd packages/backend/luban-backend && cmd //c start-mvn.bat

# BFF（Next.js；显式 -p 3100，避免与 website 默认 3000 冲突）
dev-bff:
	cd packages/bff/luban-bff && pnpm exec next dev -p 3100

# engine（Vue SPA；vite 默认 5173；/api proxy 已指向 bff:3100）
dev-engine:
	cd packages/engine/luban && pnpm run dev

# website（Nuxt SSR；nuxt 默认 3000；env 修正 bffBaseUrl 默认值错误→3100）
dev-website:
	cd packages/web/luban-website && NUXT_PUBLIC_BFF_BASE_URL=http://127.0.0.1:3100 pnpm exec nuxt dev

# --- 全栈一键启动 ---

# 并行起 4 个核心应用（Java + BFF + engine + website），trap 统一清理
# 依赖顺序：Java → BFF → engine/website（本 target 并行起，Java 自带健康自检）
dev-apps:
	@echo "Starting Java + BFF + engine + website (parallel)..."
	@echo "  middleware: MySQL 192.168.100.248:13306 / Redis :16379 (remote)"
	@echo "  Java boots ~30-60s (Flyway); wait for http://localhost:8080/backend/actuator/health"
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) dev-java & \
	$(MAKE) dev-bff & \
	$(MAKE) dev-engine & \
	$(MAKE) dev-website & \
	wait

# --- 健康检查（探测 4 个应用端口；200/302/404 = OK，DOWN/ECONN = 未起）---
dev-check:
	@echo "Probing services..."
	@for svc in "Java:8080/backend/actuator/health" "BFF:3100" "engine:5173" "website:3000"; do \
		name=$${svc%%:*}; rest=$${svc#*:}; port=$${rest%%/*}; path=$${rest#*:}; \
		code=$$(curl -s -o /dev/null -w "%{http_code}" http://localhost:$$port/$$path 2>/dev/null || echo DOWN); \
		printf "  %-10s :%-5s %s\n" "$$name" "$$port" "$$code"; \
	done

clean:
	@for d in $(PKG_DIRS); do [ -d "$$d" ] && rm -rf $$d/dist $$d/build $$d/target $$d/coverage 2>/dev/null; done; true
