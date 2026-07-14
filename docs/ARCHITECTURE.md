# Architecture Overview

> Detailed architecture docs: [`docs/architecture/02-architecture.md`](architecture/02-architecture.md)

## System Shape

Three tightly coupled components forming one product:

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Web (SPA)  │────▶│ Server (API)│◀────│  CLI (akit) │
│  React/Vite │     │   FastAPI   │     │  Commander  │
└─────────────┘     └──────┬──────┘     └─────────────┘
                           │
                    ┌──────┴──────┐
                    │             │
              ┌─────▼─────┐ ┌────▼────┐
              │ PostgreSQL │ │  MinIO  │
              │  Metadata  │ │ Tarballs│
              └───────────┘ └─────────┘
```

## Component Responsibilities

### Server (`apps/server/`)
- **Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic
- **Role:** REST API, package registry logic, auth, team management
- **Pattern:** Route → Service → Model (layered architecture)
- **Entry:** `app.main:app` (ASGI via uvicorn)

### CLI (`apps/cli/`)
- **Stack:** Node.js 20+, TypeScript, Commander.js
- **Role:** `akit` CLI — publish, install, manage packages
- **Pattern:** Commands → API client → Agent adapters
- **Entry:** `src/bin/akit.ts` (dev via tsx), `dist/bin/akit.js` (built)

### Web (`apps/web/`)
- **Stack:** React 18, Vite 5, shadcn/ui, TanStack Query, Zustand
- **Role:** SPA admin dashboard
- **Pattern:** Pages → Components → API client (TanStack Query)
- **Entry:** `src/main.tsx`

## Data Flow

1. **Publish:** CLI uploads tarball → Server stores in MinIO + metadata in PostgreSQL
2. **Install:** CLI requests package → Server serves tarball from MinIO → CLI extracts + configures Agent
3. **Browse:** Web queries API → Server returns metadata from PostgreSQL

## Agent Adapters

The CLI uses an adapter registry (`apps/cli/src/agents/registry.ts`) to write package configs to different AI agents:

- **Claude Code:** `~/.claude/mcp.json` (JSON)
- **Codex:** `~/.codex/config.toml` (TOML)
- **Cursor, Windsurf, Cline, Aider:** Additional adapters

Each adapter implements `AgentAdapter` interface: `detect()`, `readConfig()`, `writeConfig()`, `removeConfig()`.

## Infrastructure

| Service | Purpose | Port |
|---|---|---|
| PostgreSQL 16 | Package metadata, users, teams | 5432 |
| MinIO | Package tarball storage | 9000/9001 |
| Caddy 2 | Reverse proxy, TLS termination | 80/443 |

## Key Design Decisions

- **Soft delete:** Packages use `deleted_at` column; deleted names cannot be re-registered
- **Scope namespace:** `@username` and `@team-slug` share one namespace — no collisions
- **Monorepo:** pnpm workspace with three apps; shared Docker Compose deployment
- **Manifest:** Every package requires `akit.json` (schema in `docs/architecture/18-manifest-schema.md`)
