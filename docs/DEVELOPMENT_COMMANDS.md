# Development Commands

> All commands verified against `Makefile`, `package.json`, and `pyproject.toml`.

## Infrastructure

```bash
make dev                    # Start PostgreSQL + MinIO via Docker Compose
docker compose -f deploy/docker/docker-compose.yml up -d db minio minio-init
```

## Server (Python/FastAPI)

```bash
# Development
cd apps/server && python -m uvicorn app.main:app --reload

# Lint & Format
cd apps/server && ruff check .                  # Lint
cd apps/server && ruff format --check .         # Format check
cd apps/server && ruff check --fix && ruff format  # Auto-fix all

# TypeCheck
cd apps/server && mypy app                      # Type checking (optional)

# Test
cd apps/server && pytest -v                     # Run tests
cd apps/server && pytest --cov=app              # With coverage

# Database
cd apps/server && alembic upgrade head          # Run migrations
cd apps/server && alembic revision --autogenerate -m "msg"  # New migration
make db-shell                                   # Connect to PostgreSQL
make db-reset                                   # Reset database

# Build
docker build -t akit-server ./apps/server       # Docker image
```

## CLI (TypeScript/Commander.js)

```bash
# Development
cd apps/cli && pnpm dev                         # Dev mode (tsx watch)
cd apps/cli && pnpm dev -- <command>            # Dev with args

# Lint & TypeCheck
cd apps/cli && pnpm lint                        # oxlint (--deny-warnings)
cd apps/cli && pnpm typecheck                   # tsc --noEmit

# Test
cd apps/cli && pnpm test                        # vitest run
cd apps/cli && pnpm test -- --watch             # vitest watch

# Build
cd apps/cli && pnpm build                       # tsc
cd apps/cli && pnpm build:watch                 # tsc --watch
```

## Web (React/Vite)

```bash
# Development
cd apps/web && pnpm dev                         # Vite dev server

# Lint & TypeCheck
cd apps/web && pnpm lint                        # oxlint (--deny-warnings)
cd apps/web && pnpm typecheck                   # tsc --noEmit

# Test
cd apps/web && pnpm test                        # vitest run
cd apps/web && pnpm test -- --watch             # vitest watch

# Build
cd apps/web && pnpm build                       # tsc + vite build
```

## Root Shortcuts

```bash
# Development
pnpm dev:server                                 # FastAPI server
pnpm dev:cli                                    # CLI dev mode
pnpm dev:web                                    # Web dev server

# Build
pnpm build:cli                                  # Build CLI
pnpm build:web                                  # Build Web
make build-server                               # Build server Docker image

# Lint & TypeCheck
pnpm lint                                       # Lint CLI + Web (oxlint)
pnpm typecheck                                  # TypeCheck CLI + Web

# Test
make test                                       # All tests
make lint                                       # All linters
make typecheck                                  # All typechecks

# Database
make db-migrate                                 # Run migrations
make db-revision                                # New migration
make db-reset                                   # Reset database
```

## Docker

```bash
# Build all images
docker compose -f deploy/docker/docker-compose.yml build

# Production
docker compose -f deploy/docker/docker-compose.yml up -d

# Logs
docker compose -f deploy/docker/docker-compose.yml logs -f server
```

## Pre-commit Checklist

```bash
# 1. Server
cd apps/server && ruff check --fix && ruff format

# 2. CLI + Web
pnpm lint && pnpm typecheck

# 3. All tests
make test
```
