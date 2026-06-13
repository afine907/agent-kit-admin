# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent Kit Admin is a private Package Registry for AI Agent ecosystems. It manages MCP (Model Context Protocol) servers and Agent Skills for teams using Claude Code, Codex, and other AI agents. Think "npm registry" but for AI agent capabilities.

**Core flow:** `akit publish` (upload package) → Registry stores in PostgreSQL + MinIO → `akit install` (download + auto-configure Agent)

## Architecture

Three components, one deployment:

| Component | Stack | Directory | Purpose |
|---|---|---|---|
| **server** | Python 3.11+ / FastAPI / SQLAlchemy 2.0 (async) | `apps/server/` | REST API + package registry logic (single FastAPI app) |
| **cli** | Node.js 18+ / TypeScript / Commander.js | `apps/cli/` | `akit` CLI — publish, install, manage packages |
| **web** | React 18 / Vite 5 / shadcn/ui / TypeScript | `apps/web/` | SPA admin dashboard |

Infrastructure: PostgreSQL 16 (metadata) + MinIO (package tarballs) + Caddy (gateway/TLS) — all via Docker Compose.

**Key design pattern — Agent Adapters:** The CLI uses an adapter registry (`apps/cli/src/agents/registry.ts`) to write package configs to different AI agents. Each adapter implements `AgentAdapter` interface (detect, readConfig, writeConfig, removeConfig). MVP supports Claude Code (`~/.claude/mcp.json`, JSON) and Codex (`~/.codex/config.toml`, TOML via smol-toml).

## Design Documents (docs/architecture/)

All implementation specs live in `docs/architecture/`. Read these before writing code:

| Document | When to read |
|---|---|
| `02-architecture.md` | Before building any component — system architecture, request flows, planned directory structure |
| `04-data-model.md` | Before writing models/migrations — full SQL schema, indexes, soft delete strategy, JSONB manifest structures |
| `05-api-design.md` | Before writing API routes — all endpoints, request/response formats, error codes, version tag rules, search strategy |
| `06-cli-design.md` | Before writing CLI commands — all commands, interactive flows, Agent config write logic, output formats |
| `07-auth-design.md` | Before implementing auth — OAuth flows (WeChat Work/Feishu/DingTalk), JWT, RBAC, API Key auth |
| `11-mvp-spec.md` | Before starting MVP — scope, Agent adapter architecture with TypeScript code, acceptance criteria |
| `13-edge-cases.md` | Before writing error handling — 20 edge cases with exact API responses and CLI messages |
| `16-developer-quickstart.md` | Before writing any backend code — layered architecture (Route → Service → Model), middleware chain, dependency injection pattern, error handling |
| `18-manifest-schema.md` | Before implementing package validation — JSON Schema for `akit.json`, validation rules |
| `20-frontend-types.md` | Before writing frontend — TypeScript types, TanStack Query hooks, Zustand stores |

Diagrams in `docs/architecture/diagrams/` (Mermaid format): architecture overview, data flow sequences, ER diagrams, user interaction flows.

## Backend Layering Convention

Follow this pattern for all API endpoints (detailed in `16-developer-quickstart.md`):

```
API Layer (api/)      → thin: parse params, call service, return response
Service Layer (services/) → business logic, transactions, permission checks
Model Layer (models/)  → SQLAlchemy ORM, database queries
```

Use FastAPI `Depends()` for dependency injection (auth, db session, service instances). Errors use a unified `AppError(code, message, status_code)` mapped to the error code table in `05-api-design.md`.

## Package Manifest (akit.json)

Every published package requires an `akit.json` (schema in `18-manifest-schema.md`):
- Required: `name` (lowercase + hyphens), `version` (semver), `type` (`mcp` | `skill`)
- MCP packages require `mcp` config: `transport`, `command`, optional `args`, `env`, `capabilities`, `tools`
- Skill packages require `skill` config: `content` (max 50KB, >10KB stored in MinIO), optional `trigger`, `command`, `hooks`, `permissions`

## Soft Delete Strategy

Packages use soft delete (`deleted_at` column). Deleting a package does NOT cascade to versions or downloads. Deleted package names cannot be re-registered (prevents namespace squatting). See `04-data-model.md` for full cascade rules.

## Scope Namespace

User scope = `@username`, team scope = `@team-slug`. These share one namespace — a team slug cannot collide with any username. Enforce at creation time.

## Language

Primary language is Chinese (中文) for UI, CLI output, and error messages. English support planned for v1.0.
