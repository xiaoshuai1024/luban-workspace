# luban-workspace — 全栈编排入口
# 用法见 README.md 与 docs/GIT_WORKFLOW.md

BRANCH ?= main
PKG_DIRS := packages/engine/luban packages/bff/luban-bff packages/ui/luban-ui packages/web/luban-website \
            packages/backend/luban-backend packages/backend/luban-backend-go

.PHONY: clone-all pull-all push-all pr-all sync-submodules \
        test test-coverage lint dev dev-engine dev-bff dev-website \
        install-deps clean

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

# 各包测试（按技术栈）
test:
	@bash scripts/git/run-per-pkg.sh test

# 各包 lint
lint:
	@bash scripts/git/run-per-pkg.sh lint

# 各包装依赖（TS pnpm install / Java mvn / Go go mod download）
install-deps:
	@bash scripts/git/run-per-pkg.sh install

# 本地开发（引擎 + BFF + website，按需启动）
dev-engine:
	cd packages/engine/luban && pnpm run dev

dev-bff:
	cd packages/bff/luban-bff && pnpm run dev

dev-website:
	cd packages/web/luban-website && pnpm run dev

dev:
	@echo "Starting engine + bff + website..."
	@trap 'kill 0' INT TERM EXIT; \
	$(MAKE) dev-engine & \
	$(MAKE) dev-bff & \
	$(MAKE) dev-website & \
	wait

clean:
	@for d in $(PKG_DIRS); do [ -d "$$d" ] && rm -rf $$d/dist $$d/build $$d/target $$d/coverage 2>/dev/null; done; true
