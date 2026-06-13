# Agent Kit Admin - Makefile
# 常用开发命令

.PHONY: dev dev-server dev-cli dev-web build test clean help

# 默认目标
help: ## 显示帮助信息
	@echo "Agent Kit Admin - 开发命令"
	@echo ""
	@echo "用法: make <command>"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ============================================
# 开发环境
# ============================================

dev: ## 启动所有服务
	docker compose -f deploy/docker/docker-compose.yml up -d db minio minio-init
	@echo "等待服务启动..."
	@sleep 3
	@echo "数据库和 MinIO 已就绪"

dev-server: ## 仅启动后端
	cd apps/server && uvicorn app.main:app --reload --port 8000

dev-cli: ## 仅启动 CLI (开发模式)
	cd apps/cli && pnpm dev

dev-web: ## 仅启动前端
	cd apps/web && pnpm dev

# ============================================
# 数据库
# ============================================

db-migrate: ## 运行数据库迁移
	cd apps/server && alembic upgrade head

db-revision: ## 创建新迁移
	cd apps/server && alembic revision --autogenerate -m "$(msg)"

db-reset: ## 重置数据库
	docker compose -f deploy/docker/docker-compose.yml down -v
	docker compose -f deploy/docker/docker-compose.yml up -d db
	@sleep 3
	$(MAKE) db-migrate

db-shell: ## 连接数据库
	docker compose -f deploy/docker/docker-compose.yml exec db psql -U agentkit -d agentkit

# ============================================
# 测试
# ============================================

test: ## 运行所有测试
	$(MAKE) test-server
	$(MAKE) test-cli
	$(MAKE) test-web

test-server: ## 后端测试
	cd apps/server && pytest -v

test-cli: ## CLI 测试
	cd apps/cli && pnpm test

test-web: ## 前端测试
	cd apps/web && pnpm test

# ============================================
# 构建
# ============================================

build: ## 构建所有
	$(MAKE) build-server
	$(MAKE) build-cli
	$(MAKE) build-web

build-server: ## 构建后端镜像
	docker build -t akit-server ./apps/server

build-cli: ## 构建 CLI
	cd apps/cli && pnpm build

build-web: ## 构建前端
	cd apps/web && pnpm build

# ============================================
# 代码质量
# ============================================

lint: ## 代码检查
	cd apps/server && ruff check .
	cd apps/cli && pnpm lint
	cd apps/web && pnpm lint

format: ## 代码格式化
	cd apps/server && ruff format .
	cd apps/cli && pnpm format 2>/dev/null || true
	cd apps/web && pnpm format 2>/dev/null || true

typecheck: ## 类型检查
	cd apps/server && mypy app
	cd apps/cli && pnpm typecheck
	cd apps/web && pnpm typecheck

# ============================================
# 清理
# ============================================

clean: ## 清理构建产物
	rm -rf apps/server/__pycache__ apps/server/.pytest_cache apps/server/dist
	rm -rf apps/cli/dist apps/cli/node_modules
	rm -rf apps/web/dist apps/web/node_modules

clean-all: clean ## 清理所有（包括 Docker）
	docker compose -f deploy/docker/docker-compose.yml down -v
	docker system prune -f

# ============================================
# 部署
# ============================================

deploy: ## 部署到生产
	@echo "TODO: 实现生产部署"

backup: ## 备份数据
	@echo "TODO: 实现数据备份"
