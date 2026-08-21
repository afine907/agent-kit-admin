# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Kit Admin is a private Package Registry for AI Agent ecosystems. It manages Agent Skills for teams using Claude Code, Codex, and other AI agents. Think "npm registry" but for AI agent capabilities.

**Core flow:** `akit publish` (upload package) -> Registry stores in PostgreSQL + MinIO -> `akit install` (download + record)

## Architecture

Three components, one deployment:

| Component | Stack | Directory | Purpose |
|---|---|---|---|
| **server** | Python 3.11+ / FastAPI / SQLAlchemy 2.0 (async) | `apps/server/` | REST API + package registry logic (single FastAPI app) |
| **cli** | Node.js 20+ / TypeScript / Commander.js | `apps/cli/` | `akit` CLI - publish, install, manage packages |
| **web** | React 18 / Vite 5 / shadcn/ui / TypeScript | `apps/web/` | SPA admin dashboard |

Infrastructure: PostgreSQL 16 (metadata) + MinIO (package tarballs) + Caddy (gateway/TLS) - all via Docker Compose.

## System Overview

See `docs/ARCHITECTURE.md` for the full system architecture diagram, component responsibilities, data flow, and key design decisions.

## Backend Layering Convention

Follow this pattern for all API endpoints:

`
API Layer (api/)      -> thin: parse params, call service, return response
Service Layer (services/) -> business logic, transactions, permission checks
Layer (models/)  -> SQLAlchemy ORM, database queries
`

Use FastAPI `Depends()` for dependency injection (auth, db session, service instances). Errors use a unified `AppError(code, message, status_code)` mapped to error codes.

### Server Structure

- `app/api/` - API route handlers (thin layer)
- `app/services/` - Business logic layer
- `app/models/` - SQLAlchemy ORM models
- `app/schemas/` - Pydantic request/response schemas
- `app/inspect/` - Package health inspection system
- `app/worker.py` - Background worker for health checks

### Key Endpoints

- `GET /api/packages` - List/search packages
- `POST /api/packages` - Publish a new package
- `GET /api/packages/{name}` - Get package details
- `GET /health` - Health check endpoint

## Package Manifest (akit.json)

Every published package requires an `akit.json`:
- Required: `name` (lowercase + hyphens), `version` (semver), `type` (`skill`)
- Skill packages require `skill` config: `content` (max 50KB, >10KB stored in MinIO), optional `trigger`, `command`, `hooks`, `permissions`

## Soft Delete Strategy

Packages use soft delete (`deleted_at` column). Deleting a package does NOT cascade to versions or downloads. Deleted package names cannot be re-registered (prevents namespace squatting).

## Scope Namespace

User scope = `@username`, team scope = `@team-slug`. These share one namespace - a team slug cannot collide with any username. Enforce at creation time.

## Language

Primary language is Chinese (中文) for UI, CLI output, and error messages. English support planned for v1.0.

## Code Quality Gates

**代码提交前必须通过以下检查**:

| Component | Tool | Run Command | Check |
|---|---|---|---|
| Server (Python) | Ruff (lint) | `ruff check .` | Lint rules |
| Server (Python) | Ruff (format) | `ruff format --check .` | Code formatting |
| CLI (TypeScript) | oxlint | `pnpm --filter akit lint` | Lint (--deny-warnings) |
| CLI (TypeScript) | TypeCheck | `pnpm --filter akit typecheck` | Type checking |
| Web (TypeScript) | oxlint | `pnpm --filter agent-kit-web lint` | Lint (--deny-warnings) |
| Web (TypeScript) | TypeCheck | `pnpm typecheck` | Type checking |

**Pre-commit checklist**:
1. Run the full commands above - don't skip format or typecheck
2. Python: `ruff check --fix && ruff format` for auto-fix
3. TypeScript: oxlint must have zero warnings (--deny-warnings)
4. Ensure `pnpm typecheck` passes
5. Run tests (`pnpm test` for CLI/Web, `pytest` for server)

**CI gates**: GitHub Actions runs all checks on PRs. If local checks fail, CI will fail too.

## Health Inspection System

The project includes a package health inspection system:

- `app/inspect/inspector.py` - Core inspection orchestrator
- `app/inspect/checks/` - Individual check modules (compliance, content, freshness, functional)
- `app/worker.py` - Background worker that runs inspections
- `app/inspect/scheduler.py` - Scheduling logic
- `app/models/health_check.py` - Health check data model
- `app/schemas/health_check.py` - Health check API schemas

Tests: `apps/server/tests/inspect/`
